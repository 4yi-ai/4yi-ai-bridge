import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { ensureDir, pathsForHome } from "./config.mjs";
import { requestJson } from "./http.mjs";

const TARGETS = new Set(["claude", "codex", "all"]);
const CLAUDE_MANAGED_ENV_KEYS = [
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY",
];
const CODEX_ROOT_START = "# >>> 4yi-cli codex-root";
const CODEX_ROOT_END = "# <<< 4yi-cli codex-root";
const CODEX_PROVIDER_START = "# >>> 4yi-cli codex-provider";
const CODEX_PROVIDER_END = "# <<< 4yi-cli codex-provider";
const TOOL_METADATA = {
  claude: {
    label: "Claude Code",
    command: "claude",
    npmPackage: "@anthropic-ai/claude-code@2.1.250",
    appLabel: "Claude App",
  },
  codex: {
    label: "Codex",
    command: "codex",
    npmPackage: "@openai/codex@0.150.1",
    appLabel: "Codex App",
  },
};

export function normalizeTarget(target = "all") {
  const value = String(target || "all").toLowerCase();
  if (!TARGETS.has(value)) throw new Error(`Unknown target: ${target}. Use claude, codex, or all.`);
  return value;
}

export async function prepareConnectionTools({ target = "all", autoInstall = false, stdout = console.log, tooling = {} } = {}) {
  const normalized = normalizeTarget(target);
  if (normalized === "claude" || normalized === "all") {
    await ensureToolCli("claude", { ...tooling, autoInstall, stdout });
  }
  if (normalized === "codex" || normalized === "all") {
    await ensureToolCli("codex", { ...tooling, autoInstall, stdout });
  }
}

export function connectionPaths({ home = os.homedir(), cwd = process.cwd(), codexHome = process.env.CODEX_HOME } = {}) {
  const codexDir = codexHome || path.join(home, ".codex");
  return {
    claudeUser: path.join(home, ".claude", "settings.json"),
    claudeProject: path.join(cwd, ".claude", "settings.local.json"),
    codexConfig: path.join(codexDir, "config.toml"),
    codexCatalog: path.join(codexDir, "model-catalogs", "4yi.json"),
  };
}

export function connectionPlan({ target = "all", home = os.homedir(), cwd = process.cwd(), codexHome = process.env.CODEX_HOME, scope = "user" } = {}) {
  const normalized = normalizeTarget(target);
  if (!new Set(["user", "project", "both"]).has(scope)) {
    throw new Error(`Unknown scope: ${scope}. Use user, project, or both.`);
  }
  const paths = connectionPaths({ home, cwd, codexHome });
  const plan = [];
  if (normalized === "claude" || normalized === "all") {
    const files = scope === "project"
      ? [paths.claudeProject]
      : scope === "both"
        ? [paths.claudeUser, paths.claudeProject]
        : [paths.claudeUser];
    for (const file of files) plan.push({ target: "claude", file, exists: fs.existsSync(file), action: "backup-and-update" });
  }
  if (normalized === "codex" || normalized === "all") {
    plan.push({ target: "codex", file: paths.codexConfig, exists: fs.existsSync(paths.codexConfig), action: "backup-and-update" });
    plan.push({ target: "codex", file: paths.codexCatalog, exists: fs.existsSync(paths.codexCatalog), action: "generate" });
  }
  return plan;
}

function atomicWrite(file, value) {
  ensureDir(path.dirname(file));
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, value, { mode: 0o600 });
  fs.renameSync(temp, file);
  try { fs.chmodSync(file, 0o600); } catch { /* Windows may ignore POSIX modes. */ }
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "");
}

function executableName(command, platform = process.platform) {
  return platform === "win32" ? `${command}.cmd` : command;
}

function commandAvailable(command, { platform = process.platform, spawn = spawnSync } = {}) {
  const result = spawn(executableName(command, platform), ["--version"], {
    encoding: "utf8",
    shell: platform === "win32",
    stdio: "ignore",
  });
  return !result.error && result.status === 0;
}

async function promptToInstall(meta, { input = process.stdin, output = process.stdout } = {}) {
  if (!input?.isTTY || !output?.isTTY) return false;
  const readline = createInterface({ input, output });
  try {
    const answer = await readline.question(`${meta.label} CLI is not installed. Install ${meta.npmPackage} globally with npm? [Y/n] `);
    return !["n", "no"].includes(answer.trim().toLowerCase());
  } finally {
    readline.close();
  }
}

