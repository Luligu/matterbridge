 

// React
import { useContext, useEffect, useState, useRef, useCallback, memo } from 'react';

// @mui/material
import { Button } from '@mui/material';

// @mui/icons-material

// @rjsf

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { UiContext } from './UiProvider';
import { Connecting } from './Connecting';
import MbfTable from './MbfTable';
import { isApiResponse, isBroadcast, WsMessage } from '../../../src/frontendTypes';
import { ApiClustersResponse, ApiDevices, BaseRegisteredPlugin, MatterbridgeInformation, SystemInformation } from '../../../src/matterbridgeTypes';
// import { debug } from '../App';
const debug = true;

function Test() {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);
  // Ui context
  const { showSnackbarMessage, closeSnackbarMessage } = useContext(UiContext);

  // Local states
  const [_settings, setSettings] = useState<{ matterbridgeInformation: MatterbridgeInformation; systemInformation: SystemInformation; } | null>(null);
  const [_plugins, setPlugins] = useState<BaseRegisteredPlugin[] | null>(null);
  const [_devices, setDevices] = useState<ApiDevices[] | null>(null);
  const [_clusters, setClusters] = useState<ApiClustersResponse | null>(null);
  const [_cpu, setCpu] = useState<{ cpuUsage: number; }>({ cpuUsage: 0 });
  const [_memory, setMemory] = useState<{ totalMemory: string; freeMemory: string; heapTotal: string; heapUsed: string; external: string; arrayBuffers: string; rss: string; }>({ totalMemory: '', freeMemory: '', heapTotal: '', heapUsed: '', external: '', arrayBuffers: '', rss: '' });
  const [_uptime, setUptime] = useState<{ systemUptime: string; processUptime: string; }>({ systemUptime: '', processUptime: '' });
  const uniqueId = useRef<number>(-1);
  const [tableRows, setTableRows] = useState(() => demoRows);

  if(!uniqueId.current) {
    uniqueId.current = getUniqueId();
    if(debug) console.log('Test uniqueId:', uniqueId);
  }

  useEffect(() => {
    if(debug) console.log('Test useEffect WebSocketMessage mounting');
    const handleWebSocketMessage = (msg: WsMessage) => {
      /* Test page WebSocketMessage listener */
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        // Broadcast messages
        if (isBroadcast(msg) && msg.method === 'restart_required') {
          if(debug) console.log('Test received restart_required');
          showSnackbarMessage('Restart required', 0);
        }
        if (isBroadcast(msg) && msg.method === 'refresh_required') {
          if(debug) console.log(`Test received refresh_required: changed=${msg.params.changed} and sending api requests`);
          showSnackbarMessage('Refresh required', 0);
          sendMessage({ id: uniqueId.current, method: "/api/settings", sender: 'Test', src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ id: uniqueId.current, method: "/api/plugins", sender: 'Test', src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ id: uniqueId.current, method: "/api/devices", sender: 'Test', src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (isBroadcast(msg) && msg.method === 'memory_update') {
          if(debug) console.log('Test received memory_update', msg);
          // showSnackbarMessage('Test received memory_update');
          setMemory(msg.params);
        }
        if (isBroadcast(msg) && msg.method === 'cpu_update') {
          if(debug) console.log('Test received cpu_update', msg);
          // showSnackbarMessage('Test received cpu_update');
          setCpu(msg.params);
        }
        if (isBroadcast(msg) && msg.method === 'uptime_update') {
          if(debug) console.log('Test received uptime_update', msg);
          // showSnackbarMessage('Test received uptime_update');
          setUptime(msg.params);
        }
        if (isApiResponse(msg) && msg.method === '/api/settings' && msg.response) {
          if(debug) console.log('Test received /api/settings:', msg.response);
          showSnackbarMessage('Test received /api/settings');
          setSettings(msg.response);
        }
        if (isApiResponse(msg) && msg.method === '/api/plugins' && msg.response) {
          if(debug) console.log(`Test received ${msg.response.length} plugins:`, msg.response);
          showSnackbarMessage('Test received /api/plugins');
          setPlugins(msg.response);
        }
        if (isApiResponse(msg) && msg.method === '/api/devices' && msg.response) {
          if(debug) console.log(`Test received ${msg.response.length} devices:`, msg.response);
          showSnackbarMessage('Test received /api/devices');
          setDevices(msg.response);
          for(const device of msg.response) {
            if(debug) console.log('Test sending /api/clusters for device:', device.pluginName, device.name, device.endpoint);
            sendMessage({ id: uniqueId.current, method: "/api/clusters", sender: 'Test', src: "Frontend", dst: "Matterbridge", params: { plugin: device.pluginName, endpoint: device.endpoint } });
          }
        }
        if (isApiResponse(msg) && msg.method === '/api/clusters' && msg.response) {
          if(debug) console.log(`Test received ${msg.response.clusters.length} clusters for device ${msg.response.deviceName} endpoint ${msg.response.endpoint}:`, msg);
          showSnackbarMessage('Test received /api/clusters');
          setClusters(msg.response);
        }
      }
    };

    addListener(handleWebSocketMessage);
    if(debug) console.log('Test useEffect WebSocketMessage mounted');

    return () => {
      if(debug) console.log('Test useEffect WebSocketMessage unmounting');
      removeListener(handleWebSocketMessage);
      if(debug) console.log('Test useEffect WebSocketMessage unmounted');
    };
  }, [addListener, removeListener, sendMessage, showSnackbarMessage]);
  
  useEffect(() => {
    if(debug) console.log('Test useEffect online mounting');
    if(online) {
      if(debug) console.log('Test useEffect online received online');
      sendMessage({ id: uniqueId.current, method: "/api/settings", sender: 'Test', src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ id: uniqueId.current, method: "/api/plugins", sender: 'Test', src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ id: uniqueId.current, method: "/api/devices", sender: 'Test', src: "Frontend", dst: "Matterbridge", params: {} });
      /*
      showSnackbarMessage('Test permanent message removal', 0);
      showSnackbarMessage('Test useEffect online received online (info)', 30, 'info');
      showSnackbarMessage('Test useEffect online received online (warning)', 30, 'warning');
      showSnackbarMessage('Test useEffect online received online (error)', 30, 'error');
      showSnackbarMessage('Test useEffect online received online (success)', 30, 'success');
      */
    }
    if(debug) console.log('Test useEffect online mounted');

    return () => {
      if(debug) console.log('Test useEffect online unmounted');
    };
  }, [online, sendMessage, showSnackbarMessage]);

  const getRowKey = useCallback((row: Record<string, unknown>) => String(row.code), []);

  if(debug) console.log('Test rendering...');
  if (!online) {
    return ( <Connecting /> );
  }
  return (
    <div className="MbfPageDiv" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>

        <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '256px', width: '256px', margin: '10px' }}/>
        <p>Welcome to the Test page of the Matterbridge frontend</p>
        <div style={{ margin: '0', padding: '0', gap: '0', width: '1200px', maxWidth: '1200px', height: '600px', maxHeight: '600px', overflow: 'hidden', backgroundColor: 'var(--div-bg-color)', border: '1px solid #0004ffff' }}>
          <MbfTable name="Test" columns={demoColumns} rows={tableRows} getRowKey={getRowKey} footerLeft="Left Footer" footerRight="Right Footer" />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
        <Button variant="contained" color="primary" onClick={() => {
          if(debug) console.log('Test button clicked');
          showSnackbarMessage('Test button clicked');
          closeSnackbarMessage('Refresh required');
          closeSnackbarMessage('Restart required');
          closeSnackbarMessage('Test permanent message removal');
        }}>Test</Button>
        <Button variant="outlined" onClick={() => {
          // Update a specific row (code: F123) to demonstrate selective re-render by key
          setTableRows((prev) => {
            // Find the index of the row with code 'F123'
            const idx = prev.findIndex(r => r.code === 'F123');
            if (idx === -1) return prev;
            // Update the population of that found row
            const target = prev[idx];
            const updated = { ...target, population: (target.population || 0) + 1 };
            const next = prev.slice();
            next[idx] = updated;
            return next;
          });
        }}>Update F123</Button>
        </div>

      </div>  
    </div>
  );
}

