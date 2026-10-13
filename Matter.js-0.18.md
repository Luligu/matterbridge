# Matter.js 0.18.x

This file tracks the matter.js 0.18.x deltas compared with matter.js 0.17.9 that matter for Matterbridge, following [the 0.17 migration notes](Matter.js-0.17.md).

Audited version: `0.18.0-alpha.0-20261013-2e5a97ca3`. The findings were first audited on `0.18.0-alpha.0-20261008-6066b7499`; the full test suite gives the same results on both. These findings describe this dev snapshot, not a final 0.18 release. Add newly discovered drifts here as the migration progresses.

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

The audited snapshot includes inherited Binding and Descriptor requirements in device definitions. Matterbridge now includes Binding in the affected Simple device definitions with mandatory application clients, and Descriptor in Closure, Closure Panel, and Electrical Energy Tariff.

- Binding is required by Matter 1.6.1 Device Library §1.1.7 when `Simple & Client` is true; §1.1.6 defines Client as having an application client cluster. This is confirmed by `chip/1.6.1/xml/device_types/BaseDeviceType.xml`.
- On/Off Light Switch is Simple and requires Identify and On/Off clients (§6.1), so its mandatory server requirements include Identify and Binding. The server-behavior mapper now maps Binding to `MatterbridgeBindingServer`.
- Descriptor is mandatory for every device type under §1.1.7.
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

```ts
this.environment.vars.set('endpoint.validation', 'warn'); // Matterbridge and MatterNode
this.environment.vars.set('endpoint.validation', 'strict'); // the five test-helper environment setups
```

- Production uses `warn` so that a non-conformant plugin device is logged instead of refused when added; tests use `strict` so that non-conformant fixtures and device classes fail. It has no validation effect with matter.js 0.17.9; it prepares these environments for 0.18.
- The mode is read when the server node's environment is built. Changing the variable afterward does not change an existing node's mode.
- Adding an endpoint can invalidate requirements on its parent or siblings, so a strict construction error can name an endpoint other than the one being added. Validation throws `DeviceTypeConformanceError`, containing individual `DeviceTypeViolationError` entries.
- Automatic runtime checks follow endpoint removal and Descriptor `DeviceTypeList` changes. They do not reject those changes, even in `strict` mode. Adding or removing a server cluster alone does not trigger a device type check.
- The mode also affects cluster implementation validation: a mandatory command using `Behavior.unimplemented` fails initialization in `strict` mode, but only logs a warning in `warn` or `off`. The command is excluded from `AcceptedCommandList` in every mode.
- Before behaviors initialize, matter.js automatically adds `BindingServer` when the configured device types require it under Base's `Simple & Client` condition. This happens in every mode. Device types restored later from persistence or added at runtime do not trigger automatic Binding installation.

For explicit checks, obtain `DeviceTypeConformanceService` from the node's environment and call `validate()` or `validateNodeScope()`. Use `{ refuse: false }` to report violations without throwing a conformance error. Explicit validation also works in `off` mode, but does not record results there.

Migration implication: endpoint definitions and test fixtures must satisfy their advertised device types, and mandatory command stubs can now prevent initialization. `strict` is not continuous enforcement of every runtime mutation.

