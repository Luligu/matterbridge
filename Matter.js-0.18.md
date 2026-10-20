# Matter.js 0.18.x

This file tracks the matter.js 0.18.x deltas compared with matter.js 0.17.9 that matter for Matterbridge, following [the 0.17 migration notes](Matter.js-0.17.md).

Audited dev version: `0.18.0-alpha.0-20261015-9c1725759` (npm `dev` verified on October 15, 2026). The findings were first audited on `0.18.0-alpha.0-20261008-6066b7499` and rechecked on `0.18.0-alpha.0-20261013-2e5a97ca3`, with the full test suite giving the same results on both historical snapshots. The three upstream validation issues reported on that October 13 snapshot are now resolved as recorded below. These findings describe this dev snapshot, not a final 0.18 release. Add newly discovered drifts here as the migration progresses.

## Validation results

Verified on October 15, 2026, on branch `matter018` with matter.js `0.18.0-alpha.0-20261015-9c1725759`. Root results below are from the rerun after removing the warning-mode workarounds and updating the test fixtures and snapshots; frontend results are from the unchanged frontend's earlier run.

| Validation                           | Result                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Lint, format, type-check             | Passed - root and frontend                                                 |
| Full root Vitest with coverage       | 3,797 tests passed across 174 files; configured coverage thresholds passed |
| Full frontend Vitest                 | 608 tests passed across 41 files                                           |
| Full Bun suite                       | 1,958 tests passed across 113 files                                        |
| Camera AV Stream Management coverage | 100% statements, branches, functions and lines                             |

Strict-mode follow-up:

- Updated six device attribute snapshots in each runner with the Bridged Node attributes added by the strict-mode test helpers.
- Updated fourteen isolated Vitest behavior fixtures to use Bridged Node rather than advertise incomplete Camera or Intercom device types, preserving their negative-path assertions.
- Replaced the unsupported Watermark/OnScreenDisplay feature test with a production-camera test that verifies both features are disabled, their stream fields are unset and their modify commands are not advertised. The four conditional default-stream initialization branches are commented out until those features and commands are implemented; allocation-command handlers are unchanged.
- Added a supported-camera test for default snapshot allocation with unsorted resolution capabilities.

## Renamed commodity fields

The generated CommodityMetering and CommodityTariff types now use `Ids` instead of `IDs` in property names.

| Previous name        | Dev name             |
| -------------------- | -------------------- |
| `dayEntryIDs`        | `dayEntryIds`        |
| `dayPatternIDs`      | `dayPatternIds`      |
| `tariffComponentIDs` | `tariffComponentIds` |

This affects metered quantities, tariff periods, days, day patterns, calendar periods, and the GetTariffComponent response. Fixtures, property access, and response expectations must all use the new names.

- Source adapted: `packages/core/src/chipTests.ts` and `packages/core/src/devices/electricalUtilityMeter.ts`.
- Test fixtures and response expectations adapted: `packages/core/vitest/devices/electricalUtilityMeter.test.ts` and `packages/core/buntest/devices/electricalUtilityMeter.test.ts` now use the same `Ids` names. The initial audit found six test type errors and six runtime failures, including failures cascading from endpoint initialization.
- The overload error at `setCluster(CommodityMetering, ...)` was caused by the old nested `tariffComponentIDs` field, not by the cluster argument.

## Inherited device cluster requirements

The audited snapshot includes the inherited Base Binding requirement in device definitions. Matterbridge now includes Binding in the affected Simple device definitions with mandatory application clients.

- Binding is required by Matter 1.6.1 Device Library §1.1.7 when `Simple & Client` is true; §1.1.6 defines Client as having an application client cluster. This is confirmed by `chip/1.6.1/xml/device_types/BaseDeviceType.xml`.
- On/Off Light Switch is Simple and requires Identify and On/Off clients (§6.1), so its mandatory server requirements include Identify and Binding. The server-behavior mapper now maps Binding to `MatterbridgeBindingServer`.
- Descriptor appears in the matter.js mandatory server list only for device types that require a Descriptor feature: Closure, Closure Panel and Electrical Energy Tariff require TagList (`DescriptorServer.with("TagList")` in the generated device classes). Other device types get a plain Descriptor implicitly and do not list it. Matterbridge does not add Descriptor to any device definition, since every endpoint has a Descriptor; the requirements test accepts these three mismatches.
- RootNode's intentionally empty cluster lists remain unchanged; the comparison expectation now includes the upstream optional Groupcast cluster (`0x0065`).

