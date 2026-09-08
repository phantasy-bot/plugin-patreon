# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Document that patreon_create_post_plan is plan-only (publishable: false); link issue #1 and Patreon API v2 resource docs; no fake publish path (#1).
- Expand CI for harden issue 2: cache, install, typecheck, test, build, dist verify, pack dry-run, lockfile, and agent stubs.
- Clarify remotes: GitHub is canonical active push; Forgejo thomasjvu.com is mirror/backup; update README, EXTRACTION_STATUS, SYNC_MANIFEST (#3).

### Added
- Mocked Vitest coverage for Patreon tools and README Development section (#2).
