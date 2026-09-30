---
name: Render deployment verification
description: Confirms whether a pushed commit is actually serving through the Render production service.
---

A successful push to GitHub does not prove that Render deployed the commit. GitHub may provide no status checks, and the hostname inferred from a `render.yaml` service name may have no service attached.

**Why:** A guessed `onrender.com` host resolved but returned Render's `x-render-routing: no-server` response, while GitHub exposed no deployment status.

**How to apply:** Confirm the production URL from a verified source, then check the service health endpoint and built app. Do not report production as live based only on a successful push or a hostname guess.