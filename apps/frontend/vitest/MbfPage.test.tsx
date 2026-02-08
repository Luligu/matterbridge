import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { describe, it, beforeEach, vi, expect } from 'vitest';
import { MbfPage } from '../src/components/MbfPage';
import { UiContext, UiContextType } from '../src/components/UiProvider';

// Mock App debug
vi.mock('../src/App', () => ({
  debug: false,
}));

describe('MbfPage', () => {
  const getMockUiContext = (setCurrentPage = vi.fn()): UiContextType => ({
    mobile: false,
    setMobile: vi.fn(),
    currentPage: null,
    setCurrentPage,
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children and applies default style', () => {
    const setCurrentPage = vi.fn();
    const { getByText, container } = render(
      <UiContext.Provider value={getMockUiContext(setCurrentPage)}>
        <MbfPage name="TestPage">Hello World</MbfPage>
      </UiContext.Provider>
    );
    expect(getByText('Hello World')).toBeInTheDocument();
    const div = container.firstChild as HTMLElement;
    expect(div).toHaveStyle({ display: 'flex', flexDirection: 'column', width: '100%' });
  });

  it('calls setCurrentPage with name', () => {
    const setCurrentPage = vi.fn();
    render(
      <UiContext.Provider value={getMockUiContext(setCurrentPage)}>
        <MbfPage name="MyPage">Content</MbfPage>
      </UiContext.Provider>
    );
    expect(setCurrentPage).toHaveBeenCalledWith('MyPage');
  });

  it('merges custom style with default', () => {
    const setCurrentPage = vi.fn();
    const customStyle = { background: 'red', width: '80%' };
    const { container } = render(
      <UiContext.Provider value={getMockUiContext(setCurrentPage)}>
        <MbfPage name="StyledPage" style={customStyle}>Styled</MbfPage>
      </UiContext.Provider>
    );
    const div = container.firstChild as HTMLElement;
    expect(div).toHaveStyle({ background: 'red', width: '80%' });
    expect(div).toHaveStyle({ display: 'flex', flexDirection: 'column' });
  });
});
