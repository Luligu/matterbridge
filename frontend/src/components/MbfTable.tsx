// React
import { useMemo, useRef, useState, memo } from 'react';

// @mui/material
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import DialogActions from '@mui/material/DialogActions';
import Checkbox from '@mui/material/Checkbox';

// @mdi
import Icon from '@mdi/react';
import { mdiSortAscending, mdiSortDescending, mdiCog } from '@mdi/js';

// frontend
import { debug } from '../App';
// const debug = true;

// Generic comparator used by MbfTable sorting.
export function comparator<T extends Record<string, unknown>>(rowA: T, rowB: T, key: keyof T): number {
  const v1 = rowA?.[key];
  const v2 = rowB?.[key];
  if (v1 == null && v2 == null) return 0;
  if (v1 == null) return -1;
  if (v2 == null) return 1;
  if (typeof v1 === 'boolean' && typeof v2 === 'boolean') {
    return v1 === v2 ? 0 : v1 ? 1 : -1; // false < true
  }
  if (typeof v1 === 'number' && typeof v2 === 'number') {
    return v1 - v2;
  }
  return String(v1).localeCompare(String(v2));
}

export interface MbfTableColumn<T extends object> {
  id: string;
  label: string;
  minWidth?: number;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: number) => string;
  noSort?: boolean;
  render?: (value: unknown, rowKey: string | number, row: T, column: MbfTableColumn<T>) => React.ReactNode;
  hidden?: boolean;
  required?: boolean;
  comparator?: (a: T, b: T) => number;
}

interface ColumnVisibility {
  [colId: string]: boolean;
}

interface MbfTableProps<T extends object> {
  name: string;
  title?: string;
  columns: MbfTableColumn<T>[];
  rows: T[];
  getRowKey?: string | ((row: T) => string | number);
  footerLeft?: string;
  footerRight?: string;
  onRowClick?: (row: T, rowKey: string | number, event: React.MouseEvent<HTMLTableRowElement, MouseEvent>) => void;
}

