---
description: 'Testing standards for unit tests in the project v.1.0.6'
---

# Testing Standards for Unit Tests

## 1. Test Framework

- Jest is available in the repository when the file `jest.config.js` exists.
- Vitest is available in the repository when the file `vitest.config.ts` exists.
- Bun test is available in the repository when the file `bunfig.toml` exists.
- Jest tests live in `test` folders. Follow the existing convention in the repository for test file placement.
- Vitest tests live in `vitest` folders. Follow the existing convention in the repository for test file placement.
- Bun test tests live in `buntest` folders. Follow the existing convention in the repository for test file placement.
- Ensure that tests are written in TypeScript and follow the ESM module format.

## 2. Test Structure

- Organize tests in file name `*.test.ts` in the `test`, `vitest`, or `buntest` folders.
- Use `describe` blocks to group related tests and `test` blocks for individual test cases.

## 3. Test Naming

- Use descriptive test names that clearly indicate the behavior being tested.
- Follow the format: `should [expected behavior] when [condition]`.

## 4. Test Data

- Use small, deterministic test data to ensure tests are reliable and easy to understand.

## 5. Test Coverage

- Aim for high test coverage, but prioritize meaningful tests over achieving 100% coverage.

## 6. Mocking with Jest

- If using Jest, use `jest.unstable_mockModule` for mocking dependencies in ESM modules.
- If using Jest, avoid using `jest.mock` as it is not compatible with ESM modules.

## 7. Running Tests

- HARD RULE: never invoke `vitest`, `bun test` (or `tsc`/`oxlint`/`oxfmt` for the typecheck/lint/format side of validation) directly, whether plain, via `npx` or via `node node_modules/...`. Always go through the matching `npm run` script or `tasks.json` task, run from the repository root (the folder of the root `package.json`).
- Run the relevant full test unit from start to finish rather than assuming isolated single-test execution is reliable.
- If only one test framework is installed, use `npm run test -- yourTest.test.ts` or `npm run test:coverage -- yourTest.test.ts` when the touched area can be validated by running the full relevant test file.
- When both Jest and Vitest are installed, use `npm run test -- yourTest.test.ts` for Jest or `npm run test:vitest -- yourTest.test.ts` for Vitest.
- When Bun test is installed, use `npm run test:bun -- yourTest.test.ts` for a file.
- Use the existing `tasks.json` test tasks for areas that require grouped test files, custom coverage targets, or custom ignore-pattern handling — this is required, not optional, when such a task exists for the touched area.
- Avoid running all tests unnecessarily to save time and tokens.

## 8. Test Assertions

- Use appropriate Jest, Vitest, or Bun test matchers for assertions (e.g., `toBe`, `toEqual`, `toThrow`).
- Ensure that assertions are clear and directly related to the behavior being tested.

## 9. Performance

- Avoid optimization in tests; focus on correctness and clarity.
- Use simple loops and structures in tests to maintain readability and performance.
- Avoid complex setups that may slow down test execution unless necessary for the behavior being tested.
- Prefer simple test cases that are easy to understand and maintain over complex ones that may be difficult to debug.
- Some tests in this repo are intentionally structured as multi-step flows, where state persists across successive steps within a single test unit. Run those test units in full, and keep each test unit isolated from other test units.

## 10. Bun Test Differences From Vitest

Check these before porting a Vitest test to `buntest` (verified on Bun 1.4.2).

- Import everything from `bun:test` (`describe`, `test`, `expect`, `vi`, `mock`, `spyOn`, `type Mock`, ...) and the helpers from `@matterbridge/test-utils/buntest/setup` instead of `/vitest/setup`. Bun's `HOMEDIR` is `.cache/bun/<name>`.
- `vi` in Bun has only: `fn`, `spyOn`, `mock` (= `mock.module`), `clearAllMocks`, `resetAllMocks`, `restoreAllMocks`, `useFakeTimers`, `useRealTimers`, `advanceTimersByTime`, `advanceTimersToNextTimer`, `runAllTimers`, `runOnlyPendingTimers`, `clearAllTimers`, `getTimerCount`, `isFakeTimers`.
- Missing from Bun's `vi`, with the replacement to use:
  - `vi.mocked(fn)`: cast with `fn as unknown as Mock<...>`.
  - `vi.waitFor(...)`: loop on `flushAsync()` from `@matterbridge/test-utils` until the condition holds.
  - `vi.hoisted` + `vi.mock` (hoisted): `await mock.module(id, factory)` at the top level, then `await import()` the module under test. For a partial mock, spread a copy of the real module taken before mocking.
  - `vi.doMock` / `vi.doUnmock` / `vi.resetModules`: `mock.module` once in `beforeAll`, import the module once, and `mock.restore()` in `afterAll`.
- `.resolves` and `.rejects` are synchronous in Bun: the matcher waits for the promise and returns `void`. Write `expect(promise).resolves.toBe(x)` without `await` (`await` there trips `typescript/await-thenable`; do not disable the rule).
- Matchers: `toEqual` / `toStrictEqual` are typed `(expected: T)`, so a partial object fails the typecheck: use `toMatchObject`. `toHaveBeenCalledOnce` works at runtime but is missing from bun-types, and `toHaveBeenCalledExactlyOnceWith` does not exist: use `toHaveBeenCalledTimes(1)` (+ `toHaveBeenCalledWith`).
- Runtime differences:
  - `fs.promises.access` resolves to `null`, not `undefined`.
  - The `ws` client is replaced by Bun's native `WebSocket`: it ignores the `ws` TLS options (use `new WebSocket(url, { tls: { ca, cert, key } })`), and a rejected upgrade gives `Expected 101 status code` without the HTTP status.
- `pathIgnorePatterns` in `bunfig.toml` decides which files `bun test` scans: a test file it matches never runs, and `npm run test:bun -- <file>` reports that the filter matched no test files.
