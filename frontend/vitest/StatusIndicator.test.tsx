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
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StatusIndicator } from '../src/components/StatusIndicator';

// Helper to get element by text
const getByText = (text: string) => screen.getByText(text);

describe('StatusIndicator', () => {
  it('renders nothing if status is undefined', () => {
    const { container } = render(<StatusIndicator status={undefined} />);
    // Should render an empty div
    expect(container.querySelector('div')).toBeInTheDocument();
    expect(container.querySelector('div')?.textContent).toBe('');
  });

  it('renders enabled text when status is true', () => {
    render(<StatusIndicator status={true} enabledText="Online" />);
    expect(getByText('Online')).toBeInTheDocument();
  });

  it('renders disabled text when status is false', () => {
    render(<StatusIndicator status={false} enabledText="Online" disabledText="Offline" />);
    expect(getByText('Offline')).toBeInTheDocument();
  });

  it('renders enabled text as fallback if disabledText is not provided', () => {
    render(<StatusIndicator status={false} enabledText="Online" />);
    expect(getByText('Online')).toBeInTheDocument();
  });

  it('shows tooltip when tooltipText is provided', async () => {
    render(<StatusIndicator status={true} tooltipText="Tooltip info" />);
    // Tooltip is rendered on hover, but MUI renders it in the DOM
    // Simulate hover
    fireEvent.mouseOver(screen.getByText('Enabled'));
    // Tooltip should be in the document
    expect(await screen.findByText('Tooltip info')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<StatusIndicator status={true} onClick={handleClick} />);
    fireEvent.click(screen.getByText('Enabled'));
    expect(handleClick).toHaveBeenCalled();
  });
});
