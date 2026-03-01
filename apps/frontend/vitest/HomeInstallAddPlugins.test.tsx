import '@testing-library/jest-dom';

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { UiContext } from '../src/components/UiProvider';
import { WebSocketContext } from '../src/components/WebSocketProvider';

// Keep MUI Tooltip from using Popper in tests.
vi.mock('@mui/material/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Make the window chrome minimal + controllable.
vi.mock('../src/components/MbfWindow', () => ({
  MbfWindow: ({ children }: { children: React.ReactNode }) => <div data-testid="window">{children}</div>,
  MbfWindowHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="window-header">{children}</div>,
  MbfWindowHeaderText: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MbfWindowContent: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="window-content" {...props}>
      {children}
    </div>
  ),
  MbfWindowIcons: ({ close }: { close: () => void }) => (
    <button type="button" aria-label="close" onClick={close}>
      close
    </button>
  ),
}));

// Provide deterministic SearchPluginsDialog interactions.
vi.mock('../src/components/SearchPluginsDialog', () => ({
  SearchPluginsDialog: ({ open, onClose, onSelect, onVersions }: any) => (
    <div data-testid="search-dialog" data-open={String(!!open)}>
      <button type="button" onClick={() => onSelect('matterbridge-example')}>
        choose
      </button>
      <button type="button" onClick={() => onVersions(['latest', '1.2.3'])}>
        versions
      </button>
      <button type="button" onClick={() => onVersions([])}>
        versions-empty
      </button>
      <button type="button" onClick={onClose}>
        cancel
      </button>
    </div>
  ),
}));

// Silence debug logs and keep enableMobile stable.
vi.mock('../src/App', () => ({
  debug: false,
  enableMobile: false,
}));

