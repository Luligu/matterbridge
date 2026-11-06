## Shared agent instructions for Matterbridge

This repository supplies shared guidance through [AGENTS.md](./AGENTS.md) and [.agents/](./.agents/), the **single source of truth** for agent instructions, rules, and skills. Edit the shared guidance there; the instruction and skill wrappers under `.github/` and `.claude/` point back to it. Those folders also contain other configuration, workflows, and metadata; `.codex/` and `.antigravity/` contain tool-specific configuration. See [.agents/README.md](./.agents/README.md) for the full layout.

| File                                                     | Notes                                                                                                                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                              | Main project instructions — shared by every agent                                                                                                          |
| `.agents/README.md`                                      | Layout and versioning of the shared instructions                                                                                                           |
| `.agents/rules/testing.instructions.md`                  | Testing standards for unit tests                                                                                                                           |
| `.agents/rules/matterbridge.instructions.md`             | Create and register Matterbridge endpoints and use exported device classes                                                                                 |
| `.agents/rules/plugin-frontend.instructions.md`          | Serve plugin frontend SPAs and custom REST APIs, including Home Assistant Ingress paths                                                                    |
| `.agents/rules/matterbridge-chip-tests.instructions.md`  | Run the CHIP conformance tests against Matterbridge itself                                                                                                 |
| `.agents/skills/verify-agent-context/SKILL.md`           | Verify the agent loaded this context — `$verify-agent-context` (Codex), `@verify-agent-context` (Bionic / LM Studio), `/verify-agent-context` (all others) |
| `.agents/skills/matterjs-pr-workflow/SKILL.md`           | Sync the matter.js fork, implement and validate changes, and open an upstream PR                                                                           |
| `.agents/skills/verify-npm-alignment/SKILL.md`           | Verify Matterbridge and workspace package alignment on npm latest and dev tags                                                                             |
| `.agents/skills/verify-server-endpoint-context/SKILL.md` | Verify server endpoint context, type narrowing, forwarding, observables and Matter comments                                                                |
| `.agents/skills/verify-version-alignment/SKILL.md`       | Verify package, Docker, test helper, docs update and workflow versions                                                                                     |

Shared rules and skills live in `.agents/`; the main instructions live in `AGENTS.md`, which also references `STYLEGUIDE.md`. Claude Code and Copilot reach them through pointer files; Codex, Gemini / Antigravity and Bionic / LM Studio read `AGENTS.md` and `.agents/` directly. Loading depends on the client and its configuration; the table describes the repository setup.

| Tool                               | Instructions                                           | Rules                                                 | Skills                               |
| ---------------------------------- | ------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------ |
| Codex                              | `AGENTS.md` — read natively                            | `.agents/rules/` — linked from `AGENTS.md`, on demand | `.agents/skills/` — native, `$name`  |
| Copilot (VS Code and coding agent) | `.github/copilot-instructions.md` → `AGENTS.md`        | stubs in `.github/instructions/` — `applyTo` globs    | stubs in `.github/skills/` — `/name` |
| Claude Code                        | `CLAUDE.md` imports `AGENTS.md`                        | stubs in `.claude/rules/` — `paths` globs             | stubs in `.claude/skills/` — `/name` |
| Gemini / Antigravity               | `GEMINI.md` imports `AGENTS.md`                        | `.agents/rules/` — on demand                          | `.agents/skills/` — native, `/name`  |
| Bionic / LM Studio                 | `AGENTS.md` — read natively from the working directory | `.agents/rules/` — linked from `AGENTS.md`, on demand | `.agents/skills/` — native, `@name`  |

Matterbridge is the host every plugin runs in, so its rules cover both the core and the plugin-facing API:

- `matterbridge.instructions.md` documents the endpoint API in `packages/core/src` that plugins build their devices with.
- `plugin-frontend.instructions.md` documents how Matterbridge serves a plugin's own frontend and REST API (`apps/frontend`, `packages/core/src/frontend.ts`).
- `matterbridge-chip-tests.instructions.md` documents the CHIP conformance test harness that runs against Matterbridge itself.

Apart from `verify-agent-context`, the skills are specific to this monorepo: opening matter.js PRs from the local fork, checking the server endpoint context, and checking that versions line up across the workspace packages, npm dist-tags, Docker and docs. Files managed by mb-run are refreshed from its templates on upgrade.

### Copilot instructions

