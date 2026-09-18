---
name: verify-server-endpoint-context
description: Verify server message endpoint context, endpoint type narrowing, plugin forwarding order, command observable emission, and Matter 1.6.0 comments on validation and state updates. v.1.1.0
---

# Verify server message endpoint context, endpoint type narrowing, plugin forwarding order, command observable emission, and Matter 1.6.0 comments on validation and state updates

Verify endpoint context in Matterbridge behavior server implementations.

Scope:

- Inspect all server implementations in [packages/core/src/behaviors](../../../packages/core/src/behaviors).
- Inspect all server classes declared in files under [packages/core/src/devices](../../../packages/core/src/devices), including files that also contain device classes or helper code.
- In device files, limit the check to server class bodies. Do not report logs or throws belonging only to device classes or unrelated helpers.

Checks:

- Verify every textual log and throw message in scope starts with the exact name of its enclosing server class, optionally followed by a dot and the exact name of the enclosing command handler or method, then a colon and one space, and that the first letter of the text immediately following that prefix is lowercase. For example:

  ```typescript
  MatterbridgeBooleanStateConfigurationServer: requested;
  ```

  The optional method segment is intended for clusters whose handlers emit similar messages about the same subject, where the bare class name alone does not identify which command produced the line. For example:

  ```typescript
  MatterbridgeWebRtcTransportProviderServer.provideOffer: received;
  ```

- Verify every textual log and throw message in scope ends with this exact fragment:

  ```typescript
  (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})
  ```

- Treat calls to every log level as logs, including `debug`, `info`, `notice`, `warn`, `error`, and `fatal`, whether the logger is accessed through `device.log`, `this.state.log`, `this.log`, or another local reference.
- Verify every error message created by a `throw` statement in scope follows the same prefix and suffix rules, including errors constructed directly in the `throw` and errors assigned to a variable before being thrown.
- Follow local variables and simple helper methods when needed so multiline calls, template literals, and indirectly constructed error messages are not missed.
- Do not accept a missing or abbreviated server name, text before the server name, a prefix that does not match the enclosing server class name exactly, a method segment that does not match the enclosing method name exactly, a method segment not separated from the server name by a single dot, a prefix whose colon and space separator is missing so the prefix runs into the message text, or an uppercase first letter immediately after the prefix's colon and space (for example `MatterbridgeEnergyEvseServer: Disable charging` is a violation; `MatterbridgeEnergyEvseServer: disable charging` is compliant, and `MatterbridgeWebRtcTransportProviderServer.solicitOffer requires at least one stream` is a violation because it has no colon and space separator; `MatterbridgeWebRtcTransportProviderServer.solicitOffer: requires at least one stream` is compliant).
- Do not accept alternate endpoint formats, missing parentheses, a colon separator, `endpoint.id`, `endpoint.number`, messages containing only one endpoint component, or any text after the endpoint fragment's closing parenthesis.
- Do not require the fragment in a log or thrown value that has no textual message, but report that case separately for manual review.
- Ignore comments, JSDoc examples, tests, generated output, and imported server implementations.

Endpoint type narrowing:

- Verify every server class in scope narrows the inherited `endpoint` getter once, as the first member of the class body, instead of asserting the type at each use:

  ```typescript
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;
  ```

- `Behavior.endpoint` is a getter returning `Endpoint<EndpointType.Empty>` and `MatterbridgeEndpoint` is a subtype of it, so the narrowing is accepted. `declare` emits no runtime code, so the inherited getter is untouched and the declaration is purely a type-level assertion.
- Verify `MatterbridgeEndpoint` is imported as a type-only import, for example `import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js'`. A value import creates an import cycle for every behavior that [matterbridgeEndpointHelpers.ts](../../../packages/core/src/matterbridgeEndpointHelpers.ts) imports.
- Verify no `this.endpoint as MatterbridgeEndpoint` assertion remains in scope, including the `endpoint` property of the `device.commandHandler.executeHandler(...)` payload.
- Verify a file-level `/* oxlint-disable typescript/no-unsafe-type-assertion */` suppression is removed once the file contains no remaining type assertion. Keep it only when an unrelated assertion still requires it.
- Report a missing declaration, a remaining `as MatterbridgeEndpoint` assertion, a value import of `MatterbridgeEndpoint`, or an obsolete assertion suppression as an endpoint type narrowing violation.

Plugin forwarding contract:

