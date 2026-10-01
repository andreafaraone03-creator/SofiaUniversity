import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { sofiaStorage, sofiaTransaction } from "./sofia-db";

const callbackPath = "/api/admin/google-calendar/callback";
const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const scopes = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];
const oauthEnvKeys = [
  "SOFIA_GOOGLE_CLIENT_ID",
  "SOFIA_GOOGLE_CLIENT_SECRET",
  "SOFIA_GOOGLE_REDIRECT_URI",
  "SOFIA_GOOGLE_TOKEN_ENCRYPTION_KEY",
] as const;
const oauthStateLifetimeMs = 10 * 60 * 1000;

type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: string;
};

type EncryptedRefreshToken = {
  encryptedRefreshToken: string;
  iv: string;
  authTag: string;
};

type GoogleTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  error?: unknown;
};

export type GoogleCalendarConnectionStatus = {
  provider: "replit" | "google_oauth" | "not_configured";
  connected: boolean;
  canConnect: boolean;
};

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

export async function createGoogleOAuthState(): Promise<string> {
  const state = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + oauthStateLifetimeMs).toISOString();
  await sofiaTransaction(async (tx) => {
    await tx.run(
      "DELETE FROM sofia_google_calendar_oauth_states WHERE expires_at <= ?",
      now.toISOString(),
    );
    await tx.run(
      "INSERT INTO sofia_google_calendar_oauth_states (state_hash, expires_at) VALUES (?, ?)",
      createHash("sha256").update(state, "utf8").digest("hex"),
      expiresAt,
    );
  });
  return state;
}

export async function consumeGoogleOAuthState(value: unknown): Promise<boolean> {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    return false;
  }
  const now = new Date().toISOString();
  const result = await sofiaTransaction((tx) =>
    tx.run(
      `DELETE FROM sofia_google_calendar_oauth_states
       WHERE state_hash = ? AND expires_at > ?`,
      createHash("sha256").update(value, "utf8").digest("hex"),
      now,
    ),
  );
  return result.changes === 1;
}

export function usesGoogleOAuth(): boolean {
  return process.env.NODE_ENV === "production" ||
    oauthEnvKeys.some((key) => Boolean(process.env[key]?.trim()));
}

function readOAuthConfig(): OAuthConfig {
  const values = oauthEnvKeys.map((key) => process.env[key]?.trim() ?? "");
  if (values.some((value) => !value)) {
    throw new Error("Google Calendar OAuth is not fully configured.");
  }

  const [clientId, clientSecret, redirectUri, encryptionKey] = values;
  const redirect = new URL(redirectUri);
  if (
    redirect.pathname !== callbackPath ||
    redirect.search ||
    redirect.hash ||
    redirect.username ||
    redirect.password ||
    (process.env.NODE_ENV === "production" && redirect.protocol !== "https:")
  ) {
    throw new Error("Google Calendar OAuth redirect URI is invalid.");
  }

  return { clientId, clientSecret, redirectUri, encryptionKey };
}

export async function getGoogleCalendarConnectionStatus(): Promise<GoogleCalendarConnectionStatus> {
  if (!usesGoogleOAuth()) {
    return { provider: "replit", connected: true, canConnect: false };
  }

  let config: OAuthConfig;
  try {
    config = readOAuthConfig();
  } catch {
    return { provider: "not_configured", connected: false, canConnect: false };
  }

  const row = await sofiaStorage.get<EncryptedRefreshToken>(`
    SELECT encrypted_refresh_token AS "encryptedRefreshToken", iv, auth_tag AS "authTag"
    FROM sofia_google_calendar_credentials
    WHERE id = 1
  `);
  let connected = false;
  if (row) {
    try {
      decryptRefreshToken(row, config.encryptionKey);
      connected = true;
    } catch {
      connected = false;
    }
  }
  return {
    provider: "google_oauth",
    connected,
    canConnect: true,
  };
}

export function createGoogleAuthorizationUrl(state: string): string {
  const config = readOAuthConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `${authorizationEndpoint}?${params.toString()}`;
}

function encryptionKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function encryptRefreshToken(refreshToken: string, secret: string): EncryptedRefreshToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(refreshToken, "utf8"),
    cipher.final(),
  ]);
  return {
    encryptedRefreshToken: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptRefreshToken(
  record: EncryptedRefreshToken,
  secret: string,
): string {
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(secret),
      Buffer.from(record.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(record.encryptedRefreshToken, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Google Calendar authorization must be renewed.");
  }
}

export async function completeGoogleAuthorization(code: string): Promise<void> {
  const config = readOAuthConfig();
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const token = await response.json().catch(() => null) as GoogleTokenResponse | null;
  if (
    !response.ok ||
    !token ||
    typeof token.refresh_token !== "string" ||
    !token.refresh_token
  ) {
    throw new Error("Google Calendar authorization did not return a refresh token.");
  }

  const encrypted = encryptRefreshToken(token.refresh_token, config.encryptionKey);
  await sofiaStorage.run(`
    INSERT INTO sofia_google_calendar_credentials
      (id, encrypted_refresh_token, iv, auth_tag, connected_at)
    VALUES (1, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      encrypted_refresh_token = excluded.encrypted_refresh_token,
      iv = excluded.iv,
      auth_tag = excluded.auth_tag,
      connected_at = excluded.connected_at
  `,
  encrypted.encryptedRefreshToken,
  encrypted.iv,
  encrypted.authTag,
  new Date().toISOString(),
  );
  cachedAccessToken = null;
}

export async function getGoogleAccessToken(): Promise<string> {
  const config = readOAuthConfig();
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60_000) {
    return cachedAccessToken.value;
  }

  const record = await sofiaStorage.get<EncryptedRefreshToken>(`
    SELECT encrypted_refresh_token AS "encryptedRefreshToken", iv, auth_tag AS "authTag"
    FROM sofia_google_calendar_credentials
    WHERE id = 1
  `);
  if (!record) throw new Error("Google Calendar is not connected.");

  const refreshToken = decryptRefreshToken(record, config.encryptionKey);
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const token = await response.json().catch(() => null) as GoogleTokenResponse | null;
  if (
    !response.ok ||
    !token ||
    typeof token.access_token !== "string" ||
    !token.access_token
  ) {
    if (token?.error === "invalid_grant") {
      await sofiaStorage.run(
        "DELETE FROM sofia_google_calendar_credentials WHERE id = 1",
      );
      cachedAccessToken = null;
    }
    throw new Error("Google Calendar access could not be refreshed.");
  }

  const expiresIn = typeof token.expires_in === "number" ? token.expires_in : 3600;
  cachedAccessToken = {
    value: token.access_token,
    expiresAt: now + Math.max(expiresIn, 60) * 1000,
  };
  return cachedAccessToken.value;
}