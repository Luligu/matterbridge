import '@testing-library/jest-dom';

import Dialog from '@mui/material/Dialog';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { InstallProgressDialog } from '../src/components/InstallProgressDialog';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { MbfLsk } from '../src/utils/localStorage';

const settings = vi.hoisted(() => ({ debug: false, enableMobile: true }));
vi.mock('../src/appState', () => settings);
vi.mock('@mui/material/Dialog', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mui/material/Dialog')>();
  return { ...original, default: vi.fn((props: React.ComponentProps<typeof original.default>) => <original.default {...props} />) };
});

type DialogOptions = {
  open?: boolean;
  title?: string;
  output?: string;
  mobile?: boolean;
  installAutoExit?: boolean;
  onInstall?: () => void;
};

const scrollIntoView = vi.fn();
const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

function renderDialog(options: DialogOptions = {}) {
  const onClose = vi.fn();
  const setInstallAutoExit = vi.fn();
  const view = (overrides: DialogOptions = {}) => {
    const current = { open: true, title: 'Install plugin', output: 'Starting install', mobile: false, installAutoExit: false, ...options, ...overrides };
    return (
      <UiContext.Provider value={{ mobile: current.mobile, installAutoExit: current.installAutoExit, setInstallAutoExit } as unknown as UiContextType}>
        <InstallProgressDialog
          open={current.open}
          title={current.title}
          output={current.output}
          _command="install"
          _packageName="matterbridge-test"
          onInstall={current.onInstall}
          onClose={onClose}
        />
      </UiContext.Provider>
    );
  };
  const result = render(view());
  return { ...result, onClose, setInstallAutoExit, rerenderDialog: (overrides: DialogOptions) => result.rerender(view(overrides)) };
}

