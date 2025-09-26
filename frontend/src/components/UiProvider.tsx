// React
import React, { useState, useCallback, useMemo, createContext, useRef, ReactNode } from 'react';

// @mui/material
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

// Notistack
import { SnackbarKey, useSnackbar } from 'notistack';

// Frontend
import { ConfirmCancelForm } from './ConfirmCancelForm';
import { debug } from '../App';
import { InstallProgressDialog } from './InstallProgressDialog ';
// const debug = true;

interface PersistMessage {
  message: string;
  key: string | number;
}
const persistMessages: PersistMessage[] = [];

export interface UiContextType {
  showSnackbarMessage: (message: string, timeout?: number, severity?: 'info' | 'warning' | 'error' | 'success') => void;
  closeSnackbarMessage: (message: string) => void;
  closeSnackbar: (key?: SnackbarKey | undefined) => void;
  showConfirmCancelDialog: (
    title: string,
    message: string,
    command: string,
    handleConfirm: (command: string) => void,
    handleCancel: (command: string) => void
  ) => void;
  showInstallProgress: (packageName: string) => void;
  hideInstallProgress: () => void;
  addInstallProgress: (output: string) => void;
}

export const UiContext = createContext<UiContextType>(null as unknown as UiContextType);

interface UiProviderProps {
  children: ReactNode;
}

export function UiProvider({ children }: UiProviderProps): React.JSX.Element {
  // ******************************** Snackbar ******************************** 
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const closeSnackbarMessage = useCallback((message: string) => {
    if(debug) console.log(`UiProvider closeSnackbarMessage: message ${message}`);
    const messageIndex = persistMessages.findIndex((msg) => msg.message === message);
    if (messageIndex !== -1) {
      closeSnackbar(persistMessages[messageIndex].key);
      persistMessages.splice(messageIndex, 1);
      if(debug) console.log(`UiProvider closeSnackbarMessage: message ${message} removed from persistMessages`);
    }
  }, [closeSnackbar]);

  const showSnackbarMessage = useCallback((message: string, timeout?: number, severity?: 'info' | 'warning' | 'error' | 'success') => {
    if(debug) console.log(`UiProvider showSnackbarMessage: message ${message} timeout ${timeout}`);
    const key = enqueueSnackbar(message, {
      variant: 'default',
      autoHideDuration: timeout === null || timeout === undefined || timeout > 0 ? (timeout ?? 5) * 1000 : null,
      persist: timeout === 0,
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
    if(timeout === 0) {
      if(debug) console.log(`UiProvider showSnackbarMessage: message ${message} timeout ${timeout} - persist key ${key}`);
      persistMessages.push({message, key});
    }
  }, [enqueueSnackbar, closeSnackbar]);

  // ******************************** ConfirmCancelForm ******************************** 
  const [showConfirmCancelForm, setShowConfirmCancelForm] = useState(false);
  const [confirmCancelFormTitle, setConfirmCancelFormTitle] = useState('');
  const [confirmCancelFormMessage, setConfirmCancelFormMessage] = useState('');
  const [confirmCancelFormCommand, setConfirmCancelFormCommand] = useState('');
  const confirmCancelFormHandleConfirmRef = useRef<((command: string) => void) | null>(null);
  const confirmCancelFormHandleCancelRef = useRef<((command: string) => void) | null>(null);

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

  const showConfirmCancelDialog = useCallback((title: string, message: string, command: string, handleConfirm: (command: string) => void, handleCancel: (command: string) => void) => {
    if(debug) console.log(`UiProvider showConfirmCancelDialog for command ${command}`);
    setConfirmCancelFormTitle(title);
    setConfirmCancelFormMessage(message);
    setConfirmCancelFormCommand(command);
    confirmCancelFormHandleConfirmRef.current = handleConfirm;
    confirmCancelFormHandleCancelRef.current = handleCancel;
    setShowConfirmCancelForm(true);
  }, []);

  // ******************************** InstallProgressDialog ******************************** 
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installPackageName, setInstallPackageName] = useState('');
  const [installOutput, setInstallOutput] = useState('');

  const showInstallProgress = useCallback((packageName: string) => {
    /*if(debug)*/ console.log(`UiProvider show install progress for package ${packageName}`);
    setInstallPackageName(packageName);
    setInstallOutput(`Starting installation of ${packageName}...\n`);
    setInstallDialogOpen(true);
}, []);

  const hideInstallProgress = useCallback(() => {
    /*if(debug)*/ console.log(`UiProvider hide install progress`);
    setInstallDialogOpen(false);
  }, []);

  const addInstallProgress = useCallback((output: string) => {
    /*if(debug)*/ console.log(`UiProvider addInstallProgress: output ${output}`);
    setInstallOutput( prevOutput => prevOutput + output + '\n' );
  }, []);

  const handleInstallClose = () => {
    /*if(debug)*/ console.log(`UiProvider handle install close action`);
    setInstallDialogOpen(false);
    setInstallPackageName('');
    setInstallOutput('');
  };

  const contextValue = useMemo(() => ({
    showSnackbarMessage,
    closeSnackbarMessage,
    closeSnackbar,
    showConfirmCancelDialog,
    showInstallProgress,
    hideInstallProgress,
    addInstallProgress,
  }), [showSnackbarMessage, closeSnackbarMessage, closeSnackbar, showConfirmCancelDialog, showInstallProgress, hideInstallProgress, addInstallProgress]);

  return (
    <UiContext.Provider value={contextValue}>
      <ConfirmCancelForm open={showConfirmCancelForm} title={confirmCancelFormTitle} message={confirmCancelFormMessage} onConfirm={handleConfirm} onCancel={handleCancel} />
      <InstallProgressDialog open={installDialogOpen} packageName={installPackageName} output={installOutput} onClose={handleInstallClose} />
      {children}
    </UiContext.Provider>
  );
}
