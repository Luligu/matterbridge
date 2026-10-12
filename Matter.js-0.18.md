# Matter.js 0.18.x

This file tracks the matter.js 0.18.x deltas compared with matter.js 0.17.9 that matter for Matterbridge, following [the 0.17 migration notes](Matter.js-0.17.md).

Audited version: `0.18.0-alpha.0-20261008-6066b7499`. These findings describe this dev snapshot, not a final 0.18 release. Add newly discovered drifts here as the migration progresses.

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

## Door lock validation and events

Door-lock tests now use a supported user type when schedule features are disabled, send null UserStatus and UserType when adding credentials to existing users (§5.2.10.20), and assert SetCredential response statuses. These test changes also pass with matter.js 0.17.9.

The audited snapshot reports the user index in LockUserChange.DataIndex for user changes (§5.2.11.5.7), and reports UserIndex `0xFFFE` when clearing credentials for all users (§5.2.11.5.4). The corresponding event expectations are specific to 0.18; 0.17.9 reports null for these fields.

## Level control On/Off coupling corrected

In 0.17.9, downward MoveWithOnOff supplied an unbounded target (`-Infinity`) that the coupling logic compared directly with MinLevel, incorrectly taking the turn-on path. The audited 0.18 snapshot clamps the target to the device range and turns the endpoint off when CurrentLevel reaches MinLevel, as required by Matter 1.6.1 Application Cluster §1.6.7.6.

Ordinary Step then has no effect while off unless ExecuteIfOff permits execution (§1.6.4.1.3). The LevelControl test now checks this no-op, then turns the endpoint on before checking that Step increases the level. This test update applies only to `matterdev`; no Matterbridge server change is needed.
