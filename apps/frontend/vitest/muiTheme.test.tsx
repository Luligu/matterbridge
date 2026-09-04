import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import Select from '@mui/material/Select';
import { ThemeProvider } from '@mui/material/styles';
import Switch from '@mui/material/Switch';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock getComputedStyle for getCssVariable
const originalGetComputedStyle = window.getComputedStyle;

async function loadMuiTheme(debug = false) {
  vi.resetModules();
  vi.doMock('../src/appState', () => ({ debug }));
  return import('../src/utils/muiTheme');
}

describe('muiTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.getComputedStyle = originalGetComputedStyle;
  });

  it('getCssVariable returns value from CSS', async () => {
    const { getCssVariable } = await loadMuiTheme();
    window.getComputedStyle = vi.fn().mockReturnValue({
      getPropertyValue: (name: string) => (name === '--primary-color' ? 'red' : ''),
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

  // The palette entries are CSS variables. MUI passes some palette colors through alpha(), which
  // parses colors numerically and throws on a var() string, so rendering has to be exercised here:
  // a theme that only builds fine can still take the whole frontend down at style serialization.
  it('renders the components that pass palette colors through alpha()', async () => {
    const { createMuiTheme } = await loadMuiTheme();
    const theme = createMuiTheme('#123456');

    expect(() =>
      render(
        <ThemeProvider theme={theme}>
          <IconButton />
          <Checkbox />
          <Radio />
          <Switch />
          <Select value="a" labelId="l" id="i">
            <MenuItem value="a">a</MenuItem>
          </Select>
        </ThemeProvider>,
      ),
    ).not.toThrow();
  });

  it('themes the Select dropdown arrow', async () => {
    const { createMuiTheme } = await loadMuiTheme();
    render(
      <ThemeProvider theme={createMuiTheme('#123456')}>
        <Select value="a" labelId="l" id="i">
          <MenuItem value="a">a</MenuItem>
        </Select>
      </ThemeProvider>,
    );
    const icon = document.querySelector('.MuiSelect-icon');
    expect(icon).not.toBeNull();
    expect(getComputedStyle(icon as Element).color).toBe('var(--main-label-color)');
  });
});