- For every overridden Matter command handler in scope, verify that forwarding to the plugin through `device.commandHandler.executeHandler(...)` occurs immediately after the command-entry log.
- Before the forwarding call, allow only the minimal local lookup required to access the logger and command handler, such as `const device = this.endpoint.stateOf(MatterbridgeServer)`, followed by the command-entry log.
- Verify only the command-entry log immediately before forwarding uses the `info` level, for example `device.log.info(...)`. A command-entry log at `debug`, `notice`, `warn`, `error`, `fatal`, or any other level is not compliant.
- Do not require any other log to use `info`. Logs outside the command-entry position may use any appropriate log level, but their messages must still satisfy the server-name prefix and endpoint suffix rules.
- The forwarding call must be awaited before execution continues.
- Do not allow request validation, assertions, conditionals, early returns, thrown errors, state reads used for decisions, state changes, event emission, additional logging, or other side effects between the command-entry log and completion of the awaited forwarding call.
- Verify all validation and state mutation occur only after the awaited forwarding call.
- Report a missing command-entry log, command-entry log at a level other than `info`, missing forwarding call, non-awaited forwarding call, or any disallowed operation before forwarding completes as a plugin forwarding contract violation.

Command observable emission:

- Verify every overridden Matter command handler in scope emits the command observable added by `subscribeCommand()` as the very last call of the handler:

  ```typescript
  this.endpoint.emitCommand(OnOff, 'offWithEffect', request, this.context);
  ```

- Pass the cluster as the `ClusterType` exported by `@matter/types/clusters/<cluster>`, for example `OnOff` or `BooleanStateConfiguration`. Do not accept `<Cluster>.Cluster`, a behavior type, a behavior id such as `OnOffServer.id`, or a cluster name string: the `ClusterType` form keeps the command name and the request payload checked against the cluster definition.
- Pass the exact command name of the enclosing handler, the request payload, and `this.context`. Use `{}` as the payload for commands that take no request.
- Verify the call goes through the narrowed `this.endpoint`. Do not accept the `emitCommand` helper imported from [matterbridgeEndpointHelpers.ts](../../../packages/core/src/matterbridgeEndpointHelpers.ts) in a behavior that module imports, because the value import closes an import cycle.
- Verify the emission comes after the awaited plugin forwarding, after every validation, and after every state update, including after the `await super.<command>()` call when the handler delegates to the base implementation. No statement may follow it.
- Do not require an emission on a path that rejects the command with a Matter status error, discards it by cluster conformance, or returns early, for example the `MATTERBRIDGE_CHIP_TEST` branch that gates the plugin forwarder off. The observable reports commands that completed.
- Report a missing emission, an emission that is not the last call, an emission placed before validation or state updates, a cluster passed in any form other than the `ClusterType`, a command name that does not match the enclosing handler, a missing `this.context`, or a direct helper import as a command observable emission violation.

Matter specification comments:

- Verify every validation branch or guard and every state update that enforces Matter behavior has an immediately preceding single-line comment in this form:

  ```typescript
  // Matter 1.6.0 § <paragraph>: <short description of the normative rule enforced by this code>.
  ```

- Use the applicable paragraph from the authoritative Matter 1.6.0 specifications under [chip/1.6.0/specs](../../../chip/1.6.0/specs). Do not guess a paragraph number or copy a reference from unrelated code.
- Keep each comment concise and specific to the validation or state update immediately below it. State the observable requirement, including the required status code for validation failures when the specification defines one.
- Add separate comments when adjacent state assignments enforce different normative requirements. Do not use one generic comment to cover multiple assignments with distinct effects.
- Place validation and state-update comments both where the rule is implemented and immediately before each call to a helper that performs the validation or state update. At each call site, use the paragraph for that specific command rather than a combined reference covering other callers.
- Accept a combined paragraph reference only when the same validation or state update implements the same rule for multiple commands, for example `§ 1.8.7.1.2 and § 1.8.7.2.2`.
- Do not accept method-level JSDoc, a distant block comment, a bare paragraph number, a comment without `Matter 1.6.0`, or a comment that describes implementation mechanics without explaining the specification rule.
- Report a missing, misplaced, inaccurate, or incomplete specification comment as a Matter specification comment violation.

Compliant example from [onOffServer.ts](../../../packages/core/src/behaviors/onOffServer.ts), showing the narrowed endpoint, the forwarding order and the trailing emission:

```typescript
export class MatterbridgeOnOffServer extends OnOffServer.with(OnOff.Feature.Lighting) {
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

  override async offWithEffect(request: OnOff.OffWithEffectRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeOnOffServer: switching device off with effect ${request.effectIdentifier} and variant ${request.effectVariant} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('OnOff.offWithEffect', {
      command: 'offWithEffect',
      request,
      cluster: OnOffServer.id,
      attributes: this.state,
      endpoint: this.endpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeOnOffServer: offWithEffect called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.5.7.4.3: On receipt of OffWithEffect, when GlobalSceneControl is TRUE the server SHALL store its settings in the global scene, set GlobalSceneControl to FALSE, set OnOff to FALSE and OnTime to 0; otherwise it SHALL only set OnOff to FALSE.
    await super.offWithEffect(request);
    this.endpoint.emitCommand(OnOff, 'offWithEffect', request, this.context);
  }
}
```

