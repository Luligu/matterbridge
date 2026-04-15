---
description: 'How to create MatterbridgeEndpoint instances, register them in Matterbridge plugins, and use the single-class devices exported by the package.'
---

# Matterbridge Endpoint Guide

Use this guide when writing Matterbridge code in this repository or when authoring a plugin that consumes Matterbridge.

## Public imports

- Import core classes, endpoint helpers, and device type definitions from `matterbridge`.
- Import single-class devices from `matterbridge/devices`.

```ts
import {
  MatterbridgeAccessoryPlatform,
  MatterbridgeDynamicPlatform,
  MatterbridgeEndpoint,
  addFixedLabel,
  addUserLabel,
  contactSensor,
  getAttribute,
  onOffLight,
  powerSource,
  setAttribute,
  subscribeAttribute,
  updateAttribute,
} from 'matterbridge';

import { LaundryWasher, RoboticVacuumCleaner } from 'matterbridge/devices';
```

## Create a MatterbridgeEndpoint

`MatterbridgeEndpoint` is the low-level building block for custom Matterbridge devices.

Constructor:

```ts
new MatterbridgeEndpoint(
  definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>,
  options: MatterbridgeEndpointOptions = {},
  debug = false,
)
```

Recommended pattern:

```ts
const device = new MatterbridgeEndpoint([contactSensor, powerSource], { id: 'EntryDoor' })
  .createDefaultIdentifyClusterServer()
  .createDefaultBridgedDeviceBasicInformationClusterServer(
    'Entry Door',
    'ENTRY-DOOR-001',
    0xfff1,
    'Matterbridge',
    'Entry Door Sensor',
  )
  .createDefaultBooleanStateClusterServer(false)
  .createDefaultPowerSourceReplaceableBatteryClusterServer(75)
  .addRequiredClusterServers();
```

Rules that matter:

- `definition` can be a single device type or an array of device types.
- Use multiple device types when the endpoint needs more than one role, for example `[contactSensor, powerSource]`.
- Call one of the Basic Information helpers before `registerDevice()`. Without `deviceName`, `serialNumber`, and `uniqueId`, registration fails.
- Call `addRequiredClusterServers()` at the end of the chain so any required clusters that you did not explicitly create are added automatically.
- Use `addOptionalClusterServers()` only when you really want the optional clusters defined by the selected device type(s).

## MatterbridgeEndpointOptions

`MatterbridgeEndpointOptions` supports:

- `id`: stable storage key for the endpoint.
- `number`: explicit endpoint number when you need one.
- `tagList`: semantic tags used for disambiguation, especially for composed devices or `mode: 'matter'` endpoints.
- `mode`: `undefined`, `'server'`, or `'matter'`.

Mode selection:

- `undefined`: normal bridged endpoint. This is the default for most DynamicPlatform devices.
- `'server'`: create an independent Matter device with its own server node.
- `'matter'`: add the endpoint directly to the Matterbridge server node alongside the aggregator.

Practical guidance:

- Use `mode: undefined` for normal bridged devices shown as children of the bridge.
- Use `mode: 'server'` when the device must be paired independently.
- Use `mode: 'matter'` when the device should be a native Matter endpoint on the server node.
- When using `mode: 'matter'`, respect Matter disambiguation rules and supply a `tagList` when sibling endpoints could be ambiguous.

Implementation details worth remembering:

- Spaces and `.` are removed from the internal endpoint id. The original value is retained as `originalId`.
- Non-Latin ids are normalized to a generated unique id.
- `id` should remain stable across restarts.

## Choose the right Basic Information helper

Use the helper that matches how the endpoint is exposed:

- `createDefaultBasicInformationClusterServer(...)`
  Use for `mode: 'server'`, `mode: 'matter'`, and AccessoryPlatform devices.
- `createDefaultBridgedDeviceBasicInformationClusterServer(...)`
  Use for bridged DynamicPlatform endpoints.

Important behavior:

- `createDefaultBasicInformationClusterServer(...)` sets the metadata on the endpoint.
- For bridged endpoints, `registerDevice()` can add the `BridgedDeviceBasicInformation` cluster automatically when the device is running as a bridged endpoint in bridge mode, or in childbridge mode on a `DynamicPlatform`.
- Explicitly calling `createDefaultBridgedDeviceBasicInformationClusterServer(...)` is clearer for bridged devices and matches the repo examples.

