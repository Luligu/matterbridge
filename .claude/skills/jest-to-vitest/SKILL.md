---
name: jest-to-vitest
description: Transform a Jest test file from packages/<pkg>/src into a Vitest test file under packages/<pkg>/vitest, following the Matterbridge migration pattern (vitest-utils package, vi globals, new Matter server lifecycle). Use when asked to migrate, convert, or transform a Jest test to Vitest.
---

# Transform a Jest test into a Vitest test

Migrate a Jest test file (e.g. `packages/core/src/foo.test.ts`) into a Vitest test file (`packages/core/vitest/foo.test.ts`). The reference pair for this transformation is `packages/core/src/matterbridgeFactory.test.ts` (Jest) vs `packages/core/vitest/matterbridgeFactory.test.ts` (Vitest) — when in doubt, diff those two files.

## Ground rules

- Create the new file under `packages/<pkg>/vitest/`. The root `vite.config.ts` only picks up `**/vitest/**/*.{spec,test}.{ts,mts,cts}`. Do NOT delete the Jest original unless explicitly asked.
- Test bodies, assertions, `describe`/`test` names, `MATTER_PORT`, `MATTER_CREATE_ONLY`, and hook timeouts (e.g. `30000`) stay unchanged. Only the harness around them changes.
- Each test file must keep a unique `MATTER_PORT`. If creating a brand-new file, pick an unused port (check existing tests).
- Vitest runs with `globals: true`: `describe`, `test`, `expect`, `beforeAll`, `beforeEach`, `afterAll`, and `vi` are globals. Do not import them from `'vitest'` and do not import `'@jest/globals'`.

## Step-by-step transformation

### 1. Header block

Remove the Jest-only boilerplate. `setupTest(NAME)` from `@matterbridge/vitest-utils` sets `HOMEDIR` (to `.cache/vitest/<NAME>`) and `process.argv` itself.

```ts
// Jest (remove)
const HOMEDIR = path.join('.cache', 'jest', NAME);
process.argv = ['node', 'matterbridge.js', '--frontend', '0', '--port', MATTER_PORT.toString(), '--homedir', HOMEDIR, ...];
import path from 'node:path';
```

Keep only:

```ts
const NAME = 'Factory';
const MATTER_PORT = 11280;
const MATTER_CREATE_ONLY = true;
```

Update the first-line path comment to match the new file location.

### 2. Imports

| Jest | Vitest |
| --- | --- |
| `import { jest } from '@jest/globals';` | delete (use global `vi`) |
| `import { loggerLogSpy, setupTest } from './jestutils/jestSetupTest.js';` | `import { loggerLogSpy, setupTest } from '@matterbridge/vitest-utils';` |
| `import { addDevice } from './jestutils/jestMatterTest.js';` | `import { addDevice, aggregator, createServerNode, createTestEnvironment, destroyTestEnvironment, flushServerNode, startServerNode, stopServerNode } from '@matterbridge/vitest-utils/matter';` |
| `import { ... } from './jestutils/jestMatterbridgeTest.js';` | covered by `@matterbridge/vitest-utils/matter` (see lifecycle below) |
| `import { foo } from './foo.js';` (source under test) | `import { foo } from '../src/foo.js';` |
| `import { Endpoint, ServerNode } from '@matter/node';` + `AggregatorEndpoint` (only used for the local `server`/`aggregator` types) | delete — `server` and `aggregator` are imported live bindings from `@matterbridge/vitest-utils/matter` |

Other imports (`@matter/types/...`, `node-ansi-logger`, etc.) stay as-is. Keep ESLint import group ordering: node builtins, externals (including `@matterbridge/vitest-utils*`), then relative `../src/...`.

All spies (`loggerLogSpy`, `loggerDebugSpy`, `consoleLogSpy`, ...) and `setDebug` come from `@matterbridge/vitest-utils`. Matter helpers (`addDevice`, `deleteDevice`, `server`, `aggregator`, `getMatterbridge`, `addMatterbridge`, ...) come from `@matterbridge/vitest-utils/matter`.

### 3. Matter environment lifecycle

Jest pattern:

```ts
let server: ServerNode<ServerNode.RootEndpoint>;
let aggregator: Endpoint<AggregatorEndpoint>;

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

Vitest pattern (no local `server`/`aggregator` declarations — they are imported):

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

Tests that don't use a Matter server node at all keep just `setupTest(NAME, false)` and skip the lifecycle entirely.

### 4. Mock API renames

- `jest.clearAllMocks()` → `vi.clearAllMocks()` (keep the `beforeEach` — the config has `clearMocks: false`).
- `jest.restoreAllMocks()` → `vi.restoreAllMocks()` (config has `restoreMocks: false`).
- `jest.spyOn(...)` → `vi.spyOn(...)`, `jest.fn()` → `vi.fn()`.
- `jest.unstable_mockModule('mod', factory)` + dynamic `import()` → `vi.mock('mod', factory)` (hoisted; static imports work) or `vi.doMock` + dynamic import for the unhoisted equivalent.
- Types: `jest.Mock` / `jest.SpiedFunction` → `Mock` / `MockInstance` from `'vitest'` (type-only import is allowed).

### 5. Validate

- Typecheck uses the root `tsconfig.vitest.json` (includes `**/vitest/**/*.test.ts`).
- Run the single file from the repo root: `npm run test:vitest -- packages/core/vitest/foo.test.ts`
- Coverage variant: `npm run test:vitest:coverage -- packages/core/vitest/foo.test.ts`
- The whole converted file must pass, not isolated tests — these are multi-step flow suites.

## Checklist before finishing

- [ ] File under `packages/<pkg>/vitest/`, source imports use `../src/`.
- [ ] No `@jest/globals`, no `jest.` references, no `path`/`HOMEDIR`/`process.argv` boilerplate left.
- [ ] No `import { describe, ... } from 'vitest'` (globals are on); type-only vitest imports are fine.
- [ ] `server`/`aggregator` come from `@matterbridge/vitest-utils/matter`, not local variables.
- [ ] Unique `MATTER_PORT`; timeouts preserved; test bodies untouched.
- [ ] `npm run test:vitest -- <file>` passes.
