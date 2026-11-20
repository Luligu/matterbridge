---
name: verify-version-alignment
description: Verify that package, Docker build, test utility helper, docs update JSON files, and Docker workflow tags match the expected root version rules. v.1.0.5
---

# Verify that package, Docker build, test utility helper, docs update JSON files, and Docker workflow tags match the expected root version rules

Verify version alignment in this repository using [package.json](../../../package.json) and [docker-buildx-s6-rc.yml](../../../.github/workflows/docker-buildx-s6-rc.yml) as the default sources of truth, or user-provided parameters when specified.

Parameters and modes:

- **Default (no parameters passed)**: take the expected Matterbridge version from `version` in root [package.json](../../../package.json), and take the expected app (Docker release tag) version from [docker-buildx-s6-rc.yml](../../../.github/workflows/docker-buildx-s6-rc.yml) (`luligu/matterbridge:<year.month.number>`).
- **With parameters**: when the user passes a Matterbridge version (e.g., `3.11.4`) and/or an app version (e.g., `2026.11.3`), use the passed value(s) as the expected target(s), falling back to root [package.json](../../../package.json) or [docker-buildx-s6-rc.yml](../../../.github/workflows/docker-buildx-s6-rc.yml) for any omitted parameter.
- **Verify vs. execute**:
  - Without an explicit request to execute/fix/align, only verify and report mismatches without modifying any files.
  - When the user asks to **execute** (or fix/align), perform the alignment across all target files using the resolved target versions (from the passed parameters, or the default sources if omitted).

Execution rules:

- Do not run repository scripts or automation scripts for this verification.
- Perform the check manually by reading and comparing file contents directly.
- After applying any fix, re-read the affected files from disk and report the final on-disk values.

Checks:

- Read the root version from [package.json](../../../package.json).
- Verify every real workspace package under [packages](../../../packages) and [apps/frontend](../../../apps/frontend) has the same `version` as the root package version.
- Ignore mock plugin manifests under `packages/core/src/mock/**` unless explicitly asked for them.
- Verify all `@matterbridge/*` entries in the root [package.json](../../../package.json) `dependencies` block are pinned to the root package version.
- Verify all `@matterbridge/*` entries in the `dependencies` and `devDependencies` blocks of every real workspace package are pinned to the root package version.
- Verify [.dockerbuild.json](../../../.dockerbuild.json) has a `version` field equal to the root package version.
- Verify [packages/test-utils/src/jest/matterTest.ts](../../../packages/test-utils/src/jest/matterTest.ts), [packages/test-utils/src/vitest/matterTest.ts](../../../packages/test-utils/src/vitest/matterTest.ts), and [packages/test-utils/src/buntest/matterTest.ts](../../../packages/test-utils/src/buntest/matterTest.ts) set, in both `getMatterbridge()` and `getSharedMatterbridge()`, `matterbridgeVersion`, `matterbridgeLatestVersion` and `matterbridgeDevVersion` to the root package version, and `frontendVersion` to the [apps/frontend/package.json](../../../apps/frontend/package.json) version.
- Verify [docs/main_update.json](../../../docs/main_update.json) and [docs/dev_update.json](../../../docs/dev_update.json) have `latest` equal to the root package version.
- Verify [docs/main_update.json](../../../docs/main_update.json) and [docs/dev_update.json](../../../docs/dev_update.json) have a `dev` value whose version prefix matches the root package version, preserving the existing `-dev-...` suffix format.
- Verify the `engines.node` field in every real workspace package under [packages](../../../packages) and [apps/frontend](../../../apps/frontend) is identical to the `engines.node` field in the root [package.json](../../../package.json).
- Verify the Docker workflow release tags in [docker-buildx-s6-rc.yml](../../../.github/workflows/docker-buildx-s6-rc.yml) and [docker-buildx-s6-rc-legacy.yml](../../../.github/workflows/docker-buildx-s6-rc-legacy.yml) are coherent.
- Verify the `docker:run:hub:s6-rc:tag`, `docker:buildx:hub:s6-rc`, `docker:run:hub:s6-rc-legacy:tag`, and `docker:buildx:hub:s6-rc-legacy` scripts in [package.json](../../../package.json) use the expected app release tag and its `-legacy` suffix.
- Treat the tag format as `year.month.number`, not a calendar day, for example `2026.4.3` and `2026.4.3-legacy`.
- Treat the tags as coherent only when the legacy tag is exactly the non-legacy tag plus the `-legacy` suffix.
- When verifying against a passed app release tag (or the tag from [docker-buildx-s6-rc.yml](../../../.github/workflows/docker-buildx-s6-rc.yml)), verify the non-legacy workflow tag matches that `year.month.number` value and the legacy workflow tag matches that same value plus the `-legacy` suffix.

