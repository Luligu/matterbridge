import '@testing-library/jest-dom';

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { SnackbarProvider } from 'notistack';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MbfTableColumn } from '../src/components/MbfTable';

// Shared with the MbfTable mock below via vi.hoisted, since a vi.mock factory can't close over
// ordinary module-scope variables; this lets tests inspect the columns HomeDevices last passed down
// (e.g. to call the Availability comparator directly) without a namespaced re-import of the mock.
const { getLastColumns, setLastColumns } = vi.hoisted(() => {
  let lastColumns: MbfTableColumn<any>[] = [];
  return {
    getLastColumns: () => lastColumns,
    setLastColumns: (columns: MbfTableColumn<any>[]) => {
      lastColumns = columns;
    },
  };
});

vi.mock('../src/appState', () => ({ basePath: '/', debug: true, enableMobile: true }));
vi.mock('../src/components/Connecting', () => ({ Connecting: () => <div>Connecting</div> }));
vi.mock('../src/components/MbfWindow', () => ({ MbfWindow: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../src/components/MbfTable', () => ({
  default: <T extends { deviceName?: unknown; serialNumber?: unknown } & object>({
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
  }) => {
    setLastColumns(columns);
    return (
      <div data-testid="devices-table">
        {rows.map((row) => {
          const availability = columns.find((column) => column.label === 'Availability');
          const power = columns.find((column) => column.label === 'Power');
          const actions = columns.find((column) => column.label === 'Actions');
          return (
            <div key={getRowKey(row)} data-testid={`row-${getRowKey(row)}`}>
              <span>{typeof row.deviceName === 'string' ? row.deviceName : ''}</span>
              {availability?.render?.(undefined, getRowKey(row), row, availability)}
              {power?.render?.(undefined, getRowKey(row), row, power)}
              {actions?.render?.(undefined, getRowKey(row), row, actions)}
            </div>
          );
        })}
        <div data-testid="footer-left">{footerLeft}</div>
        <div data-testid="footer-right">{footerRight}</div>
      </div>
    );
  },
}));

import HomeDevices from '../src/components/HomeDevices';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { UiProvider } from '../src/components/UiProvider';
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

function renderComponent(options: { online?: boolean; setStoreId?: (id: string | null) => void; storeId?: string | null; useUiProvider?: boolean } = {}) {
  let listener: ((message: unknown) => void) | undefined;
  const addListener = vi.fn((callback: (message: unknown) => void) => {
    listener = callback;
  });
  const sendMessage = vi.fn();
  const webSocketContext = {
    online: options.online ?? true,
    sendMessage,
    addListener,
    removeListener: vi.fn(),
    getUniqueId: () => 7,
  } as unknown as WebSocketContextType;

  const component = <HomeDevices storeId={options.storeId ?? null} setStoreId={options.setStoreId ?? vi.fn()} />;
  render(
    <WebSocketContext.Provider value={webSocketContext}>
      {options.useUiProvider ? (
        <SnackbarProvider>
          <UiProvider>{component}</UiProvider>
        </SnackbarProvider>
      ) : (
        <UiContext.Provider value={uiContext}>{component}</UiContext.Provider>
      )}
    </WebSocketContext.Provider>,
  );

  return {
    sendMessage,
    sendWebSocketMessage: (message: unknown) => {
      act(() => {
        listener?.(message);
      });
    },
  };
}

function renderWithDevice(
  configUrl: string,
  deviceOverrides: Record<string, unknown> = {},
  options: { plugins?: unknown[]; setStoreId?: (id: string | null) => void; storeId?: string | null; useUiProvider?: boolean } = {},
) {
  const helpers = renderComponent(options);
  helpers.sendWebSocketMessage({ id: 7, method: '/api/plugins', response: options.plugins ?? plugins });
  helpers.sendWebSocketMessage({
    id: 7,
    method: '/api/platform-devices',
    response: [{ plugin: 'matterbridge-test', deviceName: 'Test Device', serialNumber: 'test1', configUrl, ...deviceOverrides }],
  });
  return helpers;
}

// A single click on a plugin frontend button waits for the double click delay before opening the dialog, so run it with fake timers and let the delay pass.
function singleClick(element: HTMLElement) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    fireEvent.click(element);
    act(() => {
      vi.advanceTimersByTime(300);
    });
  } finally {
    vi.useRealTimers();
  }
}

