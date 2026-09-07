# `@phantasy/plugin-patreon`

Patreon API v2 integration for Phantasy creator companions.

This package provides campaign and tier reads, bounded member entitlement
sync, post reads, and a reviewed free/paid post plan. It deliberately does not
pretend to publish posts: Patreon’s current API v2 resource documentation
describes post reads and webhooks, but does not document a post-create endpoint.
Until Patreon exposes an official write endpoint, publish the returned plan in
Patreon’s creator UI.

The canonical source repository is
`https://github.com/phantasy-bot/plugin-patreon`. The Phantasy Forgejo
repository at `https://forgejo.thomasjvu.com/phantasy/plugin-patreon` is kept as
the self-hosted mirror and release backup.

## Post publishing limitation

`patreon_create_post_plan` is **plan-only**: it returns a reviewed payload with
`publishable: false` and never calls a Patreon write/create endpoint. Track the
upstream gap and operator workflow in
[issue #1](https://github.com/phantasy-bot/plugin-patreon/issues/1). Until Patreon
documents an official post-create API, publish through the Patreon creator UI.

## Remotes

| Remote | URL | Role |
| --- | --- | --- |
| GitHub | `https://github.com/phantasy-bot/plugin-patreon` | Canonical active push target |
| Forgejo | `https://forgejo.thomasjvu.com/phantasy/plugin-patreon` | Self-hosted mirror / backup |

Do **not** block on `forgejo.phantasy.bot` (legacy / unavailable). Prefer
`forgejo.thomasjvu.com` for mirror and backup sync.

## Configuration

Keep the access token in the runtime environment, never in an agent config
file.

Environment example:

```env
PATREON_ACCESS_TOKEN=...
PATREON_CAMPAIGN_ID=...
PATREON_DEFAULT_AUDIENCE=public
PATREON_DEFAULT_TIER_ID=...
PATREON_MAX_PAGES=10
```

The token needs the v2 scopes required by the selected operations, such as
`campaigns`, `campaigns.members`, `campaigns.posts`, and
`identity`. Member email is intentionally not requested by this plugin.

## Tools

- `patreon_test_connection`
- `patreon_get_campaign`
- `patreon_list_members`
- `patreon_get_member_access`
- `patreon_list_posts`
- `patreon_sync_audience`
- `patreon_create_post_plan`

## Development

Local checks:

1. npm install
2. npm run typecheck
3. npm test
4. npm run build

CI (`.github/workflows/ci.yml`) runs install (npm ci when a lockfile is
present, otherwise npm install), package metadata checks, typecheck, tests,
build, dist artifact verification, and npm pack --dry-run on push and pull
request to `main` and `development`.

The plugin is maintained as a standalone first-party extension alongside the
Phantasy runtime. See Patreon’s [API v2 resource endpoint
documentation](https://docs.patreon.com/#apiv2-resource-endpoints) for the
upstream contract.
