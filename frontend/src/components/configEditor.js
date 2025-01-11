// React
import { useState, useMemo } from 'react';

// @mui/material
import IconButton from '@mui/material/IconButton';
import createTheme from '@mui/material/styles/createTheme';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import ListItemIcon from '@mui/material/ListItemIcon';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';

// @mui/icons-material
import DeleteForever from '@mui/icons-material/DeleteForever';
import Add from '@mui/icons-material/Add';
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
import { Templates } from '@rjsf/mui';

// Frontend custom components
import { getCssVariable } from './muiTheme';
import { selectDevices, selectEntities } from './Home';
import { debug } from '../App';

const { BaseInputTemplate } = Templates; 

const titleSx = { fontSize: '16px', fontWeight: 'bold', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)' };
const descriptionSx = { fontSize: '12px', fontWeight: 'normal', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)' };

export function createConfigTheme(primaryColor) {
  return createTheme({
    palette: {
      primary: {
        main: primaryColor,
      },
      action: {
        disabled: 'var(--main-label-color)',
      },
      text: {
        disabled: 'var(--main-label-color)',
      },
    },
    components: {
      MuiDialog: {
        styleOverrides: {
          paper: {
            color: 'var(--div-text-color)',
            backgroundColor: 'var(--div-bg-color)',
            border: '2px solid var(--div-border-color)',
            borderRadius: 'var(--div-border-radius)',
            boxShadow: '2px 2px 5px var(--div-shadow-color)',
          },
        },
      },
      MuiTooltip: {
        defaultProps: {
          placement: 'top-start', 
          arrow: true,
        },
        styleOverrides: {
          tooltip: {
            color: '#ffffff',       
            backgroundColor: 'var(--primary-color)', 
            fontSize: '14px',
            fontWeight: 'normal',
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: 'small',
          variant: 'outlined',
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            color: 'var(--div-text-color)',
            backgroundColor: 'var(--div-bg-color)', 
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--main-label-color)',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--main-text-color)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--primary-color)',
            },
          },
          input: {
            color: 'var(--div-text-color)',
            padding: '4px 8px', 
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: 'var(--main-label-color)', 
            '&.Mui-focused': {
              color: 'var(--primary-color)', 
            },
            '&.Mui-disabled': {
              color: 'var(--main-label-color)',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            color: 'var(--main-button-color)',
            backgroundColor: 'var(--main-button-bg-color)', 
          },
        },
        defaultProps: {
          variant: 'contained',
          size: 'small',
        },
      },
      MuiTypography: {
        fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            color: 'var(--main-label-color)', 
            '&.Mui-checked': {
              color: 'var(--primary-color)', 
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            padding: '0px',
            margin: '0px',
            '&.Mui-disabled': {
              color: 'var(--main-label-color)',
            },
          },
        },
        defaultProps: {
          size: 'small',
          color: 'primary',
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            color: 'var(--div-text-color)', 
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            margin: '0px',
            padding: '0px',
          },
        },
      },
      MuiListItemText: {
        styleOverrides: {
          root: {
            cursor: 'pointer',
            margin: '0px',
            padding: '5px',
            '&:hover': {
              backgroundColor: 'var(--main-grey-color)',
            },
          },
          primary: {
            color: 'var(--div-text-color)',
            fontSize: '16px',
            fontWeight: 'bold',
          },
          secondary: {
            color: 'var(--div-text-color)',
            fontSize: '14px',
            fontWeight: 'normal',
          },
        },
      },
      MuiBox: {
        styleOverrides: {
          root: {
            padding: '5px',
            margin: '0px',
          },
        },
      },
    },
  });
}