If explicitly asked to execute or fix the alignment:

- Update `version` in root [package.json](../../../package.json), `version` in every real workspace `package.json` under [packages](../../../packages) and [apps/frontend](../../../apps/frontend), all `@matterbridge/*` entries in root and workspace `dependencies`/`devDependencies`, and `version` in [.dockerbuild.json](../../../.dockerbuild.json) to the target Matterbridge version.
- Update [docs/main_update.json](../../../docs/main_update.json) and [docs/dev_update.json](../../../docs/dev_update.json) too.
- Set each file's `latest` field to the target Matterbridge version.
- Update each file's `dev` field so its version prefix matches the target Matterbridge version while preserving the existing `-dev-...` suffix.
- Advance `latestDate` and `devDate` by 1 week from their current values, preserving the `YYYY-MM-DD` format.
- Update `docker:run:hub:s6-rc:tag` and `docker:buildx:hub:s6-rc` in [package.json](../../../package.json) and the tag in [docker-buildx-s6-rc.yml](../../../.github/workflows/docker-buildx-s6-rc.yml) to use the target app release tag.
- Update `docker:run:hub:s6-rc-legacy:tag` and `docker:buildx:hub:s6-rc-legacy` in [package.json](../../../package.json) and the tag in [docker-buildx-s6-rc-legacy.yml](../../../.github/workflows/docker-buildx-s6-rc-legacy.yml) to use the target app release tag with the `-legacy` suffix.
- Update `matterbridgeVersion`, `matterbridgeLatestVersion`, `matterbridgeDevVersion` and `frontendVersion` in both `getMatterbridge()` and `getSharedMatterbridge()` of the test utility helpers to the target Matterbridge version.

Output requirements:

- Report the root package version first.
- List every mismatch with the current value and expected value.
- If everything matches, say that explicitly.
- Use concise file references for every mismatch.
- If the workflow release tags are not coherent, report both tag values and ask whether they should be aligned before making changes.
- If the user provided an expected release tag and the workflow tags do not match it, report the expected `year.month.number` values and ask whether they should be updated.
- Do not modify files unless explicitly asked to fix them.
- If fixes were applied, include a post-fix verification section that confirms the updated values read from disk.

Suggested search targets:

- [package.json](../../../package.json) — version, dependencies, scripts, engines
- [apps/frontend/package.json](../../../apps/frontend/package.json)
- [packages](../../../packages)
- [packages/test-utils/package.json](../../../packages/test-utils/package.json)
- [.dockerbuild.json](../../../.dockerbuild.json)
- [packages/test-utils/src/jest/matterTest.ts](../../../packages/test-utils/src/jest/matterTest.ts)
- [packages/test-utils/src/vitest/matterTest.ts](../../../packages/test-utils/src/vitest/matterTest.ts)
- [packages/test-utils/src/buntest/matterTest.ts](../../../packages/test-utils/src/buntest/matterTest.ts)
- [docs/main_update.json](../../../docs/main_update.json)
- [docs/dev_update.json](../../../docs/dev_update.json)
- [docker-buildx-s6-rc.yml](../../../.github/workflows/docker-buildx-s6-rc.yml)
- [docker-buildx-s6-rc-legacy.yml](../../../.github/workflows/docker-buildx-s6-rc-legacy.yml)
