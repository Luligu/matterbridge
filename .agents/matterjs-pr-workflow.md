# Open a PR against matter.js from the local fork

Use this when a change belongs upstream in matter.js rather than in matterbridge — a bug fix found while working
in matterbridge (e.g. during [verify-server-endpoint-context](./verify-server-endpoint-context.md), or any other
investigation), or a new feature/enhancement the user wants added to matter.js directly.

Fork location: `../matter.js` (sibling of the matterbridge repo). Remotes:

- `origin` → `https://github.com/Luligu/matter.js.git` (the user's fork — push here, never to upstream)
- `upstream` → `https://github.com/matter-js/matter.js.git` (read-only, the real project)

## 1. Sync the fork

```bash
git -C ../matter.js fetch upstream
git -C ../matter.js fetch origin
git -C ../matter.js merge --ff-only upstream/main   # run from a clean main; fails loudly if origin/main has diverged
git -C ../matter.js push origin main
```

If the fast-forward fails, stop and reconcile with the user rather than force-pushing.

## 2. Rebuild

```bash
cd ../matter.js && npm install   # triggers the `prepare` script (build-clean) if deps changed
npm run build                    # full monorepo build (nacho-build); should report all packages "Up to date"
```

## 3. Create the branch

```bash
git -C ../matter.js checkout -b fix/<short-description> main       # bug fix
git -C ../matter.js checkout -b feat/<short-description> main      # new feature or enhancement
```

Branch from the freshly synced `main`, not from whatever branch happened to be checked out before.

## 4. Implement the change

- Keep the change minimal and scoped to the actual request. For a bug fix, that means only the lines needed to
  correct the behavior — no incidental refactors. For a feature/enhancement, that means the smallest coherent
  implementation of what was asked, not a broader redesign of the surrounding code.
- Match the target file's existing comment/casting conventions (matter.js source files do **not** use the
  `Matter 1.6.0 § x.y.z` comment style that matterbridge's own CLAUDE.md mandates — that's a matterbridge-only
  convention). Plain, spec-referencing comments (e.g. `// Per § 5.2.10.21.1, ...`) match existing matter.js style.
- Cite the authoritative spec text from `chip/1.6.0/specs/*.html` in the matterbridge repo when verifying the
  correct behavior, the correct field/attribute semantics, or that a new feature matches how the spec actually
  defines it — don't guess status codes, constraint bounds, or field semantics either way.

## 5. Check for and add tests

matter.js does not always have coverage for the behavior server you're touching. Before assuming a test exists:

```bash
grep -rl "<ClassOrMethodName>" ../matter.js/packages/node/test ../matter.js/support/chip-testing/test 2>/dev/null
```

If nothing turns up, add a test under `packages/node/test/behaviors/<cluster-name>/<Name>ServerTest.ts`, following
an existing sibling test file for conventions:

- Simple event/attribute behavior → model after `test/behaviors/boolean-state/BooleanStateServerTest.ts`
  (`MockServerNode.createOnline()` + `node.add(Device, state)`).
- Feature-gated behavior needing non-default features → model after
  `test/behaviors/window-covering/WindowCoveringServerTest.ts` or
  `test/behaviors/color-control/ColorControlServerTest.ts` (`SomeServer.with("Feature1", "Feature2")`,
  `MockEndpoint.createWith(...)` or `MockServerNode.createOnline(undefined, { device: undefined })` +
  `node.add(CustomDevice, state)`).
- To invoke a command and inspect its response, use `node.online({}, async agent => { ... })` (NOT a bare
  `endpoint.act`) so `context.fabric` resolves to `FabricIndex.NO_FABRIC` instead of `undefined` — behaviors that
  read `this.context.fabric` (e.g. most DoorLock commands) throw `UnsupportedAccess` otherwise. Get the
  endpoint-scoped agent via `endpoint.agentFor(agent.context)`, then call `agent.<behaviorId>.<command>(request)`.
- Mandatory (`M` conformance) attributes without defaults must be supplied in the initial state passed to
  `node.add(...)` or endpoint construction fails during `initialize()` with a conformance/constraint validation
  error naming the exact attribute — read the error and add that attribute; don't guess the whole set up front.
- Prefer seeding minimal existing state (e.g. a pre-existing user/record) over exercising a command's
  object-creation side path if that path has its own unrelated bugs that would otherwise block the test.

Run just the new test file first:

```bash
cd ../matter.js/packages/node && npx matter-test esm --spec test/behaviors/<cluster-name>/<Name>ServerTest.ts
```

