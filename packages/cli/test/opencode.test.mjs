import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildOpenCodeConfig, ensureOpenCodeRuntime, opencodeEnv } from "../src/opencode.mjs";
import { pathsForHome } from "../src/config.mjs";

test("buildOpenCodeConfig writes 4yi provider and default model", () => {
  const config = buildOpenCodeConfig({
    tokenEnv: "FOURYI_CLI_TOKEN",
    orgEnv: "FOURYI_ORG_ID",
    modelConfig: {
      provider: "4yi",
      base_url: "https://app.4yi.ai/api/v1",
      default_model: "claude-sonnet-4-5",
      models: [{ id: "claude-sonnet-4-5", display_name: "Claude Sonnet 4.5", context_length: 200000 }],
    },
  });

  assert.equal(config.model, "4yi/claude-sonnet-4-5");
  assert.equal(config.provider["4yi"].name, "4YI");
  assert.equal(config.provider["4yi"].options.baseURL, "https://app.4yi.ai/api/v1");
  assert.equal(config.provider["4yi"].options.apiKey, "{env:FOURYI_CLI_TOKEN}");
  assert.equal(config.provider["4yi"].models["claude-sonnet-4-5"].name, "Claude Sonnet 4.5");
  assert.deepEqual(config.enabled_providers, ["4yi"]);
});

const MULTI_MODEL_CONFIG = {
  base_url: "https://app.4yi.ai/api/v1",
  default_model: "anthropic.claude-sonnet-4-6",
  models: [
    { id: "anthropic.claude-sonnet-4-6", family: "claude", display_name: "Claude Sonnet 4.6", context_length: 1000000 },
    { id: "anthropic.claude-opus-4-6-v1", family: "claude", display_name: "Claude Opus 4.6", context_length: 1000000 },
    { id: "gpt-5.6-luna", family: "codex", display_name: "GPT 5.6 Luna", context_length: 272000 },
    { id: "gpt-5.6-sol", family: "codex", display_name: "GPT 5.6 Sol", context_length: 272000 },
  ],
};

test("buildOpenCodeConfig registers the server-approved Claude and Codex models", () => {
  const config = buildOpenCodeConfig({ modelConfig: MULTI_MODEL_CONFIG });

  // All models registered (not just Claude) — the native switcher needs them.
  assert.deepEqual(Object.keys(config.provider["4yi"].models), [
    "anthropic.claude-sonnet-4-6",
    "anthropic.claude-opus-4-6-v1",
    "gpt-5.6-luna",
    "gpt-5.6-sol",
  ]);
  assert.equal(config.provider["4yi"].models["anthropic.claude-sonnet-4-6"].name, "Claude · Sonnet 4.6");
  assert.equal(config.provider["4yi"].models["gpt-5.6-luna"].name, "Codex · GPT 5.6 Luna");
  // Default still the server default (Claude).
  assert.equal(config.model, "4yi/anthropic.claude-sonnet-4-6");
});

test("buildOpenCodeConfig launches with a valid preferred model over the default", () => {
  const config = buildOpenCodeConfig({ modelConfig: MULTI_MODEL_CONFIG, preferredModel: "gpt-5.6-luna" });
  assert.equal(config.model, "4yi/gpt-5.6-luna");
});

test("buildOpenCodeConfig falls back to the default when the preferred model is not entitled", () => {
  const config = buildOpenCodeConfig({ modelConfig: MULTI_MODEL_CONFIG, preferredModel: "gpt-5.5" });
  assert.equal(config.model, "4yi/anthropic.claude-sonnet-4-6");
});

test("buildOpenCodeConfig falls back to the first Claude when no default is set", () => {
  const config = buildOpenCodeConfig({
    modelConfig: { ...MULTI_MODEL_CONFIG, default_model: null },
  });
  assert.equal(config.model, "4yi/anthropic.claude-sonnet-4-6");
});

