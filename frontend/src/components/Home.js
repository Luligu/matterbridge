/* eslint-disable no-console */

// React
import React, { useEffect, useState, useContext, useCallback } from 'react';

// @mui/material

// @mui/icons-material

// Frontend
import { WebSocketLogs } from './WebSocketLogs';
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import { SystemInfoTable } from './SystemInfoTable';
import { MatterbridgeInfoTable } from './MatterbridgeInfoTable';
import { QRDiv } from './QRDiv';
import { InstallAddPlugins } from './InstallAddPlugins';
import { HomePlugins } from './HomePlugins';
 
import { HomeDevices } from './HomeDevices';
import { debug } from '../App';
// const debug = true;

export let pluginName = '';
export let selectDevices = [];
export let selectEntities = [];

function Home() {
  // States
  const [systemInfo, setSystemInfo] = useState(null);
  const [matterbridgeInfo, setMatterbridgeInfo] = useState(null);
  const [_plugins, setPlugins] = useState([]);
  const [selectPlugin, setSelectPlugin] = useState(undefined);
  const [homePagePlugins] = useState(localStorage.getItem('homePagePlugins')==='true' ? true : false);
  const [homePageMode] = useState(localStorage.getItem('homePageMode')??'logs');

  // Contexts
  const { addListener, removeListener, online, sendMessage, logFilterLevel, logFilterSearch, autoScroll } = useContext(WebSocketContext);

  const handleSelectPlugin = useCallback((plugin) => {
    if (debug) console.log('handleSelectPlugin plugin:', plugin.name);
    if (!selectPlugin) {
      setSelectPlugin(plugin);
    } else {
      setSelectPlugin(undefined);
    }
  }, [selectPlugin]);

  useEffect(() => {
    const handleWebSocketMessage = (msg) => {
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'refresh_required') {
          if (debug) console.log('Home received refresh_required');
          sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (msg.method === '/api/settings') {
          if (debug) console.log('Home received settings:', msg.response);
          setSystemInfo(msg.response.systemInformation);
          setMatterbridgeInfo(msg.response.matterbridgeInformation);
        }
        if (msg.method === '/api/plugins') {
          if (debug) console.log('Home received plugins:', msg.response);
          setPlugins(msg.response);
        }
        if (msg.method === '/api/select') {
          if (msg.response) {
            if (debug) console.log('Home received /api/select:', msg.response);
            selectDevices = msg.response;
          }
          if (msg.error) {
            console.error('Home received /api/select error:', msg.error);
          }
        }
        if (msg.method === '/api/select/entities') {
          if (msg.response) {
            if (debug) console.log('Home received /api/select/entities:', msg.response);
            selectEntities = msg.response;
          }
          if (msg.error) {
            console.error('Home received /api/select/entities error:', msg.error);
          }
        }
      }
    };

    addListener(handleWebSocketMessage);
    if (debug) console.log('Home added WebSocket listener');

    return () => {
      removeListener(handleWebSocketMessage);
      if (debug) console.log('Home removed WebSocket listener');
    };
  }, [addListener, removeListener, sendMessage]);

  useEffect(() => {
    if (online) {
      if (debug) console.log('Home received online');
      sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
    }
  }, [online, sendMessage]);

  if(debug) console.log('Home rendering...');
  if (!online) {
    return (<Connecting />);
  }
  return (
    <div className="MbfPageDiv" style={{ flexDirection: 'row' }}>
      {/* Left column */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '302px', minWidth: '302px', gap: '20px' }}>
        {matterbridgeInfo && <QRDiv matterbridgeInfo={matterbridgeInfo} plugin={selectPlugin} />}
        {systemInfo && <SystemInfoTable systemInfo={systemInfo} compact={true} />}
        {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' && <MatterbridgeInfoTable matterbridgeInfo={matterbridgeInfo} />}
      </div>

      {/* Right column */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', gap: '20px' }}>

        {/* Install add plugin */}
        {homePagePlugins && matterbridgeInfo && !matterbridgeInfo.readOnly &&
          <div className="MbfWindowDiv" style={{ flex: '0 0 auto', width: '100%', overflow: 'hidden' }}>
            <div className="MbfWindowHeader">
              <p className="MbfWindowHeaderText">Install add plugin</p>
            </div>
            <InstallAddPlugins/>
          </div>
        }

        {/* Plugins */}
        {homePagePlugins &&
          <HomePlugins selectPlugin={handleSelectPlugin}/>
        }

        {/* Devices (can grow) */}
        {matterbridgeInfo && matterbridgeInfo.shellyBoard &&
          <HomeDevices/>
        }

        {/* Devices (can grow) */}
        {matterbridgeInfo && !matterbridgeInfo.shellyBoard && homePageMode === 'devices' &&
          <HomeDevices/>
        }
        {/* Logs (can grow) */}
        {matterbridgeInfo && !matterbridgeInfo.shellyBoard && homePageMode === 'logs' &&
          <div className="MbfWindowDiv" style={{ flex: '1 1 auto', width: '100%', overflow: 'hidden' }}>
            <div className="MbfWindowHeader" style={{ flexShrink: 0 }}>
              <div className="MbfWindowHeaderText" style={{ display: 'flex', justifyContent: 'space-between' }}>
                Logs
                <span style={{ fontWeight: 'normal', fontSize: '12px', marginTop: '2px' }}>
                  Filter: logger level "{logFilterLevel}" and search "{logFilterSearch}" Scroll: {autoScroll ? 'auto' : 'manual'} 
                </span>
              </div>
            </div>
            <div style={{ flex: '1 1 auto', margin: '0px', padding: '10px', overflow: 'auto' }}>
              <WebSocketLogs />
            </div>
          </div>
        }

      </div>
    </div>
  );
}

export default Home;
