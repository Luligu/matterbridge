import '@testing-library/jest-dom';

import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiPlugin } from '../src/utils/backendShared';
import { ConfigPluginDialog } from '../src/components/ConfigPluginDialog';
import { WebSocketContext } from '../src/components/WebSocketProvider';

vi.mock('../src/App', () => ({
  debug: false,
}));

vi.mock('@mui/material/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@mui/material/Dialog', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid='dialog'>{children}</div> : null),
}));

describe('ConfigPluginDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createPlugin = (): ApiPlugin => ({
    name: 'matterbridge-test',
    path: '/tmp/matterbridge-test',
    type: 'DynamicPlatform',
    version: '1.0.0',
    description: 'Test plugin',
    author: 'Test Author',
    enabled: true,
    configJson: {
      name: 'matterbridge-test',
      type: 'DynamicPlatform',
      version: '1.0.0',
      debug: false,
      unregisterOnShutdown: false,
      items: ['one', 'two'],
      mappings: {
        existing: 'value-1',
      },
    },
    schemaJson: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Name',
        },
        items: {
          type: 'array',
          title: 'Items',
          items: {
            type: 'string',
            title: 'Item',
            default: '',
          },
        },
        mappings: {
          type: 'object',
          title: 'Mappings',
          additionalProperties: {
            type: 'string',
            title: 'Mapping value',
            default: '',
          },
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

    return { ...renderResult, sendMessage, addListener, removeListener, onClose };
  };

  it('reorders and removes array items through the custom array item template', async () => {
    const { sendMessage, addListener, removeListener, unmount } = renderDialog();

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByText('Matterbridge plugin configuration')).toBeInTheDocument();
    expect(addListener).toHaveBeenCalled();

    const itemsTitle = screen.getByText('Items');
    const itemsSection = itemsTitle.closest('div')?.parentElement;
    expect(itemsSection).not.toBeNull();

    const getItemValues = () => within(itemsSection as HTMLElement).getAllByRole('textbox').map((element) => (element as HTMLInputElement).value);

    expect(getItemValues()).toEqual(['one', 'two']);

    let arrayButtons = within(itemsSection as HTMLElement).getAllByRole('button');

    fireEvent.click(arrayButtons[2]);

    await waitFor(() => {
      expect(getItemValues()).toEqual(['two', 'one']);
    });

    arrayButtons = within(itemsSection as HTMLElement).getAllByRole('button');
    fireEvent.click(arrayButtons[arrayButtons.length - 1]);

    await waitFor(() => {
      expect(getItemValues()).toEqual(['two']);
    });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: '/api/select/devices',
        params: { plugin: 'matterbridge-test' },
      }),
    );
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: '/api/select/entities',
        params: { plugin: 'matterbridge-test' },
      }),
    );

    unmount();
    expect(removeListener).toHaveBeenCalled();
  });

  it('adds a new array item, lets us name it, and removes it again', async () => {
    renderDialog();

    const itemsTitle = screen.getByText('Items');
    const itemsSection = itemsTitle.closest('div')?.parentElement;
    expect(itemsSection).not.toBeNull();

    const getArrayInputs = () => within(itemsSection as HTMLElement).getAllByRole('textbox') as HTMLInputElement[];

    expect(getArrayInputs().map((input) => input.value)).toEqual(['one', 'two']);

    fireEvent.click(within(itemsSection as HTMLElement).getAllByRole('button')[0]);

    await waitFor(() => {
      expect(getArrayInputs()).toHaveLength(3);
    });

    const newArrayInput = getArrayInputs()[2];
    fireEvent.change(newArrayInput, { target: { value: 'three' } });

    await waitFor(() => {
      expect(getArrayInputs().map((input) => input.value)).toEqual(['one', 'two', 'three']);
    });

    const arrayButtons = within(itemsSection as HTMLElement).getAllByRole('button');
    fireEvent.click(arrayButtons[arrayButtons.length - 1]);

    await waitFor(() => {
      expect(getArrayInputs().map((input) => input.value)).toEqual(['one', 'two']);
    });
  });

  it('adds a new object entry, lets us name the key and value, and removes it again', async () => {
    renderDialog();

    const mappingsTitle = screen.getByText('Mappings');
    const mappingsSection = mappingsTitle.closest('div')?.parentElement;
    expect(mappingsSection).not.toBeNull();

    const getObjectInputs = () => within(mappingsSection as HTMLElement).getAllByRole('textbox') as HTMLInputElement[];

    expect(getObjectInputs().map((input) => input.value)).toEqual(['existing', 'value-1']);

    fireEvent.click(within(mappingsSection as HTMLElement).getAllByRole('button')[0]);

    await waitFor(() => {
      expect(getObjectInputs()).toHaveLength(4);
    });

    fireEvent.change(getObjectInputs()[2], { target: { value: 'customName' } });
    fireEvent.blur(getObjectInputs()[2], { target: { value: 'customName' } });

    await waitFor(() => {
      expect(getObjectInputs().map((input) => input.value)).toEqual(['existing', 'value-1', 'customName', '']);
    });

    fireEvent.change(getObjectInputs()[3], { target: { value: 'customValue' } });

    await waitFor(() => {
      expect(getObjectInputs().map((input) => input.value)).toEqual(['existing', 'value-1', 'customName', 'customValue']);
    });

    const objectButtons = within(mappingsSection as HTMLElement).getAllByRole('button');
    fireEvent.click(objectButtons[objectButtons.length - 1]);

    await waitFor(() => {
      expect(getObjectInputs().map((input) => input.value)).toEqual(['existing', 'value-1']);
    });
  });

  it('adds a new object entry from the device list and renames the generated key', async () => {
    const plugin = createPlugin();
    const schemaProperties = plugin.schemaJson?.properties as Record<string, any>;
    schemaProperties.mappings.selectFrom = 'name';

    const { addListener } = renderDialog(plugin);

    const listener = addListener.mock.calls[0]?.[0];
    expect(listener).toBeTypeOf('function');

    listener({
      id: 1234,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/select/devices',
      response: [{ serial: 'device-001', name: 'Kitchen Sensor', icon: 'wifi' }],
    });

    const mappingsTitle = screen.getByText('Mappings');
    const mappingsSection = mappingsTitle.closest('div')?.parentElement;
    expect(mappingsSection).not.toBeNull();

    const getObjectInputs = () => within(mappingsSection as HTMLElement).getAllByRole('textbox') as HTMLInputElement[];

    expect(getObjectInputs().map((input) => input.value)).toEqual(['existing', 'value-1']);

    fireEvent.click(within(mappingsSection as HTMLElement).getAllByRole('button')[0]);
    fireEvent.click(screen.getByText('Kitchen Sensor'));

    await waitFor(() => {
      expect(getObjectInputs().map((input) => input.value)).toEqual(['existing', 'value-1', 'Kitchen Sensor', '']);
    });
  });
});