## Register the endpoint from a plugin

In plugin code, prefer `this.registerDevice(device)` instead of calling Matterbridge internals directly.

DynamicPlatform bridged endpoint:

```ts
import { MatterbridgeDynamicPlatform, MatterbridgeEndpoint, onOffLight } from 'matterbridge';

export default function initializePlugin(matterbridge, log, config) {
  return new ExamplePlatform(matterbridge, log, config);
}

class ExamplePlatform extends MatterbridgeDynamicPlatform {
  async onStart(reason) {
    await this.ready;

    const device = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLightPlugin' })
      .createDefaultBridgedDeviceBasicInformationClusterServer(
        'Kitchen Light',
        'LIGHT-001',
        0xfff1,
        'Matterbridge',
        'Matterbridge OnOffLight',
      )
      .addRequiredClusterServers();

    await this.registerDevice(device);
  }
}
```

AccessoryPlatform device:

```ts
import { MatterbridgeAccessoryPlatform, MatterbridgeEndpoint, temperatureSensor } from 'matterbridge';

export default function initializePlugin(matterbridge, log, config) {
  return new ExamplePlatform(matterbridge, log, config);
}

class ExamplePlatform extends MatterbridgeAccessoryPlatform {
  async onStart(reason) {
    await this.ready;

    const device = new MatterbridgeEndpoint(temperatureSensor, { id: 'TemperatureSensorPlugin' })
      .createDefaultBasicInformationClusterServer(
        'Temperature Sensor',
        'TEMP-001',
        0xfff1,
        'Matterbridge',
        0x8000,
        'Matterbridge Temperature Sensor',
      )
      .addRequiredClusterServers();

    await this.registerDevice(device);
  }
}
```

Standalone Matter device from a plugin:

```ts
const device = new MatterbridgeEndpoint(pressureSensor, { id: 'ServerNodeDevice', mode: 'server' })
  .createDefaultBasicInformationClusterServer(
    'Server Node Device',
    'SERVER-001',
    0xfff1,
    'Matterbridge',
    0x8000,
    'Matterbridge Server Node Device',
  )
  .addRequiredClusterServers();

await this.registerDevice(device);
```

Native Matter endpoint on the server node:

```ts
const device = new MatterbridgeEndpoint(pressureSensor, { id: 'MatterNodeDevice', mode: 'matter' })
  .createDefaultBasicInformationClusterServer(
    'Matter Node Device',
    'MATTER-001',
    0xfff1,
    'Matterbridge',
    0x8000,
    'Matterbridge Matter Node Device',
  )
  .addRequiredClusterServers();

await this.registerDevice(device);
```

Plugin rules:

- `await this.ready` before creating or registering devices.
- Always call `this.registerDevice(device)` from the platform.
- Use `this.unregisterDevice(device)` or `this.unregisterAllDevices()` during shutdown or development resets.
- AccessoryPlatform plugins can only expose one normal accessory device. If you need multiple bridged devices, use `MatterbridgeDynamicPlatform`.
- Use stable names and serial numbers so the derived `uniqueId` stays stable.

## Useful MatterbridgeEndpoint helpers

Common helpers on the endpoint instance:

- `hasClusterServer(cluster)`
- `hasAttributeServer(cluster, attribute)`
- `getAttribute(cluster, attribute)`
- `setAttribute(cluster, attribute, value)`
- `updateAttribute(cluster, attribute, value)`
- `subscribeAttribute(cluster, attribute, listener)`
- `addRequiredClusterServers()`
- `addOptionalClusterServers()`

Example:

```ts
await device.updateAttribute('OnOff', 'onOff', true);
```

Cluster references can be passed in several ways:

- behavior type
- cluster type
- cluster id
- cluster name string such as `'OnOff'`

Using the cluster name string is useful in plugins because it avoids importing every cluster type.

## When to use a raw endpoint vs a single-class device

Use a raw `MatterbridgeEndpoint` when:

