# Matterbridge Gemini Instructions (v.1.0.0)

@AGENTS.md

## Gemini / Antigravity specifics

[AGENTS.md](./AGENTS.md) above is the single source for the shared instructions. Do not duplicate any of it here — edit AGENTS.md instead.

- The rule files it lists under [.agents/rules](./.agents/rules/) apply on demand for the relevant tasks.
- The skills it lists under [.agents/skills](./.agents/skills/) are discovered automatically and invocable as slash commands: `/verify-agent-context`, `/matterjs-pr-workflow`, `/verify-npm-alignment`, `/verify-server-endpoint-context`, `/verify-version-alignment`.

### Command Execution Restrictions

The following command execution rules must be strictly adhered to:

#### 1. Forbidden (Never Execute)

The agent must never execute mutating git commands. These must be run manually by the user:

- `git pull`
- `git merge`
- `git push`
- `git rebase`
- `git commit`
- `git reset`
- `git filter-branch`
- `git branch -d`
- `git branch -D`
- `git tag -d`
- `git reflog expire`
- `git reflog delete`

#### 2. Prompt (Ask Before Executing)

The agent must ask for user confirmation before executing:

- Dependency operations: `npm install`, `npm i`, `npm uninstall`, `bun install`, `bun i`, `bun uninstall`, `bun add`, `bun remove`
- External network fetches & containers: `curl`, `Invoke-WebRequest`, `docker pull`, `docker run`

#### 3. Allowed Validation Commands

The agent is permitted to execute project build, test, and validation scripts autonomously:

- `npm run typecheck`
- `npm run build`
- `npm run test`
- `npm run test:watch`
- `npm run test:verbose`
- `npm run test:coverage`
- `npm run lint`
- `npm run format`
- `bun test`
