import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { pathsForHome, ensureDir, getPreferredModel, setPreferredModel } from "./config.mjs";
import { requestJson } from "./http.mjs";

const OPENCODE_VERSION = "1.18.25";
const OPENAI_COMPATIBLE_VERSION = "3.0.39";
const DEFAULT_OPENCODE_PACKAGE = `opencode-ai@${OPENCODE_VERSION}`;
const OPENAI_COMPATIBLE_PACKAGE = `@ai-sdk/openai-compatible@${OPENAI_COMPATIBLE_VERSION}`;
const TRUSTED_OPENCODE_INSTALL_SCRIPT = `opencode-ai@${OPENCODE_VERSION}`;
const DEFAULT_CONTEXT_LIMIT = 200000;
const DEFAULT_OUTPUT_LIMIT = 8192;

function isClaudeModel(model) {
  if (model?.family === "claude") return true;
  const id = model?.id || "";
  const name = model?.display_name || "";
  return /claude/i.test(id) || /claude/i.test(name);
}

function modelContextLimit(model) {
  return model.context_length || model.context_limit || model.input_limit || DEFAULT_CONTEXT_LIMIT;
}

function modelOutputLimit(model) {
  return model.output_limit || model.max_output_tokens || model.max_tokens || DEFAULT_OUTPUT_LIMIT;
}

function modelPickerName(model) {
  const displayName = model.display_name || model.id;
  if (model.family === "claude") {
    return `Claude · ${displayName.replace(/^(?:anthropic[ ._-]*)?claude[ ._-]*/i, "")}`;
  }
  if (model.family === "codex") return `Codex · ${displayName}`;
  return displayName;
}

export function buildOpenCodeConfig({ modelConfig, preferredModel = null, tokenEnv = "FOURYI_CLI_TOKEN", orgEnv = "FOURYI_ORG_ID" }) {
  // Register every server-approved coding model so OpenCode's native switcher
  // (`Tab` / `/models`) can move between Claude and Codex. Claude stays the default.
  const list = modelConfig.models || [];
  const models = {};
  for (const model of list) {
    const entry = {
      name: modelPickerName(model),
      limit: {
        context: modelContextLimit(model),
        output: modelOutputLimit(model),
      },
    };
    if (typeof model.attachment === "boolean") entry.attachment = model.attachment;
    if (model.modalities && typeof model.modalities === "object") entry.modalities = model.modalities;
    models[model.id] = entry;
  }
  const has = (id) => !!id && list.some((model) => model.id === id);
  const firstClaude = list.find(isClaudeModel)?.id;
  // Precedence: an explicit/persisted preferred model → server default → first Claude → first model.
  const defaultModel =
    (has(preferredModel) && preferredModel) ||
    (has(modelConfig.default_model) && modelConfig.default_model) ||
    firstClaude ||
    list[0]?.id;

  return {
    "$schema": "https://opencode.ai/config.json",
    model: defaultModel ? `4yi/${defaultModel}` : undefined,
    enabled_providers: ["4yi"],
    provider: {
      "4yi": {
        name: "4YI",
        npm: "@ai-sdk/openai-compatible",
        options: {
          baseURL: modelConfig.base_url,
          apiKey: `{env:${tokenEnv}}`,
          headers: {
            "X-4YI-Org-ID": `{env:${orgEnv}}`,
          },
        },
        models,
      },
    },
  };
}

export function opencodeEnv({ home = os.homedir(), token, orgId = "", configFile, baseEnv = process.env } = {}) {
  const xdgRoot = path.join(pathsForHome(home).opencodeConfigDir, "xdg");
  return {
    ...baseEnv,
    FOURYI_CLI_TOKEN: token,
    FOURYI_ORG_ID: orgId,
    OPENCODE_CONFIG: configFile,
    XDG_CONFIG_HOME: path.join(xdgRoot, "config"),
    XDG_DATA_HOME: path.join(xdgRoot, "data"),
    XDG_CACHE_HOME: path.join(xdgRoot, "cache"),
    XDG_STATE_HOME: path.join(xdgRoot, "state"),
  };
}

