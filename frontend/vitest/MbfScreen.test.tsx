// (imports below)
import '@testing-library/jest-dom';
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, beforeEach, vi, expect } from 'vitest';
import { MbfScreen, MOBILE_HEIGHT_THRESHOLD, MOBILE_WIDTH_THRESHOLD, isMobile } from '../src/components/MbfScreen';
import { UiContext, UiContextType } from '../src/components/UiProvider';

// Mock App debug and enableMobile with a factory so we can control per test
let debugValue = false;
let enableMobileValue = true;
vi.mock('../src/App', () => ({
  get debug() { return debugValue; },
  get enableMobile() { return enableMobileValue; },
}));

// Mock Header to avoid rendering its internals
vi.mock('../src/components/Header', () => ({
  default: () => <div data-testid="header" />,
}));

// Mock App debug and enableMobile
vi.mock('../src/App', () => ({
  debug: false,
  enableMobile: true,
}));

describe('MbfScreen', () => {
  const getMockUiContext = (mobile: boolean, setMobile = vi.fn()): UiContextType => ({
    mobile,
    setMobile,
    currentPage: null,
    setCurrentPage: vi.fn(),
    showSnackbarMessage: vi.fn(),
    closeSnackbarMessage: vi.fn(),
    closeSnackbar: vi.fn(),
    showConfirmCancelDialog: vi.fn(),
    showInstallProgress: vi.fn(),
    exitInstallProgressSuccess: vi.fn(),
    exitInstallProgressError: vi.fn(),
    hideInstallProgress: vi.fn(),
    addInstallProgress: vi.fn(),
  });

  const renderWithContext = (mobile: boolean, children: React.ReactNode = <div>child</div>, setMobileFn = vi.fn()) =>
    render(
      <UiContext.Provider value={getMockUiContext(mobile, setMobileFn)}>
        <MbfScreen>{children}</MbfScreen>
      </UiContext.Provider>
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });


  // Helper to mock window.visualViewport and window.innerWidth/innerHeight
  function setViewport(width: number, height: number, useVisualViewport = false) {
    if (useVisualViewport) {
      Object.defineProperty(window, 'visualViewport', {
        value: { width, height },
        configurable: true,
      });
    } else {
      Object.defineProperty(window, 'visualViewport', {
        value: undefined,
        configurable: true,
      });
      Object.defineProperty(window, 'innerWidth', {
        value: width,
        configurable: true,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: height,
        configurable: true,
      });
    }
  }


  describe('isMobile', () => {
    it('returns true if width < threshold', () => {
      setViewport(1000, 900);
      expect(MOBILE_WIDTH_THRESHOLD).toBe(1200);
      expect(MOBILE_HEIGHT_THRESHOLD).toBe(800);
      expect(isMobile()).toBe(true);
    });

    it('returns true if height < threshold', () => {
      setViewport(1300, 700);
      expect(isMobile()).toBe(true);
    });

    it('returns false if width and height >= threshold', () => {
      setViewport(1300, 900);
      expect(isMobile()).toBe(false);
    });

    it('uses visualViewport if present', () => {
      setViewport(1000, 700, true);
      expect(isMobile()).toBe(true);
    });

    it('returns false if window is undefined', () => {
      const origWindow = global.window;
      // @ts-expect-error window is intentionally deleted for this test
      delete global.window;
      expect(isMobile()).toBe(false);
      global.window = origWindow;
    });
  });


  describe('MbfScreen debug and non-enableMobile branch', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('renders in debug mode', () => {
      debugValue = true;
      enableMobileValue = true;
      const { getByText } = render(
        <UiContext.Provider value={{
          mobile: false,
          setMobile: vi.fn(),
          currentPage: null,
          setCurrentPage: vi.fn(),
          showSnackbarMessage: vi.fn(),
          closeSnackbarMessage: vi.fn(),
          closeSnackbar: vi.fn(),
          showConfirmCancelDialog: vi.fn(),
          showInstallProgress: vi.fn(),
          exitInstallProgressSuccess: vi.fn(),
          exitInstallProgressError: vi.fn(),
          hideInstallProgress: vi.fn(),
          addInstallProgress: vi.fn(),
        }}>
          <MbfScreen>debug</MbfScreen>
        </UiContext.Provider>
      );
      expect(getByText('debug')).toBeInTheDocument();
      debugValue = false;
      enableMobileValue = true;
    });

    it('renders non-enableMobile branch', () => {
      enableMobileValue = false;
      const { getByText } = render(
        <UiContext.Provider value={{
          mobile: false,
          setMobile: vi.fn(),
          currentPage: null,
          setCurrentPage: vi.fn(),
          showSnackbarMessage: vi.fn(),
          closeSnackbarMessage: vi.fn(),
          closeSnackbar: vi.fn(),
          showConfirmCancelDialog: vi.fn(),
          showInstallProgress: vi.fn(),
          exitInstallProgressSuccess: vi.fn(),
          exitInstallProgressError: vi.fn(),
          hideInstallProgress: vi.fn(),
          addInstallProgress: vi.fn(),
        }}>
          <MbfScreen>non-mobile</MbfScreen>
        </UiContext.Provider>
      );
      expect(getByText('non-mobile')).toBeInTheDocument();
      enableMobileValue = true;
    });
  });
  it('renders children and header', () => {
    const { getByTestId, getByText } = renderWithContext(false);
    expect(getByTestId('header')).toBeInTheDocument();
    expect(getByText('child')).toBeInTheDocument();
  });

    it('applies mobile layout when mobile=true', () => {
      const { container } = renderWithContext(true);
      const style = container.firstChild as HTMLElement;
      expect(style).toHaveStyle(`width: calc(100vw - 60px)`);
      expect(style).toHaveStyle(`height: ${MOBILE_HEIGHT_THRESHOLD}px`);
    });

    it('applies desktop layout when mobile=false', () => {
      const { container } = renderWithContext(false);
      const style = container.firstChild as HTMLElement;
      expect(style).toHaveStyle(`width: calc(100vw - 40px)`);
      expect(style).toHaveStyle(`height: calc(100vh - 40px)`);
    });

    it('calls setMobile on resize', () => {
      const setMobile = vi.fn();
      renderWithContext(false, undefined, setMobile);
      window.dispatchEvent(new Event('resize'));
      expect(setMobile).toHaveBeenCalled();
    });
  });
