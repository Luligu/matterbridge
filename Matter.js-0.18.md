# Matter.js 0.18.x

This file tracks the matter.js 0.18.x deltas compared with matter.js 0.17.9 that matter for Matterbridge, following [the 0.17 migration notes](Matter.js-0.17.md).

Audited version: `0.18.0-alpha.0-20260928-23865781d`. These findings describe this dev snapshot, not a final 0.18 release. Add newly discovered drifts here as the migration progresses.

## Renamed commodity fields

The generated CommodityMetering and CommodityTariff types now use `Ids` instead of `IDs` in property names.

| Previous name        | Dev name             |
| -------------------- | -------------------- |
| `dayEntryIDs`        | `dayEntryIds`        |
| `dayPatternIDs`      | `dayPatternIds`      |
| `tariffComponentIDs` | `tariffComponentIds` |

This affects metered quantities, tariff periods, days, day patterns, calendar periods, and the GetTariffComponent response. Fixtures, property access, and response expectations must all use the new names.

- Source adapted: `packages/core/src/chipTests.ts` and `packages/core/src/devices/electricalUtilityMeter.ts`.
- Test fixtures and response expectations adapted: `packages/core/vitest/devices/electricalUtilityMeter.test.ts` now uses the same `Ids` names. The initial audit found six test type errors and six runtime failures, including failures cascading from endpoint initialization.
- The overload error at `setCluster(CommodityMetering, ...)` was caused by the old nested `tariffComponentIDs` field, not by the cluster argument.

## Thermostat schedules incorrectly marked provisional

Upstream model bug in the audited matter.js dev snapshot: `Schedules` is marked `P, MSCH` in `@matter/model/src/standard/elements/thermostat-cluster.element.ts`. The type generator treats provisional elements as optional, so `schedules` is possibly undefined even with MatterScheduleConfiguration enabled.

- Matter 1.6.1 declares the MatterScheduleConfiguration feature as `O` and the Schedules attribute as `MSCH`, without `P`. Schedules is mandatory when MSCH is enabled and is not nullable. See the [Application Cluster Specification](chip/1.6.1/specs/Matter-1.6.1-Application-Cluster-Specification.md), §§4.3.7 and 4.3.11.51, and the [Thermostat XML](chip/1.6.1/xml/clusters/Thermostat.xml), attribute `0x0051`.
- This is not a Matter 1.6.1 specification change: the Schedules and SetActiveScheduleRequest sections and their XML definitions are identical in 1.6.0 and 1.6.1.
- Pending upstream correction: remove the incorrect provisional marking and regenerate the affected types.
- Matterbridge workaround: `setActiveScheduleRequest` uses `this.state.schedules?.find(...)`. An absent list follows the existing `InvalidCommand` path, but the guard does not make omitting Schedules compliant when MSCH is enabled. Section 4.3.12.2.2 specifies `INVALID_COMMAND` when no schedule handle matches.
