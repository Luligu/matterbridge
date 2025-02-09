/* eslint-disable no-unused-vars */

// React
import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';

// @mui/material

// @mui/icons-material

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
// import { debug } from '../App';
const debug = true;
let uniqueId = 0;

function Test() {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);

  // Local states
  const [settings, setSettings] = useState({});
  const [plugins, setPlugins] = useState([]);
  const [devices, setDevices] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [cpu, setCpu] = useState({});
  const [memory, setMemory] = useState({});
  
  if(uniqueId === 0) uniqueId = getUniqueId();
  console.log('Test uniqueId:', uniqueId);

  useEffect(() => {
    if(debug) console.log('Test useEffect WebSocketMessage mounting');
    const handleWebSocketMessage = (msg) => {
      /* Test page WebSocketMessage listener */
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'restart_required') {
          if(debug) console.log('Test received restart_required');
        }
        if (msg.method === 'refresh_required') {
          if(debug) console.log('Test received refresh_required');
          sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (msg.method === 'memory_update') {
          if(debug) console.log('Test received memory_update', msg);
          setMemory(msg.params);
        }
        if (msg.method === 'cpu_update') {
          if(debug) console.log('Test received cpu_update', msg);
          setCpu(msg.params);
        }
        if (msg.method === '/api/settings' && msg.response) {
          if(debug) console.log('Test received settings:', msg.response);
          setSettings(msg.response);
        }
        if (msg.method === '/api/plugins' && msg.response) {
          if(debug) console.log(`Test received ${msg.response.length} plugins:`, msg.response);
          setPlugins(msg.response);
        }
        if (msg.method === '/api/devices' && msg.response) {
          if(debug) console.log(`Test received ${msg.response.length} devices:`, msg.response);
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
  }, [addListener, removeListener, sendMessage]);
  
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
    <div className="MbfPageDiv" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <img src="matterbridge 64x64.png" alt="Matterbridge Logo" style={{ height: '64px', width: '64px' }} />
      <p>Welcome to the Test page of the Matterbridge frontend</p>
      <p>- - -</p>
      <p>cpuUsed: {cpu.cpuUsed} systemUptime: {memory.systemUptime} freeMemory {memory.freeMemory} totalMemory {memory.totalMemory} rss {memory.rss} heapUsed {memory.heapUsed} heapTotal {memory.heapTotal}</p>
    </div>
  );
}

export default Test;