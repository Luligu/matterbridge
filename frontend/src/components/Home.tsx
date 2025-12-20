// React
import { useEffect, useState, useContext, useRef, memo } from 'react';

// Frontend
import { UiContext } from './UiProvider';
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import SystemInfoTable from './SystemInfoTable';
import QRDiv from './QRDiv';
import HomeInstallAddPlugins from './HomeInstallAddPlugins';
import HomePlugins from './HomePlugins';
import HomeDevices from './HomeDevices';
import { WsMessageApiResponse } from '../../../src/frontendTypes';
import { ApiPlugin, MatterbridgeInformation, SystemInformation } from '../../../src/matterbridgeTypes';
import { MbfPage } from './MbfPage';
import HomeLogs from './HomeLogs';
import HomeBrowserRefresh from './HomeBrowserRefresh';
import HomeShowChangelog from './HomeShowChangelog';
import MatterbridgeInfoTable from './MatterbridgeInfoTable';
import { MbfLsk } from '../utils/localStorage';
import { debug, enableMobile } from '../App';
// const debug = true;

function Home(): React.JSX.Element {
  // States
  const [systemInfo, setSystemInfo] = useState<SystemInformation | null>(null);
  const [matterbridgeInfo, setMatterbridgeInfo] = useState<MatterbridgeInformation | null>(null);
  const [plugins, setPlugins] = useState<ApiPlugin[]>([]);
  const [homePagePlugins] = useState(localStorage.getItem(MbfLsk.homePagePlugins) === 'false' ? false : true); // default true
  const [homePageMode, setHomePageMode] = useState(localStorage.getItem(MbfLsk.homePageMode) ?? 'devices'); // default devices
  const [changelog, setChangelog] = useState('');
  const [showChangelog, setShowChangelog] = useState(false);
  const [browserRefresh, setBrowserRefresh] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  // Contexts
  const { mobile } = useContext(UiContext);
  const { addListener, removeListener, online, sendMessage, getUniqueId } = useContext(WebSocketContext);
  // Refs
  const uniqueId = useRef(getUniqueId());

  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessageApiResponse) => {
      if (debug) console.log('Home received WebSocket Message:', msg);
      // Broadcast messages
      if (msg.method === 'refresh_required' && msg.response.changed === 'settings') {
        if (debug) console.log(`Home received refresh_required: changed=${msg.response.changed} and sending /api/settings request`);
        setStoreId(null);
        setPlugins([]);
        sendMessage({ id: uniqueId.current, sender: 'Home', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });
        sendMessage({ id: uniqueId.current, sender: 'Home', method: '/api/plugins', src: 'Frontend', dst: 'Matterbridge', params: {} });
      }
      // Local messages
      if (msg.method === '/api/settings' && msg.id === uniqueId.current) {
        if (debug) console.log(`Home received settings:`, msg.response);
        setSystemInfo(msg.response.systemInformation);
        setMatterbridgeInfo(msg.response.matterbridgeInformation);
        if (msg.response.matterbridgeInformation.matterbridgeVersion) {
          setChangelog(`https://github.com/Luligu/matterbridge/blob/${msg.response.matterbridgeInformation.matterbridgeVersion.includes('-dev-') ? 'dev' : 'main'}/CHANGELOG.md`);
        }

        if (localStorage.getItem(MbfLsk.frontendVersion) === null && msg.response.matterbridgeInformation.frontendVersion) {
          localStorage.setItem(MbfLsk.frontendVersion, msg.response.matterbridgeInformation.frontendVersion);
        } else if (msg.response.matterbridgeInformation.frontendVersion !== localStorage.getItem(MbfLsk.frontendVersion) && msg.response.matterbridgeInformation.frontendVersion) {
          localStorage.setItem(MbfLsk.frontendVersion, msg.response.matterbridgeInformation.frontendVersion);
          setBrowserRefresh(true);
        }

        if (localStorage.getItem(MbfLsk.matterbridgeVersion) === null) {
          localStorage.setItem(MbfLsk.matterbridgeVersion, msg.response.matterbridgeInformation.matterbridgeVersion);
        } else if (msg.response.matterbridgeInformation.matterbridgeVersion !== localStorage.getItem(MbfLsk.matterbridgeVersion)) {
          localStorage.setItem(MbfLsk.matterbridgeVersion, msg.response.matterbridgeInformation.matterbridgeVersion);
          setShowChangelog(true);
        }

        if (msg.response.matterbridgeInformation.shellyBoard) {
          if (!localStorage.getItem(MbfLsk.homePageMode)) {
            localStorage.setItem(MbfLsk.homePageMode, 'devices');
            setHomePageMode('devices');
          }
        }
      }
      if (msg.method === '/api/plugins' && msg.id === uniqueId.current) {
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
      for (const plugin of plugins) {
        if (plugin.matter?.id) {
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
      sendMessage({ id: uniqueId.current, sender: 'Home', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });
      sendMessage({ id: uniqueId.current, sender: 'Home', method: '/api/plugins', src: 'Frontend', dst: 'Matterbridge', params: {} });
    }
  }, [online, sendMessage]);

  if (debug) console.log('Home rendering...');
  if (!online || !systemInfo || !matterbridgeInfo) {
    return <Connecting />;
  }
  return (
    <MbfPage name='Home' style={enableMobile && mobile ? { alignItems: 'center', gap: '10px' } : { flexDirection: 'row' }}>
      {/* Left column */}
      {((enableMobile && !mobile) || !enableMobile) && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '302px', minWidth: '302px', gap: '20px' }}>
          <QRDiv id={storeId} />
          <SystemInfoTable systemInfo={systemInfo} compact={true} />
        </div>
      )}
      {/* Right column */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', gap: enableMobile && mobile ? '10px' : '20px' }}>
        {/* Refresh page on Frontend updates (flex: '0 0 auto', overflow: 'hidden') */}
        {browserRefresh && <HomeBrowserRefresh />}

        {/* Show changelog page on Matterbridge updates (flex: '0 0 auto', overflow: 'hidden') */}
        {showChangelog && <HomeShowChangelog changelog={changelog} />}

        {/* Left column on mobile */}
        {enableMobile && mobile && (
          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '10px' }}>
            <QRDiv id={storeId} />
            <SystemInfoTable systemInfo={systemInfo} compact={true} />
            <MatterbridgeInfoTable matterbridgeInfo={matterbridgeInfo} />
          </div>
        )}

        {/* Install plugins (flex: '0 0 auto', overflow: 'hidden') */}
        {homePagePlugins && !matterbridgeInfo.readOnly && <HomeInstallAddPlugins />}

        {/* Plugins (flex: '0 0 auto', overflow: 'hidden') */}
        {homePagePlugins && <HomePlugins storeId={storeId} setStoreId={setStoreId} />}

        {/* Devices (flex: '1 1 auto', overflow: 'hidden') */}
        {homePageMode === 'devices' && <HomeDevices storeId={storeId} setStoreId={setStoreId} />}

        {/* Logs (flex: '1 1 auto', overflow: 'hidden') */}
        {homePageMode === 'logs' && <HomeLogs />}
      </div>
    </MbfPage>
  );
}

export default memo(Home);