async function ensureToolCli(target, {
  autoInstall = false,
  confirmInstall = promptToInstall,
  input = process.stdin,
  output = process.stdout,
  platform = process.platform,
  spawn = spawnSync,
  stdout = console.log,
} = {}) {
  const meta = TOOL_METADATA[target];
  if (commandAvailable(meta.command, { platform, spawn })) return { installed: false };

  const approved = autoInstall || await confirmInstall(meta, { input, output });
  if (!approved) {
    throw new Error(`${meta.label} CLI is required. Install it with \`npm install -g ${meta.npmPackage}\`, then run this command again.`);
  }
  if (!commandAvailable("npm", { platform, spawn })) {
    throw new Error(`npm is required to install ${meta.label} CLI automatically. Install Node.js/npm, then run this command again.`);
  }

  stdout(`Installing ${meta.label} CLI (${meta.npmPackage})...`);
  const result = spawn(executableName("npm", platform), ["install", "-g", meta.npmPackage], {
    shell: platform === "win32",
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Could not install ${meta.label} CLI automatically. Run \`npm install -g ${meta.npmPackage}\` and try again.`);
  }
  if (!commandAvailable(meta.command, { platform, spawn })) {
    throw new Error(`${meta.label} CLI was installed, but \`${meta.command}\` is not available in this terminal. Open a new terminal and run this command again.`);
  }
  stdout(`${meta.label} CLI installed.`);
  return { installed: true };
}

function desktopAppCandidates(target, { home = os.homedir(), platform = process.platform, env = process.env } = {}) {
  const appName = target === "claude" ? "Claude" : "Codex";
  if (platform === "darwin") {
    return [
      path.join("/Applications", `${appName}.app`),
      path.join(home, "Applications", `${appName}.app`),
    ];
  }
  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    return [
      path.join(localAppData, "Programs", appName, `${appName}.exe`),
      path.join(localAppData, appName, `${appName}.exe`),
    ];
  }
  return [];
}

function reportDesktopApp(target, {
  home = os.homedir(),
  platform = process.platform,
  env = process.env,
  exists = fs.existsSync,
  stdout = console.log,
} = {}) {
  const meta = TOOL_METADATA[target];
  const candidates = desktopAppCandidates(target, { home, platform, env });
  const detected = candidates.some((candidate) => exists(candidate));
  if (detected) {
    stdout(`${meta.appLabel} detected. Quit and reopen it to use the new connection.`);
  } else if (candidates.length > 0) {
    stdout(`${meta.appLabel} was not detected in a standard install location. 4YI does not install desktop apps automatically.`);
  } else {
    stdout(`${meta.appLabel} detection is not available on this platform. 4YI does not install desktop apps automatically.`);
  }
  return detected;
}

function backupFile(target, file, home, groupId = timestamp()) {
  const dir = path.join(pathsForHome(home).backupsDir, target);
  ensureDir(dir);
  const record = {
    version: 1,
    target,
    group_id: groupId,
    source: file,
    existed: fs.existsSync(file),
    content: fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null,
    created_at: new Date().toISOString(),
  };
  const backup = path.join(dir, `${groupId}-${Math.random().toString(16).slice(2, 10)}.json`);
  atomicWrite(backup, `${JSON.stringify(record, null, 2)}\n`);
  return backup;
}

function latestBackups(target, home) {
  const dir = path.join(pathsForHome(home).backupsDir, target);
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir)
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .reverse();
  if (!entries[0]) return [];
  const latest = path.join(dir, entries[0]);
  const latestRecord = JSON.parse(fs.readFileSync(latest, "utf8"));
  const groupId = latestRecord.group_id;
  if (!groupId) return [latest];
  return entries
    .map((entry) => path.join(dir, entry))
    .filter((file) => JSON.parse(fs.readFileSync(file, "utf8")).group_id === groupId);
}

function mask(value) {
  const text = String(value || "");
  if (!text) return "";
  return text.length > 12 ? `${text.slice(0, 6)}...${text.slice(-4)}` : `${text.slice(0, 2)}...${text.slice(-2)}`;
}

