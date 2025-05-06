/* eslint-disable no-unused-vars */
/* eslint-disable no-console */

// React
import React, { useContext, useEffect, useState, useRef } from 'react';

// @mui/material
import { Box, Button, Paper, Typography, Dialog, DialogContent, DialogTitle, Tooltip, Checkbox, MenuItem, IconButton, List, ListItem, ListItemText, ListItemIcon, TextField, ListItemButton, DialogActions } from '@mui/material';

// @mui/icons-material
import DeleteForever from '@mui/icons-material/DeleteForever'; // For RemoveButton
import Add from '@mui/icons-material/Add'; // For AddButton
import ListIcon from '@mui/icons-material/List';
import WifiIcon from '@mui/icons-material/Wifi'; // For selectDevice icon=wifi
import BluetoothIcon from '@mui/icons-material/Bluetooth'; // For selectDevice icon=ble
import HubIcon from '@mui/icons-material/Hub';  // For selectDevice icon=hub
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';  // For ErrorListTemplate
import ViewInArIcon from '@mui/icons-material/ViewInAr'; // For entities icon=component
import DeviceHubIcon from '@mui/icons-material/DeviceHub'; // For entities icon=matter

// @rjsf
import Form from '@rjsf/core'; 
import validator from '@rjsf/validator-ajv8';
import { getSubmitButtonOptions, getUiOptions, getTemplate, enumOptionsValueForIndex, ariaDescribedByIds, enumOptionsIndexForValue, labelValue, ADDITIONAL_PROPERTY_FLAG } from '@rjsf/utils';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { sendCommandToMatterbridge } from './sendApiCommand';
// import { debug } from '../App';
const debug = false;
const rjsfDebug = false;

const titleSx = { fontSize: '16px', fontWeight: 'bold', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)' };
const descriptionSx = { fontSize: '12px', fontWeight: 'normal', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)' };
const helpSx = { fontSize: '14px', fontWeight: 'normal', color: 'var(--secondary-color)', backgroundColor: 'var(--div-bg-color)' };
const errorTitleSx = { fontSize: '16px', fontWeight: 'bold', backgroundColor: 'var(--div-bg-color)' };
const iconButtonSx = { padding: '0px', margin: '0px' };
const boxPadding = '5px 10px 5px 10px';
const listItemButtonSx = { /* padding: '0px', margin: '0px', backgroundColor: 'var(--div-bg-color)', '&:hover': { backgroundColor: 'var(--div-bg-color)' }*/ };
const listItemIconStyle = { /* color: 'var(--div-text-color)'*/ };
const listItemTextPrimaryStyle = { /* fontSize: '16px', fontWeight: 'bold', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)' */ };
const listItemTextSecondaryStyle = { /* fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)' */ };
let selectDevices = [];
let selectEntities = [];

