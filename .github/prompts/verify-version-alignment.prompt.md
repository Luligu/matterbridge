---
name: "Verify Version Alignment"
description: "Verify that package, Docker build, core Jest helper, and Docker workflow tags match the expected root version rules"
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
- Verify the Docker workflow release tags in [docker-buildx-s6-rc.yml](../workflows/docker-buildx-s6-rc.yml) and [docker-buildx-s6-rc-legacy.yml](../workflows/docker-buildx-s6-rc-legacy.yml) are coherent.
- Treat the tag format as `year.month.number`, not a calendar day, for example `2026.4.3` and `2026.4.3-legacy`.
- Treat the tags as coherent only when the legacy tag is exactly the non-legacy tag plus the `-legacy` suffix.
- If the prompt run includes a user-provided expected release tag, verify the non-legacy workflow tag matches that `year.month.number` value and verify the legacy workflow tag matches that same value plus the `-legacy` suffix.

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
- [docker-buildx-s6-rc.yml](../workflows/docker-buildx-s6-rc.yml)
- [docker-buildx-s6-rc-legacy.yml](../workflows/docker-buildx-s6-rc-legacy.yml)
