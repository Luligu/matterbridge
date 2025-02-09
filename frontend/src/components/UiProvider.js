// React
import React, { useState, useCallback, useMemo, createContext, useRef } from 'react';

// @mui
import { Snackbar, Alert } from '@mui/material';

// Local modules
import { ConfirmCancelForm } from './ConfirmCancelForm';
// import { debug } from '../App';

const debug = true;

export const UiContext = createContext();

export function UiProvider({ children }) {
  // Snackbar
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const timeoutRef = useRef(null);

  const handleSnackbarClose = () => {
    if(debug) console.log(`UiProvider handleSnackbarClose`);
    setShowSnackbar(false);
  };

  const showSnackbarMessage = useCallback((message, timeout) => {
    if(debug) console.log(`UiProvider showSnackbarMessage: message ${message} timeout ${timeout}`);
    setSnackbarMessage(message);
    if (showSnackbar) setShowSnackbar(false);
    setShowSnackbar(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if(timeout > 0) {
      timeoutRef.current = setTimeout(() => {
        setShowSnackbar(false);
      }, timeout * 1000);
    }
  }, []);

  const closeSnackbar = useCallback(() => {
    if(debug) console.log(`UiProvider closeSnackbar`);
    setShowSnackbar(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
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
      <Snackbar anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} open={showSnackbar} onClose={handleSnackbarClose} autoHideDuration={60000}>
        <Alert onClose={handleSnackbarClose} severity="info" variant="filled" sx={{ width: '100%', bgcolor: 'var(--primary-color)' }}>{snackbarMessage}</Alert>
      </Snackbar>
      <ConfirmCancelForm open={showConfirmCancelForm} title={confirmCancelFormTitle} message={confirmCancelFormMessage} onConfirm={handleConfirm} onCancel={handleCancel} />
      {children}
    </UiContext.Provider>
  );
}