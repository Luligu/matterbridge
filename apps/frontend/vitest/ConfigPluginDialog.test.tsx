import '@testing-library/jest-dom';

import { getDefaultRegistry, type FormProps } from '@rjsf/core';
import {
  createSchemaUtils,
  type BaseInputTemplateProps,
  type DescriptionFieldProps,
  type FieldHelpProps,
  type FieldTemplateProps,
  type TemplatesType,
  type TitleFieldProps,
  type WidgetProps,
} from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigPluginDialog } from '../src/components/ConfigPluginDialog';
import { WebSocketContext } from '../src/components/WebSocketProvider';
import type { ApiPlugin } from '../src/utils/backendShared';

const formCapture = vi.hoisted(() => ({ props: undefined as FormProps | undefined }));

const getCapturedTemplates = () => formCapture.props!.templates as TemplatesType;
const createRegistry = () => ({ ...getDefaultRegistry(), schemaUtils: createSchemaUtils(validator, {}) });

vi.mock('@rjsf/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@rjsf/core')>();
  return {
    ...actual,
    default: (props: FormProps) => {
      formCapture.props = props;
      return <actual.default {...props} />;
    },
  };
});

vi.mock('../src/appState', () => ({
  debug: false,
}));

vi.mock('@mui/material/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@mui/material/Dialog', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid="dialog">{children}</div> : null),
}));

