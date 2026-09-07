# @phantasy/plugin-patreon

- Repo URL: https://github.com/phantasy-bot/plugin-patreon
- Forgejo mirror: https://forgejo.thomasjvu.com/phantasy/plugin-patreon
- Canonical remote: GitHub (`phantasy-bot/plugin-patreon`); Forgejo is self-hosted mirror/backup only
- Extraction phase: `source-extracted`
- Source of truth: `standalone-repo`
- Runtime load mode: `git`
- Source owner: `standalone-repo`
- Source payload: `standalone-only`
- Monorepo package status: `removed`
- Sync mode: `standalone-repo`

## Meaning

This repo owns the Patreon implementation. The main Phantasy monorepo keeps
only the plugin contract, catalog metadata, and git-install configuration.

GitHub is the canonical active push target. The Forgejo copy at
`https://forgejo.thomasjvu.com/phantasy/plugin-patreon` is a self-hosted mirror
and release backup; do not treat it as the source of truth.

## Next Step

Maintain, test, and publish this plugin from this repository. Keep member data
scopes narrow and leave Patreon post publication behind an operator-reviewed
plan until the upstream API documents an official write endpoint. See
[issue #1](https://github.com/phantasy-bot/plugin-patreon/issues/1) for the
plan-only publish limitation and follow-up.
