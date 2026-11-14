# Matter.js 0.18.1

This file tracks the matter.js 0.18.1 dev changes compared with 0.18.0 that matter for Matterbridge.

Audited on November 14, 2026, against local matter.js checkout `05645e839`, compared with tag `v0.18.0`. Matterbridge currently links the seven upstream packages (`general`, `main`, `model`, `node`, `nodejs`, `protocol`, `types`) to this checkout; their package version is `0.0.0-git`. These findings describe the current source, not a verified final 0.18.1 release.

## Thermostat test failures

The original Vitest report contained 4,031 tests with six failures, all in `packages/core/vitest/behaviors/thermostatServer.test.ts` and `packages/core/vitest/matterbridgeEndpoint-default.test.ts`. Running both complete files reproduced six failed and 104 passed tests.

| Failures            | Cause                                                                                                                                                                                                                                                  | Migration requirement                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Four schedule tests | `ThermostatServer.initialize()` now rejects MatterScheduleConfiguration unless `Specification.isForwardFeatureEnabled("thermostat-msch")` is true. Endpoint initialization fails; destroyed endpoints and undefined attributes are secondary symptoms. | Clarify the supported application integration with upstream. The current override mechanism is explicitly intended for certification testing, not supported production configuration. |
| One preset test     | SetActivePresetRequest now retains the activated preset handle while applying its setpoints; the test expects null.                                                                                                                                    | Expect the selected handle after activation, and null after explicit clearing.                                                                                                        |
| One suggestion test | Upstream initialization now removes expired suggestions. The fixture's expiration time, `1700003600`, is in November 2023.                                                                                                                             | Use a controlled test clock and a non-expired fixture; preserve coverage of expiration separately.                                                                                    |

The schedule flag does not require the Matterbridge installation to hold a certificate. It is an upstream gate for a feature implemented ahead of general enablement. `Specification` documents specification release, certification validation and provisional status as possible reasons for such gates; the source does not establish which specific outstanding requirement applies here.

The endpoint fails in `packages/node/src/behaviors/thermostat/ThermostatServer.ts`, inside `ThermostatBaseServer.initialize()`:

```ts
if (this.features.matterScheduleConfiguration && !Specification.isForwardFeatureEnabled('thermostat-msch')) {
  throw new ImplementationError(`MatterScheduleConfiguration feature is not released yet. Enable it with the "thermostat-msch" forward feature for certification purposes only`);
}
```

Matterbridge's `MatterbridgeThermostatServer.initialize()` calls `await super.initialize()`, so this exception prevents the behavior and endpoint from completing construction, even though Matterbridge supplies its own schedule command handler. This is an unconditional implementation guard when the feature flag is false, not a device-type validation warning.

There is currently no supported production configuration switch. Tests can enable the named feature through `MockForwardFeatures` from `@matter/testing`; the intended production integration needs clarification with upstream.

## Thermostat behavior changes

| Area                       | Change from 0.18.0                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schedules                  | Native persisted schedules, atomic writes, generated handles and SetActiveScheduleRequest handling. Validation covers total/per-mode capacities, transition counts, day masks, overlapping same-time transitions, preset references, supported names/modes, setpoint bounds and deadband. Built-in and active schedules are protected against removal. |
| Schedule execution         | Activation only records the schedule handle. The application still supplies time synchronization, evaluates transitions against local time/day/DST, applies presets or setpoints and reports schedule-originated setpoint changes.                                                                                                                     |
| Suggestions                | Native add/remove commands, automatic expiration and current-suggestion selection/application. Timers and state reactions re-evaluate suggestions at activation/expiration, startup, node online, time synchronization changes and relevant attribute changes.                                                                                         |
| Time synchronization       | Adding a suggestion rejects with INVALID_IN_STATE when time is unsynchronized. The default checks TimeSynchronization UTCTime when that cluster exists; otherwise it trusts the host clock once it reads 2025 or later.                                                                                                                                |
| Holds and manual overrides | Manual preset/setpoint changes can override the current suggestion. Hold handling determines when following resumes, and the override persists across restart while its suggestion remains current.                                                                                                                                                    |
| Presets                    | Activation retains the handle and clamps the preset's setpoints to limits. Direct writes to current-occupancy setpoints can clear the active handle; preset-activation transactions and internal reconciliation preserve it. Handle validation precedes capacity checks.                                                                               |
| Events                     | Generates thermostat events after committed changes. Events require the separate `thermostat-events` gate and enabled event elements. LocalTemperatureChange uses a configurable threshold and a minimum 60-second interval.                                                                                                                           |
| Control sequence           | Shared rules enforce allowed heating/cooling modes. CoolingWithReheat is treated as a sequence without heating.                                                                                                                                                                                                                                        |
| Initialization             | Clears active handles that reference no stored entry, validates configured schedules and raises certain capacity limits to cover already-stored entries. Legacy MinSetpointDeadBand values above 127 are reset to 20.                                                                                                                                  |
| Atomic-write errors        | A competing peer receives BUSY specifically for Presets; other affected attributes use INVALID_IN_STATE.                                                                                                                                                                                                                                               |

Relevant upstream changes: [matter-js/matter.js#4467](https://github.com/matter-js/matter.js/pull/4467) (schedules), [matter-js/matter.js#4993](https://github.com/matter-js/matter.js/pull/4993) (suggestions), [matter-js/matter.js#4990](https://github.com/matter-js/matter.js/pull/4990) (events), [matter-js/matter.js#4979](https://github.com/matter-js/matter.js/pull/4979) (preset validation), and [matter-js/matter.js#5000](https://github.com/matter-js/matter.js/pull/5000) (CoolingWithReheat).

Matterbridge integration remains open: `MatterbridgeThermostatServer` overrides schedule and suggestion commands, but `super.initialize()` now installs upstream storage, validation, reactors and suggestion timers. The two implementations therefore coexist. Upstream automatic suggestion application calls `handleSetActivePresetRequest()`, not the overridden `setActivePresetRequest()`, so Matterbridge's forwarding in that command override is not automatically invoked. Physical-device synchronization must be addressed before replacing the custom implementation with upstream delegation. Bypassing the schedule gate alone does not restore 0.18.0 behavior.

## mDNS multi-ServerNode responder fix (Matterbridge childbridge mode and bridge mode with ServerNode devices)

The current dev source fixes a long-standing bug: a record-identity collision that can suppress discovery responses for all but one ServerNode registered with a shared responder.

In 0.18.0, duplicate-response suppression identifies a record using its name, class, type and interface, but not its contents. Multiple service instances publish PTR records under the same service type, such as `_matter._tcp.local`, with different instance targets. After the first instance is answered, later instances can be mistaken for already-answered records.

The new `InterfaceResponder` identifies records by name, type, class **and record contents**, including the PTR target, and processes all registered services. `MdnsServerTest.ts` includes the regression test `answers a pointer query with the pointer of every service of the type`, which asserts both registered service targets are returned.

This implementation is present in [matter-js/matter.js#4842](https://github.com/matter-js/matter.js/pull/4842). The related [matter-js/matter.js#4844](https://github.com/matter-js/matter.js/pull/4844) prevents withdrawal of shared host-address records while another registered service still publishes them. Together these address query suppression and one service's shutdown invalidating another service's discovery records.

Verification here is source and regression-test inspection, not execution of the upstream mDNS tests or a live multi-ServerNode network test.
