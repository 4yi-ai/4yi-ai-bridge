import os from "node:os";
import { spawn } from "node:child_process";
import { normalizeBaseUrl, readConfig, writeConfig } from "./config.mjs";
import { requestJson } from "./http.mjs";

export function loadSession(home = os.homedir()) {
  return readConfig(home);
}

export function saveSession(session, home = os.homedir()) {
  writeConfig(session, home);
}

export function clearSession(home = os.homedir()) {
  const current = readConfig(home);
  const { token: _token, org: _org, user: _user, ...localPreferences } = current;
  writeConfig(localPreferences, home);
}

export function openBrowser(url) {
  const command = process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "rundll32"
      : "xdg-open";
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.unref();
}

export async function login({
  baseUrl = process.env.FOURYI_BASE_URL,
  home = os.homedir(),
  open = openBrowser,
  stdout = console.log,
} = {}) {
  const resolvedBaseUrl = normalizeBaseUrl(baseUrl);
  const start = await requestJson(resolvedBaseUrl, "/api/cli/auth/start", { method: "POST" });
  stdout("Opening browser for OAuth web verification...");
  stdout(`If it does not open, visit: ${start.verification_uri_complete}`);
  open(start.verification_uri_complete);

  const started = Date.now();
  while (Date.now() - started < start.expires_in * 1000) {
    await new Promise((resolve) => setTimeout(resolve, start.interval * 1000));
    const poll = await requestJson(resolvedBaseUrl, "/api/cli/auth/poll", {
      method: "POST",
      body: JSON.stringify({ device_code: start.device_code }),
    });
    if (poll.status === "approved" && poll.token) {
      const session = await requestJson(resolvedBaseUrl, "/api/cli/session", { token: poll.token });
      saveSession({ baseUrl: resolvedBaseUrl, token: poll.token, org: session.org, user: session.user }, home);
      stdout(`Signed in to ${session.org.name}`);
      return session;
    }
  }
  throw new Error("OAuth verification expired");
}
