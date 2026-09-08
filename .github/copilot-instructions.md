# Matterbridge Workspace Instructions (v.1.0.5)

Read and follow [AGENTS.md](../AGENTS.md) in full. It is the single source for the shared instructions — do not duplicate any of it here, edit AGENTS.md instead.

## Copilot specifics

- The rule files AGENTS.md lists under [.agents/rules](../.agents/rules/) are mirrored by [.github/instructions](instructions/), which apply automatically to the file types they are scoped to.
- The skills it lists under [.agents/skills](../.agents/skills/) are also available as prompt files in [.github/prompts](prompts/): `/verify-agent-context`, `/matterjs-pr-workflow`, `/verify-npm-alignement`, `/verify-server-endpoint-context`, `/verify-version-alignment`.
