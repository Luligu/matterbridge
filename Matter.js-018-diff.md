# Matter.js 0.18 migration: differences from dev

This document summarizes the changes carried by `matter018` beyond `dev`, as a checklist for preparing a future development branch based on matter.js 0.18.0.

## Comparison baseline

- Compared on October 15, 2026.
- `dev`: `dcbcee78`, using matter.js `0.17.9`.
- `matter018`: `0a8e6efd`, plus the strict-validation test fixes and camera initialization changes in the working tree when this document was written.
- Migration dependency: `0.18.0-alpha.0-20261015-9c1725759`. This is a dev snapshot, not the final 0.18.0 release.
- `matter018` contains every commit on this `dev` baseline. The table describes net file differences, not all commits listed by `dev..matter018`.

For the detailed audit, specification references and resolved upstream issues, see [Matter.js-0.18.md](Matter.js-0.18.md).

## Migration differences to preserve

| Area                                      | What matter018 adds or changes                                                                                                                                                                                                                                                                                                                                          | Main references                                                                                                                                                                                                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| matter.js dependency                      | Moves from `0.17.9` to the 0.18 dev snapshot across the root and relevant workspace manifests, with the matching lockfile.                                                                                                                                                                                                                                              | [package.json](package.json), [package-lock.json](package-lock.json), [core manifest](packages/core/package.json)                                                                                                                                                                               |
| Matter device definitions                 | Updates device type revisions for Matter 1.6.1 and includes required Binding server clusters. Descriptor remains implicit rather than being listed in device definitions.                                                                                                                                                                                               | [matterbridgeDeviceTypes.ts](packages/core/src/matterbridgeDeviceTypes.ts), [device type tests](packages/core/vitest)                                                                                                                                                                           |
| Binding behavior mapping                  | Maps the Binding cluster ID to `MatterbridgeBindingServer`.                                                                                                                                                                                                                                                                                                             | [matterbridgeEndpointHelpers.ts](packages/core/src/matterbridgeEndpointHelpers.ts)                                                                                                                                                                                                              |
| Commodity field renames                   | Adapts `dayEntryIDs`, `dayPatternIDs` and `tariffComponentIDs` to the new `Ids` names in source, CHIP fixtures and test expectations.                                                                                                                                                                                                                                   | [electricalUtilityMeter.ts](packages/core/src/devices/electricalUtilityMeter.ts), [chipTests.ts](packages/core/src/chipTests.ts)                                                                                                                                                                |
| Open-enum compatibility                   | Widens enum members to `number` in comparisons against the new `Enum \| number` fields, retaining the enum-comparison lint rule and runtime behavior.                                                                                                                                                                                                                   | [operationalStateServer.ts](packages/core/src/behaviors/operationalStateServer.ts), [deviceEnergyManagementModeServer.ts](packages/core/src/behaviors/deviceEnergyManagementModeServer.ts), [device implementations](packages/core/src/devices), [chipTests.ts](packages/core/src/chipTests.ts) |
| Test helpers                              | Makes the existing strict validation configurable through `createTestEnvironment(validation: 'off' \| 'warn' \| 'strict' = 'strict')`; dev already sets strict mode but has no parameter. Adds `addBridgedNode()` and automatic bridging for devices added to an aggregator in strict mode.                                                                             | [Vitest helper](packages/test-utils/src/vitest/matterTest.ts), [Bun helper](packages/test-utils/src/buntest/matterTest.ts), [Jest helper](packages/test-utils/src/jest/matterTest.ts)                                                                                                           |
| Strict-validation fixtures and snapshots  | Makes device fixtures conform to their advertised types, updates snapshots for automatic bridging, and removes all 18 Root-condition warning-mode workarounds. Isolated behavior fixtures use Bridged Node when they deliberately omit Camera/Intercom requirements. Mode-option tests still exercise `off` and `warn`, then restore `strict` before creating a server. | [Vitest device tests](packages/core/vitest/devices), [Bun device tests](packages/core/buntest/devices), [behavior tests](packages/core/vitest/behaviors)                                                                                                                                        |
| Changed matter.js behavior expectations   | Updates door-lock event expectations, level-control On/Off coupling tests, and device/cluster revision expectations for the audited 0.18 snapshot.                                                                                                                                                                                                                      | [doorLockServer.test.ts](packages/core/vitest/behaviors/doorLockServer.test.ts), [levelControlServer.test.ts](packages/core/vitest/behaviors/levelControlServer.test.ts), [device type tests](packages/core/vitest)                                                                             |
| Unsupported camera feature initialization | Comments out four conditional Watermark/OnScreenDisplay default-stream initialization branches. Production helpers do not enable these features; allocation-command handlers are unchanged. Replaces the unsupported-feature test with supported-camera assertions and adds unsorted snapshot-capability coverage.                                                      | [cameraAvStreamManagementServer.ts](packages/core/src/behaviors/cameraAvStreamManagementServer.ts), [behavior tests](packages/core/vitest/behaviors/cameraAvStreamManagementServer.test.ts)                                                                                                     |
| Migration documentation                   | Records migration-specific changelog entries, the October 8/13/15 audit snapshots, upstream resolutions and validation results.                                                                                                                                                                                                                                         | [CHANGELOG.md](CHANGELOG.md), [Matter.js-0.18.md](Matter.js-0.18.md)                                                                                                                                                                                                                            |

## Already shared with dev

These changes are already present in both branches at the comparison baseline; they are not migration-only work to reapply:

- Device API, WebRTC/FFmpeg, Docker/runtime and frontend improvements merged from `dev`.
- Intercom Generic Switch support.
- Optional rechargeable-battery attributes.
- Production endpoint validation configured as `warn`.
- Test environment helpers configured as `strict` by default; only the ability to select another mode is migration-branch-specific.

Some commits have different identities in the two histories despite carrying equivalent changes. Use the net diff against the current `dev`, not the commit count, when deciding what still needs integration.

## Preparing the future 0.18-based dev

1. Refresh this comparison against the then-current `dev`. After a release, `dev` is recreated from squash-merged `main`, so its ancestry differs from this baseline.
2. Simulate and then integrate the current `dev` into `matter018`, preserving the migration differences above and reconciling release versions and changelog entries.
3. Verify the intended published matter.js version before replacing the alpha dependency. Update all relevant workspace manifests and the lockfile together.
4. Run build, type-check, lint, format checks, full Vitest coverage and the Bun suite before using the integrated tree as the next development baseline. Keep the configured coverage thresholds.

Watermark/OnScreenDisplay should remain unadvertised unless their feature support, including the mandatory `VideoStreamModify` and `SnapshotStreamModify` commands, is implemented and tested.

## Latest validation of the migration changes

Results from October 15, 2026, before adding this documentation file:

| Validation                           | Result                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Build, type-check, lint, format      | Passed                                                                     |
| Full root Vitest with coverage       | 3,797 tests passed across 174 files; configured coverage thresholds passed |
| Full Bun suite                       | 1,958 tests passed across 113 files                                        |
| Camera AV Stream Management coverage | 100% statements, branches, functions and lines                             |

The unchanged frontend's earlier full run passed 608 tests across 41 files, with lint, format and type-check also passing.
