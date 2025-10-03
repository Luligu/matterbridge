/* eslint-disable @typescript-eslint/no-explicit-any */
// MbfTableSortWorker.tsx
// Web Worker for sorting large tables in MbfTable
// Usage: see MbfTable.tsx for how to use this worker

// TypeScript in web workers: use self as DedicatedWorkerGlobalScope
self.onmessage = function (e: MessageEvent<{ rows: any[]; orderBy: string; order: 'asc' | 'desc'; columns: Array<any> }>) {
  const { rows, orderBy, order, columns } = e.data;
  if (!orderBy || !order) {
    self.postMessage(rows);
    return;
  }
  const sortCol = columns.find((c: any) => c.id === orderBy);
  if (!sortCol || sortCol.noSort) {
    self.postMessage(rows);
    return;
  }
  const comparator = (rowA: any, rowB: any): number => {
    const v1 = rowA?.[orderBy];
    const v2 = rowB?.[orderBy];
    if (v1 == null && v2 == null) return 0;
    if (v1 == null) return -1;
    if (v2 == null) return 1;
    if (typeof v1 === 'boolean' && typeof v2 === 'boolean') {
      return v1 === v2 ? 0 : v1 ? 1 : -1;
    }
    if (typeof v1 === 'number' && typeof v2 === 'number') {
      return v1 - v2;
    }
    return String(v1).localeCompare(String(v2));
  };
  const wrapped = rows.map((el: any, index: number) => ({ el, index }));
  wrapped.sort((a: { el: any; index: number }, b: { el: any; index: number }) => {
    let cmp: number;
    if (typeof sortCol.comparator === 'function') {
      // Custom comparator: pass full rows
      cmp = sortCol.comparator(a.el, b.el);
    } else {
      cmp = comparator(a.el, b.el);
    }
    if (cmp !== 0) return order === 'asc' ? cmp : -cmp;
    return a.index - b.index;
  });
  self.postMessage(wrapped.map((w: { el: any }) => w.el));
};
