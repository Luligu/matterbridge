import '@testing-library/jest-dom';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MbfTableColumn } from '../src/components/MbfTable';

vi.mock('../src/appState', () => ({ basePath: '/', debug: true, enableMobile: true }));
vi.mock('../src/components/Connecting', () => ({ Connecting: () => <div>Connecting</div> }));
vi.mock('../src/components/MbfWindow', () => ({ MbfWindow: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../src/components/MbfTable', () => ({
  default: <T extends { name?: unknown; serial?: unknown } & object>({
    rows,
    columns,
    getRowKey,
    footerLeft,
    footerRight,
  }: {
    rows: T[];
    columns: MbfTableColumn<T>[];
    getRowKey: (row: T) => string;
    footerLeft?: React.ReactNode;
    footerRight?: React.ReactNode;
  }) => (
    <div data-testid="devices-table">
      {rows.map((row) => {
        const availability = columns.find((column) => column.label === 'Availability');
        const power = columns.find((column) => column.label === 'Power');
        const actions = columns.find((column) => column.label === 'Actions');
        return (
          <div key={getRowKey(row)} data-testid={`row-${getRowKey(row)}`}>
            <span>{typeof row.name === 'string' ? row.name : ''}</span>
            {availability?.render?.(undefined, getRowKey(row), row, availability)}
            {power?.render?.(undefined, getRowKey(row), row, power)}
            {actions?.render?.(undefined, getRowKey(row), row, actions)}
          </div>
        );
      })}
      <div data-testid="footer-left">{footerLeft}</div>
      <div data-testid="footer-right">{footerRight}</div>
    </div>
  ),
}));

import HomeDevices from '../src/components/HomeDevices';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';

const plugins = [
  {
    name: 'matterbridge-test',
    enabled: true,
    loaded: true,
    started: true,
    error: false,
    schemaJson: { properties: {} },
    configJson: { whiteList: [], blackList: [] },
  },
];

const selectablePlugin = [
  {
    name: 'matterbridge-test',
    enabled: true,
    loaded: true,
    started: true,
    error: false,
    hasWhiteList: true,
    hasBlackList: true,
    schemaJson: { properties: { whiteList: { selectFrom: 'serial' } } },
    configJson: { whiteList: [], blackList: [] },
  },
];

const uiContext = { mobile: false } as UiContextType;

function renderWithDevice(
  configUrl: string,
  deviceOverrides: Record<string, unknown> = {},
  options: { plugins?: unknown[]; setStoreId?: (id: string | null) => void; storeId?: string | null } = {},
) {
  let listener: ((message: unknown) => void) | undefined;
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- This callback mirrors the WebSocket listener API.
  const addListener = vi.fn((callback: (message: unknown) => void) => {
    listener = callback;
  });
  const sendMessage = vi.fn();
  const webSocketContext = {
    online: true,
    sendMessage,
    addListener,
    removeListener: vi.fn(),
    getUniqueId: () => 7,
  } as unknown as WebSocketContextType;

  render(
    <WebSocketContext.Provider value={webSocketContext}>
      <UiContext.Provider value={uiContext}>
        <HomeDevices storeId={options.storeId ?? null} setStoreId={options.setStoreId ?? vi.fn()} />
      </UiContext.Provider>
    </WebSocketContext.Provider>,
  );

  act(() => {
    listener?.({ id: 7, method: '/api/plugins', response: options.plugins ?? plugins });
  });
  act(() => {
    listener?.({ id: 7, method: '/api/devices', response: [{ pluginName: 'matterbridge-test', name: 'Test Device', serial: 'test1', configUrl, ...deviceOverrides }] });
  });

  return {
    sendMessage,
    sendWebSocketMessage: (message: unknown) => {
      act(() => {
        listener?.(message);
      });
    },
  };
}

