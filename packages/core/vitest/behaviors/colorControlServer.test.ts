/**
 * @file packages/core/vitest/behaviors/colorControlServer.test.ts
 * @description This file contains the tests for colorControlServer.
 * @author Luca Liguori
 */

const NAME = 'ColorControlServer';
const MATTER_PORT = 13200;
const MATTER_CREATE_ONLY = true;

import { Status } from '@matter/types';
import { ColorControl } from '@matter/types/clusters/color-control';
import { OnOff } from '@matter/types/clusters/on-off';
import { setupTest } from '@matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  getEnhancedMoveHueRequest,
  getEnhancedMoveToHueAndSaturationRequest,
  getEnhancedMoveToHueRequest,
  getEnhancedStepHueRequest,
  getMoveColorRequest,
  getMoveColorTemperatureRequest,
  getMoveHueRequest,
  getMoveSaturationRequest,
  getMoveToColorRequest,
  getMoveToColorTemperatureRequest,
  getMoveToHueAndSaturationRequest,
  getMoveToHueRequest,
  getMoveToSaturationRequest,
  getStepColorRequest,
  getStepColorTemperatureRequest,
  getStepHueRequest,
  getStepSaturationRequest,
  getStopMoveStepRequest,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';

import { MatterbridgeColorControlServer } from '../../src/behaviors/colorControlServer.js';
import { bridge, extendedColorLight, lightSensor, occupancySensor, onOffLight, powerSource } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { expectCommand } from '../vitestUtils.js';

// Setup the test environment
await setupTest(NAME, false);

