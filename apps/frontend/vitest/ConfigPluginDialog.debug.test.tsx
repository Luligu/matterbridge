import '@testing-library/jest-dom';

import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiPlugin } from '../src/utils/backendShared';
import { WebSocketContext } from '../src/components/WebSocketProvider';

vi.mock('../src/App', () => ({
  debug: true,
}));

vi.mock('@mui/material/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@mui/material/Dialog', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid='dialog'>{children}</div> : null),
}));

import { ConfigPluginDialog } from '../src/components/ConfigPluginDialog';

describe('ConfigPluginDialog debug paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  const createPlugin = (): ApiPlugin => ({
    name: 'matterbridge-debug-test',
    path: '/tmp/matterbridge-debug-test',
    type: 'DynamicPlatform',
    version: '1.0.0',
    description: 'Debug test plugin',
    author: 'Test Author',
    enabled: true,
    configJson: {
      name: 'matterbridge-debug-test',
      type: 'DynamicPlatform',
      version: '1.0.0',
      deviceNames: [],
      entityNames: [],
      'Kitchen Sensor': [],
      serialMappings: {},
      debugAction: false,
      debug: false,
      unregisterOnShutdown: false,
    },
    schemaJson: {
      type: 'object',
      properties: {
        deviceNames: {
          type: 'array',
          title: 'Device Names',
          items: {
            type: 'string',
            default: '',
          },
          selectFrom: 'name',
        },
        entityNames: {
          type: 'array',
          title: 'Entity Names',
          items: {
            type: 'string',
            default: '',
          },
          selectEntityFrom: 'name',
        },
        'Kitchen Sensor': {
          type: 'array',
          title: 'Kitchen Sensor',
          items: {
            type: 'string',
            default: '',
          },
          selectDeviceEntityFrom: 'name',
        },
        serialMappings: {
          type: 'object',
          title: 'Serial Mappings',
          selectFrom: 'serial',
          additionalProperties: {
            type: 'string',
            default: '',
          },
        },
        debugAction: {
          type: 'boolean',
          title: 'Debug Action',
          description: 'Execute a debug action',
          buttonField: 'Execute',
          textLabel: 'Action value',
          textPlaceholder: 'Enter debug action',
          buttonSave: true,
          default: false,
        },
      },
    },
  });

  const renderDialog = (plugin: ApiPlugin = createPlugin()) => {
    const sendMessage = vi.fn();
    const addListener = vi.fn();
    const removeListener = vi.fn();
    const onClose = vi.fn();

    const renderResult = render(
      <WebSocketContext.Provider
        value={{
          sendMessage,
          addListener,
          removeListener,
          getUniqueId: () => 1234,
        } as any}
      >
        <ConfigPluginDialog open={true} onClose={onClose} plugin={plugin} />
      </WebSocketContext.Provider>,
    );

    const listener = addListener.mock.calls[0]?.[0];
    expect(listener).toBeTypeOf('function');

    return { ...renderResult, sendMessage, addListener, removeListener, onClose, listener };
  };

  it('covers reachable debug logging paths through normal dialog interactions', async () => {
    const { listener, sendMessage, removeListener, onClose, unmount } = renderDialog();

    listener({
      id: 1234,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/select/devices',
      response: [
        {
          serial: 'serial-001',
          name: 'Kitchen Sensor',
          icon: 'wifi',
          entities: [
            { name: 'Kitchen Light', description: 'Kitchen Light Desc', icon: 'component' },
            { name: 'Kitchen Matter', description: 'Kitchen Matter Desc', icon: 'matter' },
          ],
        },
        { serial: 'serial-002', name: 'Hall Sensor', icon: 'ble' },
      ],
    });
    listener({
      id: 1234,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/select/entities',
      response: [
        { name: 'Entity One', description: 'Entity One Desc', icon: 'wifi' },
        { name: 'Entity Two', description: 'Entity Two Desc', icon: 'hub' },
      ],
    });

    const deviceNamesSection = screen.getByText('Device Names').closest('div')?.parentElement;
    expect(deviceNamesSection).not.toBeNull();
    fireEvent.click(within(deviceNamesSection as HTMLElement).getAllByRole('button')[0]);
    fireEvent.click(within(screen.getAllByTestId('dialog').at(-1) as HTMLElement).getByText('Kitchen Sensor'));

    await waitFor(() => {
      expect(within(deviceNamesSection as HTMLElement).getAllByRole('textbox').map((input) => (input as HTMLInputElement).value)).toEqual(['Kitchen Sensor']);
    });

    const entityNamesSection = screen.getByText('Entity Names').closest('div')?.parentElement;
    expect(entityNamesSection).not.toBeNull();
    fireEvent.click(within(entityNamesSection as HTMLElement).getAllByRole('button')[0]);
    fireEvent.click(within(screen.getAllByTestId('dialog').at(-1) as HTMLElement).getByText('Entity One'));

    await waitFor(() => {
      expect(within(entityNamesSection as HTMLElement).getAllByRole('textbox').map((input) => (input as HTMLInputElement).value)).toEqual(['Entity One']);
    });

    const deviceEntitySection = screen.getByText('Kitchen Sensor').closest('div')?.parentElement;
    expect(deviceEntitySection).not.toBeNull();
    fireEvent.click(within(deviceEntitySection as HTMLElement).getAllByRole('button')[0]);
    fireEvent.click(within(screen.getAllByTestId('dialog').at(-1) as HTMLElement).getByText('Kitchen Light'));

    await waitFor(() => {
      expect(within(deviceEntitySection as HTMLElement).getAllByRole('textbox').map((input) => (input as HTMLInputElement).value)).toEqual(['Kitchen Light']);
    });

    const serialMappingsSection = screen.getByText('Serial Mappings').closest('div')?.parentElement;
    expect(serialMappingsSection).not.toBeNull();
    fireEvent.click(within(serialMappingsSection as HTMLElement).getAllByRole('button')[0]);
    fireEvent.click(within(screen.getAllByTestId('dialog').at(-1) as HTMLElement).getByText('Hall Sensor'));

    await waitFor(() => {
      expect(within(serialMappingsSection as HTMLElement).getAllByRole('textbox').map((input) => (input as HTMLInputElement).value)).toEqual(['serial-002', '']);
    });

    const actionInput = screen.getByPlaceholderText('Enter debug action');
    fireEvent.change(actionInput, { target: { value: 'trace-debug' } });
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: '/api/action',
          params: expect.objectContaining({ action: 'debugAction', value: 'trace-debug' }),
        }),
      );
    });

    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/savepluginconfig' }));
    expect(onClose).toHaveBeenCalled();

    unmount();
    expect(removeListener).toHaveBeenCalled();

    const logMessages = (console.log as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((call) => call[0]);
    expect(logMessages).toContain('ConfigPluginDialog rendering...');
    expect(logMessages).toContain('ConfigPluginDialog mounting...');
    expect(logMessages).toContain('ConfigPluginDialog mounting with form:');
    expect(logMessages).toContain('ConfigPluginDialog mounting with schema:');
    expect(logMessages).toContain('ConfigPluginDialog mounting with uiSchema:');
    expect(logMessages).toContain('ConfigPluginDialog added WebSocket listener id:');
    expect(logMessages).toContain('ConfigPluginDialog removed WebSocket listener');
  });
});
