---
name: OpenAPI date-only response coercion
description: Preserve date-only API values when validating and serializing responses.
---

When `z.coerce.date()` validates an OpenAPI `format: date` field, it converts `YYYY-MM-DD` into a JavaScript `Date`. `res.json()` then serializes that value as an ISO timestamp. Validate the response with Zod, then restore the original date-only string before sending it. Keep timestamp fields as ISO strings.

**Why:** A date-only value serialized as a timestamp can violate a client's assumptions and break rendering when the client appends its own time component.

**How to apply:** Check generated schemas for `z.coerce.date()` on `format: date` fields. For API responses with date-only semantics, preserve the raw database string after schema validation, following routes that already restore dates.