import '@testing-library/jest-dom';

import { useContext } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MbfLsk } from '../src/utils/localStorage';

const mockEnqueueSnackbar = vi.fn();
const mockCloseSnackbar = vi.fn();

vi.mock('../src/App', () => ({
  debug: false,
}));

vi.mock('notistack', () => ({
  useSnackbar: () => ({
    enqueueSnackbar: mockEnqueueSnackbar,
    closeSnackbar: mockCloseSnackbar,
  }),
}));

vi.mock('../src/components/ConfirmCancelForm', () => ({
  ConfirmCancelForm: ({ open, title, message, onConfirm, onCancel }: { open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void }) =>
    open ? (
      <div data-testid='confirm-cancel-form'>
        <div>{title}</div>
        <div>{message}</div>
        <button type='button' onClick={onConfirm}>
          Confirm action
        </button>
        <button type='button' onClick={onCancel}>
          Cancel action
        </button>
      </div>
    ) : null,
}));

vi.mock('../src/components/InstallProgressDialog ', () => ({
  InstallProgressDialog: ({ open, title, _command, _packageName, output, onClose }: { open: boolean; title: string; _command: string; _packageName: string; output: string; onClose: () => void }) =>
    open ? (
      <div data-testid='install-progress-dialog'>
        <div>{title}</div>
        <div data-testid='install-command'>{_command}</div>
        <div data-testid='install-package'>{_packageName}</div>
        <div data-testid='install-output'>{output}</div>
        <button type='button' onClick={onClose}>
          Close install dialog
        </button>
      </div>
    ) : null,
}));

