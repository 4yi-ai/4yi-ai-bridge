# Product roadmap and release gates

## Phase 1 — Public CLI foundation

- [x] Independent MIT-licensed CLI source package
- [x] Production-only default service configuration
- [x] Claude Code, Codex, and isolated OpenCode adapters
- [x] Protected backup, status, restore, and non-mutating dry-run
- [x] Local diagnostics and token-redacted output
- [x] Cross-platform CI definition, security checks, examples, and npm release workflow
- [ ] Verify CI in the real GitHub repository
- [ ] Complete signed-off production end-to-end tests on fresh macOS, Windows, and Linux hosts
- [ ] Publish `@4yi/cli@0.2.0-beta.1` to the isolated npm `beta` channel from a GitHub prerelease

## Phase 2 — Local bridge daemon

- [ ] Loopback-only listener with a separate random local-client token
- [ ] `/v1/models`, `/v1/chat/completions`, `/v1/responses`, and streaming
- [ ] Anthropic Messages compatibility required by Claude clients
- [ ] Health, readiness, connection inventory, and redacted diagnostics
- [ ] Process lifecycle, port conflict handling, and safe shutdown
- [ ] Contract and end-to-end tests against a mock hosted gateway

## Phase 3 — Desktop app

- [ ] Signed desktop shell for macOS and Windows, then Linux
- [ ] Browser login and OS credential storage
- [ ] Local application discovery and reversible one-click connection
- [ ] Bridge status, model catalog, balance/usage, and request health
- [ ] Tray controls, startup behavior, updates, and safe diagnostic export
- [ ] Signed installers, checksums, notarization, and update metadata

## Phase 4 — Agent services

- [ ] Versioned agent-service protocol
- [ ] Capability and permission declarations
- [ ] Per-run workspace, network, shell, and cost controls
- [ ] Human approval for high-risk actions
- [ ] Execution history, audit log, and revocation
- [ ] Signed agent catalog and trusted-source policy

Hosted billing, model routing policy, provider credentials, abuse prevention, customer data, and infrastructure remain outside this public repository in every phase.