| File                                                                      | Notes                                                                                                                                              |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/copilot-instructions.md`                                         | Entry point importing or linking to AGENTS.md                                                                                                      |
| `.github/instructions/testing/testing.instructions.md`                    | Testing standards — scoped to the test patterns listed below                                                                                       |
| `.github/instructions/matterbridge/matterbridge.instructions.md`          | Endpoint guide — scoped to `packages/core/src/**`                                                                                                  |
| `.github/instructions/plugin-frontend/plugin-frontend.instructions.md`    | Frontend guide — scoped to `apps/frontend/**` and `packages/core/src/frontend.ts`                                                                  |
| `.github/instructions/chip-tests/matterbridge-chip-tests.instructions.md` | CHIP harness guide — scoped to the CHIP files listed below                                                                                         |
| `.github/agents/matterbridge.agent.md`                                    | **Matterbridge** custom agent — follows the shared instructions and works without subagent delegation                                              |
| `.github/skills/verify-agent-context/SKILL.md`                            | Skill invocable as `/verify-agent-context`                                                                                                         |
| `.github/skills/matterjs-pr-workflow/SKILL.md`                            | Skill invocable as `/matterjs-pr-workflow` — Sync the matter.js fork, implement and validate changes, and open an upstream PR                      |
| `.github/skills/verify-npm-alignment/SKILL.md`                            | Skill invocable as `/verify-npm-alignment` — Verify Matterbridge and workspace package alignment on npm latest and dev tags                        |
| `.github/skills/verify-server-endpoint-context/SKILL.md`                  | Skill invocable as `/verify-server-endpoint-context` — Verify server endpoint context, type narrowing, forwarding, observables and Matter comments |
| `.github/skills/verify-version-alignment/SKILL.md`                        | Skill invocable as `/verify-version-alignment` — Verify package, Docker, test helper, docs update and workflow versions                            |

The testing pointers for both Claude Code and Copilot cover `**/*.test.ts`, `**/*.spec.ts`, `**/test/**/*.ts`, `**/vitest/**/*.ts`, and `**/buntest/**/*.ts`.

### Claude instructions

| File                                                               | Notes                                                                                                                                              |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                                                        | Entry point importing or linking to AGENTS.md                                                                                                      |
| `.claude/settings.json`                                            | Claude permissions: allow, ask and deny rules                                                                                                      |
| `.claude/rules/testing/testing.instructions.md`                    | Testing standards — scoped to the test patterns listed below                                                                                       |
| `.claude/rules/matterbridge/matterbridge.instructions.md`          | Endpoint guide — scoped to `packages/core/src/**`                                                                                                  |
| `.claude/rules/plugin-frontend/plugin-frontend.instructions.md`    | Frontend guide — scoped to `apps/frontend/**` and `packages/core/src/frontend.ts`                                                                  |
| `.claude/rules/chip-tests/matterbridge-chip-tests.instructions.md` | CHIP harness guide — scoped to the CHIP files listed below                                                                                         |
| `.claude/skills/verify-agent-context/SKILL.md`                     | Skill invocable as `/verify-agent-context`                                                                                                         |
| `.claude/skills/matterjs-pr-workflow/SKILL.md`                     | Skill invocable as `/matterjs-pr-workflow` — Sync the matter.js fork, implement and validate changes, and open an upstream PR                      |
| `.claude/skills/verify-npm-alignment/SKILL.md`                     | Skill invocable as `/verify-npm-alignment` — Verify Matterbridge and workspace package alignment on npm latest and dev tags                        |
| `.claude/skills/verify-server-endpoint-context/SKILL.md`           | Skill invocable as `/verify-server-endpoint-context` — Verify server endpoint context, type narrowing, forwarding, observables and Matter comments |
| `.claude/skills/verify-version-alignment/SKILL.md`                 | Skill invocable as `/verify-version-alignment` — Verify package, Docker, test helper, docs update and workflow versions                            |

The CHIP pointers for both Claude Code and Copilot cover `chipTests.json`, `chipTests.md`, `chipTests.log`, `chipTestsSummary.log`, `scripts/run-matterbridge-chip-tests.mjs`, `packages/core/src/chipTests.ts`, `packages/core/src/demoDevices.ts`, `packages/core/src/helpers.ts`, `docker/Dockerfile.chip-test`, `docker/entrypoint.chip-test.sh`, `docker/chip-test/**`, `.github/workflows/docker-buildx-chip-test.yml`, and `.github/workflows/chip-tests.yml`.

### Codex instructions

| File                         | Notes                                                             |
| ---------------------------- | ----------------------------------------------------------------- |
| `AGENTS.md`                  | Main project instructions — read directly, no pointer file needed |
| `.codex/config.toml`         | Codex project permissions, approvals, and profiles                |
| `.codex/rules/default.rules` | Codex command allow, prompt, and deny rules                       |

Codex discovers skills in `.agents/skills/`; skills are invoked as `$name`. Rules in `.agents/rules/` are referenced by `AGENTS.md` and read when relevant; they are not automatically applied by glob. In Matterbridge, this includes `matterbridge.instructions.md`, `plugin-frontend.instructions.md`, and `matterbridge-chip-tests.instructions.md` alongside `testing.instructions.md`.

### Gemini / Antigravity instructions

| File                         | Notes                                                 |
| ---------------------------- | ----------------------------------------------------- |
| `GEMINI.md`                  | Entry point importing or linking to AGENTS.md         |
| `.antigravity/settings.json` | Sandboxing and permissions: allow, ask and deny rules |

The shared testing, Matterbridge endpoint, plugin frontend, and CHIP harness rules under `.agents/rules/` apply on demand for the relevant tasks, and `.agents/skills/` is discovered automatically as `/name`.

### Bionic / LM Studio instructions

| File        | Notes                                                             |
| ----------- | ----------------------------------------------------------------- |
| `AGENTS.md` | Main project instructions — read directly, no pointer file needed |

Bionic loads `AGENTS.md` from the session working directory only, so open the project with the repository root as its working directory; it does not read a global or parent-folder `AGENTS.md`. It discovers skills in `.agents/skills/`; skills are invoked as `@name`. Rules in `.agents/rules/` are referenced by `AGENTS.md` and read when relevant; in Matterbridge, this includes `matterbridge.instructions.md`, `plugin-frontend.instructions.md`, and `matterbridge-chip-tests.instructions.md` alongside `testing.instructions.md`.

Bionic has no repository-level permissions file. Command approval is chosen per session in the app, so the allow, ask and deny rules in `.claude/`, `.codex/` and `.antigravity/` do not apply to it; the instructions in `AGENTS.md` are its only guardrails from this repository.