test("buildOpenCodeConfig writes required output limits for Claude models", () => {
  const config = buildOpenCodeConfig({
    modelConfig: {
      base_url: "https://app.4yi.ai/api/v1",
      default_model: "anthropic.claude-sonnet-4-6",
      models: [
        { id: "anthropic.claude-sonnet-4-6", display_name: "Claude Sonnet 4.6", context_length: 1000000 },
      ],
    },
  });

  assert.deepEqual(config.provider["4yi"].models["anthropic.claude-sonnet-4-6"].limit, {
    context: 1000000,
    output: 8192,
  });
});

test("buildOpenCodeConfig preserves image attachment metadata for vision models", () => {
  const config = buildOpenCodeConfig({
    modelConfig: {
      base_url: "https://app.4yi.ai/api/v1",
      default_model: "anthropic.claude-sonnet-4-6",
      models: [
        {
          id: "anthropic.claude-sonnet-4-6",
          display_name: "Claude Sonnet 4.6",
          context_length: 1000000,
          attachment: true,
          modalities: { input: ["text", "image"], output: ["text"] },
        },
      ],
    },
  });

  assert.equal(config.provider["4yi"].models["anthropic.claude-sonnet-4-6"].attachment, true);
  assert.deepEqual(config.provider["4yi"].models["anthropic.claude-sonnet-4-6"].modalities, {
    input: ["text", "image"],
    output: ["text"],
  });
});

test("opencodeEnv isolates OpenCode state under the 4yi home", () => {
  const env = opencodeEnv({
    home: "/tmp/fouryi-home",
    token: "tok_cli",
    orgId: "org_1",
    configFile: "/tmp/fouryi-home/.4yi/opencode/opencode.json",
    baseEnv: { PATH: "/bin", XDG_CONFIG_HOME: "/tmp/user-config" },
  });

  assert.equal(env.FOURYI_CLI_TOKEN, "tok_cli");
  assert.equal(env.FOURYI_ORG_ID, "org_1");
  assert.equal(env.OPENCODE_CONFIG, "/tmp/fouryi-home/.4yi/opencode/opencode.json");
  assert.equal(env.XDG_CONFIG_HOME, "/tmp/fouryi-home/.4yi/opencode/xdg/config");
  assert.equal(env.XDG_DATA_HOME, "/tmp/fouryi-home/.4yi/opencode/xdg/data");
  assert.equal(env.XDG_CACHE_HOME, "/tmp/fouryi-home/.4yi/opencode/xdg/cache");
  assert.equal(env.XDG_STATE_HOME, "/tmp/fouryi-home/.4yi/opencode/xdg/state");
  assert.equal(env.PATH, "/bin");
});

test("ensureOpenCodeRuntime installs exact compatible versions", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-opencode-install-"));
  try {
    const paths = pathsForHome(home);
    const calls = [];
    const spawn = (command, args) => {
      calls.push([command, ...args]);
      const bin = path.join(paths.opencodeDir, "node_modules", ".bin", process.platform === "win32" ? "opencode.cmd" : "opencode");
      fs.mkdirSync(path.dirname(bin), { recursive: true });
      fs.writeFileSync(bin, "");
      return { status: 0 };
    };
    ensureOpenCodeRuntime({ home, spawn, stdout: () => {} });
    assert.deepEqual(calls[0], [
      "npm", "install", "--prefix", paths.opencodeDir, "--save-exact",
      "opencode-ai@1.18.25", "@ai-sdk/openai-compatible@3.0.39",
    ]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("ensureOpenCodeRuntime keeps an already compatible runtime", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-opencode-current-"));
  try {
    const paths = pathsForHome(home);
    fs.mkdirSync(path.dirname(paths.opencodePackageFile), { recursive: true });
    fs.writeFileSync(paths.opencodePackageFile, JSON.stringify({ dependencies: {
      "opencode-ai": "1.18.25",
      "@ai-sdk/openai-compatible": "3.0.39",
    } }));
    const bin = path.join(paths.opencodeDir, "node_modules", ".bin", process.platform === "win32" ? "opencode.cmd" : "opencode");
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    fs.writeFileSync(bin, "");
    let installed = false;
    assert.equal(ensureOpenCodeRuntime({ home, spawn: () => { installed = true; return { status: 0 }; }, stdout: () => {} }), bin);
    assert.equal(installed, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
