#!/usr/bin/env bash
set -euo pipefail

: "${FOURYI_API_KEY:?Set FOURYI_API_KEY before running this example}"
: "${FOURYI_MODEL:?Set FOURYI_MODEL to a model returned by /v1/models}"

curl --fail-with-body --no-progress-meter https://app.4yi.ai/api/v1/chat/completions \
  -H "Authorization: Bearer ${FOURYI_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: example-$(date +%s)" \
  -d "$(printf '{\"model\":\"%s\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with one short sentence about secure AI tooling.\"}]}' "${FOURYI_MODEL}")"
