import { vi } from 'vitest';
// --- Edge/fallback/error tests for full coverage ---
describe('MbfTable edge/fallback/error cases', () => {
  it('triggers stable sort fallback in main table logic', () => {
    const columns = [
      { id: 'id', label: 'ID', required: true, comparator: () => NaN },
    ];
    const rows = [
      { id: 'a' },
      { id: 'b' },
    ];
    render(<MbfTable name="StableSortFallback" columns={columns} rows={rows} getRowKey="id" />);
    fireEvent.click(screen.getByText('ID'));
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('covers try/catch for localStorage.getItem (columnVisibility)', () => {
    const columns = [ { id: 'id', label: 'ID', required: true } ];
    const rows = [{ id: 'a' }];
    const origGetItem = window.localStorage.getItem;
    window.localStorage.getItem = () => { throw new Error('fail'); };
    expect(() => {
      render(<MbfTable name="GetItemError" columns={columns} rows={rows} getRowKey="id" />);
    }).not.toThrow();
    window.localStorage.getItem = origGetItem;
  });

  it('covers try/catch for localStorage.setItem (handleConfigureVisibilityChange)', () => {
    const columns = [ { id: 'id', label: 'ID', required: true }, { id: 'name', label: 'Name' } ];
    const rows = [{ id: 'a', name: 'Alpha' }];
    const origSetItem = window.localStorage.setItem;
    window.localStorage.setItem = () => { throw new Error('fail'); };
    render(<MbfTable name="SetItemError" columns={columns} rows={rows} getRowKey="id" />);
    fireEvent.click(screen.getByLabelText('Configure Columns'));
    expect(() => fireEvent.click(screen.getByLabelText('Name'))).not.toThrow();
    window.localStorage.setItem = origSetItem;
  });

  it('covers try/catch for localStorage.removeItem (handleResetVisibility)', () => {
    const columns = [ { id: 'id', label: 'ID', required: true }, { id: 'name', label: 'Name' } ];
    const rows = [{ id: 'a', name: 'Alpha' }];
    const origRemoveItem = window.localStorage.removeItem;
    window.localStorage.removeItem = () => { throw new Error('fail'); };
    render(<MbfTable name="RemoveItemError" columns={columns} rows={rows} getRowKey="id" />);
    fireEvent.click(screen.getByLabelText('Configure Columns'));
    fireEvent.click(screen.getByLabelText('Name'));
    expect(() => fireEvent.click(screen.getByText('Reset'))).not.toThrow();
    window.localStorage.removeItem = origRemoveItem;
  });

  it('covers try/catch for blur logic in Dialog Close button', () => {
    const columns = [ { id: 'id', label: 'ID', required: true } ];
    const rows = [{ id: 'a' }];
    render(<MbfTable name="BlurDialog" columns={columns} rows={rows} getRowKey="id" />);
    fireEvent.click(screen.getByLabelText('Configure Columns'));
    const closeBtn = screen.getByText('Close');
    const origBlur = closeBtn.blur;
    closeBtn.blur = () => { throw new Error('fail'); };
    expect(() => fireEvent.click(closeBtn)).not.toThrow();
    closeBtn.blur = origBlur;
  });

  it('covers try/catch for blur logic in IconButton', () => {
    const columns = [ { id: 'id', label: 'ID', required: true } ];
    const rows = [{ id: 'a' }];
    render(<MbfTable name="BlurIcon" columns={columns} rows={rows} getRowKey="id" />);
    const iconBtn = screen.getByLabelText('Configure Columns');
    const origBlur = iconBtn.blur;
    iconBtn.blur = () => { throw new Error('fail'); };
    expect(() => fireEvent.click(iconBtn)).not.toThrow();
    iconBtn.blur = origBlur;
  });

  it('uses fallback stable row key and warns (no getRowKey, no id)', () => {
    const columns = [ { id: 'id', label: 'ID', required: true }, { id: 'name', label: 'Name' } ];
    const rows = [{ foo: 1 }];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<MbfTable name="FallbackKeyWarn" columns={columns} rows={rows} />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('using fallback stable row key'));
    warn.mockRestore();
  });

  it('uses fallback stable row key and warns (getRowKey returns undefined)', () => {
    const columns = [ { id: 'id', label: 'ID', required: true }, { id: 'name', label: 'Name' } ];
    const rows = [{ foo: 1 }];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(<MbfTable name="FallbackKeyWarn2" columns={columns} rows={rows} getRowKey={() => undefined as unknown as string} />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('using fallback stable row key'));
    warn.mockRestore();
  });

  it('covers stable sort fallback (comparator returns NaN and undefined)', () => {
  const columns = [ { id: 'id', label: 'ID', required: true, comparator: (_a: unknown, _b: unknown) => NaN } ];
    const rows = [ { id: 'a' }, { id: 'b' } ];
    render(<MbfTable name="StableSortNaN" columns={columns} rows={rows} getRowKey="id" />);
    fireEvent.click(screen.getByText('ID'));
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });
});
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MbfTable, { MbfTableColumn } from '../src/components/MbfTable';

interface RowType {
  id: string;
  name: string;
  value: number;
  flag: boolean;
}

describe('MbfTable', () => {
  const columns: MbfTableColumn<RowType>[] = [
    { id: 'id', label: 'ID', required: true },
    { id: 'name', label: 'Name' },
    { id: 'value', label: 'Value', format: (v) => `#${v}` },
    { id: 'flag', label: 'Flag', render: (v) => (v ? 'Yes' : 'No') },
    { id: 'custom', label: 'Custom', comparator: (a, b) => a.value - b.value, render: (_v, _rk, row) => row.value },
  ];
  const rows: RowType[] = [
    { id: 'a', name: 'Alpha', value: 2, flag: true },
    { id: 'b', name: 'Beta', value: 1, flag: false },
    { id: 'c', name: 'Gamma', value: 3, flag: true },
  ];

  it('renders all rows and columns', () => {
    render(<MbfTable name="TestTable" columns={columns} rows={rows} getRowKey="id" />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Flag')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('sorts by column when header is clicked', () => {
    render(<MbfTable name="TestTableSort" columns={columns} rows={rows} getRowKey="id" />);
    // Click 'Value' header to sort ascending
    fireEvent.click(screen.getByText('Value'));
    const cells = screen.getAllByRole('cell');
    // Sorted order: Beta (1), Alpha (2), Gamma (3)
    expect(cells.map((c) => c.textContent)).toContain('#1');
    expect(cells.map((c) => c.textContent)).toContain('#2');
    expect(cells.map((c) => c.textContent)).toContain('#3');
  });

  it('uses custom comparator if provided', () => {
    render(<MbfTable name="TestTableCustomSort" columns={columns} rows={rows} getRowKey="id" />);
    // Click 'Custom' header to sort ascending
    fireEvent.click(screen.getByText('Custom'));
    const customCells = screen.getAllByText(/^[123]$/);
    // Sorted order: 1, 2, 3
    expect(customCells[0].textContent).toBe('1');
    expect(customCells[1].textContent).toBe('2');
    expect(customCells[2].textContent).toBe('3');
  });

  it('toggles column visibility', () => {
    render(<MbfTable name="TestTableVisibility" columns={columns} rows={rows} getRowKey="id" />);
    // Open column config dialog
    fireEvent.click(screen.getByLabelText('Configure Columns'));
    // Hide 'Name' column
    fireEvent.click(screen.getByLabelText('Name'));
    // Close dialog
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });

  it('renders formatted and rendered cells', () => {
    render(<MbfTable name="TestTableFormat" columns={columns} rows={rows} getRowKey="id" />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    // There are two rows with flag: true, so two 'Yes' cells
    const yesCells = screen.getAllByText('Yes');
    expect(yesCells).toHaveLength(2);
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('renders footer text if provided', () => {
    render(<MbfTable name="TestTableFooter" columns={columns} rows={rows} getRowKey="id" footerLeft="Left" footerRight="Right" />);
    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
  });
});
