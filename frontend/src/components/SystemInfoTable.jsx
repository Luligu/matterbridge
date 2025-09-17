 
// React
import { useContext, useEffect, useState } from 'react';

// Frontend
import { TruncatedText } from './TruncatedText';
import { WebSocketContext } from './WebSocketProvider';
import { debug } from '../App';
// const debug = true;

// This function takes systemInfo as a parameter and returns a table element with the systemInfo
export function SystemInfoTable({ systemInfo, compact }) {

  // Local states
  const [localSystemInfo, setLocalSystemInfo] = useState(systemInfo);

  // WebSocket context
  const { sendMessage, addListener, removeListener } = useContext(WebSocketContext);

  if(debug) console.log('SystemInfoTable:', localSystemInfo, 'compact:', compact);

  if (compact && localSystemInfo.totalMemory) {
    const totalMemory = localSystemInfo.totalMemory;
    const freeMemory = localSystemInfo.freeMemory;
    localSystemInfo.freeMemory = `${freeMemory} / ${totalMemory}`;
    delete localSystemInfo.totalMemory;
  }
  if (compact && localSystemInfo.heapTotal) {
    const heapTotal = localSystemInfo.heapTotal;
    const heapUsed = localSystemInfo.heapUsed;
    localSystemInfo.heapUsed = `${heapUsed} / ${heapTotal}`;
    delete localSystemInfo.heapTotal;
  }
  if (compact && localSystemInfo.osRelease) {
    const osType = localSystemInfo.osType;
    const osRelease	= localSystemInfo.osRelease;
    localSystemInfo.osType = `${osType} (${osRelease})`;
    delete localSystemInfo.osRelease;
  }
  if(compact && localSystemInfo.osArch) {
    const osPlatform = localSystemInfo.osPlatform;
    const osArch = localSystemInfo.osArch;
    localSystemInfo.osPlatform = `${osPlatform} (${osArch})`;
    delete localSystemInfo.osArch;
  }

  useEffect(() => {
    if(debug) console.log('SystemInfoTable useEffect WebSocketMessage mounting');
    const handleWebSocketMessage = (msg) => {
      /* SystemInfoTable page WebSocketMessage listener */
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'memory_update' && msg.params && msg.params.totalMemory && msg.params.freeMemory) {
          if(debug) console.log('SystemInfoTable received memory_update', msg);
          setLocalSystemInfo((prev) => ({
            ...prev,
            totalMemory: msg.params.totalMemory,
            freeMemory: msg.params.freeMemory,
            heapTotal: msg.params.heapTotal,
            heapUsed: msg.params.heapUsed,
            rss: msg.params.rss,
          }))
        }
        if (msg.method === 'cpu_update' && msg.params && msg.params.cpuUsage) {
          if(debug) console.log('SystemInfoTable received cpu_update', msg);
          setLocalSystemInfo((prev) => ({
            ...prev,
            cpuUsage: msg.params.cpuUsage.toFixed(2) + ' %',
          }))
        }
        if (msg.method === 'uptime_update' && msg.params && msg.params.systemUptime && msg.params.processUptime) {
          if(debug) console.log('SystemInfoTable received uptime_update', msg);
          setLocalSystemInfo((prev) => ({
            ...prev,
            systemUptime: msg.params.systemUptime,
            processUptime: msg.params.processUptime,
          }))
        }
      } else {
        if(debug) console.log('Test received WebSocketMessage:', msg.method, msg.src, msg.dst, msg.response);
      }
    };

    addListener(handleWebSocketMessage);
    if(debug) console.log('SystemInfoTable useEffect WebSocketMessage mounted');

    return () => {
      if(debug) console.log('SystemInfoTable useEffect WebSocketMessage unmounting');
      removeListener(handleWebSocketMessage);
      if(debug) console.log('SystemInfoTable useEffect WebSocketMessage unmounted');
    };
  }, [addListener, removeListener, sendMessage]);

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
            {Object.entries(localSystemInfo).map(([key, value], index) => (
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
  