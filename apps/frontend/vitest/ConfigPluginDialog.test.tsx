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

  const extendConfig = (plugin: ApiPlugin, extra: Record<string, unknown>): ApiPlugin['configJson'] => {
    const currentConfig = plugin.configJson;
    if (!currentConfig) {
      throw new Error('Expected plugin configJson to be defined');
    }
    return {
      ...currentConfig,
      name: currentConfig.name!,
      type: currentConfig.type!,
      version: currentConfig.version!,
      debug: currentConfig.debug!,
      unregisterOnShutdown: currentConfig.unregisterOnShutdown!,
      ...extra,
    } as ApiPlugin['configJson'];
  };

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

  const getListener = (addListener: ReturnType<typeof vi.fn>) => {
    const listener = addListener.mock.calls[0]?.[0];
    expect(listener).toBeTypeOf('function');
    return listener;
  };

  it('returns null when the dialog is closed', () => {
    const plugin = createPlugin();

    render(
      <WebSocketContext.Provider
        value={{
          sendMessage: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          getUniqueId: () => 1234,
        } as any}
      >
        <ConfigPluginDialog open={false} onClose={vi.fn()} plugin={plugin} />
      </WebSocketContext.Provider>,
    );

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

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

    const listener = getListener(addListener);

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

  it('selects array values from device, entity, and device-entity dialogs', async () => {
    const plugin = createPlugin();
    plugin.configJson = extendConfig(plugin, {
      deviceSerials: [],
      entityDescriptions: [],
      'Kitchen Sensor': [],
    });

    const schemaProperties = plugin.schemaJson?.properties as Record<string, any>;
    schemaProperties.deviceSerials = {
      type: 'array',
      title: 'Device Serials',
      items: {
        type: 'string',
        default: '',
      },
      selectFrom: 'serial',
      uniqueItems: true,
    };
    schemaProperties.entityDescriptions = {
      type: 'array',
      title: 'Entity Descriptions',
      items: {
        type: 'string',
        default: '',
      },
      selectEntityFrom: 'description',
      uniqueItems: true,
    };
    schemaProperties['Kitchen Sensor'] = {
      type: 'array',
      title: 'Kitchen Sensor',
      items: {
        type: 'string',
        default: '',
      },
      selectDeviceEntityFrom: 'description',
      uniqueItems: true,
    };

    const { addListener } = renderDialog(plugin);
    const listener = getListener(addListener);

    listener({
      id: 1234,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/select/devices',
      response: [
        {
          serial: 'wifi-001',
          name: 'Kitchen Sensor',
          icon: 'wifi',
          entities: [
            { name: 'WiFi Entity', description: 'WiFi Desc', icon: 'wifi' },
            { name: 'Ble Entity', description: 'Ble Desc', icon: 'ble' },
            { name: 'Hub Entity', description: 'Hub Desc', icon: 'hub' },
            { name: 'Component Entity', description: 'Component Desc', icon: 'component' },
            { name: 'Matter Entity', description: 'Matter Desc', icon: 'matter' },
          ],
        },
        { serial: 'ble-001', name: 'Hall Sensor', icon: 'ble' },
        { serial: 'hub-001', name: 'Hub Sensor', icon: 'hub' },
      ],
    });
    listener({
      id: 1234,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/select/entities',
      response: [
        { name: 'Entity Wifi', description: 'WiFi Desc', icon: 'wifi' },
        { name: 'Entity Ble', description: 'Ble Desc', icon: 'ble' },
        { name: 'Entity Hub', description: 'Hub Desc', icon: 'hub' },
        { name: 'Entity Component', description: 'Component Desc', icon: 'component' },
        { name: 'Entity Matter', description: 'Matter Desc', icon: 'matter' },
      ],
    });

    const deviceSerialsSection = screen.getByText('Device Serials').closest('div')?.parentElement;
    expect(deviceSerialsSection).not.toBeNull();
    fireEvent.click(within(deviceSerialsSection as HTMLElement).getAllByRole('button')[0]);
    fireEvent.change(screen.getByPlaceholderText('Enter serial or name'), { target: { value: 'hub' } });
    fireEvent.click(screen.getByText('Hub Sensor'));

    await waitFor(() => {
      expect(within(deviceSerialsSection as HTMLElement).getAllByRole('textbox').map((input) => (input as HTMLInputElement).value)).toEqual(['hub-001']);
    });

    const entityDescriptionsSection = screen.getByText('Entity Descriptions').closest('div')?.parentElement;
    expect(entityDescriptionsSection).not.toBeNull();
    fireEvent.click(within(entityDescriptionsSection as HTMLElement).getAllByRole('button')[0]);
    fireEvent.change(screen.getByPlaceholderText('Enter name or description'), { target: { value: 'component' } });
    fireEvent.click(screen.getByText('Entity Component'));

    await waitFor(() => {
      expect(within(entityDescriptionsSection as HTMLElement).getAllByRole('textbox').map((input) => (input as HTMLInputElement).value)).toEqual(['Component Desc']);
    });

    const deviceEntitySection = screen.getByText('Kitchen Sensor').closest('div')?.parentElement;
    expect(deviceEntitySection).not.toBeNull();
    fireEvent.click(within(deviceEntitySection as HTMLElement).getAllByRole('button')[0]);
    fireEvent.click(screen.getByText('Matter Desc'));

    await waitFor(() => {
      expect(within(deviceEntitySection as HTMLElement).getAllByRole('textbox').map((input) => (input as HTMLInputElement).value)).toEqual(['Matter Desc']);
    });
  });

  it('hides already-selected uniqueItems from device, entity, and device-entity selector lists', async () => {
    const plugin = createPlugin();
    plugin.configJson = extendConfig(plugin, {
      deviceSerials: ['wifi-001'],
      entityDescriptions: ['WiFi Desc'],
      'Kitchen Sensor': ['Matter Desc'],
    });

    const schemaProperties = plugin.schemaJson?.properties as Record<string, any>;
    schemaProperties.deviceSerials = {
      type: 'array',
      title: 'Device Serials',
      items: {
        type: 'string',
        default: '',
      },
      selectFrom: 'serial',
      uniqueItems: true,
    };
    schemaProperties.entityDescriptions = {
      type: 'array',
      title: 'Entity Descriptions',
      items: {
        type: 'string',
        default: '',
      },
      selectEntityFrom: 'description',
      uniqueItems: true,
    };
    schemaProperties['Kitchen Sensor'] = {
      type: 'array',
      title: 'Kitchen Sensor',
      items: {
        type: 'string',
        default: '',
      },
      selectDeviceEntityFrom: 'description',
      uniqueItems: true,
    };

    const { addListener } = renderDialog(plugin);
    const listener = getListener(addListener);

    listener({
      id: 1234,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/select/devices',
      response: [
        {
          serial: 'wifi-001',
          name: 'Kitchen Sensor',
          icon: 'wifi',
          entities: [
            { name: 'WiFi Entity', description: 'WiFi Desc', icon: 'wifi' },
            { name: 'Ble Entity', description: 'Ble Desc', icon: 'ble' },
            { name: 'Matter Entity', description: 'Matter Desc', icon: 'matter' },
          ],
        },
        { serial: 'ble-001', name: 'Hall Sensor', icon: 'ble' },
      ],
    });
    listener({
      id: 1234,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/select/entities',
      response: [
        { name: 'Entity Wifi', description: 'WiFi Desc', icon: 'wifi' },
        { name: 'Entity Ble', description: 'Ble Desc', icon: 'ble' },
      ],
    });

    const getNewestDialog = () => screen.getAllByTestId('dialog').at(-1) as HTMLElement;

    const deviceSerialsSection = screen.getByText('Device Serials').closest('div')?.parentElement;
    expect(deviceSerialsSection).not.toBeNull();
    fireEvent.click(within(deviceSerialsSection as HTMLElement).getAllByRole('button')[0]);

    await waitFor(() => {
      expect(within(getNewestDialog()).queryByText('Kitchen Sensor')).not.toBeInTheDocument();
      expect(within(getNewestDialog()).getByText('Hall Sensor')).toBeInTheDocument();
    });

    fireEvent.click(within(getNewestDialog()).getByText('Close'));

    const entityDescriptionsSection = screen.getByText('Entity Descriptions').closest('div')?.parentElement;
    expect(entityDescriptionsSection).not.toBeNull();
    fireEvent.click(within(entityDescriptionsSection as HTMLElement).getAllByRole('button')[0]);

    await waitFor(() => {
      expect(within(getNewestDialog()).queryByText('Entity Wifi')).not.toBeInTheDocument();
      expect(within(getNewestDialog()).getByText('Entity Ble')).toBeInTheDocument();
    });

    fireEvent.click(within(getNewestDialog()).getByText('Close'));

    const deviceEntitySection = screen.getByText('Kitchen Sensor').closest('div')?.parentElement;
    expect(deviceEntitySection).not.toBeNull();
    fireEvent.click(within(deviceEntitySection as HTMLElement).getAllByRole('button')[0]);

    await waitFor(() => {
      expect(within(getNewestDialog()).queryByText('Matter Desc')).not.toBeInTheDocument();
      expect(within(getNewestDialog()).getByText('Ble Desc')).toBeInTheDocument();
    });
  });

  it('renders object sections with root title and selects additional keys by serial', async () => {
    const plugin = createPlugin();
    plugin.configJson = extendConfig(plugin, {
      serialMappings: {},
      hiddenConfig: 'secret',
    });
    plugin.schemaJson = {
      ...plugin.schemaJson,
      title: 'Plugin Settings',
    };

    const schemaProperties = plugin.schemaJson?.properties as Record<string, any>;
    schemaProperties.serialMappings = {
      type: 'object',
      title: 'Serial Mappings',
      description: 'Map devices by serial',
      selectFrom: 'serial',
      additionalProperties: {
        type: 'string',
        default: '',
      },
    };
    schemaProperties.hiddenConfig = {
      type: 'string',
      title: 'Hidden Config',
      'ui:widget': 'hidden',
      default: 'secret',
    };

    const { addListener } = renderDialog(plugin);
    const listener = getListener(addListener);

    listener({
      id: 1234,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: '/api/select/devices',
      response: [
        { serial: 'wifi-001', name: 'Kitchen Sensor', icon: 'wifi' },
        { serial: 'ble-001', name: 'Hall Sensor', icon: 'ble' },
        { serial: 'hub-001', name: 'Hub Sensor', icon: 'hub' },
      ],
    });

    expect(screen.getByText('Plugin Settings')).toBeInTheDocument();

    const serialMappingsSection = screen.getByText('Serial Mappings').closest('div')?.parentElement;
    expect(serialMappingsSection).not.toBeNull();

    fireEvent.click(within(serialMappingsSection as HTMLElement).getAllByRole('button')[0]);
    fireEvent.change(screen.getByPlaceholderText('Enter serial or name'), { target: { value: 'ble' } });
    fireEvent.click(screen.getByText('Hall Sensor'));

    await waitFor(() => {
      expect(within(serialMappingsSection as HTMLElement).getAllByRole('textbox').map((input) => (input as HTMLInputElement).value)).toEqual(['ble-001', '']);
    });
  });

  it('renders enum uniqueItems arrays through the multiselect path with wrapper title and dropdown checkmarks', async () => {
    const plugin = createPlugin();
    plugin.configJson = extendConfig(plugin, {
      loggerOnFile: ['debug', 'error'],
    });

    const schemaProperties = plugin.schemaJson?.properties as Record<string, any>;
    schemaProperties.loggerOnFile = {
      type: 'array',
      title: 'Logger On File',
      description: 'Set the logger on file for the plugin',
      items: {
        type: 'string',
        enum: ['debug', 'info', 'notice', 'warn', 'error', 'fatal'],
      },
      uniqueItems: true,
      default: [],
      'ui:enumDisabled': ['warn'],
    };

    renderDialog(plugin);

    const loggerOnFileTitle = screen.getByText('Logger On File');
    const loggerOnFileSection = loggerOnFileTitle.closest('div')?.parentElement;
    expect(loggerOnFileSection).not.toBeNull();

    expect(screen.getAllByText('Set the logger on file for the plugin')).toHaveLength(1);
    const combobox = within(loggerOnFileSection as HTMLElement).getByRole('combobox');
    expect(combobox).toBeInTheDocument();
    expect(within(loggerOnFileSection as HTMLElement).getByText('debug, error')).toBeInTheDocument();

    fireEvent.mouseDown(combobox);

    const debugOption = await screen.findByRole('option', { name: /debug/i });
    const infoOption = await screen.findByRole('option', { name: /info/i });
    const noticeOption = await screen.findByRole('option', { name: /notice/i });
    const errorOption = await screen.findByRole('option', { name: /error/i });

    expect(within(debugOption).getByRole('checkbox')).toBeChecked();
    expect(within(errorOption).getByRole('checkbox')).toBeChecked();
    expect(within(infoOption).getByRole('checkbox')).not.toBeChecked();

    fireEvent.focus(combobox);
    fireEvent.click(noticeOption);
    fireEvent.blur(combobox);

    await waitFor(() => {
      expect(within(loggerOnFileSection as HTMLElement).getByText(/debug/i)).toBeInTheDocument();
      expect(within(loggerOnFileSection as HTMLElement).getByText(/notice/i)).toBeInTheDocument();
      expect(within(loggerOnFileSection as HTMLElement).getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('renders action-style checkbox widgets and sends action/save messages', async () => {
    const plugin = createPlugin();
    plugin.configJson = extendConfig(plugin, {
      turnOn: false,
      turnOnDevice: false,
      debugToggle: false,
    });

    const schemaProperties = plugin.schemaJson?.properties as Record<string, any>;
    schemaProperties.turnOn = {
      type: 'boolean',
      title: 'Turn On All Devices',
      description: 'Turn on all devices',
      buttonText: 'Turn On',
      buttonClose: true,
      default: false,
    };
    schemaProperties.turnOnDevice = {
      type: 'boolean',
      title: 'Turn on specific device',
      description: 'Turn on one device',
      buttonField: 'Execute',
      textLabel: 'Device name',
      textPlaceholder: 'Enter the device name',
      buttonSave: true,
      default: false,
    };
    schemaProperties.debugToggle = {
      type: 'boolean',
      title: 'Enable Debug Toggle',
      description: 'Enable debug mode',
      default: false,
    };

    const { sendMessage, onClose } = renderDialog(plugin);

    fireEvent.click(screen.getByRole('button', { name: 'Turn On' }));

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: '/api/action',
        params: expect.objectContaining({
          plugin: 'matterbridge-test',
          action: 'turnOn',
        }),
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    const fieldInput = screen.getByPlaceholderText('Enter the device name');
    fireEvent.change(fieldInput, { target: { value: 'Kitchen Lamp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: '/api/action',
          params: expect.objectContaining({
            plugin: 'matterbridge-test',
            action: 'turnOnDevice',
            value: 'Kitchen Lamp',
          }),
        }),
      );
    });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: '/api/savepluginconfig',
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(2);

    const checkboxes = screen.getAllByRole('checkbox');
    const plainCheckbox = checkboxes.find((checkbox) => !(checkbox as HTMLInputElement).checked);
    expect(plainCheckbox).toBeDefined();
    fireEvent.click(plainCheckbox as HTMLElement);
    expect(plainCheckbox).toBeChecked();
  });

  it('renders validation errors for invalid config fields', async () => {
    const plugin = createPlugin();
    plugin.configJson = extendConfig(plugin, {
      mustMatchField: 'unexpected',
      hiddenField: 'hidden-value',
    });

    const schemaProperties = plugin.schemaJson?.properties as Record<string, any>;
    schemaProperties.mustMatchField = {
      type: 'string',
      title: 'Must Match Field',
      description: 'This field must equal the expected value',
      const: 'expected',
      default: 'unexpected',
    };
    schemaProperties.hiddenField = {
      type: 'string',
      title: 'Hidden Field',
      'ui:widget': 'hidden',
      default: 'hidden-value',
    };

    renderDialog(plugin);

    fireEvent.submit(screen.getByRole('button', { name: 'Confirm' }).closest('form') as HTMLFormElement);

    expect(await screen.findByText('Please fix the following errors:')).toBeInTheDocument();
    expect(screen.getAllByText(/This field/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/must be equal to constant/i).length).toBeGreaterThan(0);
  });
});
