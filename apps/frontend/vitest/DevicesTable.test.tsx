import '@testing-library/jest-dom/vitest';

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DevicesTable from '../src/components/DevicesTable';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';
import type { ApiDevice, ApiPlugin, Cluster, WsMessageApiResponse } from '../src/utils/backendShared';
import { MbfLsk } from '../src/utils/localStorage';

const endpointNumber = (value: number): Cluster['number'] => value;

describe('DevicesTable', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should render the connecting state when websocket is offline', () => {
    const socket = createSocket(false);

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesTable filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );

    expect(screen.getByText('Reconnecting to Matterbridge (attempt 1)...')).toBeInTheDocument();
    expect(socket.sendMessage).not.toHaveBeenCalled();
  });

  it('should request devices, render rows, filter rows, open config, and clean up the listener', async () => {
    const socket = createSocket();
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    const firstDevice = createDevice({ deviceName: 'Kitchen Light', serialNumber: 'LIGHT-001', uniqueId: 'light-001', configUrl: 'https://config.example/light' });
    const secondDevice = createDevice({ plugin: 'other-plugin', deviceName: 'Hall Sensor', serialNumber: 'SENSOR-001', uniqueId: 'sensor-001' });

    const rendered = render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesTable filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();

    expect(socket.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/settings' }));
    expect(socket.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/plugins' }));
    expect(socket.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ method: '/api/platform-devices' }));

    for (const message of createPlatformDevicesMessages([firstDevice, secondDevice])) socket.emit(message);
    for (const pluginName of ['matterbridge-test', 'other-plugin']) {
      expect(socket.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/platform-devices', params: { pluginName, extended: true } }));
    }
    expect(await screen.findByText('Kitchen Light')).toBeInTheDocument();
    expect(screen.getByText('Hall Sensor')).toBeInTheDocument();
    expect(screen.getByText('Total devices: 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Config' }));
    expect(windowOpen).toHaveBeenCalledWith('https://config.example/light', '_blank');

    rendered.rerender(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesTable filterPlugins="matterbridge-test" filterDevices="LIGHT" />
      </WebSocketContext.Provider>,
    );

    await waitFor(() => expect(screen.queryByText('Hall Sensor')).toBeNull());
    expect(screen.getAllByText('Kitchen Light').length).toBeGreaterThan(0);
    expect(screen.getByText('Total devices: 1')).toBeInTheDocument();

    rendered.unmount();
    expect(socket.removeListener).toHaveBeenCalled();
  });

  it('should open clusters for a selected device, update cluster values, and toggle the cluster table', async () => {
    const socket = createSocket();
    const device = createDevice({ deviceName: 'Kitchen Light', serialNumber: 'LIGHT-001', uniqueId: 'light-001', number: endpointNumber(1) });
    const otherDevice = createDevice({ deviceName: 'Bedroom Light', serialNumber: 'LIGHT-002', uniqueId: 'light-002', number: endpointNumber(1) });
    const clusters = [
      createCluster('1', 'Light', [0x0100], 'Descriptor', 'serverList', '[6]', [6]),
      createCluster('1', 'Light', [0x0100], 'OnOff', 'onOff', 'false', false),
      createCluster('2', 'Child', [0x0011], 'PowerSource', 'batVoltage', '3000', 3000),
    ];

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesTable filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();
    for (const message of createPlatformDevicesMessages([device, otherDevice])) socket.emit(message);
    fireEvent.click((await screen.findAllByText('Kitchen Light'))[0]);

    expect(socket.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: '/api/clusters',
        params: { pluginName: 'matterbridge-test', number: 1, serialNumber: 'LIGHT-001', uniqueId: 'light-001' },
      }),
    );

    socket.emit({
      id: 1,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/clusters',
      success: true,
      response: {
        plugin: device.plugin,
        deviceName: device.deviceName,
        serialNumber: device.serialNumber,
        uniqueId: device.uniqueId,
        number: endpointNumber(1),
        id: 'Light',
        deviceTypes: [0x0100],
        clusters,
      },
    });

    expect(await screen.findByText('Clusters')).toBeInTheDocument();
    expect(screen.getAllByText('Kitchen Light').length).toBeGreaterThan(1);
    expect(screen.getAllByText('0x0100').length).toBeGreaterThan(0);
    expect(screen.getByText('0x0011')).toBeInTheDocument();
    expect(screen.getByText('Total child endpoints: 1')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();

    await waitFor(() => expect(socket.removeListener).toHaveBeenCalled());
    socket.emit(createStateUpdate({ uniqueId: device.uniqueId, serialNumber: device.serialNumber, value: true }));

    expect(await screen.findByText('true')).toBeInTheDocument();
    expect(screen.queryByText('false')).toBeNull();

    socket.emit(createStateUpdate({ uniqueId: device.uniqueId, serialNumber: device.serialNumber, attribute: 'missingAttribute', value: false }));
    expect(screen.getByText('true')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Kitchen Light')[0]);
    await waitFor(() => expect(screen.queryByText('Clusters')).toBeNull());
    fireEvent.click(screen.getAllByText('Bedroom Light')[0]);
    expect(socket.sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: '/api/clusters',
        params: { pluginName: 'matterbridge-test', number: 1, serialNumber: 'LIGHT-002', uniqueId: 'light-002' },
      }),
    );
    fireEvent.click(screen.getAllByText('Kitchen Light')[0]);
    expect(socket.sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: '/api/clusters',
        params: { pluginName: 'matterbridge-test', number: 1, serialNumber: 'LIGHT-001', uniqueId: 'light-001' },
      }),
    );
  });

  it('should request platform devices only for running plugins and replace the rows of the answering plugin', async () => {
    const socket = createSocket();
    const device = createDevice({ deviceName: 'Kitchen Light', serialNumber: 'LIGHT-001', uniqueId: 'light-001' });
    const otherDevice = createDevice({ plugin: 'other-plugin', deviceName: 'Hall Sensor', serialNumber: 'SENSOR-001', uniqueId: 'sensor-001' });

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesTable filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();
    const plugins = [
      { name: 'matterbridge-test', enabled: true, loaded: true, started: true, error: false },
      { name: 'other-plugin', enabled: true, loaded: true, started: true, error: false },
      { name: 'disabled-plugin', enabled: false, loaded: false, started: false, error: false },
      { name: 'error-plugin', enabled: true, loaded: true, started: true, error: true },
    ] as ApiPlugin[];
    socket.emit({ id: 1, src: 'Matterbridge', dst: 'Frontend', method: '/api/plugins', success: true, response: plugins });
    expect(socket.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/platform-devices', params: { pluginName: 'other-plugin', extended: true } }));
    for (const pluginName of ['disabled-plugin', 'error-plugin']) {
      expect(socket.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ method: '/api/platform-devices', params: { pluginName, extended: true } }));
    }

    socket.emit({ id: 1, src: 'Matterbridge', dst: 'Frontend', method: '/api/platform-devices', success: true, pluginName: device.plugin, response: [device] });
    socket.emit({ id: 1, src: 'Matterbridge', dst: 'Frontend', method: '/api/platform-devices', success: true, pluginName: otherDevice.plugin, response: [otherDevice] });
    socket.emit({ id: 1, src: 'Matterbridge', dst: 'Frontend', method: '/api/platform-devices', success: true, pluginName: 'empty-plugin', response: [] });
    expect(await screen.findByText('Total devices: 2')).toBeInTheDocument();

    // Another component's responses are ignored
    socket.emit({
      id: 2,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/platform-devices',
      success: true,
      pluginName: device.plugin,
      response: [{ ...device, deviceName: 'Foreign Light' }],
    });
    expect(screen.queryByText('Foreign Light')).toBeNull();

    // A new response of one plugin replaces its own rows only
    socket.emit({
      id: 1,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/platform-devices',
      success: true,
      pluginName: device.plugin,
      response: [{ ...device, deviceName: 'Renamed Light' }],
    });
    expect(await screen.findByText('Renamed Light')).toBeInTheDocument();
    expect(screen.queryByText('Kitchen Light')).toBeNull();
    expect(screen.getByText('Hall Sensor')).toBeInTheDocument();
    expect(screen.getByText('Total devices: 2')).toBeInTheDocument();

    // An empty response of one plugin removes all its rows and keeps the rows of the other plugin
    socket.emit({ id: 1, src: 'Matterbridge', dst: 'Frontend', method: '/api/platform-devices', success: true, pluginName: device.plugin, response: [] });
    expect(await screen.findByText('Total devices: 1')).toBeInTheDocument();
    expect(screen.queryByText('Renamed Light')).toBeNull();
    expect(screen.getByText('Hall Sensor')).toBeInTheDocument();
  });

  it('should clear the selected device and its clusters on a full reload', async () => {
    const socket = createSocket();
    const device = createDevice({ deviceName: 'Kitchen Light', serialNumber: 'LIGHT-001', uniqueId: 'light-001', number: endpointNumber(1) });
    const clusters = [createCluster('1', 'Light', [0x0100], 'OnOff', 'onOff', 'false', false)];

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesTable filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();
    for (const message of createPlatformDevicesMessages([device])) socket.emit(message);
    fireEvent.click((await screen.findAllByText('Kitchen Light'))[0]);
    socket.emit({
      id: 1,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/clusters',
      success: true,
      response: {
        plugin: device.plugin,
        deviceName: device.deviceName,
        serialNumber: device.serialNumber,
        uniqueId: device.uniqueId,
        number: endpointNumber(1),
        id: 'Light',
        deviceTypes: [0x0100],
        clusters,
      },
    });
    expect(await screen.findByText('Clusters')).toBeInTheDocument();

    // Full reload: the clusters panel closes and the device list is emptied until the platforms answer again
    const plugins = [{ name: 'matterbridge-test', enabled: true, loaded: true, started: true, error: false }] as ApiPlugin[];
    socket.emit({ id: 1, src: 'Matterbridge', dst: 'Frontend', method: '/api/plugins', success: true, response: plugins });
    await waitFor(() => expect(screen.queryByText('Clusters')).toBeNull());
    expect(screen.queryByText('Kitchen Light')).toBeNull();
    expect(screen.getByText('Total devices: 0')).toBeInTheDocument();

    // The selection was cleared, so clicking the device again selects it instead of deselecting it
    socket.emit({ id: 1, src: 'Matterbridge', dst: 'Frontend', method: '/api/platform-devices', success: true, pluginName: device.plugin, response: [device] });
    socket.sendMessage.mockClear();
    fireEvent.click((await screen.findAllByText('Kitchen Light'))[0]);
    expect(socket.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ method: '/api/clusters', params: { pluginName: 'matterbridge-test', number: 1, serialNumber: 'LIGHT-001', uniqueId: 'light-001' } }),
    );
  });

  it('should request plugins on refresh messages except matter and locked plugins', async () => {
    const socket = createSocket(false);

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesTable filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();

    socket.emit({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'refresh_required', success: true, response: { changed: 'matter' } });
    socket.emit({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'refresh_required', success: true, response: { changed: 'plugins', lock: 'matterbridge-test' } });
    expect(socket.sendMessage).not.toHaveBeenCalled();

    socket.emit({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'refresh_required', success: true, response: { changed: 'plugins' } });
    expect(socket.sendMessage).toHaveBeenCalledTimes(1);
    expect(socket.sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({ method: '/api/plugins', params: {} }));

    socket.emit({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'refresh_required', success: true, response: { changed: 'devices' } });
    expect(socket.sendMessage).toHaveBeenCalledTimes(2);
    expect(socket.sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({ method: '/api/plugins', params: {} }));
  });

  it('should ignore state updates for devices outside the filtered list', async () => {
    const socket = createSocket();
    const device = createDevice({ deviceName: 'Filtered Light', serialNumber: 'FILTER-001', uniqueId: 'filter-001', number: endpointNumber(1) });

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesTable filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();
    socket.emit(createStateUpdate({ uniqueId: 'missing-device', serialNumber: 'MISSING-001', value: true }));
    for (const message of createPlatformDevicesMessages([device])) socket.emit(message);

    expect(await screen.findByText('Filtered Light')).toBeInTheDocument();
  });

  it('should switch the clusters view to the tree, persist the choice, and switch back to the grid', async () => {
    const socket = createSocket();
    const device = createDevice({ deviceName: 'Kitchen Light', serialNumber: 'LIGHT-001', uniqueId: 'light-001', number: endpointNumber(1) });
    const clusters = [createCluster('1', 'Light', [0x0100], 'OnOff', 'onOff', 'false', false)];

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesTable filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();
    for (const message of createPlatformDevicesMessages([device])) socket.emit(message);
    fireEvent.click(await screen.findByText('Kitchen Light'));
    socket.emit({
      id: 2,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/clusters',
      success: true,
      response: {
        plugin: 'matterbridge-test',
        deviceName: 'Kitchen Light',
        serialNumber: 'LIGHT-001',
        uniqueId: 'light-001',
        number: endpointNumber(1),
        id: 'Light',
        deviceTypes: [0x0100],
        clusters,
      },
    });
    expect(await screen.findByText('Clusters')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to tree view' }));
    expect(await screen.findByRole('tree')).toBeInTheDocument();
    expect(localStorage.getItem(MbfLsk['devices-cluster-view-mode'])).toBe('tree');
    expect(screen.getByText('Total child endpoints: 0')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to grid view' }));
    await waitFor(() => expect(screen.queryByRole('tree')).toBeNull());
    expect(localStorage.getItem(MbfLsk['devices-cluster-view-mode'])).toBe('grid');
  });

  it('should open the clusters in the tree view when the saved choice is the tree', async () => {
    localStorage.setItem(MbfLsk['devices-cluster-view-mode'], 'tree');
    const socket = createSocket();
    const device = createDevice({ deviceName: 'Kitchen Light', serialNumber: 'LIGHT-001', uniqueId: 'light-001', number: endpointNumber(1) });

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesTable filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();
    for (const message of createPlatformDevicesMessages([device])) socket.emit(message);
    fireEvent.click(await screen.findByText('Kitchen Light'));

    expect(await screen.findByRole('tree')).toBeInTheDocument();
  });
});

