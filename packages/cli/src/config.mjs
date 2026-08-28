import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PACKAGE_NAME = "@4yi/cli";
export const DEFAULT_BASE_URL = "https://app.4yi.ai";

export function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export function pathsForHome(home = os.homedir()) {
  const homeDir = path.join(home, ".4yi");
  const backupsDir = path.join(homeDir, "backups");
  const opencodeDir = path.join(homeDir, "vendor", "opencode");
  const opencodeConfigDir = path.join(homeDir, "opencode");
  return {
    homeDir,
    backupsDir,
    configFile: path.join(homeDir, "config.json"),
    opencodeDir,
    opencodePackageFile: path.join(opencodeDir, "package.json"),
    opencodeConfigDir,
    opencodeConfigFile: path.join(opencodeConfigDir, "opencode.json"),
  };
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

export function readConfig(home = os.homedir()) {
  const { configFile } = pathsForHome(home);
  if (!fs.existsSync(configFile)) return {};
  return JSON.parse(fs.readFileSync(configFile, "utf8"));
}

export function writeConfig(config, home = os.homedir()) {
  const paths = pathsForHome(home);
  ensureDir(paths.homeDir);
  try { fs.chmodSync(paths.homeDir, 0o700); } catch { /* Windows may ignore POSIX modes. */ }
  const temporary = path.join(paths.homeDir, `.config.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, paths.configFile);
  try { fs.chmodSync(paths.configFile, 0o600); } catch { /* Windows may ignore POSIX modes. */ }
}

/** The user's pinned default model id for `4yi code`, or null if unset. */
export function getPreferredModel(home = os.homedir()) {
  return readConfig(home).preferred_model || null;
}

/** Persist the pinned default model id, preserving the rest of the config (e.g. session). */
export function setPreferredModel(model, home = os.homedir()) {
  writeConfig({ ...readConfig(home), preferred_model: model }, home);
}
