import '@testing-library/jest-dom';

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest';

import type { ApiSettings } from '../src/utils/backendShared';

vi.mock('@mui/material/Menu', () => ({
  default: ({ id, open, onClose, children }: { id: string; open: boolean; onClose: () => void; children: React.ReactNode }) =>
    open ? (
      <menu aria-label={id}>
        {children}
        <button type="button" onClick={onClose}>
          Dismiss {id}
        </button>
      </menu>
    ) : null,
}));
vi.mock('@mui/material/MenuItem', () => ({
  default: ({ onClick, children }: { onClick: React.MouseEventHandler<HTMLButtonElement>; children: React.ReactNode }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

const appSettings = vi.hoisted(() => ({
  clearEnableMobile: vi.fn(),
  debug: false,
  enableMobile: true,
  setEnableMobile: vi.fn(),
  toggleDebug: vi.fn(),
}));
vi.mock('../src/appState', () => appSettings);
vi.mock('../src/viewport', () => ({ viewportWidth: 1200, viewportHeight: 800 }));
vi.mock('../src/utils/localStorage', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/utils/localStorage')>();
  return { ...original, resetLocalStorage: vi.fn() };
});

import { clearEnableMobile, setEnableMobile, toggleDebug } from '../src/appState';
import Header from '../src/components/Header';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';
import { MbfLsk, resetLocalStorage } from '../src/utils/localStorage';

const settings = {
  matterbridgeInformation: {
    rootDirectory: '',
    homeDirectory: '',
    matterbridgeDirectory: '',
    matterbridgePluginDirectory: '',
    matterbridgeCertDirectory: '',
    globalModulesDirectory: '',
    matterbridgeVersion: '3.9.2',
    matterbridgeLatestVersion: '3.9.3',
    matterbridgeDevVersion: '',
    frontendVersion: '3.4.18',
    dockerDev: undefined,
    dockerVersion: undefined,
    dockerLatestVersion: undefined,
    dockerDevVersion: undefined,
    bridgeMode: 'none',
    restartMode: 'none',
    virtualMode: 'disabled',
    profile: undefined,
    readOnly: false,
    shellyBoard: false,
    shellySysUpdate: false,
    shellyMainUpdate: false,
    loggerLevel: 'info',
    fileLogger: false,
    matterLoggerLevel: 'info',
    matterFileLogger: false,
    matterMdnsInterface: undefined,
    matterIpv4Address: undefined,
    matterIpv6Address: undefined,
    matterPort: 5540,
    matterDiscriminator: undefined,
    matterPasscode: undefined,
    restartRequired: false,
    fixedRestartRequired: false,
    updateRequired: false,
  },
  systemInformation: {
    interfaceName: '',
    macAddress: '',
    ipv4Address: '',
    ipv6Address: '',
    nodeVersion: '',
    hostname: '',
    user: '',
    osType: '',
    osRelease: '',
    osPlatform: '',
    osArch: '',
    totalMemory: '',
    freeMemory: '',
    systemUptime: '',
    processUptime: '',
    cpuUsage: '',
    processCpuUsage: '',
    rss: '',
    heapTotal: '',
    heapUsed: '',
  },
} as ApiSettings;

const uiContext: UiContextType = {
  mobile: false,
  setMobile: vi.fn(),
  currentPage: null,
  setCurrentPage: vi.fn(),
  showSnackbarMessage: vi.fn(),
  closeSnackbarMessage: vi.fn(),
  closeSnackbar: vi.fn(),
  showConfirmCancelDialog: vi.fn(),
  showInstallProgress: vi.fn(),
  exitInstallProgressSuccess: vi.fn(),
  exitInstallProgressError: vi.fn(),
  hideInstallProgress: vi.fn(),
  addInstallProgress: vi.fn(),
  installAutoExit: true,
  setInstallAutoExit: vi.fn(),
};

const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
const locationMock = { href: 'http://localhost/', reload: vi.fn() };

function LocationDisplay() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderHeader({ online = true, mobile = false }: { online?: boolean; mobile?: boolean } = {}) {
  const addListener = vi.fn();
  const removeListener = vi.fn();
  const sendMessage = vi.fn();
  const logMessage = vi.fn();
  const getUniqueId = vi.fn().mockReturnValue(42);
  const showSnackbarMessage = vi.fn();
  const showConfirmCancelDialog = vi.fn();
  const context = { online, addListener, removeListener, sendMessage, logMessage, getUniqueId } as unknown as WebSocketContextType;
  const view = (nextContext = context) => (
    <MemoryRouter>
      <WebSocketContext.Provider value={nextContext}>
        <UiContext.Provider value={{ ...uiContext, mobile, showSnackbarMessage, showConfirmCancelDialog }}>
          <Header />
          <LocationDisplay />
        </UiContext.Provider>
      </WebSocketContext.Provider>
    </MemoryRouter>
  );
  const result = render(view());
  const listener = addListener.mock.calls[0][0] as (message: unknown) => void;
  const update = (message: unknown) => act(() => listener(message));
  return {
    ...result,
    addListener,
    removeListener,
    sendMessage,
    logMessage,
    getUniqueId,
    showSnackbarMessage,
    showConfirmCancelDialog,
    listener,
    update,
    context,
    rerenderContext: (nextContext: WebSocketContextType) => result.rerender(view(nextContext)),
    load: (information: Partial<ApiSettings['matterbridgeInformation']> = {}, system: Partial<ApiSettings['systemInformation']> = {}) =>
      update({
        id: 42,
        method: '/api/settings',
        response: {
          matterbridgeInformation: { ...settings.matterbridgeInformation, bridgeStatus: 'started', ...information },
          systemInformation: { ...settings.systemInformation, ...system },
        },
      }),
  };
}

function openMenu(submenu?: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Download, backup and more' }));
  if (submenu) fireEvent.click(within(screen.getByLabelText('command-menu')).getByRole('button', { name: submenu }));
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appSettings.debug = false;
    appSettings.enableMobile = true;
    locationMock.href = 'http://localhost/';
    Object.defineProperty(window, 'location', { configurable: true, value: locationMock });
    vi.spyOn(window, 'open').mockReturnValue(null);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
    if (originalLocation) Object.defineProperty(window, 'location', originalLocation);
  });

  test('should wait for connection and matching settings and keep the request id stable', () => {
    const { context, rerenderContext, update, sendMessage, getUniqueId, addListener, removeListener, listener, unmount } = renderHeader({ online: false });
    expect(screen.queryByText('Matterbridge')).not.toBeInTheDocument();
    expect(sendMessage).not.toHaveBeenCalled();
    getUniqueId.mockReturnValue(99);
    rerenderContext({ ...context, online: true });
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ id: 42, sender: 'Header', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });
    update({ id: 99, method: '/api/settings', response: settings });
    expect(screen.queryByText('Matterbridge')).not.toBeInTheDocument();
    update({ id: 42, method: '/api/settings', response: settings });
    expect(screen.getByText('Matterbridge')).toBeInTheDocument();
    expect(addListener).toHaveBeenCalledExactlyOnceWith(listener, 42);
    rerenderContext(context);
    expect(screen.queryByText('Matterbridge')).not.toBeInTheDocument();
    unmount();
    expect(removeListener).toHaveBeenCalledExactlyOnceWith(listener);
  });

  test.each([false, true])('should process settings and live notifications with debug=%s', (debug) => {
    appSettings.debug = debug;
    const { load, update, sendMessage, unmount, removeListener, listener } = renderHeader();
    for (const message of [
      { method: 'update_required', response: { devVersion: false, version: '4.0.0' } },
      { method: 'update_required', response: { devVersion: true, version: '4.0.0-dev-1' } },
      { method: 'shelly_sys_update', response: { available: true } },
      { method: 'shelly_main_update', response: { available: true } },
    ])
      update(message);
    expect(screen.queryByText('Matterbridge')).not.toBeInTheDocument();
    load({ bridgeMode: 'bridge', restartRequired: false, fixedRestartRequired: false, shellyBoard: true });
    sendMessage.mockClear();
    update({ method: 'refresh_required', response: { changed: 'settings' } });
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ id: 42, sender: 'Header', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });
    update({ method: 'refresh_required', response: { changed: 'plugins' } });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    update({ method: 'update_required', response: { devVersion: false, version: '4.0.1' } });
    expect(screen.getByRole('button', { name: 'Update matterbridge to latest version v.4.0.1' })).toBeInTheDocument();
    update({ method: 'update_required', response: { devVersion: true, version: '4.0.1-dev-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update matterbridge to latest version v.4.0.1' }));
    expect(screen.queryByRole('button', { name: 'Update matterbridge to latest version v.4.0.1' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Update matterbridge to latest dev version v.4.0.1-dev-1' }));
    expect(screen.queryByRole('button', { name: 'Update matterbridge to latest dev version v.4.0.1-dev-1' })).not.toBeInTheDocument();
    update({ method: 'restart_required', response: { fixed: false } });
    expect(screen.getByRole('button', { name: 'Restart matterbridge' }).style.color).toBe('var(--primary-color)');
    update({ method: 'restart_not_required', response: {} });
    expect(screen.getByRole('button', { name: 'Restart matterbridge' }).style.color).toBe('var(--main-icon-color)');
    update({ method: 'restart_required', response: { fixed: true } });
    update({ method: 'restart_not_required', response: {} });
    expect(screen.getByRole('button', { name: 'Restart matterbridge' }).style.color).toBe('var(--primary-color)');
    for (const [status, color] of [
      ['error', 'red'],
      ['inactive', ''],
      ['started', 'green'],
    ]) {
      update({ method: 'matterbridge_status_update', response: { status } });
      expect(screen.getByLabelText('Bridge mode').style.backgroundColor).toBe(color);
    }
    update({ method: 'shelly_sys_update', response: { available: true } });
    update({ method: 'shelly_main_update', response: { available: true } });
    fireEvent.click(screen.getByRole('button', { name: 'Shelly system update' }));
    fireEvent.click(screen.getByRole('button', { name: 'Shelly software update' }));
    expect(sendMessage.mock.calls.slice(-2).map(([message]) => message.method)).toEqual(['/api/shellysysupdate', '/api/shellymainupdate']);
    update({ method: 'shelly_sys_update', response: { available: false } });
    update({ method: 'shelly_main_update', response: { available: false } });
    expect(screen.queryByRole('button', { name: 'Shelly system update' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Shelly software update' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Matterbridge Logo' }));
    expect(toggleDebug).toHaveBeenCalledOnce();
    unmount();
    expect(removeListener).toHaveBeenCalledExactlyOnceWith(listener);
    expect(vi.mocked(console.log).mock.calls.length > 0).toBe(debug);
  });

  test.each([
    ['3.9.2', 'v.3.9.2'],
    ['3.9.2-dev-1', 'v.3.9.2@dev'],
    ['3.9.2-edge-1', 'v.3.9.2@edge'],
    ['3.9.2-local-1', 'v.3.9.2@local'],
    ['3.9.2-git-abc', 'v.3.9.2@git'],
  ])('should display version %s as %s', (version, display) => {
    const { load } = renderHeader();
    load({ matterbridgeVersion: version });
    expect(screen.getByLabelText(`Matterbridge v.${version}`)).toHaveTextContent(display);
  });

  test('should expose informational badges and hide restricted controls in read-only mode', () => {
    const { load } = renderHeader();
    load({ bridgeMode: 'childbridge', restartMode: 'service', profile: 'test-profile', shellyBoard: true }, { bunVersion: '1.3.0' });
    expect(screen.getByLabelText('Bridge mode')).toHaveTextContent('childbridge');
    expect(screen.getByLabelText('Restart mode')).toHaveTextContent('service');
    expect(screen.getByLabelText('Current profile')).toHaveTextContent('test-profile');
    expect(screen.getByLabelText('Bun version')).toHaveTextContent('bun');
    expect(screen.getByRole('img', { name: 'Shelly Icon' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Shut down matterbridge' })).not.toBeInTheDocument();
    load({ readOnly: true, bridgeMode: 'childbridge', restartMode: 'service', profile: 'test-profile', updateRequired: true });
    for (const label of ['Bridge mode', 'Restart mode', 'Current profile', 'Bun version', 'Matterbridge v.3.9.2']) expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    for (const name of ['Matterbridge discord group', 'Give a star to Matterbridge', 'Sponsor Matterbridge'])
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    openMenu();
    for (const name of ['Install latest stable', 'Install latest dev', 'Check for updates', 'Shutdown', 'Reboot...'])
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.queryByRole('button', { name: 'Factory reset...' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset commissioning...' })).toBeInTheDocument();
  });

  test.each([
    { mobile: false, enableMobile: true, stored: 'true', responsive: false },
    { mobile: true, enableMobile: false, stored: 'false', responsive: false },
    { mobile: true, enableMobile: true, stored: 'true', responsive: true },
  ])('should gate mobile navigation when mobile=$mobile and enableMobile=$enableMobile', ({ mobile, enableMobile, stored, responsive }) => {
    appSettings.debug = true;
    appSettings.enableMobile = enableMobile;
    localStorage.setItem(MbfLsk.enableMobile, stored);
    const { load } = renderHeader({ mobile });
    load();
    expect(screen.getByText(`${mobile ? 'Mobile' : 'Desktop'} 1200x800 enabled ${stored !== 'false'}`)).toBeInTheDocument();
    openMenu();
    for (const name of ['Home page', 'Devices page', 'Logs page', 'Settings page']) expect(screen.queryAllByRole('button', { name })).toHaveLength(responsive ? 1 : 0);
  });

  test.each([
    ['Home page', '/'],
    ['Devices page', '/devices'],
    ['Logs page', '/log'],
    ['Settings page', '/settings'],
  ])('should navigate from %s to %s', (name, path) => {
    const { load } = renderHeader({ mobile: true });
    load();
    openMenu();
    fireEvent.click(screen.getByRole('button', { name }));
    expect(screen.getByTestId('location')).toHaveTextContent(path);
    expect(screen.queryByLabelText('command-menu')).not.toBeInTheDocument();
  });

  test('should open the public links with their intended destinations', () => {
    const { load } = renderHeader();
    load();
    for (const name of [
      'Matterbridge discord group',
      'Give a star to Matterbridge',
      'Sponsor Matterbridge',
      'Matterbridge homepage',
      'Matterbridge help',
      'Matterbridge changelog',
    ])
      fireEvent.click(screen.getByRole('button', { name }));
    expect(vi.mocked(window.open).mock.calls).toEqual([
      ['https://discord.com/invite/QX58CDe6hd', '_blank'],
      ['https://github.com/Luligu/matterbridge', '_blank'],
      ['https://www.buymeacoffee.com/luligugithub', '_blank'],
      ['https://matterbridge.io/'],
      ['https://matterbridge.io/README.html'],
      ['https://matterbridge.io/CHANGELOG.html'],
    ]);
  });

  test.each([false, true])('should dispatch menu commands and notifications with debug=%s', (debug) => {
    appSettings.debug = debug;
    const { load, sendMessage, logMessage, showSnackbarMessage } = renderHeader();
    load({ shellyBoard: true, shellySysUpdate: true, shellyMainUpdate: true });
    const commands: [string | undefined, string, string, Record<string, unknown>][] = [
      [undefined, 'Install latest stable', '/api/install', { packageName: 'matterbridge', restart: true }],
      [undefined, 'Install latest dev', '/api/install', { packageName: 'matterbridge@dev', restart: true }],
      [undefined, 'Check for updates', '/api/checkupdates', {}],
      [undefined, 'Shelly system update', '/api/shellysysupdate', {}],
      [undefined, 'Shelly software update', '/api/shellymainupdate', {}],
      [undefined, 'Restart', '/api/restart', {}],
      [undefined, 'Shutdown', '/api/shutdown', {}],
      [undefined, 'Backup', '/api/create-backup', {}],
      ['View', 'Matterbridge system history', '/api/viewhistorypage', {}],
      ['Download', 'Matterbridge system history', '/api/downloadhistorypage', {}],
      ['Download', 'Matterbridge storage', '/api/create-matterbridge-storage-backup', {}],
      ['Download', 'Matter storage', '/api/create-matter-storage-backup', {}],
      ['Download', 'Matterbridge plugins storage', '/api/create-plugin-backup', {}],
      ['Download', 'Matterbridge plugins config', '/api/create-config-backup', {}],
      ['Download', 'Create Shelly system log', '/api/shellycreatesystemlog', {}],
    ];
    for (const [submenu, label, method, params] of commands) {
      sendMessage.mockClear();
      openMenu(submenu);
      const scope = within(screen.getByLabelText(submenu ? `sub-menu-${submenu.toLowerCase()}` : 'command-menu'));
      fireEvent.click(scope.getByRole('button', { name: label }));
      expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ id: 42, sender: 'Header', method, src: 'Frontend', dst: 'Matterbridge', params });
      expect(screen.queryByLabelText('command-menu')).not.toBeInTheDocument();
    }
    for (const [label, target, text] of [
      ['Matterbridge log', './api/view-mblog', 'Loading matterbridge log...'],
      ['Matter log', './api/view-mjlog', 'Loading matter log...'],
      ['Matterbridge diagnostic log', './api/view-diagnostic', 'Loading diagnostic log...'],
    ]) {
      openMenu('View');
      fireEvent.click(within(screen.getByLabelText('sub-menu-view')).getByRole('button', { name: label }));
      expect(window.open).toHaveBeenLastCalledWith(target, '_blank', 'noopener,noreferrer');
      expect(logMessage).toHaveBeenLastCalledWith('Matterbridge', text);
      expect(showSnackbarMessage).toHaveBeenLastCalledWith(text, 5);
    }
    for (const [submenu, label, target, text] of [
      ['Download', 'Matterbridge log', './api/download-mblog', 'Downloading matterbridge log...'],
      ['Download', 'Matter log', './api/download-mjlog', 'Downloading matter log...'],
      ['Download', 'Matterbridge diagnostic log', './api/download-diagnostic', 'Downloading diagnostic log...'],
      ['Download', 'Download Shelly system log', './api/shellydownloadsystemlog', 'Downloading Shelly system log...'],
      ['View', 'Shelly system log', './api/shellyviewsystemlog', 'Loading shelly system log...'],
    ]) {
      openMenu(submenu);
      fireEvent.click(within(screen.getByLabelText(`sub-menu-${submenu.toLowerCase()}`)).getByRole('button', { name: label }));
      expect(locationMock.href).toBe(target);
      expect(logMessage).toHaveBeenLastCalledWith('Matterbridge', text);
      expect(showSnackbarMessage).toHaveBeenLastCalledWith(text, 5);
    }
  });

  test.each([false, true])('should confirm, cancel, and route reset actions with debug=%s', (debug) => {
    appSettings.debug = debug;
    const { load, sendMessage, showConfirmCancelDialog, showSnackbarMessage, logMessage } = renderHeader();
    load({ shellyBoard: true });
    const resetActions: [string | undefined, string, number, string][] = [
      [undefined, 'Reboot...', 0, 'reboot'],
      ['Reset', 'Reset all devices...', 0, 'unregister'],
      ['Reset', 'Reset commissioning...', 0, 'reset'],
      ['Reset', 'Factory reset...', 0, 'factoryreset'],
      ['Reset', 'Reset network...', 0, 'softreset'],
      ['Reset', 'Factory reset...', 1, 'hardreset'],
    ];
    for (const [submenu, label, index, command] of resetActions) {
      sendMessage.mockClear();
      openMenu(submenu);
      fireEvent.click(screen.getAllByRole('button', { name: label })[index]);
      const args = showConfirmCancelDialog.mock.calls.at(-1)!;
      expect(args[2]).toBe(command);
      expect(sendMessage).not.toHaveBeenCalled();
      const confirm = args[3] as (value: string) => void;
      act(() => confirm(command));
      expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ id: 42, sender: 'Header', method: `/api/${command}`, src: 'Frontend', dst: 'Matterbridge', params: {} });
    }
    openMenu('Reset');
    fireEvent.click(screen.getByRole('button', { name: 'Reset the frontend UI...' }));
    const args = showConfirmCancelDialog.mock.calls.at(-1)!;
    const confirm = args[3] as (command: string) => void;
    const cancel = args[4] as (command: string) => void;
    act(() => cancel('reset_frontend'));
    expect(resetLocalStorage).not.toHaveBeenCalled();
    expect(locationMock.reload).not.toHaveBeenCalled();
    act(() => confirm('reset_frontend'));
    expect(resetLocalStorage).toHaveBeenCalledOnce();
    expect(locationMock.reload).toHaveBeenCalledOnce();
    expect(showSnackbarMessage).toHaveBeenLastCalledWith('Resetting frontend UI...', 5);
    expect(logMessage).toHaveBeenLastCalledWith('Matterbridge', 'Resetting frontend UI...');
    for (const [command, target, message, seconds] of [
      ['download-mbstorage', './api/download-mbstorage', 'Downloading matterbridge storage...', 5],
      ['download-pluginstorage', './api/download-pluginstorage', 'Downloading matterbridge plugins storage...', 5],
      ['download-pluginconfig', './api/download-pluginconfig', 'Downloading matterbridge plugins config...', 5],
      ['download-mjstorage', './api/download-mjstorage', 'Downloading matter storage...', 5],
      ['download-backup', './api/download-backup', 'Downloading backup...', 10],
    ] as const) {
      act(() => confirm(command));
      expect(locationMock.href).toBe(target);
      expect(logMessage).toHaveBeenLastCalledWith('Matterbridge', message);
      expect(showSnackbarMessage).toHaveBeenLastCalledWith(message, seconds);
    }
  });

  test.each([false, true])('should process successful history and archive replies with debug=%s', (debug) => {
    appSettings.debug = debug;
    const { update } = renderHeader();
    update({ id: 42, method: '/api/viewhistorypage', success: true });
    expect(window.open).toHaveBeenCalledExactlyOnceWith('./api/viewhistory', '_blank', 'noopener,noreferrer');
    update({ id: 42, method: '/api/downloadhistorypage', success: true });
    expect(locationMock.href).toBe('./api/downloadhistory');
    for (const [name, target] of [
      ['matterbridge.backup.zip', './api/download-backup'],
      ['matterbridge.storage.zip', './api/download-mbstorage'],
      ['matterbridge.matterstorage.zip', './api/download-mjstorage'],
      ['matterbridge.pluginstorage.zip', './api/download-pluginstorage'],
      ['matterbridge.pluginconfig.zip', './api/download-pluginconfig'],
    ]) {
      update({ method: 'archive', success: true, response: { command: 'zip', archivePath: `/tmp/${name}` } });
      expect(locationMock.href).toBe(target);
    }
    locationMock.href = 'unchanged';
    for (const message of [
      { id: 99, method: '/api/viewhistorypage', success: true },
      { id: 42, method: '/api/viewhistorypage', success: false },
      { id: 99, method: '/api/downloadhistorypage', success: true },
      { id: 42, method: '/api/downloadhistorypage', success: false },
      { method: 'archive', success: false, response: { command: 'zip' } },
      { method: 'archive', success: true, response: { command: 'unzip' } },
      { method: 'archive', success: true, response: { command: 'zip', archivePath: 'unrelated.zip' } },
      { method: 'unrelated', response: {} },
    ])
      update(message);
    expect(locationMock.href).toBe('unchanged');
    expect(window.open).toHaveBeenCalledTimes(1);
  });

  test.each([false, true])('should change view modes and dismiss all menus with debug=%s', (debug) => {
    appSettings.debug = debug;
    const { load, sendMessage } = renderHeader();
    load();
    sendMessage.mockClear();
    openMenu('View');
    fireEvent.click(screen.getByRole('button', { name: 'Desktop site' }));
    expect(clearEnableMobile).toHaveBeenCalledOnce();
    expect(window.open).toHaveBeenLastCalledWith('/home', '_self');
    openMenu('View');
    fireEvent.click(screen.getByRole('button', { name: 'Mobile site' }));
    expect(setEnableMobile).toHaveBeenCalledOnce();
    expect(window.open).toHaveBeenLastCalledWith('/home', '_self');
    for (const submenu of ['View', 'Download', 'Reset']) {
      openMenu(submenu);
      const id = `sub-menu-${submenu.toLowerCase()}`;
      fireEvent.click(screen.getByRole('button', { name: `Dismiss ${id}` }));
      expect(screen.queryByLabelText(id)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss command-menu' }));
      expect(screen.queryByLabelText('command-menu')).not.toBeInTheDocument();
    }
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test('should use shutdown for supervised restarts and retain a fixed restart indicator from settings', () => {
    const { load, sendMessage, update } = renderHeader();
    load({ restartMode: 'service', fixedRestartRequired: true });
    update({ method: 'restart_not_required', response: {} });
    expect(screen.getByRole('button', { name: 'Restart matterbridge' }).style.color).toBe('var(--primary-color)');
    fireEvent.click(screen.getByRole('button', { name: 'Restart matterbridge' }));
    expect(sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({ method: '/api/shutdown' }));
    load({ restartRequired: true, fixedRestartRequired: false });
    fireEvent.click(screen.getByRole('button', { name: 'Shut down matterbridge' }));
    expect(sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({ method: '/api/shutdown' }));
  });

  test('should rebind the listener when WebSocket callbacks change', () => {
    const { context, rerenderContext, removeListener, listener, unmount } = renderHeader();
    const nextAddListener = vi.fn();
    const nextRemoveListener = vi.fn();
    rerenderContext({ ...context, addListener: nextAddListener, removeListener: nextRemoveListener });
    expect(removeListener).toHaveBeenCalledExactlyOnceWith(listener);
    expect(nextAddListener).toHaveBeenCalledExactlyOnceWith(expect.any(Function), 42);
    unmount();
    expect(nextRemoveListener).toHaveBeenCalledExactlyOnceWith(nextAddListener.mock.calls[0][0]);
  });

  it('requests settings, responds to status updates, and renders navigation', () => {
    const sendMessage = vi.fn();
    const removeListener = vi.fn();
    let listener: ((message: unknown) => void) | undefined;
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- This callback mirrors the WebSocket listener API.
    const addListener = vi.fn((callback: (message: unknown) => void) => {
      listener = callback;
    });
    const webSocketContext = {
      online: true,
      sendMessage,
      logMessage: vi.fn(),
      addListener,
      removeListener,
      getUniqueId: () => 42,
    } as unknown as WebSocketContextType;

    const { container, unmount } = render(
      <MemoryRouter>
        <WebSocketContext.Provider value={webSocketContext}>
          <UiContext.Provider value={uiContext}>
            <Header />
          </UiContext.Provider>
        </WebSocketContext.Provider>
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(sendMessage).toHaveBeenCalledWith({ id: 42, sender: 'Header', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });
    expect(sendMessage).toHaveBeenCalledTimes(1);

    act(() => {
      listener?.({ method: '/api/settings', id: 42, response: settings });
    });

    expect(screen.getByText('Matterbridge')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Devices' })).toHaveAttribute('href', '/devices');
    expect(screen.getByText('v.3.9.2')).toBeInTheDocument();

    act(() => {
      listener?.({ method: 'refresh_required', response: { changed: 'settings' } });
      listener?.({ method: 'update_required', response: { devVersion: false, version: '3.9.3' } });
      listener?.({ method: 'restart_required', response: { fixed: false } });
    });

    expect(sendMessage).toHaveBeenCalledWith({ id: 42, sender: 'Header', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });
    const updateButton = screen.getAllByTestId('SystemUpdateAltIcon')[0].closest('button');
    expect(updateButton).toBeInTheDocument();
    fireEvent.click(updateButton!);
    expect(sendMessage).toHaveBeenCalledWith({
      id: 42,
      sender: 'Header',
      method: '/api/install',
      src: 'Frontend',
      dst: 'Matterbridge',
      params: { packageName: 'matterbridge', restart: true },
    });

    const restartButton = screen.getAllByTestId('RestartAltIcon')[0].closest('button');
    expect(restartButton).toBeInTheDocument();
    fireEvent.click(restartButton!);
    expect(sendMessage).toHaveBeenCalledWith({ id: 42, sender: 'Header', method: '/api/restart', src: 'Frontend', dst: 'Matterbridge', params: {} });

    fireEvent.click(screen.getByRole('button', { name: 'Matterbridge Logo' }));
    expect(toggleDebug).toHaveBeenCalledOnce();

    act(() => {
      listener?.({ method: 'restart_not_required', response: {} });
    });

    unmount();
    expect(removeListener).toHaveBeenCalled();
  });
});
