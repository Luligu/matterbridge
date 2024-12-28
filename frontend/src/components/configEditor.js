
// @mui
import { IconButton, createTheme, Typography, Box } from '@mui/material';
import { DeleteForever, Add } from '@mui/icons-material';

// Function to get CSS variable value
function getCssVariable(variableName, defaultValue) {
  const value = getComputedStyle(document.body).getPropertyValue(variableName).trim();
  if(!value) console.error('getCssVariable:', value);
  return value || defaultValue;
}
/*
*/
export const configTheme = createTheme({
  palette: {
    primary: {
      main: '#009a00',
    },
  },
  components: {
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          color: 'var(--main-button-color)',
          backgroundColor: '#009a00', 
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
          '&.Mui-checked': {
            color: '#009a00', // Color for the checked state
          },
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

export function ArrayFieldTemplate(props) {
  const { canAdd, onAddClick, schema, title } = props;
  // console.log('ArrayFieldTemplate: title', title, 'description', schema.description);
  return (
    <Box sx={{ padding: '10px', margin: '0px', border: '1px solid grey' }}>
      {title && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          {title && (
            <Typography sx={{ fontSize: '14px', fontWeight: 'bold' }}>{title}</Typography>
          )}
          {canAdd && (
            <IconButton onClick={onAddClick} size="small" color="primary">
              <Add />
            </IconButton>
          )}
        </Box>
      )}
      {schema.description && (
        <Box sx={{ marginBottom: '10px' }}>
          <Typography sx={{ fontSize: '14px', fontWeight: 'normal' }}>{schema.description}</Typography>
        </Box>
      )}
      {props.items.map((element) => (
        <Box key={element.index} sx={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <Box sx={{ flexGrow: 1 }}>
            {element.children}
          </Box>
          <IconButton onClick={element.onDropIndexClick(element.index)} size="small" color="primary">
            <DeleteForever />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
}

export function ObjectFieldTemplate(props) {
  const { onAddClick, schema, properties, title, description } = props;
  // Check if this is the entire schema or an individual object
  const isRoot = !schema.additionalProperties;
  console.log('ObjectFieldTemplate: title', title, 'description', description, 'schema', schema, 'isRoot', isRoot);

  return (
    <Box sx={{ padding: '10px', margin: '0px', border: isRoot ? 'none' : '1px solid grey' }}>
      {/* Title for root */}
      {schema.title && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <Typography sx={{ fontSize: '14px', fontWeight: 'bold' }}>{schema.title}</Typography>
        </Box>
      )}
      {/* Title and Add for object */}
      {title && !isRoot && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <Typography sx={{ fontSize: '14px', fontWeight: 'bold' }}>{title}</Typography>
            <IconButton onClick={onAddClick(schema)} size="small" color="primary">
              <Add />
            </IconButton>
        </Box>
      )}
      {/* Description for root */}
      {schema.description && (
        <Box sx={{ marginBottom: '20px' }}>
          <Typography sx={{ fontSize: '14px', fontWeight: 'normal' }}>{schema.description}</Typography>
        </Box>
      )}
      {/* Iterate over each property in the object */}
      {properties.map(({ name, content, disabled, readonly, hidden }) => (
        <Box key={name} sx={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <Box sx={{ flexGrow: 1, marginBottom: '10px', padding: '0px' }}>
            {content}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function RemoveButton(props) {
  const { ...otherProps } = props;
  return (
    <IconButton size='small' color='primary' {...otherProps}>
      <DeleteForever />
    </IconButton>
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
    },
    "norender": false,
    "submitText": "Save the changes to the config file",
  },
  'ui:globalOptions': { orderable: false },
};
