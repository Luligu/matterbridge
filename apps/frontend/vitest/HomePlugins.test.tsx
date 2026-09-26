import '@testing-library/jest-dom';

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest';

import type { MbfTableColumn } from '../src/components/MbfTable';
import type { ApiPlugin } from '../src/utils/backendShared';

const settings = vi.hoisted(() => ({ debug: true, enableMobile: true, basePath: '/bridge/' }));
vi.mock('../src/appState', () => settings);
vi.mock('../src/components/Connecting', () => ({ Connecting: () => <div>Connecting</div> }));
vi.mock('../src/components/ConfigPluginDialog', () => ({
  ConfigPluginDialog: ({ open, onClose, onSave, plugin }: { open: boolean; onClose: () => void; onSave: (config: ApiPlugin['configJson']) => void; plugin: ApiPlugin }) =>
    open ? (
      <dialog open aria-label="Plugin configuration">
        <span>{plugin.name}</span>
        <button type="button" onClick={() => onSave({ name: plugin.name, type: 'DynamicPlatform', version: '1.0.0', debug: false, unregisterOnShutdown: false, enabled: true })}>
          Save config
        </button>
        <button type="button" onClick={onClose}>
          Close config
        </button>
      </dialog>
    ) : null,
}));
vi.mock('../src/components/MbfWindow', () => ({ MbfWindow: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../src/components/MbfTable', () => ({
  default: ({ rows, columns }: { rows: ApiPlugin[]; columns: MbfTableColumn<ApiPlugin>[] }) => (
    <div>
      <div data-testid="plugin-versions">{rows.map((plugin) => `${plugin.name}:${plugin.latestVersion ?? ''}:${plugin.devVersion ?? ''}`).join('|')}</div>
      {rows.map((plugin) => (
        <div key={plugin.name} data-testid={plugin.name}>
          {columns.map((column) => (
            <div key={column.id} data-testid={`${plugin.name}-${column.label}`}>
              {column.render ? column.render(plugin[column.id as keyof ApiPlugin], plugin.name, plugin, column) : plugin.registeredDevices}
            </div>
          ))}
          <output data-testid={`${plugin.name}-config`}>{JSON.stringify(plugin.configJson)}</output>
          <output data-testid={`${plugin.name}-matter`}>{JSON.stringify(plugin.matter)}</output>
        </div>
      ))}
    </div>
  ),
}));

import HomePlugins from '../src/components/HomePlugins';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';

const plugins = [
  { name: 'plugin-one', version: '1.0.0', latestVersion: '1.0.0', devVersion: '1.0.0-dev' },
  { name: 'plugin-two', version: '2.0.0', latestVersion: '2.0.0', devVersion: '2.0.0-dev' },
] as ApiPlugin[];

const uiContext = { mobile: false, showConfirmCancelDialog: vi.fn() } as unknown as UiContextType;

beforeEach(() => {
  settings.debug = true;
  settings.enableMobile = true;
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(window, 'open').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.style.removeProperty('--primary-color');
  document.body.style.removeProperty('--div-bg-color');
});

function createPlugin(overrides: Partial<ApiPlugin> = {}): ApiPlugin {
  return {
    name: 'plugin-one',
    description: 'Example plugin',
    version: '1.0.0-dev-1',
    latestVersion: '1.1.0',
    devVersion: '1.1.0-dev-1',
    author: 'https://github.com/tester',
    type: 'DynamicPlatform',
    path: '/plugins/one',
    local: false,
    enabled: true,
    loaded: true,
    started: true,
    configured: true,
    error: false,
    registeredDevices: 2,
    configJson: { name: 'plugin-one', type: 'DynamicPlatform', version: '1.0.0', debug: false, unregisterOnShutdown: false, enabled: false },
    homepage: 'https://example.com',
    help: 'https://example.com/help',
    changelog: 'https://example.com/history',
    funding: 'https://example.com/fund',
    matter: { id: 'node-one', online: true, commissioned: false, advertising: true },
    ...overrides,
  } as ApiPlugin;
}