interface TestSocket {
  context: WebSocketContextType;
  sendMessage: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  ready: () => Promise<void>;
  emit: (message: WsMessageApiResponse) => void;
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
    setLogLength: vi.fn(),
    setLogAutoScroll: vi.fn(),
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
  };
}

function createDevice(overrides: Partial<ApiDevice> = {}): ApiDevice {
  return {
    plugin: 'matterbridge-test',
    type: 'DynamicPlatform',
    number: endpointNumber(1),
    id: 'TestDevice',
    deviceName: 'Test Device',
    serialNumber: 'TEST-001',
    productUrl: '',
    configUrl: undefined,
    uniqueId: 'test-device',
    reachable: true,
    cluster: 'OnOff: false',
    ...overrides,
  };
}

function createCluster(
  endpoint: string,
  id: string,
  deviceTypes: number[],
  clusterName: string,
  attributeName: string,
  attributeValue: string,
  attributeLocalValue: unknown,
): Cluster {
  return {
    endpoint,
    number: endpointNumber(Number(endpoint)),
    id,
    deviceTypes,
    clusterName,
    clusterId: `${clusterName}-${endpoint}`,
    attributeName,
    attributeId: `${attributeName}-${endpoint}`,
    attributeValue,
    attributeLocalValue,
  };
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
      serialNumber: 'TEST-001',
      uniqueId: 'test-device',
      number: endpointNumber(1),
      id: 'Light',
      cluster: 'OnOff',
      attribute: 'onOff',
      value: true,
      ...overrides,
    },
  };
}

/** Answers /api/plugins with a running plugin for each plugin of the devices, then /api/platform-devices of each plugin with its own devices. */
function createPlatformDevicesMessages(devices: ApiDevice[]): WsMessageApiResponse[] {
  const pluginNames = [...new Set(devices.map((device) => device.plugin))];
  const plugins = pluginNames.map((name) => ({ name, enabled: true, loaded: true, started: true, error: false })) as ApiPlugin[];
  const messages: WsMessageApiResponse[] = [{ id: 1, src: 'Matterbridge', dst: 'Frontend', method: '/api/plugins', success: true, response: plugins }];
  for (const name of pluginNames) {
    messages.push({
      id: 1,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/platform-devices',
      success: true,
      pluginName: name,
      response: devices.filter((device) => device.plugin === name),
    });
  }
  return messages;
}
