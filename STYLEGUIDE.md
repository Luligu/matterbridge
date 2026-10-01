# Style Guide (v.1.1.0)

Concise rules the codebase and all agent suggestions should follow.

## 1. General Principles

- Prefer clarity over brevity; explicit names, no ambiguous abbreviations.
- All exported functions/classes/interfaces: full JSDoc.
- Validate external inputs; never trust parameters coming from device/network events. In Matterbridge and its plugins, use the matterbridge `isValid...` functions.
- Fail fast with descriptive Error messages; return early on invalid input.
- Keep functions focused (single responsibility, <= ~40 lines ideally).

## 2. TypeScript Conventions

- Use `strict` typing; no `any` unless justified: `// oxlint-disable-next-line typescript/no-explicit-any -- reason`.
- Prefer readonly (`readonly` or `as const`) for constant structures / lookup tables.
- Narrow types with guards instead of type assertions. Avoid `as X` unless unavoidable.
- Prefer enums / literal unions over magic numbers. Map protocol constants in lookup arrays. Never use `const enum` (lint error).

## 3. Naming

- Functions: verb or verb phrase (`createDevice`, `updateState`).
- Booleans: prefix with `is/has/can/should`.
- Prefix a variable or parameter with `_` only when it is intentionally unused (the linter ignores it and reports it once used); otherwise use it or remove it.
- Constants: `UPPER_SNAKE_CASE` only for process env or true constants; otherwise camelCase.

## 4. JSDoc Template

For every public/exported function or public methods (and important internal helpers):

```jsdoc
/**
 * One-line summary (starts with a verb, ends without period if short)
 *
 * Longer description (optional) explaining rationale or algorithm. Mention spec refs if relevant.
 *
 * Edge cases:
 *  - bullet 1
 *  - bullet 2
 *
 * @param {Type} name Description (units, accepted range, behavior on bounds)
 * @returns {Type} Description (units, range, side effects)
 * @throws {ErrorType} When it is thrown (only if the function throws)
 */
```

Rules:

- Always include `@param` and `@returns` with explicit types and descriptions (even if TS can infer): the linter requires them.
- Add `@throws` with its type and description for every error the function throws on purpose.
- Document units (e.g. `°C * 100`, `lux`, `mireds`, `Pa`).
- List clamping and fallback behaviors under Edge cases.
- If returning Promise, use `@returns {Promise<Type>}`.

## 5. Error Handling & Validation

- Reject invalid numeric input: use `Number.isFinite(n)`; clamp with `Math.min/Math.max`.
- Throw only for programmer/config errors; not for transient states.
- In Matterbridge and its plugins:
  - When decoding device values, guard against null/undefined before math.
  - Prefer returning 0 / empty array for non-critical sensor errors, log at debug level.

## 6. Logging

In Matterbridge and its plugins the logger is always AnsiLogger.

- Use `log.debug` for verbose internal transitions.
- Use `log.info` for state changes & received commands.
- Use `log.notice` for notices.
- Use `log.warn` for recoverable anomalies (out-of-range adjusted, missing optional attribute).
- Use `log.error` only for failed operations that stop progress.
- Use `log.fatal` only for failed operations that are not recoverable.
- Avoid duplicate logs inside tight intervals; coalesce if needed.

## 7. Formatting & Lint

- The installed linter (oxlint) and formatter (oxfmt) govern style; do not fight the formatter. VS Code formats with oxfmt and applies the oxlint fixes on save.
- The default tabWidth is 2 not 4.
- No trailing spaces; the formatter sorts imports in groups separated by a blank line: side effects, Node.js built-ins (`node:` prefix), external packages, internal and subpath imports, relative imports, styles.
- Import types inline: `import { type Foo, bar } from './bar.js'`.
- Use trailing commas where multi-line.

## 8. Tests

- Add at least one test per new helper function (happy path + one edge case).
- Use explicit test names describing behavior (`converts 100 lux to encoded value`).
- Keep test data small and deterministic.

## 9. Performance

- Avoid premature optimization; micro-opt only with measurable hotspot proof.
- Prefer simple loops over complex chaining when in per-tick update paths.

## 10. Agents

- Every coding agent (Codex, Claude Code, GitHub Copilot, Gemini / Antigravity) loads [AGENTS.md](AGENTS.md), which points here: keep the shared agent instructions there and the code style here.

## 11. File Header Blocks

Every source and test file starts with a JSDoc header block, before anything else except a shebang.

- Tag order: `@file`, `@description`, `@author`, `@created`, `@version`, `@license`. `@file` is the path relative to the repository root, with forward slashes (`@file src/module.ts`).
- Then a blank line, the `Copyright <years> <owner>.` line (add the current year when missing, never remove a year) and the license text.
- After the block: one empty line, the file-level `/* oxlint-disable rule */` comments (one rule per line), one empty line, then the code.
- Test files use a short header with only `@file`, `@description` and `@author`.
- Keep the existing license header exactly; update `@version` only on functional changes, not style edits.

## 12. Deprecation

- Mark deprecated APIs with `@deprecated` tag explaining alternative and planned removal version.

## 13. Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). The full rules are in [.github/commit-message-instructions.md](.github/commit-message-instructions.md).

- First line: `<type>(<optional scope>): <subject>`, with type one of `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Imperative, lower case first line; no period.

## 14. Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

- Every behavior change gets an entry in `CHANGELOG.md` under the current `## [x.y.z] - Dev branch` heading.
- Group entries under `### Added`, `### Changed`, `### Deprecated`, `### Removed`, `### Fixed` or `### Security`.
- One short line per change: `- [scope]: Description.`

## 15. Example (Reference)

```ts
/**
 * Convert lux to the Matter encoded illuminance value
 *
 * Matter spec § 2.2.5.1: MeasuredValue = 10,000 x log10(illuminance) + 1, in the range 1 to 0xFFFE.
 *
 * Edge cases:
 *  - < 1 or non-finite -> 0 (too low to be measured)
 *  - Caps at 0xFFFE
 *
 * @param {number} lux Illuminance in lux (>= 0).
 * @returns {number} Encoded value (0, or 1..0xFFFE)
 */
function luxToMatterExample(lux: number): number {
  if (!Number.isFinite(lux) || lux < 1) return 0;
  return Math.min(Math.round(10000 * Math.log10(lux) + 1), 0xfffe);
}
```

Short, opinionated. If a rule isn't helping, propose a PR to adjust.
