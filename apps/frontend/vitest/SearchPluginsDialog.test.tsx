import '@testing-library/jest-dom';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { SearchPluginsDialog } from '../src/components/SearchPluginsDialog';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { MbfLsk } from '../src/utils/localStorage';

vi.mock('../src/appState', () => ({ debug: false, enableMobile: false }));
vi.mock('@mui/material/Tooltip', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../src/components/MbfTable', () => ({
  default: ({
    rows,
    onRowClick,
    footerRight,
  }: {
    rows: { name: string }[];
    onRowClick: (row: { name: string }, rowKey: string, event: React.MouseEvent<HTMLButtonElement>) => void;
    footerRight: string;
  }) => (
    <div>
      {rows.map((row) => (
        <button key={row.name} type="button" onClick={(event) => onRowClick(row, row.name, event)}>
          {row.name}
        </button>
      ))}
      <span>{footerRight}</span>
    </div>
  ),
}));

const packageNames = ['matterbridge-test-alpha', 'matterbridge-test-beta'];

beforeEach(() => {
  window.localStorage.clear();
  const today = new Date();
  const asOf = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  window.localStorage.setItem(MbfLsk.searchPluginsVersions, JSON.stringify(Object.fromEntries(packageNames.map((name) => [name, { asOf, versions: ['latest', '1.0.0'] }]))));
  window.localStorage.setItem(MbfLsk.searchPluginsTotal, JSON.stringify(Object.fromEntries(packageNames.map((name) => [name, { asOf, total: 10 }]))));
  window.localStorage.setItem(
    MbfLsk.searchPluginsMeta,
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
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

function renderDialog() {
  const onClose = vi.fn();
  const onSelect = vi.fn();
  const onVersions = vi.fn();
  const view = (open: boolean) => (
    <UiContext.Provider value={{ mobile: false } as UiContextType}>
      <SearchPluginsDialog open={open} onClose={onClose} onSelect={onSelect} onVersions={onVersions} />
    </UiContext.Provider>
  );
  const { rerender } = render(view(true));
  return { onClose, onSelect, onVersions, setOpen: (open: boolean) => rerender(view(open)) };
}

describe('SearchPluginsDialog', () => {
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
