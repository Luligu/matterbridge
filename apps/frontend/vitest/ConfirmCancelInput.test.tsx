/**
 * @file apps/frontend/vitest/ConfirmCancelInput.test.tsx
 * @description Tests the editable confirmation dialog
 * @author Copilot
 */

import '@testing-library/jest-dom';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ConfirmCancelInput } from '../src/components/ConfirmCancelInput';

const appState = vi.hoisted(() => ({ debug: false }));

vi.mock('../src/appState', () => appState);

describe('ConfirmCancelInput', () => {
  afterEach(() => {
    cleanup();
    appState.debug = false;
    vi.restoreAllMocks();
  });

  test('should not render when closed', () => {
    render(<ConfirmCancelInput open={false} title="Edit name" message="Enter a new name" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('should confirm the initial value or the edited value', () => {
    const onConfirm = vi.fn();
    render(<ConfirmCancelInput open title="Edit name" message="Enter a new name" initialValue="Original" label="Name" onConfirm={onConfirm} onCancel={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: 'Name' });
    const button = screen.getByRole('button', { name: 'OK' });
    expect(screen.getByText('Edit name')).toBeInTheDocument();
    expect(screen.getByText('Enter a new name')).toBeInTheDocument();
    expect(input).toHaveValue('Original');
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenLastCalledWith('Original');

    fireEvent.change(input, { target: { value: 'Updated' } });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenLastCalledWith('Updated');
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  test('should allow clearing an existing value and cancel without confirming', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmCancelInput open title="Edit" message="Message" initialValue="Original" onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'OK' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('should start empty and confirm the entered value when no initial value is provided', () => {
    const onConfirm = vi.fn();
    render(<ConfirmCancelInput open title="Edit" message="Message" onConfirm={onConfirm} onCancel={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Value' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'OK' })).toBeEnabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith('New');
  });

  test.each([
    { debug: false, expectedLogs: [] },
    { debug: true, expectedLogs: [['Confirmed'], ['Canceled']] },
  ])('should log confirm and cancel actions only when debug is enabled (debug=$debug)', ({ debug, expectedLogs }) => {
    appState.debug = debug;
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmCancelInput open title="Edit" message="Message" onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith('Updated');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls).toEqual(expectedLogs);
  });

  test('should reset edits when reopened or given a different initial value', () => {
    const props = { title: 'Edit', message: 'Message', initialValue: 'Original', onConfirm: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(<ConfirmCancelInput {...props} open />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsaved' } });
    rerender(<ConfirmCancelInput {...props} open={false} />);
    rerender(<ConfirmCancelInput {...props} open />);
    expect(screen.getByRole('textbox')).toHaveValue('Original');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsaved' } });
    rerender(<ConfirmCancelInput {...props} initialValue="Another" open />);
    expect(screen.getByRole('textbox')).toHaveValue('Another');
  });
});
