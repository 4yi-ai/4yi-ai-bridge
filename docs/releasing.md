# Maintainer release guide

The public repository and npm package share the same CLI release version.

## One-time GitHub and npm setup

1. Create the public `4yi-ai/4yi-ai-bridge` repository.
2. Protect `main`: require pull requests, CI, Docs, and Security checks; block force pushes and branch deletion.
3. Enable Discussions, private vulnerability reporting, secret scanning, push protection, and Dependabot alerts.
4. Create a protected GitHub environment named `npm` with maintainers as required reviewers.
5. Configure npm Trusted Publishing for `@4yi/cli` using this repository and `.github/workflows/release.yml`.
6. Confirm the npm package points to this repository and reports the MIT license.

Do not add a long-lived npm token when Trusted Publishing is available.

## Prepare a release

1. Update `packages/cli/package.json` and the root package version.
2. Update `CHANGELOG.md` and compatibility pins.
3. Run:

   ```bash
   npm ci
   npm run check
   ```

4. Test installation from a packed tarball on fresh macOS, Windows, and Linux environments.
5. Verify `login`, `whoami`, `connect --dry-run`, `connect`, `status`, `restore`, `doctor`, and `code` against the intended production service.
6. Merge through a reviewed pull request.

## Publish

Create a GitHub release whose tag exactly matches `v<packages/cli version>`, for example `v0.2.0`. Publishing the release runs the protected workflow, verifies the tag, runs the complete check suite, publishes npm provenance, and attaches the tarball.

If any step fails, fix it through a pull request. Do not bypass the release environment or publish a different working tree manually.
