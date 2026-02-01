// React
import { useContext, useEffect, useState, useRef, memo } from 'react';

// @mui/material

// @mui/icons-material

// @rjsf

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { UiContext } from './UiProvider';
import { Connecting } from './Connecting';
import { ApiSettings, WsMessageApiResponse } from '../../../src/frontendTypes';
import { ApiClusters, ApiDevice, ApiPlugin } from '../../../src/matterbridgeTypes';
import { debug } from '../App';
import { MbfPage } from './MbfPage';
// const debug = true;

function Test() {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);
  // Ui context
  const { showSnackbarMessage } = useContext(UiContext);

  // Local states
  const [_settings, setSettings] = useState<ApiSettings | null>(null);
  const [_plugins, setPlugins] = useState<ApiPlugin[]>([]);
  const [_devices, setDevices] = useState<ApiDevice[]>([]);
  const [_clusters, setClusters] = useState<ApiClusters | null>(null);
  const [_cpu, setCpu] = useState<{ cpuUsage: number }>({ cpuUsage: 0 });
  const [_memory, setMemory] = useState<{ totalMemory: string; freeMemory: string; heapTotal: string; heapUsed: string; external: string; arrayBuffers: string; rss: string }>({
    totalMemory: '',
    freeMemory: '',
    heapTotal: '',
    heapUsed: '',
    external: '',
    arrayBuffers: '',
    rss: '',
  });
  const [_uptime, setUptime] = useState<{ systemUptime: string; processUptime: string }>({ systemUptime: '', processUptime: '' });
  const uniqueId = useRef(getUniqueId());

  if (debug) console.log('Test uniqueId:', uniqueId);

  useEffect(() => {
    if (debug) console.log('Test useEffect WebSocketMessage mounting');
    const handleWebSocketMessage = (msg: WsMessageApiResponse) => {
      if (msg.method === 'restart_required') {
        if (debug) console.log('Test received restart_required');
        showSnackbarMessage('Restart required', 0);
      } else if (msg.method === 'refresh_required') {
        if (debug) console.log(`Test received refresh_required: changed=${msg.response.changed} and sending api requests`);
        showSnackbarMessage('Refresh required', 0);
        sendMessage({ id: uniqueId.current, method: '/api/settings', sender: 'Test', src: 'Frontend', dst: 'Matterbridge', params: {} });
        sendMessage({ id: uniqueId.current, method: '/api/plugins', sender: 'Test', src: 'Frontend', dst: 'Matterbridge', params: {} });
        sendMessage({ id: uniqueId.current, method: '/api/devices', sender: 'Test', src: 'Frontend', dst: 'Matterbridge', params: {} });
      } else if (msg.method === 'memory_update') {
        if (debug) console.log('Test received memory_update', msg);
        // showSnackbarMessage('Test received memory_update');
        setMemory(msg.response);
      } else if (msg.method === 'cpu_update') {
        if (debug) console.log('Test received cpu_update', msg);
        // showSnackbarMessage('Test received cpu_update');
        setCpu(msg.response);
      } else if (msg.method === 'uptime_update') {
        if (debug) console.log('Test received uptime_update', msg);
        // showSnackbarMessage('Test received uptime_update');
        setUptime(msg.response);
      } else if (msg.method === '/api/settings' && msg.response) {
        if (debug) console.log('Test received /api/settings:', msg.response);
        showSnackbarMessage('Test received /api/settings', 0);
        setSettings(msg.response);
      } else if (msg.method === '/api/plugins' && msg.response) {
        if (debug) console.log(`Test received ${msg.response.length} plugins:`, msg.response);
        showSnackbarMessage('Test received /api/plugins', 0);
        setPlugins(msg.response);
      } else if (msg.method === '/api/devices' && msg.response) {
        if (debug) console.log(`Test received ${msg.response.length} devices:`, msg.response);
        showSnackbarMessage('Test received /api/devices', 0);
        setDevices(msg.response);
        for (const device of msg.response) {
          if (debug) console.log('Test sending /api/clusters for device:', device.pluginName, device.name, device.endpoint);
          sendMessage({ id: uniqueId.current, method: '/api/clusters', sender: 'Test', src: 'Frontend', dst: 'Matterbridge', params: { plugin: device.pluginName, endpoint: device.endpoint || 0 } });
        }
      } else if (msg.method === '/api/clusters' && msg.response) {
        if (debug) console.log(`Test received ${msg.response.clusters.length} clusters for device ${msg.response.deviceName} endpoint ${msg.response.id}:${msg.response.number}:`, msg);
        showSnackbarMessage(`Test received /api/clusters for ${msg.response.plugin}::${msg.response.deviceName}`, 0);
        setClusters(msg.response);
      }
    };

    addListener(handleWebSocketMessage, uniqueId.current);
    if (debug) console.log('Test useEffect WebSocketMessage mounted');

    return () => {
      if (debug) console.log('Test useEffect WebSocketMessage unmounting');
      removeListener(handleWebSocketMessage);
      if (debug) console.log('Test useEffect WebSocketMessage unmounted');
    };
  }, [addListener, removeListener, sendMessage, showSnackbarMessage]);

  useEffect(() => {
    if (debug) console.log('Test useEffect online mounting');
    if (online) {
      if (debug) console.log('Test useEffect online received online');
      /*
      sendMessage({ id: uniqueId.current, method: "/api/settings", sender: 'Test', src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ id: uniqueId.current, method: "/api/plugins", sender: 'Test', src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ id: uniqueId.current, method: "/api/devices", sender: 'Test', src: "Frontend", dst: "Matterbridge", params: {} });
      */
    }
    if (debug) console.log('Test useEffect online mounted');

    return () => {
      if (debug) console.log('Test useEffect online unmounted');
    };
  }, [online, sendMessage, showSnackbarMessage]);

  if (debug) console.log('Test rendering...');
  if (!online) {
    return <Connecting />;
  }
  return (
    <MbfPage name='Test'>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', alignContent: 'center', gap: '20px', height: '100vh', width: '100vw' }}>
        <img src='matterbridge.svg' alt='Matterbridge Logo' style={{ height: '256px', width: '256px', margin: '10px' }} />
        <p>Welcome to the Test page of the Matterbridge frontend</p>
      </div>
    </MbfPage>
  );
}

export default memo(Test);