describe('HomeInstallAddPlugins', () => {
  let originalGetBoundingClientRect: (() => DOMRect) | undefined;
  let HomeInstallAddPlugins: typeof import('../src/components/HomeInstallAddPlugins').default;

  beforeAll(async () => {
    // JSDOM returns 0x0 rects by default; MUI Popper warns that anchorEl isn't in layout.
    originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      return (
        {
          width: 100,
          height: 20,
          top: 0,
          left: 0,
          bottom: 20,
          right: 100,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect
      );
    };

    HomeInstallAddPlugins = (await import('../src/components/HomeInstallAddPlugins')).default;
  });

  afterAll(() => {
    if (originalGetBoundingClientRect) HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock fetch for upload flows.
    globalThis.fetch = vi.fn().mockResolvedValue({
      text: vi.fn().mockResolvedValue('ok'),
    } as any);
  });

  const renderWithCtx = (overrides?: { showSnackbarMessage?: any; logMessage?: any; sendMessage?: any }) => {
    const showSnackbarMessage = overrides?.showSnackbarMessage ?? vi.fn();
    const logMessage = overrides?.logMessage ?? vi.fn();
    const sendMessage = overrides?.sendMessage ?? vi.fn();

    const uiValue = { mobile: false, showSnackbarMessage } as any;
    const wsValue = { logMessage, sendMessage, getUniqueId: () => 'uid-install' } as any;

    const { container } = render(
      <UiContext.Provider value={uiValue}>
        <WebSocketContext.Provider value={wsValue}>
          <HomeInstallAddPlugins />
        </WebSocketContext.Provider>
      </UiContext.Provider>,
    );

    return { container, showSnackbarMessage, logMessage, sendMessage };
  };

  it('installs using dropdown version, respects explicit specifier, and blocks ignore list', async () => {
    const { showSnackbarMessage, sendMessage } = renderWithCtx();

    // Ignore list blocks the default "matterbridge-" value.
    fireEvent.click(screen.getByRole('button', { name: /^install$/i }));
    expect(showSnackbarMessage).toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();

    // Type a valid plugin name: it resets versions to [latest, dev] and selected to latest.
    fireEvent.change(screen.getByLabelText(/plugin name or plugin path/i), { target: { value: 'matterbridge-something' } });

    fireEvent.click(screen.getByRole('button', { name: /^install$/i }));
    expect(sendMessage).toHaveBeenCalledWith({
      id: 'uid-install',
      sender: 'InstallPlugins',
      method: '/api/install',
      src: 'Frontend',
      dst: 'Matterbridge',
      params: { packageName: 'matterbridge-something@latest', restart: false },
    });

    // If user types an explicit specifier, that should win over the dropdown.
    fireEvent.change(screen.getByLabelText(/plugin name or plugin path/i), { target: { value: 'matterbridge-something@1.0.0' } });
    fireEvent.click(screen.getByRole('button', { name: /^install$/i }));

    expect(sendMessage).toHaveBeenLastCalledWith({
      id: 'uid-install',
      sender: 'InstallPlugins',
      method: '/api/install',
      src: 'Frontend',
      dst: 'Matterbridge',
      params: { packageName: 'matterbridge-something@1.0.0', restart: false },
    });
  });

  it('supports SearchPluginsDialog selection, version selection, uninstall/add, and close', async () => {
    const { sendMessage } = renderWithCtx();

    // Feed versions via dialog callback.
    fireEvent.click(screen.getByText('versions'));

    // Pick 1.2.3 from the Select.
    const combo = screen.getByRole('combobox', { name: /tag or version/i });
    act(() => {
      fireEvent.mouseDown(combo);
    });

    const option = await screen.findByRole('option', { name: '1.2.3' }).catch(() => screen.findByRole('menuitem', { name: '1.2.3' }));
    fireEvent.click(option);

    // Choose plugin name via dialog callback.
    fireEvent.click(screen.getByText('choose'));

    fireEvent.click(screen.getByRole('button', { name: /^install$/i }));
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: '/api/install',
        params: { packageName: 'matterbridge-example@1.2.3', restart: false },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /^uninstall$/i }));
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: '/api/uninstall',
        params: { packageName: 'matterbridge-example' },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: '/api/addplugin',
        params: { pluginNameOrPath: 'matterbridge-example' },
      }),
    );

    // Close hides component.
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    await waitFor(() => {
      expect(screen.queryByTestId('window')).not.toBeInTheDocument();
    });
  });

  it('uploads via button + change and via drag/drop', async () => {
    const { logMessage } = renderWithCtx();

    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);

    fireEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(clickSpy).toHaveBeenCalled();

    const file = new File(['abc'], 'plugin.tgz', { type: 'application/gzip' });
    const input = document.getElementById('file-upload') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(logMessage).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith('./api/uploadpackage', expect.objectContaining({ method: 'POST' }));

    await waitFor(() => {
      expect(logMessage.mock.calls.some((call: unknown[]) => String(call?.[1] ?? '').startsWith('Server response:'))).toBe(true);
    });

    const content = screen.getByTestId('window-content');
    const file2 = new File(['def'], 'plugin2.tgz', { type: 'application/gzip' });

    await act(async () => {
      fireEvent.drop(content, {
        dataTransfer: { files: [file2] },
      });
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('./api/uploadpackage', expect.objectContaining({ method: 'POST' }));

    await waitFor(() => {
      expect(logMessage.mock.calls.some((call: unknown[]) => String(call?.[1] ?? '').startsWith('Server response:'))).toBe(true);
    });
  });

  it('covers drag events, context menu, add ignore list, and package name parsing edge cases', async () => {
    const { showSnackbarMessage, sendMessage } = renderWithCtx();

    const content = screen.getByTestId('window-content');
    fireEvent.dragOver(content);
    fireEvent.dragLeave(content);

    fireEvent.contextMenu(screen.getByRole('button', { name: /^upload$/i }));
    fireEvent.contextMenu(screen.getByRole('button', { name: /^add$/i }));

    // Add should also be blocked by ignore list.
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(showSnackbarMessage).toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ method: '/api/addplugin' }));

    // Empty/whitespace should no-op install (no snackbar, no send).
    const snackbarCallsBefore = showSnackbarMessage.mock.calls.length;
    fireEvent.change(screen.getByLabelText(/plugin name or plugin path/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /^install$/i }));
    expect(showSnackbarMessage).toHaveBeenCalledTimes(snackbarCallsBefore);
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ method: '/api/install' }));

    // Scoped package with explicit specifier.
    fireEvent.change(screen.getByLabelText(/plugin name or plugin path/i), { target: { value: '@scope/matterbridge-example@2.0.0' } });
    fireEvent.click(screen.getByRole('button', { name: /^install$/i }));
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: '/api/install',
        params: { packageName: '@scope/matterbridge-example@2.0.0', restart: false },
      }),
    );

    // Trailing @ should fall back to dropdown selection.
    fireEvent.change(screen.getByLabelText(/plugin name or plugin path/i), { target: { value: 'matterbridge-something@' } });
    fireEvent.click(screen.getByRole('button', { name: /^install$/i }));
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: '/api/install',
        params: { packageName: 'matterbridge-something@latest', restart: false },
      }),
    );
  });

  it('opens the search dialog via the icon button and cancels', async () => {
    const { container } = renderWithCtx();

    // Seed a non-default value so we can verify cancel resets it.
    fireEvent.change(screen.getByLabelText(/plugin name or plugin path/i), { target: { value: 'matterbridge-something' } });
    expect(screen.getByLabelText(/plugin name or plugin path/i)).toHaveValue('matterbridge-something');

    expect(screen.getByTestId('search-dialog')).toHaveAttribute('data-open', 'false');

    // The search IconButton has no accessible name; pick the only text-less button.
    const iconOnlyButtons = Array.from(container.querySelectorAll('button')).filter((b) => (b.textContent ?? '').trim() === '');
    expect(iconOnlyButtons.length).toBeGreaterThan(0);
    fireEvent.click(iconOnlyButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('search-dialog')).toHaveAttribute('data-open', 'true');
    });

    fireEvent.click(screen.getByText('cancel'));
    await waitFor(() => {
      expect(screen.getByTestId('search-dialog')).toHaveAttribute('data-open', 'false');
    });

    expect(screen.getByLabelText(/plugin name or plugin path/i)).toHaveValue('matterbridge-');
  });

  it('logs upload errors when fetch rejects', async () => {
    const logMessage = vi.fn();
    renderWithCtx({ logMessage });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('upload failed')) as any;

    const file = new File(['abc'], 'plugin.tgz', { type: 'application/gzip' });
    const input = document.getElementById('file-upload') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    const content = screen.getByTestId('window-content');
    const file2 = new File(['def'], 'plugin2.tgz', { type: 'application/gzip' });

    await act(async () => {
      fireEvent.drop(content, {
        dataTransfer: { files: [file2] },
      });
    });

    await waitFor(() => {
      expect(logMessage.mock.calls.some((c) => String(c?.[1] ?? '').includes('Error uploading package'))).toBe(true);
      expect(logMessage.mock.calls.some((c) => String(c?.[1] ?? '').includes('Error installing package'))).toBe(true);
    });

    consoleErrorSpy.mockRestore();
  });

  it('covers scoped parsing fallback and install name when no version is selected', async () => {
    const { sendMessage } = renderWithCtx();

    // Start with a normal plugin name.
    fireEvent.change(screen.getByLabelText(/plugin name or plugin path/i), { target: { value: 'matterbridge-something' } });

    // Simulate backend returning no versions; selectedPluginVersion becomes ''.
    fireEvent.click(screen.getByText('versions-empty'));

    // With no explicit specifier and no selected version, install should send plain name.
    fireEvent.click(screen.getByRole('button', { name: /^install$/i }));
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: '/api/install',
        params: { packageName: 'matterbridge-something', restart: false },
      }),
    );

    // Scoped package with no @specifier hits the "return { name: s, specifier: null }" path.
    fireEvent.change(screen.getByLabelText(/plugin name or plugin path/i), { target: { value: '@scope/matterbridge-example' } });
    fireEvent.click(screen.getByRole('button', { name: /^install$/i }));

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        method: '/api/install',
        params: { packageName: '@scope/matterbridge-example@latest', restart: false },
      }),
    );
  });
});
