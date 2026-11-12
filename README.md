# n8n-nodes-staffbase

<a href="https://www.jasp.eu"><img src="https://www.jasp.eu/images/brand/jasp-logo-lockup-320.png" alt="JASP" width="160"></a>

An [n8n](https://n8n.io) community node for the [Staffbase](https://staffbase.com) public API.
Read and publish news posts, read channels, users and comments, and start workflows from
Staffbase outbound webhooks.

Built and maintained by [JASP](https://www.jasp.eu), a Staffbase partner that builds
intranet apps and integrations.

> Status: on npm as `n8n-nodes-staffbase`, not yet verified by n8n. Self-hosted n8n only
> until verification.

## What it does

| Node              | Resource       | Operations                                                           |
| ----------------- | -------------- | -------------------------------------------------------------------- |
| Staffbase         | Post           | Create (draft, publish now, schedule), Get, Get Many, Update, Delete |
| Staffbase         | Channel        | Get, Get Many                                                        |
| Staffbase         | User           | Get, Get Many                                                        |
| Staffbase         | Comment        | Get, Get Many                                                        |
| Staffbase Trigger | Webhook events | Comment created, updated, deleted; user changed, deleted             |

The Staffbase node can also be used as a tool by n8n AI agents.

## Installation

In a self-hosted n8n: **Settings → Community Nodes → Install**, enter `n8n-nodes-staffbase`,
confirm the risk notice, install. See n8n's
[community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/gui-install/).

To install from a local build instead:

```bash
git clone https://github.com/JASP-eu/n8n-nodes-staffbase.git
cd n8n-nodes-staffbase
npm ci && npm run build && npm pack
# in your n8n custom folder (default ~/.n8n/custom):
npm install /path/to/n8n-nodes-staffbase-0.1.0.tgz
```

Restart n8n. The nodes appear as **Staffbase** and **Staffbase Trigger**.

For local development, `npm run dev` starts n8n with the node linked and hot reload.

## Credentials

### Staffbase API

1. In Staffbase Studio, open the API token page and create a token.
   An **administrative** token is needed for user details and for most write operations.
2. In n8n, create a **Staffbase API** credential:
   - **Base URL**: the API URL of your app, for example `https://yourapp.staffbase.com/api`.
     Studio shows it next to the token; use exactly that host.
   - **API Token**: the token, exactly as Studio shows it.

n8n tests the credential with `GET /channels?limit=1`.

### Staffbase Webhook Signing Secret

Only for the trigger. Paste the signing secret that Staffbase shows when you create the
webhook. The trigger rejects every delivery whose signature does not match.

## Using the trigger

Staffbase has no API to register webhooks, so you connect them by hand once:

1. Add a **Staffbase Trigger** node and pick the events.
2. Copy its **production** webhook URL and activate the workflow.
3. In Staffbase Studio, open **Settings > Extensions > Webhooks**, choose **Create Webhook**,
   paste the URL, select the same events and copy the signing secret.
4. Put that secret into the **Staffbase Webhook Signing Secret** credential.

Each delivery is checked with HMAC-SHA256 over `"<timestamp>.<raw body>"` and rejected when
older than 5 minutes (configurable under **Options**). The event `id` stays the same across
retries; use it to drop duplicates. The output also carries the `deliveryId` header value.

There are no webhook events for news posts or channels. To react to new posts, poll with
**Post > Get Many** on a schedule.

## Good to know

- **Scope for lists.** An API token is not a user. For it, the reader view of posts and
  channels (`/posts`, `/channels`) is empty. **Get Many** therefore uses the admin view by
  default (`manageable=true` for posts, `/branch/channels` for channels). Set **Scope** to
  **Accessible** to get the reader view.
- **Notifications.** Setting **Notification Channels** on **Update** sends the notifications
  again to all readers.
- **Locales.** Post content is written for one locale per call (default `en_US`). Write more
  languages with one **Update** per locale.
- **Users** use User API v2 (`Accept: application/vnd.staffbase.accessors.users.v2+json`);
  v1 is deprecated by Staffbase. Without a search query, **Get Many** also returns pending
  (not yet activated) users. With **Search Query** set, the node calls `/users/search`, which
  finds activated users only.

## Workflow templates

Import any file from [`workflows/`](workflows) via **Workflows > Import from File**:

| File                            | What it does                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `rss-to-staffbase-drafts.json`  | Every 6 hours, turns new RSS items into Staffbase **draft** posts for an editor to review |
| `new-comment-to-slack.json`     | Sends every new Staffbase comment to a Slack channel for moderation                       |
| `weekly-news-digest-email.json` | Every Monday at 8:00, emails a digest of the 10 latest articles                           |

Replace the placeholders (`REPLACE_WITH_CHANNEL_ID`, feed URL, addresses) and pick your
credentials after import. A test checks that every template uses only parameters the nodes
define.

## API claims

Every operation maps to one endpoint documented at
[developers.staffbase.com](https://developers.staffbase.com). "Test tenant" means the
operation ran through the installed npm package (0.1.1, search retested on 0.1.2) on n8n
2.40.5 against a Staffbase test app on 2026-11-12, with the result checked against the app.
Not run live: sending notifications, and errors for a token without permissions.

| Operation                | Request                                                                                                   | Source                                                                                                                                         | Test tenant               |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Post: Get Many           | `GET /posts` (`query`, `sort`, `manageable`, `contentType`, `limit`, `offset`)                            | [News API](https://developers.staffbase.com/api/api-news/)                                                                                     | yes                       |
| Post: Get Many (channel) | `GET /channels/{channelID}/posts` (`limit`, `offset`)                                                     | News API                                                                                                                                       | yes                       |
| Post: Get                | `GET /posts/{postID}`                                                                                     | News API                                                                                                                                       | yes                       |
| Post: Create             | `POST /channels/{channelID}/posts` (`contents`, `published`, `externalID`, `notificationChannels`)        | News API                                                                                                                                       | yes (draft, now)          |
| Post: Update             | `PUT /posts/{postID}`                                                                                     | News API                                                                                                                                       | yes (schedule, unpublish) |
| Post: Delete             | `DELETE /posts/{postID}`                                                                                  | News API                                                                                                                                       | yes                       |
| Channel: Get Many        | `GET /branch/channels` (cursor) or `GET /channels` (offset)                                               | News API                                                                                                                                       | yes                       |
| Channel: Get             | `GET /channels/{channelID}`                                                                               | News API                                                                                                                                       | yes                       |
| User: Get Many           | `GET /users`, v2, or `GET /users/search` with a query; cursor, `limit` ≤ 500                              | [User API](https://developers.staffbase.com/api/api-user/)                                                                                     | yes                       |
| User: Get                | `GET /users/{userId}` (ID or external ID)                                                                 | User API                                                                                                                                       | yes                       |
| Comment: Get Many        | `GET /comments` (`filter`, `sort`, `manage`, `limit`, `offset`)                                           | [Comments API](https://developers.staffbase.com/api/api-comments/)                                                                             | yes                       |
| Comment: Get             | `GET /comments/{commentId}`                                                                               | Comments API                                                                                                                                   | yes                       |
| Trigger                  | signature `Webhook-Signature: t=…,v1=…`, events `news.comment.*.v1`, `user.changed.v1`, `user.deleted.v1` | [Webhooks API](https://developers.staffbase.com/api/api-webhooks/), [guide](https://developers.staffbase.com/guides/manage-outbound-webhooks/) | yes (real deliveries)     |

Not documented by Staffbase, so not built: creating or deleting comments, registering
webhooks by API, rate limits.

## Development

```bash
npm ci
npm run lint       # n8n community node linter
npm run typecheck
npm test           # vitest: request building, pagination, signature, templates
npm run build
```

The project uses npm, not Bun: the n8n node CLI and its provenance release flow
(`npm run release`, `.github/workflows/publish.yml`) are built on npm.

Releases: raise `version` in `package.json`, merge to `main`, then push the matching tag
(`0.1.1`) on that commit. The publish workflow runs on a
GitHub-hosted runner and publishes with npm trusted publishing and a provenance statement.

## License

[MIT](LICENSE.md)