describe('HomeDevices', () => {
  // HomeDevices logs verbosely with `debug` mocked to true; keep the test output clean by silencing
  // console.log/warn by default and asserting against the spy directly where a test needs to check a log.
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Unmount while console is still muted, since unmount logs `HomeDevices removed WebSocket listener`
    // and RTL's own automatic cleanup afterEach otherwise runs after ours (outer hooks run last).
    cleanup();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('opens the plugin frontend without corrupting a configUrl query string', () => {
    renderWithDevice('./plugins/matterbridge-test/?device=test1');

    fireEvent.click(screen.getByRole('button', { name: 'Open config url' }));

    expect(screen.getByTitle('Test Device frontend')).toHaveAttribute('src', '/plugins/matterbridge-test/?device=test1');
  });

  it('adds the trailing slash to the path when the configUrl has a query string but no trailing slash', () => {
    renderWithDevice('./plugins/matterbridge-test?device=test1');

    fireEvent.click(screen.getByRole('button', { name: 'Open config url' }));

    expect(screen.getByTitle('Test Device frontend')).toHaveAttribute('src', '/plugins/matterbridge-test/?device=test1');
  });

  it('adds the trailing slash to a configUrl without a query string', () => {
    renderWithDevice('/plugins/matterbridge-test');

    fireEvent.click(screen.getByRole('button', { name: 'Open config url' }));

    expect(screen.getByTitle('Test Device frontend')).toHaveAttribute('src', '/plugins/matterbridge-test/');
  });

  it('labels AC power icons with a tooltip', () => {
    renderWithDevice('/plugins/matterbridge-test', { powerSource: 'ac' });
    expect(screen.getByLabelText('AC current')).toBeInTheDocument();
  });

  it('labels DC power icons with a tooltip', () => {
    renderWithDevice('/plugins/matterbridge-test', { powerSource: 'dc' });
    expect(screen.getByLabelText('DC current')).toBeInTheDocument();
  });

  it('uses the full battery icon for battery level 100 percent', () => {
    renderWithDevice('/plugins/matterbridge-test', { powerSource: 'ok', batteryLevel: 100 });
    expect(screen.getByTestId('BatteryFullIcon')).toBeInTheDocument();
    expect(screen.getByLabelText('Battery level: 100%')).toBeInTheDocument();
  });

  it('uses the 5-bar battery icon for battery levels at or above 60 percent', () => {
    renderWithDevice('/plugins/matterbridge-test', { powerSource: 'ok', batteryLevel: 60 });
    expect(screen.getByTestId('Battery5BarIcon')).toBeInTheDocument();
    expect(screen.getByLabelText('Battery level: 60%')).toBeInTheDocument();
  });

  it('uses the 4-bar battery icon for battery levels at or above 40 percent', () => {
    renderWithDevice('/plugins/matterbridge-test', { powerSource: 'ok', batteryLevel: 40 });
    expect(screen.getByTestId('Battery4BarIcon')).toBeInTheDocument();
    expect(screen.getByLabelText('Battery level: 40%')).toBeInTheDocument();
  });

  it('uses the 2-bar battery icon for battery levels at or above 10 percent', () => {
    renderWithDevice('/plugins/matterbridge-test', { powerSource: 'ok', batteryLevel: 10 });
    expect(screen.getByTestId('Battery2BarIcon')).toBeInTheDocument();
    expect(screen.getByLabelText('Battery level: 10%')).toBeInTheDocument();
  });

  it('patches the reachable device row in place on a state_update instead of remixing the whole list', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test', { reachable: true });
    expect(screen.getByText('Online')).toBeInTheDocument();

    consoleLogSpy.mockClear();
    sendWebSocketMessage({
      id: 0,
      method: 'state_update',
      response: { plugin: 'matterbridge-test', serialNumber: 'test1', cluster: 'BridgedDeviceBasicInformation', attribute: 'reachable', value: false },
    });

    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('HomeDevices mixing devices'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('HomeDevices skipping remix'));
  });

  it('ignores state_update messages for clusters other than reachable', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test', { reachable: true });
    expect(screen.getByText('Online')).toBeInTheDocument();

    sendWebSocketMessage({
      id: 0,
      method: 'state_update',
      response: { plugin: 'matterbridge-test', serialNumber: 'test1', cluster: 'ModeSelect', attribute: 'currentMode', value: 2 },
    });

    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
  });

  it('also patches reachability for a plain BasicInformation cluster name (not just BridgedDeviceBasicInformation)', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test', { reachable: true });
    expect(screen.getByText('Online')).toBeInTheDocument();

    sendWebSocketMessage({
      id: 0,
      method: 'state_update',
      response: { plugin: 'matterbridge-test', serialNumber: 'test1', cluster: 'BasicInformation', attribute: 'reachable', value: false },
    });

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('warns and leaves the list untouched when a reachable update targets an unknown device', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test', { reachable: true });

    sendWebSocketMessage({
      id: 0,
      method: 'state_update',
      response: { plugin: 'matterbridge-test', serialNumber: 'unknown-serial', cluster: 'BridgedDeviceBasicInformation', attribute: 'reachable', value: false },
    });

    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('device to update not found'));
  });

  it('shows the loading footer message until the plugins finish loading, then the registered devices count', () => {
    let listener: ((message: unknown) => void) | undefined;
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- This callback mirrors the WebSocket listener API.
    const addListener = vi.fn((callback: (message: unknown) => void) => {
      listener = callback;
    });
    const webSocketContext = {
      online: true,
      sendMessage: vi.fn(),
      addListener,
      removeListener: vi.fn(),
      getUniqueId: () => 7,
    } as unknown as WebSocketContextType;

    render(
      <WebSocketContext.Provider value={webSocketContext}>
        <UiContext.Provider value={uiContext}>
          <HomeDevices storeId={null} setStoreId={vi.fn()} />
        </UiContext.Provider>
      </WebSocketContext.Provider>,
    );

    expect(screen.getByTestId('footer-left')).toHaveTextContent('Waiting for the plugins to fully load...');

    act(() => {
      listener?.({ id: 7, method: '/api/plugins', response: plugins });
    });
    act(() => {
      listener?.({ id: 7, method: '/api/devices', response: [{ pluginName: 'matterbridge-test', name: 'Test Device', serial: 'test1' }] });
    });

    expect(screen.getByTestId('footer-left')).toHaveTextContent('Registered devices: 1/1');
  });

  it('shows a restart required footer message on restart_required and clears it on restart_not_required', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test');

    sendWebSocketMessage({ id: 0, method: 'restart_required' });
    expect(screen.getByTestId('footer-right')).toHaveTextContent('Restart required');

    sendWebSocketMessage({ id: 0, method: 'restart_not_required' });
    expect(screen.getByTestId('footer-right')).toHaveTextContent('');
  });

  it('merges a device that only exists in selectDevices into the table', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test');

    sendWebSocketMessage({
      id: 7,
      method: '/api/select/devices',
      response: [{ pluginName: 'matterbridge-test', name: 'Select Only Device', serial: 'select-only' }],
    });

    expect(screen.getByTestId('row-matterbridge-test::select-only')).toBeInTheDocument();
    expect(screen.getByText('Select Only Device')).toBeInTheDocument();
  });

  it('does not duplicate a device present in both devices and selectDevices', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test');

    sendWebSocketMessage({
      id: 7,
      method: '/api/select/devices',
      response: [{ pluginName: 'matterbridge-test', name: 'Duplicate Name', serial: 'test1' }],
    });

    expect(screen.getAllByTestId('row-matterbridge-test::test1')).toHaveLength(1);
    expect(screen.getByText('Test Device')).toBeInTheDocument();
    expect(screen.queryByText('Duplicate Name')).not.toBeInTheDocument();
  });

  it('sends the selectdevice command when checking a device and unselectdevice when unchecking it', () => {
    const { sendMessage } = renderWithDevice('/plugins/matterbridge-test', {}, { plugins: selectablePlugin });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ method: '/api/command', params: expect.objectContaining({ command: 'unselectdevice', plugin: 'matterbridge-test', serial: 'test1' }) }),
    );
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ method: '/api/command', params: expect.objectContaining({ command: 'selectdevice', plugin: 'matterbridge-test', serial: 'test1' }) }),
    );
    expect(checkbox).toBeChecked();
  });

  it('labels warning power icons with a tooltip', () => {
    renderWithDevice('/plugins/matterbridge-test', { powerSource: 'warning', batteryLevel: 30 });
    expect(screen.getByLabelText('Battery level: 30%')).toBeInTheDocument();
  });

  it('labels critical power icons with a tooltip', () => {
    renderWithDevice('/plugins/matterbridge-test', { powerSource: 'critical', batteryLevel: 5 });
    expect(screen.getByLabelText('Battery level: 5%')).toBeInTheDocument();
  });

  it('uses the gray fallback battery icon when powerSource is ok without a battery level', () => {
    renderWithDevice('/plugins/matterbridge-test', { powerSource: 'ok' });
    expect(screen.getByTestId('Battery6BarIcon')).toBeInTheDocument();
  });

  it('toggles the shown matter id when clicking the QR code button', () => {
    const setStoreId = vi.fn();
    renderWithDevice('/plugins/matterbridge-test', { matter: { id: 'MatterId' } }, { setStoreId, storeId: null });

    fireEvent.click(screen.getByRole('button', { name: 'Show the QRCode' }));

    expect(setStoreId).toHaveBeenCalledWith('MatterId');
  });
});
