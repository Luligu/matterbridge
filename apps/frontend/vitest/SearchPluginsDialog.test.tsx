import '@testing-library/jest-dom';

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { SearchPluginsDialog } from '../src/components/SearchPluginsDialog';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { pluginIgnoreList } from '../src/pluginIgnoreList';
import { MbfLsk } from '../src/utils/localStorage';

const appState = vi.hoisted(() => ({ debug: false, enableMobile: false }));
vi.mock('../src/appState', () => appState);
vi.mock('@mui/material/Tooltip', () => ({ default: ({ children, title }: { children: React.ReactNode; title: string }) => <span title={title}>{children}</span> }));
vi.mock('../src/components/MbfTable', () => ({
  default: ({
    rows,
    columns,
    onRowClick,
    footerLeft,
    footerRight,
  }: {
    rows: { name: string; [key: string]: string | number | boolean | null }[];
    columns: { id: string; render?: (value: unknown, rowKey: string, row: { name: string }, column: unknown) => React.ReactNode }[];
    onRowClick: (row: { name: string }, rowKey: string, event: React.MouseEvent<HTMLButtonElement>) => void;
    footerLeft: string;
    footerRight: string;
  }) => (
    <div>
      {rows.map((row) => (
        <div key={row.name} data-testid={row.name}>
          <button type="button" onClick={(event) => onRowClick(row, row.name, event)}>
            {row.name}
          </button>
          {columns.map((column) => (
            <span key={column.id} data-testid={column.id}>
              {column.render ? column.render(row[column.id], row.name, row, column) : String(row[column.id] ?? '')}
            </span>
          ))}
        </div>
      ))}
      <span>{footerLeft}</span>
      <span>{footerRight}</span>
    </div>
  ),
}));

const packageNames = ['matterbridge-test-alpha', 'matterbridge-test-beta'];

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

function mockRegistry({
  objects = packageNames.map((name) => ({ package: { name, version: '1.0.0' }, downloads: { monthly: 10 } })),
  latest = {},
  versions = { 'versions': { '1.0.0': {}, '1.10.0': {}, '1.2.0': {} }, 'dist-tags': { dev: '2.0.0-dev' } },
  downloads = { downloads: [{ downloads: 3 }, {}, { downloads: 7 }] },
}: { objects?: unknown[]; latest?: unknown; versions?: unknown; downloads?: unknown } = {}) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = requestUrl(input);
    if (url.includes('/-/v1/search?')) return Response.json({ objects });
    if (url.endsWith('/latest')) return Response.json(latest);
    if (url.includes('/downloads/range/')) return Response.json(downloads);
    return Response.json(versions);
  });
}

function readCache(key: string): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
}

async function finishBackgroundWork(milliseconds = 2000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

beforeEach(() => {
  appState.debug = false;
  appState.enableMobile = false;
  window.localStorage.clear();
  const today = new Date();
  const asOf = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  window.localStorage.setItem(MbfLsk['search-plugins-versions'], JSON.stringify(Object.fromEntries(packageNames.map((name) => [name, { asOf, versions: ['latest', '1.0.0'] }]))));
  window.localStorage.setItem(MbfLsk['search-plugins-total'], JSON.stringify(Object.fromEntries(packageNames.map((name) => [name, { asOf, total: 10 }]))));
  window.localStorage.setItem(
    MbfLsk['search-plugins-meta'],
    JSON.stringify(
      Object.fromEntries(
        packageNames.map((name) => [name, { asOf, homepage: 'https://example.com', help: 'https://example.com/help', changelog: 'https://example.com/changelog' }]),
      ),
    ),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ objects: packageNames.map((name) => ({ package: { name, version: '1.0.0' }, downloads: { monthly: 10 } })) }),
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.localStorage.clear();
});

function renderDialog({ open = true, mobile = false }: { open?: boolean; mobile?: boolean } = {}) {
  const onClose = vi.fn();
  const onSelect = vi.fn();
  const onVersions = vi.fn();
  const view = (open: boolean) => (
    <UiContext.Provider value={{ mobile } as UiContextType}>
      <SearchPluginsDialog open={open} onClose={onClose} onSelect={onSelect} onVersions={onVersions} />
    </UiContext.Provider>
  );
  const { rerender, unmount } = render(view(open));
  return { onClose, onSelect, onVersions, unmount, setOpen: (open: boolean) => rerender(view(open)) };
}

