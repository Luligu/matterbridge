---
name: 'Verify Server Endpoint Context'
description: 'Verify that behavior server logs and thrown errors start with the server name and end with the Matter endpoint id and number'
argument-hint: 'Optional scope, notes, or request to fix violations'
agent: 'agent'
---

Verify endpoint context in Matterbridge behavior server implementations.

Scope:

- Inspect all server implementations in [packages/core/src/behaviors](../../packages/core/src/behaviors).
- Inspect all server classes declared in files under [packages/core/src/devices](../../packages/core/src/devices), including files that also contain device classes or helper code.
- In device files, limit the check to server class bodies. Do not report logs or throws belonging only to device classes or unrelated helpers.

Checks:

- Verify every textual log and throw message in scope starts with the exact name of its enclosing server class followed by a colon and one space. For example:

  ```typescript
  MatterbridgeBooleanStateConfigurationServer:
  ```

- Verify every textual log and throw message in scope ends with this exact fragment:

  ```typescript
  (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})
  ```

- Treat calls to every log level as logs, including `debug`, `info`, `notice`, `warn`, `error`, and `fatal`, whether the logger is accessed through `device.log`, `this.state.log`, `this.log`, or another local reference.
- Verify every error message created by a `throw` statement in scope follows the same prefix and suffix rules, including errors constructed directly in the `throw` and errors assigned to a variable before being thrown.
- Follow local variables and simple helper methods when needed so multiline calls, template literals, and indirectly constructed error messages are not missed.
- Do not accept a missing or abbreviated server name, text before the server name, or a prefix that does not match the enclosing server class name exactly.
- Do not accept alternate endpoint formats, missing parentheses, a colon separator, `endpoint.id`, `endpoint.number`, messages containing only one endpoint component, or any text after the endpoint fragment's closing parenthesis.
- Do not require the fragment in a log or thrown value that has no textual message, but report that case separately for manual review.
- Ignore comments, JSDoc examples, tests, generated output, and imported server implementations.

Plugin forwarding contract:

- For every overridden Matter command handler in scope, verify that forwarding to the plugin through `device.commandHandler.executeHandler(...)` occurs immediately after the command-entry log.
- Before the forwarding call, allow only the minimal local lookup required to access the logger and command handler, such as `const device = this.endpoint.stateOf(MatterbridgeServer)`, followed by the command-entry log.
- Verify only the command-entry log immediately before forwarding uses the `info` level, for example `device.log.info(...)`. A command-entry log at `debug`, `notice`, `warn`, `error`, `fatal`, or any other level is not compliant.
- Do not require any other log to use `info`. Logs outside the command-entry position may use any appropriate log level, but their messages must still satisfy the server-name prefix and endpoint suffix rules.
- The forwarding call must be awaited before execution continues.
- Do not allow request validation, assertions, conditionals, early returns, thrown errors, state reads used for decisions, state changes, event emission, additional logging, or other side effects between the command-entry log and completion of the awaited forwarding call.
- Verify all validation and state mutation occur only after the awaited forwarding call.
- Report a missing command-entry log, command-entry log at a level other than `info`, missing forwarding call, non-awaited forwarding call, or any disallowed operation before forwarding completes as a plugin forwarding contract violation.

Compliant examples from [booleanStateConfigurationServer.ts](../../packages/core/src/behaviors/booleanStateConfigurationServer.ts):

```typescript
throw new StatusResponseError(
  `MatterbridgeBooleanStateConfigurationServer: requested alarm mode is not supported (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
  Status.ConstraintError,
);

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
    endpoint: this.endpoint as MatterbridgeEndpoint,
    context: this.context,
  });
  this.#assertAlarmModesSupported(request.alarmsToSuppress);
}
```

Output requirements:

- List each violation with a concise file and line reference, the log or throw kind, and the current message.
- For each violation, identify whether the server-name prefix, endpoint suffix, or both are invalid.
- List each plugin forwarding contract violation with the command handler, the invalid operation or ordering, and whether the command-entry log is missing or uses the wrong level, the forwarding call is missing, or forwarding is not awaited.
- Group results by `behaviors` and `devices`.
- If no violations are found, explicitly state that every in-scope log and thrown error starts with the enclosing server name and ends with the required endpoint fragment, and every command handler respects the plugin forwarding contract.
- Do not modify files unless I explicitly ask you to fix the violations.
- If fixes are requested, preserve each existing message where practical, prepend the exact enclosing server class name and `: `, append the exact endpoint fragment as the final message content, move awaited plugin forwarding before validation and state changes, then re-run the full verification and report any remaining violations.

Post-edit validation:

- After making any edits, run `npm run format`, `npm run build`, and `npm run lint` from the repository root.
- Always run tests after making any edits. Use `npm run test` for the full test suite or `npm run test -- <testfile>` for a single relevant test file.
- When using a single test file, run the complete file that covers every edited server. Do not rely only on a test-name filter, editor test adapter, source scan, type check, or previously completed test run.
- Treat a test regression as a failed verification. Investigate whether the edit caused the failure and fix edit-related failures before completing the task.
- Re-run any failed edit-related command or test after fixing it.
- Report the result of formatting, build, lint, and tests. If any command cannot be run or any failure remains, report that explicitly with the failing command or test.
