import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ensureOpenCodeRuntime } from "../packages/cli/src/opencode.mjs";
import { pathsForHome } from "../packages/cli/src/config.mjs";

const OPENCODE_VERSION = "1.18.25";
const npmVersion = spawnSync("npm", ["--version"], { encoding: "utf8" });
assert.equal(npmVersion.status, 0, npmVersion.stderr || "Unable to read npm version");
assert.equal(npmVersion.stdout.trim().split(".")[0], "12", `Expected npm 12, received ${npmVersion.stdout.trim()}`);

const home = fs.mkdtempSync(path.join(os.tmpdir(), "fouryi-npm12-opencode-"));
try {
  const bin = ensureOpenCodeRuntime({ home });
  const version = spawnSync(bin, ["--version"], { encoding: "utf8" });
  assert.equal(version.status, 0, version.stderr || "OpenCode did not start");
  assert.equal(version.stdout.trim(), OPENCODE_VERSION);

  const paths = pathsForHome(home);
  const packageJson = JSON.parse(fs.readFileSync(paths.opencodePackageFile, "utf8"));
  assert.deepEqual(packageJson.allowScripts, { [`opencode-ai@${OPENCODE_VERSION}`]: true });

  const installedBinary = path.join(paths.opencodeDir, "node_modules", "opencode-ai", "bin", "opencode.exe");
  assert.ok(fs.statSync(installedBinary).size > 1_000_000, "OpenCode postinstall did not prepare the platform binary");
  console.log(`npm ${npmVersion.stdout.trim()} installed and launched OpenCode ${OPENCODE_VERSION}.`);
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}
