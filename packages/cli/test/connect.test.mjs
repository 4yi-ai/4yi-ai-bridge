import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathsForHome } from "../src/config.mjs";
import {
  __testing,
  connect,
  connectionPaths,
  connectionPlan,
  connectionStatus,
  normalizeTarget,
  restoreConnection,
} from "../src/connect.mjs";

function tempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-connect-"));
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("normalizeTarget accepts supported tools and rejects unknown tools", () => {
  assert.equal(normalizeTarget("CLAUDE"), "claude");
  assert.equal(normalizeTarget(), "all");
  assert.throws(() => normalizeTarget("cursor"), /Unknown target/);
});

test("connectionPaths keeps temporary Codex state isolated", () => {
  const paths = connectionPaths({ home: "/tmp/home", cwd: "/tmp/project", codexHome: "/tmp/codex-home" });
  assert.equal(paths.claudeUser, path.join("/tmp/home", ".claude", "settings.json"));
  assert.equal(paths.claudeProject, path.join("/tmp/project", ".claude", "settings.local.json"));
  assert.equal(paths.codexConfig, path.join("/tmp/codex-home", "config.toml"));
});

test("connectionPlan reports every file without changing it", () => {
  const home = tempHome();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-plan-project-"));
  try {
    const paths = connectionPaths({ home, cwd });
    fs.mkdirSync(path.dirname(paths.claudeUser), { recursive: true });
    fs.writeFileSync(paths.claudeUser, '{"theme":"dark"}\n');
    const before = fs.readFileSync(paths.claudeUser, "utf8");
    const plan = connectionPlan({ target: "all", home, cwd, scope: "both" });
    assert.deepEqual(plan.map((item) => item.target), ["claude", "claude", "codex", "codex"]);
    assert.equal(plan[0].exists, true);
    assert.equal(plan[1].exists, false);
    assert.equal(fs.readFileSync(paths.claudeUser, "utf8"), before);
    assert.equal(fs.existsSync(pathsForHome(home).backupsDir), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("Claude connect protects and restores both user and project settings", async () => {
  const home = tempHome();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-project-"));
  const paths = connectionPaths({ home, cwd });
  fs.mkdirSync(path.dirname(paths.claudeUser), { recursive: true });
  fs.mkdirSync(path.dirname(paths.claudeProject), { recursive: true });
  fs.writeFileSync(paths.claudeUser, '{"theme":"dark"}\n');
  fs.writeFileSync(paths.claudeProject, '{"permissions":{"allow":[]}}\n');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ data: [
    { id: "claude-opus-5" },
    { id: "claude-sonnet-5" },
    { id: "claude-haiku-4-5-20251001" },
  ] });
  try {
    await connect({
      target: "claude",
      session: { baseUrl: "https://app.4yi.ai", token: "xck-testing" },
      home,
      cwd,
      scope: "both",
      stdout: () => {},
      tooling: {
        spawn: () => ({ status: 0, stdout: "Claude Code 1.0.0" }),
        platform: "linux",
      },
    });
    const user = JSON.parse(fs.readFileSync(paths.claudeUser, "utf8"));
    const project = JSON.parse(fs.readFileSync(paths.claudeProject, "utf8"));
    assert.equal(user.theme, "dark");
    assert.equal(project.permissions.allow.length, 0);
    assert.equal(user.env.ANTHROPIC_MODEL, "claude-sonnet-5");
    assert.deepEqual(user.availableModels, ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"]);

    // `all` restores whichever protected targets exist; connecting only Claude
    // must not fail because no Codex backup has been created yet.
    restoreConnection({ target: "all", home, stdout: () => {} });
    assert.deepEqual(JSON.parse(fs.readFileSync(paths.claudeUser, "utf8")), { theme: "dark" });
    assert.deepEqual(JSON.parse(fs.readFileSync(paths.claudeProject, "utf8")), { permissions: { allow: [] } });
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("connection status masks the stored Claude credential", () => {
  const home = tempHome();
  const paths = connectionPaths({ home });
  fs.mkdirSync(path.dirname(paths.claudeUser), { recursive: true });
  fs.writeFileSync(paths.claudeUser, JSON.stringify({ env: {
    ANTHROPIC_BASE_URL: "https://app.4yi.ai/api/anthropic",
    ANTHROPIC_AUTH_TOKEN: "xck-this-is-a-secret-token",
    ANTHROPIC_MODEL: "claude-sonnet-5",
  } }));
  const lines = [];
  connectionStatus({ target: "claude", home, stdout: (line) => lines.push(line) });
  assert.match(lines[0], /xck-th\.\.\.oken/);
  assert.doesNotMatch(lines[0], /xck-this-is-a-secret-token/);
});

test("Codex helpers build a plan catalog and remove conflicting root assignments", () => {
  const catalog = __testing.buildCodexCatalog(
    [{ id: "gpt-5.6-luna", display_name: "GPT 5.6 Luna" }],
    { slug: "gpt-5.5", display_name: "GPT 5.5", supported_in_api: true },
  );
  assert.equal(catalog.models[0].slug, "gpt-5.6-luna");
  assert.equal(catalog.models[0].display_name, "GPT 5.6 Luna");
  assert.equal(catalog.models[0].use_responses_lite, false);

  const cleaned = __testing.removeCodexRootAssignments(
    'model = "old"\nmodel_provider = "old"\napproval_policy = "never"\n\n[features]\nfoo = true\n',
  );
  assert.doesNotMatch(cleaned, /^model\s*=/m);
  assert.doesNotMatch(cleaned, /^model_provider\s*=/m);
  assert.match(cleaned, /approval_policy = "never"/);
  assert.match(cleaned, /\[features\]/);
});

test("Codex preflight uses the native Codex request evidence required by Responses ingress", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response('data: {"type":"response.created"}\n\n', {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  };

  try {
    await __testing.checkCodex(
      { token: "xck-testing" },
      "https://app.4yi.ai/api/v1/",
      "gpt-5.6-luna",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(captured.url, "https://app.4yi.ai/api/v1/responses");
  assert.equal(captured.options.headers.originator, "codex_cli_rs");
  assert.equal(captured.options.headers.authorization, "Bearer xck-testing");
  const body = JSON.parse(captured.options.body);
  assert.equal(body.model, "gpt-5.6-luna");
  assert.equal(body.store, false);
  assert.equal(body.stream, true);
  assert.deepEqual(body.client_metadata, {
    session_id: "4yi-cli-preflight",
    thread_id: "4yi-cli-preflight",
  });
});

test("Codex preflight preserves the gateway error when native streaming is rejected", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { message: "Responses request is not allowed", code: "responses_feature_not_allowed" },
  }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });

  try {
    await assert.rejects(
      __testing.checkCodex({ token: "xck-testing" }, "https://app.4yi.ai/api/v1", "gpt-5.6-luna"),
      (error) => error.status === 400 && error.message === "Responses request is not allowed",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing CLI is installed only after the user confirms", async () => {
  const calls = [];
  let installed = false;
  const spawn = (command, args) => {
    calls.push([command, ...args]);
    if (command === "claude") return { status: installed ? 0 : 127 };
    if (command === "npm" && args[0] === "--version") return { status: 0 };
    if (command === "npm" && args[0] === "install") {
      installed = true;
      return { status: 0 };
    }
    return { status: 127 };
  };
  const lines = [];

  const result = await __testing.ensureToolCli("claude", {
    platform: "linux",
    spawn,
    confirmInstall: async () => true,
    stdout: (line) => lines.push(line),
  });

  assert.equal(result.installed, true);
  assert.deepEqual(calls.find((call) => call[1] === "install"), ["npm", "install", "-g", "@anthropic-ai/claude-code@2.1.250"]);
  assert.match(lines.join("\n"), /Claude Code CLI installed/);
});

test("missing CLI remains untouched when the user declines installation", async () => {
  const calls = [];
  await assert.rejects(
    __testing.ensureToolCli("codex", {
      platform: "linux",
      spawn: (command, args) => {
        calls.push([command, ...args]);
        return { status: 127 };
      },
      confirmInstall: async () => false,
      stdout: () => {},
    }),
    /npm install -g @openai\/codex@0\.150\.1/,
  );
  assert.equal(calls.some((call) => call[0] === "npm"), false);
});

test("auto-install mode skips the prompt and uses the Windows npm launcher", async () => {
  let installed = false;
  let prompted = false;
  const calls = [];
  const spawn = (command, args) => {
    calls.push([command, ...args]);
    if (command === "codex.cmd") return { status: installed ? 0 : 1 };
    if (command === "npm.cmd" && args[0] === "--version") return { status: 0 };
    if (command === "npm.cmd" && args[0] === "install") {
      installed = true;
      return { status: 0 };
    }
    return { status: 1 };
  };

  await __testing.ensureToolCli("codex", {
    autoInstall: true,
    platform: "win32",
    spawn,
    confirmInstall: async () => {
      prompted = true;
      return false;
    },
    stdout: () => {},
  });

  assert.equal(prompted, false);
  assert.deepEqual(calls.find((call) => call[1] === "install"), ["npm.cmd", "install", "-g", "@openai/codex@0.150.1"]);
});

test("desktop apps are detected and reported without being installed", () => {
  const lines = [];
  const detected = __testing.reportDesktopApp("claude", {
    home: "/Users/tester",
    platform: "darwin",
    exists: (candidate) => candidate === "/Applications/Claude.app",
    stdout: (line) => lines.push(line),
  });
  assert.equal(detected, true);
  assert.match(lines[0], /Claude App detected/);

  lines.length = 0;
  const missing = __testing.reportDesktopApp("codex", {
    home: "/Users/tester",
    platform: "darwin",
    exists: () => false,
    stdout: (line) => lines.push(line),
  });
  assert.equal(missing, false);
  assert.match(lines[0], /does not install desktop apps automatically/);
});
