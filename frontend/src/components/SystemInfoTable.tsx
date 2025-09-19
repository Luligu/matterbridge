 
// React
import { memo, useContext, useEffect, useState } from 'react';

// Backend
import { SystemInformation } from '../../../src/matterbridgeTypes';

// Frontend
import { TruncatedText } from './TruncatedText';
import { WebSocketContext } from './WebSocketProvider';
import { debug } from '../App';
import { isBroadcast, WsMessage } from '../../../src/frontendTypes';
// const debug = true;

// This function takes systemInfo as a parameter and returns a table element with the systemInfo
function SystemInfoTable({ systemInfo, compact }: { systemInfo: SystemInformation, compact: boolean }) {

  // Local states
  const [localSystemInfo, setLocalSystemInfo] = useState(systemInfo);

  // WebSocket context
  const { sendMessage, addListener, removeListener } = useContext(WebSocketContext);

  if(debug) console.log('SystemInfoTable:', localSystemInfo, 'compact:', compact);

  // Compact some fields if compact is true
  if (systemInfo && compact && localSystemInfo.totalMemory && localSystemInfo.freeMemory) {
    const totalMemory = localSystemInfo.totalMemory;
    const freeMemory = localSystemInfo.freeMemory;
    localSystemInfo.freeMemory = `${freeMemory} / ${totalMemory}`;
    localSystemInfo.totalMemory = ''; 
  }
  if (systemInfo && compact && localSystemInfo.heapTotal && localSystemInfo.heapUsed) {
    const heapTotal = localSystemInfo.heapTotal;
    const heapUsed = localSystemInfo.heapUsed;
    localSystemInfo.heapUsed = `${heapUsed} / ${heapTotal}`;
    localSystemInfo.heapTotal = '';
  }
  if (systemInfo && compact && localSystemInfo.osRelease && localSystemInfo.osType) {
    const osType = localSystemInfo.osType;
    const osRelease	= localSystemInfo.osRelease;
    localSystemInfo.osType = `${osType} (${osRelease})`;
    localSystemInfo.osRelease = '';
  }
  if(systemInfo && compact && localSystemInfo.osArch && localSystemInfo.osPlatform) {
    const osPlatform = localSystemInfo.osPlatform;
    const osArch = localSystemInfo.osArch;
    localSystemInfo.osPlatform = `${osPlatform} (${osArch})`;
    localSystemInfo.osArch = '';
  }

  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessage) => {
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (isBroadcast(msg) && msg.method === 'memory_update' && msg.params && msg.params.totalMemory && msg.params.freeMemory && msg.params.heapTotal && msg.params.heapUsed && msg.params.rss) {
          if(debug) console.log('SystemInfoTable received memory_update', msg);
          if(localSystemInfo.totalMemory !== msg.params?.totalMemory || localSystemInfo.freeMemory !== msg.params?.freeMemory ||
            localSystemInfo.heapTotal !== msg.params?.heapTotal || localSystemInfo.heapUsed !== msg.params?.heapUsed ||
            localSystemInfo.rss !== msg.params?.rss) {
            setLocalSystemInfo((prev) => ({
              ...prev,
              totalMemory: msg.params?.totalMemory ? msg.params.totalMemory : '',
              freeMemory: msg.params?.freeMemory ? msg.params.freeMemory : '',
              heapTotal: msg.params?.heapTotal ? msg.params.heapTotal : '',
              heapUsed: msg.params?.heapUsed ? msg.params.heapUsed : '',
              rss: msg.params?.rss ? msg.params.rss : '',
            }))
          }
        }
        if (isBroadcast(msg) && msg.method === 'cpu_update' && msg.params && msg.params.cpuUsage) {
          if(debug) console.log('SystemInfoTable received cpu_update', msg);
          if(localSystemInfo.cpuUsage !== (msg.params?.cpuUsage ? msg.params.cpuUsage.toFixed(2) + ' %' : '')) {
            setLocalSystemInfo((prev) => ({
              ...prev,
              cpuUsage: msg.params?.cpuUsage ? msg.params.cpuUsage.toFixed(2) + ' %' : '',
            }))
          }
        }
        if (isBroadcast(msg) && msg.method === 'uptime_update' && msg.params && msg.params.systemUptime && msg.params.processUptime) {
          if(debug) console.log('SystemInfoTable received uptime_update', msg);
          if(localSystemInfo.systemUptime !== msg.params?.systemUptime || localSystemInfo.processUptime !== msg.params?.processUptime) {
            setLocalSystemInfo((prev) => ({
              ...prev,
              systemUptime: msg.params?.systemUptime ? msg.params.systemUptime : '',
              processUptime: msg.params?.processUptime ? msg.params.processUptime : '',
            }))
          }
        }
      }
    };

    if(debug) console.log('SystemInfoTable useEffect WebSocketMessage mounting');
    addListener(handleWebSocketMessage);
    if(debug) console.log('SystemInfoTable useEffect WebSocketMessage mounted');

    return () => {
      if(debug) console.log('SystemInfoTable useEffect WebSocketMessage unmounting');
      removeListener(handleWebSocketMessage);
      if(debug) console.log('SystemInfoTable useEffect WebSocketMessage unmounted');
    };
  }, [addListener, localSystemInfo.cpuUsage, localSystemInfo.freeMemory, localSystemInfo.heapTotal, localSystemInfo.heapUsed, localSystemInfo.processUptime, localSystemInfo.rss, localSystemInfo.systemUptime, localSystemInfo.totalMemory, removeListener, sendMessage]);

  if (!localSystemInfo) return null;

  if(debug) console.log('SystemInfoTable rendering...');

  return (
    <div className="MbfWindowDiv" style={{ minWidth: '302px', overflow: 'hidden' }}>
      <div className="MbfWindowHeader">
        <p className="MbfWindowHeaderText" style={{ textAlign: 'left' }}>System Information</p>
      </div>
      <div className="MbfWindowDivTable">
        <table style={{ border: 'none', borderCollapse: 'collapse' }}>
          <tbody style={{ border: 'none', borderCollapse: 'collapse' }}>
            {Object.entries(localSystemInfo).filter(([_key, value]) => value !== undefined && value !== '').map(([key, value], index) => (
              <tr key={key} className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'} style={{ border: 'none', borderCollapse: 'collapse' }}>
                <td style={{ border: 'none', borderCollapse: 'collapse' }}>{key}</td>
                <td style={{ border: 'none', borderCollapse: 'collapse' }}>
                  <TruncatedText value={typeof value !== 'string' ? value.toString() : value} maxChars={25} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
  
export default memo(SystemInfoTable);
