# Feedback Forge API Contract

`ENABLE_PAYMENTS=false` keeps all new accounts on `EARLY_ADOPTER` with `lifetimeFree=true`.

Admin endpoints are protected when `ADMIN_API_KEY` is set. Send either:

- `Authorization: Bearer <ADMIN_API_KEY>`
- `x-admin-api-key: <ADMIN_API_KEY>`

## Public

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/projects/:slug/board` | Public roadmap: `PLANNED`, `IN_PROGRESS`, `COMPLETED`. |
| `POST` | `/api/v1/projects/:slug/feedback` | Create feedback from widget, Discord, GitHub, or API. |
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

## Admin

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/feedbacks` | Triage inbox with status, category, query, and source filters. |
| `PATCH` | `/api/v1/admin/feedbacks/:id` | Update status, category, tags, and priority. |
| `POST` | `/api/v1/admin/feedbacks/:id/merge` | Merge a duplicate and move unique voters to the target. |
| `POST` | `/api/v1/admin/feedbacks/:id/comments` | Add public reply or internal note. |
| `GET` | `/api/v1/admin/projects/:slug/settings` | Load project settings, saved integrations, and generated setup instructions. |
| `PATCH` | `/api/v1/admin/projects/:slug/settings` | Save project name, description, custom domain, privacy, and moderator Discord IDs. |
| `PUT` | `/api/v1/admin/projects/:slug/integrations/:provider` | Save integration config for `DISCORD`, `WEB_WIDGET`, `GITHUB`, or `API`. |

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