beforeEach(() => {
  settings.debug = false;
  settings.enableMobile = true;
  vi.useFakeTimers();
  vi.clearAllMocks();
  window.localStorage.clear();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: scrollIntoView });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  act(() => {
    vi.runOnlyPendingTimers();
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

describe('InstallProgressDialog rendering', () => {
  test('should show the title, logo, and separate log lines while preserving blank lines and escaping markup', () => {
    renderDialog({ title: 'Update plugin', output: 'first line\n\n<script>danger()</script>\nlast line\n' });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Matterbridge Logo Update plugin');
    expect(screen.getByRole('img', { name: 'Matterbridge Logo' })).toHaveAttribute('src', 'matterbridge.svg');
    expect(screen.getByText('Process log')).toBeInTheDocument();
    const list = screen.getByRole('list');
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['first line', '', '<script>danger()</script>', 'last line', '', '']);
    expect(list.querySelector('script')).toBeNull();
    expect(list).toHaveStyle({ overflow: 'auto', whiteSpace: 'pre-wrap' });
    expect(within(list).getAllByRole('listitem')[0]).toHaveStyle({ wordBreak: 'break-all' });
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
  });

  test('should retain the empty log and scroll anchor when output is empty', () => {
    renderDialog({ output: '' });
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['', '']);
  });

  test('should render only when open and replace output rather than retaining previous lines', () => {
    const { rerenderDialog } = renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerenderDialog({ open: true, output: 'First update' });
    expect(screen.getByText('First update')).toBeInTheDocument();
    rerenderDialog({ open: true, title: 'Finished', output: 'Second update\nDone' });
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Matterbridge Logo Finished');
    expect(screen.queryByText('First update')).not.toBeInTheDocument();
    expect(screen.getByText('Second update')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    rerenderDialog({ open: false });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test.each([
    { mobile: false, enableMobile: true, responsive: false },
    { mobile: true, enableMobile: false, responsive: false },
    { mobile: true, enableMobile: true, responsive: true },
  ])('should size the dialog when mobile=$mobile and enableMobile=$enableMobile', ({ mobile, enableMobile, responsive }) => {
    settings.enableMobile = enableMobile;
    renderDialog({ mobile });
    expect(vi.mocked(Dialog).mock.calls.at(-1)?.[0].slotProps?.paper).toEqual({
      sx: {
        width: responsive ? '100vw' : '75vw',
        maxWidth: responsive ? '100vw' : '75vw',
        height: responsive ? '100vh' : '75vw',
        maxHeight: responsive ? '100vh' : '75vh',
        margin: responsive ? '0px' : undefined,
        overflow: 'hidden',
      },
    });
    expect(screen.getByRole('dialog')).toHaveStyle({
      width: `${window.innerWidth * (responsive ? 1 : 0.75)}px`,
      height: `${responsive ? window.innerHeight : window.innerWidth * 0.75}px`,
      margin: responsive ? '0px' : '32px',
      overflow: 'hidden',
    });
  });
});

describe('InstallProgressDialog actions', () => {
  test('should invoke Install and Close independently when their buttons are clicked', () => {
    const onInstall = vi.fn();
    const { onClose } = renderDialog({ onInstall });
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  test('should add and remove the Install button when the callback prop changes', () => {
    const { rerenderDialog } = renderDialog();
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
    const onInstall = vi.fn();
    rerenderDialog({ onInstall });
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(onInstall).toHaveBeenCalledTimes(1);
    rerenderDialog({ onInstall: undefined });
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
  });

  test('should ignore Escape and backdrop clicks without invoking onClose', () => {
    const { onClose, baseElement } = renderDialog();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape', keyCode: 27 });
    expect(onClose).not.toHaveBeenCalled();
    const backdropContainer = baseElement.querySelector('.MuiDialog-container');
    if (!backdropContainer) throw new Error('Missing dialog backdrop container');
    fireEvent.mouseDown(backdropContainer);
    fireEvent.click(backdropContainer);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('should forward a nonstandard close reason through the defensive callback branch', () => {
    const { onClose } = renderDialog();
    const props = vi.mocked(Dialog).mock.calls.at(-1)?.[0];
    if (!props?.onClose) throw new Error('Missing dialog close callback');
    act(() => props.onClose?.({}, 'programmatic' as never));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test.each([false, true])('should persist both checkbox states with debug=%s', (debug) => {
    settings.debug = debug;
    const { setInstallAutoExit, rerenderDialog, onClose } = renderDialog();
    const checkbox = screen.getByRole('checkbox', { name: 'Close on success' });
    expect(checkbox).not.toBeChecked();
    expect(localStorage.getItem(MbfLsk.installAutoExit)).toBeNull();
    fireEvent.click(checkbox);
    expect(setInstallAutoExit).toHaveBeenCalledExactlyOnceWith(true);
    expect(localStorage.getItem(MbfLsk.installAutoExit)).toBe('true');
    rerenderDialog({ installAutoExit: true });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(setInstallAutoExit).toHaveBeenNthCalledWith(2, false);
    expect(localStorage.getItem(MbfLsk.installAutoExit)).toBe('false');
    rerenderDialog({ installAutoExit: false });
    expect(checkbox).not.toBeChecked();
    expect(onClose).not.toHaveBeenCalled();
    expect(vi.mocked(console.log).mock.calls.filter(([message]) => message === 'handleInstallAutoExitChange called with value:')).toEqual(
      debug
        ? [
            ['handleInstallAutoExitChange called with value:', true],
            ['handleInstallAutoExitChange called with value:', false],
          ]
        : [],
    );
  });

  test('should use context as the checkbox state without overwriting storage on render', () => {
    localStorage.setItem(MbfLsk.installAutoExit, 'false');
    const { setInstallAutoExit } = renderDialog({ installAutoExit: true });
    expect(screen.getByRole('checkbox', { name: 'Close on success' })).toBeChecked();
    expect(localStorage.getItem(MbfLsk.installAutoExit)).toBe('false');
    expect(setInstallAutoExit).not.toHaveBeenCalled();
  });
});

describe('InstallProgressDialog scrolling', () => {
  test.each([false, true])('should scroll after mounting and output changes but not unrelated rerenders with debug=%s', (debug) => {
    settings.debug = debug;
    const { rerenderDialog } = renderDialog({ output: 'First' });
    expect(scrollIntoView).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'end' });
    expect(scrollIntoView.mock.contexts[0]).toBe(screen.getAllByRole('listitem').at(-1));
    rerenderDialog({ output: 'First\nSecond' });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView.mock.contexts[1]).toBe(screen.getAllByRole('listitem').at(-1));
    rerenderDialog({ output: 'First\nSecond', title: 'Progress', installAutoExit: true });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(vi.mocked(console.log).mock.calls.filter(([message]) => message === 'Scrolling to bottom:')).toHaveLength(debug ? 2 : 0);
    expect(vi.mocked(console.log).mock.calls.filter(([message]) => message === 'InstallProgressDialog output effect mounted, scrolling to bottom:')).toHaveLength(debug ? 2 : 0);
  });

  test.each([false, true])('should safely skip scrolling when initially closed with debug=%s', (debug) => {
    settings.debug = debug;
    renderDialog({ open: false });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('should safely skip the pending scroll when unmounted before the timeout runs', () => {
    const { unmount } = renderDialog();
    unmount();
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
