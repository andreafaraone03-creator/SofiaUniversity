---
name: Remote main drift
description: Production `main` can contain direct fixes that have not been synchronized into the Replit workspace.
---

Before shipping a workspace change to production, compare every touched file with the current `main` branch and preserve remote-only changes rather than pushing an older local copy over them.

**Why:** A booking fix investigation found active PostgreSQL adapter and Google OAuth changes on GitHub `main` that were absent locally; deploying stale workspace files would have regressed production behavior.

**How to apply:** Check the exact deployed branch immediately before preparing a production commit. Merge or narrowly update only the intended files, and keep unrelated newer app files out of the change.