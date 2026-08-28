import test from "node:test";
import assert from "node:assert/strict";
import { requestJson } from "../src/http.mjs";

test("requestJson reports non-JSON responses without a JSON parse error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<!DOCTYPE html><html></html>", {
    status: 404,
    headers: { "content-type": "text/html" },
  });
  try {
    await assert.rejects(
      requestJson("https://app.4yi.ai", "/api/cli/auth/start", { method: "POST" }),
      /Expected JSON from https:\/\/app\.4yi\.ai\/api\/cli\/auth\/start but received text\/html \(HTTP 404\)/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requestJson generates an idempotency key for non-streaming chat completion requests", async () => {
  const originalFetch = globalThis.fetch;
  let capturedInit;
  globalThis.fetch = async (_url, init) => {
    capturedInit = init;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await requestJson("https://app.4yi.ai", "/api/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model: "kimi", messages: [{ role: "user", content: "hi" }] }),
    });

    assert.match(capturedInit.headers["Idempotency-Key"], /^cli-[0-9a-f-]{36}$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requestJson preserves a caller supplied idempotency key", async () => {
  const originalFetch = globalThis.fetch;
  let capturedInit;
  globalThis.fetch = async (_url, init) => {
    capturedInit = init;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await requestJson("https://app.4yi.ai", "/api/v1/chat/completions", {
      method: "POST",
      headers: { "Idempotency-Key": "manual-key" },
      body: JSON.stringify({ model: "kimi", messages: [{ role: "user", content: "hi" }] }),
    });

    assert.equal(capturedInit.headers["Idempotency-Key"], "manual-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requestJson applies a timeout signal without leaking custom options to fetch", async () => {
  const originalFetch = globalThis.fetch;
  let capturedInit;
  globalThis.fetch = async (_url, init) => {
    capturedInit = init;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await requestJson("https://app.4yi.ai", "/api/cli/session", { token: "secret", timeoutMs: 1000 });
    assert.equal(capturedInit.token, undefined);
    assert.equal(capturedInit.timeoutMs, undefined);
    assert.equal(capturedInit.signal instanceof AbortSignal, true);
    assert.equal(capturedInit.headers.authorization, "Bearer secret");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
