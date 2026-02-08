// React
import { useCallback, useEffect, useRef, useState } from 'react';

/*
  NPM fetch map (SearchPluginsDialog)

  1) Search packages (list + latest version + basic metadata)
    - URL: https://registry.npmjs.org/-/v1/search?text=matterbridge-&size=...
    - Purpose: populate the table with package name, latest version, description, publisher, npm/homepage links.

  2) Package "latest" metadata (homepage/help/changelog + repository)
    - URL: https://registry.npmjs.org/<package>/latest
    - Purpose: enrich rows with homepage/help/changelog links.
     If help/changelog are missing, derive from repository URL (e.g. .../blob/main/README.md).
    - Cache: localStorage key MbfLsk.searchPluginsMeta (per day)

  3) Total downloads (all-time-ish, via downloads range)
    - URL: https://api.npmjs.org/downloads/range/2020-01-01:<today>/<package>
    - Purpose: compute and show "Total" downloads per package.
    - Cache: localStorage key MbfLsk.searchPluginsTotal (per day)
    - Notes: throttled + basic retry/backoff on 429.

  4) Versions list (all published versions)
    - URL: https://registry.npmjs.org/<package>
    - Purpose: get the full version list (the search API only returns the latest version).
     Used to populate the versions selector after selecting a plugin.
    - Cache: localStorage key MbfLsk.searchPluginsVersions (per day)
*/

// @mui/material
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

// @mui/icons-material
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';

// Frontend
import { pluginIgnoreList } from './HomeInstallAddPlugins';
import MbfTable, { MbfTableColumn } from './MbfTable';
import { MbfLsk } from '../utils/localStorage';
import { debug } from '../App';
// const debug = true;

type TotalsCacheEntry = { total: number; asOf: string };
type TotalsCache = Record<string, TotalsCacheEntry>;

type MetaCacheEntry = { homepage: string | null; help: string | null; changelog: string | null; asOf: string };
type MetaCache = Record<string, MetaCacheEntry>;

type VersionsCacheEntry = { versions: string[]; asOf: string };
type VersionsCache = Record<string, VersionsCacheEntry>;

const normalizeGitUrl = (value: string) => value.replace('git+', '').replace('.git', '').trim();

const normalizeRepositoryUrl = (value: string): string => {
  let v = normalizeGitUrl(value);

  // Common repository.url formats we see from npm:
  // - git://github.com/owner/repo.git
  // - ssh://git@github.com/owner/repo.git
  // - git@github.com:owner/repo.git
  if (v.startsWith('git://')) v = `https://${v.slice('git://'.length)}`;
  if (v.startsWith('ssh://git@github.com/')) v = `https://github.com/${v.slice('ssh://git@github.com/'.length)}`;
  if (v.startsWith('git@github.com:')) v = `https://github.com/${v.slice('git@github.com:'.length).replace(':', '/')}`;

  return v;
};

const getRepositoryUrl = (repository: unknown): string | null => {
  if (typeof repository === 'string') return repository.trim() || null;
  if (!repository || typeof repository !== 'object') return null;
  const url = (repository as { url?: unknown }).url;
  return typeof url === 'string' ? url.trim() || null : null;
};

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

const readMetaCache = (): MetaCache => {
  try {
    const raw = window.localStorage.getItem(MbfLsk.searchPluginsMeta);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};

    const out: MetaCache = {};
    for (const [name, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!name) continue;
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.asOf !== 'string') continue;
      const homepage = typeof e.homepage === 'string' ? e.homepage : null;
      const help = typeof e.help === 'string' ? e.help : null;
      const changelog = typeof e.changelog === 'string' ? e.changelog : null;
      out[name] = { homepage, help, changelog, asOf: e.asOf };
    }
    return out;
  } catch {
    return {};
  }
};

const writeMetaCache = (cache: MetaCache) => {
  try {
    window.localStorage.setItem(MbfLsk.searchPluginsMeta, JSON.stringify(cache));
  } catch {
    // Ignore quota/blocked storage errors.
  }
};

const readVersionsCache = (): VersionsCache => {
  try {
    const raw = window.localStorage.getItem(MbfLsk.searchPluginsVersions);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};

    const out: VersionsCache = {};
    for (const [name, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!name) continue;
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.asOf !== 'string') continue;
      if (!Array.isArray(e.versions)) continue;
      const versions = (e.versions as unknown[]).filter((v): v is string => typeof v === 'string');
      out[name] = { versions, asOf: e.asOf };
    }
    return out;
  } catch {
    return {};
  }
};

