import '@testing-library/jest-dom';

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import MatterbridgeInfoTable from '../src/components/MatterbridgeInfoTable';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { type MatterbridgeInformation } from '../src/utils/backendShared';

const settings = vi.hoisted(() => ({ debug: false, enableMobile: true }));
vi.mock('../src/appState', () => settings);
vi.mock('@mui/material/Tooltip', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../src/components/MbfWindow', () => ({
  MbfWindow: ({ children, style }: { children: React.ReactNode; style: React.CSSProperties }) => (
    <section data-testid="window" style={style}>
      {children}
    </section>
  ),
  MbfWindowHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  MbfWindowHeaderText: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  MbfWindowContent: ({ children, style }: { children: React.ReactNode; style: React.CSSProperties }) => (
    <div data-testid="content" style={style}>
      {children}
    </div>
  ),
  MbfWindowIcons: ({ close }: { close: () => void }) => (
    <button type="button" onClick={close}>
      Close
    </button>
  ),
}));

const visibleFields: [string, string, string | number | boolean][] = [
  ['matterbridgeVersion', 'Matterbridge version', '3.10.12'],
  ['frontendVersion', 'Frontend version', '3.6.3'],
  ['dockerVersion', 'Docker version', '3.10.11'],
  ['homeDirectory', 'Home', '/home/tester'],
  ['rootDirectory', 'Root', '/opt/matterbridge'],
  ['matterbridgeDirectory', 'Storage', '/home/tester/.mb'],
  ['matterbridgeCertDirectory', 'Cert', '/home/tester/.mb/cert'],
  ['matterbridgePluginDirectory', 'Plugins', '/opt/plugins'],
  ['globalModulesDirectory', 'Modules', '/usr/lib/node_modules'],
  ['bridgeMode', 'Bridge mode', 'bridge'],
  ['restartMode', 'Restart mode', 'service'],
  ['virtualMode', 'Virtual mode', 'disabled'],
  ['bridgeStatus', 'Bridge status', 'online'],
  ['profile', 'Profile', 'default'],
  ['loggerLevel', 'Logger level', 'info'],
  ['fileLogger', 'File logger', true],
  ['matterLoggerLevel', 'Matter logger level', 'debug'],
  ['matterFileLogger', 'Matter file logger', false],
  ['restartRequired', 'Restart required', false],
  ['updateRequired', 'Update required', true],
  ['runningTimes', 'Running times', 7],
  ['runningDays', 'Running days', 0],
];

const excludedKeys = [
  'matterbridgeLatestVersion',
  'matterbridgeDevVersion',
  'dockerDev',
  'dockerLatestVersion',
  'dockerDevVersion',
  'fixedRestartRequired',
  'matterMdnsInterface',
  'matterIpv4Address',
  'matterIpv6Address',
  'readOnly',
  'shellyBoard',
  'shellySysUpdate',
  'shellyMainUpdate',
  'matterPort',
  'matterDiscriminator',
  'matterPasscode',
  'startupAt',
  'shutdownAt',
];

type InformationFixture = Record<string, unknown> | null | undefined;

function renderTable(matterbridgeInfo: InformationFixture, mobile = false) {
  const view = (information: InformationFixture) => (
    <UiContext.Provider value={{ mobile } as UiContextType}>
      <MatterbridgeInfoTable matterbridgeInfo={information as unknown as MatterbridgeInformation} />
    </UiContext.Provider>
  );
  const result = render(view(matterbridgeInfo));
  return { ...result, rerenderInfo: (information: InformationFixture) => result.rerender(view(information)) };
}

function valueCell(label: string) {
  const row = screen.getByRole('cell', { name: label }).closest('tr');
  if (!row) throw new Error(`Missing row for ${label}`);
  return within(row).getAllByRole('cell')[1];
}

