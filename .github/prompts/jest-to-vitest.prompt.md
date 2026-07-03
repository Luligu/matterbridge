---
name: 'Jest To Vitest'
description: 'Transform a Jest test file from packages/<pkg>/src into a Vitest test file under packages/<pkg>/vitest, following the Matterbridge migration pattern (vitest-utils package, vi globals, new Matter server lifecycle)'
argument-hint: 'Path of the Jest test file to transform'
agent: 'agent'
---

Transform the given Jest test file (e.g. `packages/core/src/foo.test.ts`) into a Vitest test file (`packages/core/vitest/foo.test.ts`).

Ground rules:

- Create the new file under `packages/<pkg>/vitest/`. The root [vite.config.ts](../../vite.config.ts) only picks up `**/vitest/**/*.{spec,test}.{ts,mts,cts}`. Do NOT delete the Jest original unless explicitly asked.
- Test bodies, assertions, `describe`/`test` names, `MATTER_PORT`, `MATTER_CREATE_ONLY`, and hook timeouts (e.g. `30000`) stay unchanged. Only the harness around them changes.
- Each test file must keep a unique `MATTER_PORT`. If creating a brand-new file, pick an unused port.
- Vitest runs with `globals: true`: `describe`, `test`, `expect`, `beforeAll`, `beforeEach`, `afterAll`, and `vi` are globals. Do not import them from `'vitest'` and do not import `'@jest/globals'`.

Transformation steps:

1. Header block:
   - Remove `const HOMEDIR = path.join('.cache', 'jest', NAME);`, the `process.argv = [...]` assignment, and the `import path from 'node:path';` if it was only used for `HOMEDIR`. The `setupTest(NAME)` helper from `@matterbridge/vitest-utils` sets `HOMEDIR` (to `.cache/vitest/<NAME>`) and `process.argv` itself.
   - Keep `const NAME`, `const MATTER_PORT`, `const MATTER_CREATE_ONLY`.
   - Update the first-line path comment to match the new file location.

2. Imports:
   - Delete `import { jest } from '@jest/globals';` (use the global `vi`).
   - `./jestutils/jestSetupTest.js` exports (`setupTest`, `loggerLogSpy`, other spies, `setDebug`) → import from `@matterbridge/vitest-utils`.
   - `./jestutils/jestMatterTest.js` and `./jestutils/jestMatterbridgeTest.js` exports → import from `@matterbridge/vitest-utils/matter` (`addDevice`, `deleteDevice`, `aggregator`, `server`, `createTestEnvironment`, `destroyTestEnvironment`, `createServerNode`, `startServerNode`, `stopServerNode`, `flushServerNode`, `getMatterbridge`, `addMatterbridge`, ...).
   - Source-under-test imports change from `./foo.js` to `../src/foo.js`.
   - Delete `Endpoint`/`ServerNode`/`AggregatorEndpoint` imports if they were only used to type local `server`/`aggregator` variables — those are now imported live bindings from `@matterbridge/vitest-utils/matter`.
   - Keep ESLint import group ordering: node builtins, externals (including `@matterbridge/vitest-utils*`), then relative `../src/...`.

3. Matter environment lifecycle — replace the Jest pattern:

   ```ts
   beforeAll(async () => {
     await createMatterbridgeEnvironment();
     [server, aggregator] = await startMatterbridgeEnvironment(MATTER_PORT, MATTER_CREATE_ONLY);
   }, 30000);

   afterAll(async () => {
     await stopMatterbridgeEnvironment(MATTER_CREATE_ONLY);
     await destroyMatterbridgeEnvironment();
     jest.restoreAllMocks();
   }, 30000);
   ```

   with the Vitest pattern (no local `server`/`aggregator` declarations):

   ```ts
   beforeAll(async () => {
     // Setup the Matter test environment
     await createTestEnvironment();

     // Create the server node and aggregator
     await createServerNode(MATTER_PORT);

     // Start the server node if not in create-only mode
     if (!MATTER_CREATE_ONLY) await startServerNode();
   }, 30000);

   afterAll(async () => {
     // Stop or flush the server node depending on the create-only mode
     if (MATTER_CREATE_ONLY) await flushServerNode();
     else await stopServerNode();

     // Destroy the Matter test environment
     await destroyTestEnvironment();

     // Restore all mocks
     vi.restoreAllMocks();
   }, 30000);
   ```

   Tests that don't use a Matter server node keep just `await setupTest(NAME, false);` and skip the lifecycle entirely.

4. Mock API renames:
   - `jest.clearAllMocks()` → `vi.clearAllMocks()` (keep the `beforeEach` — the config has `clearMocks: false`).
   - `jest.restoreAllMocks()` → `vi.restoreAllMocks()` (config has `restoreMocks: false`).
   - `jest.spyOn(...)` → `vi.spyOn(...)`, `jest.fn()` → `vi.fn()`.
   - `jest.unstable_mockModule('mod', factory)` + dynamic `import()` → `vi.mock('mod', factory)` (hoisted; static imports work) or `vi.doMock` + dynamic import for the unhoisted equivalent.
   - Types: `jest.Mock` / `jest.SpiedFunction` → `Mock` / `MockInstance` imported type-only from `'vitest'`.

5. Validate:
   - Typecheck uses the root [tsconfig.json](../../tsconfig.json) (includes `**/vitest/**/*.test.ts`).
   - Run the single file from the repo root: `npm run test -- packages/core/vitest/foo.test.ts`.
   - Coverage variant: `npm run test:coverage -- packages/core/vitest/foo.test.ts`.
   - Run the whole converted file, not isolated tests — these are multi-step flow suites.

Final checklist:

- File under `packages/<pkg>/vitest/`, source imports use `../src/`.
- No `@jest/globals`, no `jest.` references, no `path`/`HOMEDIR`/`process.argv` boilerplate left.
- No `import { describe, ... } from 'vitest'` (globals are on); type-only vitest imports are fine.
- `server`/`aggregator` come from `@matterbridge/vitest-utils/matter`, not local variables.
- Unique `MATTER_PORT`; timeouts preserved; test bodies untouched.
- `npm run test:vitest -- <file>` passes.