export const ConfigPluginDialog = ({ open, onClose, plugin }) => {
  // Contexts
  const { sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);

  // Refs
  const uniqueId = useRef(getUniqueId());

  // States
  const [formData, setFormData] = useState(plugin.configJson);
  const [schema, setSchema] = useState(plugin.schemaJson);
  const [uiSchema, setUiSchema] = useState(
    {
      "ui:submitButtonOptions": {
        "submitText": "Confirm",
      },
      "ui:globalOptions": { orderable: true },
    }
  );

  // const [selectDevices, setSelectDevices] = useState([]);
  // const [selectEntities, setSelectEntities] = useState([]);
  const [newkey, setNewkey] = useState(''); // For ObjectFieldTemplate select from device list 
  let currentFormData = {}

  // WebSocket message handler effect
  useEffect(() => {
    const handleWebSocketMessage = (msg) => {
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        // Local messages
        if (msg.id === uniqueId.current && msg.method === '/api/select/devices') {
          if (msg.response) {
            if (debug) console.log(`ConfigPluginDialog (id: ${msg.id}) received ${msg.response.length} /api/select/devices:`, msg.response);
            selectDevices = msg.response;
          }
          if (msg.error) {
            console.error('ConfigPluginDialog received /api/select/devices error:', msg.error);
          }
        }
        if (msg.id === uniqueId.current && msg.method === '/api/select/entities') {
          if (msg.response) {
            if (debug) console.log(`ConfigPluginDialog (id: ${msg.id}) received ${msg.response.length} /api/select/entities:`, msg.response);
            selectEntities = msg.response;
          }
          if (msg.error) {
            console.error('ConfigPluginDialog received /api/select/entities error:', msg.error);
          }
        }
      }
    };

    addListener(handleWebSocketMessage);
    if(debug) console.log('ConfigPluginDialog added WebSocket listener id:', uniqueId.current);

    // Move the ui: properties from the schema to the uiSchema
    if(formData !== undefined && schema !== undefined) {
      if(rjsfDebug) console.log('ConfigPluginDialog moveToUiSchema:', schema, uiSchema);
      Object.keys(schema.properties).forEach((key) => {
        Object.keys(schema.properties[key]).forEach((subkey) => {
          if (subkey.startsWith('ui:')) {
            if(rjsfDebug) console.log('ConfigPluginDialog moveToUiSchema:', key, subkey, schema.properties[key][subkey]);
            uiSchema[key] = {};
            uiSchema[key][subkey] = schema.properties[key][subkey];
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete schema.properties[key][subkey];
          }
        });
      });
      setUiSchema(uiSchema);
      if(rjsfDebug) console.log('ConfigPluginDialog moveToUiSchema:', schema, uiSchema);
    }

    // Send the select devices and entities messages
    if(plugin.name !== undefined && plugin.configJson !== undefined && plugin.schemaJson !== undefined) {
      setFormData(plugin.configJson);
      setSchema(plugin.schemaJson);
      sendMessage({ id: uniqueId.current, sender: 'ConfigPlugin', method: "/api/select/devices", src: "Frontend", dst: "Matterbridge", params: { plugin: plugin.name } });
      sendMessage({ id: uniqueId.current, sender: 'ConfigPlugin', method: "/api/select/entities", src: "Frontend", dst: "Matterbridge", params: { plugin: plugin.name } });
      if(debug) console.log('HomePlugins sent "/api/select/devices" and "/api/select/entities" for plugin:', plugin.name);
    }

    return () => {
      removeListener(handleWebSocketMessage);
      if(debug) console.log('ConfigPluginDialog removed WebSocket listener');
    };
  }, [addListener, formData, plugin, removeListener, schema, sendMessage, uiSchema]);
  
  const handleFormChange = ({ formData }) => {
    currentFormData = formData;
    if(rjsfDebug) console.log('handleFormChange formData:', formData);
  };

  const handleSaveChanges = ({ formData }) => {
    if(debug) console.log('ConfigPluginDialog handleSaveChanges:', formData);
    // Save the configuration
    setFormData(formData);
    plugin.configJson = formData;
    plugin.restartRequired = true;
    sendMessage({ id: uniqueId.current, sender: 'ConfigPlugin', method: "/api/savepluginconfig", src: "Frontend", dst: "Matterbridge", params: { pluginName: formData.name, formData } });
    // Close the dialog
    onClose();
  };
  
  function WrapIfAdditionalTemplate(props) {
    const { id, label, onKeyChange, onDropPropertyClick, disabled, schema, children, registry, readonly, required } = props;
    const { templates } = registry;
    const { RemoveButton } = templates.ButtonTemplates;
    if(rjsfDebug) console.log('WrapIfAdditionalTemplate:', props);
    const additional = ADDITIONAL_PROPERTY_FLAG in schema;
  
    if (!additional) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, padding: rjsfDebug ? '2px' : 0, margin: rjsfDebug ? '2px' : 0, border: rjsfDebug ? '2px solid magenta' : 'none' }}>
          {children}
        </Box>
      );
    }
    const handleBlur = ({ target }) => onKeyChange(target && target.value);
    return (
      <Box sx={{ display: 'flex', flexDirection: 'row', flexGrow: 1, padding: rjsfDebug ? '2px' : 0, margin: rjsfDebug ? '2px' : 0, border: rjsfDebug ? '2px solid magenta' : 'none' }}>
        <TextField id={`${id}-key`} name={`${id}-key`} required={required} disabled={disabled || readonly} defaultValue={label}
          onBlur={!readonly ? handleBlur : undefined} type='text' variant="outlined" sx={{ width: '250px', minWidth: '250px', maxWidth: '250px', marginRight: '20px' }}/>
        <Box sx={{ flex: 1 }}>
          {children}
        </Box>
        <RemoveButton disabled={disabled || readonly} onClick={onDropPropertyClick(label)} />
      </Box>
    );
  }
  
  function FieldTemplate(props) {
    const { children, description, displayLabel, errors, help, hidden, id, label, 
      registry, uiSchema } = props;
    const uiOptions = getUiOptions(uiSchema);
    const WrapIfAdditionalTemplate = getTemplate('WrapIfAdditionalTemplate', registry, uiOptions);
    // const rjsfDebug = true;
    if(rjsfDebug) console.log('FieldTemplate:', props, 'WrapIfAdditionalTemplate:', WrapIfAdditionalTemplate !== undefined);
    if (hidden) {
      return <div style={{ display: 'none' }}>{children}</div>;
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, padding: rjsfDebug ? '2px' : 0, margin: rjsfDebug ? '2px' : 0, border: rjsfDebug ? '2px solid cyan' : 'none' }}>
        <WrapIfAdditionalTemplate {...props}>
          {/* displayLabel===true && !isArray && <Typography sx={titleSx}>id: {id} label: {label} {required && <mark>***</mark>}</Typography> */}
          {displayLabel===true && description}
          {children}
          {errors}
          {help}
        </WrapIfAdditionalTemplate>
      </Box>
    );
  }
  
  function DescriptionFieldTemplate(props) {
    const { description } = props;
    if(rjsfDebug) console.log('DescriptionFieldTemplate:', props);
    if (!description) return null;
    return (
      <Typography sx={descriptionSx}>{/* id: {id} desc: */}{description}</Typography>
    );
  }
  
  function TitleFieldTemplate(props) {
    const { required, title } = props;
    if(rjsfDebug) console.log('TitleFieldTemplate:', props);
    if (!title) return null;
    return (
      <Box sx={{ padding: '0px', margin: '0px', marginTop: '5px' }}>
        <Typography sx={titleSx}>{/* id: {id} title: */}Title {title} {required && <mark>***</mark>}</Typography>
      </Box>
    );
  }
  
  function FieldHelpTemplate(props) {
    const { help, idSchema } = props;
    if(rjsfDebug) console.log('FieldHelpTemplate:', props);
    if (!help) return null;
    return (
      <Box sx={{ padding: '0px', margin: '0px', marginTop: '5px' }}>
        <Typography sx={helpSx}>{/* id: {id} help: */}{help}</Typography>
      </Box>
    );
  }
  
  // Shows a list of errors at the top of the form
  function ErrorListTemplate(props) {
    const { errors } = props;
    if(rjsfDebug) console.log('ErrorListTemplate:', props);
    if (!errors) return null;
    return (
      <Box sx={{ padding: '10px', margin: '10px', border: '1px solid grey' }}>
        <Typography color='error' sx={errorTitleSx}>Please fix the following errors:</Typography>
        <List>
          {errors.map((error, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                <ErrorOutlineIcon color="error" />
              </ListItemIcon>
              <ListItemText primary={error.stack} />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };
  
  // Shows the field error at the bottom of the field
  function FieldErrorTemplate(props) {
    const { errors } = props;
    if(rjsfDebug) console.log('FieldErrorTemplate:', props);
    if (!errors) return null;
    return (
      <Box sx={{ padding: '0px', margin: '0px', marginTop: '5px' }}>
        {errors.map((error, index) => (
          <Typography key={index} color="error" variant="body2" sx={{ marginLeft: 1 }}>
            This field {error}
          </Typography>
        ))}
      </Box>
    );
  };
  
  function BaseInputTemplate(props) {
    const { id, name, schema, uiSchema, value, options, label, type, placeholder, required, disabled, readonly, autofocus, 
      onChange, onChangeOverride, onBlur, onFocus, rawErrors, hideError, registry, formContext } = props;
    if(rjsfDebug) console.log('BaseInputTemplate:', props);
    const _onChange = ({ target: { value } }) => onChange(value === '' ? options.emptyValue : value);
    const _onBlur = ({ target }) => onBlur(id, target && target.value);
    const _onFocus = ({ target }) => onFocus(id, target && target.value);
    return (
      <Box sx={{ padding: '0px', margin: '0px' }}>
        <TextField id={id} name={id} label={placeholder && placeholder!=='' ? label : undefined } variant="outlined" placeholder={placeholder && placeholder!=='' ? placeholder : label} 
          required={required} disabled={disabled || readonly} autoFocus={autofocus} value={value || value === 0 ? value : ''} type={type} autoComplete={type==='password' ? 'current-password' : name}
          onChange={onChangeOverride || _onChange} onBlur={_onBlur} onFocus={_onFocus} fullWidth/>
      </Box>
    );
  }
  
  function ArrayFieldTitleTemplate(props) {
    console.log('ArrayFieldTitleTemplate:', props);
    return null;
  }
  
  function ArrayFieldDescriptionTemplate(props) {
    console.log('ArrayFieldDescriptionTemplate:', props);
    return null;
  }
  
  function ArrayFieldItemTemplate(props) {
    console.log('ArrayFieldItemTemplate:', props);
    return null;
  }
  
  function ArrayFieldTemplate(props) {
    const { canAdd, className, disabled, formContext, formData, idSchema, items, onAddClick, rawErrors, readonly, registry, required, schema, title, uiSchema } = props;
    if(rjsfDebug) console.log(`ArrayFieldTemplate for ${title}:`, props);
  
    const [dialogDeviceOpen, setDialogDeviceOpen] = useState(false);
    const [dialogEntityOpen, setDialogEntityOpen] = useState(false);
    const [dialogDeviceEntityOpen, setDialogDeviceEntityOpen] = useState(false);
    const [filter, setFilter] = useState('');
  
    const handleFilterChange = (event) => {
      setFilter(event.target.value);
    };
  
    const handleDialogDeviceToggle = () => {
      if(debug) console.log('ArrayFieldTemplate: handleDialogDeviceToggle filter:', filter, 'selectDevices:', selectDevices);
      setDialogDeviceOpen(!dialogDeviceOpen);
    };
  
    const handleDialogEntityToggle = () => {
      if(debug) console.log('ArrayFieldTemplate: handleDialogEntityToggle filter:', filter, 'selectEntities:', selectEntities);
      setDialogEntityOpen(!dialogEntityOpen);
    };
  
    const handleDialogDeviceEntityToggle = () => {
      if(debug) console.log('ArrayFieldTemplate: handleDialogDeviceEntityToggle filter:', filter, 'selectDevices:', selectDevices);
      setDialogDeviceEntityOpen(!dialogDeviceEntityOpen);
    };
  
    const handleSelectDeviceValue = (value) => {
      // console.log('ArrayFieldTemplate: handleSelectValue', value);
      setDialogDeviceOpen(false);
      // Trigger onAddClick to add the selected new item
      if (schema.selectFrom === 'serial')
        schema.items.default = value.serial;
      else if (schema.selectFrom === 'name')
        schema.items.default = value.name;
      onAddClick();
    };
  
    const handleSelectEntityValue = (value) => {
      // console.log('ArrayFieldTemplate: handleSelectEntityValue', value);
      setDialogEntityOpen(false);
      // Trigger onAddClick to add the selected new item
      if (schema.selectEntityFrom === 'name')
        schema.items.default = value.name;
      else if (schema.selectEntityFrom === 'description')
        schema.items.default = value.description;
      onAddClick();
    }
  
    const handleSelectDeviceEntityValue = (value) => {
      // console.log('ArrayFieldTemplate: handleSelectEntityValue', value);
      setDialogDeviceEntityOpen(false);
      // Trigger onAddClick to add the selected new item
      if (schema.selectDeviceEntityFrom === 'name')
        schema.items.default = value.name;
      else if (schema.selectDeviceEntityFrom === 'description')
        schema.items.default = value.description;
      onAddClick();
    }
  
    // const rjsfDebug = true;
  
    return (
      <Box sx={{ margin: '0px', padding: '5px 10px 5px 10px', border: rjsfDebug ? '2px solid yellow':'1px solid grey' }}>
        {title && (
          <Box sx={{ margin: '0px', padding: '0px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {title && (
              <Typography sx={titleSx}>{title}</Typography>
            )}
            {canAdd && (
              <Box sx={{ margin: '0px', padding: '0px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {schema.selectFrom &&
                  <Tooltip title="Add a device from the list">
                    <IconButton onClick={handleDialogDeviceToggle} size="small" color="primary" sx={iconButtonSx}>
                      <ListIcon />
                    </IconButton>
                  </Tooltip>
                }
                {schema.selectEntityFrom &&
                  <Tooltip title="Add an entity from the list">
                    <IconButton onClick={handleDialogEntityToggle} size="small" color="primary" sx={iconButtonSx}>
                      <ListIcon />
                    </IconButton>
                  </Tooltip>
                }
                {schema.selectDeviceEntityFrom &&
                  <Tooltip title="Add a device entity from the list">
                    <IconButton onClick={handleDialogDeviceEntityToggle} size="small" color="primary" sx={iconButtonSx}>
                      <ListIcon />
                    </IconButton>
                  </Tooltip>
                }
                <Tooltip title="Add a new item">
                  <IconButton onClick={onAddClick} size="small" color="primary" sx={iconButtonSx}>
                    <Add />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
        )}
        {schema.description && (
          <Typography sx={descriptionSx}>{schema.description}</Typography>
        )}
        {props.items.map((element) => (
          <Box key={element.index} sx={{ margin: '2px 0px', padding: '0px', display: 'flex', alignItems: 'center' }}>
            <Box sx={{ flexGrow: 1, marginRight: '10px' }}>
              {element.children}
            </Box>
            <IconButton disabled={!element.hasMoveUp} onClick={element.onReorderClick(element.index, element.index - 1)} size="small" color="primary" sx={iconButtonSx}>
              <KeyboardDoubleArrowUpIcon />
            </IconButton>
            <IconButton disabled={!element.hasMoveDown} onClick={element.onReorderClick(element.index, element.index + 1)} size="small" color="primary" sx={iconButtonSx}>
              <KeyboardDoubleArrowDownIcon />
            </IconButton>
            <IconButton onClick={element.onDropIndexClick(element.index)} size="small" color="primary" sx={iconButtonSx}>
              <DeleteForever />
            </IconButton>
          </Box>
        ))}
  
        {/* Dialog for selecting a device */}
        <Dialog open={dialogDeviceOpen} onClose={handleDialogDeviceToggle} PaperProps={{
          sx: {
            maxHeight: '50vh', // Set the maximum height to 50% of the viewport height
            maxWidth: '50vw', // Set the maximum width to 50% of the viewport width
            overflow: 'auto',  // Allow scrolling for overflowing content
          },
        }}>
          <DialogTitle>Select a device</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Typography variant="subtitle1" sx={{ whiteSpace: 'nowrap' }}>Filter by:</Typography>
              <TextField
                fullWidth
                variant="outlined"
                value={filter}
                onChange={handleFilterChange}
                placeholder="Enter serial or name"
              />
            </Box>
            <List dense>
              {selectDevices.filter((v) => v.serial.toLowerCase().includes(filter.toLowerCase()) || v.name.toLowerCase().includes(filter.toLowerCase())).map((value, index) => (
                <ListItemButton onClick={() => handleSelectDeviceValue(value)} key={index} sx={listItemButtonSx}>
                  {value.icon === 'wifi' && <ListItemIcon><WifiIcon style={listItemIconStyle}/></ListItemIcon>}
                  {value.icon === 'ble' && <ListItemIcon><BluetoothIcon style={listItemIconStyle} /></ListItemIcon>}
                  {value.icon === 'hub' && <ListItemIcon><HubIcon style={listItemIconStyle} /></ListItemIcon>}
                  <ListItemText primary={value.name} secondary={value.serial} primaryTypographyProps={{ style: listItemTextPrimaryStyle }} secondaryTypographyProps={{ style: listItemTextSecondaryStyle }}/>
                </ListItemButton>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogDeviceToggle}>Close</Button>
          </DialogActions>
        </Dialog>
  
        {/* Dialog for selecting an entity */}
        <Dialog open={dialogEntityOpen} onClose={handleDialogEntityToggle} PaperProps={{
          sx: {
            maxHeight: '50vh', // Set the maximum height to 50% of the viewport height
            maxWidth: '50vw', // Set the maximum width to 50% of the viewport width
            overflow: 'auto',  // Allow scrolling for overflowing content
          },
        }}>
          <DialogTitle>Select an entity</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Typography variant="subtitle1" sx={{ whiteSpace: 'nowrap' }}>Filter by:</Typography>
              <TextField
                fullWidth
                variant="outlined"
                value={filter}
                onChange={handleFilterChange}
                placeholder="Enter name or description"
              />
            </Box>
            <List dense>
              {selectEntities.filter((v) => v.name.toLowerCase().includes(filter.toLowerCase()) || v.description.toLowerCase().includes(filter.toLowerCase())).map((value, index) => (
                <ListItemButton onClick={() => handleSelectEntityValue(value)} key={index} sx={listItemButtonSx}>
                  {value.icon === 'wifi' && <ListItemIcon><WifiIcon style={listItemIconStyle} /></ListItemIcon>}
                  {value.icon === 'ble' && <ListItemIcon><BluetoothIcon style={listItemIconStyle} /></ListItemIcon>}
                  {value.icon === 'hub' && <ListItemIcon><HubIcon style={listItemIconStyle} /></ListItemIcon>}
                  {value.icon === 'component' && <ListItemIcon><ViewInArIcon style={listItemIconStyle} /></ListItemIcon>}
                  {value.icon === 'matter' && <ListItemIcon><DeviceHubIcon style={listItemIconStyle} /></ListItemIcon>}
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
        <Dialog open={dialogDeviceEntityOpen} onClose={handleDialogDeviceEntityToggle} PaperProps={{
          sx: {
            maxHeight: '50vh', // Set the maximum height to 50% of the viewport height
            maxWidth: '50vw', // Set the maximum width to 50% of the viewport width
            overflow: 'auto',  // Allow scrolling for overflowing content
          },
        }}>
          <DialogTitle>Select an entity for {title}</DialogTitle>
          <DialogContent>
            <List dense>
              {selectDevices.filter((d) => d.serial === title || d.name === title).map((value) => {
                // console.log('ArrayFieldTemplate: handleSelectDeviceEntityValue value:', value, value.entities);
                // console.log('ArrayFieldTemplate: handleSelectDeviceEntityValue schema:', schema);
                return value.entities?.map((entity, index) => (
                  <ListItemButton onClick={() => handleSelectDeviceEntityValue(entity)} key={index} sx={listItemButtonSx}>
                    {entity.icon === 'wifi' && <ListItemIcon><WifiIcon style={listItemIconStyle} /></ListItemIcon>}
                    {entity.icon === 'ble' && <ListItemIcon><BluetoothIcon style={listItemIconStyle} /></ListItemIcon>}
                    {entity.icon === 'hub' && <ListItemIcon><HubIcon style={listItemIconStyle} /></ListItemIcon>}
                    {entity.icon === 'component' && <ListItemIcon><ViewInArIcon style={listItemIconStyle} /></ListItemIcon>}
                    {entity.icon === 'matter' && <ListItemIcon><DeviceHubIcon style={listItemIconStyle} /></ListItemIcon>}
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
  
  function ObjectFieldTemplate(props) {
    const { onAddClick, schema, properties, title, description } = props;
  
    const [dialogDeviceOpen, setDialogDeviceOpen] = useState(false);
    const [filter, setFilter] = useState('');
    
    const handleFilterChange = (event) => {
      setFilter(event.target.value);
    };

    const handleDialogDeviceToggle = () => {
      setDialogDeviceOpen(!dialogDeviceOpen);
    };
  
    const handleSelectDeviceValue = (value) => {
      if(debug) console.log(`ObjectFieldTemplate: handleSelectValue value "${value.serial}" for schema "${schema.selectFrom}"`);
      setDialogDeviceOpen(false);
      let newkey = '';
      if (schema.selectFrom === 'serial')
        newkey = value.serial;
      else if (schema.selectFrom === 'name')
        newkey = value.name;
      setNewkey(newkey);
      if(debug) console.log(`ObjectFieldTemplate: handleSelectValue newkey "${newkey}"`);
  
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
    if(rjsfDebug) console.log('ObjectFieldTemplate: title', title, 'description', description, 'schema', schema, 'isRoot', isRoot, 'props', props);
  
    // If this is not the root object and newkey is not empty, then set the new key with the selected value
    if(debug)  console.log(`ObjectFieldTemplate: isRoot ${isRoot} newkey "${newkey}"`);
    if (!isRoot && newkey !== '') {
      if(debug) console.log('ObjectFieldTemplate: newkey', newkey, 'properties', properties);
      properties.forEach((p) => {
        if (p.name === 'newKey' && p.content.key === 'newKey' && p.content.props.name === 'newKey' && p.content.props.onKeyChange && newkey !== '') {
          if(debug) console.log('ObjectFieldTemplate: newkey onKeyChange', newkey);
          const newName = newkey;
          setNewkey(''); // No enter again...
          p.content.props.onKeyChange(newName);
        }
      });
    }
  
    return (
      <Box sx={{ margin: '0px', padding: isRoot ? '10px' : '5px 10px 0px 10px', border: rjsfDebug ? '1px solid blue': isRoot ? 'none' :'1px solid grey' }}>
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
              {schema.selectFrom &&
                <Tooltip title="Add a device from the list">
                  <IconButton onClick={handleDialogDeviceToggle} size="small" color="primary" sx={iconButtonSx}>
                    <ListIcon />
                  </IconButton>
                </Tooltip>
              }
              <Tooltip title="Add a new item">
                <IconButton onClick={handleAddItem} size="small" color="primary" sx={iconButtonSx}>
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
        {properties.map(({ content, name, hidden }) => (
          !hidden && (
            <Box
              key={name}
              sx={{
                margin: '0px',
                marginBottom: '10px',
                padding: ['object', 'array', 'boolean'].includes(schema.properties[name].type) ? '0px' : boxPadding,
                border: ['object', 'array', 'boolean'].includes(schema.properties[name].type) ? 'none' : rjsfDebug ? '2px solid blue':'1px solid grey',
              }}>
              {!['object', 'array', 'boolean'].includes(schema.properties[name].type) && (
                <Typography sx={titleSx}>{name}</Typography>
              )}
              <Box sx={{ flexGrow: 1, padding: '0px', margin: '0px' }}>
                {content}
              </Box>
            </Box>
          )
        ))}
  
        {/* Dialog for selecting a device */}
        <Dialog open={dialogDeviceOpen} onClose={handleDialogDeviceToggle} PaperProps={{
          sx: {
            maxHeight: '50vh', // Set the maximum height to 50% of the viewport height
            maxWidth: '50vw', // Set the maximum width to 50% of the viewport width
            overflow: 'auto',  // Allow scrolling for overflowing content
          },
        }}>
          <DialogTitle>Select a device</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Typography variant="subtitle1" sx={{ whiteSpace: 'nowrap' }}>Filter by:</Typography>
              <TextField
                fullWidth
                variant="outlined"
                value={filter}
                onChange={handleFilterChange}
                placeholder="Enter serial or name"
              />
            </Box>
            <List dense>
              {selectDevices.filter((v) => v.serial.toLowerCase().includes(filter.toLowerCase()) || v.name.toLowerCase().includes(filter.toLowerCase())).map((value, index) => (
                <ListItemButton onClick={() => handleSelectDeviceValue(value)} key={index} sx={listItemButtonSx}>
                  {value.icon === 'wifi' && <ListItemIcon><WifiIcon style={listItemIconStyle} /></ListItemIcon>}
                  {value.icon === 'ble' && <ListItemIcon><BluetoothIcon style={listItemIconStyle} /></ListItemIcon>}
                  {value.icon === 'hub' && <ListItemIcon><HubIcon style={listItemIconStyle} /></ListItemIcon>}
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

  function SubmitButton(props) {
    const { uiSchema } = props;
    if(rjsfDebug) console.log('SubmitButton:', props);
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
  };

  function RemoveButton(props) {
    const { className, disabled, onClick, registry, style, uiSchema, ...otherProps } = props;
    if(rjsfDebug) console.log('RemoveButton:', otherProps);
    // <IconButton size='small' color='primary' {...otherProps}>
    return (
      <Tooltip title="Remove the item">
        <IconButton disabled={disabled} size='small' color='primary' onClick={onClick}>
          <DeleteForever />
        </IconButton>
      </Tooltip>
    );
  }
  
  function AddButton(props) {
    const { className, disabled, onClick, registry, uiSchema, ...otherProps } = props;
    if(rjsfDebug) console.log('AddButton:', otherProps);
    // <IconButton size='small' color='primary' {...otherProps}>
    return (
      <Tooltip title="Add an item">
        <IconButton size='small' color='primary' onClick={onClick}>
          <Add />
        </IconButton>
      </Tooltip>
    );
  }
  
  function MoveUpButton(props) {
    const { disabled, onClick, registry, style, uiSchema, ...otherProps } = props;
    if(rjsfDebug) console.log('MoveUpButton:', otherProps);
    // <IconButton size='small' color='primary' {...otherProps}>
    return (
      <Tooltip title="Move up the item">
        <IconButton size='small' color='primary' onClick={onClick}>
          <KeyboardDoubleArrowUpIcon />
        </IconButton>
      </Tooltip>
    );
  }
  
  function MoveDownButton(props) {
    const { disabled, onClick, registry, style, uiSchema, ...otherProps } = props;
    if(rjsfDebug) console.log('MoveDownButton:', otherProps);
    // <IconButton size='small' color='primary' {...otherProps}>
    return (
      <Tooltip title="Move down the item">
        <IconButton size='small' color='primary' onClick={onClick}>
          <KeyboardDoubleArrowDownIcon />
        </IconButton>
      </Tooltip>
    );
  }
    
  function CheckboxWidget(props) {
    const { id, name, value, schema, readonly, onChange } = props;
    if(rjsfDebug) console.log(`CheckboxWidget ${name}:`, props); 
    if(rjsfDebug) console.log(`CheckboxWidget formData:`, currentFormData); 

    const [fieldValue, setFieldValue] = useState(undefined);

    const onChangeField = (value) => {
      if(debug) console.log(`CheckboxWidget ${name} onChangeField:`, value);
      setFieldValue(value && value!=='' ? value : undefined);
    };

    const onClick = () => {
      if(debug) console.log(`CheckboxWidget onClick plugin="${plugin.name}" action="${name}" value="${fieldValue}"`);
      sendMessage({ id: uniqueId.current, sender: 'ConfigPlugin', method: "/api/action", src: "Frontend", dst: "Matterbridge", params: { plugin: plugin.name, action: name, value: fieldValue, formData: currentFormData, id } });
      if(schema.buttonClose===true) onClose();
      else if(schema.buttonSave===true) handleSaveChanges({formData});
    };

    if(schema.buttonText && schema.description) {
      return (
        <Box sx={{ margin: '0px', padding: '10px', border: '1px solid grey', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={descriptionSx}>{schema.description}</Typography>
          <Button variant='contained' color='primary' onClick={() => onClick()}>{schema.buttonText}</Button>
        </Box>
      );
    } else if(schema.buttonField && schema.description) {
      return (
        <Box sx={{ margin: '0px', padding: '10px', gap: '20px', border: '1px solid grey', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={descriptionSx}>{schema.description}</Typography>
          <TextField id={name+'-input'} name={name} label={schema.textLabel} placeholder={schema.textPlaceholder} onChange={(event) => onChangeField(event.target.value)} sx={{ width: '250px', minWidth: '250px', maxWidth: '250px' }}/>
          <Button id={name+'-button'} variant='contained' color='primary' disabled={fieldValue===undefined} onClick={() => onClick()}>{schema.buttonField}</Button>
        </Box>
      );
    }
    return (
      <Box sx={{ margin: '0px', padding: '5px 10px', border: '1px solid grey' }}>
        {name && (
          <Box sx={{ margin: '0px', padding: '0px', gap: '10px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
            <Typography sx={titleSx}>{name}</Typography>
            <Checkbox checked={value} readOnly={readonly} onChange={() => onChange(!value)} sx={{ padding: '0px', margin: '0px' }}/>
          </Box>
        )}
        {schema.description && (
          <Typography sx={descriptionSx}>{schema.description}</Typography>
        )}
      </Box>
    );
  };

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
  }) {
    const { enumOptions, enumDisabled, emptyValue: optEmptyVal } = options;

    multiple = typeof multiple === 'undefined' ? false : !!multiple;

    const emptyValue = multiple ? [] : '';
    const isEmpty = typeof value === 'undefined' || (multiple && value.length < 1) || (!multiple && value === emptyValue);

    const _onChange = ({ target: { value } }) =>
      onChange(enumOptionsValueForIndex(value, enumOptions, optEmptyVal));
    const _onBlur = ({ target }) =>
      onBlur(id, enumOptionsValueForIndex(target && target.value, enumOptions, optEmptyVal));
    const _onFocus = ({ target }) =>
      onFocus(id, enumOptionsValueForIndex(target && target.value, enumOptions, optEmptyVal));
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
        {...(textFieldRemainingProps)}
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

  if(debug) console.log('ConfigPluginDialog rendering...');
  if(!open || !schema || !formData) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth='800px'>
      <DialogTitle gap={'20px'}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
          <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
          <h3>Matterbridge plugin configuration</h3>
        </div>
      </DialogTitle>
      <DialogContent style={{ padding: '0px', margin: '0px', width: '800px', height: '600px', overflow: 'auto' }}>
        <Form
          schema={schema}
          formData={formData}
          uiSchema={uiSchema}
          validator={validator}
          templates={{ FieldTemplate, BaseInputTemplate, TitleFieldTemplate, DescriptionFieldTemplate, FieldHelpTemplate, FieldErrorTemplate, ErrorListTemplate, WrapIfAdditionalTemplate,
            ArrayFieldTitleTemplate, ArrayFieldDescriptionTemplate, ArrayFieldItemTemplate, ArrayFieldTemplate, ObjectFieldTemplate, ButtonTemplates: { SubmitButton, RemoveButton, AddButton, MoveUpButton, MoveDownButton } }}
          widgets={{ CheckboxWidget, SelectWidget }}
          onChange={handleFormChange}
          onSubmit={handleSaveChanges} 
        />
      </DialogContent>
    </Dialog>
  );
};


