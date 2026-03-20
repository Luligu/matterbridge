import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mui/material/Dialog', () => ({
  default: ({ open, onClose, children }: { open: boolean; onClose?: (event: unknown, reason: string) => void; children: React.ReactNode }) => {
    if (!open) return null;

    return (
      <div data-testid='dialog'>
        {children}
        <button onClick={() => onClose?.({}, 'backdropClick')}>Backdrop Close</button>
        <button onClick={() => onClose?.({}, 'escapeKeyDown')}>Escape Close</button>
        <button onClick={() => onClose?.({}, 'closeButton')}>Dialog Close</button>
      </div>
    );
  },
}));

vi.mock('@mui/material/Button', () => ({
  default: ({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button data-disabled={disabled ? 'true' : 'false'} onClick={onClick}>
      {children}
    </button>
  ),
}));

import { ChangePasswordDialog } from '../src/components/ChangePasswordDialog';

describe('ChangePasswordDialog', () => {
  it('does not render when closed', () => {
    render(<ChangePasswordDialog open={false} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('prevents backdrop and escape close, but allows explicit dialog close', () => {
    const onClose = vi.fn();

    render(<ChangePasswordDialog open={true} onClose={onClose} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Backdrop Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Escape Close' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Dialog Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles cancel, validation error, successful save, and reset', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(<ChangePasswordDialog open={true} onClose={onClose} onSave={onSave} />);

    const newPasswordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const changeButton = screen.getByRole('button', { name: 'Change' });
    const resetButton = screen.getByRole('button', { name: 'Reset' });

    expect(changeButton).toHaveAttribute('data-disabled', 'true');

    fireEvent.click(cancelButton);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.change(newPasswordInput, { target: { value: 'alpha' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'beta' } });

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(changeButton).toHaveAttribute('data-disabled', 'true');

    fireEvent.click(changeButton);
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(confirmPasswordInput, { target: { value: 'alpha' } });

    expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument();
  expect(changeButton).toHaveAttribute('data-disabled', 'false');

    fireEvent.click(changeButton);
    expect(onSave).toHaveBeenNthCalledWith(1, 'alpha');
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(resetButton);
    expect(onSave).toHaveBeenNthCalledWith(2, '');
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
