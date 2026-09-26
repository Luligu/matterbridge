import '@testing-library/jest-dom';

import Dialog from '@mui/material/Dialog';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { NetworkConfigDialog } from '../src/components/NetworkConfigDialog';

vi.mock('@mui/material/Dialog', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mui/material/Dialog')>();
  return { ...original, default: vi.fn((props: React.ComponentProps<typeof original.default>) => <original.default {...props} />) };
});

type DialogOptions = Pick<React.ComponentProps<typeof NetworkConfigDialog>, 'open' | 'ip'>;

function renderDialog(options: Partial<DialogOptions> = {}) {
  const onClose = vi.fn();
  const onSave = vi.fn();
  const view = (overrides: Partial<DialogOptions> = {}) => <NetworkConfigDialog open {...options} {...overrides} onClose={onClose} onSave={onSave} />;
  const result = render(view());
  return { ...result, onClose, onSave, rerenderDialog: (overrides: Partial<DialogOptions>) => result.rerender(view(overrides)) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  act(() => {
    vi.runOnlyPendingTimers();
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('NetworkConfigDialog', () => {
  test('should render the title, logo, and DHCP controls when opened', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Matterbridge Logo Network Configuration');
    expect(screen.getByRole('img', { name: 'Matterbridge Logo' })).toHaveAttribute('src', 'matterbridge.svg');
    expect(screen.getByRole('group', { name: 'Select IP Configuration' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'DHCP' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Static' })).not.toBeChecked();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(vi.mocked(Dialog).mock.calls.at(-1)?.[0]).toMatchObject({ maxWidth: 'sm', style: { maxWidth: '550px', margin: 'auto' } });
  });

  test('should respect the open prop without invoking callbacks when visibility changes', () => {
    const { rerenderDialog, onClose, onSave } = renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerenderDialog({ open: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    rerenderDialog({ open: false });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  test.each([
    { ip: undefined, expectedIp: '', gateway: '' },
    { ip: '', expectedIp: '', gateway: '' },
    { ip: '192.168.10.42', expectedIp: '192.168.10.42', gateway: '192.168.10.1' },
    { ip: '10.20.30.99', expectedIp: '10.20.30.99', gateway: '10.20.30.1' },
  ])('should initialize static defaults when ip=$ip', ({ ip, expectedIp, gateway }) => {
    const { onSave, onClose } = renderDialog({ ip });
    fireEvent.click(screen.getByRole('radio', { name: 'Static' }));
    expect(screen.getByRole('radio', { name: 'Static' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'DHCP' })).not.toBeChecked();
    expect(screen.getByRole('textbox', { name: 'IP Address' })).toHaveValue(expectedIp);
    expect(screen.getByRole('textbox', { name: 'Subnet Mask' })).toHaveValue('255.255.255.0');
    expect(screen.getByRole('textbox', { name: 'Gateway' })).toHaveValue(gateway);
    expect(screen.getByRole('textbox', { name: 'DNS Server' })).toHaveValue(gateway);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ type: 'static', ip: expectedIp, subnet: '255.255.255.0', gateway, dns: gateway });
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
  });

  test('should save DHCP with the initial configuration before closing when Save is clicked', () => {
    const { onSave, onClose } = renderDialog({ ip: '192.168.1.25' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ type: 'dhcp', ip: '192.168.1.25', subnet: '255.255.255.0', gateway: '192.168.1.1', dns: '192.168.1.1' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
  });

  test.each(['static', 'dhcp'])('should preserve every edited field when switching modes and saving %s', (type) => {
    const { onSave, onClose } = renderDialog({ ip: '192.168.1.25' });
    fireEvent.click(screen.getByRole('radio', { name: 'Static' }));
    const fields = [
      ['IP Address', '10.0.0.20'],
      ['Subnet Mask', '255.255.0.0'],
      ['Gateway', '10.0.0.1'],
      ['DNS Server', '1.1.1.1'],
    ];
    for (const [name, value] of fields) fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
    fireEvent.click(screen.getByRole('radio', { name: 'DHCP' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Static' }));
    for (const [name, value] of fields) expect(screen.getByRole('textbox', { name })).toHaveValue(value);
    fireEvent.click(screen.getByRole('radio', { name: type === 'static' ? 'Static' : 'DHCP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ type, ip: '10.0.0.20', subnet: '255.255.0.0', gateway: '10.0.0.1', dns: '1.1.1.1' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  test('should pass cleared static fields through unchanged when saved', () => {
    const { onSave } = renderDialog({ ip: '192.168.1.25' });
    fireEvent.click(screen.getByRole('radio', { name: 'Static' }));
    for (const textbox of screen.getAllByRole('textbox')) fireEvent.change(textbox, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ type: 'static', ip: '', subnet: '', gateway: '', dns: '' });
  });

  test('should close without saving and retain draft state when the same component is reopened', () => {
    const { onSave, onClose, rerenderDialog } = renderDialog({ ip: '192.168.1.25' });
    fireEvent.click(screen.getByRole('radio', { name: 'Static' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'IP Address' }), { target: { value: '192.168.1.99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
    rerenderDialog({ open: false });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    rerenderDialog({ open: true, ip: '10.0.0.25' });
    expect(screen.getByRole('radio', { name: 'Static' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'IP Address' })).toHaveValue('192.168.1.99');
    expect(screen.getByRole('textbox', { name: 'Gateway' })).toHaveValue('192.168.1.1');
    expect(screen.getByRole('textbox', { name: 'DNS Server' })).toHaveValue('192.168.1.1');
  });

  test('should ignore changed IP props after initialization and use fresh defaults after remounting', () => {
    const { rerenderDialog, unmount } = renderDialog({ ip: '192.168.1.25' });
    rerenderDialog({ ip: '10.0.0.25' });
    fireEvent.click(screen.getByRole('radio', { name: 'Static' }));
    expect(screen.getByRole('textbox', { name: 'IP Address' })).toHaveValue('192.168.1.25');
    unmount();
    renderDialog({ ip: '10.0.0.25' });
    expect(screen.getByRole('radio', { name: 'DHCP' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Static' }));
    expect(screen.getByRole('textbox', { name: 'IP Address' })).toHaveValue('10.0.0.25');
    expect(screen.getByRole('textbox', { name: 'Gateway' })).toHaveValue('10.0.0.1');
  });

  test('should keep the dialog open when Escape or the backdrop is clicked', () => {
    const { onClose, onSave } = renderDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
  });

  test('should call onClose without saving when the defensive close callback receives another reason', () => {
    const { onClose, onSave } = renderDialog();
    const close = vi.mocked(Dialog).mock.calls.at(-1)![0].onClose!;
    act(() => {
      Reflect.apply(close, undefined, [{}, 'programmatic']);
    });
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
