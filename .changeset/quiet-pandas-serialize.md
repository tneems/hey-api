---
"@hey-api/openapi-ts": patch
---

**fix**: serialize query parameters described with `content` using their media type

Query parameters declared with `content: { 'application/json': { schema } }` instead of `schema` are now JSON-encoded at runtime. Previously the schema was resolved into the correct TypeScript type, but the value was serialized with the default `style`/`explode` rules, producing `?node[email]=foo` instead of `?node=%7B%22email%22%3A%22foo%22%7D`.
