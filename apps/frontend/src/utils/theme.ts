// The theme applied on the body frontend-theme attribute
export type FrontendTheme = 'classic' | 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

// The media query followed by the 'auto' preference, null when not following it
let autoQuery: MediaQueryList | null = null;

// Re-apply the theme when the OS or browser color scheme changes
function handleColorSchemeChange(event: MediaQueryListEvent): void {
  document.body.setAttribute('frontend-theme', event.matches ? 'dark' : 'light');
}

/**
 * Resolve a stored theme preference to the theme applied on the body.
 * The 'auto' preference follows the OS or browser color scheme (dark or light).
 *
 * @param {string} preference The stored preference: 'classic', 'light', 'dark' or 'auto'.
 * @returns {FrontendTheme} The theme to apply. Unknown preferences resolve to 'dark'.
 */
export function resolveTheme(preference: string): FrontendTheme {
  if (preference === 'auto') return typeof window.matchMedia === 'function' && !window.matchMedia(DARK_QUERY).matches ? 'light' : 'dark';
  return preference === 'classic' || preference === 'light' ? preference : 'dark';
}

/**
 * Apply a theme preference to the body and, for 'auto', follow the OS or browser color scheme changes.
 * It is idempotent: calling it again replaces the previous color scheme listener.
 *
 * @param {string} preference The stored preference: 'classic', 'light', 'dark' or 'auto'.
 * @returns {FrontendTheme} The theme applied.
 */
export function applyThemePreference(preference: string): FrontendTheme {
  autoQuery?.removeEventListener('change', handleColorSchemeChange);
  autoQuery = null;
  if (preference === 'auto' && typeof window.matchMedia === 'function') {
    autoQuery = window.matchMedia(DARK_QUERY);
    autoQuery.addEventListener('change', handleColorSchemeChange);
  }
  const theme = resolveTheme(preference);
  document.body.setAttribute('frontend-theme', theme);
  return theme;
}
