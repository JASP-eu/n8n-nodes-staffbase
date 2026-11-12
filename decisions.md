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

## 2026-11-12 — Publishing

- **GitHub-hosted runners in this repo (exception to the self-hosted-only team rule).** npm
  trusted publishing and provenance work only on cloud-hosted runners ("Self-hosted runners
  are not currently supported", docs.npmjs.com/trusted-publishers), and n8n accepts only
  nodes published from GitHub Actions with provenance. The team rule exists because hosted
  minutes are a paid budget; this repo is public, where standard hosted runners cost nothing.
  CI stays on `ubuntu-latest` for the same reason. Revisit if the repo turns private.
- **npm account `jasp-eu`** (JASP, created 2026-11-12) owns the package; 2FA on.
- **First publish with a short-lived token, then trusted publishing.** npm can only attach a
  trusted publisher to an existing package. 0.1.0 goes out through `publish.yml` with a
  granular token in `NPM_TOKEN` (provenance included). Then the trusted publisher
  (`JASP-eu/n8n-nodes-staffbase`, `publish.yml`) is set, the token revoked and the secret
  deleted. A trusted publisher that has not published within 48 hours expires, so 0.1.1
  follows through OIDC to validate it.
- **0.1.0 was held by npm:** the token publish of 0.1.0 printed
  `+ n8n-nodes-staffbase@0.1.0`, yet the registry showed only `0.0.0-stage` ("Temporary
  Holding Version … awaiting a staged release") and `npm stage list` stayed empty. 0.1.0 appeared on its own 2.5 minutes later
  (15:04 → 15:06 UTC) without any approval: wait a few minutes before debugging.
- **Before January 2027:** npm removes direct publishing with granular tokens. Trusted
  publishing is not affected; never reintroduce a token-based publish path.