function MbfTable<T extends object>({ name, title, columns, rows, getRowKey, footerLeft, footerRight, onRowClick }: MbfTableProps<T>) {
  // Stable key fallback for rows without a natural id
  const rowKeyMapRef = useRef<WeakMap<T, string>>(new WeakMap());
  const nextRowKeySeqRef = useRef(1);

  const getStableRowKey = (row: T): string | number => {
    if (typeof getRowKey === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (row && (row as any)[getRowKey] != null) return (row as any)[getRowKey] as string | number;
    }
    if (typeof getRowKey === 'function') {
      const k = getRowKey(row);
      if (k != null) return k;
    }
    const firstColId = columns?.[0]?.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (firstColId && row && (row as any)[firstColId] != null) return (row as any)[firstColId] as string | number;
    console.warn(`MbfTable(${name}): using fallback stable row key; consider providing getRowKey prop for better React performance`);
    let k = rowKeyMapRef.current.get(row);
    if (!k) {
      k = `rk_${nextRowKeySeqRef.current++}`;
      rowKeyMapRef.current.set(row, k);
    }
    return k;
  };

  // Local states
  const [orderBy, setOrderBy] = useState<string | null>(localStorage.getItem(`${name}_table_order_by`) || null);
  const [order, setOrder] = useState<'asc' | 'desc' | null>((localStorage.getItem(`${name}_table_order`) as 'asc' | 'desc' | null) || null);
  const [configureVisibilityDialogOpen, setConfigureVisibilityDialogOpen] = useState(false);
  // Visibility overrides stored in localStorage: { [colId]: false } hides a column.
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
    try {
      const stored = localStorage.getItem(`${name}_column_visibility`);
      if (stored) return JSON.parse(stored) as ColumnVisibility;
    } catch { /**/ }
    return {};
  });

  // Derived effective visibility map from columns + overrides
  const visibleMap = useMemo<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const col of columns) {
      if (!col.hidden) {
        next[col.id] = col.required ? true : columnVisibility[col.id] !== false;
      }
    }
    return next;
  }, [columns, columnVisibility]);

  // Memoized sorted rows
  const sortedRows = useMemo<T[]>(() => {
    if (!orderBy || !order) return rows;
    const sortCol = columns.find((c) => c.id === orderBy);
    // Only skip sorting if the selected column is not found or is explicitly noSort
    if (!sortCol) return rows;
    if (sortCol.noSort) return rows;
    const wrapped = rows.map((el, index) => ({ el, index }));
    wrapped.sort((a, b) => {
      let cmp: number;
      if (typeof sortCol.comparator === 'function') {
        cmp = sortCol.comparator(a.el, b.el);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cmp = comparator<any>(a.el as any, b.el as any, orderBy as string);
      }
      if (cmp !== 0) return order === 'asc' ? cmp : -cmp;
      return a.index - b.index; // stable
    });
    return wrapped.map((w) => w.el);
  }, [rows, orderBy, order, columns]);

  // Handle sort request
  const handleRequestSort = (property: string) => {
    if (orderBy !== property || !orderBy) {
      setOrderBy(property);
      setOrder('asc');
      localStorage.setItem(`${name}_table_order_by`, property);
      localStorage.setItem(`${name}_table_order`, 'asc');
      return;
    }
    if (order === 'asc') {
      setOrder('desc');
      localStorage.setItem(`${name}_table_order`, 'desc');
      return;
    }
    setOrderBy(null);
    setOrder(null);
    localStorage.removeItem(`${name}_table_order_by`);
    localStorage.removeItem(`${name}_table_order`);
  };

  const toggleConfigureVisibilityDialog = () => {
    setConfigureVisibilityDialogOpen(!configureVisibilityDialogOpen);
  };

  const handleConfigureVisibilityChange = (id: string) => {
    setColumnVisibility((prev: ColumnVisibility) => {
      const col = columns.find((c) => c.id === id);
      if (col && col.required) return prev;
      const currentlyVisible = visibleMap[id] !== false; // based on derived map
      const next: ColumnVisibility = { ...prev };
      if (currentlyVisible) {
        next[id] = false; // hide
      } else {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete next[id]; // restore default (visible)
      }
      try {
        localStorage.setItem(`${name}_column_visibility`, JSON.stringify(next));
      } catch { /**/ }
      return next;
    });
  };

  const handleResetVisibility = () => {
    const next: ColumnVisibility = {};
    setColumnVisibility(next);
    try {
      localStorage.removeItem(`${name}_column_visibility`);
    } catch { /**/ }
    setConfigureVisibilityDialogOpen(false);
  };

  if(debug) console.log(`Rendering table ${name}${orderBy && order ? ` ordered by ${orderBy}:${order}` : ''}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', margin: '0', padding: '0', gap: '0', width: '100%', flex: '1 1 auto', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Dialog
        open={configureVisibilityDialogOpen}
        onClose={(event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
          toggleConfigureVisibilityDialog();
        }}
        disableEscapeKeyDown
        disableRestoreFocus
      >
        <DialogTitle gap={'20px'}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
            <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
            <h4 style={{ margin: 0 }}>{`Configure ${name} columns`}</h4>
          </div>
        </DialogTitle>
        <DialogContent>
          <FormGroup>
            {columns.filter((c) => !c.hidden).map((column) => (
              <FormControlLabel
                key={column.id}
                control={
                  <Checkbox
                    disabled={!!column.required}
                    checked={column.required ? true : visibleMap[column.id] !== false}
                    onChange={() => handleConfigureVisibilityChange(column.id)}
                  />
                }
                label={column.label}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleResetVisibility}>Reset</Button>
          <Button
            variant="contained"
            onClick={(e) => {
              if (e?.currentTarget && typeof e.currentTarget.blur === 'function') {
                try { e.currentTarget.blur(); } catch { /**/ }
              }
              const active = document.activeElement;
              if (active && active instanceof HTMLElement && typeof active.blur === 'function') {
                try { active.blur(); } catch { /**/ }
              }
              toggleConfigureVisibilityDialog();
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <div className="MbfWindowHeader" style={{ height: '30px', minHeight: '30px', justifyContent: 'space-between', borderBottom: 'none' }}>
        <p className="MbfWindowHeaderText">{name}</p>
        {title && <p className="MbfWindowHeaderText">{title}</p>}
        <div className="MbfWindowHeaderFooterIcons">
          <IconButton
            onClick={(e) => { if (e?.currentTarget?.blur) { try { e.currentTarget.blur(); } catch { /**/ } } toggleConfigureVisibilityDialog(); }}
            aria-label="Configure Columns"
            style={{ margin: '0px', padding: '0px', width: '19px', height: '19px' }}
          >
            <Tooltip title={`Configure ${name} columns`}>
              <Icon path={mdiCog} size="20px" color={'var(--header-text-color)'} />
            </Tooltip>
          </IconButton>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, width: '100%', overflow: 'auto', margin: '0px', padding: '0px', gap: '0' }} >
        <table aria-label={`${name} table`} style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, border: 'none', color: 'var(--header-text-color)', backgroundColor: 'var(--header-bg-color' }}>
            <tr style={{ height: '30px', minHeight: '30px' }}>
              {columns.map((column) => {
                if (column.hidden) return null;
                if (!column.required && visibleMap[column.id] === false) return null;
                const sortable = !column.noSort;
                const isActive = sortable && orderBy === column.id && !!order;
                return (
                  <th
                    key={column.id}
                    onClick={sortable ? () => handleRequestSort(column.id) : undefined}
                    style={{
                      margin: '0',
                      padding: '5px 10px',
                      position: 'sticky',
                      top: 0,
                      minWidth: column.minWidth,
                      maxWidth: column.maxWidth,
                      textAlign: column.align || 'left',
                      cursor: sortable ? 'pointer' : 'default',
                      border: 'none',
                      color: 'var(--header-text-color)', 
                      backgroundColor: 'var(--header-bg-color)',
                      whiteSpace: column.maxWidth ? 'nowrap' : undefined,
                      overflow: column.maxWidth ? 'hidden' : undefined,
                      textOverflow: column.maxWidth ? 'ellipsis' : undefined,
                    }}
                    aria-sort={sortable ? (isActive ? (order === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                  >
                    {column.label}
                    {isActive && 
                      <span style={{ marginLeft: 6 }}>
                        {order === 'asc' && (<Icon path={mdiSortAscending} size='15px' />)}
                        {order === 'desc' && (<Icon path={mdiSortDescending} size='15px' />)}
                      </span>
                    }
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => {
              const rowKey = getStableRowKey(row);
              return (
                <tr
                  key={rowKey}
                  className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'}
                  onClick={onRowClick ? (e) => onRowClick(row, rowKey, e) : undefined}
                  style={{
                    height: '30px',
                    minHeight: '30px',
                    border: 'none',
                    borderCollapse: 'collapse',
                    cursor: onRowClick ? 'pointer' : undefined,
                  }}
                >
                  {columns.map((column) => {
                    if (column.hidden) return null;
                    if (!column.required && visibleMap[column.id] === false) return null;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const value = (row as any)[column.id];
                    return (
                      <td
                        key={column.id}
                        style={{
                          border: 'none',
                          borderCollapse: 'collapse',
                          textAlign: column.align || 'left',
                          padding: '5px 10px',
                          margin: '0',
                          maxWidth: column.maxWidth,
                          whiteSpace: column.maxWidth ? 'nowrap' : undefined,
                          overflow: column.maxWidth ? 'hidden' : undefined,
                          textOverflow: column.maxWidth ? 'ellipsis' : undefined,
                        }}
                      >
                        {typeof column.render === 'function'
                          ? column.render(value, rowKey, row, column)
                          : (typeof value === 'boolean'
                              ? <Checkbox checked={value} disabled size="small" sx={{ m: 0, p: 0, color: 'var(--table-text-color)', '&.Mui-disabled': { color: 'var(--table-text-color)', opacity: 0.7 } }} />
                              : (column.format && typeof value === 'number'
                                  ? column.format(value)
                                  : (value !== undefined && value !== null
                                      ? String(value)
                                      : null)))
                        }
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(footerLeft || footerRight) && (
        <div className="MbfWindowFooter" style={{ height: '30px', minHeight: '30px', justifyContent: 'space-between', border: 'none' }}>
          <p className="MbfWindowFooterText" style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--secondary-color)' }}>{footerLeft}</p>
          <p className="MbfWindowFooterText" style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--secondary-color)' }}>{footerRight}</p>
        </div>
      )}

    </div>
  );
}

// Helper to preserve generics with React.memo
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function typedMemo<T>(c: T): T { return memo(c as any) as T; }

/**
 * MbfTable — data table with sorting, sticky header, and column visibility controls.
 *
 * Summary
 * - Sticky header: Table header cells (`th`) are position: sticky; the parent container
 *   should control scrolling (set a fixed height and `overflow: auto`).
 * - Sorting: Click a header to cycle asc → desc → none. Sort is stable; ties keep input order.
 * - Visibility: Users can show/hide non-required columns via the gear icon dialog.
 * - Persistence: Sort and visibility preferences are stored in `localStorage` using the `name` prop
 *   to form keys: `${name}_table_order_by`, `${name}_table_order`, `${name}_column_visibility`.
 *
 * Row and cell rendering
 * - A cell value is read with `row[column.id]`.
 * - Boolean values render as a disabled checkbox for quick visual status.
 * - If `column.format` is provided and the value is a number, the formatted string is rendered.
 *
 * Sorting details
 * - Comparator rules: null/undefined < numbers (numeric sort) < booleans (false < true) < strings (localeCompare).
 * - Clicking a header toggles: ascending → descending → unsorted (restores original order).
 * - When values are equal, original row order is preserved (stable sort).
 *
 * Layout and scrolling guidance
 * - This component does not enforce its own scrollbars. Place it inside a container that defines
 *   height and `overflow: auto` to enable scrolling while keeping the header sticky.
 *
 * Column definition
 * @typedef {Object} Column
 * @property {string} id
 *   Unique key for the column. Used to read `row[id]`, identify the sort column, and persist
 *   user preferences. Must be stable and unique across the table.
 * @property {string} label
 *   Header text shown in the sticky header for this column.
 * @property {number} [minWidth]
 *   Minimum width in pixels applied to the header and cells. Helps keep columns readable.
 * @property {number} [maxWidth]
 *   Maximum width in pixels. When provided, cells clamp with `white-space: nowrap`,
 *   `overflow: hidden`, and `text-overflow: ellipsis` for graceful truncation.
 * @property {'left'|'center'|'right'} [align='left']
 *   Horizontal alignment for header and body cells.
 * @property {(value: number) => string} [format]
 *   Optional formatter used when the cell value is numeric. Non-numeric values are rendered as-is.
 * @property {boolean} [nosort=false]
 *   If true, disables sorting on this column: header click is ignored, cursor remains default,
 *   and any previously persisted sort on this column is ignored at render time.
 * @property {(value: any, rowKey: string|number, row: Object, column: Column) => import('react').ReactNode} [render]
 *   Optional cell renderer. When provided, it takes precedence over default rendering and
 *   returns JSX for the cell. The `rowKey` is the stable key used for the row, derived from
 *   `getRowKey(row)` or an internal fallback. Note: sorting still uses the raw `row[column.id]`
 *   value, not the rendered output.
 * @property {boolean} [hidden=false]
 *   If true, the column is not rendered initially. Users can still enable it unless `required`.
 * @property {boolean} [required=false]
 *   If true, the column is always visible and cannot be hidden via the dialog.
 *
 * Props
 * @param {Object} props
 * @param {string} props.name
 *   Unique table name used in the UI and to namespace persisted preferences in `localStorage`.
 * @param {MbfTableColumn[]} props.columns
 *   Column configuration array. See Column typedef for all options.
 * @param {Object[]} props.rows
 *   Data rows. Each cell is resolved as `row[column.id]`. For best React performance, provide
 *   a stable identifier per row via `getRowKey`.
 * @param {string | (row: Object) => (string|number)} [props.getRowKey]
 *   Optional string or function that returns a stable key for a row. If omitted, the first column value is
 *   used when available; otherwise an internal stable key is generated for the row object.
 *   Always use useCallback to memoize the getRowKey function:
 *   const getRowKey = useCallback((row) => row.code, []);
 * @param {string} props.footerLeft
 *   Text shown in the left side of the footer bar.
 * @param {string} props.footerRight
 *   Text shown in the right side of the footer bar.
 * @returns {JSX.Element}
 *
 * @example
 * // Using stable keys and selectively updating a single row so only that row re-renders
 * function DevicesTable() {
 *   const [rows, setRows] = useState(initialRows);
 *
 *   return (
 *     <MbTable
 *       name="Devices"
 *       columns={columns}
 *       rows={rows}
 *       getRowKey={(row) => row.code} // stable per-row key
 *     />
 *   );
 * }
 *
 * // Update a specific row (code: F123) to demonstrate selective re-render by key
 * setRows((prev) => {
 *   const idx = prev.findIndex(r => r.code === 'F123');
 *   if (idx === -1) return prev;
 *   const target = prev[idx];
 *   const updated = { ...target, population: (target.population || 0) + 1 };
 *   const next = prev.slice(); // shallow copy of the array container
 *   next[idx] = updated;       // replace only the changed row object
 *   return next;               // other rows keep reference => React skips re-render for them
 * });
 */
export default typedMemo(MbfTable);
