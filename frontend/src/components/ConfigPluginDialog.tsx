/* eslint-disable @typescript-eslint/no-explicit-any */
// React
import { useContext, useEffect, useState, useRef } from 'react';

// @mui/material
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import TextField, { TextFieldProps } from '@mui/material/TextField';
import ListItemButton from '@mui/material/ListItemButton';
import DialogActions from '@mui/material/DialogActions';

// @mui/icons-material
import DeleteForever from '@mui/icons-material/DeleteForever'; // For RemoveButton
import Add from '@mui/icons-material/Add'; // For AddButton
import ListIcon from '@mui/icons-material/List';
import WifiIcon from '@mui/icons-material/Wifi'; // For selectDevice icon=wifi
import BluetoothIcon from '@mui/icons-material/Bluetooth'; // For selectDevice icon=ble
import HubIcon from '@mui/icons-material/Hub'; // For selectDevice icon=hub
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'; // For ErrorListTemplate
import ViewInArIcon from '@mui/icons-material/ViewInAr'; // For entities icon=component
import DeviceHubIcon from '@mui/icons-material/DeviceHub'; // For entities icon=matter

// @rjsf
import Form, { IChangeEvent } from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import {
  getSubmitButtonOptions,
  getUiOptions,
  getTemplate,
  enumOptionsValueForIndex,
  ariaDescribedByIds,
  enumOptionsIndexForValue,
  ADDITIONAL_PROPERTY_FLAG,
  WidgetProps,
  SubmitButtonProps,
  IconButtonProps,
  FieldTemplateProps,
  DescriptionFieldProps,
  TitleFieldProps,
  FieldHelpProps,
  ErrorListProps,
  FieldErrorProps,
  BaseInputTemplateProps,
  ArrayFieldTitleProps,
  ArrayFieldDescriptionProps,
  ArrayFieldTemplateProps,
  ArrayFieldTemplateItemType,
  ObjectFieldTemplateProps,
  WrapIfAdditionalTemplateProps,
  UiSchema,
  RJSFSchema,
} from '@rjsf/utils';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { ApiSelectDevice, ApiSelectDeviceEntity, ApiSelectEntity, isApiResponse, WsMessage } from '../../../src/frontendTypes';
import { ApiPlugin } from '../../../src/matterbridgeTypes';
import { debug } from '../App';
// const debug = false;
const rjsfDebug = false;

const titleSx = { fontSize: '16px', fontWeight: 'bold', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)' };
const descriptionSx = { fontSize: '12px', fontWeight: 'normal', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)' };
const helpSx = { fontSize: '14px', fontWeight: 'normal', color: 'var(--secondary-color)', backgroundColor: 'var(--div-bg-color)' };
const errorTitleSx = { fontSize: '16px', fontWeight: 'bold', backgroundColor: 'var(--div-bg-color)' };
const iconButtonSx = { padding: '0px', margin: '0px' };
const boxPadding = '5px 10px 5px 10px';
const listItemButtonSx = {};
const listItemIconStyle = {};
const listItemTextPrimaryStyle = {};
const listItemTextSecondaryStyle = {};
let selectDevices: ApiSelectDevice[] = [];
let selectEntities: ApiSelectEntity[] = [];

type RjsfPropertyWithStringType = RJSFSchema & { type: string };

function hasSchemaPropertyWithStringType(schema: RJSFSchema, name: string): schema is RJSFSchema & { properties: Record<string, RjsfPropertyWithStringType> } {
  const properties: unknown = schema?.properties;
  if (!properties || typeof properties !== 'object') return false;
  const property: unknown = (properties as Record<string, unknown>)[name];
  if (!property || typeof property !== 'object') return false;
  return typeof (property as { type?: unknown }).type === 'string';
}

function hasSchemaItemsWithDefault(schema: RJSFSchema): schema is RJSFSchema & { items: RJSFSchema & { default: unknown } } {
  const items = schema.items;
  return items !== undefined && typeof items === 'object' && !Array.isArray(items);
}

export interface ConfigPluginDialogProps {
  open: boolean;
  onClose: () => void;
  plugin: ApiPlugin;
}

