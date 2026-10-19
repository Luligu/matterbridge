import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyThemePreference, resolveTheme } from '../src/utils/theme';

type ChangeListener = (event: MediaQueryListEvent) => void;

// Minimal controllable matchMedia: jsdom does not implement it
function mockMatchMedia(initialDark: boolean) {
  let matches = initialDark;
  const listeners = new Set<ChangeListener>();
  const mql = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn((_type: string, listener: ChangeListener) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: ChangeListener) => listeners.delete(listener)),
  };
  window.matchMedia = vi.fn(() => mql as unknown as MediaQueryList);
  const setDark = (dark: boolean) => {
    matches = dark;
    for (const listener of listeners) listener({ matches: dark } as MediaQueryListEvent);
  };
  return { mql, listeners, setDark };
}

describe('theme', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    document.body.removeAttribute('frontend-theme');
  });

  afterEach(() => {
    // Drop any 'auto' listener left by the test before restoring matchMedia
    applyThemePreference('dark');
    window.matchMedia = originalMatchMedia;
  });

  it('should resolve fixed preferences as is when not auto, and unknown ones to dark', () => {
    expect(resolveTheme('classic')).toBe('classic');
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('unknown')).toBe('dark');
  });

  it('should resolve auto from the color scheme, or to dark when matchMedia is missing', () => {
    mockMatchMedia(false);
    expect(resolveTheme('auto')).toBe('light');
    mockMatchMedia(true);
    expect(resolveTheme('auto')).toBe('dark');
    // @ts-expect-error jsdom: simulate a browser without matchMedia
    window.matchMedia = undefined;
    expect(resolveTheme('auto')).toBe('dark');
    expect(applyThemePreference('auto')).toBe('dark');
    expect(document.body.getAttribute('frontend-theme')).toBe('dark');
  });

  it('should follow color scheme changes when auto, and stop when a fixed theme is chosen', () => {
    const { listeners, setDark } = mockMatchMedia(true);

    expect(applyThemePreference('auto')).toBe('dark');
    expect(document.body.getAttribute('frontend-theme')).toBe('dark');
    expect(listeners.size).toBe(1);

    setDark(false);
    expect(document.body.getAttribute('frontend-theme')).toBe('light');
    setDark(true);
    expect(document.body.getAttribute('frontend-theme')).toBe('dark');

    // Applying auto again must not stack listeners
    applyThemePreference('auto');
    expect(listeners.size).toBe(1);

    expect(applyThemePreference('classic')).toBe('classic');
    expect(listeners.size).toBe(0);
    setDark(false);
    expect(document.body.getAttribute('frontend-theme')).toBe('classic');
  });
});
