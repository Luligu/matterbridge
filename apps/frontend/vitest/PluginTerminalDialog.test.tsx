import '@testing-library/jest-dom/vitest';

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PluginTerminalDialog } from '../src/components/PluginTerminalDialog';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';
import type { WsMessageApiResponse } from '../src/utils/backendShared';

function renderDialog(onClose = vi.fn()) {
  let listener: ((msg: WsMessageApiResponse) => void) | undefined;
  const sendMessage = vi.fn();
  const removeListener = vi.fn();
  const context = {
    getUniqueId: () => 5,
    addListener: (handler: (msg: WsMessageApiResponse) => void) => {
      listener = handler;
    },
    removeListener,
    sendMessage,
  } as unknown as WebSocketContextType;
  const view = render(
    <WebSocketContext.Provider value={context}>
      <PluginTerminalDialog open onClose={onClose} pluginName="matterbridge-test" />
    </WebSocketContext.Provider>,
  );
  const reply = (response: { output: string; error?: boolean }, id = 5, method = '/api/plugin-command') =>
    act(() => listener?.({ id, src: 'Matterbridge', dst: 'Frontend', method, success: true, response } as unknown as WsMessageApiResponse));
  const input = () => screen.getByRole('textbox', { name: 'Terminal command' });
  const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
  const key = (name: string) => fireEvent.keyDown(input(), { key: name });
  return { ...view, sendMessage, removeListener, onClose, reply, input, type, key };
}

describe('PluginTerminalDialog', () => {
  afterEach(() => cleanup());

  it('should send the typed command to the plugin and show the output and the errors', () => {
    const { sendMessage, reply, type, key, input } = renderDialog();
    expect(screen.getByText('Terminal - matterbridge-test')).toBeInTheDocument();

    key('Enter');
    expect(sendMessage).not.toHaveBeenCalled();

    type('  --command custom --method get_consumable  ');
    key('Enter');
    expect(sendMessage).toHaveBeenCalledWith({
      id: 5,
      sender: 'PluginTerminalDialog',
      method: '/api/plugin-command',
      src: 'Frontend',
      dst: 'Matterbridge',
      params: { plugin: 'matterbridge-test', command: '--command custom --method get_consumable' },
    });
    expect(screen.getByText('> --command custom --method get_consumable')).toBeInTheDocument();
    expect(input()).toHaveValue('');

    // A second command is ignored while the first one is pending
    type('second');
    key('Enter');
    expect(sendMessage).toHaveBeenCalledTimes(1);

    reply({ output: 'consumable ok' }, 99);
    key('Enter');
    expect(sendMessage).toHaveBeenCalledTimes(1);

    reply({ output: 'consumable ok' });
    expect(screen.getByText('consumable ok')).toBeInTheDocument();

    key('Enter');
    expect(sendMessage).toHaveBeenCalledTimes(2);
    reply({ output: 'boom', error: true });
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('should recall the command history with the arrow keys', () => {
    const { reply, type, key, input } = renderDialog();
    key('ArrowUp');
    key('ArrowDown');
    expect(input()).toHaveValue('');

    type('first');
    key('Enter');
    reply({ output: 'one' });
    type('second');
    key('Enter');
    reply({ output: 'two' });

    key('ArrowUp');
    expect(input()).toHaveValue('second');
    key('ArrowUp');
    expect(input()).toHaveValue('first');
    key('ArrowUp');
    expect(input()).toHaveValue('first');
    key('ArrowDown');
    expect(input()).toHaveValue('second');
    key('ArrowDown');
    expect(input()).toHaveValue('');
    key('a');
    expect(input()).toHaveValue('');
  });

  it('should ignore other messages, clear the output, close, and remove the listener on unmount', () => {
    const { reply, type, key, onClose, removeListener, unmount } = renderDialog();
    type('first');
    key('Enter');
    reply({ output: 'ignored' }, 5, '/api/other');
    expect(screen.queryByText('ignored')).not.toBeInTheDocument();
    reply({ output: 'shown' });
    expect(screen.getByText('shown')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText('shown')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(removeListener).toHaveBeenCalled();
  });

  it('should focus the command input when the dialog has finished opening', async () => {
    const { input } = renderDialog();
    await waitFor(() => expect(input()).toHaveFocus());
  });
});
