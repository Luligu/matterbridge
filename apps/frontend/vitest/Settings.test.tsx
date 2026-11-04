import '@testing-library/jest-dom';

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiSettings } from '../src/utils/backendShared';
import { MbfLsk, resetLocalStorage } from '../src/utils/localStorage';

const appState = vi.hoisted(() => ({ debug: false, enableMobile: true, setWssPassword: vi.fn() }));
vi.mock('../src/appState', () => appState);
vi.mock('../src/components/Connecting', () => ({ Connecting: () => <div>Connecting</div> }));
vi.mock('../src/components/MbfPage', () => ({ MbfPage: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('../src/components/MbfWindow', () => ({
  MbfWindow: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  MbfWindowContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MbfWindowHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  MbfWindowHeaderText: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('../src/components/ChangePasswordDialog', () => ({
  ChangePasswordDialog: ({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (password: string) => void }) =>
    open ? (
      <div>
        <button type="button" onClick={() => onSave('new-secret')}>
          save-password
        </button>
        <button type="button" onClick={onClose}>
          close-password
        </button>
      </div>
    ) : null,
}));
import { setWssPassword } from '../src/appState';
import Settings from '../src/components/Settings';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';

const settings = {
  matterbridgeInformation: {
    matterbridgeVersion: '3.9.2',
    matterbridgeLatestVersion: '3.9.3',
    matterbridgeDevVersion: '',
    rootDirectory: '/root',
    homeDirectory: '/home',
    matterbridgeDirectory: '/storage',
    matterbridgePluginDirectory: '/plugins',
    globalModulesDirectory: '/modules',
    bridgeMode: 'bridge',
    loggerLevel: 'info' as unknown as ApiSettings['matterbridgeInformation']['loggerLevel'],
    fileLogger: false,
    matterLoggerLevel: 'info' as unknown as ApiSettings['matterbridgeInformation']['matterLoggerLevel'],
    matterFileLogger: false,
    matterMdnsInterface: 'eth0-mdns',
    matterIpv4Address: '10.0.0.1',
    matterIpv6Address: 'fe80::1',
    matterPort: 5540,
    matterDiscriminator: 3840,
    matterPasscode: 20202021,
    virtualMode: 'disabled',
    readOnly: false,
  },
  systemInformation: {
    interfaceName: 'eth0',
    macAddress: '00:11:22:33:44:55',
    ipv4Address: '192.168.1.2',
    ipv6Address: '::1',
    nodeVersion: 'v24',
    hostname: 'matterbridge',
    user: 'user',
  },
} as ApiSettings;

const uiContext = { mobile: false } as UiContextType;

const withInfo = (overrides: Record<string, unknown>) => ({ ...settings, matterbridgeInformation: { ...settings.matterbridgeInformation, ...overrides } });

const pickOption = (selectId: string, optionName: string) => {
  const combobox = document.querySelector<HTMLElement>(selectId)!;
  combobox.getBoundingClientRect = () => ({ width: 100, height: 20, top: 0, left: 0, bottom: 20, right: 100, x: 0, y: 0, toJSON: () => ({}) });
  act(() => {
    fireEvent.mouseDown(combobox);
  });
  const option = screen.getByRole('option', { name: optionName });
  act(() => {
    fireEvent.click(option);
  });
};

const config = (name: string, value: unknown) => ({ id: 23, sender: 'Settings', method: '/api/config', src: 'Frontend', dst: 'Matterbridge', params: { name, value } });

const matterFields = [
  ['eth0-mdns', 'eth1', 'setmdnsinterface'],
  ['10.0.0.1', '10.0.0.9', 'setipv4address'],
  ['fe80::1', 'fe80::9', 'setipv6address'],
  ['5540', '5541', 'setmatterport'],
  ['3840', '3841', 'setmatterdiscriminator'],
  ['20202021', '20202022', 'setmatterpasscode'],
] as const;

function renderSettings(ui: UiContextType = uiContext, online = true) {
  const sendMessage = vi.fn();
  let listener: ((message: unknown) => void) | undefined;
  const addListener = vi.fn((callback: (message: unknown) => void) => {
    listener = callback;
  });
  const webSocketContext = { online, sendMessage, addListener, removeListener: vi.fn(), getUniqueId: () => 23 } as unknown as WebSocketContextType;
  render(
    <WebSocketContext.Provider value={webSocketContext}>
      <UiContext.Provider value={ui}>
        <Settings />
      </UiContext.Provider>
    </WebSocketContext.Provider>,
  );
  const emit = (message: unknown) =>
    act(() => {
      listener?.(message);
    });
  return { sendMessage, emit };
}

describe('Settings', () => {
  beforeEach(() => {
    // Several tests persist preferences, so each one must start from a clean slate.
    resetLocalStorage();
    document.body.removeAttribute('frontend-theme');
    vi.clearAllMocks();
    appState.debug = false;
    appState.enableMobile = true;
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should remain connecting without requesting settings when offline', () => {
    const { sendMessage, emit } = renderSettings(uiContext, false);

    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(sendMessage).not.toHaveBeenCalled();

    emit({ method: '/api/settings', id: 23, response: settings });

    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Matterbridge settings' })).not.toBeInTheDocument();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it.each([false, true])('should remain connecting when a version update arrives before settings with devVersion=%s', (devVersion) => {
    const { sendMessage, emit } = renderSettings();
    sendMessage.mockClear();

    emit({ method: 'update_required', id: 0, response: { version: '4.0.0', devVersion } });

    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(sendMessage).not.toHaveBeenCalled();

    emit({ method: '/api/settings', id: 23, response: settings });
    expect(screen.getByLabelText('Latest Version')).toHaveValue(settings.matterbridgeInformation.matterbridgeLatestVersion);
  });

  it.each(['matterbridgeInformation', 'systemInformation'])('should remain connecting when the settings response has no %s', (field) => {
    const { emit } = renderSettings();

    emit({ method: '/api/settings', id: 23, response: { ...settings, [field]: null } });

    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('should ignore unrelated refreshes and API responses without discarding edited settings', () => {
    const { sendMessage, emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });
    fireEvent.click(screen.getByLabelText('Childbridge'));
    sendMessage.mockClear();

    emit({ method: 'refresh_required', id: 0, response: { changed: 'plugins' } });
    emit({ method: '/api/plugins', id: 23, response: [] });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Childbridge')).toBeChecked();
  });

  it.each([null, 'light'])('should use default field values and the stored virtual mode %s when backend values are missing', (storedVirtualMode) => {
    if (storedVirtualMode) localStorage.setItem(MbfLsk['virtual-mode'], storedVirtualMode);
    const { emit } = renderSettings();
    emit({
      method: '/api/settings',
      id: 23,
      response: withInfo({
        loggerLevel: undefined,
        matterLoggerLevel: undefined,
        fileLogger: undefined,
        matterFileLogger: undefined,
        virtualMode: undefined,
        matterMdnsInterface: undefined,
        matterIpv4Address: undefined,
        matterIpv6Address: undefined,
        matterPort: undefined,
        matterDiscriminator: undefined,
        matterPasscode: undefined,
      }),
    });

    expect(document.querySelector('#mblogger-level')).toHaveTextContent('Info');
    expect(document.querySelector('#mjlogger-level')).toHaveTextContent('Info');
    expect(document.querySelector('#mblogger-file')).not.toBeChecked();
    expect(document.querySelector('#mjlogger-file')).not.toBeChecked();
    expect(document.querySelector('#frontend-virtual')).toHaveTextContent(storedVirtualMode ? 'Light' : 'Outlet');
    expect(document.querySelector('#frontend-theme')).toHaveTextContent('Dark');
    expect(document.querySelector('#frontend-home')).toHaveTextContent('Devices');
    const matterSection = screen.getByRole('heading', { name: 'Matter settings' }).closest('section');
    expect(matterSection).not.toBeNull();
    expect(
      within(matterSection!)
        .getAllByRole<HTMLInputElement>('textbox')
        .map((input) => input.value),
    ).toEqual(['', '', '', '', '', '']);
  });

  it('should initialize stored frontend preferences while preferring the backend virtual mode', () => {
    localStorage.setItem(MbfLsk['frontend-theme'], 'classic');
    localStorage.setItem(MbfLsk['home-page-mode'], 'logs');
    localStorage.setItem(MbfLsk['home-page-plugins'], 'false');
    localStorage.setItem(MbfLsk['virtual-mode'], 'light');
    const { sendMessage, emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });
    sendMessage.mockClear();

    expect(document.querySelector('#frontend-theme')).toHaveTextContent('Classic');
    expect(document.querySelector('#frontend-home')).toHaveTextContent('Logs');
    expect(document.querySelector('input[name="showPlugins"]')).not.toBeChecked();
    expect(document.querySelector('#frontend-virtual')).toHaveTextContent('Disabled');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('should disable bridge mode changes and make Matter fields read-only when the backend is read-only', () => {
    const { emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: withInfo({ readOnly: true }) });

    expect(screen.getByLabelText('Bridge')).toBeDisabled();
    expect(screen.getByLabelText('Childbridge')).toBeDisabled();
    const matterSection = screen.getByRole('heading', { name: 'Matter settings' }).closest('section');
    expect(matterSection).not.toBeNull();
    expect(
      within(matterSection!)
        .getAllByRole('textbox')
        .map((input) => input.hasAttribute('readonly')),
    ).toEqual([true, true, true, true, true, true]);
  });

  it('requests settings and saves a bridge-mode selection', () => {
    const sendMessage = vi.fn();
    const removeListener = vi.fn();
    let listener: ((message: unknown) => void) | undefined;
    const addListener = vi.fn((callback: (message: unknown) => void) => {
      listener = callback;
    });
    const webSocketContext = { online: true, sendMessage, addListener, removeListener, getUniqueId: () => 23 } as unknown as WebSocketContextType;
    const { unmount } = render(
      <WebSocketContext.Provider value={webSocketContext}>
        <UiContext.Provider value={uiContext}>
          <Settings />
        </UiContext.Provider>
      </WebSocketContext.Provider>,
    );

    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledWith({ id: 23, sender: 'Settings', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });

    act(() => {
      listener?.({ method: '/api/settings', id: 23, response: settings });
    });

    expect(screen.getByRole('heading', { name: 'Matterbridge settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Matter settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Matterbridge info' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'System info' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Childbridge'));
    expect(sendMessage).toHaveBeenCalledWith({
      id: 23,
      sender: 'Settings',
      method: '/api/config',
      src: 'Frontend',
      dst: 'Matterbridge',
      params: { name: 'setbridgemode', value: 'childbridge' },
    });

    unmount();
    expect(removeListener).toHaveBeenCalled();
  });

  it('initializes both settings forms from the values the server sent', () => {
    const { emit } = renderSettings();

    // Values that differ from the hardcoded fallbacks, so a missing initialization is visible.
    emit({
      method: '/api/settings',
      id: 23,
      response: withInfo({ bridgeMode: 'childbridge', loggerLevel: 'debug', matterLoggerLevel: 'notice', matterPort: 5540, matterDiscriminator: 3840 }),
    });

    expect(screen.getByLabelText('Childbridge')).toBeChecked();
    expect(screen.getByLabelText('Bridge')).not.toBeChecked();
    expect(screen.getByDisplayValue('5540')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3840')).toBeInTheDocument();
    expect(document.querySelector('#mblogger-level')).toHaveTextContent('Debug');
    expect(document.querySelector('#mjlogger-level')).toHaveTextContent('Notice');
  });

  it('re-initializes the forms when a fresh settings response arrives', () => {
    const { emit } = renderSettings();

    emit({ method: '/api/settings', id: 23, response: withInfo({ matterPort: 5540 }) });
    expect(screen.getByDisplayValue('5540')).toBeInTheDocument();

    emit({ method: '/api/settings', id: 23, response: withInfo({ matterPort: 5541 }) });
    expect(screen.getByDisplayValue('5541')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('5540')).not.toBeInTheDocument();
  });

  it('keeps in-progress edits when update_required refreshes the version fields', () => {
    const { emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: withInfo({ matterPort: 5540 }) });

    // The user starts editing the commissioning port.
    fireEvent.change(screen.getByDisplayValue('5540'), { target: { value: '5599' } });
    expect(screen.getByDisplayValue('5599')).toBeInTheDocument();

    // A background version check arrives; it must refresh the version only.
    emit({ method: 'update_required', id: 23, response: { version: '3.9.9' } });

    expect(screen.getByDisplayValue('3.9.9')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5599')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('5540')).not.toBeInTheDocument();
  });

  it('re-requests the settings on refresh_required', () => {
    const { sendMessage, emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });
    sendMessage.mockClear();

    emit({ method: 'refresh_required', id: 23, response: { changed: 'settings' } });

    expect(sendMessage).toHaveBeenCalledWith({ id: 23, sender: 'Settings', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });
  });

  it('records the dev version without disturbing the latest version', () => {
    const { emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });

    emit({ method: 'update_required', id: 23, response: { version: '4.0.0-dev.1', devVersion: true } });

    expect(screen.getByDisplayValue('3.9.3')).toBeInTheDocument();
  });

  it('sends the Matterbridge logger level and the file logger', () => {
    const { sendMessage, emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });

    pickOption('#mblogger-level', 'Warn');
    expect(sendMessage).toHaveBeenCalledWith(config('setmbloglevel', 'Warn'));
    expect(document.querySelector('#mblogger-level')).toHaveTextContent('Warn');

    fireEvent.click(document.querySelector('#mblogger-file')!);
    expect(sendMessage).toHaveBeenCalledWith(config('setmblogfile', true));
    expect(document.querySelector('#mblogger-file')).toBeChecked();
  });

  it('sends the Matter logger level and the file logger', () => {
    const { sendMessage, emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });

    pickOption('#mjlogger-level', 'Error');
    expect(sendMessage).toHaveBeenCalledWith(config('setmjloglevel', 'Error'));

    fireEvent.click(document.querySelector('#mjlogger-file')!);
    expect(sendMessage).toHaveBeenCalledWith(config('setmjlogfile', true));
  });

  it('applies the frontend theme to localStorage and to the document', () => {
    const { sendMessage, emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });
    sendMessage.mockClear();

    pickOption('#frontend-theme', 'Light');

    expect(localStorage.getItem(MbfLsk['frontend-theme'])).toBe('light');
    expect(document.body.getAttribute('frontend-theme')).toBe('light');
    // The theme is a frontend-only preference and must not reach the backend.
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('should store auto and apply dark or light to the document when Auto is selected', () => {
    const { emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });

    pickOption('#frontend-theme', 'Auto');

    expect(localStorage.getItem(MbfLsk['frontend-theme'])).toBe('auto');
    expect(['dark', 'light']).toContain(document.body.getAttribute('frontend-theme'));
    // Leave no color scheme listener behind for the next tests.
    pickOption('#frontend-theme', 'Dark');
  });

  it('stores the home page preferences locally without notifying the backend', () => {
    const { sendMessage, emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });
    sendMessage.mockClear();

    fireEvent.click(document.querySelector('input[name="showPlugins"]')!);
    expect(localStorage.getItem(MbfLsk['home-page-plugins'])).toBe('false');

    pickOption('#frontend-home', 'Logs');
    expect(localStorage.getItem(MbfLsk['home-page-mode'])).toBe('logs');

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('stores the virtual mode locally and notifies the backend', () => {
    const { sendMessage, emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });

    pickOption('#frontend-virtual', 'Switch');

    expect(localStorage.getItem(MbfLsk['virtual-mode'])).toBe('switch');
    expect(sendMessage).toHaveBeenCalledWith(config('setvirtualmode', 'switch'));
  });

  it('saves a new password and applies it to the websocket', () => {
    const { sendMessage, emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });

    expect(screen.queryByText('save-password')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

    fireEvent.click(screen.getByText('save-password'));
    expect(sendMessage).toHaveBeenCalledWith(config('setpassword', 'new-secret'));
    expect(setWssPassword).toHaveBeenCalledWith('new-secret');

    fireEvent.click(screen.getByText('close-password'));
    expect(screen.queryByText('save-password')).not.toBeInTheDocument();
  });

  it('stores the plugins panel preference in both directions', () => {
    const { emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });
    const checkbox = document.querySelector('input[name="showPlugins"]')!;

    fireEvent.click(checkbox);
    expect(localStorage.getItem(MbfLsk['home-page-plugins'])).toBe('false');

    fireEvent.click(checkbox);
    expect(localStorage.getItem(MbfLsk['home-page-plugins'])).toBe('true');
    expect(checkbox).toBeChecked();
  });

  it('renders every settings panel in the mobile layout too', () => {
    const { emit } = renderSettings({ mobile: true } as UiContextType);
    emit({ method: '/api/settings', id: 23, response: settings });

    expect(screen.getByRole('heading', { name: 'Matterbridge settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Matter settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'System info' })).toBeInTheDocument();
    expect(screen.getByRole('main').firstElementChild).toHaveStyle({ gap: '10px' });
  });

  it('should retain desktop spacing when mobile support is disabled', () => {
    appState.enableMobile = false;
    const { emit } = renderSettings({ ...uiContext, mobile: true });
    emit({ method: '/api/settings', id: 23, response: settings });

    expect(screen.getByRole('main').firstElementChild).toHaveStyle({ gap: '20px' });
  });

  it('labels the runtime version as Bun when the backend reports one', () => {
    const { emit } = renderSettings();
    emit({
      method: '/api/settings',
      id: 23,
      response: { ...settings, systemInformation: { ...settings.systemInformation, bunVersion: 'v1.2.3' } },
    });

    expect(screen.getByDisplayValue('v1.2.3')).toBeInTheDocument();
    expect(screen.getByLabelText('Bun Version')).toBeInTheDocument();
    expect(screen.queryByLabelText('Node Version')).not.toBeInTheDocument();
  });

  describe('debounced Matter fields', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce all Matter fields independently and send their exact values after 1000ms', () => {
      const { sendMessage, emit } = renderSettings();
      emit({ method: '/api/settings', id: 23, response: settings });
      sendMessage.mockClear();

      for (const [initial, typed] of matterFields) {
        fireEvent.change(screen.getByDisplayValue(initial), { target: { value: typed } });
        expect(screen.getByDisplayValue(typed)).toBeInTheDocument();
      }

      act(() => {
        vi.advanceTimersByTime(999);
      });
      expect(sendMessage).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(sendMessage.mock.calls).toEqual(matterFields.map(([, typed, name]) => [config(name, typed)]));
    });

    it('sends only the last value when typing quickly', () => {
      const { sendMessage, emit } = renderSettings();
      emit({ method: '/api/settings', id: 23, response: settings });
      sendMessage.mockClear();

      fireEvent.change(screen.getByDisplayValue('5540'), { target: { value: '55' } });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.change(screen.getByDisplayValue('55'), { target: { value: '5599' } });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith(config('setmatterport', '5599'));
    });

    it('should cancel pending changes for every Matter field when the form unmounts', () => {
      const { sendMessage, emit } = renderSettings();
      emit({ method: '/api/settings', id: 23, response: settings });
      sendMessage.mockClear();

      for (const [initial, typed] of matterFields) {
        fireEvent.change(screen.getByDisplayValue(initial), { target: { value: typed } });
      }
      cleanup();
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('should log lifecycle events, broadcasts and setting changes when debug is enabled', () => {
      appState.debug = true;
      const { sendMessage, emit } = renderSettings();
      emit({ method: '/api/settings', id: 23, response: settings });
      emit({ method: 'refresh_required', id: 0, response: { changed: 'settings' } });
      emit({ method: 'update_required', id: 0, response: { version: '4.0.0', devVersion: false } });
      expect(screen.getByLabelText('Latest Version')).toHaveValue('4.0.0');
      emit({ method: 'update_required', id: 0, response: { version: '4.0.1-dev', devVersion: true } });
      sendMessage.mockClear();

      fireEvent.click(screen.getByLabelText('Childbridge'));
      pickOption('#mblogger-level', 'Warn');
      fireEvent.click(document.querySelector('#mblogger-file')!);
      pickOption('#mjlogger-level', 'Error');
      fireEvent.click(document.querySelector('#mjlogger-file')!);
      pickOption('#frontend-theme', 'Light');
      fireEvent.click(document.querySelector('input[name="showPlugins"]')!);
      pickOption('#frontend-home', 'Logs');
      pickOption('#frontend-virtual', 'Switch');
      fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
      fireEvent.click(screen.getByText('save-password'));
      fireEvent.click(screen.getByText('close-password'));
      for (const [initial, typed] of matterFields) {
        fireEvent.change(screen.getByDisplayValue(initial), { target: { value: typed } });
      }
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(sendMessage.mock.calls).toEqual(
        [
          config('setbridgemode', 'childbridge'),
          config('setmbloglevel', 'Warn'),
          config('setmblogfile', true),
          config('setmjloglevel', 'Error'),
          config('setmjlogfile', true),
          config('setvirtualmode', 'switch'),
          config('setpassword', 'new-secret'),
          ...matterFields.map(([, typed, name]) => config(name, typed)),
        ].map((message) => [message]),
      );
      expect(console.log).toHaveBeenCalledWith('Settings added WebSocket listener');
      expect(console.log).toHaveBeenCalledWith('Settings received online');
      expect(localStorage.getItem(MbfLsk['frontend-theme'])).toBe('light');
      expect(localStorage.getItem(MbfLsk['home-page-plugins'])).toBe('false');
      expect(localStorage.getItem(MbfLsk['home-page-mode'])).toBe('logs');
      cleanup();
      expect(console.log).toHaveBeenCalledWith('Settings removed WebSocket listener');
    });
  });
});