function renderPlugins({ online = true, mobile = false }: { online?: boolean; mobile?: boolean } = {}) {
  const addListener = vi.fn();
  const removeListener = vi.fn();
  const sendMessage = vi.fn();
  const getUniqueId = vi.fn().mockReturnValue(7);
  const setStoreId = vi.fn();
  const showConfirmCancelDialog = vi.fn();
  const context = { online, addListener, removeListener, sendMessage, getUniqueId } as unknown as WebSocketContextType;
  const view = (nextContext: WebSocketContextType) => (
    <WebSocketContext.Provider value={nextContext}>
      <UiContext.Provider value={{ mobile, showConfirmCancelDialog } as unknown as UiContextType}>
        <HomePlugins storeId={null} setStoreId={setStoreId} />
      </UiContext.Provider>
    </WebSocketContext.Provider>
  );
  const result = render(view(context));
  const listener = addListener.mock.calls[0][0] as (message: unknown) => void;
  const update = (message: unknown) => act(() => listener(message));
  return {
    ...result,
    addListener,
    removeListener,
    sendMessage,
    getUniqueId,
    setStoreId,
    showConfirmCancelDialog,
    listener,
    update,
    context,
    rerenderContext: (nextContext: WebSocketContextType) => result.rerender(view(nextContext)),
    load: (rows: ApiPlugin[] = [createPlugin()], information: Record<string, unknown> | null = { bridgeMode: 'childbridge', readOnly: false }) => {
      if (information) update({ id: 7, method: '/api/settings', response: { systemInformation: {}, matterbridgeInformation: { bridgeStatus: 'running', ...information } } });
      update({ id: 7, method: '/api/plugins', response: rows });
    },
  };
}

function pluginButton(name: string | RegExp, pluginName = 'plugin-one') {
  return within(screen.getByTestId(pluginName)).getByRole('button', { name });
}

