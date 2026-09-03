# @phantasy/plugin-patreon

- Repo URL: https://github.com/phantasy-bot/plugin-patreon
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

## Next Step

Maintain, test, and publish this plugin from this repository. Keep member data
scopes narrow and leave Patreon post publication behind an operator-reviewed
plan until the upstream API documents an official write endpoint.