export const ConfigPluginDialog = ({ open, onClose, plugin }: ConfigPluginDialogProps) => {
  // Contexts
  const { sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);

  // Refs
  const uniqueId = useRef(getUniqueId());

  // States
  const [formData, setFormData] = useState(plugin.configJson);
  const [schema, setSchema] = useState(plugin.schemaJson);
  const [uiSchema, setUiSchema] = useState<UiSchema>({
    'ui:submitButtonOptions': {
      'submitText': 'Confirm',
    },
    'ui:globalOptions': { orderable: true },
  });

  const [newkey, setNewkey] = useState(''); // For ObjectFieldTemplate select from device list
  let currentFormData = {};

  // WebSocket message handler effect
  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessage) => {
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        // Local messages
        if (isApiResponse(msg) && msg.id === uniqueId.current && msg.method === '/api/select/devices') {
          if (msg.response) {
            if (debug) console.log(`ConfigPluginDialog (id: ${msg.id}) received ${msg.response.length} /api/select/devices:`, msg.response);
            selectDevices = msg.response;
          }
        }
        if (isApiResponse(msg) && msg.id === uniqueId.current && msg.method === '/api/select/entities') {
          if (msg.response) {
            if (debug) console.log(`ConfigPluginDialog (id: ${msg.id}) received ${msg.response.length} /api/select/entities:`, msg.response);
            selectEntities = msg.response;
          }
        }
      }
    };

    addListener(handleWebSocketMessage, uniqueId.current);
    if (debug) console.log('ConfigPluginDialog added WebSocket listener id:', uniqueId.current);

    // Move the ui: properties from the schema to the uiSchema
    if (formData && schema && schema.properties) {
      if (rjsfDebug) console.log('ConfigPluginDialog moveToUiSchema:', schema, uiSchema);

      /*
      Object.keys(schema.properties).forEach((key) => {
        Object.keys(schema.properties[key]).forEach((subkey) => {
          if (subkey.startsWith('ui:')) {
            if (rjsfDebug) console.log('ConfigPluginDialog moveToUiSchema:', key, subkey, schema.properties[key][subkey]);
            uiSchema[key] = {};
            uiSchema[key][subkey] = schema.properties[key][subkey];
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete schema.properties[key][subkey];
          }
        });
      });
      */
      const moveUiPropertiesToUiSchema = (schemaObj: RJSFSchema, uiSchemaObj: UiSchema, path: string[] = []) => {
        if (!schemaObj || typeof schemaObj !== 'object') return;

        // Handle properties object
        if (schemaObj.properties) {
          Object.keys(schemaObj.properties).forEach((key) => {
            const property = schemaObj.properties?.[key] as RJSFSchema;
            const currentPath = [...path, key];

            // Move ui:* properties from this property
            Object.keys(property).forEach((subkey) => {
              if (subkey.startsWith('ui:')) {
                if (rjsfDebug) console.log('ConfigPluginDialog moveToUiSchema:', currentPath.join('.'), subkey, property[subkey]);

                // Create nested uiSchema structure
                let currentUiSchema = uiSchemaObj;
                currentPath.forEach((p) => {
                  if (!currentUiSchema[p]) currentUiSchema[p] = {};
                  currentUiSchema = currentUiSchema[p];
                });
                currentUiSchema[subkey] = property[subkey];

                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete property[subkey];
              }
            });

            // Recursively process nested properties
            moveUiPropertiesToUiSchema(property, uiSchemaObj, currentPath);
          });
        }

        // Handle oneOf/anyOf/allOf arrays
        ['oneOf', 'anyOf', 'allOf'].forEach((keyword) => {
          if (Array.isArray(schemaObj[keyword])) {
            schemaObj[keyword].forEach((subSchema: any) => {
              moveUiPropertiesToUiSchema(subSchema, uiSchemaObj, path);
            });
          }
        });

        // Handle items (for arrays)
        if (schemaObj.items && typeof schemaObj.items === 'object') {
          moveUiPropertiesToUiSchema(schemaObj.items, uiSchemaObj, path);
        }
      };

      moveUiPropertiesToUiSchema(schema, uiSchema);
      setUiSchema(uiSchema);
      if (rjsfDebug) console.log('ConfigPluginDialog moveToUiSchema:', schema, uiSchema);
    }

    // Send the select devices and entities messages
    if (plugin.name && plugin.configJson && plugin.schemaJson) {
      setFormData(plugin.configJson);
      setSchema(plugin.schemaJson);
      sendMessage({ id: uniqueId.current, sender: 'ConfigPlugin', method: '/api/select/devices', src: 'Frontend', dst: 'Matterbridge', params: { plugin: plugin.name } });
      sendMessage({ id: uniqueId.current, sender: 'ConfigPlugin', method: '/api/select/entities', src: 'Frontend', dst: 'Matterbridge', params: { plugin: plugin.name } });
      if (debug) console.log('HomePlugins sent "/api/select/devices" and "/api/select/entities" for plugin:', plugin.name);
    }

    return () => {
      removeListener(handleWebSocketMessage);
      if (debug) console.log('ConfigPluginDialog removed WebSocket listener');
    };
  }, [addListener, formData, plugin, removeListener, schema, sendMessage, uiSchema]);

  const handleFormChange = (data: IChangeEvent<any, RJSFSchema, any>, id?: string) => {
    currentFormData = data.formData;
    if (rjsfDebug) console.log(`handleFormChange id ${id} formData:`, data.formData);
  };

  const handleSaveChanges = (data: IChangeEvent<any, RJSFSchema, any>) => {
    if (debug) console.log('ConfigPluginDialog handleSaveChanges:', data.formData);
    // Save the configuration
    setFormData(data.formData);
    plugin.configJson = data.formData;
    plugin.restartRequired = true;
    sendMessage({ id: uniqueId.current, sender: 'ConfigPlugin', method: '/api/savepluginconfig', src: 'Frontend', dst: 'Matterbridge', params: { pluginName: data.formData.name, formData: data.formData } });
    // Close the dialog
    onClose();
  };

  function WrapIfAdditionalTemplate(props: WrapIfAdditionalTemplateProps) {
    const { id, label, onKeyChange, onDropPropertyClick, disabled, schema, children, registry, readonly, required } = props;
    const { templates } = registry;
    const { RemoveButton } = templates.ButtonTemplates;
    if (rjsfDebug) console.log('WrapIfAdditionalTemplate:', props);
    const additional = ADDITIONAL_PROPERTY_FLAG in schema;

    if (!additional) {
      return <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, padding: rjsfDebug ? '2px' : 0, margin: rjsfDebug ? '2px' : 0, border: rjsfDebug ? '2px solid magenta' : 'none' }}>{children}</Box>;
    }
    const handleBlur = ({ target }: React.FocusEvent<HTMLInputElement>) => onKeyChange(target && target.value);
    return (
      <Box sx={{ display: 'flex', flexDirection: 'row', flexGrow: 1, padding: rjsfDebug ? '2px' : 0, margin: rjsfDebug ? '2px' : 0, border: rjsfDebug ? '2px solid magenta' : 'none' }}>
        <TextField
          id={`${id}-key`}
          name={`${id}-key`}
          required={required}
          disabled={disabled || readonly}
          defaultValue={label}
          onBlur={!readonly ? handleBlur : undefined}
          type='text'
          variant='outlined'
          sx={{ width: '250px', minWidth: '250px', maxWidth: '250px', marginRight: '20px' }}
        />
        <Box sx={{ flex: 1 }}>{children}</Box>
        <RemoveButton disabled={disabled || readonly} onClick={onDropPropertyClick(label)} registry={registry} />
      </Box>
    );
  }

  function FieldTemplate(props: FieldTemplateProps) {
    const { children, description, displayLabel, errors, help, hidden, registry, uiSchema } = props;
    const uiOptions = getUiOptions(uiSchema);
    const WrapIfAdditionalTemplate = getTemplate('WrapIfAdditionalTemplate', registry, uiOptions);
    // const rjsfDebug = true;
    if (rjsfDebug) console.log('FieldTemplate:', props, 'WrapIfAdditionalTemplate:', WrapIfAdditionalTemplate !== undefined);
    if (hidden) {
      return <div style={{ display: 'none' }}>{children}</div>;
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, padding: rjsfDebug ? '2px' : 0, margin: rjsfDebug ? '2px' : 0, border: rjsfDebug ? '2px solid cyan' : 'none' }}>
        <WrapIfAdditionalTemplate {...props}>
          {/* displayLabel===true && !isArray && <Typography sx={titleSx}>id: {id} label: {label} {required && <mark>***</mark>}</Typography> */}
          {displayLabel === true && description}
          {children}
          {errors}
          {help}
        </WrapIfAdditionalTemplate>
      </Box>
    );
  }

  function DescriptionFieldTemplate(props: DescriptionFieldProps) {
    const { description } = props;
    if (rjsfDebug) console.log('DescriptionFieldTemplate:', props);
    if (!description) return null;
    return (
      <Typography sx={descriptionSx}>
        {/* id: {id} desc: */}
        {description}
      </Typography>
    );
  }

  function TitleFieldTemplate(props: TitleFieldProps) {
    const { required, title } = props;
    if (rjsfDebug) console.log('TitleFieldTemplate:', props);
    if (!title) return null;
    return (
      <Box sx={{ padding: '0px', margin: '0px', marginTop: '5px' }}>
        <Typography sx={titleSx}>
          {/* id: {id} title: */}Title {title} {required && <mark>***</mark>}
        </Typography>
      </Box>
    );
  }

  function FieldHelpTemplate(props: FieldHelpProps) {
    const { help } = props;
    if (rjsfDebug) console.log('FieldHelpTemplate:', props);
    if (!help) return null;
    return (
      <Box sx={{ padding: '0px', margin: '0px', marginTop: '5px' }}>
        <Typography sx={helpSx}>
          {/* id: {id} help: */}
          {help}
        </Typography>
      </Box>
    );
  }

  // Shows a list of errors at the top of the form
  function ErrorListTemplate(props: ErrorListProps) {
    const { errors } = props;
    if (rjsfDebug) console.log('ErrorListTemplate:', props);
    if (!errors) return null;
    return (
      <Box sx={{ padding: '10px', margin: '10px', border: '1px solid grey' }}>
        <Typography color='error' sx={errorTitleSx}>
          Please fix the following errors:
        </Typography>
        <List>
          {errors.map((error, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                <ErrorOutlineIcon color='error' />
              </ListItemIcon>
              <ListItemText primary={error.stack} />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  }

  // Shows the field error at the bottom of the field
  function FieldErrorTemplate(props: FieldErrorProps) {
    const { errors } = props;
    if (rjsfDebug) console.log('FieldErrorTemplate:', props);
    if (!errors) return null;
    return (
      <Box sx={{ padding: '0px', margin: '0px', marginTop: '5px' }}>
        {errors.map((error, index) => (
          <Typography key={index} color='error' variant='body2' sx={{ marginLeft: 1 }}>
            This field {error}
          </Typography>
        ))}
      </Box>
    );
  }

  function BaseInputTemplate(props: BaseInputTemplateProps) {
    const { id, name, _schema, _uiSchema, value, options, label, type, placeholder, required, disabled, readonly, autofocus, onChange, onChangeOverride, onBlur, onFocus, _rawErrors, _hideError, _registry, _formContext } = props;
    if (rjsfDebug) console.log('BaseInputTemplate:', props);
    const _onChange = ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => onChange(value === '' ? options.emptyValue : value);
    const _onBlur = ({ target }: React.FocusEvent<HTMLInputElement>) => onBlur(id, target && target.value);
    const _onFocus = ({ target }: React.FocusEvent<HTMLInputElement>) => onFocus(id, target && target.value);
    return (
      <Box sx={{ padding: '0px', margin: '0px' }}>
        <TextField
          id={id}
          name={id}
          label={placeholder && placeholder !== '' ? label : undefined}
          variant='outlined'
          placeholder={placeholder && placeholder !== '' ? placeholder : label}
          required={required}
          disabled={disabled || readonly}
          autoFocus={autofocus}
          value={value || value === 0 ? value : ''}
          type={type}
          autoComplete={type === 'password' ? 'current-password' : name}
          onChange={onChangeOverride || _onChange}
          onBlur={_onBlur}
          onFocus={_onFocus}
          fullWidth
        />
      </Box>
    );
  }

  function ArrayFieldTitleTemplate(props: ArrayFieldTitleProps) {
    console.log('ArrayFieldTitleTemplate:', props);
    return null;
  }

  function ArrayFieldDescriptionTemplate(props: ArrayFieldDescriptionProps) {
    console.log('ArrayFieldDescriptionTemplate:', props);
    return null;
  }

  function ArrayFieldItemTemplate(props: ArrayFieldTemplateItemType) {
    console.log('ArrayFieldItemTemplate:', props);
    return null;
  }

  function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
    const { canAdd, onAddClick, schema, title } = props;
    if (rjsfDebug) console.log(`ArrayFieldTemplate for ${title}:`, props);

    const [dialogDeviceOpen, setDialogDeviceOpen] = useState(false);
    const [dialogEntityOpen, setDialogEntityOpen] = useState(false);
    const [dialogDeviceEntityOpen, setDialogDeviceEntityOpen] = useState(false);
    const [filter, setFilter] = useState('');

    const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setFilter(event.target.value);
    };

    const handleDialogDeviceToggle = () => {
      if (debug) console.log('ArrayFieldTemplate: handleDialogDeviceToggle filter:', filter, 'selectDevices:', selectDevices);
      setDialogDeviceOpen(!dialogDeviceOpen);
    };

    const handleDialogEntityToggle = () => {
      if (debug) console.log('ArrayFieldTemplate: handleDialogEntityToggle filter:', filter, 'selectEntities:', selectEntities);
      setDialogEntityOpen(!dialogEntityOpen);
    };

    const handleDialogDeviceEntityToggle = () => {
      if (debug) console.log('ArrayFieldTemplate: handleDialogDeviceEntityToggle filter:', filter, 'selectDevices:', selectDevices);
      setDialogDeviceEntityOpen(!dialogDeviceEntityOpen);
    };

    const handleSelectDeviceValue = (value: ApiSelectDevice) => {
      // console.log('ArrayFieldTemplate: handleSelectValue', value);
      setDialogDeviceOpen(false);
      // Trigger onAddClick to add the selected new item
      if (schema.selectFrom === 'serial' && hasSchemaItemsWithDefault(schema)) schema.items.default = value.serial;
      else if (schema.selectFrom === 'name' && hasSchemaItemsWithDefault(schema)) schema.items.default = value.name;
      onAddClick();
    };

    const handleSelectEntityValue = (value: ApiSelectEntity) => {
      // console.log('ArrayFieldTemplate: handleSelectEntityValue', value);
      setDialogEntityOpen(false);
      // Trigger onAddClick to add the selected new item
      if (schema.selectEntityFrom === 'name' && hasSchemaItemsWithDefault(schema)) schema.items.default = value.name;
      else if (schema.selectEntityFrom === 'description' && hasSchemaItemsWithDefault(schema)) schema.items.default = value.description;
      onAddClick();
    };

    const handleSelectDeviceEntityValue = (value: ApiSelectDeviceEntity) => {
      // console.log('ArrayFieldTemplate: handleSelectEntityValue', value);
      setDialogDeviceEntityOpen(false);
      // Trigger onAddClick to add the selected new item
      if (schema.selectDeviceEntityFrom === 'name' && hasSchemaItemsWithDefault(schema)) schema.items.default = value.name;
      else if (schema.selectDeviceEntityFrom === 'description' && hasSchemaItemsWithDefault(schema)) schema.items.default = value.description;
      onAddClick();
    };

    // const rjsfDebug = true;

    return (
      <Box sx={{ margin: '0px', padding: '5px 10px 5px 10px', border: rjsfDebug ? '2px solid yellow' : '1px solid grey' }}>
        {title && (
          <Box sx={{ margin: '0px', padding: '0px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {title && <Typography sx={titleSx}>{title}</Typography>}
            {canAdd && (
              <Box sx={{ margin: '0px', padding: '0px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {schema.selectFrom && (
                  <Tooltip title='Add a device from the list'>
                    <IconButton onClick={handleDialogDeviceToggle} size='small' color='primary' sx={iconButtonSx}>
                      <ListIcon />
                    </IconButton>
                  </Tooltip>
                )}
                {schema.selectEntityFrom && (
                  <Tooltip title='Add an entity from the list'>
                    <IconButton onClick={handleDialogEntityToggle} size='small' color='primary' sx={iconButtonSx}>
                      <ListIcon />
                    </IconButton>
                  </Tooltip>
                )}
                {schema.selectDeviceEntityFrom && (
                  <Tooltip title='Add a device entity from the list'>
                    <IconButton onClick={handleDialogDeviceEntityToggle} size='small' color='primary' sx={iconButtonSx}>
                      <ListIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title='Add a new item'>
                  <IconButton onClick={onAddClick} size='small' color='primary' sx={iconButtonSx}>
                    <Add />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
        )}
        {schema.description && <Typography sx={descriptionSx}>{schema.description}</Typography>}
        {props.items.map((element) => (
          <Box key={element.index} sx={{ margin: '2px 0px', padding: '0px', display: 'flex', alignItems: 'center' }}>
            <Box sx={{ flexGrow: 1, marginRight: '10px' }}>{element.children}</Box>
            <IconButton disabled={!element.hasMoveUp} onClick={element.onReorderClick(element.index, element.index - 1)} size='small' color='primary' sx={iconButtonSx}>
              <KeyboardDoubleArrowUpIcon />
            </IconButton>
            <IconButton disabled={!element.hasMoveDown} onClick={element.onReorderClick(element.index, element.index + 1)} size='small' color='primary' sx={iconButtonSx}>
              <KeyboardDoubleArrowDownIcon />
            </IconButton>
            <IconButton onClick={element.onDropIndexClick(element.index)} size='small' color='primary' sx={iconButtonSx}>
              <DeleteForever />
            </IconButton>
          </Box>
        ))}

        {/* Dialog for selecting a device */}
        <Dialog
          open={dialogDeviceOpen}
          onClose={handleDialogDeviceToggle}
          PaperProps={{
            sx: {
              maxHeight: '50vh', // Set the maximum height to 50% of the viewport height
              maxWidth: '50vw', // Set the maximum width to 50% of the viewport width
              overflow: 'auto', // Allow scrolling for overflowing content
            },
          }}
        >
          <DialogTitle>Select a device</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Typography variant='subtitle1' sx={{ whiteSpace: 'nowrap' }}>
                Filter by:
              </Typography>
              <TextField fullWidth variant='outlined' value={filter} onChange={handleFilterChange} placeholder='Enter serial or name' />
            </Box>
            <List dense>
              {selectDevices
                .filter((v) => v.serial.toLowerCase().includes(filter.toLowerCase()) || v.name.toLowerCase().includes(filter.toLowerCase()))
                .map((value, index) => (
                  <ListItemButton onClick={() => handleSelectDeviceValue(value)} key={index} sx={listItemButtonSx}>
                    {value.icon === 'wifi' && (
                      <ListItemIcon>
                        <WifiIcon style={listItemIconStyle} />
                      </ListItemIcon>
                    )}
                    {value.icon === 'ble' && (
                      <ListItemIcon>
                        <BluetoothIcon style={listItemIconStyle} />
                      </ListItemIcon>
                    )}
                    {value.icon === 'hub' && (
                      <ListItemIcon>
                        <HubIcon style={listItemIconStyle} />
                      </ListItemIcon>
                    )}
                    <ListItemText primary={value.name} secondary={value.serial} primaryTypographyProps={{ style: listItemTextPrimaryStyle }} secondaryTypographyProps={{ style: listItemTextSecondaryStyle }} />
                  </ListItemButton>
                ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogDeviceToggle}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Dialog for selecting an entity */}
        <Dialog
          open={dialogEntityOpen}
          onClose={handleDialogEntityToggle}
          PaperProps={{
            sx: {
              maxHeight: '50vh', // Set the maximum height to 50% of the viewport height
              maxWidth: '50vw', // Set the maximum width to 50% of the viewport width
              overflow: 'auto', // Allow scrolling for overflowing content
            },
          }}
        >
          <DialogTitle>Select an entity</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Typography variant='subtitle1' sx={{ whiteSpace: 'nowrap' }}>
                Filter by:
              </Typography>
              <TextField fullWidth variant='outlined' value={filter} onChange={handleFilterChange} placeholder='Enter name or description' />
            </Box>
            <List dense>
              {selectEntities
                .filter((v) => v.name.toLowerCase().includes(filter.toLowerCase()) || v.description.toLowerCase().includes(filter.toLowerCase()))
                .map((value, index) => (
                  <ListItemButton onClick={() => handleSelectEntityValue(value)} key={index} sx={listItemButtonSx}>
                    {value.icon === 'wifi' && (
                      <ListItemIcon>
                        <WifiIcon style={listItemIconStyle} />
                      </ListItemIcon>
                    )}
                    {value.icon === 'ble' && (
                      <ListItemIcon>
                        <BluetoothIcon style={listItemIconStyle} />
                      </ListItemIcon>
                    )}
                    {value.icon === 'hub' && (
                      <ListItemIcon>
                        <HubIcon style={listItemIconStyle} />
                      </ListItemIcon>
                    )}
                    {value.icon === 'component' && (
                      <ListItemIcon>
                        <ViewInArIcon style={listItemIconStyle} />
                      </ListItemIcon>
                    )}
                    {value.icon === 'matter' && (
                      <ListItemIcon>
                        <DeviceHubIcon style={listItemIconStyle} />
                      </ListItemIcon>
                    )}
                    <ListItemText primary={value.name} secondary={value.description} primaryTypographyProps={{ style: listItemTextPrimaryStyle }} secondaryTypographyProps={{ style: listItemTextSecondaryStyle }} />
                  </ListItemButton>
                ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogEntityToggle}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Dialog for selecting a device entity */}
        <Dialog
          open={dialogDeviceEntityOpen}
          onClose={handleDialogDeviceEntityToggle}
          PaperProps={{
            sx: {
              maxHeight: '50vh', // Set the maximum height to 50% of the viewport height
              maxWidth: '50vw', // Set the maximum width to 50% of the viewport width
              overflow: 'auto', // Allow scrolling for overflowing content
            },
          }}
        >
          <DialogTitle>Select an entity for {title}</DialogTitle>
          <DialogContent>
            <List dense>
              {selectDevices
                .filter((d) => d.serial === title || d.name === title)
                .map((value) => {
                  // console.log('ArrayFieldTemplate: handleSelectDeviceEntityValue value:', value, value.entities);
                  // console.log('ArrayFieldTemplate: handleSelectDeviceEntityValue schema:', schema);
                  return value.entities?.map((entity, index) => (
                    <ListItemButton onClick={() => handleSelectDeviceEntityValue(entity)} key={index} sx={listItemButtonSx}>
                      {entity.icon === 'wifi' && (
                        <ListItemIcon>
                          <WifiIcon style={listItemIconStyle} />
                        </ListItemIcon>
                      )}
                      {entity.icon === 'ble' && (
                        <ListItemIcon>
                          <BluetoothIcon style={listItemIconStyle} />
                        </ListItemIcon>
                      )}
                      {entity.icon === 'hub' && (
                        <ListItemIcon>
                          <HubIcon style={listItemIconStyle} />
                        </ListItemIcon>
                      )}
                      {entity.icon === 'component' && (
                        <ListItemIcon>
                          <ViewInArIcon style={listItemIconStyle} />
                        </ListItemIcon>
                      )}
                      {entity.icon === 'matter' && (
                        <ListItemIcon>
                          <DeviceHubIcon style={listItemIconStyle} />
                        </ListItemIcon>
                      )}
                      <ListItemText primary={entity.name} secondary={entity.description} primaryTypographyProps={{ style: listItemTextPrimaryStyle }} secondaryTypographyProps={{ style: listItemTextSecondaryStyle }} />
                    </ListItemButton>
                  ));
                })}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogDeviceEntityToggle}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
    const { onAddClick, schema, properties, title, description } = props;

    const [dialogDeviceOpen, setDialogDeviceOpen] = useState(false);
    const [filter, setFilter] = useState('');

    const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setFilter(event.target.value);
    };

    const handleDialogDeviceToggle = () => {
      setDialogDeviceOpen(!dialogDeviceOpen);
    };

    const handleSelectDeviceValue = (value: ApiSelectDevice) => {
      if (debug) console.log(`ObjectFieldTemplate: handleSelectValue value "${value.serial}" for schema "${schema.selectFrom}"`);
      setDialogDeviceOpen(false);
      let newkey = '';
      if (schema.selectFrom === 'serial') newkey = value.serial;
      else if (schema.selectFrom === 'name') newkey = value.name;
      setNewkey(newkey);
      if (debug) console.log(`ObjectFieldTemplate: handleSelectValue newkey "${newkey}"`);

      // Trigger onAddClick returned function to add the selected new item
      const addProperty = onAddClick(schema);
      addProperty();
    };

    const handleAddItem = () => {
      // Trigger onAddClick returned function to add the selected new item
      const addProperty = onAddClick(schema);
      addProperty();
    };

    // const rjsfDebug = true;

    // Check if this is the entire schema or an individual object
    const isRoot = !schema.additionalProperties;
    if (rjsfDebug) console.log('ObjectFieldTemplate: title', title, 'description', description, 'schema', schema, 'isRoot', isRoot, 'props', props);

    // If this is not the root object and newkey is not empty, then set the new key with the selected value
    if (debug) console.log(`ObjectFieldTemplate: isRoot ${isRoot} newkey "${newkey}"`);
    if (!isRoot && newkey !== '') {
      if (debug) console.log('ObjectFieldTemplate: newkey', newkey, 'properties', properties);
      properties.forEach((p: any) => {
        if (p.name === 'newKey' && p.content.key === 'newKey' && p.content.props.name === 'newKey' && p.content.props.onKeyChange && newkey !== '') {
          if (debug) console.log('ObjectFieldTemplate: newkey onKeyChange', newkey);
          const newName = newkey;
          setNewkey(''); // No enter again...
          p.content.props.onKeyChange(newName);
        }
      });
    }

    return (
      <Box sx={{ margin: '0px', padding: isRoot ? '10px' : '5px 10px 0px 10px', border: rjsfDebug ? '1px solid blue' : isRoot ? 'none' : '1px solid grey' }}>
        {/* Title for root */}
        {schema.title && isRoot && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0px', margin: '0px', marginBottom: '10px' }}>
            <Typography sx={titleSx}>{schema.title}</Typography>
          </Box>
        )}
        {/* Title, Select and Add for object */}
        {title && !isRoot && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0px', margin: '0px' }}>
            <Typography sx={titleSx}>{title}</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0px', margin: '0px' }}>
              {schema.selectFrom && (
                <Tooltip title='Add a device from the list'>
                  <IconButton onClick={handleDialogDeviceToggle} size='small' color='primary' sx={iconButtonSx}>
                    <ListIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title='Add a new item'>
                <IconButton onClick={handleAddItem} size='small' color='primary' sx={iconButtonSx}>
                  <Add />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}
        {/* Description for both */}
        {schema.description && (
          <Box sx={{ padding: '0px', margin: '0px', marginBottom: '10px' }}>
            <Typography sx={descriptionSx}>{schema.description}</Typography>
          </Box>
        )}
        {/* Iterate over each property in the object */}
        {properties.map(
          ({ content, name, hidden }) =>
            !hidden && (
              <Box
                key={name}
                sx={{
                  margin: '0px',
                  marginBottom: '10px',
                  padding: hasSchemaPropertyWithStringType(schema, name) && ['object', 'array'].includes(schema.properties[name].type) ? '0px' : boxPadding,
                  border: hasSchemaPropertyWithStringType(schema, name) && ['object', 'array'].includes(schema.properties[name].type) ? 'none' : rjsfDebug ? '2px solid blue' : '1px solid grey',
                }}
              >
                {hasSchemaPropertyWithStringType(schema, name) && !['object', 'array', 'boolean'].includes(schema.properties[name].type) && <Typography sx={titleSx}>{schema.properties[name].title || name}</Typography>}
                <Box sx={{ flexGrow: 1, padding: '0px', margin: '0px' }}>{content}</Box>
              </Box>
            ),
        )}

        {/* Dialog for selecting a device */}
        <Dialog
          open={dialogDeviceOpen}
          onClose={handleDialogDeviceToggle}
          PaperProps={{
            sx: {
              maxHeight: '50vh', // Set the maximum height to 50% of the viewport height
              maxWidth: '50vw', // Set the maximum width to 50% of the viewport width
              overflow: 'auto', // Allow scrolling for overflowing content
            },
          }}
        >
          <DialogTitle>Select a device</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Typography variant='subtitle1' sx={{ whiteSpace: 'nowrap' }}>
                Filter by:
              </Typography>
              <TextField fullWidth variant='outlined' value={filter} onChange={handleFilterChange} placeholder='Enter serial or name' />
            </Box>
            <List dense>
              {selectDevices
                .filter((v) => v.serial.toLowerCase().includes(filter.toLowerCase()) || v.name.toLowerCase().includes(filter.toLowerCase()))
                .map((value, index) => (
                  <ListItemButton onClick={() => handleSelectDeviceValue(value)} key={index} sx={listItemButtonSx}>
                    {value.icon === 'wifi' && (
                      <ListItemIcon>
                        <WifiIcon style={listItemIconStyle} />
                      </ListItemIcon>
                    )}
                    {value.icon === 'ble' && (
                      <ListItemIcon>
                        <BluetoothIcon style={listItemIconStyle} />
                      </ListItemIcon>
                    )}
                    {value.icon === 'hub' && (
                      <ListItemIcon>
                        <HubIcon style={listItemIconStyle} />
                      </ListItemIcon>
                    )}
                    <ListItemText primary={value.name} secondary={value.serial} primaryTypographyProps={{ style: listItemTextPrimaryStyle }} secondaryTypographyProps={{ style: listItemTextSecondaryStyle }} />
                  </ListItemButton>
                ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogDeviceToggle}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  function SubmitButton(props: SubmitButtonProps) {
    const { uiSchema } = props;
    if (rjsfDebug) console.log('SubmitButton:', props);
    const { submitText, norender } = getSubmitButtonOptions(uiSchema);
    if (norender) {
      return null;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', margin: '10px', padding: '0px', gap: '20px' }}>
        <Button type='submit' variant='contained' color='primary'>
          {submitText}
        </Button>
        <Button variant='contained' color='primary' onClick={onClose}>
          Cancel
        </Button>
      </div>
    );
  }

  function RemoveButton(props: IconButtonProps) {
    const { className, disabled, onClick, registry, style, uiSchema, ...otherProps } = props;
    if (rjsfDebug) console.log('RemoveButton:', otherProps);
    return (
      <Tooltip title='Remove the item'>
        <IconButton disabled={disabled} size='small' color='primary' onClick={onClick}>
          <DeleteForever />
        </IconButton>
      </Tooltip>
    );
  }

  function AddButton(props: IconButtonProps) {
    const { className, disabled, onClick, registry, uiSchema, ...otherProps } = props;
    if (rjsfDebug) console.log('AddButton:', otherProps);
    return (
      <Tooltip title='Add an item'>
        <IconButton size='small' color='primary' onClick={onClick}>
          <Add />
        </IconButton>
      </Tooltip>
    );
  }

  function MoveUpButton(props: IconButtonProps) {
    const { disabled, onClick, registry, style, uiSchema, ...otherProps } = props;
    if (rjsfDebug) console.log('MoveUpButton:', otherProps);
    return (
      <Tooltip title='Move up the item'>
        <IconButton size='small' color='primary' onClick={onClick}>
          <KeyboardDoubleArrowUpIcon />
        </IconButton>
      </Tooltip>
    );
  }

  function MoveDownButton(props: IconButtonProps) {
    const { disabled, onClick, registry, style, uiSchema, ...otherProps } = props;
    if (rjsfDebug) console.log('MoveDownButton:', otherProps);
    return (
      <Tooltip title='Move down the item'>
        <IconButton size='small' color='primary' onClick={onClick}>
          <KeyboardDoubleArrowDownIcon />
        </IconButton>
      </Tooltip>
    );
  }

  function CheckboxWidget(props: WidgetProps) {
    const { id, name, value, schema, readonly, onChange } = props;
    if (rjsfDebug) console.log(`CheckboxWidget ${name}:`, props);
    if (rjsfDebug) console.log(`CheckboxWidget formData:`, currentFormData);

    const [fieldValue, setFieldValue] = useState<string>();

    const onChangeField = (value: string) => {
      if (debug) console.log(`CheckboxWidget ${name} onChangeField:`, value);
      setFieldValue(value && value !== '' ? value : undefined);
    };

    const onClick = () => {
      if (debug) console.log(`CheckboxWidget onClick plugin="${plugin.name}" action="${name}" value="${fieldValue}"`);
      sendMessage({ id: uniqueId.current, sender: 'ConfigPlugin', method: '/api/action', src: 'Frontend', dst: 'Matterbridge', params: { plugin: plugin.name, action: name, value: fieldValue, formData: currentFormData, id } });
      if (schema.buttonClose === true) onClose();
      else if (schema.buttonSave === true) handleSaveChanges({ formData } as any); // Save changes and we don't close (no need for other props).
    };

    if (schema.buttonText && schema.description) {
      return (
        <Box sx={{ margin: '0px', padding: '10px', border: '1px solid grey', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={descriptionSx}>{schema.description}</Typography>
          <Button variant='contained' color='primary' onClick={() => onClick()}>
            {schema.buttonText}
          </Button>
        </Box>
      );
    } else if (schema.buttonField && schema.description) {
      return (
        <Box sx={{ margin: '0px', padding: '10px', gap: '20px', border: '1px solid grey', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={descriptionSx}>{schema.description}</Typography>
          <TextField id={name + '-input'} name={name} label={schema.textLabel} placeholder={schema.textPlaceholder} onChange={(event) => onChangeField(event.target.value)} sx={{ width: '250px', minWidth: '250px', maxWidth: '250px' }} />
          <Button id={name + '-button'} variant='contained' color='primary' disabled={fieldValue === undefined} onClick={() => onClick()}>
            {schema.buttonField}
          </Button>
        </Box>
      );
    }
    return (
      <Box sx={{ margin: '0px', padding: '0px' }}>
        {name && (
          <Box sx={{ margin: '0px', padding: '0px', gap: '10px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
            <Typography sx={titleSx}>{schema.title || name}</Typography>
            <Checkbox checked={value} readOnly={readonly} onChange={() => onChange(!value)} sx={{ padding: '0px', margin: '0px' }} />
          </Box>
        )}
        {schema.description && <Typography sx={descriptionSx}>{schema.description}</Typography>}
      </Box>
    );
  }

  function SelectWidget({
    schema,
    id,
    name, // remove this from textFieldProps
    options,
    label,
    hideLabel,
    required,
    disabled,
    placeholder,
    readonly,
    value,
    multiple,
    autofocus,
    onChange,
    onBlur,
    onFocus,
    errorSchema,
    rawErrors = [],
    registry,
    uiSchema,
    hideError,
    formContext,
    ...textFieldProps
  }: WidgetProps) {
    const { enumOptions, enumDisabled, emptyValue: optEmptyVal } = options;

    multiple = typeof multiple === 'undefined' ? false : !!multiple;

    const emptyValue = multiple ? [] : '';
    const isEmpty = typeof value === 'undefined' || (multiple && value.length < 1) || (!multiple && value === emptyValue);

    const _onChange = ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => onChange(enumOptionsValueForIndex(value, enumOptions, optEmptyVal));
    const _onBlur = ({ target }: React.FocusEvent<HTMLInputElement>) => onBlur(id, enumOptionsValueForIndex(target && target.value, enumOptions, optEmptyVal));
    const _onFocus = ({ target }: React.FocusEvent<HTMLInputElement>) => onFocus(id, enumOptionsValueForIndex(target && target.value, enumOptions, optEmptyVal));
    const selectedIndexes = enumOptionsIndexForValue(value, enumOptions, multiple);
    const { InputLabelProps, SelectProps, autocomplete, ...textFieldRemainingProps } = textFieldProps;
    const showPlaceholderOption = !multiple && schema.default === undefined;

    return (
      <TextField
        id={id}
        name={id}
        // label={labelValue(label || undefined, hideLabel, undefined)}
        value={!isEmpty && typeof selectedIndexes !== 'undefined' ? selectedIndexes : emptyValue}
        required={required}
        disabled={disabled || readonly}
        autoFocus={autofocus}
        autoComplete={autocomplete}
        placeholder={placeholder}
        error={rawErrors.length > 0}
        onChange={_onChange}
        onBlur={_onBlur}
        onFocus={_onFocus}
        {...(textFieldRemainingProps as TextFieldProps)}
        select // Apply this and the following props after the potential overrides defined in textFieldProps
        InputLabelProps={{
          ...InputLabelProps,
          shrink: !isEmpty,
        }}
        SelectProps={{
          ...SelectProps,
          multiple,
        }}
        aria-describedby={ariaDescribedByIds(id)}
      >
        {showPlaceholderOption && <MenuItem value=''>{placeholder}</MenuItem>}
        {Array.isArray(enumOptions) &&
          enumOptions.map(({ value, label }, i) => {
            const disabled = Array.isArray(enumDisabled) && enumDisabled.indexOf(value) !== -1;
            return (
              <MenuItem key={i} value={String(i)} disabled={disabled}>
                {label}
              </MenuItem>
            );
          })}
      </TextField>
    );
  }

  if (debug) console.log('ConfigPluginDialog rendering...');
  if (!open || !schema || !formData) return null;
  return (
    <Dialog open={open} onClose={onClose} slotProps={{ paper: { sx: { maxWidth: '800px' } } }}>
      <DialogTitle gap={'20px'}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
          <img src='matterbridge.svg' alt='Matterbridge Logo' style={{ height: '32px', width: '32px' }} />
          <h3>Matterbridge plugin configuration</h3>
        </div>
      </DialogTitle>
      <DialogContent style={{ padding: '0px', margin: '0px', width: '800px', height: '600px', overflow: 'auto' }}>
        <Form
          schema={schema}
          formData={formData}
          uiSchema={uiSchema}
          validator={validator}
          templates={{
            FieldTemplate,
            BaseInputTemplate,
            TitleFieldTemplate,
            DescriptionFieldTemplate,
            FieldHelpTemplate,
            FieldErrorTemplate,
            ErrorListTemplate,
            WrapIfAdditionalTemplate,
            ArrayFieldTitleTemplate,
            ArrayFieldDescriptionTemplate,
            ArrayFieldItemTemplate,
            ArrayFieldTemplate,
            ObjectFieldTemplate,
            ButtonTemplates: { SubmitButton, RemoveButton, AddButton, MoveUpButton, MoveDownButton },
          }}
          widgets={{ CheckboxWidget, SelectWidget }}
          onChange={handleFormChange}
          onSubmit={handleSaveChanges}
        />
      </DialogContent>
    </Dialog>
  );
};