function chooseModel(models, preferred, keyword) {
  if (preferred && models.includes(preferred)) return preferred;
  const match = models.find((model) => model.toLowerCase().includes(keyword));
  return match || models[0];
}

async function loadClaudeModels(session, claudeBaseUrl) {
  const base = claudeBaseUrl.replace(/\/+$/, "");
  const response = await requestJson(base, "/v1/models", { token: session.token });
  const models = [...new Set((response?.data || []).map((row) => row?.id).filter(Boolean))];
  if (models.length === 0) throw new Error("Your active Plan has no Claude models available for Coding Tools.");
  return models;
}

async function connectClaude({ session, home, cwd, scope, claudeBaseUrl, stdout }) {
  const paths = connectionPaths({ home, cwd });
  const files = scope === "project" ? [paths.claudeProject] : scope === "both" ? [paths.claudeUser, paths.claudeProject] : [paths.claudeUser];
  const models = await loadClaudeModels(session, claudeBaseUrl);
  const defaultModel = chooseModel(models, "claude-sonnet-4-6", "sonnet");
  const opusModel = chooseModel(models, "", "opus");
  const sonnetModel = chooseModel(models, defaultModel, "sonnet");
  const haikuModel = chooseModel(models, "claude-haiku-4-5-20251001", "haiku");

  const backupGroup = timestamp();
  for (const file of files) {
    const backup = backupFile("claude", file, home, backupGroup);
    let data = {};
    if (fs.existsSync(file) && fs.statSync(file).size > 0) {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!data || Array.isArray(data) || typeof data !== "object") throw new Error(`${file} must contain a JSON object.`);
    }
    const env = data.env && !Array.isArray(data.env) && typeof data.env === "object" ? data.env : {};
    Object.assign(env, {
      ANTHROPIC_BASE_URL: claudeBaseUrl.replace(/\/+$/, ""),
      ANTHROPIC_AUTH_TOKEN: session.token,
      ANTHROPIC_MODEL: defaultModel,
      ANTHROPIC_DEFAULT_OPUS_MODEL: opusModel,
      ANTHROPIC_DEFAULT_SONNET_MODEL: sonnetModel,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: haikuModel,
      CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
    });
    delete env.ANTHROPIC_SMALL_FAST_MODEL;
    data.env = env;
    data.model = defaultModel;
    data.availableModels = models;
    atomicWrite(file, `${JSON.stringify(data, null, 2)}\n`);
    stdout(`Connected Claude Code: ${file}`);
    stdout(`Backup: ${backup}`);
  }
  stdout(`Available Claude models: ${models.join(", ")}`);
}

function removeManagedBlock(text, start, end) {
  const pattern = new RegExp(`^${escapeRegExp(start)}\\n[\\s\\S]*?^${escapeRegExp(end)}\\n?`, "gm");
  return text.replace(pattern, "");
}

