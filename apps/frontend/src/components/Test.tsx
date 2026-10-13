// React
import { useContext, useEffect, useState, useRef, memo } from 'react';

import { debug } from '../appState';
import { type ApiSettings, type WsMessageApiResponse, type ApiDevice, type ApiPlugin } from '../utils/backendShared';
import { Connecting } from './Connecting';
import { MbfPage } from './MbfPage';
import { UiContext } from './UiContext';
import { WebSocketContext } from './WebSocketProvider';

const localDebug = false; // Set to true to enable local debug logging

// v8 ignore next line -- No test here
function Test() {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);
  // Ui context
  const { showSnackbarMessage } = useContext(UiContext);

  // Local states
  const [_settings, setSettings] = useState<ApiSettings | null>(null);
  const [_plugins, setPlugins] = useState<ApiPlugin[]>([]);
  const [_devices, setDevices] = useState<ApiDevice[]>([]);

  // Local refs
  const uniqueId = useRef(getUniqueId());

  useEffect(() => {
    if (debug || localDebug) console.log('Test useEffect WebSocketMessage mounting');
    const handleWebSocketMessage = (msg: WsMessageApiResponse) => {
      if (msg.method === 'restart_required') {
        if (debug || localDebug) console.log('Test received restart_required');
        showSnackbarMessage('Restart required', 0);
      } else if (msg.method === 'refresh_required') {
        if (debug || localDebug) console.log(`Test received refresh_required: changed=${msg.response.changed} and sending api requests`);
        showSnackbarMessage('Refresh required', 0);
        sendMessage({ id: uniqueId.current, method: '/api/settings', sender: 'Test', src: 'Frontend', dst: 'Matterbridge', params: {} });
        sendMessage({ id: uniqueId.current, method: '/api/plugins', sender: 'Test', src: 'Frontend', dst: 'Matterbridge', params: {} });
        sendMessage({ id: uniqueId.current, method: '/api/devices', sender: 'Test', src: 'Frontend', dst: 'Matterbridge', params: { extended: false } });
      } else if (msg.method === '/api/settings' && msg.response) {
        if (debug || localDebug) console.log('Test received /api/settings:', msg.response);
        showSnackbarMessage('Test received /api/settings', 0);
        setSettings(msg.response);
      } else if (msg.method === '/api/plugins' && msg.response) {
        if (debug || localDebug) console.log(`Test received ${msg.response.length} plugins:`, msg.response);
        showSnackbarMessage('Test received /api/plugins', 0);
        setPlugins(msg.response);
      } else if (msg.method === '/api/devices' && msg.response) {
        if (debug || localDebug) console.log(`Test received ${msg.response.length} devices:`, msg.response);
        showSnackbarMessage('Test received /api/devices', 0);
        setDevices(msg.response);
        for (const device of msg.response) {
          if (debug || localDebug) console.log('Test sending /api/clusters for device:', device.plugin, device.deviceName, device.number);
          sendMessage({
            id: uniqueId.current,
            method: '/api/clusters',
            sender: 'Test',
            src: 'Frontend',
            dst: 'Matterbridge',
            params: { plugin: device.plugin, endpoint: device.number || 0 },
          });
        }
      }
    };

    addListener(handleWebSocketMessage, uniqueId.current);
    if (debug || localDebug) console.log('Test useEffect WebSocketMessage mounted');

    return () => {
      if (debug || localDebug) console.log('Test useEffect WebSocketMessage unmounting');
      removeListener(handleWebSocketMessage);
      if (debug || localDebug) console.log('Test useEffect WebSocketMessage unmounted');
    };
  }, [addListener, removeListener, sendMessage, showSnackbarMessage]);

  useEffect(() => {
    if (debug || localDebug) console.log('Test useEffect online mounting');
    if (online) {
      if (debug || localDebug) console.log('Test useEffect online received online');
      sendMessage({ id: uniqueId.current, method: '/api/settings', sender: 'Test', src: 'Frontend', dst: 'Matterbridge', params: {} });
      sendMessage({ id: uniqueId.current, method: '/api/plugins', sender: 'Test', src: 'Frontend', dst: 'Matterbridge', params: {} });
      sendMessage({ id: uniqueId.current, method: '/api/devices', sender: 'Test', src: 'Frontend', dst: 'Matterbridge', params: { extended: false } });
    }
    if (debug || localDebug) console.log('Test useEffect online mounted');

    return () => {
      if (debug || localDebug) console.log('Test useEffect online unmounted');
    };
  }, [online, sendMessage]);

  if (debug || localDebug) console.log('Test rendering...');
  if (!online) {
    return <Connecting />;
  }
  return (
    <MbfPage name="Test">
      <div
        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', alignContent: 'center', gap: '20px', height: '100vh', width: '100vw' }}
      >
        <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '256px', width: '256px', margin: '10px' }} />
        <p>Welcome to the Test page of the Matterbridge frontend</p>
      </div>
    </MbfPage>
  );
}

export default memo(Test);
