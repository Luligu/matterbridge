import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';

vi.mock('@mui/material/Dialog', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid='dialog'>{children}</div> : null),
}));

vi.mock('@mui/material/DialogTitle', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@mui/material/DialogContent', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@mui/material/Button', () => ({
  default: ({ children, onClick }: { children: React.ReactNode; onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void }) => <button onClick={onClick}>{children}</button>,
}));

async function loadConfirmCancelForm(debug = false) {
  vi.resetModules();
  vi.doMock('../src/App', () => ({ debug }));
  return import('../src/components/ConfirmCancelForm');
}

describe('ConfirmCancelForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when closed', async () => {
    const { ConfirmCancelForm } = await loadConfirmCancelForm();

    render(<ConfirmCancelForm open={false} title='Title' message='Message' onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('renders title and message and calls handlers without debug logging', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { ConfirmCancelForm } = await loadConfirmCancelForm(false);

    render(<ConfirmCancelForm open={true} title='Delete Device' message='Are you sure?' onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByText('Delete Device')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('logs confirm and cancel actions when debug is enabled', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { ConfirmCancelForm } = await loadConfirmCancelForm(true);

    render(<ConfirmCancelForm open={true} title='Debug Title' message='Debug Message' onConfirm={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(consoleSpy).toHaveBeenCalledWith('Confirmed');
    expect(consoleSpy).toHaveBeenCalledWith('Canceled');
  });
});
