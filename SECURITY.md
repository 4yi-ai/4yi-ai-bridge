# Security policy

## Reporting a vulnerability

Please do not disclose vulnerabilities, credentials, access tokens, private configuration, prompts, customer data, or complete diagnostic logs in a public issue or pull request.

Use GitHub private vulnerability reporting when it is enabled for this repository. If private reporting is unavailable, contact the security address published on the official 4YI website and include:

- the affected version and operating system;
- the minimum steps required to reproduce the issue;
- the expected and observed behavior;
- a description of the potential impact; and
- redacted logs or screenshots, if needed.

Do not include working credentials. We will acknowledge a valid report and coordinate disclosure after a fix is available.

## Supported versions

Security fixes are provided for the latest published CLI release. Upgrade to the latest version before reporting an issue that may already be resolved.

## Client security model

- Connection commands back up configuration before writing and support a non-mutating `--dry-run`.
- The CLI uses owner-only file permissions where the operating system supports POSIX modes.
- Runtime dependencies are pinned to versions tested with the current CLI release.
- The future desktop app will use the operating system credential store rather than copying CLI token storage unchanged.
