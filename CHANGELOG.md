# Changelog

All notable public client changes are documented here. Versions follow semantic versioning.

## [Unreleased]

### Fixed

- Allow the reviewed, version-pinned `opencode-ai@1.18.25` install script so `4yi code` can prepare its platform binary under npm 12.
- Keep documentation link checks compatible with npmjs bot protection and current GitHub Actions runtimes.
- Make cross-platform test expectations use the host operating system's path and permission behavior.
- Avoid shell glob expansion in the root test command so it runs under Windows `cmd.exe`.

## [0.2.0-beta.1] - 2026-08-28

### Added

- Public `@4yi/cli` source, tests, and npm package metadata.
- Safe `4yi connect --dry-run` planning.
- `4yi doctor` local readiness and permission checks.
- Version-pinned OpenCode, Claude Code, Codex, and OpenAI-compatible adapter installation.
- Curl, Python, and TypeScript API examples.
- Public/private boundary and marketing-claim checks.

### Changed

- Aligned the CLI package with the repository MIT license.

### Fixed

- Restoring a first-time Codex connection now removes both the generated configuration and model catalog.

## [0.1.10] - 2026-08-28

- Last CLI release before the source moved into the standalone public repository.
