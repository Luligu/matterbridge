---
name: "Verify Version Alignment"
description: "Verify that package, Docker build, core Jest helper, docs update JSON files, and Docker workflow tags match the expected root version rules"
argument-hint: "Optional scope or notes"
agent: "agent"
---

Verify version alignment in this repository using [package.json](../../package.json) as the source of truth.

Checks:

- Read the root version from [package.json](../../package.json).
- Verify every real workspace package under [packages](../../packages) has the same `version` as the root package version.
- Ignore mock plugin manifests under `packages/core/src/mock/**` unless I explicitly ask for them.
- Verify [..\.dockerbuild.json](../../.dockerbuild.json) has a `version` field equal to the root package version.
- Verify [packages/core/src/jestutils/jestHelpers.ts](../../packages/core/src/jestutils/jestHelpers.ts) sets `matterbridge.matterbridgeVersion` to the root package version.
- Verify [docs/main_update.json](../../docs/main_update.json) and [docs/dev_update.json](../../docs/dev_update.json) have `latest` equal to the root package version.
- Verify [docs/main_update.json](../../docs/main_update.json) and [docs/dev_update.json](../../docs/dev_update.json) have a `dev` value whose version prefix matches the root package version, preserving the existing `-dev-...` suffix format.
- Verify the Docker workflow release tags in [docker-buildx-s6-rc.yml](../workflows/docker-buildx-s6-rc.yml) and [docker-buildx-s6-rc-legacy.yml](../workflows/docker-buildx-s6-rc-legacy.yml) are coherent.
- Treat the tag format as `year.month.number`, not a calendar day, for example `2026.4.3` and `2026.4.3-legacy`.
- Treat the tags as coherent only when the legacy tag is exactly the non-legacy tag plus the `-legacy` suffix.
- If the prompt run includes a user-provided expected release tag, verify the non-legacy workflow tag matches that `year.month.number` value and verify the legacy workflow tag matches that same value plus the `-legacy` suffix.

If I explicitly ask you to fix the alignment:

- Update [docs/main_update.json](../../docs/main_update.json) and [docs/dev_update.json](../../docs/dev_update.json) too.
- Set each file's `latest` field to the root package version.
- Update each file's `dev` field so its version prefix matches the root package version while preserving the existing `-dev-...` suffix.
- Advance `latestDate` and `devDate` by 1 week from their current values, preserving the `YYYY-MM-DD` format.

Output requirements:

- Report the root package version first.
- List every mismatch with the current value and expected value.
- If everything matches, say that explicitly.
- Use concise file references for every mismatch.
- If the workflow release tags are not coherent, report both tag values and ask whether they should be aligned before making changes.
- If the user provided an expected release tag and the workflow tags do not match it, report the expected `year.month.number` values and ask whether they should be updated.
- Do not modify files unless I explicitly ask you to fix them.

Suggested search targets:

- [package.json](../../package.json)
- [packages](../../packages)
- [..\.dockerbuild.json](../../.dockerbuild.json)
- [packages/core/src/jestutils/jestHelpers.ts](../../packages/core/src/jestutils/jestHelpers.ts)
- [docs/main_update.json](../../docs/main_update.json)
- [docs/dev_update.json](../../docs/dev_update.json)
- [docker-buildx-s6-rc.yml](../workflows/docker-buildx-s6-rc.yml)
- [docker-buildx-s6-rc-legacy.yml](../workflows/docker-buildx-s6-rc-legacy.yml)
