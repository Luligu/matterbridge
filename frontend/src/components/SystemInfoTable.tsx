// React
import { memo, useContext, useEffect, useRef, useState } from 'react';

// @mui/material
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

// @mdi/js
import Icon from '@mdi/react';
import { mdiChartTimelineVariantShimmer } from '@mdi/js';

// Backend
import { SystemInformation } from '../../../src/matterbridgeTypes';

// Frontend
import { TruncatedText } from './TruncatedText';
import { UiContext } from './UiProvider';
import { WebSocketContext } from './WebSocketProvider';
import { WsMessageApiResponse } from '../../../src/frontendTypes';
import { MbfWindow, MbfWindowContent, MbfWindowHeader, MbfWindowHeaderText, MbfWindowIcons } from './MbfWindow';
import { debug, enableMobile } from '../App';
// const debug = true;

function SystemInfoTable({ systemInfo, compact }: { systemInfo: SystemInformation; compact: boolean }) {
  // Contexts
  const { mobile } = useContext(UiContext);
  const { addListener, removeListener, getUniqueId, sendMessage } = useContext(WebSocketContext);

  // Local states
  const [localSystemInfo, setLocalSystemInfo] = useState(systemInfo);

  // Refs
  const uniqueId = useRef(getUniqueId());

  if (debug) console.log('SystemInfoTable loading with systemInfo:', localSystemInfo, 'compact:', compact);

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
    const osRelease = localSystemInfo.osRelease;
    localSystemInfo.osType = `${osType} (${osRelease})`;
    localSystemInfo.osRelease = '';
  }
  if (systemInfo && compact && localSystemInfo.osArch && localSystemInfo.osPlatform) {
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

  const handleViewHistory = () => {
    if (debug) console.log('SystemInfoTable handleViewHistory clicked');
    sendMessage({ id: uniqueId.current, sender: 'Header', method: '/api/viewhistorypage', src: 'Frontend', dst: 'Matterbridge', params: {} });
  };

  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessageApiResponse) => {
      if (debug) console.log('SystemInfoTable received WebSocket Message:', msg);
      if (msg.method === 'memory_update' && msg.response && msg.response.totalMemory && msg.response.freeMemory && msg.response.heapTotal && msg.response.heapUsed && msg.response.rss) {
        if (debug) console.log('SystemInfoTable received memory_update', msg);
        handleMemoryUpdate(msg.response.totalMemory, msg.response.freeMemory, msg.response.heapTotal, msg.response.heapUsed, msg.response.rss);
      } else if (msg.method === 'cpu_update' && msg.response && msg.response.cpuUsage) {
        if (debug) console.log('SystemInfoTable received cpu_update', msg);
        handleCpuUpdate(msg.response.cpuUsage);
        handleProcessCpuUpdate(msg.response.processCpuUsage);
      } else if (msg.method === 'uptime_update' && msg.response && msg.response.systemUptime && msg.response.processUptime) {
        if (debug) console.log('SystemInfoTable received uptime_update', msg);
        handleUptimeUpdate(msg.response.systemUptime, msg.response.processUptime);
      } else if (msg.method === '/api/viewhistorypage' && msg.id === uniqueId.current && msg.success === true) {
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

  const [closed, setClosed] = useState(false);

  if (!localSystemInfo || closed) return null;

  if (debug) console.log('SystemInfoTable rendering...');

  return (
    <MbfWindow style={enableMobile && mobile ? { flex: '1 1 300px' } : { flex: '0 1 auto', width: '302px', minWidth: '302px' }}>
      <MbfWindowHeader>
        <MbfWindowHeaderText>System info</MbfWindowHeaderText>
        <MbfWindowIcons close={() => setClosed(true)}>
          <IconButton size='small' sx={{ color: 'var(--header-text-color)', margin: '0px', padding: '0px' }} onClick={handleViewHistory}>
            <Tooltip title='Open the cpu and memory usage page' arrow>
              <Icon path={mdiChartTimelineVariantShimmer} size='22px' />
            </Tooltip>
          </IconButton>
        </MbfWindowIcons>
      </MbfWindowHeader>
      <MbfWindowContent style={enableMobile && mobile ? { flex: '1 1 auto', margin: '0px', padding: '0px', gap: '0px' } : { flex: '1 1 auto', overflow: 'auto', margin: '0px', padding: '0px', gap: '0px' }}>
        <table style={{ border: 'none', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '40%' }} />
            <col style={{ width: '60%' }} />
          </colgroup>
          <tbody style={{ border: 'none', borderCollapse: 'collapse' }}>
            {Object.entries(localSystemInfo)
              .filter(([_key, value]) => value !== undefined && value !== '')
              .map(([key, value], index) => (
                <tr key={key} className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'} style={{ border: 'none', borderCollapse: 'collapse' }}>
                  <td style={{ border: 'none', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                    {key
                      .replace('interfaceName', 'Interface name')
                      .replace('macAddress', 'Mac address')
                      .replace('ipv4Address', 'IPv4 address')
                      .replace('ipv6Address', 'IPv6 address')
                      .replace('nodeVersion', 'Node version')
                      .replace('hostname', 'Hostname')
                      .replace('user', 'User')
                      .replace('osType', 'Os')
                      .replace('osPlatform', 'Platform')
                      .replace('freeMemory', 'Memory')
                      .replace('systemUptime', 'System uptime')
                      .replace('processUptime', 'Process uptime')
                      .replace('cpuUsage', 'Host CPU')
                      .replace('processCpuUsage', 'Process CPU')
                      .replace('rss', 'Rss')
                      .replace('heapUsed', 'Heap')}
                  </td>
                  <td style={{ border: 'none', borderCollapse: 'collapse', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {enableMobile && mobile ? typeof value !== 'string' ? value.toString() : value : <TruncatedText value={typeof value !== 'string' ? value.toString() : value} maxChars={22} />}
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
