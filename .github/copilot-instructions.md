# Matterbridge Workspace Instructions (v.1.0.6)

Apply the [shared agent instructions](../AGENTS.md) to all work in this repository. VS Code also loads that file on its own (`chat.useAgentsMdFile`), so this link is a fallback for clients that do not. It is the single source for the shared instructions — do not duplicate any of it here, edit AGENTS.md instead.

## Copilot specifics

- The rule files AGENTS.md lists under [.agents/rules](../.agents/rules/) are mirrored by [.github/instructions](instructions/), which apply automatically to the file types they are scoped to.
- The skills it lists under [.agents/skills](../.agents/skills/) are also available as prompt files in [.github/prompts](prompts/): `/verify-agent-context`, `/matterjs-pr-workflow`, `/verify-npm-alignment`, `/verify-server-endpoint-context`, `/verify-version-alignment`.