- you are building a custom combination of device types and clusters
- you want full control over which default cluster servers are created
- you are implementing a plugin-specific device model

Use a single-class device when:

- Matterbridge already ships a class for the device category you need
- you want a working device with sensible default clusters and behaviors
- you prefer a higher-level constructor over manual endpoint assembly

## Single-class devices

Single-class devices are exported from `matterbridge/devices`.

These classes already extend `MatterbridgeEndpoint` and usually do all of the following internally:

- create the correct device type combination
- create Basic Information
- create Power Source when needed
- create the default cluster servers and behavior wiring required by the device

Current exported single-class devices:

- Media: `BasicVideoPlayer`, `CastingVideoPlayer`, `Speaker`
- Matter 1.5 additions: `Closure`, `ClosurePanel`, `IrrigationSystem`, `SoilSensor`
- Robotic: `RoboticVacuumCleaner`
- Appliances: `AirConditioner`, `Cooktop`, `Dishwasher`, `ExtractorHood`, `LaundryDryer`, `LaundryWasher`, `MicrowaveOven`, `Oven`, `Refrigerator`
- Energy: `BatteryStorage`, `Evse`, `HeatPump`, `SolarPower`, `WaterHeater`

### Basic single-class example

```ts
import { LaundryWasher } from 'matterbridge/devices';

const washer = new LaundryWasher('Laundry Washer', 'LW-001');
await this.registerDevice(washer);
```

This is enough because the class constructor already creates the required device types, basic information, power source, and default cluster servers.

### Single-class example with explicit mode

Some single-class devices expose `mode` directly in their constructor. For example:

```ts
import { RoboticVacuumCleaner } from 'matterbridge/devices';

const robot = new RoboticVacuumCleaner('Robot Vacuum', 'RVC-001', 'server');
await this.registerDevice(robot);
```

Use this when the class supports it and you want a standalone or native Matter device instead of a bridged endpoint.

### Composed single-class devices

Some single-class devices are composed devices and need child endpoints added after construction:

- `Oven`: create the oven, then call `addCabinet(...)`
- `Cooktop`: create the cooktop, then call `addSurface(...)`
- `Refrigerator`: create the refrigerator, then call `addCabinet(...)`

Example:

```ts
import { PositionTag } from '@matter/node';
import { Cooktop } from 'matterbridge/devices';

const cooktop = new Cooktop('Cooktop', 'CT-001');
cooktop.addSurface('Surface Top Left', [
  { mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: PositionTag.Top.label },
  { mfgCode: null, namespaceId: PositionTag.Left.namespaceId, tag: PositionTag.Left.tag, label: PositionTag.Left.label },
]);

await this.registerDevice(cooktop);
```

For composed devices and for `mode: 'matter'`, use semantic tags carefully. `tagList` exists to satisfy Matter endpoint disambiguation rules.

## Recommended plugin workflow

For most plugins, follow this order:

1. Wait for `this.ready`.
2. Create the endpoint or single-class device.
3. Set device identity with one of the Basic Information helpers if you are using a raw `MatterbridgeEndpoint`.
4. Add explicit cluster servers you need.
5. Call `addRequiredClusterServers()` last.
6. Register the device with `await this.registerDevice(device)`.
7. Optionally add UI metadata with `setSelectDevice()` and `setSelectEntity()`.

## Avoid these mistakes

- Do not register a raw `MatterbridgeEndpoint` before assigning basic identity metadata.
- Do not use `MatterbridgeAccessoryPlatform` for multiple normal bridged accessories.
- Do not forget that some bridged endpoints need semantic tags for disambiguation.
- Do not assume single-class devices all share the same constructor shape. Check the device class when you need custom defaults or a mode argument.
- Do not call Matterbridge internals directly from plugin code when `registerDevice()` already handles validation and mode-specific setup.

## Short decision guide

- Need a custom sensor, switch, or actuator with a few clusters: use `MatterbridgeEndpoint`.
- Need a supported appliance, robotic, media, energy, closure, irrigation, or soil device: start with `matterbridge/devices`.
- Need one standalone accessory with its own server node: use `mode: 'server'` or a single-class device that exposes it.
- Need multiple bridged devices in a plugin: use `MatterbridgeDynamicPlatform`.