describe('SearchPluginsDialog', () => {
  test('should filter invalid and ignored packages, prefer human authors, and sort official plugins first', async () => {
    const packages = [
      { name: 'matterbridge-zeta', publisher: { username: 'Luligu' }, links: { homepage: ' https://example.com/zeta ' } },
      { name: 'matterbridge-alpha', publisher: { username: 'publisher' }, maintainers: [{ username: 'human' }], links: { npm: 'https://example.com/npm' } },
      { name: 'matterbridge-beta', maintainers: [{}, { username: 'LULIGU' }], description: 'Official plugin' },
      { name: 'matterbridge-gamma', publisher: { username: 'human-publisher' }, maintainers: [{ username: 'github-actions' }] },
      ...['github actions', 'github-actions', 'github-actions[bot]', 'custom-github-actions-user', 'release[bot]'].map((username, index) => ({
        name: `matterbridge-bot-${index}`,
        publisher: { username },
        maintainers: [{ username }],
      })),
      { name: 'matterbridge-no-author', maintainers: [{}] },
      { name: 'matterbridge-publisher-bot', publisher: { username: 'ci[bot]' } },
    ];
    for (const key of [MbfLsk['search-plugins-total'], MbfLsk['search-plugins-meta'], MbfLsk['search-plugins-versions']]) {
      const entry = readCache(key)[packageNames[0]];
      window.localStorage.setItem(key, JSON.stringify(Object.fromEntries(packages.map(({ name }) => [name, entry]))));
    }
    mockRegistry({
      objects: [
        null,
        {},
        { package: { name: 42 } },
        { package: { name: 'unrelated-package' } },
        ...pluginIgnoreList.map((name) => ({ package: { name } })),
        ...packages.map((pkg) => ({ package: pkg })),
      ],
    });
    renderDialog();
    await screen.findByRole('button', { name: 'matterbridge-alpha' });
    const rows = screen.getAllByTestId(/^matterbridge-/);
    expect(rows.map((row) => row.dataset.testid)).toEqual([
      'matterbridge-beta',
      'matterbridge-zeta',
      'matterbridge-alpha',
      ...Array.from({ length: 5 }, (_, index) => `matterbridge-bot-${index}`),
      'matterbridge-gamma',
      'matterbridge-no-author',
      'matterbridge-publisher-bot',
    ]);
    expect(within(screen.getByTestId('matterbridge-alpha')).getByTestId('author')).toHaveTextContent('human');
    expect(within(screen.getByTestId('matterbridge-gamma')).getByTestId('author')).toHaveTextContent('human-publisher');
    expect(within(screen.getByTestId('matterbridge-no-author')).getByTestId('author')).toBeEmptyDOMElement();
    expect(within(screen.getByTestId('matterbridge-publisher-bot')).getByTestId('author')).toHaveTextContent('ci[bot]');
    expect(within(screen.getByTestId('matterbridge-beta')).getByTestId('description')).toHaveTextContent('Official plugin');
    expect(within(screen.getByTestId('matterbridge-beta')).getByTestId('version')).toBeEmptyDOMElement();
    expect(within(screen.getByTestId('matterbridge-beta')).getByTestId('downloads')).toBeEmptyDOMElement();
    expect(fetch).toHaveBeenCalledOnce();
  });

  test.each([
    { endpoint: 'latest', key: MbfLsk['search-plugins-meta'] },
    { endpoint: 'versions', key: MbfLsk['search-plugins-versions'] },
    { endpoint: 'downloads', key: MbfLsk['search-plugins-total'] },
  ])('should tolerate HTTP failures in the $endpoint worker', async ({ key }) => {
    vi.useFakeTimers();
    appState.debug = true;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    window.localStorage.removeItem(key);
    mockRegistry();
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) =>
      requestUrl(input).includes('/-/v1/search?') ? baseFetch(input, init) : new Response(null, { status: 503, statusText: 'Unavailable' }),
    );
    renderDialog();
    await finishBackgroundWork();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: packageNames[0] })).toBeInTheDocument();
    expect(readCache(key)).toEqual({});
    expect(screen.queryByText(/Totals:.*fetched/)).not.toBeInTheDocument();
  });

  test.each(
    [
      { endpoint: 'latest', key: MbfLsk['search-plugins-meta'] },
      { endpoint: 'versions', key: MbfLsk['search-plugins-versions'] },
      { endpoint: 'downloads', key: MbfLsk['search-plugins-total'] },
    ].flatMap((scenario) => [false, true].map((aborted) => ({ endpoint: scenario.endpoint, key: scenario.key, aborted }))),
  )('should handle $endpoint rejection with aborted=$aborted', async ({ endpoint, key, aborted }) => {
    vi.useFakeTimers();
    window.localStorage.removeItem(key);
    mockRegistry();
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (requestUrl(input).includes('/-/v1/search?')) return baseFetch(input, init);
      throw aborted ? new DOMException('Aborted', 'AbortError') : new Error('Network error');
    });
    renderDialog();
    // Downloads network errors back off 5 s then 10 s and retry, three attempts per package.
    const retriesDownloads = endpoint === 'downloads' && !aborted;
    await finishBackgroundWork(retriesDownloads ? 40_000 : 2000);
    expect(fetch).toHaveBeenCalledTimes(retriesDownloads ? 7 : aborted && endpoint !== 'latest' ? 2 : 3);
    expect(readCache(key)).toEqual({});
    expect(screen.getByRole('button', { name: packageNames[0] })).toBeInTheDocument();
  });

  test.each([false, true])('should handle selection-time version rejection with aborted=%s', async (aborted) => {
    const cached = readCache(MbfLsk['search-plugins-versions'])[packageNames[0]] as { asOf: string };
    window.localStorage.setItem(
      MbfLsk['search-plugins-versions'],
      JSON.stringify(Object.fromEntries(packageNames.map((name) => [name, { asOf: cached.asOf, versions: ['1.0.0'] }]))),
    );
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    const error = aborted ? new DOMException('Aborted', 'AbortError') : new Error('Version lookup failed');
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (requestUrl(input).includes('/-/v1/search?')) return baseFetch(input, init);
      throw error;
    });
    const { onSelect, onVersions } = renderDialog();
    fireEvent.click(await screen.findByRole('button', { name: packageNames[0] }), { detail: 2 });
    await act(async () => {
      await Promise.resolve();
    });
    expect(onSelect.mock.calls).toEqual(aborted ? [] : [[packageNames[0]]]);
    // A network error falls back to the cached list (none valid here) instead of rejecting.
    expect(onVersions.mock.calls).toEqual(aborted ? [] : [[[]]]);
    expect(log.mock.calls).toEqual([]);
  });

  test.each([new Error('Version lookup failed'), new Response('', { status: 429 })])('should fall back to the stale cached versions when the fetch fails (%s)', async (failure) => {
    window.localStorage.setItem(
      MbfLsk['search-plugins-versions'],
      JSON.stringify(Object.fromEntries(packageNames.map((name) => [name, { asOf: '2000-01-01', versions: ['latest', '0.9.0'] }]))),
    );
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (requestUrl(input).includes('/-/v1/search?')) return baseFetch(input, init);
      if (failure instanceof Error) throw failure;
      return failure.clone();
    });
    const { onSelect, onVersions } = renderDialog();
    fireEvent.click(await screen.findByRole('button', { name: packageNames[0] }), { detail: 2 });
    await act(async () => {
      await Promise.resolve();
    });
    expect(onVersions).toHaveBeenCalledWith(['latest', '0.9.0']);
    expect(onSelect).toHaveBeenCalledWith(packageNames[0]);
  });

  test('should ignore additional selection attempts while versions are pending', async () => {
    const cached = readCache(MbfLsk['search-plugins-versions'])[packageNames[0]] as { asOf: string };
    window.localStorage.setItem(
      MbfLsk['search-plugins-versions'],
      JSON.stringify(Object.fromEntries(packageNames.map((name) => [name, { asOf: cached.asOf, versions: ['1.0.0'] }]))),
    );
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    let resolveVersions!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveVersions = resolve;
    });
    vi.mocked(fetch).mockImplementation(async (input, init) => (requestUrl(input).includes('/-/v1/search?') ? baseFetch(input, init) : pending));
    const { onSelect } = renderDialog();
    const row = await screen.findByRole('button', { name: packageNames[0] });
    fireEvent.click(row, { detail: 2 });
    fireEvent.click(row, { detail: 2 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();
    await act(async () => {
      resolveVersions(Response.json({}));
    });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(packageNames[0]);
  });

  test('should abort active background requests on unmount and avoid further row updates', async () => {
    vi.useFakeTimers();
    window.localStorage.clear();
    mockRegistry();
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    const signals: AbortSignal[] = [];
    const resolvers: ((response: Response) => void)[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (requestUrl(input).includes('/-/v1/search?')) return baseFetch(input, init);
      signals.push(init!.signal!);
      return new Promise<Response>((resolve) => {
        resolvers.push(resolve);
      });
    });
    const { unmount } = renderDialog();
    await finishBackgroundWork(0);
    expect(screen.getByText(/Totals: 0\/2 fetched/)).toBeInTheDocument();
    expect(signals).toHaveLength(3);
    unmount();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    await act(async () => {
      for (const resolve of resolvers) resolve(Response.json({ downloads: [{ downloads: 10 }] }));
    });
    await finishBackgroundWork();
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(readCache(MbfLsk['search-plugins-total'])).toEqual({});
    expect(readCache(MbfLsk['search-plugins-meta'])).toEqual({});
  });

  test('should stop queued background requests when closed during throttling', async () => {
    vi.useFakeTimers();
    window.localStorage.clear();
    mockRegistry();
    const { setOpen } = renderDialog();
    await finishBackgroundWork(0);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(screen.getByText(/Totals: 1\/2 fetched/)).toBeInTheDocument();
    setOpen(false);
    await finishBackgroundWork();
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test.each([false, true])('should apply responsive dialog dimensions with mobile=%s', async (mobile) => {
    appState.enableMobile = true;
    renderDialog({ mobile });
    await screen.findByRole('button', { name: packageNames[0] });
    expect(screen.getByRole('dialog')).toHaveStyle({ width: `${window.innerWidth * (mobile ? 1 : 0.75)}px`, height: `${window.innerHeight * (mobile ? 1 : 0.75)}px` });
  });

  test('should fetch and cache metadata, sorted versions, and download totals on a cold start', async () => {
    vi.useFakeTimers();
    appState.debug = true;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    window.localStorage.clear();
    mockRegistry({ latest: { homepage: 'git+https://example.com/plugin.git', help: 'https://example.com/help', changelog: 'https://example.com/changes' } });
    const { onSelect, onVersions } = renderDialog();
    expect(screen.getByText('Loading npm registry...')).toBeInTheDocument();
    await finishBackgroundWork();
    const row = within(screen.getByTestId(packageNames[0]));
    expect(row.getByTestId('total')).toHaveTextContent('10');
    expect(row.getByTestId('downloads')).toHaveTextContent('10');
    expect(row.getByTitle('Open the plugin help')).toBeInTheDocument();
    expect(readCache(MbfLsk['search-plugins-meta'])[packageNames[0]]).toEqual(
      expect.objectContaining({ homepage: 'https://example.com/plugin', help: 'https://example.com/help', changelog: 'https://example.com/changes' }),
    );
    expect(readCache(MbfLsk['search-plugins-total'])[packageNames[0]]).toEqual(expect.objectContaining({ total: 10 }));
    expect(fetch).toHaveBeenCalledTimes(7);
    fireEvent.click(row.getByRole('button', { name: packageNames[0] }), { detail: 2 });
    await finishBackgroundWork(0);
    expect(onVersions).toHaveBeenCalledExactlyOnceWith(['latest', 'dev', '1.10.0', '1.2.0', '1.0.0']);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(packageNames[0]);
    expect(fetch).toHaveBeenCalledTimes(7);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('versions cache hit'));
  });

  test.each([
    ['git://github.com/owner/plugin.git', 'https://github.com/owner/plugin'],
    [{ url: 'ssh://git@github.com/owner/plugin.git' }, 'https://github.com/owner/plugin'],
    ['git@github.com:owner/plugin.git', 'https://github.com/owner/plugin'],
    [{ url: 'git+https://github.com/owner/plugin.git' }, 'https://github.com/owner/plugin'],
    ['   ', 'https://www.npmjs.com/package/matterbridge-test-alpha'],
    [{ url: '  ' }, 'https://www.npmjs.com/package/matterbridge-test-alpha'],
    [{ url: 42 }, 'https://www.npmjs.com/package/matterbridge-test-alpha'],
    [42, 'https://www.npmjs.com/package/matterbridge-test-alpha'],
    [null, 'https://www.npmjs.com/package/matterbridge-test-alpha'],
    ['file:///plugin', 'https://www.npmjs.com/package/matterbridge-test-alpha'],
  ])('should normalize repository %j and resolve metadata fallbacks', async (repository, homepage) => {
    vi.useFakeTimers();
    window.localStorage.removeItem(MbfLsk['search-plugins-meta']);
    mockRegistry({ latest: { repository, homepage: 42, help: false, changelog: 'file:///changes' } });
    renderDialog();
    await finishBackgroundWork();
    const isRepository = homepage.startsWith('https://github.com/');
    expect(readCache(MbfLsk['search-plugins-meta'])[packageNames[0]]).toEqual(
      expect.objectContaining({
        homepage,
        help: isRepository ? `${homepage}/blob/main/README.md` : homepage,
        changelog: isRepository ? `${homepage}/blob/main/CHANGELOG.md` : homepage,
      }),
    );
  });

  test.each([
    '{broken',
    'null',
    '42',
    JSON.stringify({
      '': {},
      'invalid': null,
      'primitive': 4,
      'badDate': { asOf: 4 },
      'badTotal': { total: '4', asOf: 'old' },
      'badVersions': { versions: 'latest', asOf: 'old' },
    }),
  ])('should recover from invalid cache data %s', async (raw) => {
    vi.useFakeTimers();
    for (const key of [MbfLsk['search-plugins-total'], MbfLsk['search-plugins-meta'], MbfLsk['search-plugins-versions']]) window.localStorage.setItem(key, raw);
    mockRegistry();
    renderDialog();
    await finishBackgroundWork();
    expect(readCache(MbfLsk['search-plugins-total'])[packageNames[0]]).toEqual(expect.objectContaining({ total: 10 }));
    expect(readCache(MbfLsk['search-plugins-versions'])[packageNames[0]]).toEqual(expect.objectContaining({ versions: ['latest', 'dev', '1.10.0', '1.2.0', '1.0.0'] }));
    expect(screen.getByRole('button', { name: packageNames[0] })).toBeInTheDocument();
  });

  test('should continue fetching when storage reads and writes throw', async () => {
    vi.useFakeTimers();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    mockRegistry();
    const { onVersions } = renderDialog();
    await finishBackgroundWork();
    fireEvent.click(screen.getByRole('button', { name: packageNames[0] }), { detail: 2 });
    await finishBackgroundWork(0);
    expect(onVersions).toHaveBeenCalledExactlyOnceWith(['latest', 'dev', '1.10.0', '1.2.0', '1.0.0']);
    expect(within(screen.getByTestId(packageNames[0])).getByTestId('total')).toHaveTextContent('10');
  });

  test('should refresh stale totals and versions and incomplete metadata', async () => {
    vi.useFakeTimers();
    appState.debug = true;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const cachedMeta = readCache(MbfLsk['search-plugins-meta'])[packageNames[0]] as { asOf: string };
    window.localStorage.setItem(
      MbfLsk['search-plugins-meta'],
      JSON.stringify({
        [packageNames[0]]: { asOf: cachedMeta.asOf, homepage: 42, help: null, changelog: false },
        [packageNames[1]]: { asOf: '2000-01-01', homepage: 'https://stale.example', help: 'https://stale.example', changelog: 'https://stale.example' },
      }),
    );
    window.localStorage.setItem(MbfLsk['search-plugins-total'], JSON.stringify({ [packageNames[0]]: { asOf: '2000-01-01', total: 99 } }));
    window.localStorage.setItem(
      MbfLsk['search-plugins-versions'],
      JSON.stringify({ [packageNames[0]]: { asOf: '2000-01-01', versions: ['latest'] }, [packageNames[1]]: { asOf: cachedMeta.asOf, versions: [42, null] } }),
    );
    mockRegistry();
    renderDialog();
    await finishBackgroundWork();
    expect(fetch).toHaveBeenCalledTimes(7);
    expect(readCache(MbfLsk['search-plugins-total'])[packageNames[0]]).toEqual(expect.objectContaining({ total: 10 }));
    expect(readCache(MbfLsk['search-plugins-meta'])[packageNames[0]]).toEqual(expect.objectContaining({ homepage: 'https://www.npmjs.com/package/matterbridge-test-alpha' }));
  });

  test.each([{}, { 'versions': {}, 'dist-tags': { dev: '  ' } }, { 'versions': { '1.0.0': {} }, 'dist-tags': { dev: 42 } }])(
    'should omit the dev tag and tolerate missing version data: %j',
    async (versions) => {
      vi.useFakeTimers();
      appState.debug = true;
      vi.spyOn(console, 'log').mockImplementation(() => {});
      window.localStorage.removeItem(MbfLsk['search-plugins-versions']);
      mockRegistry({ versions });
      const { onVersions } = renderDialog();
      await finishBackgroundWork();
      fireEvent.click(screen.getByRole('button', { name: packageNames[0] }), { detail: 2 });
      await finishBackgroundWork(0);
      expect(onVersions).toHaveBeenCalledExactlyOnceWith(['latest', ...Object.keys(versions.versions ?? {})]);
    },
  );

  test('should replace the old versions cache format and return at most twenty versions', async () => {
    appState.debug = true;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cached = readCache(MbfLsk['search-plugins-versions'])[packageNames[0]] as { asOf: string };
    window.localStorage.setItem(
      MbfLsk['search-plugins-versions'],
      JSON.stringify(Object.fromEntries(packageNames.map((name) => [name, { asOf: cached.asOf, versions: ['1.0.0', 42] }]))),
    );
    mockRegistry({ versions: { versions: Object.fromEntries(Array.from({ length: 25 }, (_, index) => [`1.0.${index}`, {}])) } });
    const { onVersions } = renderDialog();
    fireEvent.click(await screen.findByRole('button', { name: packageNames[0] }), { detail: 2 });
    await waitFor(() => expect(onVersions).toHaveBeenCalledExactlyOnceWith(['latest', ...Array.from({ length: 20 }, (_, index) => `1.0.${24 - index}`)]));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('versions cache ignored (old format)'));
  });

  test.each([{}, { downloads: [] }, { downloads: [{ downloads: '3' }, null] }, { downloads: [{ downloads: 0 }] }])(
    'should handle empty, invalid, and zero download totals: %j',
    async (downloads) => {
      vi.useFakeTimers();
      window.localStorage.removeItem(MbfLsk['search-plugins-total']);
      mockRegistry({ downloads });
      renderDialog();
      await finishBackgroundWork();
      const expected = downloads.downloads?.some((entry) => typeof entry?.downloads === 'number') ? '0' : '';
      expect(within(screen.getByTestId(packageNames[0])).getByTestId('total').textContent).toBe(expected);
    },
  );

  test.each([404, 500])('should leave downloads blank without retrying HTTP %s', async (status) => {
    vi.useFakeTimers();
    window.localStorage.removeItem(MbfLsk['search-plugins-total']);
    mockRegistry();
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => (requestUrl(input).includes('/downloads/range/') ? new Response(null, { status }) : baseFetch(input, init)));
    renderDialog();
    await finishBackgroundWork();
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => requestUrl(url).includes('/downloads/range/'))).toHaveLength(2);
    expect(within(screen.getByTestId(packageNames[0])).getByTestId('total')).toBeEmptyDOMElement();
  });

  test.each(['0.01', 'invalid', null])('should retry rate-limited downloads using Retry-After=%s', async (retryAfter) => {
    vi.useFakeTimers();
    window.localStorage.removeItem(MbfLsk['search-plugins-total']);
    mockRegistry();
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    let attempts = 0;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (requestUrl(input).includes('/downloads/range/') && attempts++ === 0)
        return new Response(null, { status: 429, headers: retryAfter === null ? {} : { 'retry-after': retryAfter } });
      return baseFetch(input, init);
    });
    renderDialog();
    await finishBackgroundWork(4000);
    expect(attempts).toBe(3);
    expect(within(screen.getByTestId(packageNames[0])).getByTestId('total')).toHaveTextContent('10');
  });

  test('should stop retrying rate-limited downloads after three attempts per package', async () => {
    vi.useFakeTimers();
    window.localStorage.removeItem(MbfLsk['search-plugins-total']);
    mockRegistry();
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) =>
      requestUrl(input).includes('/downloads/range/') ? new Response(null, { status: 429, headers: { 'retry-after': '0' } }) : baseFetch(input, init),
    );
    renderDialog();
    await finishBackgroundWork();
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => requestUrl(url).includes('/downloads/range/'))).toHaveLength(6);
    expect(within(screen.getByTestId(packageNames[0])).getByTestId('total')).toBeEmptyDOMElement();
  });

  test('should report versions errors in the prefetch queue and on selection when the versions response is invalid', async () => {
    vi.useFakeTimers();
    appState.debug = true;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.removeItem(MbfLsk['search-plugins-versions']);
    mockRegistry();
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = requestUrl(input);
      if (url.includes('/-/v1/search?') || url.endsWith('/latest') || url.includes('/downloads/range/')) return baseFetch(input, init);
      return new Response('not json');
    });
    const { onSelect, onVersions } = renderDialog();
    await finishBackgroundWork();
    expect(log).toHaveBeenCalledWith(expect.stringContaining(`versions error for ${packageNames[0]}:`), expect.any(SyntaxError));
    expect(readCache(MbfLsk['search-plugins-versions'])).toEqual({});
    fireEvent.click(screen.getByRole('button', { name: packageNames[0] }), { detail: 2 });
    await finishBackgroundWork(0);
    expect(error).toHaveBeenCalledWith('[SearchPluginsDialog] npm versions fetch error:', expect.any(SyntaxError));
    expect(onVersions).toHaveBeenCalledExactlyOnceWith([]);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(packageNames[0]);
    expect(screen.getByRole('button', { name: 'Select' })).toBeEnabled();
  });

  test('should back off on download network errors and stop the queue after three consecutive failures', async () => {
    vi.useFakeTimers();
    appState.debug = true;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    window.localStorage.removeItem(MbfLsk['search-plugins-total']);
    const names = ['a', 'b', 'c', 'd', 'e'].map((suffix) => `matterbridge-test-${suffix}`);
    mockRegistry({ objects: names.map((name) => ({ package: { name, version: '1.0.0' }, downloads: { monthly: 10 } })) });
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (requestUrl(input).includes('/downloads/range/')) throw new TypeError('Load failed');
      return baseFetch(input, init);
    });
    renderDialog();
    await finishBackgroundWork(120_000);
    // Three packages with three attempts each, then the queue stops before the last two.
    const rangeCalls = vi
      .mocked(fetch)
      .mock.calls.map(([url]) => requestUrl(url))
      .filter((url) => url.includes('/downloads/range/'));
    expect(rangeCalls).toHaveLength(9);
    expect(rangeCalls.some((url) => url.includes(names[3]) || url.includes(names[4]))).toBe(false);
    expect(readCache(MbfLsk['search-plugins-total'])).toEqual({});
    expect(screen.queryByText(/Totals:.*fetched/)).not.toBeInTheDocument();
    expect(log).toHaveBeenCalledWith(expect.stringContaining(`totals network error for ${names[0]} attempt 1/3, waiting 5000ms:`), expect.any(TypeError));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('totals queue stopped after 3 consecutive failures (2 left for the next open)'));
  });

  test.each([429, 500])('should keep the stale cached total and links when the refresh fails with HTTP %s', async (status) => {
    vi.useFakeTimers();
    window.localStorage.setItem(MbfLsk['search-plugins-total'], JSON.stringify(Object.fromEntries(packageNames.map((name) => [name, { asOf: '2000-01-01', total: 99 }]))));
    window.localStorage.setItem(
      MbfLsk['search-plugins-meta'],
      JSON.stringify(
        Object.fromEntries(packageNames.map((name) => [name, { asOf: '2000-01-01', homepage: 'https://stale.example', help: 'https://stale.example/help', changelog: null }])),
      ),
    );
    mockRegistry();
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = requestUrl(input);
      if (url.includes('/downloads/range/') || url.endsWith('/latest')) return new Response(null, { status, headers: { 'retry-after': '0' } });
      return baseFetch(input, init);
    });
    renderDialog();
    await finishBackgroundWork();
    expect(within(screen.getByTestId(packageNames[0])).getByTestId('total')).toHaveTextContent('99');
    expect(readCache(MbfLsk['search-plugins-total'])[packageNames[0]]).toEqual({ asOf: '2000-01-01', total: 99 });
    expect(readCache(MbfLsk['search-plugins-meta'])[packageNames[0]]).toEqual(expect.objectContaining({ asOf: '2000-01-01', help: 'https://stale.example/help' }));
  });

  test.each(['invalid URL', 'javascript:alert(1)', 'http://example.com/plugin'])('should only open valid HTTP links: %s', async (url) => {
    const cached = readCache(MbfLsk['search-plugins-meta'])[packageNames[0]] as { asOf: string };
    window.localStorage.setItem(
      MbfLsk['search-plugins-meta'],
      JSON.stringify(Object.fromEntries(packageNames.map((name) => [name, { asOf: cached.asOf, homepage: url, help: url, changelog: url }]))),
    );
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderDialog();
    await screen.findByRole('button', { name: packageNames[0] });
    for (const button of within(within(screen.getByTestId(packageNames[0])).getByTestId('action')).getAllByRole('button')) fireEvent.click(button);
    expect(open.mock.calls).toEqual(
      url.startsWith('http:')
        ? [
            [url, '_blank'],
            [url, '_blank'],
            [url, '_blank'],
          ]
        : [],
    );
  });

  test('should wait to fetch until opened and clear versions when cancelled', async () => {
    const { onClose, onVersions, setOpen } = renderDialog({ open: false });
    expect(fetch).not.toHaveBeenCalled();
    setOpen(true);
    await screen.findByRole('button', { name: packageNames[0] });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    act(() => cancel.focus());
    fireEvent.click(cancel);
    expect(cancel).not.toHaveFocus();
    expect(onClose).toHaveBeenCalledOnce();
    expect(onVersions).toHaveBeenCalledExactlyOnceWith([]);
  });

  test('should close on Escape without clearing versions', async () => {
    const { onClose, onVersions } = renderDialog();
    await screen.findByRole('button', { name: packageNames[0] });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(onVersions).not.toHaveBeenCalled();
  });

  test.each([new Error('Network unavailable'), 'Registry unavailable'])('should display a rejected registry request: %s', async (rejection) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValue(rejection);
    renderDialog();
    expect(await screen.findByText(rejection instanceof Error ? rejection.message : rejection)).toBeInTheDocument();
    expect(log).toHaveBeenCalledWith('[SearchPluginsDialog] npm registry fetch error:', rejection);
  });

  test('should save the plugin list after a successful search', async () => {
    renderDialog();
    await screen.findByRole('button', { name: packageNames[0] });
    const cached = readCache(MbfLsk['search-plugins-search']) as { asOf: string; rows: { name: string; version: string }[] };
    expect(cached.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(cached.rows.map((r) => r.name)).toEqual(packageNames);
    expect(cached.rows[0]).toEqual(expect.objectContaining({ version: '1.0.0', downloads: 10 }));
  });

  test('should show the cached plugin list at once while the search is pending', async () => {
    appState.debug = true;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    window.localStorage.setItem(
      MbfLsk['search-plugins-search'],
      JSON.stringify({
        asOf: '2000-01-01',
        rows: [{ name: packageNames[0], version: '0.9.0', downloads: 5, description: 'Cached plugin', author: 'someone', official: false, homepage: null }],
      }),
    );
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => {}));
    renderDialog();
    expect(await screen.findByRole('button', { name: packageNames[0] })).toBeInTheDocument();
    const row = within(screen.getByTestId(packageNames[0]));
    expect(row.getByTestId('version')).toHaveTextContent('0.9.0');
    expect(row.getByTestId('total')).toHaveTextContent('10');
    expect(row.getByTitle('Open the plugin help')).toBeInTheDocument();
    expect(screen.queryByText('Loading npm registry...')).not.toBeInTheDocument();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('showing cached plugin list (1 rows, asOf=2000-01-01)'));
  });

  test('should show the stale cached plugin list with a notice when the search fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.setItem(
      MbfLsk['search-plugins-search'],
      JSON.stringify({
        asOf: '2000-01-01',
        rows: [
          { name: 'matterbridge-cached', version: '0.9.0', downloads: 5, description: 'Cached plugin', author: 'someone', official: false, homepage: null },
          { name: 42 },
          null,
        ],
      }),
    );
    window.localStorage.setItem(MbfLsk['search-plugins-total'], JSON.stringify({ 'matterbridge-cached': { asOf: '2000-01-01', total: 77 } }));
    vi.mocked(fetch).mockRejectedValue(new Error('Network unavailable'));
    renderDialog();
    expect(await screen.findByText('Showing the cached plugin list from 2000-01-01: Network unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'matterbridge-cached' })).toBeInTheDocument();
    expect(within(screen.getByTestId('matterbridge-cached')).getByTestId('total')).toHaveTextContent('77');
    expect(screen.queryByText('Loading npm registry...')).not.toBeInTheDocument();
    expect(log).toHaveBeenCalledWith('[SearchPluginsDialog] npm registry fetch error:', expect.any(Error));
  });

  test.each(['not json', JSON.stringify({ asOf: 1, rows: [] }), JSON.stringify({ asOf: '2000-01-01', rows: [] }), JSON.stringify(null)])(
    'should show the error when the cached plugin list is unusable: %s',
    async (raw) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      window.localStorage.setItem(MbfLsk['search-plugins-search'], raw);
      vi.mocked(fetch).mockRejectedValue(new Error('Network unavailable'));
      renderDialog();
      expect(await screen.findByText('Network unavailable')).toBeInTheDocument();
    },
  );

  test('should display the status of an unsuccessful registry response', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503, statusText: 'Unavailable' }));
    renderDialog();
    expect(await screen.findByText('npm registry request failed: 503 Unavailable')).toBeInTheDocument();
  });

  test('should ignore an aborted registry request', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    renderDialog();
    await waitFor(() => expect(screen.queryByText('Loading npm registry...')).not.toBeInTheDocument());
    expect(log).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();
  });

  test.each([{}, { objects: [] }])('should render empty results for %j', async (payload) => {
    vi.mocked(fetch).mockResolvedValue(Response.json(payload));
    renderDialog();
    await waitFor(() => expect(screen.queryByText('Loading npm registry...')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: packageNames[0] })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();
  });

  test.each([
    ['Open the plugin homepage', 'https://example.com/'],
    ['Open the plugin help', 'https://example.com/help'],
    ['Open the plugin changelog', 'https://example.com/changelog'],
  ])('should open %s without selecting the row', async (title, url) => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { onSelect } = renderDialog();
    await screen.findByRole('button', { name: packageNames[0] });
    const row = screen.getByTestId(packageNames[0]);
    fireEvent.click(within(within(row).getByTitle(title)).getByRole('button'));
    expect(open).toHaveBeenCalledExactlyOnceWith(url, '_blank');
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();
  });

  test('should enable Select after a single row click and disable it while selection is pending', async () => {
    const { onSelect, onVersions } = renderDialog();
    const selectButton = screen.getByRole('button', { name: /^Select$/ });
    expect(selectButton).toBeDisabled();
    fireEvent.click(await screen.findByRole('button', { name: packageNames[0] }), { detail: 1 });
    expect(selectButton).toBeEnabled();
    expect(screen.getByText(`Selected: ${packageNames[0]}`)).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(selectButton);
    expect(selectButton).toBeDisabled();
    await waitFor(() => expect(onSelect).toHaveBeenCalledExactlyOnceWith(packageNames[0]));
    expect(onVersions).toHaveBeenCalledExactlyOnceWith(['latest', '1.0.0']);
    expect(selectButton).toBeEnabled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('should select the double-clicked row when state still contains the previous selection', async () => {
    const { onSelect, onVersions } = renderDialog();
    fireEvent.click(await screen.findByRole('button', { name: packageNames[0] }), { detail: 1 });
    fireEvent.click(screen.getByRole('button', { name: packageNames[1] }), { detail: 2 });

    await waitFor(() => expect(onSelect).toHaveBeenCalledExactlyOnceWith(packageNames[1]));
    expect(onVersions).toHaveBeenCalledExactlyOnceWith(['latest', '1.0.0']);
    expect(screen.getByText(`Selected: ${packageNames[1]}`)).toBeInTheDocument();
  });

  test('should clear the selection and disable Select when the dialog is reopened', async () => {
    const { onSelect, setOpen } = renderDialog();
    fireEvent.click(await screen.findByRole('button', { name: packageNames[0] }), { detail: 1 });
    expect(screen.getByRole('button', { name: /^Select$/ })).toBeEnabled();

    setOpen(false);
    setOpen(true);
    await screen.findByRole('button', { name: packageNames[0] });
    expect(screen.getByRole('button', { name: /^Select$/ })).toBeDisabled();
    expect(screen.queryByText(`Selected: ${packageNames[0]}`)).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: packageNames[1] }), { detail: 2 });
    await waitFor(() => expect(onSelect).toHaveBeenCalledExactlyOnceWith(packageNames[1]));
  });
});
