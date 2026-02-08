// (imports below)
import '@testing-library/jest-dom';
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, it, beforeEach, afterEach, vi, expect } from 'vitest';
import { MbfScreen, MOBILE_HEIGHT_THRESHOLD, MOBILE_WIDTH_THRESHOLD, isMobile } from '../src/components/MbfScreen';
import { UiContext, UiContextType } from '../src/components/UiProvider';

// Mock WebSocketContext used by MbfScreen (logAutoScroll ref)
vi.mock('../src/components/WebSocketProvider', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  WebSocketContext: React.createContext({ logAutoScroll: { current: true } } as any),
}));

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

describe('MbfScreen', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn> | undefined;

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
    installAutoExit: true,
    setInstallAutoExit: vi.fn() as React.Dispatch<React.SetStateAction<boolean>>,
  });

  const renderWithContext = (mobile: boolean, children: React.ReactNode = <div>child</div>, setMobileFn = vi.fn()) =>
    render(
      <UiContext.Provider value={getMockUiContext(mobile, setMobileFn)}>
        <MbfScreen>{children}</MbfScreen>
      </UiContext.Provider>
    );

  const originalViewport = {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    visualViewport: window.visualViewport,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    debugValue = false;
    enableMobileValue = true;
    resetViewport();
  });

  afterEach(() => {
    consoleLogSpy?.mockRestore();
    resetViewport();
  });


  // Helper to mock window.visualViewport and window.innerWidth/innerHeight
  function setViewport(width: number, height: number, useVisualViewport = false) {
    if (useVisualViewport) {
      Object.defineProperty(window, 'visualViewport', {
        value: { width, height },
        configurable: true,
        writable: true,
      });
    } else {
      Object.defineProperty(window, 'visualViewport', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(window, 'innerWidth', {
        value: width,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: height,
        configurable: true,
        writable: true,
      });
    }
  }

  function resetViewport() {
    Object.defineProperty(window, 'innerWidth', {
      value: originalViewport.innerWidth,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: originalViewport.innerHeight,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'visualViewport', {
      value: originalViewport.visualViewport,
      configurable: true,
      writable: true,
    });
  }


  describe('isMobile', () => {
    it('returns true if width < threshold', () => {
      expect(MOBILE_WIDTH_THRESHOLD).toBe(1200);
      expect(MOBILE_HEIGHT_THRESHOLD).toBe(900);
      setViewport(1000, 1100);
      expect(isMobile()).toBe(true);
    });

    it('returns true if height < threshold', () => {
      setViewport(1400, 800);
      expect(isMobile()).toBe(true);
    });

    it('returns true if width and height < threshold', () => {
      setViewport(1199, 899);
      expect(isMobile()).toBe(true);
    });

    it('returns false if width and height >= threshold', () => {
      setViewport(1400, 1100);
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
    it('renders in debug mode', () => {
      debugValue = true;
      const { getByText } = renderWithContext(false, <div>debug</div>);
      expect(getByText('debug')).toBeInTheDocument();
    });

    it('renders non-enableMobile branch', () => {
      enableMobileValue = false;
      const { getByText } = renderWithContext(false, <div>non-mobile</div>);
      expect(getByText('non-mobile')).toBeInTheDocument();
    });
  });
  it('renders children and header', () => {
    const { getByTestId, getByText } = renderWithContext(false);
    expect(getByTestId('header')).toBeInTheDocument();
    expect(getByText('child')).toBeInTheDocument();
  });

  it('applies mobile layout when mobile=true and enableMobile=true', () => {
    enableMobileValue = true;
    const { container } = renderWithContext(true);
    const style = container.firstChild as HTMLElement;
    expect(style).toHaveStyle('display: flex');
    expect(style).toHaveStyle('flex-direction: column');
    expect(style).toHaveStyle('padding: 10px');
  });

  it('applies desktop layout when mobile=false', () => {
    const { container } = renderWithContext(false);
    const style = container.firstChild as HTMLElement;
    expect(style).toHaveStyle('width: calc(100vw - 40px)');
    expect(style).toHaveStyle('height: calc(100vh - 40px)');
    expect(style).toHaveStyle('padding: 20px');
  });

  it('uses desktop fallback sizing when mobile=true but enableMobile=false', () => {
    enableMobileValue = false;
    const { container } = renderWithContext(true);
    const style = container.firstChild as HTMLElement;
    expect(style).toHaveStyle(`width: ${MOBILE_WIDTH_THRESHOLD}px`);
    expect(style).toHaveStyle(`height: ${MOBILE_HEIGHT_THRESHOLD}px`);
  });

  it('calls setMobile on mount and on resize, and cleans up listener', async () => {
    setViewport(1400, 1100);
    const addListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener');
    const setMobile = vi.fn();

    const { unmount } = renderWithContext(false, undefined, setMobile);

    await waitFor(() => expect(setMobile).toHaveBeenCalledWith(false));
    expect(addListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    setViewport(1000, 800);
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(() => expect(setMobile).toHaveBeenCalledWith(true));

    unmount();
    expect(removeListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    addListenerSpy.mockRestore();
    removeListenerSpy.mockRestore();
  });
});
