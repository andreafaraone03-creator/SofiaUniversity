---
name: Sofia Calendar OAuth and PostgreSQL
description: OAuth identity, Meet account selection, and PostgreSQL row-name mapping for Sofia's Calendar and email paths.
---

Use persisted, hashed, single-use OAuth state with a short expiration for the Google Calendar callback instead of depending on a browser cookie surviving the provider round-trip. For PostgreSQL queries that need camelCase JavaScript keys, quote the aliases (for example, `AS "refreshToken"`), or use snake_case keys consistently.

**Why:** Safari's OAuth return did not present the expected cookie state, and PostgreSQL lowercased unquoted camelCase aliases, making a successful Calendar authorization appear disconnected and preventing settings/token reads.

**How to apply:** When changing Sofia's OAuth or email settings paths, preserve one-time state validation and verify production connection status plus a read-only availability request after deployment.

For production HTTP checks, use the verified custom domain `https://sofiauniversity.it`; do not infer the public host from the Render service name in `render.yaml`. Keep the Google OAuth redirect URI aligned with the exact callback URL already authorized in Google and configured in Render.

**Why:** The generated hostname based on the Render service name returned 404, while the custom domain served the API health and availability endpoints successfully.

**How to apply:** Before checking production health or availability, confirm the host against the configured public domain. Do not change the OAuth redirect URI based only on the service name.

For admin Meet links, the Google-hosted `accounts.google.com/AccountChooser` page currently accepts `Email` and `continue` parameters and displays Google's sign-in flow. Preserve the exact original Meet URL in the encoded `continue` value and keep a direct-link fallback when no valid configured address is available. The chooser is a convenience only; it does not authenticate the user or grant access.

**Why:** Google's OIDC documentation supports `login_hint` and `prompt=select_account` for OAuth, but does not document a generic Meet continuation URL. Fetching the hosted account-chooser URL confirmed that Google currently serves its sign-in page, so the dashboard should avoid treating account selection as authorization.

**How to apply:** Verify the Google-hosted chooser before changing its URL parameters. Continue to verify OAuth identity independently and never imply that selecting or receiving mail at an address transfers Meet ownership or permissions.