See the upstream [Device Type Validation documentation](https://github.com/matter-js/matter.js/blob/main/docs/DEVICE_TYPE_VALIDATION.md) for the full rules and limitations.

## Component utility device types on the composing endpoint

The audited validator does not count a component device type declared on the composing endpoint itself. `checkComposition()` in `@matter/model` (`logic/device-types/DeviceTypeConformance.ts`) requires "a distinct endpoint of its own" for each component, so composed device types that declare their utility components on the same endpoint are rejected in `strict` mode and reported in `warn` mode:

| Device class             | Endpoint device types                                                                                                                                                 | Reported violation                                                                                                                                                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `HeatPump`               | `[heatPump, powerSource, electricalSensor, deviceEnergyManagement]`                                                                                                   | `device:PowerSource`, `device:ElectricalSensor` and `device:DeviceEnergyManagement`: requires min 1; found 0                                                                                                                                                             |
| `SolarPower`             | `[solarPower, powerSource, electricalSensor, deviceEnergyManagement]`                                                                                                 | `device:PowerSource`: requires min 1; found 0                                                                                                                                                                                                                            |
| `BatteryStorage`         | `[batteryStorage, powerSource, electricalSensor, deviceEnergyManagement]` + `Battery` child `[powerSource, electricalSensor]`                                         | `device:ElectricalSensor` and `device:PowerSource`: requires min 2; found 1. Instance 1 of each: no candidate offers `ElectricalPowerMeasurement.ALTC` / `PowerSource.WIRED`, which the composing endpoint has. `device:DeviceEnergyManagement`: requires min 1; found 0 |
| `ElectricalUtilityMeter` | `[electricalUtilityMeter, meterReferencePoint, powerSource]` + meter child `[electricalMeter, electricalSensor]` (with `electricalEnergyTariff` when it has a tariff) | `ElectricalMeter device:ElectricalSensor`: requires min 1; found 0                                                                                                                                                                                                       |

This placement follows Matter 1.6.1:

- Core § 9.2.1 (Endpoint Requirements): "Each Simple endpoint SHALL support exactly one Application device type … The endpoint MAY support additional utility device types." Power Source, Electrical Sensor and Device Energy Management are utility device types (`class="utility"` in the 1.6.1 XML); Heat Pump, Solar Power, Battery Storage and Electrical Meter are Simple.
- Device Library § 14.5.6 (Heat Pump Device Type Requirements): "A Heat Pump device SHALL be composed of at least one endpoint with device types as defined by the conformance below." Solar Power, Battery Storage and Electrical Meter (§ 14.8.3) use the same wording.
- The Device Library example figures place the components on the composing endpoint:
  - Figure 18, "Example of a Solar Power device with single phase AC output" (§ 14.3.1): `EP1 DeviceTypeList: [SolarPower, PowerSource, ElectricalSensor, DeviceEnergyManagement]` with an empty PartsList.
  - Figure 21, "Example of a Battery Storage device with single phase AC output" (§ 14.4.1): `EP1 [BatteryStorage, PowerSource, ElectricalSensor, DeviceEnergyManagement]` and `EP2 [PowerSource, ElectricalSensor]`, so two Electrical Sensors, one on the composing endpoint.
  - Figure 23, "Example of a Heat Pump device" (§ 14.5.1): `EP1 DeviceTypeList: [HeatPump, PowerSource, ElectricalSensor, DeviceEnergyManagement]`, with only Temperature Sensor and Thermostat child endpoints.
  - Figure 30, "Example of a basic Electrical Utility Meter" (§ 14.9.6.1): `EP2: Electrical Meter` has `DeviceTypeList: [Electrical Meter, Electrical Energy Tariff, Electrical Sensor]` and no child endpoints. Figure 31, "Example of a phased Electrical Utility Meter", keeps the same EP2 device types and adds per-phase Electrical Sensor child endpoints.

The validator follows the literal Core § 9.2.3 (Composed Device Types) sentence "The component device types exist on their own endpoints", which contradicts § 9.2.1 and the Device Library examples. Matterbridge keeps the spec-example composition; this is to be reported upstream so the validator counts utility component device types declared on the composing endpoint.

## Conformance errors keep a live endpoint

`DeviceTypeViolationError` (`@matter/node`, `node/server/DeviceTypeConformanceError.ts`) stores the refused endpoint as an enumerable `readonly endpoint: Endpoint`, and `DeviceTypeConformanceError` exposes these violations in its `errors` array. When a rejected `add()` is not caught in a test, the test runner serializes the failed test's error with its own properties: it walks `errors[].endpoint` into the whole node and environment graph and the worker dies with "JavaScript heap out of memory" instead of reporting the violation.

In the audited snapshot this crashed `matterbridgePlatform.test.ts` (non-conformant fixtures added through `registerDevice()` and the test-utils `addBridgedEndpoint()`, which rethrows), `bindingServer.test.ts` and `matterbridgeEndpoint-matterjs.test.ts` (fixtures added with a raw `aggregator.add()` / `server.add()`). In each file, replacing the rejection with a plain error turned the crash into ordinary test failures that named the violations.

To be reported upstream: keep the endpoint as a non-enumerable property, or store only its path string (the message already uses `endpoint.toString()`), so an uncaught conformance error stays serializable.

## Required source refactors

Endpoint validation also reports violations that are Matterbridge gaps against Matter 1.6.1, not validator issues. They are reported in `warn` mode in production and rejected in `strict` mode in the tests:

- Root Node conditions: Camera, Audio Doorbell, Intercom and Snapshot Camera require Root Node conditions for Time Synchronization, TLS Certificate Management, TLS Client Management and a Power Source; Electrical Utility Meter and Meter Reference Point require `TimeSyncCond` (§ 14.9.4). These apply to the node, also in bridge mode, so the Matterbridge server nodes must provide these clusters when such a device is present.

## Door lock validation and events

The audited snapshot reports the user index in LockUserChange.DataIndex for user changes (§5.2.11.5.7), and reports UserIndex `0xFFFE` when clearing credentials for all users (§5.2.11.5.4). The corresponding event expectations are specific to 0.18; 0.17.9 reports null for these fields.

## Level control On/Off coupling corrected

In 0.17.9, downward MoveWithOnOff supplied an unbounded target (`-Infinity`) that the coupling logic compared directly with MinLevel, incorrectly taking the turn-on path. The audited 0.18 snapshot clamps the target to the device range and turns the endpoint off when CurrentLevel reaches MinLevel, as required by Matter 1.6.1 Application Cluster §1.6.7.6.

Ordinary Step then has no effect while off unless ExecuteIfOff permits execution (§1.6.4.1.3). The LevelControl test now checks this no-op, then turns the endpoint on before checking that Step increases the level. This test update applies only to `matterdev`; no Matterbridge server change is needed.
