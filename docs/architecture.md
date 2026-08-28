# Architecture and public/private boundary

4YI AI Bridge is the local connection layer for supported AI applications.

```mermaid
flowchart LR
    subgraph Local[User device]
        A[Claude Code]
        B[Codex]
        C[OpenCode]
        D[Desktop bridge · Preview]
    end

    A --> E[4YI client connection layer]
    B --> E
    C --> E
    D -.-> E
    E --> F[Hosted 4YI API]
    F --> G[Model providers]
    F -. Planned .-> H[Agent services]
```

## Public repository scope

This repository may contain local client code, public configuration adapters, examples, tests, documentation, and release automation.

It does not contain production credentials, customer data, hosted billing logic, internal control-plane code, production routing policy, fraud controls, or infrastructure configuration.

## Configuration safety

Connection helpers should:

1. detect the target application and configuration location;
2. show the proposed change;
3. back up existing configuration before writing;
4. avoid overwriting unrelated user settings;
5. provide status and restore commands; and
6. never print credentials in normal output.
