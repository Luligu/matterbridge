## Summary

Allow users to rename bridged Home Assistant devices from the Matterbridge WebUI. The chosen Matter `nodeLabel` is applied immediately and persisted in the plugin configuration so it survives Matterbridge restarts.

## Changes

- Add an editable device-name action to the Home devices view.
- Send rename requests through the Matterbridge frontend WebSocket API.
- Validate and persist `deviceNameOverrides` for `matterbridge-hass` devices.
- Apply overrides after bridged endpoints have been registered, avoiding writes to uninitialized cluster servers.
- Add frontend, WebSocket-handler, and platform registration tests; document the configuration field.

## Testing

- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] Run relevant frontend and core tests using the repository scripts.
- [x] Manually verified in Matterbridge 3.10.13: rename through WebUI, restart Matterbridge, confirm name persists.

## Related issue

Closes/relates to [#209](https://github.com/Luligu/matterbridge/issues/209).