function removeCodexRootAssignments(text) {
  const firstTable = text.search(/^\s*\[/m);
  const root = firstTable === -1 ? text : text.slice(0, firstTable);
  const tables = firstTable === -1 ? "" : text.slice(firstTable);
  const cleanedRoot = root
    .split("\n")
    .filter((line) => !/^\s*(model|model_provider|model_catalog_json)\s*=/.test(line))
    .join("\n")
    .trim();
  return `${cleanedRoot}${cleanedRoot && tables ? "\n\n" : ""}${tables}`.trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBundledCatalog({ platform = process.platform, spawn = spawnSync } = {}) {
  const command = executableName("codex", platform);
  const result = spawn(command, ["debug", "models", "--bundled"], { encoding: "utf8", shell: platform === "win32" });
  if (result.status !== 0 || !result.stdout) throw new Error("Codex CLI is required to build its 4YI model catalog. Install Codex, then run this command again.");
  const catalog = JSON.parse(result.stdout);
  const template = catalog.models?.find((model) => model.slug === "gpt-5.5") || catalog.models?.[0];
  if (!template) throw new Error("Codex bundled model catalog is empty.");
  return template;
}

async function loadCodexModels(session) {
  const response = await requestJson(session.baseUrl, "/api/cli/models?runtime=codex", { token: session.token });
  const models = (response?.models || []).filter((row) => row?.id);
  if (models.length === 0) throw new Error("Your active Plan has no Codex-compatible Responses models.");
  const ids = models.map((model) => model.id);
  const defaultModel = ids.includes(response.default_model) ? response.default_model : ids[0];
  return { models, defaultModel };
}

function buildCodexCatalog(models, template) {
  return {
    models: models.map((planModel) => ({
      ...structuredClone(template),
      slug: planModel.id,
      display_name: planModel.display_name || planModel.id,
      description: `${planModel.display_name || planModel.id} via 4YI Gateway with OpenAI Responses tool support.`,
      supported_in_api: true,
      use_responses_lite: false,
      tool_mode: undefined,
    })).map((model) => {
      delete model.tool_mode;
      return model;
    }),
  };
}

async function checkCodex(session, codexBaseUrl, model) {
  const response = await fetch(`${codexBaseUrl.replace(/\/+$/, "")}/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.token}`,
      // The Responses ingress only accepts the native Codex request shape.
      // Keep this synthetic compatibility check aligned with the real client
      // so it exercises the same authorization and routing path.
      originator: "codex_cli_rs",
    },
    body: JSON.stringify({
      model,
      instructions: "Reply with pong.",
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "ping" }] }],
      tools: [],
      tool_choice: "auto",
      parallel_tool_calls: true,
      store: false,
      // Safe Responses ingress deliberately requires streaming requests. A
      // JSON/non-streaming probe is rejected before routing, even though the
      // same credential and model work in Codex itself.
      stream: true,
      include: [],
      client_metadata: {
        session_id: "4yi-cli-preflight",
        thread_id: "4yi-cli-preflight",
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    const message = body?.error?.message || body?.error || text || `HTTP ${response.status}`;
    const error = new Error(typeof message === "string" ? message : JSON.stringify(message));
    error.status = response.status;
    error.body = body;
    throw error;
  }

  // A successful native probe is an SSE stream. Compatibility is established
  // once the response starts; do not consume a model response just for setup.
  if (response.body) await response.body.cancel();
}

async function connectCodex({ session, home, codexHome, codexBaseUrl, stdout, skipCheck = false, tooling = {} }) {
  const paths = connectionPaths({ home, codexHome });
  const { models, defaultModel } = await loadCodexModels(session);
  if (!skipCheck) await checkCodex(session, codexBaseUrl, defaultModel);
  ensureDir(path.dirname(paths.codexConfig));
  const template = parseBundledCatalog(tooling);
  const catalog = buildCodexCatalog(models, template);
  const backupGroup = timestamp();
  const configBackup = backupFile("codex", paths.codexConfig, home, backupGroup);
  const catalogBackup = backupFile("codex", paths.codexCatalog, home, backupGroup);
  atomicWrite(paths.codexCatalog, `${JSON.stringify(catalog, null, 2)}\n`);

  let existing = fs.existsSync(paths.codexConfig) ? fs.readFileSync(paths.codexConfig, "utf8") : "";
  existing = removeManagedBlock(existing, CODEX_ROOT_START, CODEX_ROOT_END);
  existing = removeManagedBlock(existing, CODEX_PROVIDER_START, CODEX_PROVIDER_END);
  existing = removeCodexRootAssignments(existing);
  const root = `${CODEX_ROOT_START}\nmodel = ${JSON.stringify(defaultModel)}\nmodel_provider = "4yi"\nmodel_catalog_json = ${JSON.stringify(paths.codexCatalog)}\n${CODEX_ROOT_END}`;
  const provider = `${CODEX_PROVIDER_START}\n[model_providers."4yi"]\nname = "4YI Gateway"\nbase_url = ${JSON.stringify(codexBaseUrl.replace(/\/+$/, ""))}\nwire_api = "responses"\nexperimental_bearer_token = ${JSON.stringify(session.token)}\n${CODEX_PROVIDER_END}`;
  atomicWrite(paths.codexConfig, `${root}\n\n${existing ? `${existing}\n\n` : ""}${provider}\n`);
  stdout(`Connected Codex: ${paths.codexConfig}`);
  stdout(`Available Codex models: ${models.map((model) => model.id).join(", ")}`);
  stdout(`Backups: ${configBackup}, ${catalogBackup}`);
}

function resolveUrls(session, options) {
  const platformUrl = String(options.platformUrl || session.baseUrl).replace(/\/+$/, "");
  return {
    claudeBaseUrl: String(options.claudeBaseUrl || `${platformUrl}/api/anthropic`).replace(/\/+$/, ""),
    codexBaseUrl: String(options.codexBaseUrl || `${platformUrl}/api/v1`).replace(/\/+$/, ""),
  };
}

