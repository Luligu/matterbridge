import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock getComputedStyle for getCssVariable
const originalGetComputedStyle = window.getComputedStyle;

async function loadMuiTheme(debug = false) {
  vi.resetModules();
  vi.doMock('../src/App', () => ({ debug }));
  return import('../src/utils/muiTheme');
}

describe('muiTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.getComputedStyle = originalGetComputedStyle;
  });

  it('getCssVariable returns value from CSS', async () => {
    const { getCssVariable } = await loadMuiTheme();
    window.getComputedStyle = vi.fn().mockReturnValue({
      getPropertyValue: (name: string) => name === '--primary-color' ? 'red' : '',
    }) as any;
    expect(getCssVariable('--primary-color', 'blue')).toBe('red');
  });

  it('getCssVariable logs when debug is enabled', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { getCssVariable } = await loadMuiTheme(true);

    window.getComputedStyle = vi.fn().mockReturnValue({
      getPropertyValue: () => ' teal ',
    }) as any;

    expect(getCssVariable('--primary-color', 'blue')).toBe('teal');
    expect(consoleSpy).toHaveBeenCalledWith('getCssVariable:', '--primary-color', 'defaultValue', 'blue');
  });

  it('getCssVariable returns default if not set', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { getCssVariable } = await loadMuiTheme();
    window.getComputedStyle = vi.fn().mockReturnValue({
      getPropertyValue: () => '',
    }) as any;
    expect(getCssVariable('--not-set', 'fallback')).toBe('fallback');
    expect(errorSpy).toHaveBeenCalledWith('getCssVariable: undefined', '');
  });

  it('createMuiTheme returns theme with correct primary color', async () => {
    const { createMuiTheme } = await loadMuiTheme();
    const theme = createMuiTheme('#123456');
    expect(theme.palette.primary.main).toBe('#123456');
    expect(theme.typography.fontFamily).toContain('Roboto');
  });
});
