import '@testing-library/jest-dom';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiSettings } from '../src/utils/backendShared';
import { MbfLsk, resetLocalStorage } from '../src/utils/localStorage';

vi.mock('../src/appState', () => ({ debug: false, enableMobile: true, setWssPassword: vi.fn() }));
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
vi.mock('../src/components/NetworkConfigDialog', () => ({
  NetworkConfigDialog: ({ open, ip, onClose, onSave }: { open: boolean; ip: string; onClose: () => void; onSave: (config: Record<string, string>) => void }) =>
    open ? (
      <div>
        <span>net-dialog-ip:{ip}</span>
        <button type="button" onClick={() => onSave({ type: 'dhcp', ip: '', subnet: '', gateway: '', dns: '' })}>
          save-net
        </button>
        <button type="button" onClick={onClose}>
          close-net
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
    loggerLevel: 'info',
    fileLogger: false,
    matterLoggerLevel: 'info',
    matterFileLogger: false,
    matterMdnsInterface: 'eth0-mdns',
    matterIpv4Address: '10.0.0.1',
    matterIpv6Address: 'fe80::1',
    matterPort: 5540,
    matterDiscriminator: 3840,
    matterPasscode: 20202021,
    virtualMode: 'disabled',
    readOnly: false,
    shellyBoard: false,
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

const pickOption = async (selectId: string, optionName: string) => {
  const combobox = document.querySelector<HTMLElement>(selectId)!;
  combobox.getBoundingClientRect = () => ({ width: 100, height: 20, top: 0, left: 0, bottom: 20, right: 100, x: 0, y: 0, toJSON: () => ({}) });
  act(() => {
    fireEvent.mouseDown(combobox);
  });
  const option = await screen.findByRole('option', { name: optionName });
  act(() => {
    fireEvent.click(option);
  });
};

const config = (name: string, value: unknown) => ({ id: 23, sender: 'Settings', method: '/api/config', src: 'Frontend', dst: 'Matterbridge', params: { name, value } });

function renderSettings(ui: UiContextType = uiContext) {
  const sendMessage = vi.fn();
  let listener: ((message: unknown) => void) | undefined;
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- This callback mirrors the WebSocket listener API.
  const addListener = vi.fn((callback: (message: unknown) => void) => {
    listener = callback;
  });
  const webSocketContext = { online: true, sendMessage, addListener, removeListener: vi.fn(), getUniqueId: () => 23 } as unknown as WebSocketContextType;
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
  });

  it('requests settings and saves a bridge-mode selection', () => {
    const sendMessage = vi.fn();
    const removeListener = vi.fn();
    let listener: ((message: unknown) => void) | undefined;
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- This callback mirrors the WebSocket listener API.
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

  it('sends the Matterbridge logger level and the file logger', async () => {
    const { sendMessage, emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });

    await pickOption('#mblogger-level', 'Warn');
    expect(sendMessage).toHaveBeenCalledWith(config('setmbloglevel', 'Warn'));
    expect(document.querySelector('#mblogger-level')).toHaveTextContent('Warn');

    fireEvent.click(document.querySelector('#mblogger-file')!);
    expect(sendMessage).toHaveBeenCalledWith(config('setmblogfile', true));
    expect(document.querySelector('#mblogger-file')).toBeChecked();
  });

  it('sends the Matter logger level and the file logger', async () => {
    const { sendMessage, emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });

    await pickOption('#mjlogger-level', 'Error');
    expect(sendMessage).toHaveBeenCalledWith(config('setmjloglevel', 'Error'));

    fireEvent.click(document.querySelector('#mjlogger-file')!);
    expect(sendMessage).toHaveBeenCalledWith(config('setmjlogfile', true));
  });

  it('applies the frontend theme to localStorage and to the document', async () => {
    const { sendMessage, emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });
    sendMessage.mockClear();

    await pickOption('#frontend-theme', 'Light');

    expect(localStorage.getItem(MbfLsk.frontendTheme)).toBe('light');
    expect(document.body.getAttribute('frontend-theme')).toBe('light');
    // The theme is a frontend-only preference and must not reach the backend.
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('stores the home page preferences locally without notifying the backend', async () => {
    const { sendMessage, emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });
    sendMessage.mockClear();

    fireEvent.click(document.querySelector('input[name="showPlugins"]')!);
    expect(localStorage.getItem(MbfLsk.homePagePlugins)).toBe('false');

    await pickOption('#frontend-home', 'Logs');
    expect(localStorage.getItem(MbfLsk.homePageMode)).toBe('logs');

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('stores the virtual mode locally and notifies the backend', async () => {
    const { sendMessage, emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });

    await pickOption('#frontend-virtual', 'Switch');

    expect(localStorage.getItem(MbfLsk.virtualMode)).toBe('switch');
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

  it('offers the network configuration only on a shelly board', () => {
    const { emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });

    expect(screen.queryByRole('button', { name: 'Configure IP' })).not.toBeInTheDocument();
  });

  it('saves the network configuration on a shelly board', () => {
    const { sendMessage, emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: withInfo({ shellyBoard: true }) });

    fireEvent.click(screen.getByRole('button', { name: 'Configure IP' }));
    // The dialog is seeded with the address reported in the system information.
    expect(screen.getByText(/net-dialog-ip:192.168.1.2/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('save-net'));
    expect(sendMessage).toHaveBeenCalledWith({
      id: 23,
      sender: 'Settings',
      method: '/api/shellynetconfig',
      src: 'Frontend',
      dst: 'Matterbridge',
      params: { type: 'dhcp', ip: '', subnet: '', gateway: '', dns: '' },
    });

    fireEvent.click(screen.getByText('close-net'));
    expect(screen.queryByText('save-net')).not.toBeInTheDocument();
  });

  it('stores the plugins panel preference in both directions', () => {
    const { emit } = renderSettings();
    emit({ method: '/api/settings', id: 23, response: settings });
    const checkbox = document.querySelector('input[name="showPlugins"]')!;

    fireEvent.click(checkbox);
    expect(localStorage.getItem(MbfLsk.homePagePlugins)).toBe('false');

    fireEvent.click(checkbox);
    expect(localStorage.getItem(MbfLsk.homePagePlugins)).toBe('true');
    expect(checkbox).toBeChecked();
  });

  it('renders every settings panel in the mobile layout too', () => {
    const { emit } = renderSettings({ mobile: true } as UiContextType);
    emit({ method: '/api/settings', id: 23, response: settings });

    expect(screen.getByRole('heading', { name: 'Matterbridge settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Matter settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'System info' })).toBeInTheDocument();
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

    it.each([
      ['eth0-mdns', 'eth1', 'setmdnsinterface'],
      ['10.0.0.1', '10.0.0.9', 'setipv4address'],
      ['fe80::1', 'fe80::9', 'setipv6address'],
      ['5540', '5541', 'setmatterport'],
      ['3840', '3841', 'setmatterdiscriminator'],
      ['20202021', '20202022', 'setmatterpasscode'],
    ])('sends %s as %s only after the debounce elapses', (initial, typed, name) => {
      const { sendMessage, emit } = renderSettings();
      emit({ method: '/api/settings', id: 23, response: settings });
      sendMessage.mockClear();

      fireEvent.change(screen.getByDisplayValue(initial), { target: { value: typed } });

      // The field updates immediately, but nothing is sent yet.
      expect(screen.getByDisplayValue(typed)).toBeInTheDocument();
      expect(sendMessage).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(sendMessage).toHaveBeenCalledWith(config(name, typed));
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

    it('does not send a pending value after the form unmounts', () => {
      const { sendMessage, emit } = renderSettings();
      emit({ method: '/api/settings', id: 23, response: settings });
      sendMessage.mockClear();

      fireEvent.change(screen.getByDisplayValue('5540'), { target: { value: '5599' } });
      cleanup();
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(sendMessage).not.toHaveBeenCalled();
    });
  });
});
