// React
import { useEffect, useState, useContext, useRef, memo } from 'react';

// @mui/material
import Button from '@mui/material/Button';

// @mui/icons-material
import Refresh from '@mui/icons-material/Refresh';
import AnnouncementOutlinedIcon from '@mui/icons-material/AnnouncementOutlined';
import CancelIcon from '@mui/icons-material/Cancel';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import SystemInfoTable from './SystemInfoTable';
import QRDiv from './QRDiv';
import HomeInstallAddPlugins  from './HomeInstallAddPlugins';
import HomePlugins from './HomePlugins';
import HomeDevices from './HomeDevices';
import { WsMessageApiResponse } from '../../../src/frontendTypes';
import { BaseRegisteredPlugin, MatterbridgeInformation, SystemInformation } from '../../../src/matterbridgeTypes';
import { MbfPage } from './MbfPage';
import { debug } from '../App';
import HomeLogs from './HomeLogs';
// const debug = true;

function Home(): React.JSX.Element {
  // States
  const [systemInfo, setSystemInfo] = useState<SystemInformation | null>(null);
  const [matterbridgeInfo, setMatterbridgeInfo] = useState<MatterbridgeInformation | null>(null);
  const [plugins, setPlugins] = useState<BaseRegisteredPlugin[]>([]);
  const [homePagePlugins] = useState(localStorage.getItem('homePagePlugins')==='false' ? false : true); // default true
  const [homePageMode, setHomePageMode] = useState(localStorage.getItem('homePageMode')??'devices'); // default devices
  const [changelog, setChangelog] = useState('');
  const [showChangelog, setShowChangelog] = useState(false);
  const [browserRefresh, setBrowserRefresh] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  // Contexts
  const { addListener, removeListener, online, sendMessage, getUniqueId } = useContext(WebSocketContext);
  // Refs
  const uniqueId = useRef(getUniqueId());

  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessageApiResponse) => {
      // Broadcast messages
      if (msg.method === 'refresh_required' && msg.response.changed === 'settings') {
        if (debug) console.log(`Home received refresh_required: changed=${msg.response.changed} and sending /api/settings request`);
        setStoreId(null);
        setPlugins([]);
        sendMessage({ id: uniqueId.current, sender: 'Home', method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
        sendMessage({ id: uniqueId.current, sender: 'Home', method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
      }
      // Local messages
      if (msg.method === '/api/settings' && msg.id === uniqueId.current ) {
        if (debug) console.log(`Home received settings:`, msg.response);
        setSystemInfo(msg.response.systemInformation);
        setMatterbridgeInfo(msg.response.matterbridgeInformation);
        if(msg.response.matterbridgeInformation.matterbridgeVersion) {
          setChangelog(`https://github.com/Luligu/matterbridge/blob/${msg.response.matterbridgeInformation.matterbridgeVersion.includes('-dev-') ? 'dev' : 'main' }/CHANGELOG.md`);
        }

        if(localStorage.getItem('frontendVersion') === null && msg.response.matterbridgeInformation.frontendVersion) {
          localStorage.setItem('frontendVersion', msg.response.matterbridgeInformation.frontendVersion);
        } else if(msg.response.matterbridgeInformation.frontendVersion !== localStorage.getItem('frontendVersion') && msg.response.matterbridgeInformation.frontendVersion) {
          localStorage.setItem('frontendVersion', msg.response.matterbridgeInformation.frontendVersion);
          setBrowserRefresh(true);
        }
        
        if(localStorage.getItem('matterbridgeVersion') === null) {
          localStorage.setItem('matterbridgeVersion', msg.response.matterbridgeInformation.matterbridgeVersion);
        } else if(msg.response.matterbridgeInformation.matterbridgeVersion !== localStorage.getItem('matterbridgeVersion')) {
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
      if (msg.method === '/api/plugins' && msg.id === uniqueId.current ) {
        if (debug) console.log(`Home received plugins:`, msg.response);
        setPlugins(msg.response);
      }
    };

    addListener(handleWebSocketMessage, uniqueId.current);
    if (debug) console.log(`Home added WebSocket listener id ${uniqueId.current}`);

    return () => {
      removeListener(handleWebSocketMessage);
      if (debug) console.log('Home removed WebSocket listener');
    };
  }, [addListener, removeListener, sendMessage]);

  useEffect(() => {
    if (debug) console.log(`Home storeId effect with storeId ${storeId}`);
    if (matterbridgeInfo?.bridgeMode === 'bridge' && !storeId) {
      if (debug) console.log(`Home storeId effect set storeId to Matterbridge`);
      setStoreId('Matterbridge');
    }
    if (matterbridgeInfo?.bridgeMode === 'childbridge' && !storeId && plugins) {
      for(const plugin of plugins) {
        if(plugin.matter?.id) {
          if (debug) console.log(`Home storeId effect set storeId to ${plugin.matter.id}`);
          setStoreId(plugin.matter.id);
          break;
        }
      }
    }
  }, [matterbridgeInfo, plugins, storeId]);

  useEffect(() => {
    if (online) {
      if (debug) console.log('Home online effect, sending /api/settings and /api/plugins requests');
      sendMessage({ id: uniqueId.current, sender: 'Home', method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ id: uniqueId.current, sender: 'Home', method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
    }
  }, [online, sendMessage]);

  if(debug) console.log('Home rendering...');
  if (!online || !systemInfo || !matterbridgeInfo) {
    return (<Connecting />);
  }
  return (
    <MbfPage style={{ flexDirection: 'row' }}>

      {/* Left column */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '302px', minWidth: '302px', gap: '20px' }}>

        <QRDiv id={storeId}/>
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

        {/* Install plugins (flex: '0 0 auto', overflow: 'hidden') */}
        {homePagePlugins && !matterbridgeInfo.readOnly &&
          <HomeInstallAddPlugins/>
        }

        {/* Plugins (flex: '0 0 auto', overflow: 'hidden') */}
        {homePagePlugins &&
          <HomePlugins storeId={storeId} setStoreId={setStoreId}/>
        }

        {/* Devices (flex: '1 1 auto', overflow: 'hidden') */}
        {homePageMode === 'devices' &&
          <HomeDevices storeId={storeId} setStoreId={setStoreId}/>
        }

        {/* Logs (flex: '1 1 auto', overflow: 'hidden') */}
        {homePageMode === 'logs' &&
          <HomeLogs />
        }

      </div>
    </MbfPage>
  );
}

export default memo(Home);
