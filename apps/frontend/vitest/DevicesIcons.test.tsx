import '@testing-library/jest-dom/vitest';

import { EndpointNumber } from '@matter/types/datatype';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DevicesIcons from '../src/components/DevicesIcons';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';
import type { ApiDevice, Cluster, WsMessageApiResponse } from '../src/utils/backendShared';

describe('DevicesIcons', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render all supported device icon values when cluster data is available', async () => {
    const socket = createSocket();
    const device = createDevice();
    const clusters = createFullDeviceClusters();

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesIcons filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();
    loadDevice(socket, device, clusters);

    expect((await screen.findAllByText('Controller Test')).length).toBeGreaterThan(1);
    expectText('Online');
    expectText('Offline');
    expectText('AC');
    expectText('Front');
    expectText('3300 mV');
    expect(screen.getAllByText('Controller')).toHaveLength(9);
    expect(screen.getAllByText('On').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText('Off').length).toBeGreaterThanOrEqual(2);
    expectText('Level 128');
    expectText('Level 64');
    expectText('Normal');
    expect(screen.getAllByText('Error')).toHaveLength(2);
    expectText('Oven');
    expectText('Fridge');
    expectText('Cooktop');
    expectText('Position 50%');
    expectText('Closure');
    expectText('Heat 21°C Cool 25°C');
    expectText('Locked');
    expectText('Unlocked');
    expectText('Medium');
    expectText('Speed 33%');
    expectText('Eco');
    expectText('Leak');
    expectText('No freeze');
    expectText('Rain');
    expectText('Cleaning');
    expectText('Auto');
    expectText('Speed 45%');
    expectText('Free');
    expectText('Tank 75%');
    expectText('HeatPump');
    expectText('Solar');
    expectText('Inverter');
    expectText('Camera');
    expectText('Floodlight');
    expectText('Video bell');
    expectText('Intercom');
    expectText('Snapshot');
    expectText('Cam ctrl');
    expectText('Chime');
    expectText('Doorbell');
    expectText('Audio bell');
    expectText('No smoke');
    expectText('Co!');
    expectText('Closed');
    expectText('Opened');
    expectText('Irrigation');
    expectText('Good');
    expectText('Occupied');
    expectText('Unocc.');
    expectText('No leak');
    expectText('Freeze');
    expectText('No rain');
    expectText('Battery');
    expect(screen.getAllByText('---').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Controller On')).toBeNull();
    expect(socket.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/devices' }));
    expect(socket.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/clusters' }));
  });

  it('should not lose any device when multiple /api/clusters responses arrive in the same render batch', async () => {
    // Regression test for a stale-closure race in clusterUpdate: it used to mutate the
    // endpoints/deviceTypes/clusters state objects captured by a useCallback memoized on those
    // same state values, then call setState({ ...mutatedObject }). When several /api/clusters
    // responses were handled back-to-back before React committed a render between them (exactly
    // what happens on page reload, since /api/devices fires one /api/clusters request per device
    // in a tight loop), every handler invocation shared the same stale object reference, so all
    // but the last commit in the batch were silently discarded - devices vanished at random.
    const socket = createSocket();
    const deviceCount = 5;
    const devices = Array.from({ length: deviceCount }, (_, i) => createDevice({ serial: `FAN-${i}`, uniqueId: `fan-${i}`, name: `Fan ${i}` }));
    const clustersFor = (i: number) => [
      createCluster('1', 'main', 0x002b, 'FanControl', 'fanMode', String(i), i),
      createCluster('1', 'main', 0x002b, 'FanControl', 'percentCurrent', String(i * 10), i * 10),
    ];

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesIcons filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();

    const devicesMessage: WsMessageApiResponse = { id: 1, src: 'Matterbridge', dst: 'Frontend', method: '/api/devices', success: true, response: devices };
    const clusterMessages: WsMessageApiResponse[] = devices.map((device, i) => ({
      id: 1,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/clusters',
      success: true,
      response: {
        plugin: device.pluginName,
        deviceName: device.name,
        serialNumber: device.serial,
        number: EndpointNumber(1),
        id: 'main',
        deviceTypes: [0x002b],
        clusters: clustersFor(i),
      },
    }));

    // Fire /api/devices and every device's /api/clusters response together, in one synchronous
    // batch, so clusterUpdate is invoked deviceCount times before React re-renders in between.
    socket.emitBatch([devicesMessage, ...clusterMessages]);

    await waitFor(() => {
      expect(screen.getAllByText(/^Fan \d$/).length).toBe(deviceCount);
    });
    const fanModeLookup = ['Off', 'Low', 'Medium', 'High', 'On'];
    for (let i = 0; i < deviceCount; i++) {
      expectText(fanModeLookup[i]);
      expectText(`Speed ${i * 10}%`);
    }
  });

  it('should render controller labels without normal switch or level values for controller device types', async () => {
    const socket = createSocket();
    const device = createDevice();
    const controllerTypes = [0x0103, 0x0104, 0x0105, 0x0840];
    const clusters = controllerTypes.flatMap((deviceType, index) => {
      const endpoint = String(index + 1);
      return [
        createCluster(endpoint, `Controller${index + 1}`, deviceType, 'Descriptor', 'clusterRevision', '1', 1),
        createCluster(endpoint, `Controller${index + 1}`, deviceType, 'OnOff', 'onOff', 'true', true),
        createCluster(endpoint, `Controller${index + 1}`, deviceType, 'LevelControl', 'currentLevel', '128', 128),
      ];
    });

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesIcons filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();
    loadDevice(socket, device, clusters);

    expect(await screen.findAllByText('Controller')).toHaveLength(4);
    expect(screen.queryByText('On')).toBeNull();
    expect(screen.queryByText('Level 128')).toBeNull();
  });

  it('should send refresh requests and ignore empty cluster responses', async () => {
    const socket = createSocket(false);

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesIcons filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();

    socket.emit({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'refresh_required', success: true, response: { changed: 'devices' } });
    socket.emit({
      id: 1,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/clusters',
      success: true,
      response: { plugin: 'matterbridge-test', deviceName: 'Empty', serialNumber: 'EMPTY-001', number: EndpointNumber(1), id: 'main', deviceTypes: [], clusters: [] },
    });

    expect(socket.sendMessage).toHaveBeenCalledTimes(1);
    expect(socket.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/devices' }));
    expect(screen.queryByText('Empty')).toBeNull();
  });

  it('should update rendered cluster values when state updates arrive', async () => {
    const socket = createSocket();
    const device = createDevice({ name: 'State Update Device', serial: 'STATE-001' });
    const clusters = [createCluster('1', 'Light', 0x0100, 'OnOff', 'onOff', 'false', false)];

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesIcons filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();
    loadDevice(socket, device, clusters);
    expect(await screen.findByText('Off')).toBeInTheDocument();

    await waitFor(() => expect(socket.removeListener).toHaveBeenCalled());
    socket.emit({
      id: 0,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: 'state_update',
      success: true,
      response: {
        plugin: device.pluginName,
        serialNumber: device.serial,
        uniqueId: device.uniqueId,
        number: EndpointNumber(1),
        id: 'Light',
        cluster: 'OnOff',
        attribute: 'onOff',
        value: true,
      },
    });

    expect(await screen.findByText('On')).toBeInTheDocument();
    expect(screen.queryByText('Off')).toBeNull();
  });

  it('should ignore state updates for unknown devices and clusters', async () => {
    const socket = createSocket();
    const device = createDevice({ name: 'Ignored State Device', serial: 'IGNORED-001' });
    const clusters = [createCluster('1', 'Light', 0x0100, 'OnOff', 'onOff', 'false', false)];

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesIcons filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();
    socket.emit(createStateUpdate({ serialNumber: 'MISSING-001', value: true }));
    loadDevice(socket, device, clusters);
    expect(await screen.findByText('Off')).toBeInTheDocument();

    await waitFor(() => expect(socket.removeListener).toHaveBeenCalled());
    socket.emit(createStateUpdate({ serialNumber: device.serial, attribute: 'missingAttribute', value: true }));

    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(screen.queryByText('On')).toBeNull();
  });

  it('should filter devices by plugin, device name, and serial number', async () => {
    const socket = createSocket();
    const device = createDevice({ name: 'Visible Controller', serial: 'VISIBLE-001', pluginName: 'matterbridge-visible' });
    const clusters = [createCluster('1', 'Visible', 0x0840, 'Descriptor', 'clusterRevision', '1', 1)];

    const { rerender } = render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesIcons filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();
    loadDevice(socket, device, clusters);
    expect(await screen.findByText('Visible Controller')).toBeInTheDocument();

    rerender(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesIcons filterPlugins="other-plugin" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await waitFor(() => expect(screen.queryByText('Visible Controller')).toBeNull());

    rerender(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesIcons filterPlugins="matterbridge-visible" filterDevices="controller" />
      </WebSocketContext.Provider>,
    );
    expect(await screen.findByText('Visible Controller')).toBeInTheDocument();

    rerender(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesIcons filterPlugins="matterbridge-visible" filterDevices="VISIBLE-001" />
      </WebSocketContext.Provider>,
    );
    expect(await screen.findByText('Visible Controller')).toBeInTheDocument();

    rerender(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesIcons filterPlugins="matterbridge-visible" filterDevices="missing" />
      </WebSocketContext.Provider>,
    );
    await waitFor(() => expect(screen.queryByText('Visible Controller')).toBeNull());
  });

  it('should remove the websocket listener on unmount', async () => {
    const socket = createSocket();
    const rendered = render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesIcons filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();

    rendered.unmount();

    expect(socket.removeListener).toHaveBeenCalledTimes(1);
  });

  describe.each([
    { deviceType: 0x002b, name: 'Fan' },
    { deviceType: 0x002d, name: 'AirPurifier' },
  ])('FanControl rendering for $name', ({ deviceType, name }) => {
    it('renders fanMode 0 as "Off", not the "---" empty placeholder', async () => {
      const socket = createSocket();
      const device = createDevice({ name: `${name} Off`, serial: `${name}-OFF`, uniqueId: `${name}-off` });
      const clusters = [createCluster('1', 'main', deviceType, 'FanControl', 'fanMode', '0', 0), createCluster('1', 'main', deviceType, 'FanControl', 'percentCurrent', '0', 0)];

      render(
        <WebSocketContext.Provider value={socket.context}>
          <DevicesIcons filterPlugins="All plugins" filterDevices="" />
        </WebSocketContext.Provider>,
      );
      await socket.ready();
      loadDevice(socket, device, clusters);

      expect(await screen.findByText('Off')).toBeInTheDocument();
      expect(screen.getByText('Speed 0%')).toBeInTheDocument();
      expect(screen.queryByText('---')).toBeNull();
    });

    it('falls back to "Unknown" for a fanMode value outside FanModeLookup', async () => {
      const socket = createSocket();
      const device = createDevice({ name: `${name} Weird`, serial: `${name}-WEIRD`, uniqueId: `${name}-weird` });
      const clusters = [createCluster('1', 'main', deviceType, 'FanControl', 'fanMode', '99', 99)];

      render(
        <WebSocketContext.Provider value={socket.context}>
          <DevicesIcons filterPlugins="All plugins" filterDevices="" />
        </WebSocketContext.Provider>,
      );
      await socket.ready();
      loadDevice(socket, device, clusters);

      expect(await screen.findByText('Unknown')).toBeInTheDocument();
    });

    it('renders only "Speed X%" details, with no fan mode icon, when fanMode is absent', async () => {
      const socket = createSocket();
      const device = createDevice({ name: `${name} NoMode`, serial: `${name}-NOMODE`, uniqueId: `${name}-nomode` });
      const clusters = [createCluster('1', 'main', deviceType, 'FanControl', 'percentCurrent', '77', 77)];

      render(
        <WebSocketContext.Provider value={socket.context}>
          <DevicesIcons filterPlugins="All plugins" filterDevices="" />
        </WebSocketContext.Provider>,
      );
      await socket.ready();
      loadDevice(socket, device, clusters);

      expect(await screen.findByText('Speed 77%')).toBeInTheDocument();
      for (const mode of ['Off', 'Low', 'Medium', 'High', 'On', 'Auto', 'Smart']) expect(screen.queryByText(mode)).toBeNull();
    });

    it('live-updates both the fanMode icon text and the percent details on state_update', async () => {
      const socket = createSocket();
      const device = createDevice({ name: `${name} Live`, serial: `${name}-LIVE`, uniqueId: `${name}-live` });
      const clusters = [createCluster('1', 'main', deviceType, 'FanControl', 'fanMode', '1', 1), createCluster('1', 'main', deviceType, 'FanControl', 'percentCurrent', '10', 10)];

      render(
        <WebSocketContext.Provider value={socket.context}>
          <DevicesIcons filterPlugins="All plugins" filterDevices="" />
        </WebSocketContext.Provider>,
      );
      await socket.ready();
      loadDevice(socket, device, clusters);
      expect(await screen.findByText('Low')).toBeInTheDocument();
      expect(screen.getByText('Speed 10%')).toBeInTheDocument();

      await waitFor(() => expect(socket.removeListener).toHaveBeenCalled());
      socket.emit(
        createStateUpdate({ plugin: device.pluginName, serialNumber: device.serial, uniqueId: device.uniqueId, id: 'main', cluster: 'FanControl', attribute: 'fanMode', value: 3 }),
      );
      socket.emit(
        createStateUpdate({
          plugin: device.pluginName,
          serialNumber: device.serial,
          uniqueId: device.uniqueId,
          id: 'main',
          cluster: 'FanControl',
          attribute: 'percentCurrent',
          value: 80,
        }),
      );

      expect(await screen.findByText('High')).toBeInTheDocument();
      expect(screen.getByText('Speed 80%')).toBeInTheDocument();
      expect(screen.queryByText('Low')).toBeNull();
      expect(screen.queryByText('Speed 10%')).toBeNull();
    });
  });
});

interface TestSocket {
  context: WebSocketContextType;
  sendMessage: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  ready: () => Promise<void>;
  emit: (message: WsMessageApiResponse) => void;
  emitBatch: (messages: WsMessageApiResponse[]) => void;
}

function expectText(text: string): void {
  expect(screen.getAllByText(text).length).toBeGreaterThan(0);
}

function createSocket(online = true): TestSocket {
  let listener: ((msg: WsMessageApiResponse) => void) | undefined;
  const sendMessage = vi.fn();
  const removeListener = vi.fn();
  const context: WebSocketContextType = {
    logLength: { current: 200 },
    logFilterLevel: 'info',
    logFilterSearch: '*',
    logAutoScroll: { current: true },
    setMessages: vi.fn(),
    setLogFilterLevel: vi.fn(),
    setLogFilterSearch: vi.fn(),
    filterLogMessages: vi.fn(),
    online,
    retry: 1,
    getUniqueId: () => 1,
    addListener: (handler) => {
      listener = handler;
    },
    removeListener,
    sendMessage,
    logMessage: vi.fn(),
  };

  return {
    context,
    sendMessage,
    removeListener,
    ready: async () => waitFor(() => expect(listener).toBeDefined()),
    emit: (message) => {
      act(() => {
        listener?.(message);
      });
    },
    // Fires every message inside a single act() so all handler invocations run back-to-back
    // before React commits a render between them, reproducing near-simultaneous WebSocket delivery.
    emitBatch: (messages) => {
      act(() => {
        for (const message of messages) listener?.(message);
      });
    },
  };
}

function loadDevice(socket: TestSocket, device: ApiDevice, clusters: Cluster[]): void {
  socket.emit({ id: 1, src: 'Matterbridge', dst: 'Frontend', method: '/api/devices', success: true, response: [device] });
  socket.emit({
    id: 1,
    src: 'Matterbridge',
    dst: 'Frontend',
    method: '/api/clusters',
    success: true,
    response: {
      plugin: device.pluginName,
      deviceName: device.name,
      serialNumber: device.serial,
      number: EndpointNumber(1),
      id: 'main',
      deviceTypes: [...new Set(clusters.flatMap((cluster) => cluster.deviceTypes))],
      clusters,
    },
  });
}

function createStateUpdate(
  overrides: Partial<Extract<WsMessageApiResponse, { method: 'state_update' }>['response']> = {},
): Extract<WsMessageApiResponse, { method: 'state_update' }> {
  return {
    id: 0,
    src: 'Matterbridge',
    dst: 'Frontend',
    method: 'state_update',
    success: true,
    response: {
      plugin: 'matterbridge-test',
      serialNumber: 'CONTROLLER-001',
      uniqueId: 'controller-test',
      number: EndpointNumber(1),
      id: 'Light',
      cluster: 'OnOff',
      attribute: 'onOff',
      value: true,
      ...overrides,
    },
  };
}

function createDevice(overrides: Partial<ApiDevice> = {}): ApiDevice {
  return {
    pluginName: 'matterbridge-test',
    type: 'DynamicPlatform',
    endpoint: undefined,
    name: 'Controller Test',
    serial: 'CONTROLLER-001',
    productUrl: '',
    uniqueId: 'controller-test',
    reachable: true,
    cluster: '',
    ...overrides,
  };
}

function createFullDeviceClusters(): Cluster[] {
  const clusters: Cluster[] = [];
  let endpoint = 1;
  const add = (deviceType: number, id: string, entries: Array<[string, string, string, unknown]>) => {
    const endpointNumber = String(endpoint++);
    clusters.push(
      ...entries.map(([clusterName, attributeName, attributeValue, attributeLocalValue]) =>
        createCluster(endpointNumber, id, deviceType, clusterName, attributeName, attributeValue, attributeLocalValue),
      ),
    );
  };

  add(0x0013, 'Reachable', [
    ['BridgedDeviceBasicInformation', 'reachable', 'true', true],
    ['Descriptor', 'tagList', '[Front]', [{ namespaceId: 1, tag: 1, label: 'Front' }]],
  ]);
  add(0x0013, 'Unreachable', [['BridgedDeviceBasicInformation', 'reachable', 'false', false]]);
  add(0x0011, 'Battery', [
    ['PowerSource', 'batPercentRemaining', '80', 80],
    ['PowerSource', 'batVoltage', '3300', 3300],
    ['PowerSource', 'wiredCurrentType', '0', 0],
  ]);
  add(0x050d, 'EnergyManagement', [['DeviceEnergyManagement', 'esaState', '1', 1]]);
  add(0x0100, 'Light', [
    ['OnOff', 'onOff', 'true', true],
    ['LevelControl', 'currentLevel', '128', 128],
  ]);
  add(0x010a, 'Outlet', [['OnOff', 'onOff', 'false', false]]);
  add(0x010f, 'Switch', [['OnOff', 'onOff', 'true', true]]);
  add(0x0110, 'Dimmer', [
    ['OnOff', 'onOff', 'false', false],
    ['LevelControl', 'currentLevel', '64', 64],
  ]);
  addControllerBranches(add);
  add(0x0073, 'LaundryWasher', [['OperationalState', 'operationalState', '0', 0]]);
  add(0x007c, 'LaundryDryer', [['OperationalState', 'operationalState', '1', 1]]);
  add(0x0075, 'Dishwasher', [['OperationalState', 'operationalState', '0', 0]]);
  add(0x007b, 'Oven', [['BridgedDeviceBasicInformation', 'reachable', 'true', true]]);
  add(0x0070, 'Refrigerator', [['BridgedDeviceBasicInformation', 'reachable', 'true', true]]);
  add(0x0071, 'TemperatureControlledCabinet', [['TemperatureControl', 'selectedTemperatureLevel', '2', 2]]);
  add(0x0079, 'MicrowaveOven', [['OperationalState', 'operationalState', '1', 1]]);
  add(0x007a, 'ExtractorHood', [['FanControl', 'fanMode', '3', 3]]);
  add(0x0078, 'CookSurface', [['BridgedDeviceBasicInformation', 'reachable', 'true', true]]);
  add(0x0077, 'Cooktop', [['TemperatureControl', 'selectedTemperatureLevel', '5', 5]]);
  add(0x0202, 'WindowCovering', [['WindowCovering', 'currentPositionLiftPercent100ths', '5000', 5000]]);
  add(0x0203, 'WindowCoveringController', [['Descriptor', 'clusterRevision', '1', 1]]);
  add(0x0230, 'Closure', [['ClosureControl', 'overallCurrentState', '{}', {}]]);
  add(0x023e, 'ClosureController', [['Descriptor', 'clusterRevision', '1', 1]]);
  add(0x0301, 'Thermostat', [
    ['Thermostat', 'localTemperature', '2200', 2200],
    ['Thermostat', 'occupiedHeatingSetpoint', '2100', 2100],
    ['Thermostat', 'occupiedCoolingSetpoint', '2500', 2500],
  ]);
  add(0x030a, 'ThermostatController', [['Descriptor', 'clusterRevision', '1', 1]]);
  add(0x000a, 'DoorLockLocked', [['DoorLock', 'lockState', '1', 1]]);
  add(0x000a, 'DoorLockUnlocked', [['DoorLock', 'lockState', '2', 2]]);
  add(0x000b, 'DoorLockController', [['Descriptor', 'clusterRevision', '1', 1]]);
  add(0x002b, 'Fan', [
    ['FanControl', 'fanMode', '2', 2],
    ['FanControl', 'percentCurrent', '33', 33],
  ]);
  add(0x000f, 'GenericSwitch', [['Switch', 'currentPosition', '1', 1]]);
  add(0x0027, 'ModeSelect', [
    ['ModeSelect', 'supportedModes', '[Eco]', [{ mode: 2, label: 'Eco' }]],
    ['ModeSelect', 'currentMode', '2', 2],
  ]);
  add(0x0303, 'Pump', [['OnOff', 'onOff', 'true', true]]);
  add(0x0304, 'PumpController', [['Descriptor', 'clusterRevision', '1', 1]]);
  add(0x002d, 'AirPurifier', [
    ['FanControl', 'fanMode', '5', 5],
    ['FanControl', 'percentCurrent', '45', 45],
  ]);
  add(0x0072, 'AirConditioner', [['Thermostat', 'localTemperature', '2400', 2400]]);
  add(0x0043, 'WaterLeakDetector', [['BooleanState', 'stateValue', 'true', true]]);
  add(0x0043, 'WaterLeakDetectorOk', [['BooleanState', 'stateValue', 'false', false]]);
  add(0x0041, 'WaterFreezeDetector', [['BooleanState', 'stateValue', 'false', false]]);
  add(0x0041, 'WaterFreezeDetectorAlarm', [['BooleanState', 'stateValue', 'true', true]]);
  add(0x0044, 'RainSensor', [['BooleanState', 'stateValue', 'true', true]]);
  add(0x0044, 'RainSensorOk', [['BooleanState', 'stateValue', 'false', false]]);
  add(0x0074, 'Rvc', [
    ['RvcRunMode', 'supportedModes', '[Cleaning]', [{ mode: 1, label: 'Cleaning' }]],
    ['RvcRunMode', 'currentMode', '1', 1],
  ]);
  add(0x050c, 'Evse', [['EnergyEvse', 'state', '0', 0]]);
  add(0x050f, 'WaterHeater', [['WaterHeaterManagement', 'tankPercentage', '75', 75]]);
  add(0x0309, 'HeatPump', [['PowerSource', 'featureMap', '{}', {}]]);
  add(0x0017, 'SolarPower', [['PowerSource', 'featureMap', '{}', {}]]);
  add(0x0018, 'BatteryStorage', [['ElectricalPowerMeasurement', 'featureMap', '{}', {}]]);
  addCameraBranches(add);
  add(0x0076, 'SmokeAlarm', [
    ['SmokeCoAlarm', 'featureMap', '{ smokeAlarm: true }', { smokeAlarm: true }],
    ['SmokeCoAlarm', 'smokeState', '0', 0],
  ]);
  add(0x0076, 'CoAlarm', [
    ['SmokeCoAlarm', 'featureMap', '{ smokeAlarm: false }', { smokeAlarm: false }],
    ['SmokeCoAlarm', 'coState', '1', 1],
  ]);
  add(0x0042, 'WaterValveClosed', [['ValveConfigurationAndControl', 'currentState', '0', 0]]);
  add(0x0042, 'WaterValveOpened', [['ValveConfigurationAndControl', 'currentState', '1', 1]]);
  add(0x0040, 'IrrigationSystem', [['Descriptor', 'clusterRevision', '1', 1]]);
  add(0x002c, 'AirQuality', [['AirQuality', 'airQuality', '1', 1]]);
  add(0x0302, 'TemperatureMeasurement', [['TemperatureMeasurement', 'measuredValue', '2150', 2150]]);
  add(0x0307, 'RelativeHumidityMeasurement', [['RelativeHumidityMeasurement', 'measuredValue', '5050', 5050]]);
  add(0x0045, 'SoilSensor', [['SoilMeasurement', 'soilMoistureMeasuredValue', '42', 42]]);
  add(0x0306, 'FlowMeasurement', [['FlowMeasurement', 'measuredValue', '123', 123]]);
  add(0x0305, 'PressureMeasurement', [['PressureMeasurement', 'measuredValue', '1000', 1000]]);
  add(0x0015, 'ContactClosed', [['BooleanState', 'stateValue', 'true', true]]);
  add(0x0015, 'ContactOpened', [['BooleanState', 'stateValue', 'false', false]]);
  add(0x0107, 'OccupancySensor', [['OccupancySensing', 'occupancy', '{ occupied: true }', { occupied: true }]]);
  add(0x0107, 'OccupancySensorClear', [['OccupancySensing', 'occupancy', '{ occupied: false }', { occupied: false }]]);
  add(0x0106, 'LightSensor', [['IlluminanceMeasurement', 'measuredValue', '50000', 50000]]);
  add(0x0850, 'OnOffSensor', [['Descriptor', 'clusterRevision', '1', 1]]);
  add(0x0510, 'ElectricalEnergy', [
    ['ElectricalPowerMeasurement', 'voltage', '230000', 230000],
    ['ElectricalPowerMeasurement', 'activeCurrent', '1200', 1200],
    ['ElectricalPowerMeasurement', 'activePower', '3450000', 3450000],
    ['ElectricalEnergyMeasurement', 'cumulativeEnergyImported', '{ energy: 2000000 }', { energy: 2_000_000 }],
    ['ElectricalEnergyMeasurement', 'cumulativeEnergyExported', '{ energy: 3000000 }', { energy: 3_000_000 }],
  ]);
  add(0x0510, 'ElectricalEnergyInvalid', [['ElectricalEnergyMeasurement', 'cumulativeEnergyImported', '{}', {}]]);
  add(0x0100, 'IgnoredClusters', [
    ['FixedLabel', 'labelList', '[]', []],
    ['Identify', 'identifyTime', '0', 0],
    ['Groups', 'nameSupport', '0', 0],
    ['PowerTopology', 'availableEndpoints', '[]', []],
  ]);

  return clusters;
}

function addControllerBranches(add: (deviceType: number, id: string, entries: Array<[string, string, string, unknown]>) => void): void {
  for (const [deviceType, id] of [
    [0x0103, 'OnOffLightSwitch'],
    [0x0104, 'DimmerSwitch'],
    [0x0105, 'ColorDimmerSwitch'],
    [0x0840, 'ControlBridge'],
  ] as const) {
    add(deviceType, id, [
      ['Descriptor', 'clusterRevision', '1', 1],
      ['OnOff', 'onOff', 'true', true],
      ['LevelControl', 'currentLevel', '128', 128],
    ]);
  }
}

function addCameraBranches(add: (deviceType: number, id: string, entries: Array<[string, string, string, unknown]>) => void): void {
  for (const [deviceType, id] of [
    [0x0142, 'Camera'],
    [0x0144, 'FloodlightCamera'],
    [0x0143, 'VideoDoorbell'],
    [0x0140, 'Intercom'],
    [0x0145, 'SnapshotCamera'],
    [0x0147, 'CameraController'],
    [0x0146, 'Chime'],
    [0x0148, 'Doorbell'],
    [0x0141, 'AudioDoorbell'],
  ] as const) {
    add(deviceType, id, [['Descriptor', 'clusterRevision', '1', 1]]);
  }
}

function createCluster(
  endpoint: string,
  id: string,
  deviceType: number,
  clusterName: string,
  attributeName: string,
  attributeValue: string,
  attributeLocalValue: unknown,
): Cluster {
  return {
    endpoint,
    number: EndpointNumber(Number(endpoint)),
    id,
    deviceTypes: [deviceType],
    clusterName,
    clusterId: `${clusterName}-${endpoint}`,
    attributeName,
    attributeId: `${attributeName}-${endpoint}`,
    attributeValue,
    attributeLocalValue,
  };
}
