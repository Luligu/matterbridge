import '@testing-library/jest-dom';

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import QRDiv from '../src/components/QRDiv';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';
import { type ApiMatter } from '../src/utils/backendShared';

const appState = vi.hoisted(() => ({ debug: false, enableMobile: false, enableWindows: false }));

vi.mock('../src/appState', () => appState);

beforeEach(() => {
  appState.debug = false;
  appState.enableMobile = false;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'execCommand');
});

function createMatter(overrides: Partial<ApiMatter> = {}): ApiMatter {
  return {
    id: 'node-a',
    online: true,
    commissioned: false,
    advertising: false,
    advertiseTime: 0,
    windowStatus: 0,
    fabricInformations: [],
    sessionInformations: [],
    qrPairingCode: 'MT:TEST',
    manualPairingCode: '12345678901',
    serialNumber: 'serial-a',
    ...overrides,
  };
}

function renderQRDiv({ id = 'node-a', online = true, mobile = false }: { id?: string | null; online?: boolean; mobile?: boolean } = {}) {
  const addListener = vi.fn();
  const removeListener = vi.fn();
  const sendMessage = vi.fn();
  const showConfirmCancelDialog = vi.fn<UiContextType['showConfirmCancelDialog']>();
  const context = { online, addListener, removeListener, sendMessage, getUniqueId: () => 7 } as unknown as WebSocketContextType;
  const view = (selectedId: string | null, connected = online) => (
    <WebSocketContext.Provider value={{ ...context, online: connected }}>
      <UiContext.Provider value={{ mobile, showConfirmCancelDialog } as unknown as UiContextType}>
        <QRDiv id={selectedId} />
      </UiContext.Provider>
    </WebSocketContext.Provider>
  );
  const result = render(view(id));
  const listener = addListener.mock.calls[0][0] as (message: unknown) => void;
  const receive = (message: unknown) => act(() => listener(message));
  const update = (matter: ApiMatter) => receive({ method: 'refresh_required', response: { changed: 'matter', matter } });
  return { ...result, view, receive, update, sendMessage, addListener, removeListener, listener, showConfirmCancelDialog };
}

