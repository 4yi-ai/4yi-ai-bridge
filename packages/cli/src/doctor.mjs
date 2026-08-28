import fs from "node:fs";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { DEFAULT_BASE_URL, pathsForHome, readConfig } from "./config.mjs";

function commandName(name, platform) {
  return platform === "win32" ? `${name}.cmd` : name;
}

function commandAvailable(name, { platform, spawn }) {
  const result = spawn(commandName(name, platform), ["--version"], {
    encoding: "utf8",
    shell: platform === "win32",
    stdio: "ignore",
  });
  return !result.error && result.status === 0;
}

function check(id, status, message, required = false) {
  return { id, status, message, required };
}

export function diagnose({
  home = os.homedir(),
  platform = process.platform,
  nodeVersion = process.versions.node,
  spawn = spawnSync,
} = {}) {
  const results = [];
  const major = Number.parseInt(String(nodeVersion).split(".")[0], 10);
  results.push(check("node", major >= 20 ? "pass" : "fail", `Node.js ${nodeVersion}`, true));

  const paths = pathsForHome(home);
  let config = {};
  try {
    config = readConfig(home);
    results.push(check("config-json", "pass", fs.existsSync(paths.configFile) ? "Local configuration is valid JSON" : "No local configuration yet"));
  } catch {
    results.push(check("config-json", "fail", "Local configuration is not valid JSON", true));
  }
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  let safeBaseUrl = false;
  try {
    const parsed = new URL(baseUrl);
    safeBaseUrl = parsed.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  } catch { /* Report a failed URL check below. */ }
  results.push(check("base-url", safeBaseUrl ? "pass" : "fail", safeBaseUrl ? `Service URL: ${baseUrl}` : "Service URL is invalid or insecure", true));

  if (fs.existsSync(paths.configFile)) {
    if (platform === "win32") {
      results.push(check("config-permissions", "warn", "Local session file exists; Windows ACLs were not inspected"));
    } else {
      const mode = fs.statSync(paths.configFile).mode & 0o777;
      const permissionStatus = (mode & 0o077) === 0 ? "pass" : "fail";
      const permissionMessage = permissionStatus === "pass"
        ? "Local session file is owner-only"
        : `Local session file permissions are too broad (${mode.toString(8)})`;
      results.push(check("config-permissions", permissionStatus, permissionMessage, true));
    }
  } else {
    results.push(check("config-permissions", "warn", "No local session file yet; run `4yi login`"));
  }

  results.push(check("session", config.token ? "pass" : "warn", config.token ? "Signed-in session is present" : "Not signed in"));
  results.push(check("claude", commandAvailable("claude", { platform, spawn }) ? "pass" : "warn", "Claude Code CLI"));
  results.push(check("codex", commandAvailable("codex", { platform, spawn }) ? "pass" : "warn", "Codex CLI"));

  return {
    ok: results.every((result) => !result.required || result.status === "pass"),
    results,
  };
}

export function runDoctor({ stdout = console.log, json = false, ...options } = {}) {
  const report = diagnose(options);
  if (json) {
    stdout(JSON.stringify(report, null, 2));
    return report;
  }
  stdout("4YI CLI doctor");
  for (const result of report.results) {
    const marker = result.status === "pass" ? "PASS" : result.status === "warn" ? "WARN" : "FAIL";
    stdout(`${marker.padEnd(4)} ${result.message}`);
  }
  return report;
}
