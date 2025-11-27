/* eslint-disable @typescript-eslint/no-explicit-any */
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
      if (row && (row as any)[getRowKey] != null) return (row as any)[getRowKey] as string | number;
    }
    if (typeof getRowKey === 'function') {
      const k = getRowKey(row);
      if (k != null) return k;
    }
    const firstColId = columns?.[0]?.id;
    if (firstColId && row && (row as any)[firstColId] != null) return (row as any)[firstColId] as string | number;
    console.warn(`MbfTable(${name}): using fallback stable row key; consider providing getRowKey prop for better React performance`);
    let k = rowKeyMapRef.current.get(row);
    if (!k) {
      k = `rk_${nextRowKeySeqRef.current++}`;
      rowKeyMapRef.current.set(row, k);
    }
    return k;
  };

  // Local states for column sorting and visibility
  const [orderBy, setOrderBy] = useState<string | null>(localStorage.getItem(`${name}_table_order_by`) || null);
  const [order, setOrder] = useState<'asc' | 'desc' | null>((localStorage.getItem(`${name}_table_order`) as 'asc' | 'desc' | null) || null);
  const [configureVisibilityDialogOpen, setConfigureVisibilityDialogOpen] = useState(false);
  // Visibility overrides stored in localStorage: { [colId]: false } hides a column.
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
    try {
      const stored = localStorage.getItem(`${name}_column_visibility`);
      if (stored) return JSON.parse(stored) as ColumnVisibility;
    } catch {
      /**/
    }
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

  // Memoized sorted rows without web worker
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
      } catch {
        /**/
      }
      return next;
    });
  };

  const handleResetVisibility = () => {
    const next: ColumnVisibility = {};
    setColumnVisibility(next);
    try {
      localStorage.removeItem(`${name}_column_visibility`);
    } catch {
      /**/
    }
    setConfigureVisibilityDialogOpen(false);
  };

  if (debug) console.log(`Rendering table ${name}${orderBy && order ? ` ordered by ${orderBy}:${order}` : ''}`);

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
            <img src='matterbridge.svg' alt='Matterbridge Logo' style={{ height: '32px', width: '32px' }} />
            <h4 style={{ margin: 0 }}>{`Configure ${name} columns`}</h4>
          </div>
        </DialogTitle>
        <DialogContent>
          <FormGroup>
            {columns
              .filter((c) => !c.hidden)
              .map((column) => (
                <FormControlLabel
                  key={column.id}
                  control={<Checkbox disabled={!!column.required} checked={column.required ? true : visibleMap[column.id] !== false} onChange={() => handleConfigureVisibilityChange(column.id)} />}
                  label={column.label}
                />
              ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleResetVisibility}>Reset</Button>
          <Button
            variant='contained'
            onClick={(e) => {
              if (e?.currentTarget && typeof e.currentTarget.blur === 'function') {
                try {
                  e.currentTarget.blur();
                } catch {
                  /**/
                }
              }
              const active = document.activeElement;
              if (active && active instanceof HTMLElement && typeof active.blur === 'function') {
                try {
                  active.blur();
                } catch {
                  /**/
                }
              }
              toggleConfigureVisibilityDialog();
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <div className='MbfWindowHeader' style={{ height: '30px', minHeight: '30px', justifyContent: 'space-between', borderBottom: 'none' }}>
        <p className='MbfWindowHeaderText'>{name}</p>
        {title && <p className='MbfWindowHeaderText'>{title}</p>}
        <div className='MbfWindowHeaderFooterIcons'>
          <IconButton
            onClick={(e) => {
              if (e?.currentTarget?.blur) {
                try {
                  e.currentTarget.blur();
                } catch {
                  /**/
                }
              }
              toggleConfigureVisibilityDialog();
            }}
            aria-label='Configure Columns'
            style={{ margin: '0px', padding: '0px', width: '19px', height: '19px' }}
          >
            <Tooltip title={`Configure ${name} columns`}>
              <Icon path={mdiCog} size='20px' color={'var(--header-text-color)'} />
            </Tooltip>
          </IconButton>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, width: '100%', overflow: 'auto', margin: '0px', padding: '0px', gap: '0' }}>
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
                    {isActive && (
                      <span style={{ marginLeft: 6 }}>
                        {order === 'asc' && <Icon path={mdiSortAscending} size='15px' />}
                        {order === 'desc' && <Icon path={mdiSortDescending} size='15px' />}
                      </span>
                    )}
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
                        {typeof column.render === 'function' ? (
                          column.render(value, rowKey, row, column)
                        ) : typeof value === 'boolean' ? (
                          <Checkbox checked={value} disabled size='small' sx={{ m: 0, p: 0, color: 'var(--table-text-color)', '&.Mui-disabled': { color: 'var(--table-text-color)', opacity: 0.7 } }} />
                        ) : column.format && typeof value === 'number' ? (
                          column.format(value)
                        ) : value !== undefined && value !== null ? (
                          String(value)
                        ) : null}
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
        <div className='MbfWindowFooter' style={{ height: '30px', minHeight: '30px', justifyContent: 'space-between', border: 'none' }}>
          <p className='MbfWindowFooterText' style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--secondary-color)' }}>
            {footerLeft}
          </p>
          <p className='MbfWindowFooterText' style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--secondary-color)' }}>
            {footerRight}
          </p>
        </div>
      )}
    </div>
  );
}

// Helper to preserve generics with React.memo
function typedMemo<T>(c: T): T {
  return memo(c as any) as T;
}

export default typedMemo(MbfTable);
