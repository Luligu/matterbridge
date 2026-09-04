// Silence all console output during tests (must be before all imports)
globalThis.console = Object.assign({}, console, {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
});

import { cleanup } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';

describe('main.tsx', () => {
  it('renders without crashing', async () => {
    // Create a root element for ReactDOM
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
    vi.resetModules();
    let error;
    try {
      await import('../src/main');
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    cleanup();
    document.body.removeChild(root);
  });

  it('throws when the root element is missing', async () => {
    // No #root element appended to document.body
    vi.resetModules();
    let error: unknown;
    try {
      await import('../src/main');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Root element not found');
  });
});