const writeVersionsCache = (cache: VersionsCache) => {
  try {
    window.localStorage.setItem(MbfLsk.searchPluginsVersions, JSON.stringify(cache));
  } catch {
    // Ignore quota/blocked storage errors.
  }
};

interface SearchPluginsDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (pluginName: string) => void;
  onVersions: (versions: string[]) => void;
}

export const SearchPluginsDialog = ({ open, onClose, onSelect, onVersions }: SearchPluginsDialogProps) => {
  const [pluginName, setPluginName] = useState('');
  const selectedPluginNameRef = useRef('');
  const hasFetchedRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const [rows, setRows] = useState<PluginSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [totalsLoading, setTotalsLoading] = useState(false);
  const [totalsProgress, setTotalsProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const versionsCacheRef = useRef<VersionsCache>({});

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
    homepage: string | null;
    help: string | null;
    changelog: string | null;
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

  type NpmPackageLatestResponse = {
    homepage?: unknown;
    help?: unknown;
    changelog?: unknown;
    repository?: unknown;
  };

  type NpmPackageResponse = {
    versions?: Record<string, unknown>;
    'dist-tags'?: Record<string, unknown>;
  };

  const formatYyyyMmDd = (date: Date) => {
    const yyyy = date.getFullYear().toString();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getPackageVersions = useCallback(async (packageName: string, asOf: string): Promise<string[]> => {
    const cached = versionsCacheRef.current[packageName];
    const cacheLooksValid =
      !!cached &&
      cached.asOf === asOf &&
      Array.isArray(cached.versions) &&
      cached.versions.length > 0 &&
      // New format always starts with the literal tag string "latest".
      cached.versions[0] === 'latest';
    if (cacheLooksValid) {
      if (debug) console.log(`[SearchPluginsDialog] versions cache hit for ${packageName} (${cached.versions.length.toString()})`);
      return cached.versions;
    }
    if (cached && cached.asOf === asOf && cached.versions.length > 0 && cached.versions[0] !== 'latest') {
      if (debug) console.log(`[SearchPluginsDialog] versions cache ignored (old format) for ${packageName} (asOf=${asOf})`);
    }

    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    if (debug) console.log(`[SearchPluginsDialog] fetching versions for ${packageName} from: ${url}`);
    const response = await fetch(url, { signal: controllerRef.current?.signal });
    if (!response.ok) {
      if (debug) console.log(`[SearchPluginsDialog] versions fetch failed for ${packageName}: ${response.status.toString()} ${response.statusText}`);
      return [];
    }
    const json = (await response.json()) as NpmPackageResponse;
    const versionKeys = Object.keys(json.versions ?? {});

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    versionKeys.sort((a, b) => collator.compare(a, b)).reverse();

    const distTags = json['dist-tags'] ?? {};
    const hasDevTag = typeof distTags?.dev === 'string' && String(distTags.dev).trim().length > 0;

    // Versions list format requested by UI:
    // - Always start with the string "latest"
    // - Then "dev" if the npm dist-tag exists
    // - Then at most 20 latest version numbers
    const latestVersions = versionKeys.slice(0, 20);
    const list: string[] = ['latest'];
    if (hasDevTag) list.push('dev');
    list.push(...latestVersions);

    if (debug) console.log(`[SearchPluginsDialog] fetched versions for ${packageName} (tags: latest${hasDevTag ? ', dev' : ''}; latestVersions=${latestVersions.length.toString()}; allVersions=${versionKeys.length.toString()}):`, list);

    versionsCacheRef.current[packageName] = { versions: list, asOf };
    writeVersionsCache(versionsCacheRef.current);
    return list;
  }, []);

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
      required: true,
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
    },
    {
      label: 'Description',
      id: 'description',
      required: true,
      maxWidth: 300,
      tooltip: true,
    },
    {
      label: 'Author',
      id: 'author',
      maxWidth: 140,
      tooltip: true,
    },
    {
      label: 'Action',
      id: 'action',
      align: 'center',
      maxWidth: 100,
      noSort: true,
      required: true,
      render: (_value, _rowKey, row, _column) => (
        <div style={{ margin: '0', padding: '0', gap: '4px', display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
          <Tooltip title={row.homepage ? 'Open the plugin homepage' : 'No homepage available'}>
            <span>
              <IconButton
                style={{ margin: '0', padding: '0', width: '19px', height: '19px', color: 'var(--main-icon-color)' }}
                disabled={!row.homepage}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!row.homepage) return;
                  try {
                    const u = new URL(row.homepage);
                    if (u.protocol === 'http:' || u.protocol === 'https:') window.open(u.toString(), '_blank');
                  } catch {
                    // Ignore invalid URLs.
                  }
                }}
                size='small'
              >
                <HomeOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={row.help ? 'Open the plugin help' : 'No help available'}>
            <span>
              <IconButton
                style={{ margin: '0', padding: '0', width: '19px', height: '19px', color: 'var(--main-icon-color)' }}
                disabled={!row.help}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!row.help) return;
                  try {
                    const u = new URL(row.help);
                    if (u.protocol === 'http:' || u.protocol === 'https:') window.open(u.toString(), '_blank');
                  } catch {
                    // Ignore invalid URLs.
                  }
                }}
                size='small'
              >
                <HelpOutlineIcon />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={row.changelog ? 'Open the plugin changelog' : 'No changelog available'}>
            <span>
              <IconButton
                style={{ margin: '0', padding: '0', width: '19px', height: '19px', color: 'var(--main-icon-color)' }}
                disabled={!row.changelog}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!row.changelog) return;
                  try {
                    const u = new URL(row.changelog);
                    if (u.protocol === 'http:' || u.protocol === 'https:') window.open(u.toString(), '_blank');
                  } catch {
                    // Ignore invalid URLs.
                  }
                }}
                size='small'
              >
                <HistoryOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      ),
    },
  ];

  useEffect(() => {
    if (!open) {
      hasFetchedRef.current = false;
      selectedPluginNameRef.current = '';
      controllerRef.current?.abort();
      controllerRef.current = null;
      setRows([]);
      setLoading(false);
      setSelecting(false);
      setTotalsLoading(false);
      setTotalsProgress({ done: 0, total: 0 });
      setError(null);
      setPluginName('');
      return;
    }
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const controller = new AbortController();
    controllerRef.current = controller;
    versionsCacheRef.current = readVersionsCache();

    void (async () => {
      const prefix = 'matterbridge-';
      const size = 250;
      const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(prefix)}&size=${size}`;

      const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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

        const isLikelyBotUser = (username: string): boolean => {
          const u = String(username ?? '')
            .trim()
            .toLowerCase();
          if (!u) return false;

          // Common npm publishers when packages are released from CI.
          if (u === 'github actions') return true;
          if (u === 'github-actions') return true;
          if (u === 'github-actions[bot]') return true;
          if (u.includes('github-actions')) return true;
          if (u.endsWith('[bot]')) return true;

          return false;
        };

        const getDisplayAuthor = (pkg: NpmSearchPackage): string => {
          const maintainerUsernames = (pkg.maintainers ?? []).map((m) => (m.username ?? '').trim()).filter(Boolean);
          const publisherUsername = (pkg.publisher?.username ?? '').trim();

          // Prefer a non-bot maintainer (publisher is often a CI bot account).
          const maintainerHuman = maintainerUsernames.find((u) => !isLikelyBotUser(u));
          if (maintainerHuman) return maintainerHuman;

          // Fall back to non-bot publisher.
          if (publisherUsername && !isLikelyBotUser(publisherUsername)) return publisherUsername;

          // Last resort: whatever is available.
          return maintainerUsernames[0] ?? publisherUsername ?? '';
        };

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
          const author = getDisplayAuthor(pkg);
          const downloads = typeof obj.downloads?.monthly === 'number' ? obj.downloads.monthly : null;

          const npmLink = (pkg.links?.npm ?? '').trim();
          const homepageLink = (pkg.links?.homepage ?? '').trim();
          const homepage = (homepageLink || npmLink || (name ? `https://www.npmjs.com/package/${encodeURIComponent(name)}` : '')).trim() || null;

          return {
            name,
            version: pkg.version ?? '',
            downloads,
            total: null,
            description: pkg.description ?? '',
            author,
            official: isOfficial(pkg),
            homepage,
            help: null,
            changelog: null,
          };
        });

        // Hydrate totals + metadata from localStorage immediately, then refresh in background.
        const end = formatYyyyMmDd(new Date());
        const totalsCache = readTotalsCache();
        const metaCache = readMetaCache();

        const nextRowsWithCachedTotals: PluginSearchRow[] = nextRows.map((r) => {
          const cached = totalsCache[r.name];
          if (!cached) return r;
          if (typeof cached.total !== 'number') return r;
          if (debug) console.log(`[SearchPluginsDialog] total downloads loaded from cache for ${r.name} (asOf=${cached.asOf}):`, cached.total);
          return { ...r, total: cached.total };
        });

        const nextRowsWithCachedTotalsAndMeta: PluginSearchRow[] = nextRowsWithCachedTotals.map((r) => {
          const cached = metaCache[r.name];
          if (!cached) return r;
          if (cached.asOf !== end) return r;
          const nextHomepage = cached.homepage ?? r.homepage;
          const nextHelp = cached.help;
          const nextChangelog = cached.changelog;
          if (debug && (nextHelp || nextChangelog || (nextHomepage && nextHomepage !== r.homepage))) {
            console.log(`[SearchPluginsDialog] metadata loaded from cache for ${r.name} (asOf=${cached.asOf}):`, { homepage: nextHomepage, help: nextHelp, changelog: nextChangelog });
          }
          return { ...r, homepage: nextHomepage, help: nextHelp, changelog: nextChangelog };
        });

        setRows(nextRowsWithCachedTotalsAndMeta);

        // Prefetch versions for the visible rows.
        // The npm search API only returns the latest version; we need the package document for the version list.
        // This runs in the background (throttled) so selection can usually use the cache.
        const packagesNeedingVersionsFetchList = nextRows
          .map((r) => r.name)
          .filter((name) => {
            const cached = versionsCacheRef.current[name];
            return !cached || cached.asOf !== end || cached.versions.length === 0;
          });

        if (debug) console.log(`[SearchPluginsDialog] versions prefetch queue (${packagesNeedingVersionsFetchList.length.toString()}):`, packagesNeedingVersionsFetchList);

        const versionsConcurrency = 1;
        const versionsDelayBetweenRequestsMs = 200;
        let versionsIndex = 0;

        const versionsWorker = async () => {
          while (versionsIndex < packagesNeedingVersionsFetchList.length) {
            if (controller.signal.aborted) return;
            const rowIndex = versionsIndex;
            versionsIndex += 1;

            const packageName = packagesNeedingVersionsFetchList[rowIndex];
            if (!packageName) continue;

            try {
              const versions = await getPackageVersions(packageName, end);
              if (debug && versions.length > 0) {
                console.log(`[SearchPluginsDialog] versions fetched for ${packageName} (${versions.length.toString()}):`, versions.slice(0, 5));
              }
            } catch (error) {
              if (error instanceof DOMException && error.name === 'AbortError') return;
              // Ignore and keep going.
            } finally {
              if (!controller.signal.aborted) await sleep(versionsDelayBetweenRequestsMs);
            }
          }
        };

        void Promise.all(Array.from({ length: Math.min(versionsConcurrency, nextRows.length) }, () => versionsWorker()));

        // Fetch homepage/help/changelog from package.json (registry /latest).
        // If help/changelog are missing, derive them from repository.url + /blob/main/{README,CHANGELOG}.md.
        const packagesNeedingMetaFetchList = nextRows
          .map((r) => r.name)
          .filter((name) => {
            const cached = metaCache[name];
            const cacheFresh = !!cached && cached.asOf === end;
            const cacheComplete = !!cached && !!cached.help && !!cached.changelog;
            const needsFetch = !cacheFresh || !cacheComplete;
            if (!needsFetch && debug) console.log(`[SearchPluginsDialog] metadata fetch skipped (cache fresh+complete) for ${name} (asOf=${cached.asOf}).`);
            if (cacheFresh && !cacheComplete && debug) console.log(`[SearchPluginsDialog] metadata fetch forced (cache incomplete) for ${name} (asOf=${cached.asOf}).`);
            return needsFetch;
          });
        const packagesNeedingMetaFetchSet = new Set(packagesNeedingMetaFetchList);

        const fetchPackageMeta = async (packageName: string, fallbackHomepage: string | null): Promise<{ homepage: string | null; help: string | null; changelog: string | null } | null> => {
          const latestUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
          try {
            const latestResponse = await fetch(latestUrl, { signal: controller.signal });
            if (!latestResponse.ok) return null;
            const latestJson = (await latestResponse.json()) as NpmPackageLatestResponse;

            const homepageFromPackage = typeof latestJson.homepage === 'string' && latestJson.homepage.includes('http') ? normalizeGitUrl(latestJson.homepage) : null;
            const helpFromPackage = typeof latestJson.help === 'string' && latestJson.help.startsWith('http') ? latestJson.help.trim() : null;
            const changelogFromPackage = typeof latestJson.changelog === 'string' && latestJson.changelog.startsWith('http') ? latestJson.changelog.trim() : null;

            const repositoryRaw = getRepositoryUrl(latestJson.repository);
            const repositoryNormalized = repositoryRaw ? normalizeRepositoryUrl(repositoryRaw) : null;
            const repositoryUrl = repositoryNormalized && repositoryNormalized.includes('http') ? repositoryNormalized : null;

            // Mirror backend fallback logic (PluginManager): help/changelog -> repository blob/main -> homepage.
            const homepageResolved = homepageFromPackage || repositoryUrl || fallbackHomepage || null;
            const helpResolved = helpFromPackage || (repositoryUrl ? `${repositoryUrl}/blob/main/README.md` : null) || homepageResolved || null;
            const changelogResolved = changelogFromPackage || (repositoryUrl ? `${repositoryUrl}/blob/main/CHANGELOG.md` : null) || homepageResolved || null;
            return {
              homepage: homepageResolved,
              help: helpResolved,
              changelog: changelogResolved,
            };
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return null;
            return null;
          }
        };

        // Slow down requests to avoid rate limiting.
        const metaConcurrency = 1;
        const metaDelayBetweenRequestsMs = 250;
        let metaIndex = 0;

        const metaWorker = async () => {
          while (metaIndex < packagesNeedingMetaFetchList.length) {
            if (controller.signal.aborted) return;
            const rowIndex = metaIndex;
            metaIndex += 1;

            const packageName = packagesNeedingMetaFetchList[rowIndex];
            if (!packageName) continue;

            if (!packagesNeedingMetaFetchSet.has(packageName)) continue;
            packagesNeedingMetaFetchSet.delete(packageName);

            const fallbackHomepage = nextRows.find((r) => r.name === packageName)?.homepage ?? null;
            const meta = await fetchPackageMeta(packageName, fallbackHomepage);
            if (controller.signal.aborted) return;
            if (meta) {
              setRows((prev) =>
                prev.map((r) =>
                  r.name === packageName
                    ? {
                        ...r,
                        homepage: meta.homepage ?? r.homepage,
                        help: meta.help,
                        changelog: meta.changelog,
                      }
                    : r,
                ),
              );

              metaCache[packageName] = {
                homepage: meta.homepage,
                help: meta.help,
                changelog: meta.changelog,
                asOf: end,
              };
              writeMetaCache(metaCache);
            }

            if (!controller.signal.aborted) await sleep(metaDelayBetweenRequestsMs);
          }
        };

        void Promise.all(Array.from({ length: Math.min(metaConcurrency, nextRows.length) }, () => metaWorker()));

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
  }, [open, getPackageVersions]);

  const handleSelect = async () => {
    blurActiveElement();
    const selectedName = selectedPluginNameRef.current || pluginName;
    if (!selectedName || selecting) return;

    try {
      setSelecting(true);
      const asOf = formatYyyyMmDd(new Date());
      const versions = await getPackageVersions(selectedName, asOf);
      if (debug) console.log(`[SearchPluginsDialog] passing versions to onVersions() for ${selectedName} (${versions.length.toString()}):`, versions);
      onVersions(versions);
      setSelecting(false);
      onSelect(selectedName);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('[SearchPluginsDialog] npm versions fetch error:', error);
      onVersions([]);
      setSelecting(false);
      onSelect(selectedName);
    }
  };

  const handleCancel = () => {
    blurActiveElement();
    onClose();
    onVersions([]); // Clear any previously loaded versions.
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
                if (event.detail === 2) void handleSelect();
              }}
              footerLeft={`Total packages: ${rows.length.toString()}  Total downloads: ${formatNumber(totalMonthlyDownloads)} / ${totalAllTimeText}${totalsFooter}`}
              footerRight={pluginName ? `Selected: ${pluginName}` : ''}
            />
          )}
        </div>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Tooltip title='Select the plugin and close the dialog. Double-click a row to select and close the dialog.'>
          <Button variant='contained' onClick={handleSelect} disabled={!(selectedPluginNameRef.current || pluginName) || selecting}>
            Select
          </Button>
        </Tooltip>
        <Tooltip title='Close the dialog without selecting a plugin.'>
          <Button onClick={handleCancel}>Cancel</Button>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
};
