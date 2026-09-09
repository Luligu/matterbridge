# Shared agent instructions (v.1.0.1)

This folder is the **single source of truth** for the instructions given to every coding agent used on this
repository — OpenAI Codex, Claude Code and GitHub Copilot. Each agent reads the same documents through its
own mechanism, so guidance is written once here and never copied.

> **The rule:** edit files in `.agents/` (or `AGENTS.md`). Never edit the copies under `.claude/` or
> `.github/` — they are pointers, and anything written into them will drift away from the original.

## Layout

```
AGENTS.md                              the shared instructions themselves — style, scope, testing, Matter specs
.agents/rules/<topic>.instructions.md  deep guidance for one topic, read when relevant
.agents/skills/<name>/SKILL.md         a runnable workflow the user invokes on demand
```

### Rules

Reference documents. They are not loaded all the time — an agent opens the one relevant to the task.

| File                                            | Topic                                                 |
| ----------------------------------------------- | ----------------------------------------------------- |
| `rules/testing.instructions.md`                 | Testing standards for unit tests                      |
| `rules/matterbridge.instructions.md`            | Creating endpoints and using the single-class devices |
| `rules/plugin-frontend.instructions.md`         | Serving a plugin's own frontend SPA and REST API      |
| `rules/matterbridge-chip-tests.instructions.md` | The CHIP conformance test harness                     |

Each starts with YAML frontmatter holding a `description` that ends with the file's version:

```yaml
---
description: 'Testing standards for unit tests in the project v.1.0.5'
---
```

### Skills

Multi-step workflows a user asks for by name, rather than background reference material.

| Skill                            | Purpose                                                    |
| -------------------------------- | ---------------------------------------------------------- |
| `verify-agent-context`           | Check which agent is running and that it loaded this setup |
| `matterjs-pr-workflow`           | Open a PR against matter.js from the local fork            |
| `verify-npm-alignment`           | Check the published npm `latest` and `dev` tags line up    |
| `verify-server-endpoint-context` | Check server endpoint context and plugin forwarding order  |
| `verify-version-alignment`       | Check versions match across packages, Docker and docs      |

Each is a folder containing `SKILL.md`, whose frontmatter carries a `name` matching the folder and a
`description` that decides when the skill is offered:

```yaml
---
name: verify-version-alignment
description: Verify that package, Docker build, ... match the expected root version rules. v.1.0.0
---
```

Optional `scripts/`, `references/` and `assets/` subfolders are supported alongside `SKILL.md`.

## How each agent reaches these files

|             | Codex                                      | Claude Code                                         | Copilot                                                                  |
| ----------- | ------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------ |
| Entry point | `AGENTS.md`                                | `CLAUDE.md` → `@AGENTS.md`                          | `AGENTS.md` natively, plus a link from `.github/copilot-instructions.md` |
| Rules       | listed in `AGENTS.md`, read on demand      | `.claude/rules/*` pointers, auto-loaded by `paths:` | `.github/instructions/*` pointers, auto-applied by `applyTo:`            |
| Skills      | discovered automatically, run with `$name` | `.claude/skills/*` → `/name`                        | `.github/skills/*` → `/name`                                             |

Codex is the only one that reads `.agents/` natively — it scans `.agents/skills` from the working directory
up to the repository root. Claude Code and Copilot have no such convention, so each keeps a small mirror in
its own folder. Those mirrors hold **only** frontmatter plus a pointer, for example:

```markdown
---
description: 'Testing standards for unit tests in the project v.1.0.5'
paths:
  - '**/*.test.ts'
---

@../../../.agents/rules/testing.instructions.md
```

The frontmatter is what makes the tool load the file at the right moment; the body just redirects here. The
`.claude/skills/*` and `.github/skills/*` wrappers work the same way for skills, except that a skill mirror
redirects with a markdown link rather than an `@` transclusion — both agents follow the link when the skill
runs, and both also read the mirror's `description` to offer the skill on their own.

## Adding to this folder

**A new rule:**

1. Write `.agents/rules/<topic>.instructions.md` with a `description` frontmatter ending in `v.1.0.0`.
2. Add a bullet for it in `AGENTS.md` under _Additional Agent Guidance_ — Codex has no auto-loading, so a
   rule that is not listed there is invisible to it.
3. Create the two pointer files, copying the frontmatter style of an existing pair and setting the
   `paths:` / `applyTo:` globs that should trigger it:
   - `.claude/rules/<topic>/<name>.instructions.md`
   - `.github/instructions/<topic>/<name>.instructions.md`

**A new skill:**

1. Write `.agents/skills/<name>/SKILL.md` with `name` (matching the folder) and `description`.
2. Create the two pointer skills, each holding frontmatter (`name` matching its own folder, the same
   `description`, and an `argument-hint`) plus a link back to the document above:
   - `.claude/skills/<name>/SKILL.md`
   - `.github/skills/<name>/SKILL.md`
3. List it in `AGENTS.md`, `CLAUDE.md` and `.github/copilot-instructions.md`, using that tool's invocation
   form (`$name` for Codex, `/name` for the other two).

Keep the description identical across a document and its pointers, so the three tools describe the same
thing in the same words.

## Versions

Every file carries a version as `v.MAJOR.MINOR.PATCH` at the end of its `description` (or `name` for
Copilot, or the title for `AGENTS.md`). Bump it when the content changes, and bump it in the pointers too —
they must always agree with the document they point at.

## Checking it works

Run `/verify-agent-context` (Claude Code, Copilot) or `$verify-agent-context` (Codex) in a fresh session.
It reports which agent is running, whether `AGENTS.md` reached its context, which rules and skills it can
see, and whether it can actually read a rule file — which is the quickest way to catch a pointer that a
tool did not follow.
