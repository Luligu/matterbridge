import '@testing-library/jest-dom';

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/App', () => ({
  debug: false,
}));

vi.mock('../src/components/MbfWindow', () => ({
  MbfWindowContent: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
  MbfWindowFooter: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
  MbfWindowFooterText: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
  MbfWindowHeader: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
  MbfWindowHeaderText: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
  MbfWindowIcons: ({ children, close }: { children?: React.ReactNode; close?: () => void }) => (
    <div>
      {children}
      {close && (
        <button type='button' aria-label='Window Close' onClick={close}>
          Window Close
        </button>
      )}
    </div>
  ),
}));

vi.mock('@mui/material/Dialog', () => ({
  default: ({ open, onClose, children }: { open: boolean; onClose?: (event: unknown, reason: string) => void; children: React.ReactNode }) => {
    if (!open) return null;

    return (
      <div data-testid='dialog'>
        {children}
        <button type='button' onClick={() => onClose?.({}, 'backdropClick')}>
          Backdrop Close
        </button>
        <button type='button' onClick={() => onClose?.({}, 'escapeKeyDown')}>
          Escape Close
        </button>
        <button type='button' onClick={() => onClose?.({}, 'closeButton')}>
          Reason Close
        </button>
      </div>
    );
  },
}));

import MbfTable, { comparator, MbfTableColumn } from '../src/components/MbfTable';

interface SortRow {
  id: string;
  group: string;
  name: string;
}

describe('MbfTable branch coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('covers comparator boolean equality and string comparison', () => {
    expect(comparator({ value: true }, { value: true }, 'value')).toBe(0);
    expect(comparator({ value: 'alpha' }, { value: 'beta' }, 'value')).toBeLessThan(0);
  });

  it('keeps stable order for equal comparisons and cycles sort asc, desc, then reset', () => {
    const columns: MbfTableColumn<SortRow>[] = [
      { id: 'id', label: 'ID', required: true },
      { id: 'group', label: 'Group' },
      { id: 'name', label: 'Name' },
    ];
    const rows: SortRow[] = [
      { id: 'row-1', group: 'same', name: 'First' },
      { id: 'row-2', group: 'same', name: 'Second' },
    ];

    render(<MbfTable name='SortCycle' title='Sortable Table' columns={columns} rows={rows} getRowKey='id' />);

    const groupHeader = screen.getByRole('columnheader', { name: 'Group' });
    fireEvent.click(groupHeader);

    const bodyRows = screen.getAllByRole('row').slice(1);
    expect(bodyRows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['row-1', 'row-2']);
    expect(groupHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(localStorage.getItem('SortCycle_table_order_by')).toBe('group');
    expect(localStorage.getItem('SortCycle_table_order')).toBe('asc');
    expect(screen.getByText('Sortable Table')).toBeInTheDocument();

    fireEvent.click(groupHeader);
    expect(groupHeader).toHaveAttribute('aria-sort', 'descending');
    expect(localStorage.getItem('SortCycle_table_order')).toBe('desc');

    fireEvent.click(groupHeader);
    expect(groupHeader).toHaveAttribute('aria-sort', 'none');
    expect(localStorage.getItem('SortCycle_table_order_by')).toBeNull();
    expect(localStorage.getItem('SortCycle_table_order')).toBeNull();
  });

  it('ignores backdrop and escape dialog closes, then restores a hidden column', () => {
    const columns: MbfTableColumn<SortRow>[] = [
      { id: 'id', label: 'ID', required: true },
      { id: 'name', label: 'Name' },
    ];
    const rows: SortRow[] = [{ id: 'row-1', group: 'same', name: 'Alpha' }];

    render(<MbfTable name='VisibilityDialog' columns={columns} rows={rows} getRowKey='id' />);

    fireEvent.click(screen.getByLabelText('Configure Columns'));
    expect(screen.getByTestId('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Backdrop Close' }));
    expect(screen.getByTestId('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Escape Close' }));
    expect(screen.getByTestId('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Name'));
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Configure Columns'));
    fireEvent.click(screen.getByLabelText('Name'));
    fireEvent.click(screen.getByRole('button', { name: 'Reason Close' }));
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('handles row clicks and closes the table from the window controls', () => {
    const onRowClick = vi.fn();
    const columns: MbfTableColumn<SortRow>[] = [
      { id: 'id', label: 'ID', required: true },
      { id: 'name', label: 'Name' },
    ];
    const rows: SortRow[] = [{ id: 'row-1', group: 'same', name: 'Alpha' }];

    render(<MbfTable name='RowClick' columns={columns} rows={rows} getRowKey='id' onRowClick={onRowClick} />);

    const row = screen.getAllByRole('row')[1];
    fireEvent.click(row);
    expect(onRowClick).toHaveBeenCalledWith(rows[0], 'row-1', expect.any(Object));

    fireEvent.click(screen.getByRole('button', { name: 'Window Close' }));
    expect(screen.queryByRole('table', { name: 'RowClick table' })).not.toBeInTheDocument();
  });
});