describe('ConfigPluginDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    formCapture.props = undefined;
  });

  const createPlugin = (): ApiPlugin => ({
    name: 'matterbridge-test',
    path: '/tmp/matterbridge-test',
    type: 'DynamicPlatform',
    version: '1.0.0',
    configurationVersion: 1,
    description: 'Test plugin',
    author: 'Test Author',
    enabled: true,
    private: false,
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
      name: currentConfig.name,
      type: currentConfig.type,
      version: currentConfig.version,
      debug: currentConfig.debug,
      unregisterOnShutdown: currentConfig.unregisterOnShutdown,
      ...extra,
    };
  };

  const renderDialog = (plugin: ApiPlugin = createPlugin()) => {
    const sendMessage = vi.fn();
    const addListener = vi.fn();
    const removeListener = vi.fn();
    const onClose = vi.fn();
    const onSave = vi.fn();

    const renderResult = render(
      <WebSocketContext.Provider
        value={
          {
            sendMessage,
            addListener,
            removeListener,
            getUniqueId: () => 1234,
          } as any
        }
      >
        <ConfigPluginDialog open={true} onClose={onClose} onSave={onSave} plugin={plugin} />
      </WebSocketContext.Provider>,
    );

    return { ...renderResult, sendMessage, addListener, removeListener, onClose, onSave };
  };

  const getListener = (addListener: ReturnType<typeof vi.fn>) => {
    const listener = addListener.mock.calls[0]?.[0];
    expect(listener).toBeTypeOf('function');
    return listener;
  };

  it.each(['configJson', 'schemaJson'] as const)('should render nothing and skip selector requests when %s is missing', (property) => {
    const plugin = createPlugin();
    plugin[property] = undefined;
    const { sendMessage, addListener, removeListener, unmount } = renderDialog(plugin);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    expect(sendMessage).not.toHaveBeenCalled();
    const listener = getListener(addListener);
    unmount();
    expect(removeListener).toHaveBeenCalledWith(listener);
  });

  it('should close without saving when Cancel is clicked', () => {
    const { onClose, onSave, sendMessage } = renderDialog();
    sendMessage.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('should submit edited text, numeric zero, and checkbox values', async () => {
    const plugin = createPlugin();
    plugin.configJson = extendConfig(plugin, { count: 1, enabledSetting: false });
    plugin.schemaJson = {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Plugin name' },
        count: { type: 'number', title: 'Count' },
        enabledSetting: { type: 'boolean', title: 'Enabled setting', description: 'Enable this setting' },
      },
    };
    const { onSave, onClose, sendMessage } = renderDialog(plugin);
    const name = screen.getByPlaceholderText('Plugin name');
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: 'matterbridge-edited' } });
    fireEvent.blur(name);
    fireEvent.change(screen.getByPlaceholderText('Count'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByPlaceholderText('Count')).toHaveValue('0');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'matterbridge-edited', count: 0, enabledSetting: true })));
    expect(onClose).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ method: '/api/savepluginconfig', params: { pluginName: 'matterbridge-edited', formData: onSave.mock.calls[0][0] } }),
    );
  });

  it('should disable an action field button again when its input is cleared', () => {
    const plugin = createPlugin();
    plugin.configJson = extendConfig(plugin, { action: false });
    plugin.schemaJson = {
      type: 'object',
      properties: { action: { type: 'boolean', description: 'Send an action', buttonField: 'Send action', textPlaceholder: 'Action argument' } },
    };
    const { sendMessage, onClose, onSave } = renderDialog(plugin);
    const button = screen.getByRole('button', { name: 'Send action' });
    const input = screen.getByPlaceholderText('Action argument');
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: 'value' } });
    expect(button).toBeEnabled();
    fireEvent.change(input, { target: { value: '' } });
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: 'new value' } });
    fireEvent.click(button);
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ method: '/api/action', params: expect.objectContaining({ action: 'action', value: 'new value' }) }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should retain hidden field content without displaying its wrapper', () => {
    const { unmount } = renderDialog();
    const Field = getCapturedTemplates().FieldTemplate;
    unmount();
    const props = {
      id: 'hidden',
      hidden: true,
      schema: {},
      registry: createRegistry(),
      children: <input aria-label="Hidden field" defaultValue="hidden value" />,
    } as FieldTemplateProps;
    render(<Field {...props} />);
    expect(screen.getByLabelText('Hidden field')).toHaveValue('hidden value');
    expect(screen.getByLabelText('Hidden field')).not.toBeVisible();
  });

  it('should render registered title, description, and help templates only when content exists', () => {
    const { unmount } = renderDialog();
    const templates = getCapturedTemplates();
    unmount();
    const Title = templates.TitleFieldTemplate;
    const Description = templates.DescriptionFieldTemplate;
    const Help = templates.FieldHelpTemplate;
    const registry = createRegistry();
    const titleProps: TitleFieldProps = { id: 'title', title: 'Template title', required: true, schema: {}, registry };
    const descriptionProps: DescriptionFieldProps = { id: 'description', description: 'Template description', schema: {}, registry };
    const helpProps: FieldHelpProps = { fieldPathId: { $id: 'help', path: [] }, help: 'Template help', schema: {}, registry };
    const { rerender, container } = render(
      <>
        <Title {...titleProps} />
        <Description {...descriptionProps} />
        <Help {...helpProps} />
      </>,
    );
    expect(screen.getByText(/Template title/)).toHaveTextContent('***');
    expect(screen.getByText('Template description')).toBeInTheDocument();
    expect(screen.getByText('Template help')).toBeInTheDocument();
    rerender(
      <>
        <Title {...titleProps} title="" />
        <Description {...descriptionProps} description="" />
        <Help {...helpProps} help="" />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('should forward clicks through registered array controls and honor hidden submit options', () => {
    const { unmount, onClose } = renderDialog();
    const buttons = getCapturedTemplates().ButtonTemplates;
    unmount();
    const Add = buttons.AddButton;
    const MoveUp = buttons.MoveUpButton;
    const MoveDown = buttons.MoveDownButton;
    const Submit = buttons.SubmitButton;
    const onAdd = vi.fn();
    const onUp = vi.fn();
    const onDown = vi.fn();
    const registry = createRegistry();
    const { rerender, container } = render(
      <>
        <Add onClick={onAdd} registry={registry} />
        <MoveUp onClick={onUp} registry={registry} />
        <MoveDown onClick={onDown} registry={registry} />
      </>,
    );
    const controls = screen.getAllByRole('button');
    for (const control of controls) fireEvent.click(control);
    expect(onAdd).toHaveBeenCalledOnce();
    expect(onUp).toHaveBeenCalledOnce();
    expect(onDown).toHaveBeenCalledOnce();
    rerender(<Submit registry={registry} uiSchema={{ 'ui:submitButtonOptions': { norender: true } }} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<Submit registry={registry} uiSchema={{ 'ui:submitButtonOptions': { submitText: 'Save settings' } }} />);
    expect(screen.getByRole('button', { name: 'Save settings' })).toHaveAttribute('type', 'submit');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should suppress registered array title and description templates', () => {
    const { unmount } = renderDialog();
    const templates = getCapturedTemplates();
    unmount();
    const Title = templates.ArrayFieldTitleTemplate;
    const Description = templates.ArrayFieldDescriptionTemplate;
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const props = { fieldPathId: { $id: 'array', path: [] }, title: 'Array title', description: 'Array description', schema: {}, registry: createRegistry() };
    const { container } = render(
      <>
        <Title {...props} />
        <Description {...props} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(log).toHaveBeenCalledWith('ArrayFieldTitleTemplate:', expect.objectContaining({ title: 'Array title' }));
    expect(log).toHaveBeenCalledWith('ArrayFieldDescriptionTemplate:', expect.objectContaining({ description: 'Array description' }));
    log.mockRestore();
  });

  it('should honor base input overrides, password autocomplete, and empty values', () => {
    const { unmount } = renderDialog();
    const Input = getCapturedTemplates().BaseInputTemplate;
    unmount();
    const onChange = vi.fn();
    const onChangeOverride = vi.fn();
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    const props: BaseInputTemplateProps = {
      id: 'password',
      name: 'password',
      label: 'Password',
      placeholder: 'Enter password',
      type: 'password',
      value: 'secret',
      schema: {},
      options: { emptyValue: 'empty' },
      registry: createRegistry(),
      onChange,
      onBlur,
      onFocus,
    };
    const { rerender } = render(<Input {...props} />);
    const input = screen.getByPlaceholderText('Enter password');
    expect(input).toHaveAttribute('autocomplete', 'current-password');
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onFocus).toHaveBeenCalledWith('password', 'secret');
    expect(onBlur).toHaveBeenCalledWith('password', 'secret');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith('empty');
    onChange.mockClear();
    rerender(<Input {...props} onChangeOverride={onChangeOverride} />);
    fireEvent.change(screen.getByPlaceholderText('Enter password'), { target: { value: 'changed' } });
    expect(onChangeOverride).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    rerender(<Input {...props} readonly />);
    expect(screen.getByPlaceholderText('Enter password')).toBeDisabled();
  });

  it('should handle single enum selection, focus, blur, and disabled options', async () => {
    const { unmount } = renderDialog();
    const Select = formCapture.props!.widgets!.SelectWidget as React.ComponentType<WidgetProps>;
    unmount();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    const props: WidgetProps = {
      id: 'mode',
      name: 'mode',
      label: 'Mode',
      schema: { type: 'string' },
      value: 'auto',
      options: {
        enumOptions: [
          { value: 'auto', label: 'Automatic' },
          { value: 'manual', label: 'Manual' },
        ],
        enumDisabled: ['manual'],
      },
      registry: createRegistry(),
      onChange,
      onBlur,
      onFocus,
    };
    const { rerender } = render(<Select {...props} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onFocus).toHaveBeenCalledWith('mode', undefined);
    expect(onBlur).toHaveBeenCalledWith('mode', 'auto');
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'Manual' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('option', { name: 'Automatic' }));
    rerender(<Select {...props} value={undefined} readonly />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', 'true');
  });

  it('should move nested and composite schema UI properties into the UI schema', () => {
    const plugin = createPlugin();
    plugin.schemaJson = {
      type: 'object',
      properties: {
        nested: { type: 'object', properties: { value: { type: 'string', 'ui:help': 'Nested help', 'ui:placeholder': 'Nested value' } } },
        items: { type: 'array', items: { type: 'object', properties: { value: { type: 'string', 'ui:help': 'Item help' } } } },
      },
      allOf: [{ properties: { all: { type: 'string', 'ui:help': 'All help' } } }],
      anyOf: [{ properties: { any: { type: 'string', 'ui:help': 'Any help' } } }],
      oneOf: [{ properties: { one: { type: 'string', 'ui:help': 'One help' } } }],
    };
    plugin.configJson = extendConfig(plugin, { items: [], nested: {} });
    renderDialog(plugin);
    expect(formCapture.props!.uiSchema).toMatchObject({
      nested: { value: { 'ui:help': 'Nested help', 'ui:placeholder': 'Nested value' } },
      items: { value: { 'ui:help': 'Item help' } },
      all: { 'ui:help': 'All help' },
      any: { 'ui:help': 'Any help' },
      one: { 'ui:help': 'One help' },
    });
    expect(JSON.stringify(plugin.schemaJson)).not.toContain('ui:');
  });

  it('should ignore selector responses from other senders, destinations, or request IDs', () => {
    const plugin = createPlugin();
    plugin.schemaJson = { type: 'object', properties: { devices: { type: 'array', title: 'Devices', items: { type: 'string' }, selectFrom: 'name' } } };
    plugin.configJson = extendConfig(plugin, { devices: [] });
    const { addListener } = renderDialog(plugin);
    const listener = getListener(addListener);
    const message = { id: 1234, src: 'Matterbridge', dst: 'Frontend', method: '/api/select/devices', response: [{ serial: 'valid', name: 'Valid device' }] };
    listener(message);
    for (const overrides of [{ src: 'Other' }, { dst: 'Other' }, { id: 0 }, { id: 9999 }, { method: '/api/other' }]) {
      listener({ ...message, ...overrides, response: [{ serial: 'invalid', name: 'Invalid device' }] });
    }
    listener({ ...message, response: null });
    listener({ ...message, method: '/api/select/entities', response: null });
    const section = screen.getByText('Devices').closest('div')!.parentElement!;
    fireEvent.click(within(section).getAllByRole('button')[0]);
    expect(screen.getByText('Valid device')).toBeInTheDocument();
    expect(screen.queryByText('Invalid device')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Select a device')).not.toBeInTheDocument();
  });

  it('returns null when the dialog is closed', () => {
    const plugin = createPlugin();

    render(
      <WebSocketContext.Provider
        value={
          {
            sendMessage: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            getUniqueId: () => 1234,
          } as any
        }
      >
        <ConfigPluginDialog open={false} onClose={vi.fn()} onSave={vi.fn()} plugin={plugin} />
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

    const getItemValues = () =>
      within(itemsSection as HTMLElement)
        .getAllByRole('textbox')
        .map((element) => (element as HTMLInputElement).value);

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

    const getArrayInputs = () => within(itemsSection as HTMLElement).getAllByRole<HTMLInputElement>('textbox');

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

    const getObjectInputs = () => within(mappingsSection as HTMLElement).getAllByRole<HTMLInputElement>('textbox');

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

    const getObjectInputs = () => within(mappingsSection as HTMLElement).getAllByRole<HTMLInputElement>('textbox');

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
      expect(
        within(deviceSerialsSection as HTMLElement)
          .getAllByRole('textbox')
          .map((input) => (input as HTMLInputElement).value),
      ).toEqual(['hub-001']);
    });

    const entityDescriptionsSection = screen.getByText('Entity Descriptions').closest('div')?.parentElement;
    expect(entityDescriptionsSection).not.toBeNull();
    fireEvent.click(within(entityDescriptionsSection as HTMLElement).getAllByRole('button')[0]);
    fireEvent.change(screen.getByPlaceholderText('Enter name or description'), { target: { value: 'component' } });
    fireEvent.click(screen.getByText('Entity Component'));

    await waitFor(() => {
      expect(
        within(entityDescriptionsSection as HTMLElement)
          .getAllByRole('textbox')
          .map((input) => (input as HTMLInputElement).value),
      ).toEqual(['Component Desc']);
    });

    const deviceEntitySection = screen.getByText('Kitchen Sensor').closest('div')?.parentElement;
    expect(deviceEntitySection).not.toBeNull();
    fireEvent.click(within(deviceEntitySection as HTMLElement).getAllByRole('button')[0]);
    fireEvent.click(screen.getByText('Matter Desc'));

    await waitFor(() => {
      expect(
        within(deviceEntitySection as HTMLElement)
          .getAllByRole('textbox')
          .map((input) => (input as HTMLInputElement).value),
      ).toEqual(['Matter Desc']);
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
      expect(
        within(serialMappingsSection as HTMLElement)
          .getAllByRole('textbox')
          .map((input) => (input as HTMLInputElement).value),
      ).toEqual(['ble-001', '']);
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

    const { sendMessage, onClose, onSave } = renderDialog(plugin);

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
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'matterbridge-test' }));
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
