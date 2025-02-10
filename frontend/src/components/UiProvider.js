// React
import React, { useState, useCallback, useMemo, createContext, useRef } from 'react';

// @mui
import { Alert, Box, IconButton } from '@mui/material';
import { useSnackbar } from 'notistack';
import CloseIcon from '@mui/icons-material/Close';

// Local modules
import { ConfirmCancelForm } from './ConfirmCancelForm';
// import { debug } from '../App';

const debug = true;

export const UiContext = createContext();

export function UiProvider({ children }) {
  // Snackbar
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const showSnackbarMessage = useCallback((message, timeout, variant) => {
    // default | error | success | warning | info
    if(debug) console.log(`UiProvider showSnackbarMessage: message ${message} timeout ${timeout}`);
    enqueueSnackbar(message, { 
      variant: 'default', 
      autoHideDuration: timeout === null || timeout === undefined || timeout > 0 ? (timeout ?? 5) * 1000 : null, 
      persist: timeout === 0,
      dense: true,
      content: (key) => (
        <Box key={key} sx={{ width: '300px', marginRight: '30px' }}> 
          <Alert
            key={key}
            severity="info"
            variant="filled"
            sx={{
              backgroundColor: 'var(--primary-color)',
              color: '#fff',
              fontWeight: 'normal',
              width: '100%',
              cursor: 'pointer', 

            }}
            onClick={() => closeSnackbar(key)}
            action={
              <IconButton size="small" onClick={() => closeSnackbar(key)} sx={{ color: '#fff' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            {message}
          </Alert>
        </Box>
      ),
    });
  }, []);

  // ConfirmCancelForm
  const [showConfirmCancelForm, setShowConfirmCancelForm] = useState(false);
  const [confirmCancelFormTitle, setConfirmCancelFormTitle] = useState('');
  const [confirmCancelFormMessage, setConfirmCancelFormMessage] = useState('');
  const [confirmCancelFormCommand, setConfirmCancelFormCommand] = useState('');
  const confirmCancelFormHandleConfirmRef = useRef(null);
  const confirmCancelFormHandleCancelRef = useRef(null);

  const handleConfirm = () => {
    if(debug) console.log(`UiProvider handle confirm action ${confirmCancelFormCommand}`);
    setShowConfirmCancelForm(false);
    if (confirmCancelFormHandleConfirmRef.current) {
      confirmCancelFormHandleConfirmRef.current(confirmCancelFormCommand);
    }
  };

  const handleCancel = () => {
    if(debug) console.log(`UiProvider handle cancel action ${confirmCancelFormCommand}`);
    setShowConfirmCancelForm(false);
    if (confirmCancelFormHandleCancelRef.current) {
      confirmCancelFormHandleCancelRef.current(confirmCancelFormCommand);
    }
  };

  const showConfirmCancelDialog = useCallback((title, message, command, handleConfirm, handleCancel) => {
    if(debug) console.log(`UiProvider showConfirmCancelDialog for command ${command}`);
    setConfirmCancelFormTitle(title);
    setConfirmCancelFormMessage(message);
    setConfirmCancelFormCommand(command);
    confirmCancelFormHandleConfirmRef.current = handleConfirm;
    confirmCancelFormHandleCancelRef.current = handleCancel;
    setShowConfirmCancelForm(true);
  }, []);


  // Create the context value for the provider
  const contextValue = useMemo(() => ({
    showSnackbarMessage,
    closeSnackbar,
    showConfirmCancelDialog,
  }), [showSnackbarMessage]);

  return (
    <UiContext.Provider value={contextValue}>
      <ConfirmCancelForm open={showConfirmCancelForm} title={confirmCancelFormTitle} message={confirmCancelFormMessage} onConfirm={handleConfirm} onCancel={handleCancel} />
      {children}
    </UiContext.Provider>
  );
}