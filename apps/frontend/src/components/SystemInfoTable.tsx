// @mdi
import { mdiChartTimelineVariantShimmer } from '@mdi/js';
import { Icon } from '@mdi/react';
// @mui/material
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
// React
import { memo, useContext, useEffect, useRef, useState } from 'react';

import { debug, enableMobile } from '../appState';
import { type SystemInformation, type WsMessageApiResponse } from '../utils/backendShared';
import { MbfWindow, MbfWindowContent, MbfWindowHeader, MbfWindowHeaderText, MbfWindowIcons } from './MbfWindow';
import { TruncatedText } from './TruncatedText';
import { UiContext } from './UiContext';
import { WebSocketContext } from './WebSocketProvider';

const keyNameMap = new Map<string, string>([
  ['interfaceName', 'Interface name'],
  ['macAddress', 'Mac address'],
  ['ipv4Address', 'IPv4 address'],
  ['ipv6Address', 'IPv6 address'],
  ['nodeVersion', 'Node version'],
  ['bunVersion', 'Bun version'],
  ['hostname', 'Hostname'],
  ['user', 'User'],
  ['osType', 'Os'],
  ['osPlatform', 'Platform'],
  ['freeMemory', 'Memory'],
  ['systemUptime', 'System uptime'],
  ['processUptime', 'Process uptime'],
  ['cpuUsage', 'Host CPU'],
  ['processCpuUsage', 'Process CPU'],
  ['rss', 'Rss'],
  ['heapUsed', 'Heap'],
]);