## 6. Prove the test actually exercises the change

Temporarily revert or comment out only the change (Edit tool, not git, so you don't lose the diff), rerun the
test and confirm it fails — for a bug fix, with the expected wrong value; for a new feature, because the
behavior it checks doesn't exist yet. Then reapply the change and confirm the test passes again:

```bash
# revert/remove the change with Edit, then:
npx matter-test esm --spec test/behaviors/<cluster-name>/<Name>ServerTest.ts   # must fail
# reapply the change with Edit, then:
npx matter-test esm --spec test/behaviors/<cluster-name>/<Name>ServerTest.ts   # must pass
```

Skipping this step means the test might be passing for the wrong reason (or passing regardless of whether the
change exists at all).

## 7. Run the broader test suite

```bash
cd ../matter.js/packages/node && npx matter-test esm
```

Large suites (1000+ tests) commonly have a handful of pre-existing, unrelated flaky failures (timing/mDNS/session
mocks). Check the failing test names — if they're unrelated to the touched cluster/behavior, note them as
pre-existing rather than chasing them. Do not silently ignore a failure in the same area you touched.

## 8. Format and lint — do this BEFORE committing

The `check-and-lint` CI job runs both `oxfmt --check` and `oxlint`, and fails the PR on either — including a plain
manual edit that doesn't match oxfmt's line-wrapping rules (e.g. a long single-line `return { ... }` that oxfmt
wants multi-line). Run both on every file you touched, before the first commit, not after CI catches it:

```bash
cd ../matter.js && npm run format          # oxfmt, rewrites in place
npm run format-verify                      # oxfmt --check; must report "All matched files use the correct format"
npm run lint                               # oxlint --type-aware; must report no errors
```

If lint reports fixable issues, `npm run lint-fix` applies them in place — re-run `npm run lint` afterward to
confirm nothing remains, and read any issue it can't auto-fix rather than suppressing it.

Then rerun the affected test file once more to confirm formatting/lint fixes didn't change behavior (they
shouldn't, but verify anyway).

## 9. Full build

```bash
cd ../matter.js && npm run build
```

Should report all packages "Up to date" with no type-check errors.

## 10. Commit

Match the existing commit style (`git -C ../matter.js log --oneline -15` to check current convention — this repo
mixes plain descriptive subjects and Conventional Commits like `fix(node): ...`, `test(node): ...`,
`style: ...`). Stage only the intended files explicitly (never `git add -A`):

```bash
git -C ../matter.js add <changed-source-file> <new-test-file>
git -C ../matter.js status --short   # confirm nothing unintended is staged
git -C ../matter.js commit -m "$(cat <<'EOF'
fix(node): <short description>

<why, with the spec paragraph citation if applicable>
EOF
)"
```

For a new feature/enhancement, use `feat(node): <short description>` as the subject instead, with a body
explaining what it adds and, where relevant, the spec paragraph it implements.

## 11. Push

```bash
git -C ../matter.js push origin <fix-or-feat>/<short-description>
```

Never push to `upstream`. This is an action visible outside the local environment — confirm with the user before
pushing unless they've already asked for it in this conversation.

## 12. Open the PR

Draft title + body and show the user for approval before running `gh pr create` (opening a PR against an external
repo is a visible, hard-to-fully-reverse action). Target `matter-js/matter.js:main` from
`Luligu:<fix-or-feat>/<short-description>`:

```bash
gh pr create --repo matter-js/matter.js --base main --head Luligu:<fix-or-feat>/<short-description> \
  --title "..." --body "$(cat <<'EOF'
## Summary
- ...

## Test plan
- [x] New/updated test fails without the change and passes with it
- [x] `npm run format-verify` and `npm run lint` clean
- [x] `npm run build` clean
- [x] Full package test suite run; no regressions attributable to this change
EOF
)"
```

Mention any out-of-scope issues found along the way (e.g. an unrelated bug the test had to work around) in a
"Note for maintainers" section rather than silently fixing or silently ignoring them.

## 13. Verify CI

```bash
gh pr checks <PR#> --repo matter-js/matter.js
```

Watch `check-and-lint` specifically first (fastest, most likely to fail on formatting or lint). If it fails on
either again, repeat step 8, commit as a separate `style:` commit, push, and re-check — don't bundle a post-hoc
format/lint fix into the original commit once it's already pushed and under review.

```bash
gh run view <run-id> --repo matter-js/matter.js --job <job-id> --log | grep -iE "error|format|lint|fail"
```

to pull the exact failure when a check fails.
