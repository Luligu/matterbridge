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
import ListItemButton from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import ListItemIcon from '@mui/material/ListItemIcon';
import Tooltip from '@mui/material/Tooltip';

// @mui/icons-material
import DeleteForever from '@mui/icons-material/DeleteForever';
import Add from '@mui/icons-material/Add';
import ListIcon from '@mui/icons-material/List';
import WifiIcon from '@mui/icons-material/Wifi';
import BluetoothIcon from '@mui/icons-material/Bluetooth';

// @rjsf
import { Templates } from '@rjsf/mui';

// Frontend custom components
import { getCssVariable } from './muiTheme';
import { selectDevices } from './Home';

const { BaseInputTemplate } = Templates; // To get templates from a theme do this

const titleSx = { fontSize: '16px', fontWeight: 'bold', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)' };
const descriptionSx = { fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)' };

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
            padding: '8px', 
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
  // console.log('ArrayFieldTemplate: title', title, 'description', schema.description);
  const [dialogOpen, setDialogOpen] = useState(false);

  const primaryColor = useMemo(() => getCssVariable('--primary-color', '#009a00'), []);
  const theme = useMemo(() => createConfigTheme(primaryColor), []);

  const { canAdd, onAddClick, schema, title } = props;

  const handleDialogToggle = () => {
    setDialogOpen(!dialogOpen);
  };

  const handleSelectValue = (value) => {
    // console.log('ArrayFieldTemplate: handleSelectValue', value);
    setDialogOpen(false);
    // Trigger onAddClick to add the selected new item
    if(schema.selectFrom === 'serial')
      schema.items.default = value.serial;
    else if(schema.selectFrom === 'name')
      schema.items.default = value.name;
    onAddClick();
  };

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
                  <IconButton onClick={handleDialogToggle} size="small" color="primary">
                    <ListIcon />
                  </IconButton>
                </Tooltip>
              }
              <Tooltip title="Add a device">
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
          <Tooltip title="Remove the device">
            <IconButton onClick={element.onDropIndexClick(element.index)} size="small" color="primary">
              <DeleteForever />
            </IconButton>
          </Tooltip>
        </Box>
      ))}

      <ThemeProvider theme={theme}>
        <Dialog open={dialogOpen} onClose={handleDialogToggle} PaperProps={{
            sx: {
              maxHeight: '50vh', // Set the maximum height to 50% of the viewport height
              overflow: 'auto',  // Allow scrolling for overflowing content
            },
          }}>
          <DialogTitle>Select a device</DialogTitle>
          <DialogContent>
            <List dense>
              {selectDevices.map((value, index) => (
                <ListItemButton onClick={() => handleSelectValue(value)} key={index}>
                  {value.icon==='wifi' && <ListItemIcon><WifiIcon /></ListItemIcon>}
                  {value.icon==='ble' && <ListItemIcon><BluetoothIcon /></ListItemIcon>}
                  <ListItemText primary={value.serial} secondary={value.name}/>
                </ListItemButton>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogToggle}>Close</Button>
          </DialogActions>
        </Dialog>
      </ThemeProvider>

    </Box>
  );
}

export function ObjectFieldTemplate(props) {
  const { onAddClick, schema, properties, title, description } = props;
  // Check if this is the entire schema or an individual object
  const isRoot = !schema.additionalProperties;
  console.log('ObjectFieldTemplate: title', title, 'description', description, 'schema', schema, 'isRoot', isRoot);
  console.log('ObjectFieldTemplate: properties', properties);

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
          <Tooltip title="Add an item">
            <IconButton onClick={onAddClick(schema)} size="small" color="primary">
              <Add />
            </IconButton>
          </Tooltip>
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
  'ui:globalOptions': { orderable: false },
};