## Open enums typed as `Enum | number`

The audited snapshot types the fields of enums that reserve ranges for derived clusters and manufacturers as a union with `number`. Examples:

- `OperationalState` `operationalState: OperationalStateEnum | number`;
- `RvcOperationalState` `operationalState: OperationalState | OperationalStateNamespace.OperationalStateEnum | number`;
- Mode Base `ModeTagStruct.value: ModeTag | number`, and in derived clusters `ModeTag | ModeBase.ModeTag | number` (RVC Run Mode, Dishwasher Mode, …).

This follows Matter 1.6.1:

- **Operational state** (Application Cluster § 1.14.4.1, derived in § 7.4.4.1): 0x00–0x3F general, 0x40–0x7F derived cluster, 0x80–0xBF manufacturer states. ErrorStateEnum uses the same layout.
- **Mode Base** (§ 1.10.7.2.1.1 status codes, § 1.10.8 Mode Namespace): mode tags 0x4000–0x7FFF derived cluster and 0x8000–0xBFFF manufacturer.

A device can therefore report a value that is not a member of the base enum.

The type-aware lint rule `typescript/no-unsafe-enum-comparison` now flags every direct comparison of these fields with an enum member, such as `state.operationalState === OperationalState.OperationalStateEnum.Paused` or `tag.value === RvcRunMode.ModeTag.Idle`, and the `case` labels of a `switch` on them. The rule stays on: the source widens the member to `number` instead, `state.operationalState === (OperationalState.OperationalStateEnum.Paused as number)`, which keeps the comparison correct for vendor and derived values.

- Source adapted: `behaviors/operationalStateServer.ts`, `behaviors/deviceEnergyManagementModeServer.ts`, `devices/roboticVacuumCleaner.ts`, `devices/oven.ts`, `devices/microwaveOven.ts`, `devices/dishwasher.ts`, `devices/laundryWasher.ts`, `devices/evse.ts`, `devices/irrigationSystem.ts` and `chipTests.ts` (41 sites under `packages/core/src`).
- Plugins that compare these fields with enum members will get the same lint warnings when they move to 0.18, and the same fix applies.

## Endpoint device type validation

matter.js 0.18 adds server-side validation of endpoints against their declared device types and the inherited Base requirements (Matter 1.6.1 Core §9.2). It checks mandatory and disallowed clusters, required server-cluster features and elements, component endpoint counts and requirements, singleton placement, and explicitly supplied condition names. Client clusters are checked for presence only; remote `ClientNode` peers are not validated.

The `endpoint.validation` variable, also available as `MATTER_ENDPOINT_VALIDATION`, selects the mode:

| Mode                      | During construction                                                                  | Automatic checks after construction                  |
| ------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `warn` (upstream default) | Reject new misplaced singletons; warn about other new violations.                    | Log and record violations without rejecting changes. |
| `strict`                  | Reject any new device type violation.                                                | Log and record violations without rejecting changes. |
| `off`                     | Only retain the early check for misplaced singletons declared by ancestor endpoints. | Disabled.                                            |

Matterbridge sets `warn` in production and `strict` in the test helpers before creating server nodes:

