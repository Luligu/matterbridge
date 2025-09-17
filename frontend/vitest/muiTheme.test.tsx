// Silence all console output during tests (must be before all imports)
globalThis.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
};
import { vi, describe, it, expect } from 'vitest';
import { createMuiTheme, getCssVariable } from '../src/components/muiTheme';

// Mock getComputedStyle for getCssVariable
const originalGetComputedStyle = window.getComputedStyle;

describe('muiTheme', () => {
  afterEach(() => {
    window.getComputedStyle = originalGetComputedStyle;
  });

  it('getCssVariable returns value from CSS', () => {
    window.getComputedStyle = vi.fn().mockReturnValue({
      getPropertyValue: (name: string) => name === '--primary-color' ? 'red' : '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
    expect(getCssVariable('--primary-color', 'blue')).toBe('red');
  });

  it('getCssVariable returns default if not set', () => {
    window.getComputedStyle = vi.fn().mockReturnValue({
      getPropertyValue: () => '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
    expect(getCssVariable('--not-set', 'fallback')).toBe('fallback');
  });

  it('createMuiTheme returns theme with correct primary color', () => {
    const theme = createMuiTheme('#123456');
    expect(theme.palette.primary.main).toBe('#123456');
    expect(theme.typography.fontFamily).toContain('Roboto');
  });
});
