---
name: verify-agent-context
description: Verify which coding agent is running and that it loaded the shared Matterbridge instructions, rules and skills from AGENTS.md and .agents/. Use when the user asks to check, test or debug the agent configuration. v.1.0.2
---

# Agent configuration check

Run this check and reply with a short report. Do not modify any file.

1. State which agent you are (GitHub Copilot, Codex, Claude Code or Gemini / Antigravity) and, if known, the model.
2. Confirm you have the shared instructions from `AGENTS.md` in context. Quote its title line, including the version.
3. List the rule files in `.agents/rules/` and, for each, say whether its content is already in your context or only reachable on demand.
4. List the skills you discovered from `.agents/skills/` and from any tool-specific folder such as `.claude/skills/` or `.github/skills/`.
5. Read `.agents/rules/testing.instructions.md` and report the version at the end of its `description` frontmatter to prove the file is readable.
6. Report the result as a markdown table with the columns `Item`, `Status`, `Notes`.
7. Report the context size, including the number of instructions, rules, and skills currently loaded.
