// Notistack
import type { SnackbarKey } from 'notistack';
// React
import { createContext, type Dispatch, type SetStateAction } from 'react';

export interface UiContextType {
  mobile: boolean;
  setMobile: (mobile: boolean) => void;
  currentPage: string | null;
  setCurrentPage: (page: string | null) => void;
  showSnackbarMessage: (message: string, timeout?: number, severity?: 'info' | 'warning' | 'error' | 'success') => void;
  closeSnackbarMessage: (message: string) => void;
  closeSnackbar: (key?: SnackbarKey) => void;
  showConfirmCancelDialog: (title: string, message: string, command: string, handleConfirm: (command: string) => void, handleCancel: (command: string) => void) => void;
  /** Open an input dialog; confirmation receives only the edited value, cancellation receives no arguments */
  showConfirmCancelInputDialog: (title: string, message: string, initialValue: string, handleConfirm: (value: string) => void, handleCancel: () => void, label?: string) => void;
  showInstallProgress: (title: string, command: string, packageName: string) => void;
  exitInstallProgressSuccess: () => void;
  exitInstallProgressError: () => void;
  hideInstallProgress: () => void;
  addInstallProgress: (output: string) => void;
  installAutoExit: boolean;
  setInstallAutoExit: Dispatch<SetStateAction<boolean>>;
}

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- UiContext is always provided by UiProvider; this keeps consumers non-nullable without repetitive null checks.
export const UiContext = createContext<UiContextType>(null as unknown as UiContextType);
