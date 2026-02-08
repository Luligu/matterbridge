// Silence all console output during tests (must be before all imports)
globalThis.console = Object.assign({}, console, {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
});

import { describe, it, vi, expect } from 'vitest';
import { cleanup } from '@testing-library/react';

describe('main.tsx', () => {
  it('renders without crashing', async () => {
    // Create a root element for ReactDOM
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
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
});
