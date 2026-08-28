#!/usr/bin/env node
import fs from "node:fs";
import { login, loadSession, clearSession } from "../src/auth.mjs";
import { runCode } from "../src/opencode.mjs";
import { connect, connectionPlan, connectionStatus, prepareConnectionTools, restoreConnection } from "../src/connect.mjs";
import { runDoctor } from "../src/doctor.mjs";

const command = process.argv[2] || "help";

if (command === "help" || command === "--help" || command === "-h") {
  console.log("Usage: 4yi <login|whoami|logout|code|connect|status|restore|doctor>");
  console.log("  4yi code            launch OpenCode; switch models live with Tab / /models");
  console.log("  4yi code --model X  pin model X as the default for future sessions");
  console.log("  4yi connect <claude|codex|all>  connect existing coding tools to 4YI");
  console.log("    --yes                         install a missing CLI without prompting");
  console.log("    --dry-run                     show affected files without changing them");
  console.log("  4yi status [claude|codex|all]   inspect the current connection");
  console.log("  4yi restore <claude|codex|all>  restore the latest protected config");
  console.log("  4yi doctor [--json]             inspect local CLI readiness safely");
  process.exit(0);
}

function parseConnectArgs(args) {
  let target = "all";
  let scope = "user";
  let platformUrl;
  let claudeBaseUrl;
  let codexBaseUrl;
  let skipCheck = false;
  let autoInstall = false;
  let dryRun = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("-") && i === 0) target = arg;
    else if (arg === "--scope") scope = args[++i];
    else if (arg === "--platform-url") platformUrl = args[++i];
    else if (arg === "--claude-base-url") claudeBaseUrl = args[++i];
    else if (arg === "--codex-base-url") codexBaseUrl = args[++i];
    else if (arg === "--skip-codex-responses-check") skipCheck = true;
    else if (arg === "--yes" || arg === "-y") autoInstall = true;
    else if (arg === "--dry-run") dryRun = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return { target, scope, platformUrl, claudeBaseUrl, codexBaseUrl, skipCheck, autoInstall, dryRun };
}

/** Split out `--model <id>` / `--model=<id>` / `-m <id>`; the rest pass through to OpenCode. */
function parseCodeArgs(args) {
  let preferredModel = null;
  const passthrough = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--model" || arg === "-m") {
      preferredModel = args[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith("--model=")) {
      preferredModel = arg.slice("--model=".length);
    } else {
      passthrough.push(arg);
    }
  }
  return { preferredModel, passthrough };
}

if (command === "--version" || command === "-v") {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  console.log(pkg.version);
  process.exit(0);
}

try {
  if (command === "login") {
    await login();
  } else if (command === "whoami") {
    const session = loadSession();
    if (!session.token) throw new Error("Not signed in. Run `4yi login`.");
    console.log(`${session.user?.email || "4yi user"} in ${session.org?.name || session.org?.id}`);
  } else if (command === "logout") {
    clearSession();
    console.log("Signed out.");
  } else if (command === "code") {
    const session = loadSession();
    const { preferredModel, passthrough } = parseCodeArgs(process.argv.slice(3));
    const code = await runCode({ session, argv: passthrough, preferredModel });
    process.exit(Number(code || 0));
  } else if (command === "connect") {
    const connectArgs = parseConnectArgs(process.argv.slice(3));
    if (connectArgs.dryRun) {
      const plan = connectionPlan(connectArgs);
      console.log("Dry run — no files will be changed:");
      for (const item of plan) {
        console.log(`  ${item.target}: ${item.action} ${item.file} (${item.exists ? "existing" : "new"})`);
      }
      process.exit(0);
    }
    await prepareConnectionTools(connectArgs);
    let session = loadSession();
    if (!session.token) {
      await login();
      session = loadSession();
    }
    await connect({ session, ...connectArgs, skipToolCheck: true });
  } else if (command === "status") {
    const { target, scope } = parseConnectArgs(process.argv.slice(3));
    connectionStatus({ target, scope });
  } else if (command === "restore") {
    const { target } = parseConnectArgs(process.argv.slice(3));
    restoreConnection({ target });
  } else if (command === "doctor") {
    const args = process.argv.slice(3);
    const unknown = args.filter((arg) => arg !== "--json");
    if (unknown.length > 0) throw new Error(`Unknown option: ${unknown[0]}`);
    const result = runDoctor({ json: args.includes("--json") });
    if (!result.ok) process.exitCode = 1;
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
} catch (err) {
  console.error(err.message || String(err));
  process.exit(1);
}
