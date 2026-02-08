import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ConditionalTooltip } from '../src/components/ConditionalTooltip';

describe('ConditionalTooltip', () => {
  it('does not show tooltip when not clipped', async () => {
    render(
      <ConditionalTooltip title="Alpha">
        <span>Alpha</span>
      </ConditionalTooltip>
    );

    const target = screen.getByLabelText('Alpha');
    Object.defineProperty(target, 'scrollWidth', { value: 50, configurable: true });
    Object.defineProperty(target, 'clientWidth', { value: 50, configurable: true });

    await act(async () => {
      fireEvent.mouseEnter(target);
    });

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('shows tooltip when clipped', async () => {
    render(
      <ConditionalTooltip title="Alpha">
        <span>Alpha</span>
      </ConditionalTooltip>
    );

    const target = screen.getByLabelText('Alpha');
    Object.defineProperty(target, 'scrollWidth', { value: 200, configurable: true });
    Object.defineProperty(target, 'clientWidth', { value: 50, configurable: true });

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
});
