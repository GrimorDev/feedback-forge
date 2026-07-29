# Feedback Forge API Contract

`ENABLE_PAYMENTS=false` keeps all new accounts on `EARLY_ADOPTER` with `lifetimeFree=true`.

## Tenant URL model

Each project is addressed by its `Project.slug`.
Feedback rows and vote rows both carry `projectId`; tags are stored on feedback rows, so they inherit the same project scope.

| Surface | URL |
| --- | --- |
| Public roadmap | `/p/:projectSlug` |
| Public changelog | `/p/:projectSlug/changelog` |
| Admin project dashboard | `/admin` |
| Admin board | `/admin/projects/:projectSlug/board` |
| Admin integrations | `/admin/projects/:projectSlug/wloty` |
| Admin settings | `/admin/projects/:projectSlug/settings` |

Admin endpoints are protected when `ADMIN_API_KEY` is set. Send either:

- `Authorization: Bearer <ADMIN_API_KEY>`
- `x-admin-api-key: <ADMIN_API_KEY>`

## Public

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/projects/:slug/board` | Public roadmap: `PLANNED`, `IN_PROGRESS`, `COMPLETED`. |
| `POST` | `/api/v1/projects/:slug/feedback` | Create feedback from widget, Discord, GitHub, or API. |
| `POST` | `/api/v1/projects/:slug/feedbacks/discord` | Create feedback from the Discord `/suggest` bot. |
| `POST` | `/api/v1/feedback/:id/vote` | Toggle a vote in a transaction and update `upvotesCount`. |
| `GET` | `/api/v1/projects/:slug/changelog` | Completed feedback sorted by `updatedAt DESC`. |

Public create/vote payloads can include lightweight identity fields:

```json
{
  "email": "member@example.com",
  "name": "Mila",
  "discordId": "71820491"
}
```

Creating feedback additionally accepts `title`, `description`, `category`, `source`, `tags`, and `externalUrl`.

Discord bot payload:

```json
{
  "title": "Patron-only channels",
  "description": "Grant role after payment",
  "discord_user_id": "71820491",
  "discord_username": "Grimor",
  "channel_id": "123456789012345678"
}
```

Public protection:

- `publicRoadmap=false` hides the project from future catalog/listing surfaces, but does not block a direct `/p/:slug` link.
- `requireDiscordAuth=true` requires Discord login before viewing board/changelog or submitting from the web widget.
- `discordGuildId` optionally restricts access to members of a Discord server.
- `discordRoleId` optionally restricts access to members with a specific role inside that server.
- `requireLoginToVote=true` requires an active session for `POST /api/v1/feedback/:id/vote`.
- Public feedback creation is rate-limited to 3/hour per IP.
- Voting is rate-limited to 10/minute per IP.

## Admin

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/projects` | List projects owned by or assigned to the current admin. |
| `POST` | `/api/v1/admin/projects` | Create a new project and generate a unique slug. |
| `GET` | `/api/v1/admin/feedbacks` | Triage inbox with status, category, query, and source filters. |
| `PATCH` | `/api/v1/admin/feedbacks/:id` | Update status, category, tags, and priority. |
| `POST` | `/api/v1/admin/feedbacks/:id/merge` | Merge a duplicate and move unique voters to the target. |
| `POST` | `/api/v1/admin/feedbacks/:id/comments` | Add public reply or internal note. |
| `GET` | `/api/v1/admin/projects/:slug/settings` | Load project settings, saved integrations, and generated setup instructions. |
| `PATCH` | `/api/v1/admin/projects/:slug/settings` | Save project name, description, custom domain, privacy, and moderator Discord IDs. |
| `PUT` | `/api/v1/admin/projects/:slug/integrations/:provider` | Save integration config for `DISCORD`, `WEB_WIDGET`, `GITHUB`, or `API`. |

The settings response also returns generated setup values:

```json
{
  "instructions": {
    "apiBaseUrl": "https://feedback.example.com",
    "discordProjectEndpoint": "https://feedback.example.com/api/v1/projects/orbit-chat/feedbacks/discord",
    "discordWebhookUrl": "https://feedback.example.com/api/v1/webhooks/discord/suggest",
    "githubWebhookUrl": "https://feedback.example.com/api/v1/webhooks/github/issues",
    "widgetSnippet": "<script async src=\"https://feedback.example.com/widget.js\" data-project=\"orbit-chat\"></script>"
  }
}
```

Merge payload:

```json
{
  "duplicateId": "00000000-0000-4000-8000-000000000001"
}
```

Project settings payload:

```json
{
  "name": "Orbit Chat",
  "description": "Public roadmap for the community",
  "customDomain": "feedback.example.com",
  "publicRoadmap": true,
  "requireLoginToVote": false,
  "requireDiscordAuth": true,
  "discordGuildId": "123456789012345678",
  "discordRoleId": "234567890123456789",
  "moderatorDiscordIds": ["71820491"]
}
```

Integration payload:

```json
{
  "enabled": true,
  "config": {
    "channelId": "123456789012345678"
  }
}
```

## Integrations

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/webhooks/discord/suggest` | Receive `/suggest` payloads from Discord. |
| `POST` | `/api/v1/webhooks/github/issues` | Import GitHub issue content as feedback. |
| `POST` | `/api/v1/webhooks/stripe` | Ready for phase 2 subscriptions. No-op while payments are disabled. |
| `POST` | `/api/v1/webhooks/events` | Outbound events for Discord or custom systems. |

## Status side effects

When feedback changes to `COMPLETED`, create a `NotificationEvent` for the author:

- Discord DM when `discordId` exists.
- Email fallback otherwise.
- Outbound webhook event when the project has enabled webhooks.
