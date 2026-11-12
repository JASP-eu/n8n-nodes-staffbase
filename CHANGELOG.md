## 0.1.2 (2026-11-12)

- User > Get Many: **Search Query** now filters. It calls `/users/search`; `GET /users` (v2)
  ignored the query and returned every user. Search finds activated users only.

## 0.1.1 (2026-11-12)

- Release pipeline publishes through npm trusted publishing only; no npm token.
- Normalized repository URL in package.json.

## 0.1.0 (2026-11-12)

- Staffbase node: posts, channels, users, comments.
- Staffbase Trigger: signed outbound webhooks.
- Three workflow templates.
