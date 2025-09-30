// React
import { memo, useContext, useEffect, useRef, useState } from 'react';

// Backend
import { SystemInformation } from '../../../src/matterbridgeTypes';

// Frontend
import { TruncatedText } from './TruncatedText';
import { WebSocketContext } from './WebSocketProvider';
import { WsMessageApiResponse } from '../../../src/frontendTypes';
import { MbfWindow, MbfWindowHeader, MbfWindowHeaderText, MbfWindowIcons } from './MbfWindow';
import { debug } from '../App';
// const debug = true;

function SystemInfoTable({ systemInfo, compact }: { systemInfo: SystemInformation, compact: boolean }) {
  // WebSocket context
  const { addListener, removeListener, getUniqueId } = useContext(WebSocketContext);

  // Local states
  const [localSystemInfo, setLocalSystemInfo] = useState(systemInfo);

  // Refs
  const uniqueId = useRef(getUniqueId());

  if(debug) console.log('SystemInfoTable loading with systemInfo:', localSystemInfo, 'compact:', compact);

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

  const handleMemoryUpdate = (totalMemory: string, freeMemory: string, heapTotal: string, heapUsed: string, rss: string) => {
    setLocalSystemInfo((prev) => ({
      ...prev,
      totalMemory: totalMemory,
      freeMemory: freeMemory,
      heapTotal: heapTotal,
      heapUsed: heapUsed,
      rss: rss,
    }))
  }

  const handleCpuUpdate = (cpuUsage: number) => {
    setLocalSystemInfo((prev) => ({
      ...prev,
      cpuUsage: cpuUsage.toFixed(2) + ' %',
    }))
  }

  const handleUptimeUpdate = (systemUptime: string, processUptime: string) => {
    setLocalSystemInfo((prev) => ({
      ...prev,
      systemUptime: systemUptime,
      processUptime: processUptime,
    }))
  }

  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessageApiResponse) => {
      if (msg.method === 'memory_update' && msg.response && msg.response.totalMemory && msg.response.freeMemory && msg.response.heapTotal && msg.response.heapUsed && msg.response.rss) {
        if(debug) console.log('SystemInfoTable received memory_update', msg);
        handleMemoryUpdate(msg.response.totalMemory, msg.response.freeMemory, msg.response.heapTotal, msg.response.heapUsed, msg.response.rss);
      } else if (msg.method === 'cpu_update' && msg.response && msg.response.cpuUsage) {
        if(debug) console.log('SystemInfoTable received cpu_update', msg);
        handleCpuUpdate(msg.response.cpuUsage);
      } else if (msg.method === 'uptime_update' && msg.response && msg.response.systemUptime && msg.response.processUptime) {
        if(debug) console.log('SystemInfoTable received uptime_update', msg);
        handleUptimeUpdate(msg.response.systemUptime, msg.response.processUptime);
      }
    };

    addListener(handleWebSocketMessage, uniqueId.current);
    if(debug) console.log(`SystemInfoTable added WebSocket listener id ${uniqueId.current}`);

    return () => {
      removeListener(handleWebSocketMessage);
      if(debug) console.log('SystemInfoTable removed WebSocket listener');
    };
  }, [addListener, removeListener]);

  const [closed, setClosed] = useState(false);

  if (!localSystemInfo || closed) return null;

  if(debug) console.log('SystemInfoTable rendering...');

  return (
    <MbfWindow style={{ flex: '0 1 auto', width: '302px', minWidth: '302px' }}>
      <MbfWindowHeader>
        <MbfWindowHeaderText>System Information</MbfWindowHeaderText>
        <MbfWindowIcons onClose={() => setClosed(true)} />
      </MbfWindowHeader>
      <div className="MbfWindowDivTable">
        <table style={{ border: 'none', borderCollapse: 'collapse' }}>
          <tbody style={{ border: 'none', borderCollapse: 'collapse' }}>
            {Object.entries(localSystemInfo).filter(([_key, value]) => value !== undefined && value !== '').map(([key, value], index) => (
              <tr key={key} className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'} style={{ border: 'none', borderCollapse: 'collapse' }}>
                <td style={{ border: 'none', borderCollapse: 'collapse' }}>{key}</td>
                <td style={{ border: 'none', borderCollapse: 'collapse' }}>
                  <TruncatedText value={typeof value !== 'string' ? value.toString() : value} maxChars={24} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MbfWindow>
  );
}

/**
 * System Information Table
 * Displays system information in a table format.
 * 
 * Props:
 * - systemInfo: SystemInformation object containing system details.
 * - compact: boolean indicating whether to display compact information.
 * 
 * The component listens for WebSocket messages to update memory, CPU, and uptime information in real-time.
 */
export default memo(SystemInfoTable);
