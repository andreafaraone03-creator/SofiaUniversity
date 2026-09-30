---
name: Sofia Resend isolation
description: Credential scoping for confirmation email delivery in Sofia's app.
---

Keep Sofia's Resend credentials isolated in a project-level Replit Secret named `SOFIA_RESEND_API_KEY`. Do not replace the Personal Resend connector that is shared with another app.

**Why:** The existing Personal connector is also used by another Replit app, while Sofia must use a different Resend account without changing that app's configuration.

**How to apply:** Changes to Sofia's email sender should read the project secret and use the verified sender configured in Sofia's admin email settings. Collect the API key only through Replit's secure Secrets flow, never in chat.