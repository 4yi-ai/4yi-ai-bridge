# @4yi/cli

The 4YI CLI signs in through the 4YI web app and securely connects supported local coding tools to 4YI model routing.

## Install

```bash
npm install -g @4yi/cli
```

Invited beta testers can opt in with `npm install -g @4yi/cli@beta`. The beta channel never replaces the normal `latest` installation automatically.

Node.js 20 or newer is required.

## Quick start

```bash
4yi login
4yi whoami
4yi connect codex --dry-run
4yi connect codex
4yi status codex
```

Supported commands:

```text
4yi login
4yi whoami
4yi logout
4yi code [--model MODEL]
4yi connect <claude|codex|all> [--scope user|project|both] [--dry-run]
4yi status [claude|codex|all]
4yi restore <claude|codex|all>
4yi doctor [--json]
```

`4yi code` installs an isolated, version-pinned OpenCode runtime under `~/.4yi/vendor/opencode`, generates a 4YI-only configuration, and launches it without modifying the user's normal OpenCode state.

Connection commands create protected backups before changing Claude Code or Codex configuration. Use `--dry-run` to inspect target files without changing them and `4yi restore all` to restore the latest protected backup set.

## Authentication and local data

`4yi login` uses browser-based device authorization. On Unix-like systems, the CLI stores its local session in `~/.4yi/config.json` with owner-only permissions. Do not share this file or attach it to a public issue.

See the repository [security policy](https://github.com/4yi-ai/4yi-ai-bridge/blob/main/SECURITY.md) before reporting a vulnerability.

## Development

From the repository root:

```bash
npm install
npm test
npm run smoke:cli
npm run pack:dry
```

For local service development, set `FOURYI_BASE_URL` explicitly:

```bash
FOURYI_BASE_URL=http://localhost:3000 node packages/cli/bin/4yi.mjs login
```

## License

The CLI source in this package is licensed under the [MIT License](LICENSE). The hosted 4YI service remains a separate commercial service.