export async function connect({ target = "all", session, home = os.homedir(), cwd = process.cwd(), codexHome = process.env.CODEX_HOME, scope = "user", stdout = console.log, ...options } = {}) {
  const normalized = normalizeTarget(target);
  if (!session?.token) throw new Error("Not signed in. Run `4yi login`.");
  if (!new Set(["user", "project", "both"]).has(scope)) throw new Error("Claude scope must be user, project, or both.");
  const urls = resolveUrls(session, options);
  const tooling = options.tooling || {};
  if (!options.skipToolCheck) {
    await prepareConnectionTools({ target: normalized, autoInstall: options.autoInstall, stdout, tooling });
  }
  if (normalized === "claude" || normalized === "all") {
    await connectClaude({ session, home, cwd, scope, claudeBaseUrl: urls.claudeBaseUrl, stdout });
    reportDesktopApp("claude", { ...tooling, home, stdout });
  }
  if (normalized === "codex" || normalized === "all") {
    await connectCodex({ session, home, codexHome, codexBaseUrl: urls.codexBaseUrl, stdout, skipCheck: options.skipCheck, tooling });
    reportDesktopApp("codex", { ...tooling, home, stdout });
  }
}

function readClaudeStatus(file) {
  if (!fs.existsSync(file)) return { file, connected: false };
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const env = data?.env || {};
    return { file, connected: Boolean(env.ANTHROPIC_BASE_URL && env.ANTHROPIC_AUTH_TOKEN), baseUrl: env.ANTHROPIC_BASE_URL, model: env.ANTHROPIC_MODEL, token: mask(env.ANTHROPIC_AUTH_TOKEN) };
  } catch (error) {
    return { file, connected: false, error: error.message };
  }
}

export function connectionStatus({ target = "all", home = os.homedir(), cwd = process.cwd(), codexHome = process.env.CODEX_HOME, scope = "user", stdout = console.log } = {}) {
  const normalized = normalizeTarget(target);
  const paths = connectionPaths({ home, cwd, codexHome });
  if (normalized === "claude" || normalized === "all") {
    const files = scope === "project" ? [paths.claudeProject] : scope === "both" ? [paths.claudeUser, paths.claudeProject] : [paths.claudeUser];
    for (const file of files) stdout(`Claude Code: ${JSON.stringify(readClaudeStatus(file))}`);
  }
  if (normalized === "codex" || normalized === "all") {
    const text = fs.existsSync(paths.codexConfig) ? fs.readFileSync(paths.codexConfig, "utf8") : "";
    stdout(`Codex: ${JSON.stringify({ file: paths.codexConfig, connected: text.includes(CODEX_PROVIDER_START), catalog: paths.codexCatalog })}`);
  }
}

function restoreOne(target, home, stdout, { required = true } = {}) {
  const backups = latestBackups(target, home);
  if (backups.length === 0) {
    if (required) throw new Error(`No ${target} backup found.`);
    return false;
  }
  for (const backup of backups) {
    const record = JSON.parse(fs.readFileSync(backup, "utf8"));
    if (record.existed) atomicWrite(record.source, record.content || "");
    else if (fs.existsSync(record.source)) fs.unlinkSync(record.source);
    stdout(`Restored ${target}: ${record.source}`);
    stdout(`From: ${backup}`);
  }
  return true;
}

export function restoreConnection({ target = "all", home = os.homedir(), stdout = console.log } = {}) {
  const normalized = normalizeTarget(target);
  if (normalized === "claude") return restoreOne("claude", home, stdout);
  if (normalized === "codex") return restoreOne("codex", home, stdout);
  const restoredClaude = restoreOne("claude", home, stdout, { required: false });
  const restoredCodex = restoreOne("codex", home, stdout, { required: false });
  if (!restoredClaude && !restoredCodex) throw new Error("No Claude or Codex backup found.");
  return true;
}

export const __testing = {
  buildCodexCatalog,
  checkCodex,
  commandAvailable,
  desktopAppCandidates,
  ensureToolCli,
  executableName,
  reportDesktopApp,
  removeManagedBlock,
  removeCodexRootAssignments,
  CLAUDE_MANAGED_ENV_KEYS,
};