describe('QRDiv', () => {
  test('should request the selected node and hide cached data while disconnected', () => {
    const { container, update, sendMessage, addListener, listener, rerender, view, unmount, removeListener } = renderQRDiv();
    expect(container).toBeEmptyDOMElement();
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({
      id: 7,
      sender: 'QRDiv',
      method: '/api/matter',
      src: 'Frontend',
      dst: 'Matterbridge',
      params: { id: 'node-a', server: true },
    });
    expect(addListener).toHaveBeenCalledExactlyOnceWith(listener, 7);
    update(createMatter());
    expect(screen.getByText('node-a')).toBeInTheDocument();
    rerender(view('node-a', false));
    expect(container).toBeEmptyDOMElement();
    rerender(view('node-a', true));
    expect(screen.getByText('node-a')).toBeInTheDocument();
    unmount();
    expect(removeListener).toHaveBeenCalledExactlyOnceWith(listener);
  });

  test('should clear cached data and request fresh data when a node is reselected', () => {
    const { container, update, sendMessage, rerender, view } = renderQRDiv({ id: null });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
    rerender(view('node-a'));
    update(createMatter());
    expect(screen.getByText('node-a')).toBeInTheDocument();
    rerender(view(null));
    rerender(view('node-a'));
    expect(container).toBeEmptyDOMElement();
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  test.each([
    { method: '/api/matter', response: { changed: 'matter', matter: createMatter() } },
    { method: 'refresh_required', response: { changed: 'plugins', matter: createMatter() } },
    { method: 'refresh_required', response: { changed: 'matter' } },
    { method: 'refresh_required', response: { changed: 'matter', matter: createMatter({ id: 'other-node' }) } },
  ])('should ignore unrelated or incomplete messages: %j', (message) => {
    const { container, receive } = renderQRDiv();
    receive(message);
    expect(container).toBeEmptyDOMElement();
  });

  test.each([
    { name: 'offline', overrides: { online: false }, heading: 'Server offline' },
    { name: 'advertising', overrides: { advertising: true }, heading: 'QR pairing code' },
    { name: 'commissioned', overrides: { commissioned: true }, heading: 'Paired fabrics' },
    { name: 'uncommissioned', overrides: {}, heading: 'QR pairing code' },
  ])('should render the $name state on mobile and log its lifecycle', ({ overrides, heading }) => {
    appState.debug = true;
    appState.enableMobile = true;
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { container, update, rerender, view, unmount } = renderQRDiv({ mobile: true });
    update(createMatter(overrides));
    expect(screen.getByText(heading)).toBeInTheDocument();
    expect(container.firstChild).toHaveStyle({ flex: '1 1 300px', alignItems: 'center' });
    rerender(view(null));
    expect(container).toBeEmptyDOMElement();
    unmount();
    expect(log).toHaveBeenCalledWith('QRDiv webSocket effect mounted');
    expect(log).toHaveBeenCalledWith('QRDiv webSocket effect unmounted');
  });

  test.each(
    [
      { advertising: true, qrPairingCode: '' },
      { advertising: true, manualPairingCode: '' },
      { commissioned: true, fabricInformations: undefined },
      { commissioned: true, sessionInformations: undefined },
    ].flatMap((overrides) => [false, true].map((debug) => ({ overrides, debug }))),
  )('should render nothing for incomplete pairing data: %j', ({ overrides, debug }) => {
    appState.debug = debug;
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { container, update } = renderQRDiv();
    update(createMatter(overrides));
    expect(container).toBeEmptyDOMElement();
    expect(log.mock.calls.some(([message]) => message === 'QRDiv rendering unknown state')).toBe(debug);
  });

  test.each(
    [
      { advertising: false, commissioned: false, button: 'Turn on pairing', command: 'startCommission' },
      { advertising: false, commissioned: true, button: 'start pairing', command: 'startCommission' },
      { advertising: true, commissioned: false, button: 'stop pairing', command: 'stopCommission' },
      { advertising: true, commissioned: false, button: 'send advertising', command: 'advertise' },
      { advertising: false, commissioned: true, button: 'send advertising', command: 'advertise' },
    ].flatMap((scenario) =>
      [false, true].map((debug) => ({ advertising: scenario.advertising, commissioned: scenario.commissioned, button: scenario.button, command: scenario.command, debug })),
    ),
  )('should send $command when clicking $button with debug=$debug', ({ advertising, commissioned, button, command, debug }) => {
    appState.debug = debug;
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { update, sendMessage } = renderQRDiv();
    update(createMatter({ advertising, commissioned }));
    sendMessage.mockClear();
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({
      id: 7,
      sender: 'QRDiv',
      method: '/api/matter',
      src: 'Frontend',
      dst: 'Matterbridge',
      params: { id: 'node-a', [command]: true },
    });
  });

  test.each([false, true])('should count active sessions and subscriptions and confirm fabric removal with debug=%s', (debug) => {
    appState.debug = debug;
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fabric = {
      fabricIndex: 1,
      fabricId: '1',
      nodeId: '1',
      rootNodeId: '2',
      rootVendorId: 65521,
      rootVendorName: 'Test vendor',
      label: 'Living room',
    };
    const otherFabric = {
      ...fabric,
      fabricIndex: 2,
      label: '',
    };
    const session = {
      name: 'session',
      nodeId: '1',
      peerNodeId: '2',
      fabric,
      isPeerActive: true,
      lastInteractionTimestamp: '',
      lastActiveTimestamp: '',
      numberOfActiveSubscriptions: 3,
    };
    const { receive, sendMessage, showConfirmCancelDialog } = renderQRDiv();
    receive({
      method: 'refresh_required',
      response: {
        changed: 'matter',
        matter: {
          ...createMatter(),
          commissioned: true,
          fabricInformations: [fabric, otherFabric],
          sessionInformations: [
            session,
            { ...session, numberOfActiveSubscriptions: 0 },
            { ...session, isPeerActive: false },
            { ...session, fabric: otherFabric, isPeerActive: false },
            { ...session, fabric: undefined },
          ],
        },
      },
    });
    expect(screen.getAllByText('Vendor: 65521 Test vendor')).toHaveLength(2);
    expect(screen.getByText('Label: Living room')).toBeInTheDocument();
    expect(screen.queryByText('Label:')).not.toBeInTheDocument();
    expect(screen.getByText('Sessions: 2 subscriptions: 1')).toBeInTheDocument();
    expect(screen.getByText('Sessions: 0 subscriptions: 0')).toBeInTheDocument();
    const fabricHeader = screen.getByText('Fabric: 2').parentElement!;
    sendMessage.mockClear();
    fireEvent.click(within(fabricHeader).getByRole('button', { name: 'remove the fabric' }));
    expect(showConfirmCancelDialog).toHaveBeenCalledExactlyOnceWith(
      'Remove fabric',
      'Are you sure you want to remove this fabric? You will also need to remove it from the controller.',
      'RemoveFabric',
      expect.any(Function),
      expect.any(Function),
    );
    expect(sendMessage).not.toHaveBeenCalled();
    const [, , command, confirm, cancel] = showConfirmCancelDialog.mock.calls[0];
    act(() => cancel(command));
    expect(sendMessage).not.toHaveBeenCalled();
    fireEvent.click(within(fabricHeader).getByRole('button', { name: 'remove the fabric' }));
    act(() => confirm(command));
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({
      id: 7,
      sender: 'QRDiv',
      method: '/api/matter',
      src: 'Frontend',
      dst: 'Matterbridge',
      params: { id: 'node-a', removeFabric: 2 },
    });
  });

  test.each([
    ['123', '123'],
    ['12a34', '1234'],
    ['12345', '1234-5'],
    ['1234567', '1234-567'],
    ['1234 567-8901', '1234-567-8901'],
    ['123456789012345', '1234-567-8901'],
    ['letters', ''],
  ])('should format manual code %s as %s', (manualPairingCode, formatted) => {
    const { update } = renderQRDiv();
    update(createMatter({ advertising: true, manualPairingCode }));
    expect(screen.getByText(`Manual pairing code: ${formatted}`.trim())).toBeInTheDocument();
  });

  test('should copy the raw manual code with the Clipboard API', async () => {
    appState.debug = true;
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { update } = renderQRDiv();
    update(createMatter({ advertising: true }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'copy manual pairing code' })));
    expect(writeText).toHaveBeenCalledExactlyOnceWith('12345678901');
    expect(log).toHaveBeenCalledWith('Manual pairing code copied to clipboard');
  });

  test.each([undefined, {}])('should use and clean up the legacy clipboard fallback when clipboard is %j', (clipboard) => {
    vi.stubGlobal('navigator', { clipboard });
    const execCommand = vi.fn(() => {
      expect(document.querySelector('textarea')).toHaveValue('12345678901');
      expect(document.activeElement).toBe(document.querySelector('textarea'));
      return true;
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    const { update } = renderQRDiv();
    update(createMatter({ advertising: true }));
    fireEvent.click(screen.getByRole('button', { name: 'copy manual pairing code' }));
    expect(execCommand).toHaveBeenCalledExactlyOnceWith('copy');
    expect(document.querySelector('textarea')).not.toBeInTheDocument();
  });

  test('should log a rejected clipboard write without propagating the error', async () => {
    const error = new Error('Clipboard permission denied');
    const writeText = vi.fn().mockRejectedValue(error);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { update } = renderQRDiv();
    update(createMatter({ advertising: true }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'copy manual pairing code' })));
    expect(log).toHaveBeenCalledExactlyOnceWith('Failed to copy manual pairing code', error);
  });

  test.each([
    { name: 'offline', online: false, commissioned: false, advertising: false },
    { name: 'advertising', online: true, commissioned: false, advertising: true },
    { name: 'commissioned', online: true, commissioned: true, advertising: false },
    { name: 'uncommissioned', online: true, commissioned: false, advertising: false },
  ])('should keep the $name label matched to the displayed data when switching nodes', (nodeState) => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    const sendMessage = vi.fn();
    const context = { online: true, addListener, removeListener, sendMessage, getUniqueId: () => 7 } as unknown as WebSocketContextType;
    const matter: ApiMatter = {
      id: 'node-a',
      online: nodeState.online,
      commissioned: nodeState.commissioned,
      advertising: nodeState.advertising,
      advertiseTime: 0,
      windowStatus: 0,
      fabricInformations: [],
      sessionInformations: [],
      qrPairingCode: 'MT:TEST',
      manualPairingCode: '12345678901',
      serialNumber: 'serial-a',
    };
    const view = (id: string | null) => (
      <WebSocketContext.Provider value={{ ...context }}>
        <UiContext.Provider value={{ mobile: false, showConfirmCancelDialog: vi.fn() } as unknown as UiContextType}>
          <QRDiv id={id} />
        </UiContext.Provider>
      </WebSocketContext.Provider>
    );
    const { rerender, unmount } = render(view('node-a'));
    const listener = addListener.mock.calls[0][0] as (message: unknown) => void;

    act(() => listener({ method: 'refresh_required', response: { changed: 'matter', matter } }));
    expect(screen.getByText('node-a')).toBeInTheDocument();
    const initialDetail = nodeState.advertising ? 'Manual pairing code: 1234-567-8901' : 'Serial number: serial-a';
    expect(screen.getByText(initialDetail)).toBeInTheDocument();

    rerender(view('node-b'));
    expect(sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({ params: { id: 'node-b', server: true } }));
    rerender(view('node-b'));
    expect(screen.getByText('node-a')).toBeInTheDocument();
    expect(screen.queryByText('node-b')).not.toBeInTheDocument();

    act(() => listener({ method: 'refresh_required', response: { changed: 'matter', matter: { ...matter, serialNumber: 'stale-a', manualPairingCode: '99999999999' } } }));
    expect(screen.getByText(initialDetail)).toBeInTheDocument();
    expect(screen.queryByText('Serial number: stale-a')).not.toBeInTheDocument();

    act(() =>
      listener({ method: 'refresh_required', response: { changed: 'matter', matter: { ...matter, id: 'node-b', serialNumber: 'serial-b', manualPairingCode: '22222222222' } } }),
    );
    expect(screen.getByText('node-b')).toBeInTheDocument();
    expect(screen.getByText(nodeState.advertising ? 'Manual pairing code: 2222-222-2222' : 'Serial number: serial-b')).toBeInTheDocument();
    expect(screen.queryByText('node-a')).not.toBeInTheDocument();

    rerender(view(null));
    expect(screen.queryByText('node-b')).not.toBeInTheDocument();
    unmount();
    expect(removeListener).toHaveBeenCalledWith(listener);
  });
});
