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
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TruncatedText } from '../src/components/TruncatedText';


describe('TruncatedText', () => {
  it('renders full text if under maxChars', () => {
    render(<TruncatedText value="Hello" maxChars={10} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders truncated text if over maxChars', () => {
    render(<TruncatedText value="HelloWorldTest" maxChars={8} />);
    // Should show something like "Hell … Test"
    expect(screen.getByText(/…/)).toBeInTheDocument();
  });

  it('shows tooltip if text is truncated', async () => {
    render(<TruncatedText value="HelloWorldTest" maxChars={8} />);
    // Tooltip is rendered on hover, but MUI renders it in the DOM
    // Simulate hover
    screen.getByText(/…/).dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(await screen.findByText('HelloWorldTest')).toBeInTheDocument();
  });

  it('does not show tooltip if text is not truncated', () => {
    render(<TruncatedText value="Hello" maxChars={10} />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
