---
name: verify-agent-context
description: Verify which coding agent is running and that it loaded the shared Matterbridge instructions, rules and skills from AGENTS.md and .agents/. Use when the user asks to check, test or debug the agent configuration. v.1.0.6
---

# Agent configuration check

Run this check and reply with a short report. Do not modify any file.

1. First, report the absolute current working directory and whether you are working in a linked Git worktree or a direct folder (the main checkout or a non-Git folder). Verify using `git rev-parse --show-toplevel`, `git rev-parse --absolute-git-dir` and `git rev-parse --path-format=absolute --git-common-dir`: different Git and common directories indicate a linked worktree; matching directories indicate the main checkout. If the folder is not a Git repository, report it as a direct non-Git folder. Report the current branch using `git symbolic-ref --quiet --short HEAD`; if HEAD is detached, report `detached HEAD` and the short commit ID from `git rev-parse --short HEAD`. For a non-Git folder, report the branch as not applicable. Include the repository root when it differs from the current directory, and make this location and branch information the first row of the report.
2. State which agent you are (GitHub Copilot, Codex, Claude Code, Gemini / Antigravity or Bionic / LM Studio) and, if known, the model.
3. Confirm you have the shared instructions from `AGENTS.md` in context. Quote its title line, including the version.
4. Report the global context, without printing any file contents beyond title lines. For each item, state whether you know it from your loaded context or only from checking the disk:
   - Global instruction file: if one is in your context (for example `~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md`, `~/.gemini/config/GEMINI.md` or `~/.copilot/copilot-instructions.md`), give its path and quote its title line, including the version. If none is in your context, say so, even if such a file exists on disk.
   - Global master: check whether `~/.agents/AGENTS.md` exists in the user's home folder. If it does, quote its title line, including the version, and say whether it matches the global instruction file in your context. A missing match means the global instructions did not reach this agent, or reached it from a stale copy.
   - Global settings: name the settings file your agent uses, if you know it (for example `~/.claude/settings.json`, `~/.codex/config.toml`, `~/.gemini/settings.json` or `~/.lmstudio/apps/bionic/.internal/settings.json`), and say whether its contents are in your context or only enforced by the agent itself. Never print values from it.
5. List the rule files in `.agents/rules/` and, for each, say whether its content is already in your context or only reachable on demand.
6. List the skills available to you, grouped by source: the project (`.agents/skills/` or a tool-specific folder such as `.claude/skills/` or `.github/skills/`), the global skills folder (such as `~/.agents/skills/`) and any skills built into the agent. For each folder, state whether you discovered its skills natively (they are listed in your context and invocable) or only found the folder on disk; do not count on-disk-only skills as discovered.
7. Read `.agents/rules/testing.instructions.md` and report the version at the end of its `description` frontmatter to prove the file is readable.
8. Report the result as a markdown table with the columns `Item`, `Status`, `Notes`.
9. Report the context size, including the number of instructions, rules, and skills currently loaded.
