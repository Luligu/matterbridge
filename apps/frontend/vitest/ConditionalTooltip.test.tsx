import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

async function loadConditionalTooltip() {
  return import('../src/components/ConditionalTooltip');
}

describe('ConditionalTooltip', () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
    vi.doUnmock('react');
  });

  it('does not show tooltip when not clipped', async () => {
    const { ConditionalTooltip, shouldTooltipOpen } = await loadConditionalTooltip();

    expect(shouldTooltipOpen(null)).toBe(false);

    render(
      <ConditionalTooltip title="Alpha">
        <span>Alpha</span>
      </ConditionalTooltip>
    );

    const target = screen.getByLabelText('Alpha');
    Object.defineProperty(target, 'scrollWidth', { value: 50, configurable: true });
    Object.defineProperty(target, 'clientWidth', { value: 50, configurable: true });
    target.getBoundingClientRect = () =>
      ({
        width: 100,
        height: 20,
        top: 0,
        left: 0,
        bottom: 20,
        right: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    await act(async () => {
      fireEvent.mouseEnter(target);
    });

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('shows tooltip when clipped', async () => {
    const { ConditionalTooltip } = await loadConditionalTooltip();

    render(
      <ConditionalTooltip title="Alpha">
        <span>Alpha</span>
      </ConditionalTooltip>
    );

    const target = screen.getByLabelText('Alpha');
    Object.defineProperty(target, 'scrollWidth', { value: 200, configurable: true });
    Object.defineProperty(target, 'clientWidth', { value: 50, configurable: true });
    target.getBoundingClientRect = () =>
      ({
        width: 100,
        height: 20,
        top: 0,
        left: 0,
        bottom: 20,
        right: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    await act(async () => {
      fireEvent.mouseEnter(target);
    });

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Alpha');

    await act(async () => {
      fireEvent.mouseLeave(target);
    });

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('does not open the tooltip when the internal ref is unavailable', async () => {
    const { shouldTooltipOpen } = await loadConditionalTooltip();

    expect(
      shouldTooltipOpen({
        scrollWidth: 100,
        clientWidth: 100,
      } as HTMLSpanElement)
    ).toBe(false);
  });
});