describe('MatterbridgeColorControlServer', () => {
  let light: MatterbridgeEndpoint;
  let enhancedLight: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();

    // Destroy the Matter test environment
    await destroyTestEnvironment();

    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('Device type: extendedLight', async () => {
    light = new MatterbridgeEndpoint([extendedColorLight, bridge, powerSource], { id: 'extendedColorLight' });
    light.createDefaultBridgedDeviceBasicInformationClusterServer('Extended Color Light', 'SN12345678');
    light.createDefaultPowerSourceWiredClusterServer();
    light.addRequiredClusterServers();
    expect(light).toBeDefined();

    light.addChildDeviceType('illuminance', lightSensor).addRequiredClusterServers();
    light.addChildDeviceType('motion', occupancySensor).addRequiredClusterServers();

    expect(await addDevice(aggregator, light)).toBeTruthy();
  });

  test('Device type: enhancedLight', async () => {
    enhancedLight = new MatterbridgeEndpoint([onOffLight, bridge, powerSource], { id: 'enhancedLight' });
    enhancedLight.createDefaultBridgedDeviceBasicInformationClusterServer('Enhanced Light', 'SN87654321');
    enhancedLight.createDefaultPowerSourceWiredClusterServer();
    enhancedLight.createDefaultOnOffClusterServer(true);
    enhancedLight.createEnhancedColorControlClusterServer();
    enhancedLight.addRequiredClusterServers();
    expect(enhancedLight).toBeDefined();
    expect(await addDevice(aggregator, enhancedLight)).toBeTruthy();
  });

  test('ColorControl server', async () => {
    // Every ColorControl command honours the Options/ExecuteIfOff gate, so on an endpoint that is off they return
    // early without touching any attribute. Turn the light on first, otherwise the assertions below would be
    // asserting a no-op.
    await light.setAttribute(OnOff, 'onOff', true);

    // Each command below is asserted twice: expectCommand() proves the request reached the Matterbridge command
    // handler, and the attribute assertions after it prove the forwarder went on to call super.<command>(), which
    // is what actually applies the Matter state change. Without the second half, dropping the super call from a
    // forwarder would still pass.
    //
    // Every hue/saturation, x/y and color-temperature command settles ColorMode/EnhancedColorMode through
    // matter.js's setColorMode(). setColorMode() returns early when the mode is already the requested one, so each
    // rate/step command is preceded by forceColorMode() with a different mode: the assertion then only holds if
    // the command itself moved it back.
    // EnhancedColorMode is a superset of ColorMode (it adds EnhancedCurrentHueAndCurrentSaturation), and
    // setColorMode() writes both, so each ColorMode used here is paired with its EnhancedColorMode counterpart.
    const enhancedOf: Record<ColorControl.ColorMode, ColorControl.EnhancedColorMode> = {
      [ColorControl.ColorMode.CurrentHueAndCurrentSaturation]: ColorControl.EnhancedColorMode.CurrentHueAndCurrentSaturation,
      [ColorControl.ColorMode.CurrentXAndCurrentY]: ColorControl.EnhancedColorMode.CurrentXAndCurrentY,
      [ColorControl.ColorMode.ColorTemperatureMireds]: ColorControl.EnhancedColorMode.ColorTemperatureMireds,
    };
    const expectColorMode = (mode: ColorControl.ColorMode): void => {
      expect(light.getAttribute(ColorControl, 'colorMode')).toBe(mode);
      expect(light.getAttribute(ColorControl, 'enhancedColorMode')).toBe(enhancedOf[mode]);
    };
    const forceColorMode = async (mode: ColorControl.ColorMode): Promise<void> => {
      await light.setAttribute(ColorControl, 'colorMode', mode);
      await light.setAttribute(ColorControl, 'enhancedColorMode', enhancedOf[mode]);
      // The sentinel is only meaningful if it actually took effect.
      expectColorMode(mode);
    };

    const moveToHueRequest = getMoveToHueRequest(180, 0, false);
    await expectCommand(light, ColorControl, 'moveToHue', moveToHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectColorMode(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
    expect(light.getAttribute(ColorControl, 'currentHue')).toBe(180);

    const moveToSaturationRequest = getMoveToSaturationRequest(100, 0, false);
    await expectCommand(light, ColorControl, 'moveToSaturation', moveToSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectColorMode(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
    expect(light.getAttribute(ColorControl, 'currentSaturation')).toBe(100);

    const moveToHueAndSaturationRequest = getMoveToHueAndSaturationRequest(180, 100, 0, false);
    await expectCommand(light, ColorControl, 'moveToHueAndSaturation', moveToHueAndSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectColorMode(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
    expect(light.getAttribute(ColorControl, 'currentHue')).toBe(180);
    expect(light.getAttribute(ColorControl, 'currentSaturation')).toBe(100);

    const moveToColorRequest = getMoveToColorRequest(30000, 30000, 0, false);
    await expectCommand(light, ColorControl, 'moveToColor', moveToColorRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectColorMode(ColorControl.ColorMode.CurrentXAndCurrentY);
    expect(light.getAttribute(ColorControl, 'currentX')).toBe(30000);
    expect(light.getAttribute(ColorControl, 'currentY')).toBe(30000);

    const moveToColorTemperatureRequest = getMoveToColorTemperatureRequest(250, 0, false);
    await expectCommand(light, ColorControl, 'moveToColorTemperature', moveToColorTemperatureRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectColorMode(ColorControl.ColorMode.ColorTemperatureMireds);
    expect(light.getAttribute(ColorControl, 'colorTemperatureMireds')).toBe(250);

    await forceColorMode(ColorControl.ColorMode.ColorTemperatureMireds);
    const moveHueRequest = getMoveHueRequest(ColorControl.MoveMode.Up, 5, false);
    await expectCommand(light, ColorControl, 'ColorControl.moveHue', moveHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectColorMode(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);

    await forceColorMode(ColorControl.ColorMode.ColorTemperatureMireds);
    const stepHueRequest = getStepHueRequest(ColorControl.StepMode.Up, 10, 3, false);
    await expectCommand(light, ColorControl, 'ColorControl.stepHue', stepHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectColorMode(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);

    await forceColorMode(ColorControl.ColorMode.ColorTemperatureMireds);
    const moveSaturationRequest = getMoveSaturationRequest(ColorControl.MoveMode.Up, 5, false);
    await expectCommand(light, ColorControl, 'ColorControl.moveSaturation', moveSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectColorMode(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);

    await forceColorMode(ColorControl.ColorMode.ColorTemperatureMireds);
    const stepSaturationRequest = getStepSaturationRequest(ColorControl.StepMode.Up, 10, 3, false);
    await expectCommand(light, ColorControl, 'ColorControl.stepSaturation', stepSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectColorMode(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);

    await forceColorMode(ColorControl.ColorMode.ColorTemperatureMireds);
    const moveColorRequest = getMoveColorRequest(100, 100, false);
    await expectCommand(light, ColorControl, 'ColorControl.moveColor', moveColorRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectColorMode(ColorControl.ColorMode.CurrentXAndCurrentY);

    await forceColorMode(ColorControl.ColorMode.ColorTemperatureMireds);
    const stepColorRequest = getStepColorRequest(100, 100, 3, false);
    await expectCommand(light, ColorControl, 'ColorControl.stepColor', stepColorRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectColorMode(ColorControl.ColorMode.CurrentXAndCurrentY);

    await forceColorMode(ColorControl.ColorMode.CurrentXAndCurrentY);
    const moveColorTemperatureRequest = getMoveColorTemperatureRequest(ColorControl.MoveMode.Up, 5, 153, 500, false);
    await expectCommand(light, ColorControl, 'ColorControl.moveColorTemperature', moveColorTemperatureRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectColorMode(ColorControl.ColorMode.ColorTemperatureMireds);

    await forceColorMode(ColorControl.ColorMode.CurrentXAndCurrentY);
    const stepColorTemperatureRequest = getStepColorTemperatureRequest(ColorControl.StepMode.Up, 10, 3, 153, 500, false);
    await expectCommand(light, ColorControl, 'ColorControl.stepColorTemperature', stepColorTemperatureRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectColorMode(ColorControl.ColorMode.ColorTemperatureMireds);

    // StopMoveStep sets no ColorMode of its own: its observable effect is stopping an in-flight transition. matter.js
    // only runs transitions when managedTransitionTimeHandling is on (off by default, so every command above applied
    // its change immediately), so it is enabled just for this step and turned off again afterwards to leave no timer
    // running past the test.
    await light.setStateOf(MatterbridgeColorControlServer, { managedTransitionTimeHandling: true });
    await light.invokeBehaviorCommand(ColorControl, 'moveToHue', getMoveToHueRequest(0, 100, false));
    expect(light.getAttribute(ColorControl, 'remainingTime')).toBeGreaterThan(0);

    const stopMoveStepRequest = getStopMoveStepRequest(false);
    await expectCommand(light, ColorControl, 'ColorControl.stopMoveStep', stopMoveStepRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expect(light.getAttribute(ColorControl, 'remainingTime')).toBe(0);
    await light.setStateOf(MatterbridgeColorControlServer, { managedTransitionTimeHandling: false });
  });

  test('The Matterbridge command handler runs before matter.js validates the command', async () => {
    // Every Matterbridge cluster server forwards to the plugin command handler first and only then calls super,
    // deliberately performing no pre-validation of its own: a plugin must see the command even when matter.js goes
    // on to reject it. StepHue with StepSize 0 is rejected by matter.js with INVALID_COMMAND (Matter 1.6
    // Application Cluster Spec Sec 3.2.11.5), so it pins the ordering down from both sides.
    //
    // A dedicated endpoint is used because only the first handler registered for a command name is executed, and
    // the tests above already registered one for every ColorControl command on `light`.
    const validationLight = new MatterbridgeEndpoint([extendedColorLight, bridge, powerSource], { id: 'validationLight' });
    validationLight.createDefaultBridgedDeviceBasicInformationClusterServer('Validation Light', 'SN11223344');
    validationLight.addRequiredClusterServers();
    expect(await addDevice(aggregator, validationLight)).toBeTruthy();
    await validationLight.setAttribute(OnOff, 'onOff', true);

    const stepHueCalls: Array<{ cluster: string; request: object }> = [];
    validationLight.addCommandHandler('ColorControl.stepHue', (data) => {
      stepHueCalls.push({ cluster: data.cluster, request: data.request });
    });

    const invalidStepHueRequest = getStepHueRequest(ColorControl.StepMode.Up, 0, 3, false);
    await expect(validationLight.invokeBehaviorCommand(ColorControl, 'stepHue', invalidStepHueRequest)).rejects.toMatchObject({ code: Status.InvalidCommand });

    // The handler ran with the rejected request...
    expect(stepHueCalls).toEqual([{ cluster: 'colorControl', request: invalidStepHueRequest }]);
    // ...and matter.js still refused to apply it.
    expect(validationLight.getAttribute(ColorControl, 'colorMode')).toBe(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
    expect(validationLight.getAttribute(ColorControl, 'currentHue')).toBe(0);
  });

  test('EnhancedColorControl server', async () => {
    const expectEnhancedColorAttributes = (expected: {
      colorMode: number;
      enhancedColorMode: number;
      currentHue: number;
      enhancedCurrentHue: number;
      currentSaturation: number;
      currentX: number;
      currentY: number;
      colorTemperatureMireds: number;
    }): void => {
      expect(enhancedLight.getAttribute(ColorControl.id, 'colorMode')).toBe(expected.colorMode);
      expect(enhancedLight.getAttribute(ColorControl.id, 'enhancedColorMode')).toBe(expected.enhancedColorMode);
      expect(enhancedLight.getAttribute(ColorControl.id, 'currentHue')).toBe(expected.currentHue);
      expect(enhancedLight.getAttribute(ColorControl.id, 'enhancedCurrentHue')).toBe(expected.enhancedCurrentHue);
      expect(enhancedLight.getAttribute(ColorControl.id, 'currentSaturation')).toBe(expected.currentSaturation);
      expect(enhancedLight.getAttribute(ColorControl.id, 'currentX')).toBe(expected.currentX);
      expect(enhancedLight.getAttribute(ColorControl.id, 'currentY')).toBe(expected.currentY);
      expect(enhancedLight.getAttribute(ColorControl.id, 'colorTemperatureMireds')).toBe(expected.colorTemperatureMireds);
    };

    const moveToHueRequest = getMoveToHueRequest(180, 0, false);
    await expectCommand(enhancedLight, ColorControl, 'moveToHue', moveToHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      currentHue: 180,
      enhancedCurrentHue: 0,
      currentSaturation: 0,
      currentX: 0,
      currentY: 0,
      colorTemperatureMireds: 500,
    });

    const enhancedMoveToHueRequest = getEnhancedMoveToHueRequest(32000, 0, false);
    await expectCommand(enhancedLight, ColorControl, 'enhancedMoveToHue', enhancedMoveToHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
      expect(data.attributes.enhancedCurrentHue).toBe(0);
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 0,
      currentX: 0,
      currentY: 0,
      colorTemperatureMireds: 500,
    });

    const moveToSaturationRequest = getMoveToSaturationRequest(100, 0, false);
    await expectCommand(enhancedLight, ColorControl, 'moveToSaturation', moveToSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 100,
      currentX: 0,
      currentY: 0,
      colorTemperatureMireds: 500,
    });

    const moveToHueAndSaturationRequest = getMoveToHueAndSaturationRequest(180, 100, 0, false);
    await expectCommand(enhancedLight, ColorControl, 'moveToHueAndSaturation', moveToHueAndSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 100,
      currentX: 0,
      currentY: 0,
      colorTemperatureMireds: 500,
    });

    const enhancedMoveToHueAndSaturationRequest = getEnhancedMoveToHueAndSaturationRequest(32000, 100, 0, false);
    await expectCommand(enhancedLight, ColorControl, 'enhancedMoveToHueAndSaturation', enhancedMoveToHueAndSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
      expect(data.attributes.enhancedCurrentHue).toBe(32000);
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 100,
      currentX: 0,
      currentY: 0,
      colorTemperatureMireds: 500,
    });

    const moveToColorRequest = getMoveToColorRequest(30000, 30000, 0, false);
    await expectCommand(enhancedLight, ColorControl, 'moveToColor', moveToColorRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentXAndCurrentY,
      enhancedColorMode: ColorControl.EnhancedColorMode.CurrentXAndCurrentY,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 100,
      currentX: 30000,
      currentY: 30000,
      colorTemperatureMireds: 500,
    });

    const moveToColorTemperatureRequest = getMoveToColorTemperatureRequest(250, 0, false);
    await expectCommand(enhancedLight, ColorControl, 'moveToColorTemperature', moveToColorTemperatureRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.ColorTemperatureMireds,
      enhancedColorMode: ColorControl.EnhancedColorMode.ColorTemperatureMireds,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 100,
      currentX: 30000,
      currentY: 30000,
      colorTemperatureMireds: 250,
    });

    const enhancedMoveHueRequest = getEnhancedMoveHueRequest(ColorControl.MoveMode.Up, 5, false);
    await expectCommand(enhancedLight, ColorControl, 'ColorControl.enhancedMoveHue', enhancedMoveHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const enhancedStepHueRequest = getEnhancedStepHueRequest(ColorControl.StepMode.Up, 10, 3, false);
    await expectCommand(enhancedLight, ColorControl, 'ColorControl.enhancedStepHue', enhancedStepHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
  });
});
