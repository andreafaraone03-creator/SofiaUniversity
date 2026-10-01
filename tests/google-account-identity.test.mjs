import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGoogleAuthorizationUrl,
  getVerifiedGoogleAccountEmail,
  GoogleAccountMismatchError,
  normalizeGoogleAccountEmail,
  persistGoogleCredentialsForAccount,
} from "../artifacts/api-server/src/lib/sofia-google-identity.ts";

test("Google OAuth explicitly requests account selection and hints the configured address", () => {
  const authorizationUrl = buildGoogleAuthorizationUrl({
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    clientId: "sofia-client",
    redirectUri: "https://sofia.example/api/admin/google-calendar/callback",
    state: "random-state",
    scopes: ["calendar.events", "openid", "email"],
    loginHint: "  Sofia@Example.com  ",
  });
  const url = new URL(authorizationUrl);

  assert.equal(url.searchParams.get("login_hint"), "sofia@example.com");
  assert.equal(url.searchParams.get("prompt"), "consent select_account");
  assert.equal(url.searchParams.get("scope"), "calendar.events openid email");
  assert.equal(url.searchParams.get("state"), "random-state");
});

test("Google OAuth omits a malformed account hint instead of sending it to Google", () => {
  const url = new URL(buildGoogleAuthorizationUrl({
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    clientId: "sofia-client",
    redirectUri: "https://sofia.example/api/admin/google-calendar/callback",
    state: "random-state",
    scopes: ["openid", "email"],
    loginHint: "not-an-email",
  }));

  assert.equal(url.searchParams.has("login_hint"), false);
});

test("Google userinfo must return a verified email for the authorized account", async () => {
  const email = await getVerifiedGoogleAccountEmail(
    "access-token",
    async (url, init) => {
      assert.equal(url, "https://openidconnect.googleapis.com/v1/userinfo");
      assert.equal(init.headers.Authorization, "Bearer access-token");
      return new Response(JSON.stringify({
        email: "Sofia@Example.com",
        email_verified: true,
      }), { status: 200 });
    },
  );

  assert.equal(email, "sofia@example.com");
  await assert.rejects(
    getVerifiedGoogleAccountEmail("access-token", async () => new Response(
      JSON.stringify({ email: "sofia@example.com", email_verified: false }),
      { status: 200 },
    )),
    /verified account email/,
  );
});

test("a mismatched account cannot replace the active Calendar credentials", async () => {
  let storedAccount = "sofia@example.com";
  let writes = 0;

  await assert.rejects(
    persistGoogleCredentialsForAccount(
      "sofia@example.com",
      "other@example.com",
      async (email) => {
        writes += 1;
        storedAccount = email;
      },
    ),
    GoogleAccountMismatchError,
  );

  assert.equal(storedAccount, "sofia@example.com");
  assert.equal(writes, 0);

  await persistGoogleCredentialsForAccount(
    "SOFIA@example.com",
    "Sofia@Example.com",
    async (email) => {
      writes += 1;
      storedAccount = email;
    },
  );
  assert.equal(storedAccount, "sofia@example.com");
  assert.equal(writes, 1);
  assert.equal(normalizeGoogleAccountEmail(" invalid "), null);
});