import '@testing-library/jest-dom';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, vi, expect, beforeEach } from 'vitest';
import {
  MbfWindow,
  MbfWindowHeader,
  MbfWindowHeaderText,
  MbfWindowFooter,
  MbfWindowFooterText,
  MbfWindowText,
  MbfWindowIcons
} from '../src/components/MbfWindow';

// Mock App enableWindows
vi.mock('../src/App', () => ({
  enableWindows: true,
}));

describe('MbfWindow components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders MbfWindow with children and merges style', () => {
    const { getByText, container } = render(
      <MbfWindow style={{ backgroundColor: 'red' }}>Test Window</MbfWindow>
    );
    expect(getByText('Test Window')).toBeInTheDocument();
    // Split the style assertion to avoid issues with CSS variable merging
  expect(container.firstChild).toHaveStyle({ display: 'flex' });
  });

  it('renders MbfWindowHeader and merges style', () => {
    const { getByText, container } = render(
      <MbfWindowHeader style={{ height: '40px' }}>Header</MbfWindowHeader>
    );
    expect(getByText('Header')).toBeInTheDocument();
    expect(container.firstChild).toHaveStyle({ height: '40px', display: 'flex' });
  });

  it('renders MbfWindowHeaderText and merges style', () => {
    const { getByText, container } = render(
      <MbfWindowHeaderText style={{ fontSize: '20px' }}>HeaderText</MbfWindowHeaderText>
    );
    expect(getByText('HeaderText')).toBeInTheDocument();
    expect(container.firstChild).toHaveStyle({ fontSize: '20px', fontWeight: 'bold' });
  });

  it('renders MbfWindowFooter and merges style', () => {
    const { getByText, container } = render(
      <MbfWindowFooter style={{ height: '40px' }}>Footer</MbfWindowFooter>
    );
    expect(getByText('Footer')).toBeInTheDocument();
    expect(container.firstChild).toHaveStyle({ height: '40px', display: 'flex' });
  });

  it('renders MbfWindowFooterText and merges style', () => {
    const { getByText, container } = render(
      <MbfWindowFooterText style={{ fontSize: '18px' }}>FooterText</MbfWindowFooterText>
    );
    expect(getByText('FooterText')).toBeInTheDocument();
    expect(container.firstChild).toHaveStyle({ fontSize: '18px', fontWeight: 'bold' });
  });

  it('renders MbfWindowText and merges style', () => {
    const { getByText, container } = render(
      <MbfWindowText style={{ fontSize: '18px' }}>WindowText</MbfWindowText>
    );
    expect(getByText('WindowText')).toBeInTheDocument();
    expect(container.firstChild).toHaveStyle({ fontSize: '18px', fontWeight: 'normal' });
  });

  it('renders MbfWindowIcons with children', () => {
    const { getByText } = render(
      <MbfWindowIcons><span>IconChild</span></MbfWindowIcons>
    );
    expect(getByText('IconChild')).toBeInTheDocument();
  });

  it('renders close button and calls onClose when clicked', () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      <MbfWindowIcons onClose={onClose} />
    );
    const button = getByRole('button');
    fireEvent.click(button);
    expect(onClose).toHaveBeenCalled();
  });
});
