# Troubleshooting

## `Not signed in`

Run `4yi login`, approve the request in the browser, then verify with `4yi whoami`.

## Browser did not open

Copy the verification URL printed by `4yi login` into a browser. The device authorization expires; restart login if the page says it is no longer valid.

## Claude Code or Codex is missing

Run the connection command interactively and approve installation, or install the exact package shown by the CLI yourself. The CLI never installs a desktop application automatically.

## Inspect changes before connecting

```bash
4yi connect all --dry-run
```

This lists target files without installing tools, creating backups, signing in, or modifying configuration.

## Restore previous configuration

```bash
4yi restore all
```

If no backup is available, the command exits without inventing a replacement configuration.

## Collect safe diagnostics

```bash
4yi doctor
4yi status all
```

Review output before sharing it. Do not post complete configuration files, prompts, account details, or logs containing request bodies.

## Corporate proxy or TLS interception

The CLI uses the Node.js network stack. Configure your approved Node proxy and CA settings according to your organization's policy. Do not bypass TLS verification.
