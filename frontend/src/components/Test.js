/* eslint-disable no-unused-vars */

// React
import React, { useContext, useEffect, useState } from 'react';

// @mui/material

// @mui/icons-material

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import { debug } from '../App';

function Test() {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener } = useContext(WebSocketContext);

  // Local states
  const [settings, setSettings] = useState({});
  const [plugins, setPlugins] = useState([]);
  const [devices, setDevices] = useState([]);
  const [clusters, setClusters] = useState([]);

  useEffect(() => {
    if(debug) console.log('Test useEffect WebSocketMessage mounting');
    const handleWebSocketMessage = (msg) => {
      if(debug) console.log('Test received WebSocketMessage:', msg.response);
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'refresh_required') {
          if(debug) console.log('Test received refresh_required and sending api requests');
          sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (msg.method === '/api/settings' && msg.response) {
          if(debug) console.log('Test received settings:', msg.response);
          setSettings(msg.response);
        }
        if (msg.method === '/api/plugins' && msg.response) {
          if(debug) console.log('Test received plugins:', msg.response);
          setPlugins(msg.response);
        }
        if (msg.method === '/api/devices' && msg.response) {
          if(debug) console.log(`Test received ${msg.response.length} devices:`, msg.response);
          setDevices(msg.response);
          for(let device of msg.response) {
            if(debug) console.log('Test sending /api/clusters for device:', device.name);
            sendMessage({ method: "/api/clusters", src: "Frontend", dst: "Matterbridge", params: { plugin: device.pluginName, endpoint: device.endpoint } });
          }
        }
        if (msg.method === '/api/clusters') {
          if(debug) console.log(`Test received ${msg.response.length} clusters:`, msg.response);
          setClusters(msg.response);
        }
      }
    };

    addListener(handleWebSocketMessage);
    if(debug) console.log('Test useEffect WebSocketMessage mounted');

    return () => {
      removeListener(handleWebSocketMessage);
      if(debug) console.log('Test useEffect WebSocketMessage unmounted');
    };
  }, [addListener, removeListener, sendMessage]);
  
  useEffect(() => {
    if(debug) console.log('Test useEffect online mounting');
    if(online) {
      if(debug) console.log('Test useEffect online sending api requests');
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
      <p>Welcome to the Test page of Matterbridge frontend</p>
    </div>
  );
}

export default Test;