function SystemInfoTable({ systemInfo, compact }: { systemInfo: SystemInformation; compact: boolean }) {
  // Contexts
  const { mobile } = useContext(UiContext);
  const { addListener, removeListener, getUniqueId, sendMessage } = useContext(WebSocketContext);

  // Local states
  const [localSystemInfo, setLocalSystemInfo] = useState(systemInfo);
  const [closed, setClosed] = useState(false);

  // Refs
  const uniqueId = useRef(getUniqueId());

  if (debug) console.log('SystemInfoTable loading with systemInfo:', localSystemInfo, 'compact:', compact);

  const displaySystemInfo = { ...localSystemInfo };

  // Compact some fields if compact is true
  if (compact && displaySystemInfo.totalMemory && displaySystemInfo.freeMemory) {
    const totalMemory = displaySystemInfo.totalMemory;
    const freeMemory = displaySystemInfo.freeMemory;
    displaySystemInfo.freeMemory = `${freeMemory} / ${totalMemory}`;
    displaySystemInfo.totalMemory = '';
  }
  if (compact && displaySystemInfo.heapTotal && displaySystemInfo.heapUsed) {
    const heapTotal = displaySystemInfo.heapTotal;
    const heapUsed = displaySystemInfo.heapUsed;
    displaySystemInfo.heapUsed = `${heapUsed} / ${heapTotal}`;
    displaySystemInfo.heapTotal = '';
  }
  if (compact && displaySystemInfo.osRelease && displaySystemInfo.osType) {
    const osType = displaySystemInfo.osType;
    const osRelease = displaySystemInfo.osRelease;
    displaySystemInfo.osType = `${osType} (${osRelease})`;
    displaySystemInfo.osRelease = '';
  }
  if (compact && displaySystemInfo.osArch && displaySystemInfo.osPlatform) {
    const osPlatform = displaySystemInfo.osPlatform;
    const osArch = displaySystemInfo.osArch;
    displaySystemInfo.osPlatform = `${osPlatform} (${osArch})`;
    displaySystemInfo.osArch = '';
  }

  // If bunVersion is present, use it as nodeVersion and remove bunVersion from the display
  if (displaySystemInfo.bunVersion) {
    displaySystemInfo.nodeVersion = displaySystemInfo.bunVersion;
    displaySystemInfo.bunVersion = undefined;
  }

  const handleViewHistory = () => {
    if (debug) console.log('SystemInfoTable handleViewHistory clicked');
    sendMessage({ id: uniqueId.current, sender: 'Header', method: '/api/viewhistorypage', src: 'Frontend', dst: 'Matterbridge', params: {} });
  };

  useEffect(() => {
    const handleMemoryUpdate = (totalMemory: string, freeMemory: string, heapTotal: string, heapUsed: string, rss: string) => {
      setLocalSystemInfo((prev) => ({
        ...prev,
        totalMemory: totalMemory,
        freeMemory: freeMemory,
        heapTotal: heapTotal,
        heapUsed: heapUsed,
        rss: rss,
      }));
    };

    const handleCpuUpdate = (cpuUsage: number) => {
      setLocalSystemInfo((prev) => ({
        ...prev,
        cpuUsage: cpuUsage.toFixed(2) + ' %',
      }));
    };

    const handleProcessCpuUpdate = (processCpuUsage: number) => {
      setLocalSystemInfo((prev) => ({
        ...prev,
        processCpuUsage: processCpuUsage.toFixed(2) + ' %',
      }));
    };

    const handleUptimeUpdate = (systemUptime: string, processUptime: string) => {
      setLocalSystemInfo((prev) => ({
        ...prev,
        systemUptime: systemUptime,
        processUptime: processUptime,
      }));
    };

    const handleWebSocketMessage = (msg: WsMessageApiResponse) => {
      if (debug) console.log('SystemInfoTable received WebSocket Message:', msg);
      if (
        msg.method === 'memory_update' &&
        msg.response &&
        msg.response.totalMemory &&
        msg.response.freeMemory &&
        msg.response.heapTotal &&
        msg.response.heapUsed &&
        msg.response.rss
      ) {
        if (debug) console.log('SystemInfoTable received memory_update', msg);
        handleMemoryUpdate(msg.response.totalMemory, msg.response.freeMemory, msg.response.heapTotal, msg.response.heapUsed, msg.response.rss);
      } else if (msg.method === 'cpu_update' && msg.response && msg.response.cpuUsage) {
        if (debug) console.log('SystemInfoTable received cpu_update', msg);
        handleCpuUpdate(msg.response.cpuUsage);
        handleProcessCpuUpdate(msg.response.processCpuUsage);
      } else if (msg.method === 'uptime_update' && msg.response && msg.response.systemUptime && msg.response.processUptime) {
        if (debug) console.log('SystemInfoTable received uptime_update', msg);
        handleUptimeUpdate(msg.response.systemUptime, msg.response.processUptime);
      } else if (msg.method === '/api/viewhistorypage' && msg.id === uniqueId.current && msg.success) {
        if (debug) console.log('SystemInfoTable received /api/viewhistorypage success');
        window.open(`./api/viewhistory`, '_blank', 'noopener,noreferrer');
      }
    };

    addListener(handleWebSocketMessage, uniqueId.current);
    if (debug) console.log(`SystemInfoTable added WebSocket listener id ${uniqueId.current}`);

    return () => {
      removeListener(handleWebSocketMessage);
      if (debug) console.log('SystemInfoTable removed WebSocket listener');
    };
  }, [addListener, removeListener]);

  if (!localSystemInfo || closed) return null;

  if (debug) console.log('SystemInfoTable rendering...');

  return (
    <MbfWindow style={enableMobile && mobile ? { flex: '1 1 300px' } : { flex: '0 1 auto', width: '302px', minWidth: '302px' }}>
      <MbfWindowHeader>
        <MbfWindowHeaderText>System info</MbfWindowHeaderText>
        <MbfWindowIcons close={() => setClosed(true)}>
          <IconButton size="small" sx={{ color: 'var(--header-text-color)', margin: '0px', padding: '0px' }} onClick={handleViewHistory}>
            <Tooltip title="Open the cpu and memory usage page" arrow>
              <Icon path={mdiChartTimelineVariantShimmer} size="22px" />
            </Tooltip>
          </IconButton>
        </MbfWindowIcons>
      </MbfWindowHeader>
      <MbfWindowContent
        style={
          enableMobile && mobile
            ? { flex: '1 1 auto', margin: '0px', padding: '0px', gap: '0px' }
            : { flex: '1 1 auto', overflow: 'auto', margin: '0px', padding: '0px', gap: '0px' }
        }
      >
        <table style={{ border: 'none', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '40%' }} />
            <col style={{ width: '60%' }} />
          </colgroup>
          <tbody style={{ border: 'none', borderCollapse: 'collapse' }}>
            {Object.entries(displaySystemInfo)
              .filter(([key, value]) => key !== 'bunVersion' && value !== undefined && value !== '')
              .map(([key, value], index) => (
                <tr key={key} className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'} style={{ border: 'none', borderCollapse: 'collapse' }}>
                  <td style={{ border: 'none', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                    {key === 'nodeVersion' && localSystemInfo.bunVersion ? 'Bun version' : (keyNameMap.get(key) ?? key)}
                  </td>
                  <td style={{ border: 'none', borderCollapse: 'collapse', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {enableMobile && mobile ? value : <TruncatedText value={value} maxChars={22} />}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </MbfWindowContent>
    </MbfWindow>
  );
}

/**
 * System Info Table
 * Displays System Information in a table format.
 *
 * Props:
 * - systemInfo: SystemInformation object containing various details about the system.
 */
export default memo(SystemInfoTable);