describe('HomePlugins', () => {
  test('should request data on connection, ignore mismatched replies, and clean up its listener', () => {
    settings.debug = false;
    const { context, rerenderContext, sendMessage, getUniqueId, addListener, removeListener, listener, update, unmount } = renderPlugins({ online: false });
    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(addListener).toHaveBeenCalledExactlyOnceWith(listener, 7);
    getUniqueId.mockReturnValue(99);
    rerenderContext({ ...context, online: true });
    expect(screen.queryByText('Connecting')).not.toBeInTheDocument();
    expect(sendMessage.mock.calls.map(([message]) => message)).toEqual([
      { id: 7, sender: 'HomePlugins', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} },
      { id: 7, sender: 'HomePlugins', method: '/api/plugins', src: 'Frontend', dst: 'Matterbridge', params: {} },
    ]);
    update({ id: 99, method: '/api/plugins', response: [createPlugin()] });
    update({ id: 99, method: '/api/settings', response: {} });
    update({ id: 7, method: 'unrelated', response: {} });
    expect(screen.getByTestId('plugin-versions')).toBeEmptyDOMElement();
    expect(addListener).toHaveBeenCalledTimes(1);
    unmount();
    expect(removeListener).toHaveBeenCalledExactlyOnceWith(listener);
    expect(console.log).not.toHaveBeenCalled();
  });

  test.each([false, true])('should route broadcast updates only to matching plugins with debug=%s', (debug) => {
    settings.debug = debug;
    const { load, update, sendMessage } = renderPlugins();
    const first = createPlugin();
    const second = createPlugin({ name: 'plugin-two', matter: { ...first.matter!, id: 'node-two' } });
    load([first, second]);
    sendMessage.mockClear();
    update({ method: 'refresh_required', response: { changed: 'plugins', lock: 'plugin-one' } });
    expect(pluginButton('Plugin config')).toBeDisabled();
    expect(pluginButton('Plugin config', 'plugin-two')).toBeEnabled();
    expect(sendMessage).not.toHaveBeenCalled();
    update({ method: 'refresh_required', response: { changed: 'plugins' } });
    update({ method: 'refresh_required', response: { changed: 'settings' } });
    expect(sendMessage.mock.calls.map(([message]) => message.method)).toEqual(['/api/plugins', '/api/settings']);
    update({ method: 'refresh_required', response: { changed: 'matter', matter: { ...first.matter, commissioned: true } } });
    expect(JSON.parse(screen.getByTestId('plugin-one-matter').textContent)).toEqual({ ...first.matter, commissioned: true });
    expect(JSON.parse(screen.getByTestId('plugin-two-matter').textContent)).toEqual(second.matter);
    const before = screen.getByTestId('plugin-one-matter').textContent;
    update({ method: 'refresh_required', response: { changed: 'matter', matter: { id: 'unknown' } } });
    update({ method: 'refresh_required', response: { changed: 'matter' } });
    expect(screen.getByTestId('plugin-one-matter').textContent).toBe(before);
    update({ method: 'plugin_update_required', response: { plugin: 'plugin-one', version: '2.0.0', devVersion: false } });
    update({ method: 'plugin_update_required', response: { plugin: 'plugin-two', version: '2.1.0-dev-1', devVersion: true } });
    expect(screen.getByTestId('plugin-versions')).toHaveTextContent('plugin-one:2.0.0:1.1.0-dev-1|plugin-two:1.1.0:2.1.0-dev-1');
    update({ method: 'plugin_status_update', response: { plugin: 'plugin-one', status: { error: true } } });
    expect(screen.getByTestId('plugin-one-Status')).toHaveTextContent('Error');
    expect(screen.getByTestId('plugin-two-Status')).toHaveTextContent('Running');
    update({ method: 'matterbridge_status_update', response: { status: 'active' } });
    update({ method: 'refresh_required', response: { changed: 'unrelated' } });
    expect(screen.getByTestId('plugin-two-Status')).toHaveTextContent('Running');
  });

  test.each([
    { version: '1.2.3', display: '1.2.3' },
    { version: '1.2.3-dev-4', display: '1.2.3@dev' },
    { version: '1.2.3-git-abc', display: '1.2.3@git' },
  ])('should render version $version as $display', ({ version, display }) => {
    const { load } = renderPlugins();
    load([createPlugin({ version })]);
    expect(screen.getByTestId('plugin-one-Version')).toHaveTextContent(display);
    expect(screen.getByTestId('plugin-one-Author')).toHaveTextContent('tester');
    expect(screen.getByTestId('plugin-one-Type')).toHaveTextContent('Dynamic');
    expect(screen.getByTestId('plugin-one-Devices')).toHaveTextContent('2');
  });

  test.each([
    { overrides: { error: true }, status: 'Error' },
    { overrides: { enabled: false }, status: 'Disabled' },
    { overrides: { loaded: false, started: false, configured: false }, status: 'Loaded' },
    { overrides: { started: false }, status: 'Started' },
    { overrides: { configured: false }, status: 'Configured' },
    { overrides: {}, status: 'Running' },
  ])('should display $status for the plugin lifecycle state', ({ overrides, status }) => {
    const { load } = renderPlugins();
    load([createPlugin(overrides)]);
    expect(screen.getByTestId('plugin-one-Status')).toHaveTextContent(status);
  });

  test('should show local paths and fallback metadata without offering local updates', () => {
    const { load } = renderPlugins();
    load([createPlugin({ local: true, author: '', type: undefined })]);
    expect(pluginButton('Local plugin path: /plugins/one')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-one-Author')).toHaveTextContent('Unknown');
    expect(screen.getByTestId('plugin-one-Type')).toHaveTextContent('Unknown');
    expect(screen.queryByRole('button', { name: /Update the plugin/ })).not.toBeInTheDocument();
  });

  test.each([
    { name: 'no settings', information: null, overrides: {}, qr: false, remove: false, latest: false, dev: false },
    { name: 'bridge', information: { bridgeMode: 'bridge', readOnly: false }, overrides: {}, qr: false, remove: true, latest: true, dev: true },
    { name: 'read only', information: { bridgeMode: 'childbridge', readOnly: true }, overrides: {}, qr: true, remove: false, latest: false, dev: false },
    { name: 'error', information: { bridgeMode: 'childbridge', readOnly: false }, overrides: { error: true }, qr: false, remove: true, latest: true, dev: true },
    {
      name: 'disabled',
      information: { bridgeMode: 'childbridge', readOnly: false },
      overrides: { enabled: false, frontendPath: '/frontend' },
      qr: false,
      remove: true,
      latest: true,
      dev: true,
    },
    {
      name: 'unknown versions',
      information: { bridgeMode: 'childbridge', readOnly: false },
      overrides: { latestVersion: undefined, devVersion: undefined },
      qr: true,
      remove: true,
      latest: false,
      dev: false,
    },
    {
      name: 'current versions',
      information: { bridgeMode: 'childbridge', readOnly: false },
      overrides: { latestVersion: '1.0.0-dev-1', devVersion: '1.0.0-dev-1' },
      qr: true,
      remove: true,
      latest: false,
      dev: false,
    },
    { name: 'stable version', information: { bridgeMode: 'childbridge', readOnly: false }, overrides: { version: '1.0.0' }, qr: true, remove: true, latest: true, dev: false },
  ])('should gate actions for $name', ({ information, overrides, qr, remove, latest, dev }) => {
    const { load } = renderPlugins();
    load([createPlugin(overrides)], information);
    const actions = within(screen.getByTestId('plugin-one-Actions'));
    expect(actions.queryAllByRole('button', { name: 'Shows the QRCode or the fabrics' })).toHaveLength(qr ? 1 : 0);
    expect(actions.queryAllByRole('button', { name: 'Restart the plugin' })).toHaveLength(qr ? 1 : 0);
    expect(actions.queryAllByRole('button', { name: 'Remove the plugin' })).toHaveLength(remove ? 1 : 0);
    expect(actions.queryAllByRole('button', { name: 'Sponsor the plugin' })).toHaveLength(remove ? 1 : 0);
    expect(actions.queryAllByRole('button', { name: /Update the plugin to the latest version/ })).toHaveLength(latest ? 1 : 0);
    expect(actions.queryAllByRole('button', { name: /Update the plugin to the latest dev version/ })).toHaveLength(dev ? 1 : 0);
    expect(actions.queryByRole('button', { name: 'Open the plugin frontend' })).not.toBeInTheDocument();
  });

  test.each([false, true])('should dispatch plugin actions and configuration changes with debug=%s', (debug) => {
    settings.debug = debug;
    const { load, sendMessage, setStoreId, showConfirmCancelDialog } = renderPlugins();
    load([createPlugin(), createPlugin({ name: 'plugin-two' })]);
    sendMessage.mockClear();
    fireEvent.click(pluginButton('Shows the QRCode or the fabrics'));
    expect(setStoreId).toHaveBeenCalledExactlyOnceWith('node-one');
    fireEvent.click(pluginButton('Restart the plugin'));
    fireEvent.click(pluginButton(/Update the plugin to the latest version/));
    fireEvent.click(pluginButton(/Update the plugin to the latest dev version/));
    expect(sendMessage.mock.calls.map(([message]) => [message.method, message.params])).toEqual([
      ['/api/restartplugin', { pluginName: 'plugin-one' }],
      ['/api/install', { packageName: 'plugin-one', restart: false }],
      ['/api/install', { packageName: 'plugin-one@dev', restart: false }],
    ]);
    fireEvent.click(pluginButton('Remove the plugin'));
    expect(showConfirmCancelDialog).toHaveBeenLastCalledWith('Remove plugin', expect.any(String), 'remove', expect.any(Function), expect.any(Function));
    const confirm = showConfirmCancelDialog.mock.calls.at(-1)![3] as (command: string) => void;
    const cancel = showConfirmCancelDialog.mock.calls.at(-1)![4] as (command: string) => void;
    const beforeConfirm = sendMessage.mock.calls.length;
    act(() => cancel('remove'));
    act(() => confirm('remove'));
    expect(sendMessage).toHaveBeenCalledTimes(beforeConfirm);
    fireEvent.click(pluginButton('Remove the plugin'));
    act(() => confirm('unknown'));
    expect(sendMessage).toHaveBeenCalledTimes(beforeConfirm);
    fireEvent.click(pluginButton('Remove the plugin'));
    act(() => confirm('remove'));
    expect(sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({ method: '/api/removeplugin', params: { pluginName: 'plugin-one' } }));
    fireEvent.click(pluginButton('Disable the plugin'));
    act(() => confirm('disable'));
    expect(sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({ method: '/api/disableplugin', params: { pluginName: 'plugin-one' } }));
    act(() => confirm('disable'));
    load([createPlugin({ enabled: false }), createPlugin({ name: 'plugin-two' })]);
    fireEvent.click(pluginButton('Enable the plugin'));
    expect(sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({ method: '/api/enableplugin', params: { pluginName: 'plugin-one' } }));

    fireEvent.click(pluginButton('Plugin config'));
    expect(sendMessage.mock.calls.slice(-2).map(([message]) => [message.method, message.params])).toEqual([
      ['/api/select/devices', { plugin: 'plugin-one' }],
      ['/api/select/entities', { plugin: 'plugin-one' }],
    ]);
    expect(screen.getByRole('dialog', { name: 'Plugin configuration' })).toHaveTextContent('plugin-one');
    fireEvent.click(screen.getByRole('button', { name: 'Save config' }));
    expect(JSON.parse(screen.getByTestId('plugin-one-config').textContent)).toEqual({ ...createPlugin().configJson, enabled: true });
    expect(pluginButton('Plugin config')).toBeDisabled();
    expect(pluginButton('Plugin config', 'plugin-two')).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Close config' }));
    expect(screen.queryByRole('dialog', { name: 'Plugin configuration' })).not.toBeInTheDocument();
  });

  test.each([false, true])('should open available links and ignore missing links with debug=%s', (debug) => {
    settings.debug = debug;
    const { load } = renderPlugins();
    load();
    for (const name of ['Plugin path /plugins/one', 'Open the plugin homepage', 'Open the plugin help', 'Open the plugin version history', 'Sponsor the plugin'])
      fireEvent.click(pluginButton(name));
    expect(vi.mocked(window.open).mock.calls).toEqual([
      ['https://example.com', '_blank'],
      ['https://example.com', '_blank'],
      ['https://example.com/help', '_blank'],
      ['https://example.com/history', '_blank'],
      ['https://example.com/fund', '_blank'],
    ]);
    vi.mocked(window.open).mockClear();
    load([createPlugin({ homepage: '', help: '', changelog: '', funding: '', matter: undefined })]);
    for (const name of [
      'Plugin path /plugins/one',
      'Open the plugin homepage',
      'Open the plugin help',
      'Open the plugin version history',
      'Sponsor the plugin',
      'Shows the QRCode or the fabrics',
    ])
      fireEvent.click(pluginButton(name));
    expect(window.open).not.toHaveBeenCalled();
  });

  test.each([
    { mobile: false, enableMobile: true, responsive: false, themed: true },
    { mobile: true, enableMobile: false, responsive: false, themed: false },
    { mobile: true, enableMobile: true, responsive: true, themed: false },
  ])('should open, theme, and close the frontend with mobile=$mobile and enableMobile=$enableMobile', async ({ mobile, enableMobile, responsive, themed }) => {
    settings.enableMobile = enableMobile;
    document.body.style.setProperty('--primary-color', themed ? '#123456' : '');
    document.body.style.setProperty('--div-bg-color', themed ? '#abcdef' : '');
    const { load } = renderPlugins({ mobile });
    load([createPlugin({ frontendPath: '/disk/plugin/build' })]);
    fireEvent.click(pluginButton('Open the plugin frontend'));
    const iframe = screen.getByTitle<HTMLIFrameElement>('plugin-one frontend');
    expect(iframe).toHaveAttribute('src', '/bridge/plugins/plugin-one/');
    const style = getComputedStyle(screen.getByRole('dialog'));
    expect(style.width).toBe(`${window.innerWidth * (responsive ? 1 : 0.75)}px`);
    expect(style.height).toBe(`${window.innerHeight * (responsive ? 1 : 0.75)}px`);
    const iframeDocument = document.implementation.createHTMLDocument('plugin');
    vi.spyOn(iframe, 'contentDocument', 'get').mockReturnValue(iframeDocument);
    fireEvent.load(iframe);
    const injected = iframeDocument.getElementById('matterbridge-plugin-scrollbar-style');
    expect(injected?.textContent).toContain(themed ? '#123456' : '#0d6efd');
    expect(injected?.textContent).toContain(themed ? '#abcdef' : '#111111');
    fireEvent.load(iframe);
    expect(iframeDocument.querySelectorAll('#matterbridge-plugin-scrollbar-style')).toHaveLength(1);
    expect(iframeDocument.getElementById('matterbridge-plugin-scrollbar-style')).not.toBe(injected);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByTitle('plugin-one frontend')).not.toBeInTheDocument());
    fireEvent.click(await screen.findByRole('button', { name: 'Open the plugin frontend' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape', keyCode: 27 });
    await waitFor(() => expect(screen.queryByTitle('plugin-one frontend')).not.toBeInTheDocument());
  });

  test('should tolerate unavailable iframe documents and a removed frontend path', () => {
    const { load } = renderPlugins();
    const plugin = createPlugin({ frontendPath: '/frontend' });
    load([plugin]);
    const openButton = pluginButton('Open the plugin frontend');
    plugin.frontendPath = undefined;
    fireEvent.click(openButton);
    expect(screen.queryByTitle('plugin-one frontend')).not.toBeInTheDocument();
    plugin.frontendPath = '/frontend';
    fireEvent.click(openButton);
    const iframe = screen.getByTitle<HTMLIFrameElement>('plugin-one frontend');
    const documentSpy = vi.spyOn(iframe, 'contentDocument', 'get').mockReturnValue(null);
    expect(() => fireEvent.load(iframe)).not.toThrow();
    const documentWithoutHead = document.implementation.createHTMLDocument('plugin');
    documentWithoutHead.head.remove();
    documentSpy.mockReturnValue(documentWithoutHead);
    expect(() => fireEvent.load(iframe)).not.toThrow();
    expect(documentWithoutHead.querySelector('style')).toBeNull();
  });

  test('should replace and clean up WebSocket listeners when provider callbacks change', () => {
    const { context, listener, removeListener, rerenderContext, unmount } = renderPlugins();
    const nextAddListener = vi.fn();
    const nextRemoveListener = vi.fn();
    rerenderContext({ ...context, addListener: nextAddListener, removeListener: nextRemoveListener });
    expect(removeListener).toHaveBeenCalledExactlyOnceWith(listener);
    expect(nextAddListener).toHaveBeenCalledExactlyOnceWith(expect.any(Function), 7);
    unmount();
    expect(nextRemoveListener).toHaveBeenCalledExactlyOnceWith(nextAddListener.mock.calls[0][0]);
  });

  it('updates only the matching plugin version from a plugin update notification', () => {
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
          <HomePlugins storeId={null} setStoreId={vi.fn()} />
        </UiContext.Provider>
      </WebSocketContext.Provider>,
    );

    act(() => {
      listener?.({ id: 7, method: '/api/plugins', response: plugins });
      listener?.({ id: 0, method: 'plugin_update_required', response: { plugin: 'plugin-one', version: '1.1.0', devVersion: false } });
    });
    expect(screen.getByTestId('plugin-versions')).toHaveTextContent('plugin-one:1.1.0:1.0.0-dev|plugin-two:2.0.0:2.0.0-dev');

    act(() => {
      listener?.({ id: 0, method: 'plugin_update_required', response: { plugin: 'plugin-two', version: '2.1.0-dev', devVersion: true } });
    });
    expect(screen.getByTestId('plugin-versions')).toHaveTextContent('plugin-one:1.1.0:1.0.0-dev|plugin-two:2.0.0:2.1.0-dev');
  });
});
