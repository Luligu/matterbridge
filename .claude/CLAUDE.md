# Matterbridge Claude Instructions

- Follow [STYLEGUIDE.md](../STYLEGUIDE.md) for code style, naming, JSDoc, validation, logging, and formatting expectations.
- JSDoc requirements are enforced by ESLint. Treat missing or incomplete JSDoc on required APIs as a real lint issue, not optional documentation.
- Import and export ordering are enforced by ESLint. Preserve the existing grouped and sorted order unless a change requires updating it.
- Formatting is enforced by ESLint through the Prettier rule. Follow the existing formatting and do not fight the formatter.
- Keep changes minimal and scoped to the request. Avoid unrelated refactors or broad cleanup.
- Do not modify production code only to make a test pass. If a failing test points to a likely source issue, explain the issue and change behavior only when required by the task.
- Preserve cross-platform behavior. Changes must work on Windows, macOS, and Linux, especially for paths, shell commands, environment variables, and networking behavior.
- Maintain compatibility with the supported Node.js versions in this repository: 20, 22, and 24.
- This repository is a TypeScript ESM monorepo. Follow existing project patterns for imports, exports, build configuration, and test setup.
- Prefer the existing npm scripts in [package.json](../package.json) and the repository test/build tasks when validating changes.
- Keep tests deterministic and simple. Prefer small data sets and straightforward setup.
- Some tests are intentionally multi-step flows. State may persist across successive steps within a single test flow, but each test unit must remain isolated from other tests.
- For validation, run the relevant full test file or the matching suite/task for the touched area rather than assuming arbitrary isolated single-test execution is reliable.
- For Jest tests in this repository, use ESM-safe patterns. Prefer `jest.unstable_mockModule` over `jest.mock`.
- When behavior changes, update the relevant tests and documentation.
