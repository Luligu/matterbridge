/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';

// Mock UiContext and UiProvider before all other imports to avoid hoisting issues
vi.mock('../src/components/UiProvider', () => {
  const UiContext = React.createContext({ mobile: false, setMobile: () => {} });
  return {
    UiProvider: ({ children }: { children: React.ReactNode }) => <div>UiProvider{children}</div>,
    UiContext,
  };
});

import { cleanup } from '@testing-library/react';

describe('App dynamic import for import.meta.env.PROD coverage', () => {
  afterEach(() => {
    cleanup();
    delete (globalThis as any).importMeta;
  });
  it('covers development mode branch (import.meta.env.PROD = false)', async () => {
    (globalThis as any).importMeta = { env: { PROD: false } };
    const mod = await import('../src/App');
    const AppComponent = mod.default;
    render(<AppComponent />);
    expect(screen.getByText('Welcome to Matterbridge')).toBeInTheDocument();
  });
});

describe('App debug logging full coverage', () => {
  let originalDebug: boolean;
  let originalMeta: any;
  beforeEach(() => {
    originalDebug = debug;
    // Use toggleDebug to set debug = true
    if (!debug) toggleDebug();
    originalMeta = (globalThis as any).importMeta;
  });
  afterEach(() => {
    // Restore debug
    if (debug !== originalDebug) toggleDebug();
    if (originalMeta) (globalThis as any).importMeta = originalMeta;
    else delete (globalThis as any).importMeta;
  });
  it('covers debug logging with import.meta.env.PROD = true', () => {
    (globalThis as any).importMeta = { env: { PROD: true } };
    render(<App />);
    expect(screen.getByText('Welcome to Matterbridge')).toBeInTheDocument();
  });
  it('covers debug logging with import.meta.env.PROD = false', () => {
    (globalThis as any).importMeta = { env: { PROD: false } };
    render(<App />);
    expect(screen.getByText('Welcome to Matterbridge')).toBeInTheDocument();
  });
});

describe('App debug/theme/import.meta.env.PROD coverage', () => {
  let originalDebug: boolean;
  beforeEach(() => {
    // Save and set debug true
    originalDebug = debug;
    (global as any).localStorage.clear();
    // @ts-expect-error Vitest: set debug to true
    globalThis.debug = true;
  });
  afterEach(() => {
    // Restore debug
    (global as any).localStorage.clear();
    // @ts-expect-error Vitest: restore original debug
    globalThis.debug = originalDebug;
  });
  it('covers debug logging and theme logic (savedTheme present)', () => {
    localStorage.setItem('frontendTheme', 'classic');
    render(<App />);
    expect(document.body.getAttribute('frontend-theme')).toBe('classic');
  });
  it('covers debug logging and theme logic (savedTheme absent)', () => {
    render(<App />);
    expect(document.body.getAttribute('frontend-theme')).toBe('dark');
  });
  it('covers import.meta.env.PROD branch', () => {
    // Simulate import.meta.env.PROD = true
    const originalMeta = (globalThis as any).importMeta;
    (globalThis as any).importMeta = { env: { PROD: true } };
    render(<App />);
    expect(screen.getByText('Welcome to Matterbridge')).toBeInTheDocument();
    if (originalMeta) (globalThis as any).importMeta = originalMeta;
    else delete (globalThis as any).importMeta;
  });
});

// Silence all console output during tests (must be before all imports)
globalThis.console = Object.assign({}, console, {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
});

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock dependencies BEFORE importing App
vi.mock('../src/components/Header', () => ({ default: () => <div>Header</div> }));
vi.mock('../src/components/Home', () => ({ default: () => <div>Home</div> }));
vi.mock('../src/components/Devices', () => ({ default: () => <div>Devices</div> }));
vi.mock('../src/components/Logs', () => ({ default: () => <div>Logs</div> }));
vi.mock('../src/components/Settings', () => ({ default: () => <div>Settings</div> }));
vi.mock('../src/components/Test', () => ({ default: () => <div>Test</div> }));
vi.mock('../src/components/WebSocketProvider', () => ({
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => <div>WebSocketProvider{children}</div>,
  WebSocketContext: React.createContext({ logAutoScroll: { current: true } } as any),
}));
vi.mock('../src/components/muiTheme', () => ({
  createMuiTheme: (primaryColor: string) => ({ theme: `mock-theme-${primaryColor}` }),
  getCssVariable: (name: string, def: string) => def,
}));

import App, { LoginForm, toggleDebug, debug } from '../src/App';