- Production uses `warn` so that a non-conformant plugin device is logged instead of refused when added; tests use `strict` so that non-conformant fixtures and device classes fail. It has no validation effect with matter.js 0.17.9; it prepares these environments for 0.18.
- The mode is read when the server node's environment is built. Changing the variable afterward does not change an existing node's mode.
- Adding an endpoint can invalidate requirements on its parent or siblings, so a strict construction error can name an endpoint other than the one being added. Validation throws `DeviceTypeConformanceError`, containing individual `DeviceTypeViolationError` entries.
- Exception to the mode table: violations caused only by conditions asserted at the `Root` location are flagged `assertedAtRoot`, log at debug level and never refuse an endpoint, including in `strict` mode. They remain visible in validation results and, except in `off` mode, recorded violations. Conditions explicitly stated by the root in `deviceConditions` and requirements that apply independently remain subject to normal validation.
- Automatic runtime checks follow endpoint removal and Descriptor `DeviceTypeList` changes. They do not reject those changes, even in `strict` mode. Adding or removing a server cluster alone does not trigger a device type check.
- The mode also affects cluster implementation validation: a mandatory command using `Behavior.unimplemented` fails initialization in `strict` mode, but only logs a warning in `warn` or `off`. The command is excluded from `AcceptedCommandList` in every mode.
- Before behaviors initialize, matter.js automatically adds `BindingServer` when the configured device types require it under Base's `Simple & Client` condition. This happens in every mode. Device types restored later from persistence or added at runtime do not trigger automatic Binding installation.

For explicit checks, obtain `DeviceTypeConformanceService` from the node's environment and call `validate()` or `validateNodeScope()`. Use `{ refuse: false }` to report violations without throwing a conformance error. Explicit validation also works in `off` mode, but does not record results there.

Migration implication: endpoint definitions and test fixtures must satisfy their advertised device types, and mandatory command stubs can now prevent initialization. `strict` is not continuous enforcement of every runtime mutation.

See the upstream [Device Type Validation documentation](https://github.com/matter-js/matter.js/blob/main/docs/DEVICE_TYPE_VALIDATION.md) for the full rules and limitations.

## Resolved upstream validation issues

All three points reported in [matter-js/matter.js#4744](https://github.com/matter-js/matter.js/issues/4744) were fixed by the following PRs, both merged on October 13, 2026. The fixes are present in the audited dev version.

| Issue point                                        | Resolution                                                                                                                                                                                                                            | Upstream PR                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Utility components on the composing endpoint    | A utility device type listed on the composing endpoint counts as a component instance and is checked against that endpoint's clusters. This supports the Heat Pump, Solar Power, Battery Storage and Electrical Meter layouts.        | [matter-js/matter.js#4745](https://github.com/matter-js/matter.js/pull/4745) |
| 2. Root Node conditions blocking strict validation | Violations caused only by Root assertions are flagged `assertedAtRoot`, log at debug level and never refuse endpoints. This covers the camera-family, Intercom, meter and Groupcast conditions without weakening other strict checks. | [matter-js/matter.js#4746](https://github.com/matter-js/matter.js/pull/4746) |
| 3. Non-serializable conformance errors             | `DeviceTypeViolationError.endpoint` is now a getter backed by a private field, not an own enumerable property, so error serializers no longer traverse the node graph.                                                                | [matter-js/matter.js#4745](https://github.com/matter-js/matter.js/pull/4745) |

The Root-assertion fix removes the validation blocker; it does not implement Time Synchronization, TLS Certificate Management or TLS Client Management. All 18 warning-mode workarounds have been removed from the Vitest and Bun device and behavior test setups, which now use the default strict validation. Tests of the validation-mode option still exercise `off` and `warn`, then restore `strict` before creating the server.

## Door lock validation and events

Door-lock tests now use a supported user type when schedule features are disabled, send null UserStatus and UserType when adding credentials to existing users (§5.2.10.20), and assert SetCredential response statuses. These test changes also pass with matter.js 0.17.9.

The audited snapshot reports the user index in LockUserChange.DataIndex for user changes (§5.2.11.5.7), and reports UserIndex `0xFFFE` when clearing credentials for all users (§5.2.11.5.4). The corresponding event expectations are specific to 0.18; 0.17.9 reports null for these fields.

## Level control On/Off coupling corrected

In 0.17.9, downward MoveWithOnOff supplied an unbounded target (`-Infinity`) that the coupling logic compared directly with MinLevel, incorrectly taking the turn-on path. The audited 0.18 snapshot clamps the target to the device range and turns the endpoint off when CurrentLevel reaches MinLevel, as required by Matter 1.6.1 Application Cluster §1.6.7.6.

Ordinary Step then has no effect while off unless ExecuteIfOff permits execution (§1.6.4.1.3). The LevelControl test now checks this no-op, then turns the endpoint on before checking that Step increases the level. This test update applies only to `matterdev`; no Matterbridge server change is needed.