export default memo(Test);

import type { MbfTableColumn } from './MbfTable';

const demoColumns: MbfTableColumn<Record<string, unknown>>[] = [
  { id: 'name', label: 'Name', minWidth: 50, maxWidth: 100, required: true },
  { id: 'code', label: 'ISO\u00a0Code', minWidth: 100, render: (value: unknown, _rowKey: string | number, _row: Record<string, unknown>, _column: MbfTableColumn<Record<string, unknown>>) => (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        borderRadius: '8px',
        backgroundColor: 'var(--chip-bg, #e6f4ff)',
        color: 'var(--chip-fg, #0550ae)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: '0.85em',
      }}
    >
      {String(value)}
    </span>
  ) },
  { id: 'isIsland', label: 'Island', minWidth: 80, align: "center" },
  {
    id: 'population',
    label: 'Population',
    minWidth: 170,
    align: "right",
    format: (value: number) => value.toLocaleString('en-US'),
  },
  {
    id: 'size',
    label: 'Size\u00a0(km\u00b2)',
    minWidth: 170,
    align: "right",
    format: (value: number) => value.toLocaleString('en-US'),
  },
  {
    id: 'density',
    label: 'Density',
    minWidth: 170,
    align: "right",
    nosort: true,
    format: (value: number) => value.toFixed(2),
  },
  {
    id: 'virtual',
    label: 'Virtual',
    align: "right",
    required: true,
    nosort: true,
    render: (_value: unknown, _rowKey: string | number, row: Record<string, unknown>, _column: MbfTableColumn<Record<string, unknown>>) => { return row.isIsland ? '🏝️' : '🏞️';},
  },
];

