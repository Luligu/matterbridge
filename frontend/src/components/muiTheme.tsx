// @mui
import { createTheme, Theme } from '@mui/material';

// Frontend
import { debug } from '../App';
// const debug = true;

// Function to get CSS variable value
export function getCssVariable(variableName: string, defaultValue: string): string {
  if (debug) console.log('getCssVariable:', variableName, 'defaultValue', defaultValue);
  const value = getComputedStyle(document.body).getPropertyValue(variableName).trim();
  // if(value) console.log('getCssVariable:', value);
  if(!value) console.error('getCssVariable: undefined', value);
  return value || defaultValue;
}

// Create the frontend theme based on the CSS variables
export function createMuiTheme(primaryColor: string): Theme {
  const theme = createTheme({
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
    typography: {
      fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
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
      },
      MuiButton: {
        styleOverrides: {
          root: {
            color: 'var(--main-button-color)',
            backgroundColor: 'var(--main-button-bg-color)',
            '&:hover': {
              backgroundColor: 'var(--main-button-bg-color)',
            },
            '&.Mui-disabled': {
              color: 'var(--main-button-color)',
              backgroundColor: 'var(--main-grey-color)',
            },
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
            // padding: '4px 8px',
            padding: '0px',
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
      MuiListItemButton: {
        styleOverrides: {
          root: {
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: 'var(--main-bg-color)',
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
      MuiListItemText: {
        styleOverrides: {
          primary: {
            fontSize: '16px',
            fontWeight: 'bold',
            color: 'var(--div-text-color)',
          },
          secondary: {
            fontSize: '14px',
            fontWeight: 'normal',
            color: 'var(--div-text-color)',
          },
        },
      },
    },
  });
  return theme;
}
