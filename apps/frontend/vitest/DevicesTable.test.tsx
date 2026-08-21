import '@testing-library/jest-dom/vitest';

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DevicesTable from '../src/components/DevicesTable';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';
import type { ApiDevice, Cluster, WsMessageApiResponse } from '../src/utils/backendShared';

// Endpoint numbers are a branded type in the shared API types; this test-only cast avoids
// depending on the underlying branding package directly from this frontend package.
const endpointNumber = (value: number): Cluster['number'] => value as Cluster['number'];

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
    const firstDevice = createDevice({ name: 'Kitchen Light', serial: 'LIGHT-001', uniqueId: 'light-001', configUrl: 'https://config.example/light' });
    const secondDevice = createDevice({ pluginName: 'other-plugin', name: 'Hall Sensor', serial: 'SENSOR-001', uniqueId: 'sensor-001' });

    const rendered = render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesTable filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();

    expect(socket.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/settings' }));
    expect(socket.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/plugins' }));
    expect(socket.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/devices' }));

    socket.emit({ id: 1, src: 'Matterbridge', dst: 'Frontend', method: '/api/devices', success: true, response: [firstDevice, secondDevice] });
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
    const device = createDevice({ name: 'Kitchen Light', serial: 'LIGHT-001', uniqueId: 'light-001', endpoint: endpointNumber(1) });
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
    socket.emit({ id: 1, src: 'Matterbridge', dst: 'Frontend', method: '/api/devices', success: true, response: [device] });
    fireEvent.click((await screen.findAllByText('Kitchen Light'))[0]);

    expect(socket.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: '/api/clusters',
        params: { plugin: 'matterbridge-test', endpoint: 1, uniqueId: 'light-001' },
      }),
    );

    socket.emit({
      id: 1,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/clusters',
      success: true,
      response: { plugin: device.pluginName, deviceName: device.name, serialNumber: device.serial, number: endpointNumber(1), id: 'Light', deviceTypes: [0x0100], clusters },
    });

    expect(await screen.findByText('Clusters')).toBeInTheDocument();
    expect(screen.getAllByText('Kitchen Light').length).toBeGreaterThan(1);
    expect(screen.getAllByText('0x0100').length).toBeGreaterThan(0);
    expect(screen.getByText('0x0011')).toBeInTheDocument();
    expect(screen.getByText('Total child endpoints: 1')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();

    await waitFor(() => expect(socket.removeListener).toHaveBeenCalled());
    socket.emit(createStateUpdate({ uniqueId: device.uniqueId, serialNumber: device.serial, value: true }));

    expect(await screen.findByText('true')).toBeInTheDocument();
    expect(screen.queryByText('false')).toBeNull();

    socket.emit(createStateUpdate({ uniqueId: device.uniqueId, serialNumber: device.serial, attribute: 'missingAttribute', value: false }));
    expect(screen.getByText('true')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Kitchen Light')[0]);
    await waitFor(() => expect(screen.queryByText('Clusters')).toBeNull());
  });

  it('should request devices on device refresh messages only', async () => {
    const socket = createSocket(false);

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesTable filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();

    socket.emit({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'refresh_required', success: true, response: { changed: 'plugins' } });
    expect(socket.sendMessage).not.toHaveBeenCalled();

    socket.emit({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'refresh_required', success: true, response: { changed: 'devices' } });
    expect(socket.sendMessage).toHaveBeenCalledTimes(1);
    expect(socket.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/devices' }));
  });

  it('should ignore state updates for devices outside the filtered list', async () => {
    const socket = createSocket();
    const device = createDevice({ name: 'Filtered Light', serial: 'FILTER-001', uniqueId: 'filter-001', endpoint: endpointNumber(1) });

    render(
      <WebSocketContext.Provider value={socket.context}>
        <DevicesTable filterPlugins="All plugins" filterDevices="" />
      </WebSocketContext.Provider>,
    );
    await socket.ready();
    socket.emit(createStateUpdate({ uniqueId: 'missing-device', serialNumber: 'MISSING-001', value: true }));
    socket.emit({ id: 1, src: 'Matterbridge', dst: 'Frontend', method: '/api/devices', success: true, response: [device] });

    expect(await screen.findByText('Filtered Light')).toBeInTheDocument();
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
    pluginName: 'matterbridge-test',
    type: 'DynamicPlatform',
    endpoint: endpointNumber(1),
    name: 'Test Device',
    serial: 'TEST-001',
    productUrl: '',
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