describe('UiProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    localStorage.clear();
    mockEnqueueSnackbar.mockImplementation((_message: string, _options: unknown) => 'snackbar-key');
  });

  async function loadUiProvider() {
    const mod = await import('../src/components/UiProvider');
    return { UiProvider: mod.UiProvider, UiContext: mod.UiContext };
  }

  async function renderHarness() {
    const { UiProvider, UiContext } = await loadUiProvider();

    const confirmSpy = vi.fn();
    const cancelSpy = vi.fn();

    function Harness() {
      const ui = useContext(UiContext);

      return (
        <div>
          <div data-testid='mobile'>{String(ui.mobile)}</div>
          <div data-testid='current-page'>{ui.currentPage ?? 'null'}</div>
          <div data-testid='install-auto-exit'>{String(ui.installAutoExit)}</div>
          <button type='button' onClick={() => ui.setMobile(true)}>
            Set mobile
          </button>
          <button type='button' onClick={() => ui.setCurrentPage('Devices')}>
            Set current page
          </button>
          <button type='button' onClick={() => ui.showSnackbarMessage('persist message', 0, 'success')}>
            Show persistent snackbar
          </button>
          <button type='button' onClick={() => ui.showSnackbarMessage('timed message', 2, 'warning')}>
            Show timed snackbar
          </button>
          <button type='button' onClick={() => ui.closeSnackbarMessage('persist message')}>
            Close snackbar by message
          </button>
          <button type='button' onClick={() => ui.closeSnackbar('manual-key')}>
            Close snackbar direct
          </button>
          <button type='button' onClick={() => ui.showConfirmCancelDialog('Confirm title', 'Confirm message', 'restart', confirmSpy, cancelSpy)}>
            Show confirm dialog
          </button>
          <button type='button' onClick={() => ui.showInstallProgress('Install title', 'npm install matterbridge-test', 'matterbridge-test')}>
            Show install progress
          </button>
          <button type='button' onClick={() => ui.addInstallProgress('line 1')}>
            Add install progress
          </button>
          <button type='button' onClick={() => ui.exitInstallProgressSuccess()}>
            Exit install success
          </button>
          <button type='button' onClick={() => ui.exitInstallProgressError()}>
            Exit install error
          </button>
          <button type='button' onClick={() => ui.hideInstallProgress()}>
            Hide install progress
          </button>
          <button type='button' onClick={() => ui.setInstallAutoExit((prev) => !prev)}>
            Toggle install auto exit
          </button>
        </div>
      );
    }

    render(
      <UiProvider>
        <Harness />
      </UiProvider>,
    );

    return { confirmSpy, cancelSpy };
  }

  it('covers snackbar handling, confirm cancel dialog, and auto-exit install flow', async () => {
    const { confirmSpy, cancelSpy } = await renderHarness();

    expect(screen.getByText('Set mobile')).toBeInTheDocument();
    expect(screen.getByTestId('mobile')).toHaveTextContent('false');
    expect(screen.getByTestId('current-page')).toHaveTextContent('null');
    expect(screen.getByTestId('install-auto-exit')).toHaveTextContent('true');

    fireEvent.click(screen.getByText('Set mobile'));
    fireEvent.click(screen.getByText('Set current page'));
    expect(screen.getByTestId('mobile')).toHaveTextContent('true');
    expect(screen.getByTestId('current-page')).toHaveTextContent('Devices');

    fireEvent.click(screen.getByText('Show persistent snackbar'));
    fireEvent.click(screen.getByText('Show timed snackbar'));

    expect(mockEnqueueSnackbar).toHaveBeenNthCalledWith(
      1,
      'persist message',
      expect.objectContaining({
        variant: 'default',
        autoHideDuration: null,
        persist: true,
      }),
    );
    expect(mockEnqueueSnackbar).toHaveBeenNthCalledWith(
      2,
      'timed message',
      expect.objectContaining({
        variant: 'default',
        autoHideDuration: 2000,
        persist: false,
      }),
    );

    const persistentSnackbar = mockEnqueueSnackbar.mock.calls[0][1].content('persist-key');
    const timedSnackbar = mockEnqueueSnackbar.mock.calls[1][1].content('timed-key');

    const persistentRender = render(<>{persistentSnackbar}</>);
    fireEvent.click(persistentRender.getByText('persist message'));
    expect(mockCloseSnackbar).toHaveBeenCalledWith('persist-key');
    fireEvent.click(within(persistentRender.getByRole('alert')).getByRole('button'));
    expect(mockCloseSnackbar).toHaveBeenCalledWith('persist-key');
    persistentRender.unmount();

    const { unmount: unmountTimed } = render(<>{timedSnackbar}</>);
    expect(screen.getByText('timed message')).toBeInTheDocument();
    unmountTimed();

    fireEvent.click(screen.getByText('Close snackbar by message'));
    expect(mockCloseSnackbar).toHaveBeenCalledWith('snackbar-key');

    fireEvent.click(screen.getByText('Close snackbar direct'));
    expect(mockCloseSnackbar).toHaveBeenCalledWith('manual-key');

    fireEvent.click(screen.getByText('Show confirm dialog'));
    expect(screen.getByTestId('confirm-cancel-form')).toBeInTheDocument();
    expect(screen.getByText('Confirm title')).toBeInTheDocument();
    expect(screen.getByText('Confirm message')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Confirm action'));
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('restart');
    });
    expect(screen.queryByTestId('confirm-cancel-form')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show confirm dialog'));
    fireEvent.click(screen.getByText('Cancel action'));
    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith('restart');
    });
    expect(screen.queryByTestId('confirm-cancel-form')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show install progress'));
    expect(screen.getByTestId('install-progress-dialog')).toBeInTheDocument();
    expect(screen.getByText('Install title')).toBeInTheDocument();
    expect(screen.getByTestId('install-command')).toHaveTextContent('npm install matterbridge-test');
    expect(screen.getByTestId('install-package')).toHaveTextContent('matterbridge-test');

    fireEvent.click(screen.getByText('Add install progress'));
    await waitFor(() => {
      expect(screen.getByTestId('install-output')).toHaveTextContent('line 1');
    });

    fireEvent.click(screen.getByText('Exit install error'));
    expect(screen.getByTestId('install-progress-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Exit install success'));
    await waitFor(() => {
      expect(screen.queryByTestId('install-progress-dialog')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Show install progress'));
    fireEvent.click(screen.getByText('Close install dialog'));
    await waitFor(() => {
      expect(screen.queryByTestId('install-progress-dialog')).not.toBeInTheDocument();
    });
  });

  it('respects disabled install auto-exit from localStorage and allows manual hide/toggle', async () => {
    localStorage.setItem(MbfLsk.installAutoExit, 'false');

    await renderHarness();

    expect(screen.getByTestId('install-auto-exit')).toHaveTextContent('false');

    fireEvent.click(screen.getByText('Show install progress'));
    fireEvent.click(screen.getByText('Add install progress'));
    await waitFor(() => {
      expect(screen.getByTestId('install-output')).toHaveTextContent('line 1');
    });

    fireEvent.click(screen.getByText('Exit install success'));
    expect(screen.getByTestId('install-progress-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Hide install progress'));
    await waitFor(() => {
      expect(screen.queryByTestId('install-progress-dialog')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Toggle install auto exit'));
    expect(screen.getByTestId('install-auto-exit')).toHaveTextContent('true');
  });
});
