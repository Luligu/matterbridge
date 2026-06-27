# Matterbridge Claude Instructions (v.1.0.1)

- Follow [STYLEGUIDE.md](./STYLEGUIDE.md) for code style, naming, JSDoc, validation, logging, and formatting expectations.
- JSDoc requirements are enforced by the configured linter. Treat missing or incomplete JSDoc on required APIs as a real lint issue, not optional documentation.
- Import and export ordering are enforced by the formatter. Preserve the existing grouped and sorted order unless a change requires updating it.
- Formatting is enforced by oxfmt. Follow the existing formatting and do not fight the formatter.
- Keep changes minimal and scoped to the request. Avoid unrelated refactors or broad cleanup.
- Do not modify production code only to make a test pass. If a failing test points to a likely source issue, explain the issue and change behavior only when required by the task.
- Preserve cross-platform behavior. Changes must work on Windows, macOS, and Linux, especially for paths, shell commands, environment variables, and networking behavior.
- Maintain compatibility with the supported Node.js versions in this repository: 20.19, 22.13, 24.0 and 26.0.
- This repository uses TypeScript and ESM. Follow existing project patterns for imports, exports, build configuration, and test setup.
- Prefer the existing npm scripts in [package.json](./package.json) and the VS Code tasks in [tasks.json](./.vscode/tasks.json) for building, linting, and testing.
- Keep tests deterministic and simple. Prefer small data sets and straightforward setup.
- Some tests are intentionally multi-step flows. State may persist across successive steps within a single test flow, but each test unit must remain isolated from other tests.
- For validation, run the relevant full test file or the matching suite/task for the touched area rather than assuming arbitrary isolated single-test execution is reliable.
- When behavior changes, update the relevant tests and documentation.
- Use dedicated instruction files under [.claude/rules](.claude/rules/) when a rule applies only to specific file types or workflows.
- The full Matter 1.5.1 specifications are available locally as HTML files under [chip/1.5.1/specs](../chip/1.5.1/specs/). Treat those HTML specs as the authoritative source when working on Matter behavior, revisions, qualities, device types, and cluster definitions.
- The full Matter 1.4.2 specifications are also available locally as HTML files under [chip/1.4.2/specs](../chip/1.4.2/specs/). Use those HTML specs for historical comparisons and delta analysis against Matter 1.5.1, but keep 1.5.1 as the authoritative source.
