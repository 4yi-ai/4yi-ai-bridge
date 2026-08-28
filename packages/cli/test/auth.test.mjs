import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { saveSession, loadSession, clearSession, login } from "../src/auth.mjs";

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("saveSession and loadSession persist CLI token", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-auth-"));
  saveSession({ baseUrl: "http://localhost:3000", token: "xck-cli", org: { id: "org_1", name: "Demo" } }, home);
  assert.deepEqual(loadSession(home), {
    baseUrl: "http://localhost:3000",
    token: "xck-cli",
    org: { id: "org_1", name: "Demo" },
  });
});

test("clearSession removes token while preserving baseUrl", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-auth-"));
  saveSession({ baseUrl: "http://localhost:3000", token: "xck-cli", org: { id: "org_1", name: "Demo" }, preferred_model: "model-1" }, home);
  clearSession(home);
  assert.deepEqual(loadSession(home), { baseUrl: "http://localhost:3000", preferred_model: "model-1" });
});

test("login completes browser device authorization without printing the token", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-auth-login-"));
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith("/api/cli/auth/start")) return jsonResponse({
      verification_uri_complete: "https://app.4yi.ai/cli/verify?code=public-code",
      device_code: "device-code",
      expires_in: 60,
      interval: 0,
    });
    if (url.endsWith("/api/cli/auth/poll")) return jsonResponse({ status: "approved", token: "xck-login-secret" });
    if (url.endsWith("/api/cli/session")) return jsonResponse({
      org: { id: "org_1", name: "Demo" },
      user: { email: "developer@example.com" },
    });
    throw new Error(`Unexpected URL: ${url}`);
  };
  const opened = [];
  const lines = [];
  try {
    await login({ home, open: (url) => opened.push(url), stdout: (line) => lines.push(line) });
    assert.deepEqual(opened, ["https://app.4yi.ai/cli/verify?code=public-code"]);
    assert.equal(loadSession(home).token, "xck-login-secret");
    assert.equal(requests.find((request) => request.url.endsWith("/api/cli/session")).options.headers.authorization, "Bearer xck-login-secret");
    assert.doesNotMatch(lines.join("\n"), /xck-login-secret/);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(home, { recursive: true, force: true });
  }
});
