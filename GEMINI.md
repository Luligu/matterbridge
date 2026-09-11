# Matterbridge Gemini Instructions (v.1.0.1)

@AGENTS.md

## Gemini / Antigravity specifics

[AGENTS.md](./AGENTS.md) above is the single source for the shared instructions. Do not duplicate any of it here — edit AGENTS.md instead.

- The rule files it lists under [.agents/rules](./.agents/rules/) apply on demand for the relevant tasks.
- The skills it lists under [.agents/skills](./.agents/skills/) are discovered automatically and invocable as slash commands: `/verify-agent-context`, `/matterjs-pr-workflow`, `/verify-npm-alignment`, `/verify-server-endpoint-context`, `/verify-version-alignment`.
