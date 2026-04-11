---
description: 'Testing standards for unit tests in the project.'
paths: ['packages/**/*.test.ts']
---

# Testing Standards for Unit Tests

## 1. Test Framework

- Use Jest (with ts-jest) as the testing framework for all unit tests.
- Ensure that tests are written in TypeScript and follow the ESM module format.

## 2. Test Structure

- Organize tests in file name `*.test.ts` adjacent to the code being tested.
- Use `describe` blocks to group related tests and `test` blocks for individual test cases.

## 3. Test Naming

- Use descriptive test names that clearly indicate the behavior being tested.
- Follow the format: `should [expected behavior] when [condition]`.

## 4. Test Data

- Use small, deterministic test data to ensure tests are reliable and easy to understand.

## 5. Test Coverage

- Aim for high test coverage, but prioritize meaningful tests over achieving 100% coverage.

## 6. Mocking

- Use `jest.unstable_mockModule` for mocking dependencies in ESM modules.
- Avoid using `jest.mock` as it is not compatible with ESM modules.

## 7. Running Tests

- Run the relevant full test unit from start to finish rather than assuming isolated single-test execution is reliable.
- Use `npm run test -- yourTest.test.ts` or `npm run test:coverage -- yourTest.test.ts` when the touched area can be validated by running the full relevant test file.
- Use the existing `tasks.json` test tasks for areas that require grouped test files, custom coverage targets, or custom ignore-pattern handling.
- Avoid running all tests unnecessarily to save time during development.

## 8. Test Assertions

- Use appropriate Jest matchers for assertions (e.g., `toBe`, `toEqual`, `toThrow`).
- Ensure that assertions are clear and directly related to the behavior being tested.

## 9. Performance

- Avoid optimization in tests; focus on correctness and clarity.
- Use simple loops and structures in tests to maintain readability and performance.
- Avoid complex setups that may slow down test execution unless necessary for the behavior being tested.
- Prefer simple test cases that are easy to understand and maintain over complex ones that may be difficult to debug.
- Some tests in this repo are intentionally structured as multi-step flows, where state persists across successive steps within a single test unit. Run those test units in full, and keep each test unit isolated from other test units.
