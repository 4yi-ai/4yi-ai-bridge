import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const entrypoint = fileURLToPath(new URL("../bin/4yi.mjs", import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

function run(args, home) {
  return spawnSync(process.execPath, [entrypoint, ...args], {
    encoding: "utf8",
    env: { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: path.join(home, ".codex") },
  });
}

test("CLI help and version are available without a session", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-cli-help-"));
  try {
    const help = run(["--help"], home);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /connect <claude\|codex\|all>/);
    assert.match(help.stdout, /doctor \[--json\]/);
    const version = run(["--version"], home);
    assert.equal(version.status, 0);
    assert.equal(version.stdout.trim(), packageJson.version);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("connect dry-run exits successfully without creating CLI state", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-cli-dry-run-"));
  try {
    const result = run(["connect", "all", "--dry-run"], home);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /no files will be changed/i);
    assert.equal(fs.existsSync(path.join(home, ".4yi")), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("doctor json is parseable and redacts local secrets", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-cli-doctor-"));
  try {
    const result = run(["doctor", "--json"], home);
    assert.equal(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, true);
    assert.equal(Array.isArray(report.results), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