describe('toggleDebug', () => {
  it('toggles the debug flag', () => {
    const initial = debug;
    toggleDebug();
    expect(debug).toBe(!initial);
    toggleDebug();
    expect(debug).toBe(initial);
  });

  it('shows error on fetch !ok', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Forbidden',
      json: async () => ({ valid: false }),
    }) as unknown as typeof fetch;
    render(<App />);
    const input = screen.getByPlaceholderText('password') as HTMLInputElement;
    await act(async () => {
      fireEvent.input(input, { target: { value: 'wrong' } });
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    });
    await screen.findByText('Welcome to Matterbridge');
    expect(errorSpy).toHaveBeenCalledWith('Failed to log in:', 'Forbidden');
    errorSpy.mockRestore();
  });

  it('baseName: /matterbridge', async () => {
    const origLocation = window.location;
    // @ts-expect-error Vitest: need to delete window.location to mock it for router baseName test
    delete window.location;
    // Provide all required fields for URL creation
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/matterbridge/',
        href: 'http://localhost/matterbridge/',
        origin: 'http://localhost',
        host: 'localhost',
        protocol: 'http:',
        search: '',
        hash: '',
        toString: () => 'http://localhost/matterbridge/',
      },
      configurable: true,
      writable: true,
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true }),
    }) as unknown as typeof fetch;
    render(<App />);
    const input = screen.getByPlaceholderText('password') as HTMLInputElement;
    await act(async () => {
      fireEvent.input(input, { target: { value: 'test' } });
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    });
    expect(await screen.findByText('Header')).toBeInTheDocument();
    // Restore window.location using Object.defineProperty to avoid type errors
    Object.defineProperty(window, 'location', {
      value: origLocation,
      configurable: true,
      writable: true,
    });
  });

  it('baseName: /api/hassio_ingress/', async () => {
    const origLocation = window.location;
    // @ts-expect-error Vitest: need to delete window.location to mock it for router baseName test
    delete window.location;
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/api/hassio_ingress/abc',
        href: 'http://localhost/api/hassio_ingress/abc',
        origin: 'http://localhost',
        host: 'localhost',
        protocol: 'http:',
        search: '',
        hash: '',
        toString: () => 'http://localhost/api/hassio_ingress/abc',
      },
      configurable: true,
      writable: true,
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true }),
    }) as unknown as typeof fetch;
    render(<App />);
    const input = screen.getByPlaceholderText('password') as HTMLInputElement;
    await act(async () => {
      fireEvent.input(input, { target: { value: 'test' } });
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    });
    expect(await screen.findByText('Header')).toBeInTheDocument();
    Object.defineProperty(window, 'location', {
      value: origLocation,
      configurable: true,
      writable: true,
    });
  });
});

describe('App', () => {
  beforeEach(() => {
    // Ensure window.location is always defined for each test
    if (!window.location) {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/',
          href: 'http://localhost/',
          origin: 'http://localhost',
          host: 'localhost',
          protocol: 'http:',
          search: '',
          hash: '',
          toString: () => 'http://localhost/',
        },
        configurable: true,
        writable: true,
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders login form when not logged in', () => {
    render(<App />);
    expect(screen.getByText('Welcome to Matterbridge')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('shows error on incorrect password', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: false }),
    }) as unknown as typeof fetch;
    render(<App />);
    const input = screen.getByPlaceholderText('password') as HTMLInputElement;
    await act(async () => {
      fireEvent.input(input, { target: { value: 'wrong' } });
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    });
    await screen.findByText('Incorrect password!');
    expect(screen.getByText('Incorrect password!')).toBeInTheDocument();
  });

  it('renders main app after login', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true }),
    }) as unknown as typeof fetch;
    render(<App />);
    const input = screen.getByPlaceholderText('password') as HTMLInputElement;
    await act(async () => {
      fireEvent.input(input, { target: { value: 'test' } });
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    });
    expect(await screen.findByText('Header')).toBeInTheDocument();
    expect(screen.getByText('WebSocketProvider')).toBeInTheDocument();
    expect(screen.getByText('UiProvider')).toBeInTheDocument();
  });

  it('handles fetch error gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;
    render(<App />);
    const input = screen.getByPlaceholderText('password') as HTMLInputElement;
    await act(async () => {
      fireEvent.input(input, { target: { value: 'test' } });
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    });
    // Should not throw, but may log error
    await screen.findByText('Welcome to Matterbridge');
    expect(screen.getByText('Welcome to Matterbridge')).toBeInTheDocument();
  });

  it('renders LoginForm standalone', () => {
    const setLoggedIn = vi.fn();
    render(<LoginForm setLoggedIn={setLoggedIn} />);
    expect(screen.getByText('Welcome to Matterbridge')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });
});
