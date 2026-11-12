# Decisions

## 2026-11-12 — Initial node

- **npm instead of Bun.** The n8n node CLI (`n8n-node build/lint/release`) and the
  provenance publish workflow n8n requires since 2026-05-01 run on npm.
- **TypeScript 6.0.3, ESLint kept.** `@n8n/node-cli` uses ts-morph and typescript-eslint,
  which need the TypeScript JS API (gone in TS 7). The n8n community lint plugin only exists
  for ESLint, and n8n verification checks with it.
- **Programmatic node, pure request builder.** `buildRequest()` maps resource/operation to one
  HTTP call without an n8n runtime, so every request shape is unit-tested.
- **Admin view is the default for lists.** On a test app, an administrative API token got
  `total: 0` from `/posts` and `/channels` but data from `/posts?manageable=true` and
  `/branch/channels`.
- **Trigger without webhook lifecycle.** Staffbase documents no API to register webhooks;
  the lint rule `webhook-lifecycle-complete` is disabled at that one class with the reason.
  Same for `credential-test-required` on the signing-secret credential.
- **Out of scope for v0.1:** user invite/update/delete, post notifications resend,
  acknowledgements, campaigns, news pages.
