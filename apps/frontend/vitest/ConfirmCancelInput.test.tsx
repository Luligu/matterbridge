/**
 * @file apps/frontend/vitest/ConfirmCancelInput.test.tsx
 * @description Tests the editable confirmation dialog
 * @author Copilot
 */

import '@testing-library/jest-dom';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ConfirmCancelInput } from '../src/components/ConfirmCancelInput';

vi.mock('../src/appState', () => ({ debug: false }));

describe('ConfirmCancelInput', () => {
  afterEach(cleanup);

  test('should not render when closed', () => {
    render(<ConfirmCancelInput open={false} title="Edit name" message="Enter a new name" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('should enable OK only while the text differs from its initial value', () => {
    const onConfirm = vi.fn();
    render(<ConfirmCancelInput open title="Edit name" message="Enter a new name" initialValue="Original" label="Name" onConfirm={onConfirm} onCancel={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: 'Name' });
    const button = screen.getByRole('button', { name: 'OK' });
    expect(screen.getByText('Edit name')).toBeInTheDocument();
    expect(screen.getByText('Enter a new name')).toBeInTheDocument();
    expect(input).toHaveValue('Original');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'Updated' } });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith('Updated');

    fireEvent.change(input, { target: { value: 'Original' } });
    expect(button).toBeDisabled();
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
    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith('New');
  });

  test('should reset edits when reopened or given a different initial value', () => {
    const props = { title: 'Edit', message: 'Message', initialValue: 'Original', onConfirm: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(<ConfirmCancelInput {...props} open />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsaved' } });
    rerender(<ConfirmCancelInput {...props} open={false} />);
    rerender(<ConfirmCancelInput {...props} open />);
    expect(screen.getByRole('textbox')).toHaveValue('Original');
    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsaved' } });
    rerender(<ConfirmCancelInput {...props} initialValue="Another" open />);
    expect(screen.getByRole('textbox')).toHaveValue('Another');
    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
  });
});
