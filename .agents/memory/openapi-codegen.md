---
name: OpenAPI codegen recovery
description: How Orval behaves when generating the workspace API clients and schemas.
---

Treat the OpenAPI specification as the source of truth. Orval cleans generated output folders before writing new clients and schemas, so fix syntax or unresolved references in the specification and rerun code generation rather than editing generated files.

**Why:** During implementation, code generation surfaced malformed YAML and a missing schema reference; a successful rerun restored the generated packages and validated library types.

**How to apply:** Before code generation, check YAML indentation and that every `$ref` resolves. If generation fails after cleaning output folders, correct the specification and rerun the codegen command.