beforeEach(() => {
  settings.debug = false;
  settings.enableMobile = true;
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MatterbridgeInfoTable', () => {
  test('should render every mapped field with its label and alternating rows', () => {
    const information = Object.freeze(Object.fromEntries(visibleFields.map(([key, _label, value]) => [key, value])));
    renderTable(information);
    expect(screen.getByRole('heading', { name: 'Matterbridge info' })).toBeInTheDocument();
    for (const [_key, label, value] of visibleFields) expect(valueCell(label).textContent).toBe(String(value));
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(visibleFields.length);
    for (const [index, row] of rows.entries()) expect(row).toHaveClass(index % 2 === 0 ? 'table-content-even' : 'table-content-odd');
    expect(information).toEqual(Object.fromEntries(visibleFields.map(([key, _label, value]) => [key, value])));
  });

  test.each(excludedKeys)('should exclude %s even when its value is populated', (key) => {
    renderTable({ [key]: 'hidden-value', matterbridgeVersion: '3.10.12' });
    expect(screen.getAllByRole('row')).toHaveLength(1);
    expect(valueCell('Matterbridge version')).toHaveTextContent('3.10.12');
    expect(screen.queryByText(key)).not.toBeInTheDocument();
    expect(screen.queryByText('hidden-value')).not.toBeInTheDocument();
    expect(screen.getByRole('row')).toHaveClass('table-content-even');
  });

  test('should omit null, undefined, and empty fields while retaining zero and false', () => {
    renderTable({
      profile: null,
      dockerVersion: undefined,
      homeDirectory: '',
      runningDays: 0,
      fileLogger: false,
      rootDirectory: '/opt',
    });
    for (const label of ['Profile', 'Docker version', 'Home']) expect(screen.queryByRole('cell', { name: label })).not.toBeInTheDocument();
    expect(valueCell('Running days')).toHaveTextContent(/^0$/);
    expect(valueCell('File logger')).toHaveTextContent(/^false$/);
    expect(valueCell('Root')).toHaveTextContent('/opt');
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveClass('table-content-even');
    expect(rows[1]).toHaveClass('table-content-odd');
    expect(rows[2]).toHaveClass('table-content-even');
  });

  test('should display unknown keys with their original names', () => {
    renderTable({ futureField: 'future-value' });
    expect(valueCell('futureField')).toHaveTextContent('future-value');
  });

  test.each([
    { mobile: false, enableMobile: true, responsive: false },
    { mobile: true, enableMobile: false, responsive: false },
    { mobile: true, enableMobile: true, responsive: true },
  ])('should format values and layout when mobile=$mobile and enableMobile=$enableMobile', ({ mobile, enableMobile, responsive }) => {
    settings.enableMobile = enableMobile;
    const directory = '/home/tester/matterbridge/a-long-storage-directory';
    renderTable({ homeDirectory: directory, profile: 'short', runningTimes: 123, runningDays: 0, fileLogger: false, matterFileLogger: true }, mobile);
    const cell = valueCell('Home');
    expect(cell.textContent).toBe(responsive ? directory : `${directory.slice(0, 11)} \u2026 ${directory.slice(-10)}`);
    expect(cell.querySelectorAll('span')).toHaveLength(responsive ? 0 : 1);
    expect(valueCell('Profile').textContent).toBe('short');
    expect(valueCell('Running times').textContent).toBe('123');
    expect(valueCell('Running days').textContent).toBe('0');
    expect(valueCell('File logger').textContent).toBe('false');
    expect(valueCell('Matter file logger').textContent).toBe('true');
    expect(screen.getByTestId('window')).toHaveStyle(responsive ? { flex: '1 1 300px' } : { flex: '0 1 auto', width: '302px', minWidth: '302px' });
    expect(screen.getByTestId('content')).toHaveStyle({ flex: '1 1 auto', margin: '0px', padding: '0px', gap: '0px' });
    expect(screen.getByTestId('content').style.overflow).toBe(responsive ? '' : 'auto');
  });

  test.each([null, undefined])('should render nothing when information is %s and display later props', (information) => {
    const { container, rerenderInfo } = renderTable(information);
    expect(container).toBeEmptyDOMElement();
    rerenderInfo({ matterbridgeVersion: '3.10.12' });
    expect(valueCell('Matterbridge version')).toHaveTextContent('3.10.12');
    rerenderInfo(information);
    expect(container).toBeEmptyDOMElement();
  });

  test.each([{}, { profile: '', dockerVersion: undefined, matterPasscode: 20202021 }])('should retain window controls when no fields are visible: %j', (information) => {
    renderTable(information);
    expect(screen.getByRole('heading', { name: 'Matterbridge info' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryAllByRole('row')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled();
  });

  test('should replace displayed values and fields when props change', () => {
    const { rerenderInfo } = renderTable({ matterbridgeVersion: '3.10.11', profile: 'old-profile', restartRequired: false });
    expect(valueCell('Matterbridge version')).toHaveTextContent('3.10.11');
    rerenderInfo({ matterbridgeVersion: '3.10.12', frontendVersion: '3.6.3', restartRequired: true });
    expect(valueCell('Matterbridge version')).toHaveTextContent('3.10.12');
    expect(valueCell('Frontend version')).toHaveTextContent('3.6.3');
    expect(valueCell('Restart required')).toHaveTextContent('true');
    expect(screen.queryByText('old-profile')).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Profile' })).not.toBeInTheDocument();
  });

  test('should stay closed across prop updates and reopen only after remounting', () => {
    const { container, rerenderInfo, unmount } = renderTable({ matterbridgeVersion: '3.10.11' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(container).toBeEmptyDOMElement();
    rerenderInfo({ matterbridgeVersion: '3.10.12' });
    expect(container).toBeEmptyDOMElement();
    unmount();
    renderTable({ matterbridgeVersion: '3.10.12' });
    expect(valueCell('Matterbridge version')).toHaveTextContent('3.10.12');
  });

  test.each([false, true])('should respect debug=%s when rendering', (debug) => {
    settings.debug = debug;
    const information = { matterbridgeVersion: '3.10.12' };
    renderTable(information);
    expect(vi.mocked(console.log).mock.calls).toEqual(debug ? [['MatterbridgeInfoTable:', information], ['MatterbridgeInfoTable rendering...']] : []);
  });
});
