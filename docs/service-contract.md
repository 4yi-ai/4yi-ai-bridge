# Public client/service contract

This document describes the hosted endpoints consumed by the public CLI. It documents interoperability only; hosted implementations remain private.

## Device authorization

`POST /api/cli/auth/start` returns a device code, a complete browser verification URL, an expiry in seconds, and a polling interval.

`POST /api/cli/auth/poll` accepts the device code and returns a pending or approved status. An approved response includes the CLI token used for subsequent client requests.

`GET /api/cli/session` returns the authenticated user and organization visible to the CLI.

The CLI must never print the approved token. Expired, rejected, or revoked authorization must require a new login.

## Coding model catalog

`GET /api/cli/models` returns the coding models allowed for the authenticated organization, the OpenAI-compatible base URL, and a default model. The CLI must not expose or synthesize models that the service did not return.

Claude-compatible model discovery uses the configured Anthropic-compatible `/v1/models` surface. Codex uses the OpenAI-compatible `/v1/models` and `/v1/responses` surfaces.

## OpenAI-compatible API

Public examples use:

- `GET /api/v1/models`
- `POST /api/v1/chat/completions`
- `POST /api/v1/responses`

The hosted service owns authentication, entitlement checks, rate limiting, billing, routing, abuse prevention, and provider translation. The public repository owns only client request construction and local configuration adapters.

## Compatibility rules

- All non-local production origins must use HTTPS.
- Tokens are sent only in the `Authorization: Bearer` header or target-tool configuration files protected with owner-only permissions where supported.
- Non-streaming chat-completion requests receive an idempotency key unless the caller supplies one.
- Errors from the hosted gateway should preserve its public message and status without printing credentials or request bodies.
