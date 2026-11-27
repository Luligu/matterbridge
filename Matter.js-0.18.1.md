# Matter.js 0.18.1

This file tracks the matter.js 0.18.1 changes compared with 0.18.0 that matter for Matterbridge.

Audited on November 26, 2026, against the published `@matter/*` 0.18.1 packages that Matterbridge now depends on.

## Thermostat behavior changes

| Area                       | Change from 0.18.0                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schedules                  | Native persisted schedules, atomic writes, generated handles and SetActiveScheduleRequest handling. Validation covers total/per-mode capacities, transition counts, day masks, overlapping same-time transitions, preset references, supported names/modes, setpoint bounds and deadband. Built-in and active schedules are protected against removal. |
| Schedule execution         | Activation only records the schedule handle. The application still supplies time synchronization, evaluates transitions against local time/day/DST, applies each transition's preset, system mode or setpoints, and reports schedule-originated setpoint changes.                                                                                      |
| Suggestions                | Native add/remove commands, automatic expiration and current-suggestion selection/application. Timers and state reactions re-evaluate suggestions at activation/expiration, startup, node online, time synchronization changes and relevant attribute changes.                                                                                         |
| Time synchronization       | Adding a suggestion rejects with INVALID_IN_STATE when time is unsynchronized. The default checks TimeSynchronization UTCTime when that cluster exists; otherwise it trusts the host clock once it reads 2025 or later.                                                                                                                                |
| Holds and manual overrides | Manual preset/setpoint changes can override the current suggestion. Hold handling determines when following resumes, and the override persists across restart while its suggestion remains current.                                                                                                                                                    |
| Presets                    | Activation retains the handle and clamps the preset's setpoints to limits. Direct writes to current-occupancy setpoints can clear the active handle; preset-activation transactions and internal reconciliation preserve it. Handle validation precedes capacity checks.                                                                               |
| Events                     | Generates thermostat events after committed changes. Events require the separate `thermostat-events` forward feature and enabled event elements. LocalTemperatureChange uses a configurable threshold and a minimum 60-second interval.                                                                                                                |
| Control sequence           | Shared rules enforce allowed heating/cooling modes. CoolingWithReheat is treated as a sequence without heating.                                                                                                                                                                                                                                        |
| Initialization             | Clears active handles that reference no stored entry, validates configured schedules and raises certain capacity limits to cover already-stored entries. Legacy MinSetpointDeadBand values above 127 are reset to 20.                                                                                                                                  |
| Atomic-write errors        | A competing peer receives BUSY specifically for Presets; other affected attributes use INVALID_IN_STATE.                                                                                                                                                                                                                                               |

MatterScheduleConfiguration is no longer gated: the `thermostat-msch` forward feature of the dev source was removed before the release, so schedule endpoints initialize normally.

