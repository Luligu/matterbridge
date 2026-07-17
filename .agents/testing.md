# Testing Standards for Unit Tests (v.1.0.0)

## 1. Test Framework

- Jest is available in the repository when the file `jest.config.js` exists.
- Vitest is available in the repository when the file `vite.config.ts` exists.
- Bun test is available in the repository when the file `bunfig.toml` exists.
- Jest tests live in `test` folders. Follow the existing convention in the repository for test file placement.
- Vitest tests live in `vitest` folders. Follow the existing convention in the repository for test file placement.
- Bun tests live in `buntest` folders. Follow the existing convention in the repository for test file placement.
- Ensure that tests are written in TypeScript and follow the ESM module format.

## 2. Test Structure

- Organize tests in file named `*.test.ts` in the `test`, `vitest`, or `buntest` folders.
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

- Run the relevant full test unit from start to finish rather than assuming isolated single-test execution is reliable.
- If only one test framework is installed, use `npm run test -- yourTest.test.ts` or `npm run test:coverage -- yourTest.test.ts` when the touched area can be validated by running the full relevant test file.
- When both Jest and Vitest are installed, use `npm run test -- yourTest.test.ts` for Jest or `npm run test:vitest -- yourTest.test.ts` for Vitest.
- When Bun test is installed, use `bun test yourTest.test.ts`.
- Use the existing `tasks.json` test tasks for areas that require grouped test files, custom coverage targets, or custom ignore-pattern handling.
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
