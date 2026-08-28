import test from "node:test";
import assert from "node:assert/strict";
import { npmTagForRelease, parseGitHubBoolean } from "../release-policy.mjs";

test("a beta version is isolated on the npm beta tag", () => {
  assert.equal(npmTagForRelease("0.2.0-beta.1", true), "beta");
  assert.throws(
    () => npmTagForRelease("0.2.0-beta.1", false),
    /requires a GitHub prerelease/,
  );
});

test("only a stable normal release can select npm latest", () => {
  assert.equal(npmTagForRelease("0.2.0", false), "latest");
  assert.throws(
    () => npmTagForRelease("0.2.0", true),
    /requires a normal GitHub release/,
  );
});

test("unsupported prerelease channels cannot be published", () => {
  assert.throws(
    () => npmTagForRelease("0.2.0-rc.1", true),
    /Unsupported release version/,
  );
});

test("GitHub prerelease input is parsed strictly", () => {
  assert.equal(parseGitHubBoolean("true"), true);
  assert.equal(parseGitHubBoolean("false"), false);
  assert.throws(() => parseGitHubBoolean("1"), /exactly true or false/);
});
