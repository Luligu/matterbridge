/* eslint-disable no-console */

// React
import { useEffect, useState, useContext, useCallback, useRef } from 'react';

// @mui/material
import Button from '@mui/material/Button';

// @mui/icons-material
import Refresh from '@mui/icons-material/Refresh';
import AnnouncementOutlinedIcon from '@mui/icons-material/AnnouncementOutlined';
import CancelIcon from '@mui/icons-material/Cancel';

// Frontend
import { WebSocketLogs } from './WebSocketLogs';
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import { SystemInfoTable } from './SystemInfoTable';
import { QRDiv } from './QRDiv';
import { InstallAddPlugins } from './InstallAddPlugins';
import { HomePlugins } from './HomePlugins';
 
import { HomeDevices } from './HomeDevices';
import { debug } from '../App';
// const debug = true;

function Home() {
  // States
  const [systemInfo, setSystemInfo] = useState(null);
  const [matterbridgeInfo, setMatterbridgeInfo] = useState(null);
  const [selectPlugin, setSelectPlugin] = useState(undefined);
  const [homePagePlugins] = useState(localStorage.getItem('homePagePlugins')==='false' ? false : true); // default true
  const [homePageMode, setHomePageMode] = useState(localStorage.getItem('homePageMode')??'devices'); // default devices
  const [changelog, setChangelog] = useState('');
  const [showChangelog, setShowChangelog] = useState(false);
  const [browserRefresh, setBrowserRefresh] = useState(false);
  // Contexts
  const { addListener, removeListener, online, sendMessage, logFilterLevel, logFilterSearch, autoScroll, getUniqueId } = useContext(WebSocketContext);
  // Refs
  const uniqueId = useRef(getUniqueId());

  const handleSelectPlugin = useCallback((plugin) => {
    if (debug) console.log('handleSelectPlugin plugin:', plugin.name);
    if (!selectPlugin) {
      setSelectPlugin(plugin);
    } else {
      if(selectPlugin.name === plugin.name) setSelectPlugin(undefined);
      else setSelectPlugin(plugin);
    }
  }, [selectPlugin]);

  useEffect(() => {
    const handleWebSocketMessage = (msg) => {
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        // Broadcast messages
        if (msg.method === 'refresh_required' && msg.params.changed !== 'matterbridgeLatestVersion' && msg.params.changed !== 'reachability') {
          if (debug) console.log(`Home received refresh_required: changed=${msg.params.changed}`);
          sendMessage({ id: uniqueId.current, sender: 'Home', method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        // Local messages
        if (msg.id === uniqueId.current && msg.method === '/api/settings') {
          if (debug) console.log('Home received settings:', msg.response);
          setSystemInfo(msg.response.systemInformation);
          setMatterbridgeInfo(msg.response.matterbridgeInformation);
          setSelectPlugin(undefined);
          if(msg.response.matterbridgeInformation.matterbridgeVersion) {
            setChangelog(`https://github.com/Luligu/matterbridge/blob/${msg.response.matterbridgeInformation.matterbridgeVersion.includes('-dev-') ? 'dev' : 'main' }/CHANGELOG.md`);
          }

          if(localStorage.getItem('frontendVersion') === null) {
            localStorage.setItem('frontendVersion', msg.response.matterbridgeInformation.frontendVersion);
          }
          else if(msg.response.matterbridgeInformation.frontendVersion !== localStorage.getItem('frontendVersion')) {
            localStorage.setItem('frontendVersion', msg.response.matterbridgeInformation.frontendVersion);
            setBrowserRefresh(true);
          }
          
          if(localStorage.getItem('matterbridgeVersion') === null) {
            localStorage.setItem('matterbridgeVersion', msg.response.matterbridgeInformation.matterbridgeVersion);
          }
          else if(msg.response.matterbridgeInformation.matterbridgeVersion !== localStorage.getItem('matterbridgeVersion')) {
            localStorage.setItem('matterbridgeVersion', msg.response.matterbridgeInformation.matterbridgeVersion);
            setShowChangelog(true);
          }
          
          if(msg.response.matterbridgeInformation.shellyBoard) {
            if(!localStorage.getItem('homePageMode')) {
              localStorage.setItem('homePageMode', 'devices');
              setHomePageMode('devices');
            }
          }
        }
      }
    };

    addListener(handleWebSocketMessage);
    if (debug) console.log(`Home added WebSocket listener id ${uniqueId.current}`);

    return () => {
      removeListener(handleWebSocketMessage);
      if (debug) console.log('Home removed WebSocket listener');
    };
  }, [addListener, removeListener, sendMessage]);

  useEffect(() => {
    if (online) {
      if (debug) console.log('Home received online');
      sendMessage({ id: uniqueId.current, sender: 'Home', method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
    }
  }, [online, sendMessage]);

  if(debug) console.log('Home rendering...');
  if (!online || !systemInfo || !matterbridgeInfo) {
    return (<Connecting />);
  }
  return (
    <div className="MbfPageDiv" style={{ flexDirection: 'row' }}>
      {/* Left column */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '302px', minWidth: '302px', gap: '20px' }}>
        <QRDiv matterbridgeInfo={matterbridgeInfo} plugin={selectPlugin}/>
        <SystemInfoTable systemInfo={systemInfo} compact={true}/>
        {/* matterbridgeInfo.bridgeMode === 'childbridge' && <MatterbridgeInfoTable matterbridgeInfo={matterbridgeInfo}/> */}
      </div>

      {/* Right column */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', gap: '20px' }}>

        {/* Refresh page on frontend updates */}
        {browserRefresh &&
          <div className="MbfWindowDiv" style={{ flex: '0 0 auto', width: '100%', overflow: 'hidden' }}>
            <div className="MbfWindowHeader">
              <p className="MbfWindowHeaderText">Frontend Update</p>
            </div>
            <div className="MbfWindowBody" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0 }}>The frontend has been updated. You are viewing an outdated web UI. Please refresh the page now.</h4>
              <div>
                <Button onClick={() => window.location.reload()} endIcon={<Refresh />} style={{ marginLeft: '10px', color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px' }}>Refresh</Button>
              </div>
            </div>
          </div>
        }
        {/* Show changelog page on Matterbridge updates */}
        {showChangelog &&
          <div className="MbfWindowDiv" style={{ flex: '0 0 auto', width: '100%', overflow: 'hidden' }}>
            <div className="MbfWindowHeader">
              <p className="MbfWindowHeaderText">Matterbridge Update</p>
            </div>
            <div className="MbfWindowBody" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0 }}>Matterbridge has been updated.</h4>
              <div>
                <Button onClick={() => window.open(changelog, '_blank')} endIcon={<AnnouncementOutlinedIcon />} style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px' }}>Changelog</Button>
                <Button onClick={() => window.location.reload()} endIcon={<CancelIcon />} style={{ marginLeft: '10px', color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px' }}>Close</Button>
            </div>
            </div>
          </div>
        }

        {/* Install plugins */}
        {homePagePlugins && !matterbridgeInfo.readOnly &&
          <div className="MbfWindowDiv" style={{ flex: '0 0 auto', width: '100%', overflow: 'hidden' }}>
            <div className="MbfWindowHeader">
              <p className="MbfWindowHeaderText">Install plugins</p>
            </div>
            <InstallAddPlugins/>
          </div>
        }

        {/* Plugins */}
        {homePagePlugins &&
          <HomePlugins selectPlugin={handleSelectPlugin}/>
        }

        {/* Devices (can grow) */}
        {homePageMode === 'devices' &&
          <HomeDevices/>
        }
        {/* Logs (can grow) */}
        {homePageMode === 'logs' &&
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
