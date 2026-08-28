import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BETA_VERSION = /^\d+\.\d+\.\d+-beta\.\d+$/;
const STABLE_VERSION = /^\d+\.\d+\.\d+$/;

export function npmTagForRelease(version, isGitHubPrerelease) {
  if (BETA_VERSION.test(version)) {
    if (!isGitHubPrerelease) {
      throw new Error(`Beta version ${version} requires a GitHub prerelease.`);
    }
    return "beta";
  }

  if (STABLE_VERSION.test(version)) {
    if (isGitHubPrerelease) {
      throw new Error(`Stable version ${version} requires a normal GitHub release.`);
    }
    return "latest";
  }

  throw new Error(`Unsupported release version: ${version}. Use x.y.z or x.y.z-beta.n.`);
}

export function parseGitHubBoolean(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("RELEASE_PRERELEASE must be exactly true or false.");
}

function main() {
  const packageJson = JSON.parse(fs.readFileSync(new URL("../packages/cli/package.json", import.meta.url), "utf8"));
  const npmTag = npmTagForRelease(
    packageJson.version,
    parseGitHubBoolean(process.env.RELEASE_PRERELEASE),
  );
  if (!process.env.GITHUB_OUTPUT) {
    throw new Error("GITHUB_OUTPUT is required in the release workflow.");
  }
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `npm_tag=${npmTag}\n`);
  console.log(`Protected npm channel selected: ${npmTag}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
