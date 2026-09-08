# Matterbridge Claude Instructions (v.1.0.5)

@AGENTS.md

## Claude Code specifics

[AGENTS.md](./AGENTS.md) above is the single source for the shared instructions. Do not duplicate any of it here — edit AGENTS.md instead.

- The rule files it lists under [.agents/rules](./.agents/rules/) are mirrored by [.claude/rules](.claude/rules/), which load automatically for the file types they are scoped to.
- The skills it lists under [.agents/skills](./.agents/skills/) are also available as slash commands in [.claude/commands](.claude/commands/): `/verify-agent-context`, `/matterjs-pr-workflow`, `/verify-npm-alignement`, `/verify-server-endpoint-context`, `/verify-version-alignment`.
