/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
// React
import React, { useContext, useEffect, useState, useRef } from 'react';

// @mui/material

// @mui/icons-material

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { UiContext } from './UiProvider';
import { Connecting } from './Connecting';
import { SystemInfoTable } from './SystemInfoTable';
// import { debug } from '../App';
const debug = true;

function Test() {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);
  // Ui context
  const { showSnackbarMessage } = useContext(UiContext);

  // Local states
  const [settings, setSettings] = useState(null);
  const [plugins, setPlugins] = useState([]);
  const [devices, setDevices] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [cpu, setCpu] = useState(null);
  const [memory, setMemory] = useState(null);
  const [uptime, setUptime] = useState(null);
  const uniqueId = useRef(null);

  if(!uniqueId.current) {
    uniqueId.current = getUniqueId();
    console.log('Test uniqueId:', uniqueId);
  }

  useEffect(() => {
    if(debug) console.log('Test useEffect WebSocketMessage mounting');
    const handleWebSocketMessage = (msg) => {
      /* Test page WebSocketMessage listener */
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'restart_required') {
          if(debug) console.log('Test received restart_required');
          showSnackbarMessage('Restart required', 0);
        }
        if (msg.method === 'refresh_required') {
          if(debug) console.log('Test received refresh_required');
          showSnackbarMessage('Refresh required', 0);
          sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (msg.method === 'memory_update') {
          if(debug) console.log('Test received memory_update', msg);
          showSnackbarMessage('Test received memory_update');
          setMemory(msg.params);
        }
        if (msg.method === 'cpu_update') {
          if(debug) console.log('Test received cpu_update', msg);
          showSnackbarMessage('Test received cpu_update');
          setCpu(msg.params);
        }
        if (msg.method === 'uptime_update') {
          if(debug) console.log('Test received uptime_update', msg);
          showSnackbarMessage('Test received uptime_update');
          setUptime(msg.params);
        }
        if (msg.method === '/api/settings' && msg.response) {
          if(debug) console.log('Test received /api/settings:', msg.response);
          showSnackbarMessage('Test received /api/settings');
          setSettings(msg.response);
        }
        if (msg.method === '/api/plugins' && msg.response) {
          if(debug) console.log(`Test received ${msg.response.length} plugins:`, msg.response);
          showSnackbarMessage('Test received /api/plugins');
          setPlugins(msg.response);
        }
        if (msg.method === '/api/devices' && msg.response) {
          if(debug) console.log(`Test received ${msg.response.length} devices:`, msg.response);
          showSnackbarMessage('Test received /api/devices');
          setDevices(msg.response);
          for(let device of msg.response) {
            if(debug) console.log('Test sending /api/clusters for device:', device.pluginName, device.name, device.endpoint);
            sendMessage({ method: "/api/clusters", src: "Frontend", dst: "Matterbridge", params: { plugin: device.pluginName, endpoint: device.endpoint } });
          }
        }
        if (msg.method === '/api/clusters') {
          if(debug) console.log(`Test received ${msg.response.length} clusters for device ${msg.deviceName} endpoint ${msg.endpoint}:`, msg);
          setClusters(msg.response);
        }
      } else {
        if(debug) console.log('Test received WebSocketMessage:', msg.method, msg.src, msg.dst, msg.response);
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
      sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
    }
    if(debug) console.log('Test useEffect online mounted');

    return () => {
      if(debug) console.log('Test useEffect online unmounted');
    };
  }, [online, sendMessage]);
  
  if(debug) console.log('Test rendering...');
  if (!online) {
    return ( <Connecting /> );
  }
  return (
    <div className="MbfPageDiv" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>

      {/* <div style={{ display: 'flex', gap: '20px', width: '100%' }}>
        {settings && settings.systemInformation && <SystemInfoTable systemInfo={settings.systemInformation} compact={false}/>}
      </div> */}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
        <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '64px', width: '64px' }} />
        <p>Welcome to the Test page of the Matterbridge frontend</p>
        {cpu && memory &&
          <div>
            <p>cpuUsage: {cpu.cpuUsage.toFixed(2) + ' %'}</p>
            <p>systemUptime: {uptime.systemUptime}</p>
            <p>processUptime: {uptime.processUptime}</p>
            <p>freeMemory {memory.freeMemory}</p>
            <p>totalMemory {memory.totalMemory}</p>
            <p>rss {memory.rss}</p>
            <p>heapUsed {memory.heapUsed}</p>
            <p>heapTotal {memory.heapTotal}</p>
          </div>
        }
      </div>  

    </div>
  );
}

export default Test;