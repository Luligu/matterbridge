---
name: verify-agent-context
description: Verify which coding agent is running and that it loaded the shared Matterbridge instructions, rules and skills from AGENTS.md and .agents/. Use when the user asks to check, test or debug the agent configuration. v.1.0.4
---

# Agent configuration check

Run this check and reply with a short report. Do not modify any file.

1. First, report the absolute current working directory and whether you are working in a linked Git worktree or a direct folder (the main checkout or a non-Git folder). Verify using `git rev-parse --show-toplevel`, `git rev-parse --absolute-git-dir` and `git rev-parse --path-format=absolute --git-common-dir`: different Git and common directories indicate a linked worktree; matching directories indicate the main checkout. If the folder is not a Git repository, report it as a direct non-Git folder. Report the current branch using `git symbolic-ref --quiet --short HEAD`; if HEAD is detached, report `detached HEAD` and the short commit ID from `git rev-parse --short HEAD`. For a non-Git folder, report the branch as not applicable. Include the repository root when it differs from the current directory, and make this location and branch information the first row of the report.
2. State which agent you are (GitHub Copilot, Codex, Claude Code or Gemini / Antigravity) and, if known, the model.
3. Confirm you have the shared instructions from `AGENTS.md` in context. Quote its title line, including the version.
4. List the rule files in `.agents/rules/` and, for each, say whether its content is already in your context or only reachable on demand.
5. List the skills you discovered from `.agents/skills/` and from any tool-specific folder such as `.claude/skills/` or `.github/skills/`.
6. Read `.agents/rules/testing.instructions.md` and report the version at the end of its `description` frontmatter to prove the file is readable.
7. Report the result as a markdown table with the columns `Item`, `Status`, `Notes`.
8. Report the context size, including the number of instructions, rules, and skills currently loaded.