describe('HomeDevices', () => {
  // HomeDevices logs verbosely with `debug` mocked to true; keep the test output clean by silencing
  // console.log/warn by default and asserting against the spy directly where a test needs to check a log.
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    // Unmount while console is still muted, since unmount logs `HomeDevices removed WebSocket listener`
    // and RTL's own automatic cleanup afterEach otherwise runs after ours (outer hooks run last).
    cleanup();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  it('should open the device actions menu from the button immediately after the config button', () => {
    renderWithDevice('https://example.com/config');

    const configButton = screen.getByRole('button', { name: 'Open config url' });
    const actionsButton = screen.getByRole('button', { name: 'Device actions' });
    expect(configButton.nextElementSibling).toBe(actionsButton);
    expect(within(actionsButton).getByTestId('MoreHorizIcon')).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(actionsButton);

    expect(actionsButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Reset device...', 'Change controller name...']);
  });

  it('should replace the actions placeholder with a menu button when a selectable device becomes registered', () => {
    const { sendWebSocketMessage } = renderWithDevice('');
    const device = { plugin: 'matterbridge-test', deviceName: 'Select Only Device', serialNumber: 'select-only', configUrl: 'https://example.com/config' };
    sendWebSocketMessage({ id: 7, method: '/api/select-devices', response: [device] });
    const row = screen.getByTestId('row-matterbridge-test::select-only');

    expect(within(row).queryByRole('button', { name: 'Device actions' })).not.toBeInTheDocument();
    expect(within(row).queryByTestId('MoreHorizIcon')).not.toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Open config url' }).nextElementSibling).toHaveStyle({ width: '20px', height: '20px' });
    expect(screen.getAllByRole('button', { name: 'Device actions' })).toHaveLength(1);

    sendWebSocketMessage({ id: 7, method: '/api/platform-devices', pluginName: device.plugin, response: [{ ...device, uniqueId: 'newly-registered-device' }] });

    expect(within(screen.getByTestId('row-matterbridge-test::select-only')).getByRole('button', { name: 'Device actions' })).toBeInTheDocument();
  });

  it('should extend the device actions menu left from the button with their right edges aligned', () => {
    renderWithDevice('');
    const actionsButton = screen.getByRole('button', { name: 'Device actions' });
    const anchorRectSpy = vi.spyOn(actionsButton, 'getBoundingClientRect').mockReturnValue(new DOMRect(400, 100, 20, 20));
    const widthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200);
    const heightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100);
    try {
      fireEvent.click(actionsButton);

      expect(screen.getByRole('menu').parentElement).toHaveStyle({ left: '220px', top: '120px', transformOrigin: '200px 0px' });
    } finally {
      anchorRectSpy.mockRestore();
      widthSpy.mockRestore();
      heightSpy.mockRestore();
    }
  });

  it.each([
    ['Reset device...', 'handleUnregisterDevice', 'Reset device and restart'],
    ['Change controller name...', 'handleControllerName', 'Rename the device on the controller'],
  ])('should only log the selected device when choosing %s', async (label, logMessage, title) => {
    const { sendMessage, sendWebSocketMessage } = renderWithDevice('https://example.com/config', {}, { useUiProvider: true });
    const device = { plugin: 'matterbridge-test', deviceName: 'Second Device', serialNumber: 'test2' };
    sendWebSocketMessage({
      id: 7,
      method: '/api/platform-devices',
      response: [{ plugin: 'matterbridge-test', deviceName: 'Test Device', serialNumber: 'test1', configUrl: 'https://example.com/config' }, device],
    });
    sendMessage.mockClear();
    consoleLogSpy.mockClear();
    const row = screen.getByTestId('row-matterbridge-test::test2');
    fireEvent.click(within(row).getByRole('button', { name: 'Device actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: label }));

    expect(consoleLogSpy).toHaveBeenCalledWith(`${logMessage}: plugin ${device.plugin} name ${device.deviceName} serial ${device.serialNumber}`);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(row).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: `Matterbridge Logo ${title}` });
    expect(dialog).toHaveTextContent(device.plugin);
    expect(dialog).toHaveTextContent(device.deviceName);
    await vi.waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it.each(['Confirm', 'Cancel'])('should send an unregister request only when confirmed, choosing %s', async (action) => {
    const { sendMessage } = renderWithDevice('', { uniqueId: 'device-unique-1' }, { useUiProvider: true });
    sendMessage.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Device actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reset device...' }));

    const dialog = screen.getByRole('dialog', { name: /Reset device and restart/ });
    expect(dialog).toHaveTextContent(
      'Reset device "Test Device" from plugin "matterbridge-test"? This will temporarily remove the device from the controller and you may lose the controller configuration.',
    );
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Confirm' })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole('button', { name: action }));

    expect(consoleLogSpy).toHaveBeenCalledWith(`handleUnregisterDevice ${action === 'Confirm' ? 'confirmed' : 'canceled'}: plugin matterbridge-test name Test Device serial test1`);
    expect(sendMessage.mock.calls).toEqual(
      action === 'Confirm'
        ? [
            [
              {
                id: 7,
                sender: 'HomeDevices',
                method: '/api/unregister-device',
                src: 'Frontend',
                dst: 'Matterbridge',
                params: { pluginName: 'matterbridge-test', serialNumber: 'test1', uniqueId: 'device-unique-1' },
              },
            ],
          ]
        : [],
    );
    expect(screen.getByTestId('row-matterbridge-test::test1')).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it.each(['OK', 'Cancel'])('should send the edited controller name only when confirmed, choosing %s', async (action) => {
    const { sendMessage } = renderWithDevice('', { uniqueId: 'device-unique-1' }, { useUiProvider: true });
    sendMessage.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Device actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Change controller name...' }));
    const dialog = screen.getByRole('dialog', { name: /Rename the device on the controller/ });
    expect(within(dialog).getByRole('textbox', { name: 'Controller name' })).toHaveValue('Test Device');
    expect(within(dialog).getByRole('button', { name: 'OK' })).toBeEnabled();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Controller name' }), { target: { value: 'New controller name' } });

    fireEvent.click(within(dialog).getByRole('button', { name: action }));

    expect(consoleLogSpy).toHaveBeenCalledWith(
      action === 'OK'
        ? 'handleControllerName confirmed: plugin matterbridge-test name Test Device serial test1 to controller name New controller name'
        : 'handleControllerName canceled: plugin matterbridge-test name Test Device serial test1',
    );
    expect(sendMessage.mock.calls).toEqual(
      action === 'OK'
        ? [
            [
              {
                id: 7,
                sender: 'HomeDevices',
                method: '/api/rename-device',
                src: 'Frontend',
                dst: 'Matterbridge',
                params: { pluginName: 'matterbridge-test', serialNumber: 'test1', uniqueId: 'device-unique-1', label: 'New controller name' },
              },
            ],
          ]
        : [],
    );
    expect(screen.getByTestId('row-matterbridge-test::test1')).toHaveTextContent('Test Device');
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it.each([
    ['Reset device...', 'Confirm', 'handleUnregisterDevice', 'Cannot reset device: missing unique ID.'],
    ['Change controller name...', 'OK', 'handleControllerName', 'Cannot rename device: missing unique ID.'],
  ])('should report a missing unique ID without sending an API request for %s', (label, action, handler, message) => {
    const { sendMessage } = renderWithDevice('', {}, { useUiProvider: true });
    sendMessage.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Device actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: label }));
    const dialog = screen.getByRole('dialog');
    const input = within(dialog).queryByRole('textbox');
    if (input) fireEvent.change(input, { target: { value: 'New name' } });

    fireEvent.click(within(dialog).getByRole('button', { name: action }));

    expect(sendMessage).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(`${handler}: missing uniqueId for plugin matterbridge-test name Test Device serial test1`);
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('should dismiss the device actions menu without invoking an action when Escape is pressed', async () => {
    renderWithDevice('');
    expect(screen.queryByRole('button', { name: 'Open config url' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Device actions' }));
    consoleLogSpy.mockClear();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    await vi.waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('handleUnregisterDevice:'));
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('handleControllerName:'));
  });

  it('opens the plugin frontend without corrupting a configUrl query string', () => {
    renderWithDevice('./plugins/matterbridge-test/?device=test1');

    singleClick(screen.getByRole('button', { name: 'Open config url' }));

    expect(screen.getByTitle('Test Device frontend')).toHaveAttribute('src', '/plugins/matterbridge-test/?device=test1');
  });

  it('adds the trailing slash to the path when the configUrl has a query string but no trailing slash', () => {
    renderWithDevice('./plugins/matterbridge-test?device=test1');

    singleClick(screen.getByRole('button', { name: 'Open config url' }));

    expect(screen.getByTitle('Test Device frontend')).toHaveAttribute('src', '/plugins/matterbridge-test/?device=test1');
  });

  it('adds the trailing slash to a configUrl without a query string', () => {
    renderWithDevice('/plugins/matterbridge-test');

    const configButton = screen.getByRole('button', { name: 'Open config url' });
    expect(within(configButton).getByTestId('LanguageIcon')).toBeInTheDocument();
    singleClick(configButton);

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

  it('patches the reachable device row in place on a state_update', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test', { reachable: true });
    expect(screen.getByText('Online')).toBeInTheDocument();

    sendWebSocketMessage({
      id: 0,
      method: 'state_update',
      response: { plugin: 'matterbridge-test', serialNumber: 'test1', cluster: 'BridgedDeviceBasicInformation', attribute: 'reachable', value: false },
    });

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('keeps a reachable patch after an unrelated /api/select-devices response for a different plugin triggers a remix', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test', { reachable: true });

    sendWebSocketMessage({
      id: 0,
      method: 'state_update',
      response: { plugin: 'matterbridge-test', serialNumber: 'test1', cluster: 'BridgedDeviceBasicInformation', attribute: 'reachable', value: false },
    });
    expect(screen.getByText('Offline')).toBeInTheDocument();

    // A response for an unrelated plugin still changes the `selectDevices` array's identity, which would
    // retrigger the mixing effect; the patch above must have already landed in `devices` too, or this
    // remix would rebuild the row from the stale (reachable: true) snapshot and silently revert it.
    sendWebSocketMessage({
      id: 7,
      method: '/api/select-devices',
      response: [{ plugin: 'other-plugin', deviceName: 'Other Plugin Device', serialNumber: 'other1' }],
    });

    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.queryByText('Online')).not.toBeInTheDocument();
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
    const { sendMessage, sendWebSocketMessage } = renderComponent();

    expect(screen.getByTestId('footer-left')).toHaveTextContent('Loading plugins...');

    sendWebSocketMessage({ id: 7, method: '/api/plugins', response: plugins });
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/platform-devices', params: { pluginName: 'matterbridge-test', extended: true } }));
    sendWebSocketMessage({
      id: 7,
      method: '/api/platform-devices',
      pluginName: 'matterbridge-test',
      response: [{ plugin: 'matterbridge-test', deviceName: 'Test Device', serialNumber: 'test1' }],
    });

    expect(screen.getByTestId('footer-left')).toHaveTextContent('Registered devices: 1/1');
  });

  it('replaces only the registered rows of the plugin that answered /api/platform-devices', () => {
    const twoPlugins = [...plugins, { ...plugins[0], name: 'matterbridge-other' }];
    const { sendMessage, sendWebSocketMessage } = renderComponent();
    sendWebSocketMessage({ id: 7, method: '/api/plugins', response: twoPlugins });
    for (const pluginName of ['matterbridge-test', 'matterbridge-other']) {
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/platform-devices', params: { pluginName, extended: true } }));
    }
    sendWebSocketMessage({
      id: 7,
      method: '/api/platform-devices',
      pluginName: 'matterbridge-test',
      response: [{ plugin: 'matterbridge-test', deviceName: 'Test Device', serialNumber: 'test1' }],
    });
    sendWebSocketMessage({
      id: 7,
      method: '/api/platform-devices',
      pluginName: 'matterbridge-other',
      response: [{ plugin: 'matterbridge-other', deviceName: 'Other Device', serialNumber: 'other1' }],
    });
    expect(screen.getByTestId('footer-left')).toHaveTextContent('Registered devices: 2/2');

    // A new response of one plugin replaces its own rows and keeps the rows of the other plugin
    sendWebSocketMessage({
      id: 7,
      method: '/api/platform-devices',
      pluginName: 'matterbridge-test',
      response: [{ plugin: 'matterbridge-test', deviceName: 'Replacement Device', serialNumber: 'test2' }],
    });
    expect(screen.queryByText('Test Device')).not.toBeInTheDocument();
    expect(screen.getByText('Replacement Device')).toBeInTheDocument();
    expect(screen.getByText('Other Device')).toBeInTheDocument();
    expect(screen.getByTestId('footer-left')).toHaveTextContent('Registered devices: 2/2');

    // An empty response of one plugin removes all its registered rows and keeps the rows of the other plugin
    sendWebSocketMessage({ id: 7, method: '/api/platform-devices', pluginName: 'matterbridge-test', response: [] });
    expect(screen.queryByText('Replacement Device')).not.toBeInTheDocument();
    expect(screen.getByText('Other Device')).toBeInTheDocument();
    expect(screen.getByTestId('footer-left')).toHaveTextContent('Registered devices: 1/1');
  });

  it('shows the registered devices count when a plugin answers /api/platform-devices without devices', () => {
    const { sendWebSocketMessage } = renderComponent();
    sendWebSocketMessage({ id: 7, method: '/api/plugins', response: plugins });
    expect(screen.getByTestId('footer-left')).toHaveTextContent('Loading devices...');
    sendWebSocketMessage({ id: 7, method: '/api/platform-devices', pluginName: 'matterbridge-test', response: [] });
    expect(screen.getByTestId('footer-left')).toHaveTextContent('Registered devices: 0/0');
  });

  it('shows the registered devices count when no plugin is running', () => {
    const { sendMessage, sendWebSocketMessage } = renderComponent();
    sendWebSocketMessage({ id: 7, method: '/api/plugins', response: [{ ...plugins[0], enabled: false, loaded: false, started: false }] });
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ method: '/api/platform-devices' }));
    expect(screen.getByTestId('footer-left')).toHaveTextContent('Registered devices: 0/0');
  });

  it('shows the Connecting component when the websocket is offline', () => {
    renderComponent({ online: false });
    expect(screen.getByText('Connecting')).toBeInTheDocument();
  });

  it('does not request devices until all enabled plugins are loaded, started, and error-free, skipping disabled plugins', () => {
    const { sendMessage, sendWebSocketMessage } = renderComponent();
    sendWebSocketMessage({
      id: 7,
      method: '/api/plugins',
      response: [
        { name: 'disabled-plugin', enabled: false, loaded: false, started: false, error: false, schemaJson: { properties: {} }, configJson: { whiteList: [], blackList: [] } },
        { name: 'starting-plugin', enabled: true, loaded: true, started: false, error: false, schemaJson: { properties: {} }, configJson: { whiteList: [], blackList: [] } },
      ],
    });

    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ method: '/api/platform-devices' }));
    expect(screen.getByTestId('footer-left')).toHaveTextContent('Loading plugins...');
  });

  it('shows a restart required footer message on restart_required and clears it on restart_not_required', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test');

    sendWebSocketMessage({ id: 0, method: 'restart_required' });
    expect(screen.getByTestId('footer-right')).toHaveTextContent('Restart Required');

    sendWebSocketMessage({ id: 0, method: 'restart_not_required' });
    expect(screen.getByTestId('footer-right')).toHaveTextContent('');
  });

  it('merges a device that only exists in selectDevices into the table', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test');

    sendWebSocketMessage({
      id: 7,
      method: '/api/select-devices',
      response: [{ plugin: 'matterbridge-test', deviceName: 'Select Only Device', serialNumber: 'select-only' }],
    });

    expect(screen.getByTestId('row-matterbridge-test::select-only')).toBeInTheDocument();
    expect(screen.getByText('Select Only Device')).toBeInTheDocument();
  });

  it('drops a select-only row once a later /api/platform-devices response reports that device as registered', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test');
    sendWebSocketMessage({
      id: 7,
      method: '/api/select-devices',
      response: [{ plugin: 'matterbridge-test', deviceName: 'Newly Registered Device', serialNumber: 'promoted' }],
    });
    expect(screen.getByText('Newly Registered Device')).toBeInTheDocument();

    // A fresh /api/platform-devices response now reports that same device as registered: the select-only row must
    // be superseded, not duplicated.
    sendWebSocketMessage({
      id: 7,
      method: '/api/platform-devices',
      response: [
        { plugin: 'matterbridge-test', deviceName: 'Test Device', serialNumber: 'test1' },
        { plugin: 'matterbridge-test', deviceName: 'Newly Registered Device', serialNumber: 'promoted', reachable: true },
      ],
    });

    expect(screen.getAllByTestId('row-matterbridge-test::promoted')).toHaveLength(1);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('handles a plugin select-devices response that lists both a registered and an unregistered device, keeping only the unregistered one as a new row', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test');

    // /api/select-devices for a plugin reports every device it knows, registered or not - not just the
    // unregistered ones. The already-registered device ('test1', from api/platform-devices) must not be duplicated
    // or overridden; only the still-unregistered device should show up as a new row.
    sendWebSocketMessage({
      id: 7,
      method: '/api/select-devices',
      response: [
        { plugin: 'matterbridge-test', deviceName: 'Duplicate Name', serialNumber: 'test1' },
        { plugin: 'matterbridge-test', deviceName: 'Not Yet Registered', serialNumber: 'unregistered' },
      ],
    });

    expect(screen.getAllByTestId('row-matterbridge-test::test1')).toHaveLength(1);
    expect(screen.getByText('Test Device')).toBeInTheDocument();
    expect(screen.queryByText('Duplicate Name')).not.toBeInTheDocument();
    expect(screen.getByTestId('row-matterbridge-test::unregistered')).toBeInTheDocument();
    expect(screen.getByText('Not Yet Registered')).toBeInTheDocument();
  });

  it('does not duplicate a device present in both devices and selectDevices', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test');

    sendWebSocketMessage({
      id: 7,
      method: '/api/select-devices',
      response: [{ plugin: 'matterbridge-test', deviceName: 'Duplicate Name', serialNumber: 'test1' }],
    });

    expect(screen.getAllByTestId('row-matterbridge-test::test1')).toHaveLength(1);
    expect(screen.getByText('Test Device')).toBeInTheDocument();
    expect(screen.queryByText('Duplicate Name')).not.toBeInTheDocument();
  });

  it('keeps the full devices row, not just its name, when the same device also appears in selectDevices with conflicting fields', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test', { reachable: true });
    expect(screen.getByText('Online')).toBeInTheDocument();

    // Same plugin+serial, but a conflicting reachable value and name coming from selectDevices.
    sendWebSocketMessage({
      id: 7,
      method: '/api/select-devices',
      response: [{ plugin: 'matterbridge-test', deviceName: 'Select Version', serialNumber: 'test1', reachable: false }],
    });

    expect(screen.getAllByTestId('row-matterbridge-test::test1')).toHaveLength(1);
    expect(screen.getByText('Test Device')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.queryByText('Select Version')).not.toBeInTheDocument();
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
  });

  it('drops a device from the table once a new /api/plugins cycle no longer reports it', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test');
    expect(screen.getByText('Test Device')).toBeInTheDocument();

    // A second /api/plugins response resets devices/selectDevices, then a new /api/platform-devices response
    // arrives without the old device: the mixed list must reflect the new snapshot, not keep stale rows.
    sendWebSocketMessage({ id: 7, method: '/api/plugins', response: plugins });
    sendWebSocketMessage({
      id: 7,
      method: '/api/platform-devices',
      pluginName: 'matterbridge-test',
      response: [{ plugin: 'matterbridge-test', deviceName: 'Replacement Device', serialNumber: 'test2' }],
    });

    expect(screen.queryByText('Test Device')).not.toBeInTheDocument();
    expect(screen.getByText('Replacement Device')).toBeInTheDocument();
  });

  it('preserves a row selected state and matter info when a reachable update patches the same row', () => {
    const setStoreId = vi.fn();
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test', { matter: { id: 'MatterId' } }, { plugins: selectablePlugin, setStoreId, storeId: null });
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
    expect(screen.getByRole('button', { name: 'Show the QRCode' })).toBeInTheDocument();

    sendWebSocketMessage({
      id: 0,
      method: 'state_update',
      response: { plugin: 'matterbridge-test', serialNumber: 'test1', cluster: 'BridgedDeviceBasicInformation', attribute: 'reachable', value: false },
    });

    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(checkbox).toBeChecked();
    expect(screen.getByRole('button', { name: 'Show the QRCode' })).toBeInTheDocument();
  });

  it('sends the unselect request for a row that only exists in selectDevices', () => {
    const { sendMessage, sendWebSocketMessage } = renderComponent();
    sendWebSocketMessage({ id: 7, method: '/api/plugins', response: selectablePlugin });
    sendWebSocketMessage({
      id: 7,
      method: '/api/select-devices',
      response: [{ plugin: 'matterbridge-test', deviceName: 'Select Only Device', serialNumber: 'select-only' }],
    });

    const checkbox = within(screen.getByTestId('row-matterbridge-test::select-only')).getByRole('checkbox');
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: '/api/unselect',
        params: expect.objectContaining({ pluginName: 'matterbridge-test', serialNumber: 'select-only' }),
      }),
    );
    expect(checkbox).not.toBeChecked();
  });

  it('sends select when checking a device and unselect when unchecking it', () => {
    const { sendMessage } = renderWithDevice('/plugins/matterbridge-test', {}, { plugins: selectablePlugin });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ method: '/api/unselect', params: expect.objectContaining({ pluginName: 'matterbridge-test', serialNumber: 'test1' }) }),
    );
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ method: '/api/select', params: expect.objectContaining({ pluginName: 'matterbridge-test', serialNumber: 'test1' }) }),
    );
    expect(checkbox).toBeChecked();
  });

  it('keeps an unselected checkbox after an unrelated /api/select-devices response for a different plugin triggers a remix', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test', {}, { plugins: selectablePlugin });
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    // A response for an unrelated plugin still changes the `selectDevices` array's identity, which would
    // retrigger the mixing effect; the uncheck above must have already landed in `devices` too, or this
    // remix would rebuild the row from isSelected()'s stale (selected: true) result and silently re-check it.
    sendWebSocketMessage({
      id: 7,
      method: '/api/select-devices',
      response: [{ plugin: 'other-plugin', deviceName: 'Other Plugin Device', serialNumber: 'other1' }],
    });

    expect(checkbox).not.toBeChecked();
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

  it('uses the 6-bar battery icon for battery levels at or above 80 percent', () => {
    renderWithDevice('/plugins/matterbridge-test', { powerSource: 'ok', batteryLevel: 85 });
    expect(screen.getByTestId('Battery6BarIcon')).toBeInTheDocument();
    expect(screen.getByLabelText('Battery level: 85%')).toBeInTheDocument();
  });

  it('uses the fallback battery icon without a tooltip for warning power without a battery level', () => {
    renderWithDevice('/plugins/matterbridge-test', { powerSource: 'warning' });
    expect(screen.getByTestId('Battery3BarIcon')).toBeInTheDocument();
  });

  it('uses the fallback battery icon without a tooltip for critical power without a battery level', () => {
    renderWithDevice('/plugins/matterbridge-test', { powerSource: 'critical' });
    expect(screen.getByTestId('Battery1BarIcon')).toBeInTheDocument();
  });

  it('sorts online devices before offline devices before devices with unknown availability', () => {
    renderWithDevice('/plugins/matterbridge-test', { reachable: true });
    const availability = getLastColumns().find((column) => column.label === 'Availability');
    expect(availability?.comparator).toBeDefined();

    const online = { reachable: true } as never;
    const offline = { reachable: false } as never;
    const unknown = {} as never;

    expect(availability!.comparator!(online, offline)).toBeGreaterThan(0);
    expect(availability!.comparator!(offline, online)).toBeLessThan(0);
    expect(availability!.comparator!(offline, unknown)).toBeGreaterThan(0);
    expect(availability!.comparator!(unknown, offline)).toBeLessThan(0);
    expect(availability!.comparator!(online, unknown)).toBeGreaterThan(0);
    expect(availability!.comparator!(unknown, online)).toBeLessThan(0);
    expect(availability!.comparator!(online, online)).toBe(0);
    expect(availability!.comparator!(unknown, unknown)).toBe(0);
  });

  it('requests /api/plugins on a plugins refresh_required unless the plugins list is locked', () => {
    const { sendMessage, sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test');
    sendMessage.mockClear();

    sendWebSocketMessage({ id: 0, method: 'refresh_required', response: { changed: 'plugins', lock: true } });
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ method: '/api/plugins' }));

    sendWebSocketMessage({ id: 0, method: 'refresh_required', response: { changed: 'plugins', lock: false } });
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/plugins' }));
  });

  it('shows the QR code button once a matching matter refresh_required arrives, and ignores a non-matching one first', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test', { name: 'Test Device' });
    expect(screen.queryByRole('button', { name: 'Show the QRCode' })).not.toBeInTheDocument();

    sendWebSocketMessage({ id: 0, method: 'refresh_required', response: { changed: 'matter', matter: { id: 'NoSuchDevice' } } });
    expect(screen.queryByRole('button', { name: 'Show the QRCode' })).not.toBeInTheDocument();

    sendWebSocketMessage({ id: 0, method: 'refresh_required', response: { changed: 'matter', matter: { id: 'TestDevice' } } });
    expect(screen.getByRole('button', { name: 'Show the QRCode' })).toBeInTheDocument();
  });

  it('handles a matterbridge_status_update message without crashing', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test');
    sendWebSocketMessage({ id: 0, method: 'matterbridge_status_update', response: { status: 'started' } });
    expect(screen.getByTestId('devices-table')).toBeInTheDocument();
  });

  it('applies restart flags and status from an /api/settings response', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test');
    sendWebSocketMessage({
      id: 7,
      method: '/api/settings',
      response: { matterbridgeInformation: { restartRequired: true, fixedRestartRequired: false, bridgeMode: 'bridge', bridgeStatus: 'started' } },
    });
    expect(screen.getByTestId('footer-right')).toHaveTextContent('Restart Required');
  });

  it('replaces previously received selectDevices for the same plugin without leaving stale rows', () => {
    const { sendWebSocketMessage } = renderWithDevice('/plugins/matterbridge-test');

    sendWebSocketMessage({ id: 7, method: '/api/select-devices', response: [{ plugin: 'matterbridge-test', deviceName: 'First Select', serialNumber: 'select-a' }] });
    expect(screen.getByText('First Select')).toBeInTheDocument();

    sendWebSocketMessage({ id: 7, method: '/api/select-devices', response: [{ plugin: 'matterbridge-test', deviceName: 'Second Select', serialNumber: 'select-b' }] });
    expect(screen.getByText('Second Select')).toBeInTheDocument();
    expect(screen.queryByText('First Select')).not.toBeInTheDocument();
  });

  it('computes device selection from plugin whitelist/blacklist rules for serial and name select modes, and warns for an unknown plugin', () => {
    const selectionPlugins = [
      {
        name: 'serial-plugin',
        enabled: true,
        loaded: true,
        started: true,
        error: false,
        hasWhiteList: true,
        hasBlackList: true,
        schemaJson: { properties: { whiteList: { selectFrom: 'serial' } } },
        configJson: { whiteList: ['allowed-serial'], blackList: ['blocked-serial'], postfix: '' },
      },
      {
        name: 'name-plugin',
        enabled: true,
        loaded: true,
        started: true,
        error: false,
        hasWhiteList: true,
        hasBlackList: true,
        schemaJson: { properties: { whiteList: { selectFrom: 'name' } } },
        configJson: { whiteList: ['Allowed Name'], blackList: ['Blocked Name'] },
      },
    ];
    const { sendWebSocketMessage } = renderComponent();
    sendWebSocketMessage({ id: 7, method: '/api/plugins', response: selectionPlugins });
    sendWebSocketMessage({
      id: 7,
      method: '/api/select-devices',
      response: [
        { plugin: 'serial-plugin', deviceName: 'Allowed Serial Device', serialNumber: 'allowed-serial' },
        { plugin: 'serial-plugin', deviceName: 'Other Serial Device', serialNumber: 'other-serial' },
        { plugin: 'serial-plugin', deviceName: 'Blocked Serial Device', serialNumber: 'blocked-serial' },
        { plugin: 'ghost-plugin', deviceName: 'Unknown Plugin Device', serialNumber: 'ghost-serial' },
      ],
    });
    sendWebSocketMessage({
      id: 7,
      method: '/api/select-devices',
      response: [
        { plugin: 'name-plugin', deviceName: 'Allowed Name', serialNumber: 's1' },
        { plugin: 'name-plugin', deviceName: 'Other Name', serialNumber: 's2' },
        { plugin: 'name-plugin', deviceName: 'Blocked Name', serialNumber: 's3' },
      ],
    });

    const checkboxFor = (testId: string) => within(screen.getByTestId(testId)).getByRole('checkbox');
    expect(checkboxFor('row-serial-plugin::allowed-serial')).toBeChecked();
    expect(checkboxFor('row-serial-plugin::other-serial')).not.toBeChecked();
    expect(checkboxFor('row-serial-plugin::blocked-serial')).not.toBeChecked();
    expect(checkboxFor('row-name-plugin::s1')).toBeChecked();
    expect(checkboxFor('row-name-plugin::s2')).not.toBeChecked();
    expect(checkboxFor('row-name-plugin::s3')).not.toBeChecked();
    expect(within(screen.getByTestId('row-ghost-plugin::ghost-serial')).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('plugin ghost-plugin not found'));
  });

  it('closes the plugin frontend dialog via the Close button', () => {
    renderWithDevice('/plugins/matterbridge-test');
    singleClick(screen.getByRole('button', { name: 'Open config url' }));
    expect(screen.getByTitle('Test Device frontend')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTitle('Test Device frontend')).not.toBeInTheDocument();
  });

  it('closes the plugin frontend dialog on Escape', () => {
    renderWithDevice('/plugins/matterbridge-test');
    singleClick(screen.getByRole('button', { name: 'Open config url' }));

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(screen.queryByTitle('Test Device frontend')).not.toBeInTheDocument();
  });

  it('opens an external configUrl in a new browser tab instead of the dialog', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderWithDevice('https://example.com/config');

    const configButton = screen.getByRole('button', { name: 'Open config url' });
    expect(within(configButton).getByTestId('SettingsIcon')).toBeInTheDocument();
    singleClick(configButton);

    expect(openSpy).toHaveBeenCalledWith('https://example.com/config', '_blank');
    expect(screen.queryByTitle('Test Device frontend')).not.toBeInTheDocument();
    openSpy.mockRestore();
  });

  it('opens the plugin frontend in a new browser tab on double click instead of the dialog', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderWithDevice('./plugins/matterbridge-test?device=test1');

    const configButton = screen.getByRole('button', { name: 'Open config url' });
    fireEvent.click(configButton);
    fireEvent.click(configButton);
    fireEvent.doubleClick(configButton);

    expect(openSpy).toHaveBeenCalledWith('/plugins/matterbridge-test/?device=test1', '_blank');
    expect(screen.queryByTitle('Test Device frontend')).not.toBeInTheDocument();
    openSpy.mockRestore();
  });

  it('does not show the config button when the configUrl points to another plugin frontend', () => {
    renderWithDevice('/plugins/matterbridge-test-other/');

    expect(screen.queryByRole('button', { name: 'Open config url' })).not.toBeInTheDocument();
  });

  it('injects scrollbar styling into the plugin frontend iframe once it loads', () => {
    renderWithDevice('/plugins/matterbridge-test');
    singleClick(screen.getByRole('button', { name: 'Open config url' }));
    const iframe = screen.getByTitle('Test Device frontend') as unknown as HTMLIFrameElement;
    // jsdom's default iframe document has no <head> (unlike a real browser's about:blank), so the
    // component's `!iframeDocument?.head` guard would always short-circuit; write a minimal document
    // to give the iframe a real head, matching what a real browser provides once a page has loaded.
    const iframeDocument = iframe.contentDocument;
    if (iframeDocument) {
      iframeDocument.open();
      const html = iframeDocument.createElement('html');
      html.append(iframeDocument.createElement('head'), iframeDocument.createElement('body'));
      iframeDocument.replaceChildren(html);
      iframeDocument.close();
    }

    fireEvent.load(iframe);

    expect(iframe.contentDocument?.getElementById('matterbridge-plugin-scrollbar-style')).not.toBeNull();
  });

  it('replaces a previously injected scrollbar style tag instead of duplicating it', () => {
    renderWithDevice('/plugins/matterbridge-test');
    singleClick(screen.getByRole('button', { name: 'Open config url' }));
    const iframe = screen.getByTitle('Test Device frontend') as unknown as HTMLIFrameElement;
    const iframeDocument = iframe.contentDocument;
    if (iframeDocument) {
      iframeDocument.open();
      const html = iframeDocument.createElement('html');
      html.append(iframeDocument.createElement('head'), iframeDocument.createElement('body'));
      iframeDocument.replaceChildren(html);
      iframeDocument.close();
    }

    fireEvent.load(iframe);
    fireEvent.load(iframe);

    expect(iframe.contentDocument?.querySelectorAll('#matterbridge-plugin-scrollbar-style')).toHaveLength(1);
  });

  it('does nothing on iframe load when the iframe has no accessible document', () => {
    renderWithDevice('/plugins/matterbridge-test');
    singleClick(screen.getByRole('button', { name: 'Open config url' }));
    const iframe = screen.getByTitle('Test Device frontend') as unknown as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentDocument', { value: null, configurable: true });

    expect(() => fireEvent.load(iframe)).not.toThrow();
  });
});