function createData(name: string, code: string, population: number, size: number, isIsland: boolean) {
  const density = population / size;
  return { name, code, population, size, density, isIsland };
}

const demoRows = [
  createData('India', 'IN', 1324171354, 3287263, false),
  createData('China', 'CN', 1403500365, 9596961, false),
  createData('Italy', 'IT', 60483973, 301340, false),
  createData('United States', 'US', 327167434, 9833520, false),
  createData('Canada is a truly wonderful country', 'CA', 37602103, 9984670, false),
  createData('Australia', 'AU', 25475400, 7692024, true),
  createData('Germany', 'DE', 83019200, 357578, false),
  createData('Ireland', 'IE', 4857000, 70273, true),
  createData('Mexico', 'MX', 126577691, 1972550, false),
  createData('Japan', 'JP', 126317000, 377973, true),
  createData('France', 'FR', 67022000, 640679, false),
  createData('United Kingdom', 'GB', 67545757, 242495, true),
  createData('Russia', 'RU', 146793744, 17098246, false),
  createData('Nigeria', 'NG', 200962417, 923768, false),
  createData('Brazil', 'BR', 210147125, 8515767, false),
];

const fantasyPrefixes = ['Zor', 'Eld', 'Myth', 'Drak', 'Lum', 'Xen', 'Thal', 'Quor', 'Vex', 'Nyx'];
const fantasySuffixes = ['aria', 'dor', 'mere', 'land', 'wyn', 'gard', 'heim', 'quess', 'tor', 'vale'];

for (let i = 0; i < 2000; i++) {
  const name = `${fantasyPrefixes[i % fantasyPrefixes.length]}${fantasySuffixes[i % fantasySuffixes.length]} ${i}`;
  const code = `F${i.toString().padStart(3, '0')}`;
  const population = Math.floor(Math.random() * 1_000_000_000);
  const size = Math.floor(Math.random() * 10_000_000);
  const isSelected = Math.random() < 0.2;

  demoRows.push(createData(name, code, population, size, isSelected));
}

