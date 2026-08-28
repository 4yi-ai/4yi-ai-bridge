# CLI reference

## Install

```bash
npm install -g @4yi/cli
4yi --version
```

For an invited beta test, install `@4yi/cli@beta` explicitly. Existing stable users stay on npm `latest` unless they opt in.

Node.js 20 or newer is required.

## Authentication

```bash
4yi login
4yi whoami
4yi logout
```

`4yi login` opens the 4YI web app for device authorization. The terminal never asks you to paste the platform password.

## Launch OpenCode

```bash
4yi code
4yi code --model MODEL_ID
```

The runtime and its state are isolated under `~/.4yi`. The CLI installs known-compatible, exact dependency versions for repeatable behavior.

## Connect an existing tool

Always preview the affected files first:

```bash
4yi connect claude --dry-run
4yi connect codex --dry-run
4yi connect all --dry-run
```

Apply the connection:

```bash
4yi connect claude
4yi connect codex
4yi connect all
```

Claude supports `--scope user`, `--scope project`, and `--scope both`. If the required third-party CLI is missing, 4YI asks before installing the pinned compatible npm package. `--yes` is intended for controlled non-interactive environments.

## Inspect and restore

```bash
4yi status all
4yi restore all
```

Every connection creates a timestamped protected backup before writing. `restore` restores the latest backup group and removes files that did not exist before the connection.

## Diagnostics

```bash
4yi doctor
4yi doctor --json
```

Doctor checks the Node version, service URL, local session-file permissions, sign-in presence, and installed target CLIs. It does not print the stored token.

## Development overrides

`FOURYI_BASE_URL` and `FOURYI_OPENCODE_PACKAGE` are development and compatibility overrides. Do not set them in ordinary production use. Non-local service URLs must use HTTPS.
