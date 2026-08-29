import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { diagnose, runDoctor } from "../src/doctor.mjs";
import { writeConfig } from "../src/config.mjs";

test("doctor passes required checks and never prints the token", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-doctor-"));
  try {
    writeConfig({ baseUrl: "https://app.4yi.ai", token: "xck-super-secret" }, home);
    const lines = [];
    const report = runDoctor({
      home,
      platform: process.platform,
      nodeVersion: "20.19.0",
      spawn: (command) => ({ status: command === "claude" ? 0 : 1 }),
      stdout: (line) => lines.push(line),
    });
    assert.equal(report.ok, true);
    assert.match(lines.join("\n"), /Signed-in session is present/);
    assert.doesNotMatch(lines.join("\n"), /xck-super-secret/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("doctor fails an insecure non-local service URL", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-doctor-insecure-"));
  try {
    writeConfig({ baseUrl: "http://example.com" }, home);
    const report = diagnose({ home, platform: "linux", nodeVersion: "22.0.0", spawn: () => ({ status: 1 }) });
    assert.equal(report.ok, false);
    assert.equal(report.results.find((item) => item.id === "base-url").status, "fail");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("doctor supports machine-readable output", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-doctor-json-"));
  try {
    const lines = [];
    runDoctor({ home, json: true, nodeVersion: "20.0.0", spawn: () => ({ status: 1 }), stdout: (line) => lines.push(line) });
    const parsed = JSON.parse(lines[0]);
    assert.equal(Array.isArray(parsed.results), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("doctor reports malformed local configuration instead of crashing", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-doctor-malformed-"));
  try {
    const configDir = path.join(home, ".4yi");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, "config.json"), "{not-json", { mode: 0o600 });
    const report = diagnose({ home, platform: "linux", nodeVersion: "20.0.0", spawn: () => ({ status: 1 }) });
    assert.equal(report.ok, false);
    assert.equal(report.results.find((item) => item.id === "config-json").status, "fail");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