Compliant validation and state update shape, adapted from [booleanStateConfigurationServer.ts](../../../packages/core/src/behaviors/booleanStateConfigurationServer.ts):

```typescript
// Matter 1.6.0 § 1.8.7.1.2 and § 1.8.7.2.2: Reject the command with CONSTRAINT_ERROR if any requested alarm mode is unsupported.
if ([Boolean(alarms.visual && !this.state.alarmsSupported.visual), Boolean(alarms.audible && !this.state.alarmsSupported.audible)].some(Boolean)) {
  throw new StatusResponseError(
    `MatterbridgeBooleanStateConfigurationServer: requested alarm mode is not supported (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    Status.ConstraintError,
  );
}

override async suppressAlarm(request: BooleanStateConfiguration.SuppressAlarmRequest): Promise<void> {
  const device = this.endpoint.stateOf(MatterbridgeServer);
  device.log.info(
    `MatterbridgeBooleanStateConfigurationServer: suppressing alarm ${debugStringify(request.alarmsToSuppress)}${nf} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
  );
  await device.commandHandler.executeHandler('BooleanStateConfiguration.suppressAlarm', {
    command: 'suppressAlarm',
    request,
    cluster: BooleanStateConfigurationServer.id,
    attributes: this.state as unknown as ClusterAttributeValues<(typeof BooleanStateConfiguration)['attributes']>,
    endpoint: this.endpoint,
    context: this.context,
  });
  // Matter 1.6.0 § 1.8.7.1.2: Reject the command with CONSTRAINT_ERROR if any requested alarm mode is unsupported.
  this.#assertAlarmModesSupported(request.alarmsToSuppress);
  // Matter 1.6.0 § 1.8.7.1.2: Reject suppression with INVALID_IN_STATE if a requested alarm mode is inactive or disabled.
  this.#assertSuppressAlarmAllowed(request.alarmsToSuppress);
  // Matter 1.6.0 § 1.8.7.1.2: Set each valid requested mode in AlarmsSuppressed while preserving modes already suppressed.
  this.state.alarmsSuppressed = this.#mergeAlarmsSuppressed(request.alarmsToSuppress);
  this.endpoint.emitCommand(BooleanStateConfiguration, 'suppressAlarm', request, this.context);
}
```

Output requirements:

- List each violation with a concise file and line reference, the log or throw kind, and the current message.
- For each violation, identify whether the server-name prefix, endpoint suffix, or both are invalid.
- List each plugin forwarding contract violation with the command handler, the invalid operation or ordering, and whether the command-entry log is missing or uses the wrong level, the forwarding call is missing, or forwarding is not awaited.
- List each endpoint type narrowing violation with the server class and whether the declaration is missing, an `as MatterbridgeEndpoint` assertion remains, the import is not type-only, or an assertion suppression is now obsolete.
- List each command observable emission violation with the command handler and whether the emission is missing, misplaced, or passes the cluster, command name, payload, or context in the wrong form.
- List each Matter specification comment violation with the validation or state update, whether the comment is missing, misplaced, inaccurate, or incomplete, and the applicable Matter 1.6.0 paragraph when it can be determined.
- Group results by `behaviors` and `devices`.
- If no violations are found, explicitly state that every in-scope log and thrown error starts with the enclosing server name and ends with the required endpoint fragment, every server class narrows `endpoint` with the `declare` declaration and contains no `as MatterbridgeEndpoint` assertion, every command handler respects the plugin forwarding contract, every command handler emits its command observable as its last call using the `ClusterType`, and every Matter validation and state update has an accurate Matter 1.6.0 paragraph comment.
- Do not modify files unless explicitly asked to fix the violations.
- If fixes are requested, preserve each existing message where practical, prepend the exact enclosing server class name and `: `, append the exact endpoint fragment as the final message content, move awaited plugin forwarding before validation and state changes, add the `declare readonly endpoint: MatterbridgeEndpoint;` declaration and remove every `as MatterbridgeEndpoint` assertion and any assertion suppression it makes obsolete, add or move the `this.endpoint.emitCommand(<ClusterType>, '<command>', <request>, this.context)` call to the end of each command handler, add or correct concise Matter 1.6.0 paragraph comments immediately before validations and state updates, then re-run the full verification and report any remaining violations.

Post-edit validation:

- After making any edits, run `npm run format`, `npm run build`, and `npm run lint` from the repository root.
- Always run tests after making any edits. Use `npm run test` for the full test suite or `npm run test -- <testfile>` for a single relevant test file.
- When using a single test file, run the complete file that covers every edited server. Do not rely only on a test-name filter, editor test adapter, source scan, type check, or previously completed test run.
- Treat a test regression as a failed verification. Investigate whether the edit caused the failure and fix edit-related failures before completing the task.
- Re-run any failed edit-related command or test after fixing it.
- Report the result of formatting, build, lint, and tests. If any command cannot be run or any failure remains, report that explicitly with the failing command or test.
