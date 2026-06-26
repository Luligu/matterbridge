// @mui/material
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
// Notistack
import { useSnackbar } from 'notistack';
// React
import React, { useState, useCallback, useMemo, useRef, type ReactNode } from 'react';

import { debug } from '../appState';
import { MbfLsk } from '../utils/localStorage';
import { ConfirmCancelForm } from './ConfirmCancelForm';
import { InstallProgressDialog } from './InstallProgressDialog';
import { UiContext } from './UiContext';

interface PersistMessage {
  message: string;
  key: string | number;
}
const persistMessages: PersistMessage[] = [];

interface UiProviderProps {
  children: ReactNode;
}

export function UiProvider({ children }: UiProviderProps): React.JSX.Element {
  // ******************************** Mobile ********************************
  const [mobile, setMobile] = useState(false);

  // ******************************** Page ********************************
  const [currentPage, setCurrentPage] = useState<string | null>(null);

  // ******************************** Snackbar ********************************
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const closeSnackbarMessage = useCallback(
    (message: string) => {
      if (debug) console.log(`UiProvider closeSnackbarMessage: message ${message}`);
      const messageIndex = persistMessages.findIndex((msg) => msg.message === message);
      if (messageIndex !== -1) {
        closeSnackbar(persistMessages[messageIndex].key);
        persistMessages.splice(messageIndex, 1);
        if (debug) console.log(`UiProvider closeSnackbarMessage: message ${message} removed from persistMessages`);
      }
    },
    [closeSnackbar],
  );

  const showSnackbarMessage = useCallback(
    (message: string, timeout?: number, severity?: 'info' | 'warning' | 'error' | 'success') => {
      if (debug) console.log(`UiProvider showSnackbarMessage: message ${message} timeout ${timeout}`);
      const key = enqueueSnackbar(message, {
        variant: 'default',
        autoHideDuration: timeout === null || timeout === undefined || timeout > 0 ? (timeout ?? 5) * 1000 : null,
        persist: timeout === 0,
        // notistack render prop, not a nested component definition: enqueueSnackbar calls content(key, message) to render custom snackbar markup.
        // oxlint-disable-next-line react/no-unstable-nested-components
        content: (key) => (
          <Box key={key} sx={{ margin: '0', padding: '0', width: '300px', marginRight: '30px' }}>
            <Alert
              key={key}
              severity={severity ?? 'info'}
              variant="filled"
              sx={{
                color: '#fff',
                fontWeight: 'normal',
                width: '100%',
                cursor: 'pointer',
                padding: '0px 10px',
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
      if (timeout === 0) {
        if (debug) console.log(`UiProvider showSnackbarMessage: message ${message} timeout ${timeout} - persist key ${key}`);
        persistMessages.push({ message, key });
      }
    },
    [enqueueSnackbar, closeSnackbar],
  );

  // ******************************** ConfirmCancelForm ********************************
  const [showConfirmCancelForm, setShowConfirmCancelForm] = useState(false);
  const [confirmCancelFormTitle, setConfirmCancelFormTitle] = useState('');
  const [confirmCancelFormMessage, setConfirmCancelFormMessage] = useState('');
  const [confirmCancelFormCommand, setConfirmCancelFormCommand] = useState('');
  const confirmCancelFormHandleConfirmRef = useRef<((command: string) => void) | null>(null);
  const confirmCancelFormHandleCancelRef = useRef<((command: string) => void) | null>(null);

  const handleConfirm = () => {
    if (debug) console.log(`UiProvider handle confirm action ${confirmCancelFormCommand}`);
    setShowConfirmCancelForm(false);
    if (confirmCancelFormHandleConfirmRef.current) {
      confirmCancelFormHandleConfirmRef.current(confirmCancelFormCommand);
    }
  };

  const handleCancel = () => {
    if (debug) console.log(`UiProvider handle cancel action ${confirmCancelFormCommand}`);
    setShowConfirmCancelForm(false);
    if (confirmCancelFormHandleCancelRef.current) {
      confirmCancelFormHandleCancelRef.current(confirmCancelFormCommand);
    }
  };

  const showConfirmCancelDialog = useCallback(
    (title: string, message: string, command: string, handleConfirm: (command: string) => void, handleCancel: (command: string) => void) => {
      if (debug) console.log(`UiProvider showConfirmCancelDialog for command ${command}`);
      setConfirmCancelFormTitle(title);
      setConfirmCancelFormMessage(message);
      setConfirmCancelFormCommand(command);
      confirmCancelFormHandleConfirmRef.current = handleConfirm;
      confirmCancelFormHandleCancelRef.current = handleCancel;
      setShowConfirmCancelForm(true);
    },
    [],
  );

  // ******************************** InstallProgressDialog ********************************
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installTitle, setInstallTitle] = useState('');
  const [installCommand, setInstallCommand] = useState('');
  const [installPackageName, setInstallPackageName] = useState('');
  const [installOutput, setInstallOutput] = useState('');
  const [installAutoExit, setInstallAutoExit] = useState(localStorage.getItem(MbfLsk.installAutoExit) !== 'false'); // default true

  const showInstallProgress = useCallback((title: string, command: string, packageName: string) => {
    if (debug) console.log(`UiProvider show install progress for package ${title}`);
    setInstallTitle(title);
    setInstallCommand(command);
    setInstallPackageName(packageName);
    // setInstallOutput(`Starting installation of ${packageName}...\n`);
    setInstallDialogOpen(true);
  }, []);

  const addInstallProgress = useCallback((output: string) => {
    if (debug) console.log(`UiProvider addInstallProgress: output ${output}`);
    setInstallOutput((prevOutput) => prevOutput + output + '\n');
  }, []);

  const exitInstallProgressSuccess = useCallback(() => {
    if (debug) console.log(`UiProvider exitInstallProgressSuccess: package ${installPackageName}`);
    // setInstallOutput((prevOutput) => prevOutput + `Successfully installed ${installPackageName}\n`);
    const installAutoExitLocal = localStorage.getItem(MbfLsk.installAutoExit) !== 'false'; // default true
    if (installAutoExitLocal) {
      setInstallDialogOpen(false);
    }
  }, [installPackageName]);

  const exitInstallProgressError = useCallback(() => {
    if (debug) console.log(`UiProvider exitInstallProgressError: package ${installPackageName}`);
    // setInstallOutput((prevOutput) => prevOutput + `Failed to install ${installPackageName}\n`);
  }, [installPackageName]);

  const hideInstallProgress = useCallback(() => {
    if (debug) console.log(`UiProvider hide install progress`);
    setInstallDialogOpen(false);
  }, []);

  const handleInstallClose = () => {
    if (debug) console.log(`UiProvider handle install close action`);
    setInstallDialogOpen(false);
    setInstallPackageName('');
    setInstallOutput('');
  };

  const contextValue = useMemo(
    () => ({
      mobile,
      setMobile,
      currentPage,
      setCurrentPage,
      showSnackbarMessage,
      closeSnackbarMessage,
      closeSnackbar,
      showConfirmCancelDialog,
      showInstallProgress,
      exitInstallProgressSuccess,
      exitInstallProgressError,
      hideInstallProgress,
      addInstallProgress,
      installAutoExit,
      setInstallAutoExit,
    }),
    [
      mobile,
      currentPage,
      setMobile,
      setCurrentPage,
      showSnackbarMessage,
      closeSnackbarMessage,
      closeSnackbar,
      showConfirmCancelDialog,
      showInstallProgress,
      exitInstallProgressSuccess,
      exitInstallProgressError,
      hideInstallProgress,
      addInstallProgress,
      installAutoExit,
      setInstallAutoExit,
    ],
  );

  return (
    <UiContext.Provider value={contextValue}>
      <ConfirmCancelForm open={showConfirmCancelForm} title={confirmCancelFormTitle} message={confirmCancelFormMessage} onConfirm={handleConfirm} onCancel={handleCancel} />
      <InstallProgressDialog
        open={installDialogOpen}
        title={installTitle}
        _command={installCommand}
        _packageName={installPackageName}
        output={installOutput}
        onClose={handleInstallClose}
      />
      {children}
    </UiContext.Provider>
  );
}
