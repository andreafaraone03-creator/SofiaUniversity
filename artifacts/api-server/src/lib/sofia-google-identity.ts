export class GoogleAccountMismatchError extends Error {
  constructor() {
    super("The authorized Google account does not match the configured admin notification email.");
    this.name = "GoogleAccountMismatchError";
  }
}

export function normalizeGoogleAccountEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function buildGoogleAuthorizationUrl(options: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: readonly string[];
  loginHint?: string | null;
}): string {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: options.scopes.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent select_account",
    state: options.state,
  });
  const loginHint = normalizeGoogleAccountEmail(options.loginHint);
  if (loginHint) params.set("login_hint", loginHint);
  return `${options.authorizationEndpoint}?${params.toString()}`;
}

export async function getVerifiedGoogleAccountEmail(
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const profile = await response.json().catch(() => null) as {
    email?: unknown;
    email_verified?: unknown;
  } | null;
  const email = normalizeGoogleAccountEmail(profile?.email);
  if (!response.ok || !email || profile?.email_verified !== true) {
    throw new Error("Google did not return a verified account email.");
  }
  return email;
}

export async function persistGoogleCredentialsForAccount(
  expectedEmail: string | null,
  authorizedEmail: string,
  persist: (verifiedEmail: string) => Promise<void>,
): Promise<string> {
  const verifiedEmail = normalizeGoogleAccountEmail(authorizedEmail);
  if (!verifiedEmail) {
    throw new Error("Google account identity could not be verified.");
  }
  const expected = normalizeGoogleAccountEmail(expectedEmail);
  if (expected && expected !== verifiedEmail) {
    throw new GoogleAccountMismatchError();
  }
  await persist(verifiedEmail);
  return verifiedEmail;
}