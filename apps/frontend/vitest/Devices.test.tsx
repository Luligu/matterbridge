import '@testing-library/jest-dom';

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MbfLsk, resetLocalStorage } from '../src/utils/localStorage';

// Mock Tooltip to avoid Popper/anchorEl warnings in JSDOM.
vi.mock('@mui/material/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../src/components/MbfPage', () => ({
  MbfPage: ({ children }: { children: React.ReactNode }) => <div data-testid="mbf-page">{children}</div>,
}));

vi.mock('../src/components/Connecting', () => ({
  Connecting: () => <div data-testid="connecting" />,
}));

let lastIconsProps: unknown;
vi.mock('../src/components/DevicesIcons', () => ({
  default: (props: unknown) => {
    lastIconsProps = props;
    return <div data-testid="devices-icons" />;
  },
}));

let lastTableProps: unknown;
vi.mock('../src/components/DevicesTable', () => ({
  default: (props: unknown) => {
    lastTableProps = props;
    return <div data-testid="devices-table" />;
  },
}));

// Provide a mockable context object for Devices.
vi.mock('../src/components/WebSocketProvider', async () => {
  const React = await import('react');
  return {
    WebSocketContext: React.createContext(null as unknown as Record<string, unknown>),
  };
});

import { WebSocketContext } from '../src/components/WebSocketProvider';

const mockElementRect = (el: HTMLElement) => {
  el.getBoundingClientRect = () =>
    ({
      width: 100,
      height: 20,
      top: 0,
      left: 0,
      bottom: 20,
      right: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
};

describe('Devices', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let Devices: typeof import('../src/components/Devices').default;
  let originalGetBoundingClientRect: (() => DOMRect) | undefined;

  beforeAll(async () => {
    // Silence the Devices component debug logs (it has debug=true).
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    // JSDOM returns 0x0 rects by default; MUI Popper/Tooltip warns that the anchorEl
    // is not part of the document layout. Override for this test file.
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

    Devices = (await import('../src/components/Devices')).default;
  });

  afterAll(() => {
    if (originalGetBoundingClientRect) {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
    consoleLogSpy.mockRestore();
  });

  beforeEach(() => {
    resetLocalStorage();
    lastIconsProps = undefined;
    lastTableProps = undefined;
  });

  it('requests plugins on mount and populates the plugin Select', async () => {
    const sendMessage = vi.fn();
    const removeListener = vi.fn();

    let listener: ((msg: any) => void) | undefined;
    const addListener = vi.fn((fn: (msg: any) => void) => {
      listener = fn;
    });

    const ctx = {
      online: true,
      sendMessage,
      addListener,
      removeListener,
      getUniqueId: () => 'uid-devices',
    };

    render(
      <WebSocketContext.Provider value={ctx as any}>
        <Devices />
      </WebSocketContext.Provider>,
    );

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        id: 'uid-devices',
        sender: 'Devices',
        method: '/api/plugins',
        src: 'Frontend',
        dst: 'Matterbridge',
        params: {},
      });
    });

    // Default viewMode is icon.
    expect(screen.getByTestId('devices-icons')).toBeInTheDocument();

    expect(listener).toBeDefined();
    act(() => {
      listener!({
        method: '/api/plugins',
        id: 'uid-devices',
        response: [{ name: 'PluginA' }, { name: 'PluginB' }],
      });
    });

    const combobox = document.querySelector('[role="combobox"]') as HTMLElement | null;
    expect(combobox).toBeTruthy();

    mockElementRect(combobox!);

    act(() => {
      fireEvent.mouseDown(combobox!);
    });

    // MUI Select renders items in a listbox; in some setups MenuItem role is option, in others it's menuitem.
    const itemA = (await screen.findByRole('option', { name: 'PluginA' }).catch(() => screen.findByRole('menuitem', { name: 'PluginA' }))) as HTMLElement;
    expect(itemA).toBeInTheDocument();
  });

  it('persists selected plugin and toggles view mode', async () => {
    const sendMessage = vi.fn();
    const removeListener = vi.fn();

    let listener: ((msg: any) => void) | undefined;
     
    const addListener = vi.fn((fn: (msg: any) => void) => {
      listener = fn;
    });

    const ctx = {
      online: true,
      sendMessage,
      addListener,
      removeListener,
      getUniqueId: () => 'uid-devices',
    };

    render(
      <WebSocketContext.Provider value={ctx as any}>
        <Devices />
      </WebSocketContext.Provider>,
    );

    expect(listener).toBeDefined();
    act(() => {
      listener!({
        method: '/api/plugins',
        id: 'uid-devices',
        response: [{ name: 'PluginA' }],
      });
    });

    const combobox = document.querySelector('[role="combobox"]') as HTMLElement | null;
    expect(combobox).toBeTruthy();

    mockElementRect(combobox!);

    act(() => {
      fireEvent.mouseDown(combobox!);
    });

    const itemA = (await screen.findByRole('option', { name: 'PluginA' }).catch(() => screen.findByRole('menuitem', { name: 'PluginA' }))) as HTMLElement;

    act(() => {
      fireEvent.click(itemA);
    });

    await waitFor(() => {
      expect(localStorage.getItem(MbfLsk.devicesFilterPlugins)).toBe('PluginA');
    });

    // Type in the device filter and ensure it's persisted.
    fireEvent.change(screen.getByPlaceholderText(/enter the device name or serial/i), { target: { value: 'abc' } });
    await waitFor(() => {
      expect(localStorage.getItem(MbfLsk.devicesFilterDevices)).toBe('abc');
    });

    // Clear button (X) should clear both input and localStorage.
    fireEvent.click(screen.getByRole('button', { name: /clear device filter/i }));
    expect(screen.getByPlaceholderText(/enter the device name or serial/i)).toHaveValue('');
    expect(localStorage.getItem(MbfLsk.devicesFilterDevices)).toBeNull();

    // Switch to table view.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Table View' }));
    });

    expect(screen.getByTestId('devices-table')).toBeInTheDocument();
    expect(localStorage.getItem(MbfLsk.devicesViewMode)).toBe('table');

    // Sanity: our mocks captured props at least once.
    expect(lastIconsProps).toBeDefined();
    expect(lastTableProps).toBeDefined();
  });
});