export function ensureOpenCodeRuntime({ home = os.homedir(), stdout = console.log, spawn = spawnSync, env = process.env } = {}) {
  const paths = pathsForHome(home);
  ensureDir(paths.opencodeDir);
  const packageJson = fs.existsSync(paths.opencodePackageFile)
    ? JSON.parse(fs.readFileSync(paths.opencodePackageFile, "utf8"))
    : {
      private: true,
      type: "module",
      dependencies: {},
    };
  const installScriptTrusted = packageJson.allowScripts?.[TRUSTED_OPENCODE_INSTALL_SCRIPT] === true;
  if (!installScriptTrusted) {
    packageJson.allowScripts = {
      ...(packageJson.allowScripts || {}),
      [TRUSTED_OPENCODE_INSTALL_SCRIPT]: true,
    };
    fs.writeFileSync(paths.opencodePackageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
  }

  const bin = path.join(paths.opencodeDir, "node_modules", ".bin", process.platform === "win32" ? "opencode.cmd" : "opencode");
  const opencodePackage = env.FOURYI_OPENCODE_PACKAGE || DEFAULT_OPENCODE_PACKAGE;
  const usesDefaultRuntime = opencodePackage === DEFAULT_OPENCODE_PACKAGE;
  const runtimeCurrent = fs.existsSync(bin)
    && (!usesDefaultRuntime || (
      packageJson.dependencies?.["opencode-ai"] === OPENCODE_VERSION
      && packageJson.dependencies?.["@ai-sdk/openai-compatible"] === OPENAI_COMPATIBLE_VERSION
    ));
  if (runtimeCurrent) return bin;

  stdout(`Installing OpenCode runtime into ${paths.opencodeDir}...`);
  const result = spawn("npm", ["install", "--prefix", paths.opencodeDir, "--save-exact", opencodePackage, OPENAI_COMPATIBLE_PACKAGE], {
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("OpenCode runtime install failed");
  if (!fs.existsSync(bin)) throw new Error(`OpenCode binary not found at ${bin}`);
  stdout("OpenCode runtime installed.");
  return bin;
}

export async function runCode({ session, home = os.homedir(), argv = [], stdout = console.log, preferredModel = null } = {}) {
  if (!session?.token) throw new Error("Not signed in. Run `4yi login`.");
  const modelConfig = await requestJson(session.baseUrl, "/api/cli/models?runtime=opencode", { token: session.token });
  const list = modelConfig.models || [];
  if (list.length === 0) throw new Error("No chat models available for this organization.");

  // Resolve the model to launch with: an explicit `--model` (validated + persisted)
  // takes precedence over a previously persisted preference; both must be entitled.
  const valid = (id) => !!id && list.some((model) => model.id === id);
  const explicit = valid(preferredModel) ? preferredModel : null;
  const persisted = !explicit && valid(getPreferredModel(home)) ? getPreferredModel(home) : null;
  const effectivePreferred = explicit || persisted || null;
  if (explicit) setPreferredModel(explicit, home);
  if (preferredModel && !explicit) stdout(`Model "${preferredModel}" is not available; using the default instead.`);

  const paths = pathsForHome(home);
  ensureDir(paths.opencodeConfigDir);
  for (const dir of ["config", "data", "cache", "state"]) {
    ensureDir(path.join(paths.opencodeConfigDir, "xdg", dir));
  }
  fs.writeFileSync(paths.opencodeConfigFile, `${JSON.stringify(buildOpenCodeConfig({ modelConfig, preferredModel: effectivePreferred }), null, 2)}\n`, { mode: 0o600 });

  const bin = ensureOpenCodeRuntime({ home, stdout });
  stdout("Launching OpenCode with 4YI models...");
  const child = spawn(bin, argv, {
    stdio: "inherit",
    env: opencodeEnv({
      home,
      token: session.token,
      orgId: session.org?.id || "",
      configFile: paths.opencodeConfigFile,
    }),
  });
  return new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 0)));
}