export function ArrayFieldTemplate(props) {
  const { canAdd, onAddClick, schema, title } = props;
  if(debug) console.log('ArrayFieldTemplate: title', title, 'description', schema.description, 'items', props.items);

  const [dialogDeviceOpen, setDialogDeviceOpen] = useState(false);
  const [dialogEntityOpen, setDialogEntityOpen] = useState(false);
  const [dialogDeviceEntityOpen, setDialogDeviceEntityOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const primaryColor = useMemo(() => getCssVariable('--primary-color', '#009a00'), []);
  const theme = useMemo(() => createConfigTheme(primaryColor), []);

  const handleFilterChange = (event) => {
    setFilter(event.target.value);
  };

  const handleDialogDeviceToggle = () => {
    setDialogDeviceOpen(!dialogDeviceOpen);
  };

  const handleDialogEntityToggle = () => {
    setDialogEntityOpen(!dialogEntityOpen);
  };

  const handleDialogDeviceEntityToggle = () => {
    setDialogDeviceEntityOpen(!dialogDeviceEntityOpen);
  };

  const handleSelectDeviceValue = (value) => {
    // console.log('ArrayFieldTemplate: handleSelectValue', value);
    setDialogDeviceOpen(false);
    // Trigger onAddClick to add the selected new item
    if(schema.selectFrom === 'serial')
      schema.items.default = value.serial;
    else if(schema.selectFrom === 'name')
      schema.items.default = value.name;
    onAddClick();
  };

  const handleSelectEntityValue = (value) => {
    // console.log('ArrayFieldTemplate: handleSelectEntityValue', value);
    setDialogEntityOpen(false);
    // Trigger onAddClick to add the selected new item
    if(schema.selectEntityFrom === 'name')
      schema.items.default = value.name;
    else if(schema.selectEntityFrom === 'description')
      schema.items.default = value.description;
    onAddClick();
  }

  const handleSelectDeviceEntityValue = (value) => {
    // console.log('ArrayFieldTemplate: handleSelectEntityValue', value);
    setDialogDeviceEntityOpen(false);
    // Trigger onAddClick to add the selected new item
    if(schema.selectDeviceEntityFrom === 'name')
      schema.items.default = value.name;
    else if(schema.selectDeviceEntityFrom === 'description')
      schema.items.default = value.description;
    onAddClick();
  }

  return (
    <Box sx={{ padding: '10px', margin: '0px', border: '1px solid grey' }}>
      {title && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0px', margin: '0px', marginBottom: '0px' }}>
          {title && (
            <Typography sx={titleSx}>{title}</Typography>
          )}
          {canAdd && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0px', margin: '0px', marginBottom: '0px' }}>
              {schema.selectFrom && 
                <Tooltip title="Add a device from the list">
                  <IconButton onClick={handleDialogDeviceToggle}>
                    <ListIcon />
                  </IconButton>
                </Tooltip>
              }
              {schema.selectEntityFrom && 
                <Tooltip title="Add an entity from the list">
                  <IconButton onClick={handleDialogEntityToggle}>
                    <ListIcon />
                  </IconButton>
                </Tooltip>
              }
              {schema.selectDeviceEntityFrom && 
                <Tooltip title="Add a device entity from the list">
                  <IconButton onClick={handleDialogDeviceEntityToggle}>
                    <ListIcon />
                  </IconButton>
                </Tooltip>
              }
              <Tooltip title="Add a new item">
                <IconButton onClick={onAddClick} size="small" color="primary">
                  <Add />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
      )}
      {schema.description && (
        <Box sx={{ padding: '0px', margin: '0px', marginBottom: '10px' }}>
          <Typography sx={descriptionSx}>{schema.description}</Typography>
        </Box>
      )}
      {props.items.map((element) => (
        <Box key={element.index} sx={{ display: 'flex', alignItems: 'center', padding: '0px', margin: '0px', marginBottom: '10px' }}>
          <Box sx={{ flexGrow: 1 }}>
            {element.children}
          </Box>
          <IconButton disabled={!element.hasMoveUp} onClick={element.onReorderClick(element.index, element.index-1)}>
            <KeyboardDoubleArrowUpIcon />
          </IconButton>
          <IconButton disabled={!element.hasMoveDown} onClick={element.onReorderClick(element.index, element.index+1)}>
            <KeyboardDoubleArrowDownIcon />
          </IconButton>
          <Tooltip title="Remove the device">
            <IconButton onClick={element.onDropIndexClick(element.index)}>
              <DeleteForever />
            </IconButton>
          </Tooltip>
        </Box>
      ))}

      <ThemeProvider theme={theme}>
        {/* Dialog for selecting a device */}
        <Dialog open={dialogDeviceOpen} onClose={handleDialogDeviceToggle} PaperProps={{
            sx: {
              maxHeight: '50vh', // Set the maximum height to 50% of the viewport height
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
              {selectDevices.filter((v) => v.serial.includes(filter) || v.name.includes(filter)).map((value, index) => (
                <ListItemButton onClick={() => handleSelectDeviceValue(value)} key={index}>
                  {value.icon==='wifi' && <ListItemIcon><WifiIcon /></ListItemIcon>}
                  {value.icon==='ble' && <ListItemIcon><BluetoothIcon /></ListItemIcon>}
                  {value.icon==='hub' && <ListItemIcon><HubIcon /></ListItemIcon>}
                  <ListItemText primary={value.serial} secondary={value.name}/>
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
              {selectEntities.filter((v) => v.name.includes(filter) || v.description.includes(filter)).map((value, index) => (
                <ListItemButton onClick={() => handleSelectEntityValue(value)} key={index}>
                  {value.icon==='wifi' && <ListItemIcon><WifiIcon /></ListItemIcon>}
                  {value.icon==='ble' && <ListItemIcon><BluetoothIcon /></ListItemIcon>}
                  {value.icon==='hub' && <ListItemIcon><HubIcon /></ListItemIcon>}
                  {value.icon==='component' && <ListItemIcon><ViewInArIcon /></ListItemIcon>}
                  {value.icon==='matter' && <ListItemIcon><DeviceHubIcon /></ListItemIcon>}
                  <ListItemText primary={value.name} secondary={value.description}/>
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
              overflow: 'auto',  // Allow scrolling for overflowing content
            },
          }}>
          <DialogTitle>Select an entity for {title}</DialogTitle>
          <DialogContent>
            <List dense>
              {selectDevices.filter((d) => d.serial === title || d.name === title).map((value, index) => {
                // console.log('ArrayFieldTemplate: handleSelectDeviceEntityValue value:', value, value.entities);
                // console.log('ArrayFieldTemplate: handleSelectDeviceEntityValue schema:', schema);
                return value.entities?.map((entity, index) => (
                  <ListItemButton onClick={() => handleSelectDeviceEntityValue(entity)} key={index}>
                    {entity.icon==='wifi' && <ListItemIcon><WifiIcon /></ListItemIcon>}
                    {entity.icon==='ble' && <ListItemIcon><BluetoothIcon /></ListItemIcon>}
                    {entity.icon==='hub' && <ListItemIcon><HubIcon /></ListItemIcon>}
                    {entity.icon==='component' && <ListItemIcon><ViewInArIcon /></ListItemIcon>}
                    {entity.icon==='matter' && <ListItemIcon><DeviceHubIcon /></ListItemIcon>}
                    <ListItemText primary={entity.name} secondary={entity.description}/>
                  </ListItemButton>
                ));
              })}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogDeviceEntityToggle}>Close</Button>
          </DialogActions>
        </Dialog>
      </ThemeProvider>

    </Box>
  );
}

export function ObjectFieldTemplate(props) {
  const { onAddClick, schema, properties, title, description, formData, registry } = props;

  const [dialogDeviceOpen, setDialogDeviceOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [newkey, setNewkey] = useState('');

  const primaryColor = useMemo(() => getCssVariable('--primary-color', '#009a00'), []);
  const theme = useMemo(() => createConfigTheme(primaryColor), []);

  const handleFilterChange = (event) => {
    setFilter(event.target.value);
  };

  const handleDialogDeviceToggle = () => {
    setDialogDeviceOpen(!dialogDeviceOpen);
  };

  const handleSelectDeviceValue = (value) => {
    setDialogDeviceOpen(false);
    let newkey = '';
    if(schema.selectFrom === 'serial')
      newkey = value.serial;
    else if(schema.selectFrom === 'name')
      newkey = value.name;
    setNewkey(newkey);
    console.log('ObjectFieldTemplate: handleSelectValue newkey:', newkey);

    // Trigger onAddClick returned function to add the selected new item
    const addProperty = onAddClick(schema);
    addProperty();
  };

  const handleAddItem = (event) => {
    // Trigger onAddClick returned function to add the selected new item
    const addProperty = onAddClick(schema);
    addProperty();
  };

  // Check if this is the entire schema or an individual object
  const isRoot = !schema.additionalProperties;
  if(debug) console.log('ObjectFieldTemplate: title', title, 'description', description, 'schema', schema, 'isRoot', isRoot);
  if(debug) console.log('ObjectFieldTemplate: props', props);

  if(!isRoot && newkey !== '') {
    console.log('ObjectFieldTemplate: newkey', newkey, 'properties', properties);
    properties.forEach((p) => {
      if(p.name==='newKey' && p.content.key==='newKey' && p.content.props.name==='newKey' && p.content.props.onKeyChange && newkey!=='') {
        const newName = newkey;
        setNewkey(''); // No enter again...
        p.content.props.onKeyChange(newName);
      }
    });
  }

  return (
    <Box sx={{ padding: '10px', margin: '0px', border: isRoot ? 'none' : '1px solid grey' }}>
      {/* Title for root */}
      {schema.title && isRoot && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0px', margin: '0px', marginBottom: '10px' }}>
          <Typography sx={titleSx}>{schema.title}</Typography>
        </Box>
      )}
      {/* Title and Add for object */}
      {title && !isRoot && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0px', margin: '0px', marginBottom: '0px' }}>
          <Typography sx={titleSx}>{title}</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0px', margin: '0px', marginBottom: '0px' }}>
            {schema.selectFrom && 
              <Tooltip title="Add a device from the list">
                <IconButton onClick={handleDialogDeviceToggle}>
                  <ListIcon />
                </IconButton>
              </Tooltip>
            }
            <Tooltip title="Add a new item">
              <IconButton onClick={handleAddItem} size="small" color="primary">
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
      {properties.map(({ content, name, disabled, readonly, hidden }) => (
        <Box 
          key={name} 
          sx={{ 
            padding: ['object', 'array', 'boolean'].includes(schema.properties[name].type) ? '0px' : '10px', 
            margin: '0px', 
            marginBottom: '10px', 
            border: ['object', 'array', 'boolean'].includes(schema.properties[name].type) ? 'none' : '1px solid grey' 
          }}>
          {!['object', 'array', 'boolean'].includes(schema.properties[name].type) && (
            <Box sx={{ padding: '0px', margin: '0px', marginBottom: '10px' }}>
              <Typography sx={titleSx}>{name}</Typography>
            </Box>
          )}  
          <Box sx={{ flexGrow: 1, padding: '0px', margin: '0px', marginBottom: '0px' }}>
            {content}
          </Box>
        </Box>
      ))}

      <ThemeProvider theme={theme}>
        {/* Dialog for selecting a device */}
        <Dialog open={dialogDeviceOpen} onClose={handleDialogDeviceToggle} PaperProps={{
            sx: {
              maxHeight: '50vh', // Set the maximum height to 50% of the viewport height
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
              {selectDevices.filter((v) => v.serial.includes(filter) || v.name.includes(filter)).map((value, index) => (
                <ListItemButton onClick={() => handleSelectDeviceValue(value)} key={index}>
                  {value.icon==='wifi' && <ListItemIcon><WifiIcon /></ListItemIcon>}
                  {value.icon==='ble' && <ListItemIcon><BluetoothIcon /></ListItemIcon>}
                  {value.icon==='hub' && <ListItemIcon><HubIcon /></ListItemIcon>}
                  <ListItemText primary={value.serial} secondary={value.name}/>
                </ListItemButton>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogDeviceToggle}>Close</Button>
          </DialogActions>
        </Dialog>
      </ThemeProvider>

    </Box>
  );
}

export function CheckboxWidget(props) {
  // console.log('CheckboxWidget: props', props);
  return (
    <Box sx={{ padding: '10px', margin: '0px', border: '1px solid grey' }}>
      {props.name && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', padding: '0px', margin: '0px' }}>
          <Typography sx={titleSx}>{props.name}</Typography>
          <Checkbox checked={props.value} onChange={() => props.onChange(!props.value)}/>
        </Box>
      )}
      {props.schema.description && (
        <Box sx={{ padding: '0px', margin: '0px' }}>
          <Typography sx={descriptionSx}>{props.schema.description}</Typography>
        </Box>
      )}
    </Box>
  );
};

export function DescriptionFieldTemplate(props) {
  const { description } = props;
  if(!description) return null;
  return (
    <Box sx={{ padding: '0px', margin: '0px', marginTop: '5px' }}>
      <Typography sx={descriptionSx}>{description}</Typography>
    </Box>
  );
}

export function ErrorListTemplate({ errors }) {
  return (
    <Box sx={{ padding: '10px', margin: '10px', border: '1px solid grey' }}>
      <Typography variant="h6" color="error" gutterBottom>
        Please fix the following errors:
      </Typography>
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

export function FieldErrorTemplate({ errors }) {
  if(!errors) return null;
  return (
    <Box sx={{ padding: '0px', margin: '0px', marginTop: '5px' }}>
      {errors.map((error, index) => (
        <Typography key={index} color="error" variant="body2" sx={{ marginLeft: 1 }}>
          {error}
        </Typography>
      ))}
    </Box>
  );
};

export function RemoveButton(props) {
  const { ...otherProps } = props;
  return (
    <Tooltip title="Remove the item">
      <IconButton size='small' color='primary' {...otherProps}>
        <DeleteForever />
      </IconButton>
    </Tooltip>
  );
}

export function customBaseInputTemplate(props) {
  const customProps = {};
  return (
    <Box sx={{ padding: '10px', margin: '0px', border: '1px solid grey' }}>
      <BaseInputTemplate {...props} {...customProps} />
    </Box>
  );
}

export const configUiSchema = {
  "password": {
    "ui:widget": "password",
  },
  "ui:submitButtonOptions": {
    "props": {
      "variant": "contained",
      "disabled": false,
      "className": "configSubmitButton",
      sx: { margin: '0px', marginLeft: '20px', marginBottom: '10px' },
      style: { margin: '0px', marginLeft: '20px', marginBottom: '10px' },
    },
    "norender": false,
    "submitText": "Save the changes to the config file",
  },
  'ui:globalOptions': { orderable: true },
};
