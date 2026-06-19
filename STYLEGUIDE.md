# Style Guide

Concise rules the codebase and coding-agent suggestions should follow.

## 1. General Principles

- Prefer clarity over brevity; explicit names, no ambiguous abbreviations.
- All exported functions/classes/interfaces: full JSDoc.
- Validate external inputs; never trust parameters coming from device/network events: use isValid... matterbridge functions.
- Fail fast with descriptive Error messages; return early on invalid input.
- Keep functions focused (single responsibility, <= ~40 lines ideally).

## 2. TypeScript Conventions

- Use `strict` typing; no `any` unless justified with a preceding comment `// intentional any: reason`.
- Prefer readonly (`readonly` or `as const`) for constant structures / lookup tables.
- Narrow types with guards instead of type assertions. Avoid `as X` unless unavoidable.
- Prefer enums / literal unions over magic numbers. Map protocol constants in lookup arrays.

## 3. Naming

- Functions: verb or verb phrase (`createDevice`, `updateState`).
- Booleans: prefix with `is/has/can/should` (internal helpers); state flags in this project may keep existing names (`intervalOnOff`).
- Private file-local helpers start with `_` only if intentionally unused yet (silencing oxlint); otherwise export or remove.
- Constants: `UPPER_SNAKE_CASE` only for process env or true constants; otherwise camelCase.

## 4. JSDoc Template

For every public/exported function or public methods (and important internal helpers):

```jsdoc
/**
 * One‑line summary (starts with a verb, ends without period if short).
 *
 * Longer description (optional) explaining rationale or algorithm. Mention spec refs if relevant.
 *
 * Edge cases:
 *  - bullet 1
 *  - bullet 2
 *
 * @param {Type} name Description (units, accepted range, behavior on bounds)
 *
 * @returns {Type} Description (units, range, side effects)
 */
```

Rules:

- Always include `@param` and `@returns` with explicit types (even if TS can infer) for consistency with lint rules.
- Document units (e.g. `°C * 100`, `lux`, `mireds`, `Pa`).
- List clamping and fallback behaviors under Edge cases.
- If returning Promise, use `@returns {Promise<Type>}`.

## 5. Error Handling & Validation

- Reject invalid numeric input: use `Number.isFinite(n)`; clamp with `Math.min/Math.max`.
- When decoding device values, guard against null/undefined before math.
- Prefer returning 0 / empty array for non‑critical sensor errors, log at debug level.
- Throw only for programmer/config errors; not for transient sensor states.

## 6. Logging

The logger is always AnsiLogger.

- Use `log.debug` for verbose internal transitions.
- Use `log.info` for state changes & received commands.
- Use `log.notice` for notices.
- Use `log.warn` for recoverable anomalies (out‑of‑range adjusted, missing optional attribute).
- Use `log.error` only for failed operations that stop progress.
- Use `log.fatal` only for failed operations that are not recoverable.
- Avoid duplicate logs inside tight intervals; coalesce if needed.

## 7. Formatting & Lint

- `oxfmt` governs formatting; do not fight the formatter. Run `npm run format` or check with `npm run format:check`.
- `oxlint` governs linting, including JSDoc, import ordering, TypeScript, Node, Promise, Unicorn, OXC, Jest, and Vitest rules. Run `npm run lint`; use `npm run lint:fix` only for focused fixes.
- The default `tabWidth` is 2, `printWidth` is 180, semicolons are required, single quotes are preferred, and multi-line trailing commas are required.
- Keep imports grouped and sorted by `oxfmt`: side-effect, builtin, external, internal/subpath, relative, style, unknown.
- Use `import type` for type-only imports. `oxlint` enforces consistent inline type imports.
- No trailing spaces; preserve LF line endings.

## 8. Typecheck & Build

- `tsgo` is the default TypeScript engine for development validation.
- Run `npm run typecheck` for no-emit type checking (`tsgo --build tsconfig.json --noEmit`).
- Run `npm run build` for the normal build (`tsgo --build tsconfig.build.json`).
- `npm run buildProduction` still uses `tsc` for the production build path.
- Keep all TypeScript ESM-compatible and compatible with supported Node.js versions: 20, 22, 24, and 26.

## 9. Tests

- Add at least one test per new helper function (happy path + one edge case).
- Use explicit test names describing behavior (`converts 100 lux to encoded value`).
- Keep test data small and deterministic.
- Tests run with Vitest. Use `npm run test` for the suite, `npm run test:coverage` for coverage, and pass a test path after `--` for targeted validation.
- Prefer the relevant full test file or matching suite/task for touched code rather than relying on arbitrary isolated single-test execution.
- Some tests are intentionally multi-step flows. State may persist across successive steps within a single flow, but each test unit must remain isolated from other tests.

## 10. Performance

- Avoid premature optimization; micro‑opt only with measurable hotspot proof.
- Prefer simple loops over complex chaining when in per‑tick update paths.

## 11. Agent Prompting Hints

Placing this file at root lets coding agents pick patterns. Reinforce by:

- Keeping 2–3 perfect exemplar functions near top of large files.
- Adding a brief `// Style: ...` comment before a series of helpers.
- Rejecting poor suggestions early so the buffer stays clean.

## 12. File Header Blocks

- Keep existing license header exactly; update `@version` only on functional changes, not style edits.

## 13. Deprecation

- Mark deprecated APIs with `@deprecated` tag explaining alternative and planned removal version.

## 14. Commit Messages (conventional subset)

- `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` prefix.
- Imperative, lower case first line; no period.

## 15. Example (Reference)

```ts
/**
 * Convert lux to Matter encoded illuminance value.
 *
 * Edge cases:
 *  - <=0 or non-finite -> 0
 *  - Caps at 0xFFFE
 *
 * @param {number} lux Illuminance in lux (>=0).
 * @returns {number} Encoded value (0..0xFFFE)
 */
function luxToMatterExample(lux: number): number {
  if (!Number.isFinite(lux) || lux <= 0) return 0;
  return Math.round(Math.min(10000 * Math.log10(lux), 0xfffe));
}
```

## 16. Creating Vitest Tests

- The repository is TypeScript ESM and uses Vitest for tests.
- Prefer `vi.mock` / `vi.spyOn` patterns used by nearby tests.
- Keep mocks explicit, reset or restore them in test cleanup, and avoid sharing mutable state across test units.

## 17. Running Tests

Always use

```shell
npm run test:coverage -- yourTest.test.ts
```

For non-coverage local validation, use:

```shell
npm run test -- yourTest.test.ts
```

## 18. Release Validation

Before publish-like changes, the repository uses:

```shell
npm run runMeBeforePublish
```

That runs formatting, linting, HTML updates, clean build, typecheck, and coverage.

---

Short, opinionated. If a rule isn’t helping, propose a PR to adjust.