Relevant upstream changes: [matter-js/matter.js#4467](https://github.com/matter-js/matter.js/pull/4467) (schedules), [matter-js/matter.js#4993](https://github.com/matter-js/matter.js/pull/4993) (suggestions), [matter-js/matter.js#4990](https://github.com/matter-js/matter.js/pull/4990) (events), [matter-js/matter.js#4979](https://github.com/matter-js/matter.js/pull/4979) (preset validation), and [matter-js/matter.js#5000](https://github.com/matter-js/matter.js/pull/5000) (CoolingWithReheat).

## Matterbridge integration

`MatterbridgeThermostatServer` now delegates schedules, presets and suggestions to matter.js. Each command override logs, forwards the request to the plugin command handler, calls the matching `super` method with the request unchanged, then emits the command observable. Matterbridge no longer keeps its own suggestion list, expiration, re-evaluation or Presets-removal cascade.

| Command                    | Delegated validation and state (Matter 1.6.1)                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SetActivePresetRequest     | INVALID_COMMAND for an unknown handle (§ 4.3.12.3.2); sets ActivePresetHandle and moves the setpoints to the preset.                                              |
| SetActiveScheduleRequest   | INVALID_COMMAND for an unknown handle (§ 4.3.12.2.2); stores ActiveScheduleHandle only.                                                                           |
| AddThermostatSuggestion    | INVALID_IN_STATE, NOT_FOUND, RESOURCE_EXHAUSTED and INVALID_COMMAND in the order of § 4.3.12.4.4; appends the entry and re-evaluates CurrentThermostatSuggestion. |
| RemoveThermostatSuggestion | NOT_FOUND for an unknown UniqueID (§ 4.3.12.6.2); removes the entry and re-evaluates CurrentThermostatSuggestion.                                                 |

What this means for plugins:

- The plugin command handler runs before validation, so it is a notification: it also runs for requests that matter.js then rejects.
- Following a suggestion activates its preset through `handleSetActivePresetRequest()`, not `setActivePresetRequest()`, so the plugin `Thermostat.setActivePresetRequest` handler is not called. This happens on add/remove, at each EffectiveTime and ExpirationTime, and at startup. Removing the current suggestion may activate the preset of another current suggestion; with none, ActivePresetHandle stays as it is.
- Plugins observe these changes by subscribing to `activePresetHandle`, `occupiedHeatingSetpoint` and `occupiedCoolingSetpoint`. `context.fabric === undefined` identifies a change matter.js made itself.
- Plugins that run schedules apply each transition themselves: its preset (ActivePresetHandle), system mode or setpoints.
- matter.js stores request byte arrays (handles) by reference, as it does internally. A caller that later mutates a request array it passed in also mutates the stored attribute.

## Verification

- Vitest `thermostatServer.test.ts` and `matterbridgeEndpoint-default.test.ts`: 109 tests pass. Bun: 107 tests pass.
- CHIP conformance, with the local build and matter.js 0.18.1 synced into the `chip-test` container: all 15 runnable thermostat tests pass on endpoints 901, 9011, 9012, 9013, 9014 and 9015 (`Test_TC_TSTAT_2_1`, `TC_TSTAT_2_2.py`, `TC_TSTAT_4_2.py` on 9013 and 9015, `TC_TSTAT_4_3.py` on 9015). The `TC_TSTAT_4_3.py` rejections now come from matter.js.
- Demo devices: no drift. matter.js logs no thermostat warnings at startup, and the suggestions demo device meets the new MaxThermostatSuggestions minimum of 5.

## Open issue: suggestion re-evaluation on every UTCTime change

matter.js re-evaluates the suggestions on every `utcTime$Changed` of a TimeSynchronization cluster on the node, synchronously, in the transaction that changed UTCTime. `MatterbridgeTimeSynchronizationServer.updateClock()` writes UTCTime every second, so every ThermostatSuggestions endpoint is re-evaluated every second. When a client command holds the thermostat lock at that moment, the reaction fails:

```text
Error in Matterbridge.timeSynchronization.events.utcTime$Changed observer … [synchronous-transaction-conflict]
reactor<ThermostatSuggestions.thermostat.#reevaluateSuggestions>: Cannot lock …thermostat.state synchronously
```

- Scope: only nodes with the TimeSynchronization cluster on the root (`--root-camera` or `MATTERBRIDGE_CHIP_TEST`) and a ThermostatSuggestions endpoint.
- Impact: an occasional logged error and a skipped clock tick; no CHIP test failed. The per-second re-evaluation is redundant, since matter.js already runs a timer for each EffectiveTime and ExpirationTime.
- Proposed upstream fix: re-evaluate only when UTCTime switches between null and non-null, or run the reaction in its own transaction (`offline: true`).

## Energy EVSE `SetTargets` conformance

Matter 1.6.1 Application Cluster § 9.3.9.5.2 requires `RESOURCE_EXHAUSTED` (`0x89`) when a `SetTargets` request exceeds the EVSE's charging-target capacity. Matter.js 0.18.1 rejects an 11-target daily list during TLV validation with `CONSTRAINT_ERROR` (`0x87`) before the server method runs, which fails CHIP `TC_EEVSE_2_3` step 19.

Matterbridge uses command-level `Supervision` to route `SetTargets` through model validation and lets the EVSE server enforce the nested 10-target limit. The hook also maps the model validator's missing-`TargetSoC` error to `INVALID_COMMAND` (`0x85`) when SoC reporting is enabled, as required by § 9.3.7.6. Duplicate days still return `CONSTRAINT_ERROR`.

CHIP `TC_EEVSE_2_3` passes on the base (1401) and complete (14011) EVSE endpoints with this workaround.

## Closure Dimension `SetTarget.Speed` conformance

[Matter.js #5012](https://github.com/matter-js/matter.js/pull/5012) rejects undefined command enum values before dispatch. Matter 1.6.1 Application Cluster § 5.5.8.1.3 requires Closure Dimension to ignore an invalid `SetTarget.Speed` value when the endpoint lacks the Speed feature. Without the override, CHIP `TC_CLDIM_3_3` step 10 receives `CONSTRAINT_ERROR` instead of `SUCCESS`.

`MatterbridgeClosureDimensionServer` uses field-level `Supervision` to defer `SetTarget.Speed` validation to its handler. The handler ignores the field when Speed is unsupported and rejects undefined values with `CONSTRAINT_ERROR` when Speed is supported.

## mDNS multi-ServerNode responder fix (Matterbridge childbridge mode and bridge mode with ServerNode devices)

0.18.1 fixes a long-standing bug: a record-identity collision that can suppress discovery responses for all but one ServerNode registered with a shared responder.

In 0.18.0, duplicate-response suppression identifies a record using its name, class, type and interface, but not its contents. Multiple service instances publish PTR records under the same service type, such as `_matter._tcp.local`, with different instance targets. After the first instance is answered, later instances can be mistaken for already-answered records.

The new `InterfaceResponder` identifies records by name, type, class **and record contents**, including the PTR target, and processes all registered services. `MdnsServerTest.ts` includes the regression test `answers a pointer query with the pointer of every service of the type`, which asserts both registered service targets are returned.

This implementation is present in [matter-js/matter.js#4842](https://github.com/matter-js/matter.js/pull/4842). The related [matter-js/matter.js#4844](https://github.com/matter-js/matter.js/pull/4844) prevents withdrawal of shared host-address records while another registered service still publishes them. Together these address query suppression and one service's shutdown invalidating another service's discovery records.

Verification here is source and regression-test inspection, not execution of the upstream mDNS tests or a live multi-ServerNode network test.
