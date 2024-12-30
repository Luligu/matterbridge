// @mui
import { createTheme } from '@mui/material';

// Function to get CSS variable value
export function getCssVariable(variableName, defaultValue) {
  // console.log('getCssVariable:', variableName, 'defaultValue', defaultValue);
  const value = getComputedStyle(document.body).getPropertyValue(variableName).trim();
  // if(value) console.log('getCssVariable:', value);
  if(!value) console.error('getCssVariable: undefined', value);
  return value || defaultValue;
}

// Create the frontend theme based on the CSS variables
export function createMuiTheme(primaryColor) {
  const theme = createTheme({
    palette: {
      primary: {
        main: primaryColor,
      },
    },
    components: {
      MuiTypography: {
        fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
      },
      MuiTooltip: {
        defaultProps: {
          placement: 'top-start', 
          arrow: true,
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            color: 'var(--main-button-color)',
            backgroundColor: 'var(--main-button-bg-color)', 
          },
          contained: {
            color: 'var(--main-button-color)',
            backgroundColor: 'var(--main-button-bg-color)',
          },
          outlined: {
            color: 'var(--main-button-color)',
            backgroundColor: 'var(--main-button-bg-color)',
          },
          text: {
            color: 'var(--main-button-color)',
          },
        },
        defaultProps: {
          variant: 'contained',
          size: 'small',
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: 'var(--main-icon-color)',
            '&:hover .MuiSvgIcon-root': {
              color: 'var(--primary-color)', 
            },
          },
        },
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
      MuiTextField: {
        defaultProps: {
          size: 'small',
          variant: 'outlined',
          fullWidth: true,
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
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
          },
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          root: {
            color: 'var(--main-label-color)',
            '&.Mui-focused': {
              color: 'var(--main-label-color)', 
            },
          },
        },
      },
      MuiFormControl: {
        styleOverrides: {
          root: {
            color: 'var(--main-grey-color)',
          },
        },
      },
      MuiRadio: {
        styleOverrides: {
          root: {
            color: 'var(--main-label-color)', 
            '&.Mui-checked': {
              color: 'var(--primary-color)',
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            backgroundColor: 'var(--div-bg-color)',
            color: 'var(--div-text-color)',
            height: '30px', 
            '&:hover': {
              borderColor: 'var(--main-text-color)',
            },
            '&.Mui-focused': {
              borderColor: 'var(--primary-color)',
            },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: 'var(--main-menu-bg-color)',
            padding: '0px',
            margin: '0px',
          },
          list: {
            padding: '0px',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            color: 'var(--main-menu-color)',
            backgroundColor: 'var(--main-menu-bg-color)',
            '&:hover': {
              backgroundColor: 'var(--main-menu-hover-color)',
            },
            '&.Mui-selected': {
              color: 'var(--main-menu-color)',
              backgroundColor: 'var(--main-menu-bg-color)',
            },
            '&.Mui-selected:hover': {
              backgroundColor: 'var(--main-menu-hover-color)',
            },
          },
        },
      },
    },
  });
  return theme;
};