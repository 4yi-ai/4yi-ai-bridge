import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_BASE_URL,
  PACKAGE_NAME,
  pathsForHome,
  normalizeBaseUrl,
  readConfig,
  writeConfig,
  getPreferredModel,
  setPreferredModel,
} from "../src/config.mjs";

test("pathsForHome keeps all CLI state under ~/.4yi", () => {
  const home = path.join(os.tmpdir(), "fouryi-home");
  assert.deepEqual(pathsForHome(home), {
    homeDir: path.join(home, ".4yi"),
    backupsDir: path.join(home, ".4yi", "backups"),
    configFile: path.join(home, ".4yi", "config.json"),
    opencodeDir: path.join(home, ".4yi", "vendor", "opencode"),
    opencodePackageFile: path.join(home, ".4yi", "vendor", "opencode", "package.json"),
    opencodeConfigDir: path.join(home, ".4yi", "opencode"),
    opencodeConfigFile: path.join(home, ".4yi", "opencode", "opencode.json"),
  });
});

test("normalizeBaseUrl removes trailing slashes", () => {
  assert.equal(normalizeBaseUrl("https://app.4yi.ai/"), "https://app.4yi.ai");
  assert.equal(normalizeBaseUrl("http://localhost:3000///"), "http://localhost:3000");
});

test("default base URL points at the production 4YI app", () => {
  assert.equal(PACKAGE_NAME, "@4yi/cli");
  assert.equal(DEFAULT_BASE_URL, "https://app.4yi.ai");
  assert.equal(normalizeBaseUrl(), "https://app.4yi.ai");
});

test("preferred model round-trips and preserves the rest of the config", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-pref-"));
  try {
    assert.equal(getPreferredModel(home), null);
    // An existing session must survive a preferred-model write.
    writeConfig({ token: "xck-abc", org: { id: "org_1" } }, home);
    setPreferredModel("deepseek.v3.2", home);
    assert.equal(getPreferredModel(home), "deepseek.v3.2");
    assert.equal(readConfig(home).token, "xck-abc");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("a 0.1.10 config remains readable and intact after a 0.2 beta write", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-upgrade-"));
  const legacy = {
    baseUrl: "https://app.4yi.ai",
    token: "xck-existing-session",
    org: { id: "org_legacy", name: "Existing organization" },
    user: { email: "existing@example.com" },
    preferred_model: "claude.sonnet",
  };
  try {
    fs.mkdirSync(path.join(home, ".4yi"), { recursive: true });
    fs.writeFileSync(
      path.join(home, ".4yi", "config.json"),
      `${JSON.stringify(legacy, null, 2)}\n`,
      { mode: 0o600 },
    );

    assert.deepEqual(readConfig(home), legacy);
    setPreferredModel("gpt-5.6", home);
    assert.deepEqual(readConfig(home), { ...legacy, preferred_model: "gpt-5.6" });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
