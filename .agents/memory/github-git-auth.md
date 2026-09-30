---
name: GitHub transport authentication
description: Distinguishes the GitHub REST connector from credentials used by the Git CLI.
---

The Replit GitHub connector authenticates REST API requests through its proxy; it does not authenticate `git push` over HTTPS. When Git transport rejects a push, use a narrowly scoped credential through the secure secrets flow rather than assuming the connected API integration will cover Git.

**Why:** A connected GitHub integration can work for API access while a normal Git push still fails authentication.

**How to apply:** Verify the repository URL and branch first. If Git transport authentication fails, use the workspace secret flow for a repository-scoped token; never print or paste the token, and do not work around the failure by creating a different commit history through the API.