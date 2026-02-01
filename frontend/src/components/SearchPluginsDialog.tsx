// React
import { useEffect, useRef, useState } from 'react';

// @mui/material
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

// Frontend
import { pluginIgnoreList } from './HomeInstallAddPlugins';
import MbfTable, { MbfTableColumn } from './MbfTable';
import { MbfLsk } from '../utils/localStorage';
import { debug } from '../App';
// const debug = true;

type TotalsCacheEntry = { total: number; asOf: string };
type TotalsCache = Record<string, TotalsCacheEntry>;

const readTotalsCache = (): TotalsCache => {
  try {
    const raw = window.localStorage.getItem(MbfLsk.searchPluginsTotal);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};

    const out: TotalsCache = {};
    for (const [name, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!name) continue;
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.total !== 'number') continue;
      if (typeof e.asOf !== 'string') continue;
      out[name] = { total: e.total, asOf: e.asOf };
    }
    return out;
  } catch {
    return {};
  }
};

const writeTotalsCache = (cache: TotalsCache) => {
  try {
    window.localStorage.setItem(MbfLsk.searchPluginsTotal, JSON.stringify(cache));
  } catch {
    // Ignore quota/blocked storage errors.
  }
};

interface SearchPluginsDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (pluginName: string) => void;
}

export const SearchPluginsDialog = ({ open, onClose, onSelect }: SearchPluginsDialogProps) => {
  const [pluginName, setPluginName] = useState('');
  const selectedPluginNameRef = useRef('');
  const hasFetchedRef = useRef(false);
  const [rows, setRows] = useState<PluginSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalsLoading, setTotalsLoading] = useState(false);
  const [totalsProgress, setTotalsProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const blurActiveElement = () => {
    const el = document.activeElement;
    if (el && el instanceof HTMLElement) el.blur();
  };

  type PluginSearchRow = {
    name: string;
    version: string;
    downloads: number | null;
    total: number | null;
    description: string;
    author: string;
    official: boolean;
  };

  type NpmSearchPackage = {
    name?: string;
    version?: string;
    description?: string;
    date?: string;
    links?: Record<string, string>;
    publisher?: { username?: string };
    maintainers?: Array<{ username?: string }>;
  };
  type NpmSearchObject = { package?: NpmSearchPackage; downloads?: { monthly?: number; weekly?: number } };
  type NpmSearchResponse = { objects?: NpmSearchObject[] };

  type NpmDownloadsRangeDay = { day?: string; downloads?: number };
  type NpmDownloadsRangeResponse = { downloads?: NpmDownloadsRangeDay[]; package?: string; start?: string; end?: string };

  const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

  const columns: MbfTableColumn<PluginSearchRow>[] = [
    {
      label: 'Name',
      id: 'name',
      required: true,
      maxWidth: 230,
      tooltip: true,
    },
    {
      label: 'Version',
      id: 'version',
      maxWidth: 110,
      tooltip: true,
    },
    {
      label: 'Monthly',
      id: 'downloads',
      align: 'right',
      maxWidth: 120,
      render: (value) => (typeof value === 'number' ? formatNumber(value) : ''),
    },
    {
      label: 'Total',
      id: 'total',
      align: 'right',
      maxWidth: 120,
      render: (value) => (typeof value === 'number' ? formatNumber(value) : ''),
      noSort: true,
    },
    {
      label: 'Description',
      id: 'description',
      maxWidth: 420,
      tooltip: true,
    },
    {
      label: 'Author',
      id: 'author',
      maxWidth: 140,
      tooltip: true,
    },
  ];

  useEffect(() => {
    if (!open) {
      hasFetchedRef.current = false;
      selectedPluginNameRef.current = '';
      setRows([]);
      setLoading(false);
      setTotalsLoading(false);
      setTotalsProgress({ done: 0, total: 0 });
      setError(null);
      setPluginName('');
      return;
    }
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const controller = new AbortController();

    void (async () => {
      const prefix = 'matterbridge-';
      const size = 250;
      const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(prefix)}&size=${size}`;

      const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

      const formatYyyyMmDd = (date: Date) => {
        const yyyy = date.getFullYear().toString();
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const dd = date.getDate().toString().padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      const sumDownloadsRange = (payload: NpmDownloadsRangeResponse): number | null => {
        if (!Array.isArray(payload.downloads)) return null;
        let total = 0;
        let hasAny = false;
        for (const entry of payload.downloads) {
          if (typeof entry?.downloads === 'number') {
            total += entry.downloads;
            hasAny = true;
          }
        }
        return hasAny ? total : null;
      };

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`npm registry request failed: ${response.status} ${response.statusText}`);
        }
        const json = (await response.json()) as NpmSearchResponse;

        const officialUsername = 'luligu';
        const isOfficial = (pkg: NpmSearchPackage) => pkg.publisher?.username?.toLowerCase() === officialUsername || (pkg.maintainers ?? []).some((m) => m.username?.toLowerCase() === officialUsername);

        const objects = (json.objects ?? [])
          .filter((obj): obj is NpmSearchObject => !!obj?.package && typeof obj.package.name === 'string')
          .filter((obj) => obj.package?.name?.startsWith(prefix))
          .filter((obj) => !pluginIgnoreList.includes(obj.package?.name ?? ''))
          .sort((a, b) => {
            const aOfficial = isOfficial(a.package ?? {});
            const bOfficial = isOfficial(b.package ?? {});
            if (aOfficial !== bOfficial) return aOfficial ? -1 : 1;
            return (a.package?.name ?? '').localeCompare(b.package?.name ?? '');
          });

        const nextRows: PluginSearchRow[] = objects.map((obj) => {
          const pkg = obj.package as NpmSearchPackage;
          const name = pkg.name ?? '';
          const author = (pkg.publisher?.username ?? pkg.maintainers?.[0]?.username ?? '').trim();
          const downloads = typeof obj.downloads?.monthly === 'number' ? obj.downloads.monthly : null;
          return {
            name,
            version: pkg.version ?? '',
            downloads,
            total: null,
            description: pkg.description ?? '',
            author,
            official: isOfficial(pkg),
          };
        });

        // Hydrate totals from localStorage immediately, then refresh in background.
        const end = formatYyyyMmDd(new Date());
        const totalsCache = readTotalsCache();

        const nextRowsWithCachedTotals: PluginSearchRow[] = nextRows.map((r) => {
          const cached = totalsCache[r.name];
          if (!cached) return r;
          if (typeof cached.total !== 'number') return r;
          if (debug) console.log(`[SearchPluginsDialog] total downloads loaded from cache for ${r.name} (asOf=${cached.asOf}):`, cached.total);
          return { ...r, total: cached.total };
        });

        setRows(nextRowsWithCachedTotals);

        // Fetch total downloads for each package using the downloads/range API.
        // This is intentionally throttled to avoid hammering the API.
        const start = '2020-01-01';
        const packagesNeedingFetchList = nextRows
          .map((r) => r.name)
          .filter((name) => {
            const cached = totalsCache[name];
            const needsFetch = !cached || cached.asOf !== end;
            if (!needsFetch) {
              if (debug) console.log(`[SearchPluginsDialog] total downloads fetch skipped (cache fresh) for ${name} (asOf=${cached.asOf}).`);
            }
            return needsFetch;
          });
        const packagesNeedingFetchSet = new Set(packagesNeedingFetchList);

        const totalToFetch = packagesNeedingFetchList.length;
        setTotalsProgress({ done: 0, total: totalToFetch });
        setTotalsLoading(totalToFetch > 0);

        const fetchTotalDownloads = async (packageName: string): Promise<number | null> => {
          const rangeUrl = `https://api.npmjs.org/downloads/range/${start}:${end}/${encodeURIComponent(packageName)}`;

          // Be gentle with the API: basic retry/backoff on 429.
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const rangeResponse = await fetch(rangeUrl, { signal: controller.signal });
            if (rangeResponse.ok) {
              const rangeJson = (await rangeResponse.json()) as NpmDownloadsRangeResponse;
              return sumDownloadsRange(rangeJson);
            }

            // 404 can happen for packages with no download stats.
            if (rangeResponse.status === 404) return null;

            if (rangeResponse.status === 429) {
              const retryAfterHeader = rangeResponse.headers.get('retry-after');
              const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
              const backoffMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 2000 * (attempt + 1);
              await sleep(backoffMs);
              continue;
            }

            // Any other error: don't keep retrying.
            return null;
          }

          return null;
        };

        // Slow down requests to avoid rate limiting.
        const concurrency = 1;
        const delayBetweenRequestsMs = 500;
        let index = 0;
        let done = 0;

        const worker = async () => {
          while (index < packagesNeedingFetchList.length) {
            if (controller.signal.aborted) return;
            const rowIndex = index;
            index += 1;

            const packageName = packagesNeedingFetchList[rowIndex];
            if (!packageName) {
              continue;
            }

            // Defensive: avoid any chance of duplicate processing.
            if (!packagesNeedingFetchSet.has(packageName)) continue;
            packagesNeedingFetchSet.delete(packageName);

            try {
              if (debug) console.log(`[SearchPluginsDialog] fetching total downloads for ${packageName} (range ${start}:${end})...`);
              const total = await fetchTotalDownloads(packageName);
              if (controller.signal.aborted) return;
              if (debug) console.log(`[SearchPluginsDialog] total downloads fetched for ${packageName}:`, total);
              setRows((prev) => prev.map((r) => (r.name === packageName ? { ...r, total } : r)));

              if (typeof total === 'number') {
                totalsCache[packageName] = { total, asOf: end };
                writeTotalsCache(totalsCache);
                if (debug) console.log(`[SearchPluginsDialog] total downloads saved to localStorage for ${packageName} (asOf=${end}):`, total);
              }
            } catch (error) {
              if (error instanceof DOMException && error.name === 'AbortError') return;
              // Leave total as null on error.
            } finally {
              done += 1;
              setTotalsProgress({ done, total: totalToFetch });

              // Always pause a bit between requests.
              if (!controller.signal.aborted) await sleep(delayBetweenRequestsMs);
            }
          }
        };

        void Promise.all(Array.from({ length: Math.min(concurrency, nextRows.length) }, () => worker())).finally(() => {
          if (!controller.signal.aborted) setTotalsLoading(false);
        });

        if (debug) console.log(`[SearchPluginsDialog] npm packages starting with "${prefix}" (filtered/sorted):`, nextRows);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('[SearchPluginsDialog] npm registry fetch error:', error);
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [open]);

  const handleSelect = () => {
    blurActiveElement();
    const selectedName = selectedPluginNameRef.current || pluginName;
    onSelect(selectedName);
  };

  const handleCancel = () => {
    blurActiveElement();
    onClose();
  };

  const totalMonthlyDownloads = rows.reduce((sum, r) => sum + (typeof r.downloads === 'number' ? r.downloads : 0), 0);

  const totalAllTimeDownloads = rows.reduce(
    (acc, r) => {
      if (typeof r.total === 'number') {
        acc.total += r.total;
        acc.hasAny = true;
      }
      return acc;
    },
    { total: 0, hasAny: false },
  );

  const totalsFooter = totalsLoading ? `  Totals: ${totalsProgress.done.toString()}/${totalsProgress.total.toString()} fetched` : '';
  const totalAllTimeText = totalAllTimeDownloads.hasAny ? formatNumber(totalAllTimeDownloads.total) : '...';

  return (
    <Dialog
      open={open}
      onClose={() => {
        blurActiveElement();
        onClose();
      }}
      maxWidth={false}
      fullWidth
      slotProps={{
        paper: {
          sx: {
            width: '75vw',
            height: '75vh',
            maxWidth: '75vw',
            maxHeight: '75vh',
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      <DialogTitle>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
          <img src='matterbridge.svg' alt='Matterbridge Logo' style={{ height: '32px', width: '32px' }} />
          <h4 style={{ margin: 0 }}>Search Plugins</h4>
        </div>
      </DialogTitle>
      <DialogContent dividers sx={{ padding: 0, flex: '1 1 auto', minHeight: 0 }}>
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: '20px' }}>Loading npm registry...</div>
          ) : error ? (
            <div style={{ padding: '20px' }}>{error}</div>
          ) : (
            <MbfTable<PluginSearchRow>
              name='Search plugins'
              rows={rows}
              columns={columns}
              getRowKey='name'
              onRowClick={(row, _rowKey, event) => {
                selectedPluginNameRef.current = row.name;
                setPluginName(row.name);
                if (event.detail === 2) onSelect(row.name);
              }}
              footerLeft={`Total packages: ${rows.length.toString()}  Total downloads: ${formatNumber(totalMonthlyDownloads)} / ${totalAllTimeText}${totalsFooter}`}
              footerRight={pluginName ? `Selected: ${pluginName}` : ''}
            />
          )}
        </div>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center' }}>
        <Button variant='contained' onClick={handleSelect} disabled={!(selectedPluginNameRef.current || pluginName)}>
          Select
        </Button>
        <Button onClick={handleCancel}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};
