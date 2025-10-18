// React
import { useContext, useEffect, useState, useRef, memo, useCallback } from 'react';

// @mui/material
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

// @mui/icons-material
import SettingsIcon from '@mui/icons-material/Settings';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import { debug } from '../App';
import { ApiDevice, Cluster } from '../../../src/matterbridgeTypes';
import { WsMessageApiResponse, WsMessageApiStateUpdate } from '../../../src/frontendTypes';
import MbfTable, { MbfTableColumn } from './MbfTable';

const devicesColumns: MbfTableColumn<ApiDevice>[] = [
  {
    label: 'Plugin name',
    id: 'pluginName',
    required: true,
  },
  {
    label: 'Device type',
    id: 'type',
  },
  {
    label: 'Endpoint',
    id: 'endpoint',
    align: 'right',
  },
  {
    label: 'Name',
    id: 'name',
    required: true,
  },
  {
    label: 'Serial number',
    id: 'serial',
  },
  {
    label: 'Unique ID',
    id: 'uniqueId',
  },
  {
    label: 'Url',
    id: 'configUrl',
  },
  {
    label: 'Config',
    id: 'configButton',
    noSort: true,
    render: (value, rowKey, device, _column) =>
      device.configUrl ? (
        <IconButton onClick={() => window.open(device.configUrl, '_blank')} aria-label='Open Config' sx={{ margin: 0, padding: 0 }}>
          <SettingsIcon fontSize='small' />
        </IconButton>
      ) : null,
  },
  {
    label: 'Cluster',
    id: 'cluster',
  },
];

const clustersColumns: MbfTableColumn<Cluster>[] = [
  {
    label: 'Endpoint',
    id: 'endpoint',
    required: true,
  },
  {
    label: 'Id',
    id: 'id',
  },
  {
    label: 'Device Types',
    id: 'deviceTypes',
    render: (value, _rowKey, _device, _column) => (Array.isArray(value) ? <>{value.map((num) => `0x${num.toString(16).padStart(4, '0')}`).join(', ')}</> : <>{value}</>), // Handle array of numbers
  },
  {
    label: 'Cluster Name',
    id: 'clusterName',
    required: true,
  },
  {
    label: 'Cluster ID',
    id: 'clusterId',
  },
  {
    label: 'Attribute Name',
    id: 'attributeName',
    required: true,
  },
  {
    label: 'Attribute ID',
    id: 'attributeId',
  },
  {
    label: 'Attribute Value',
    id: 'attributeValue',
    required: true,
    render: (value, _rowKey, _device, _column) => (
      <Tooltip
        title={String(value)}
        componentsProps={{
          tooltip: { sx: { fontSize: '14px', fontWeight: 'normal', color: '#ffffff', backgroundColor: 'var(--primary-color)' } },
        }}
      >
        <div style={{ maxWidth: '500px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(value)}</div>
      </Tooltip>
    ),
  },
];

const getDeviceRowKey = (row: ApiDevice) => {
  return `${row.pluginName}::${row.uniqueId}`;
};

const getClusterRowKey = (row: Cluster) => {
  return `${row.endpoint}::${row.clusterName}::${row.attributeName}`;
};

function DevicesTable({ filter }: { filter: string }) {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);

  // Local states
  const [devices, setDevices] = useState<ApiDevice[]>([]);
  const [filteredDevices, setFilteredDevices] = useState(devices);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [subEndpointsCount, setSubEndpointsCount] = useState(0);

  // Selected device for clusters view
  const [pluginName, setPluginName] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [selectedDeviceUniqueId, setSelectedDeviceUniqueId] = useState<string | null>(null);

  // Refs
  const uniqueId = useRef(getUniqueId());
  const filteredDevicesRef = useRef(filteredDevices);

  const updateDevices = useCallback(
    (msg: WsMessageApiStateUpdate) => {
      if (debug) console.log(`DevicesTable received state_update "${msg.response.cluster}.${msg.response.attribute}" for "${msg.response.id}:${msg.response.number}": "${msg.response.value}"`, msg.response);
      const updateDevice = filteredDevicesRef.current.find((device) => device.pluginName === msg.response.plugin && device.uniqueId === msg.response.uniqueId);
      if (!updateDevice) {
        if (debug) console.warn(`DevicesTable updater device of plugin "${msg.response.plugin}" serial "${msg.response.serialNumber}" not found in filteredDevicesRef.current`);
        return;
      }
      if (pluginName && endpoint && updateDevice.pluginName === pluginName && updateDevice.uniqueId === selectedDeviceUniqueId && msg.response.number.toString() === endpoint) {
        const updatedCluster = clusters.find((c) => c.endpoint === msg.response.number.toString() && c.clusterName === msg.response.cluster && c.attributeName === msg.response.attribute);
        if (!updatedCluster) {
          if (debug) console.warn(`DevicesTable updater cluster ${msg.response.cluster}.${msg.response.attribute} for device "${updateDevice.name}" serial "${updateDevice.serial}" not found in clusters`);
          return;
        }
        updatedCluster.attributeValue = typeof msg.response.value === 'object' ? JSON.stringify(msg.response.value, undefined, 1).replaceAll('"', '') : String(msg.response.value);
        updatedCluster.attributeLocalValue = msg.response.value;
        setClusters([...clusters]);
        if (debug) console.log(`DevicesTable updated attribute ${updatedCluster.clusterName}.${updatedCluster.attributeName} for device "${updateDevice.name}" serial "${updateDevice.serial}" to "${updatedCluster.attributeValue}"`);
      }
    },
    [clusters, endpoint, pluginName, selectedDeviceUniqueId],
  );

  // WebSocket message handler effect
  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessageApiResponse) => {
      if (debug) console.log('DevicesTable received WebSocket Message:', msg);
      if (msg.method === 'refresh_required' && msg.response.changed === 'devices') {
        if (debug) console.log(`DevicesTable received refresh_required: changed=${msg.response.changed} and sending /api/devices request`);
        sendMessage({ id: uniqueId.current, sender: 'DevicesTable', method: '/api/devices', src: 'Frontend', dst: 'Matterbridge', params: {} });
      } else if (msg.method === 'state_update' && msg.response) {
        updateDevices(msg);
      } else if (msg.method === '/api/devices') {
        if (debug) console.log(`DevicesTable received ${msg.response.length} devices:`, msg.response);
        setDevices(msg.response);
      } else if (msg.method === '/api/clusters') {
        if (debug) console.log(`DevicesTable received ${msg.response.clusters.length} clusters for plugin ${msg.response.plugin}:`, msg.response);
        setClusters(msg.response.clusters);
        const endpointCounts: Record<string, number> = {};
        for (const cluster of msg.response.clusters) {
          if (debug) console.log('Cluster:', cluster.endpoint);
          if (endpointCounts[cluster.endpoint]) {
            endpointCounts[cluster.endpoint]++;
          } else {
            endpointCounts[cluster.endpoint] = 1;
          }
        }
        setSubEndpointsCount(Object.keys(endpointCounts).length);
      }
    };

    addListener(handleWebSocketMessage, uniqueId.current);
    if (debug) console.log('DevicesTable added WebSocket listener');

    return () => {
      removeListener(handleWebSocketMessage);
      if (debug) console.log('DevicesTable removed WebSocket listener');
    };
  }, [sendMessage, addListener, removeListener, updateDevices]);

  // Send API requests when online
  useEffect(() => {
    if (online) {
      if (debug) console.log('DevicesTable sending api requests with id ', uniqueId.current);
      sendMessage({ id: uniqueId.current, sender: 'DevicesTable', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });
      sendMessage({ id: uniqueId.current, sender: 'DevicesTable', method: '/api/plugins', src: 'Frontend', dst: 'Matterbridge', params: {} });
      sendMessage({ id: uniqueId.current, sender: 'DevicesTable', method: '/api/devices', src: 'Frontend', dst: 'Matterbridge', params: {} });
    }
  }, [online, sendMessage]);

  // Send /api/clusters request when plugin and endpoint are set
  useEffect(() => {
    if (pluginName && endpoint) {
      if (debug) console.log('DevicesTable sending /api/clusters');
      sendMessage({ id: uniqueId.current, sender: 'DevicesTable', method: '/api/clusters', src: 'Frontend', dst: 'Matterbridge', params: { plugin: pluginName, endpoint: Number(endpoint) } });
    }
  }, [pluginName, endpoint, sendMessage]);

  useEffect(() => {
    if (filter === '') {
      setFilteredDevices(devices);
      filteredDevicesRef.current = devices;
      return;
    }
    const filteredDevices = devices.filter((device) => device.name.toLowerCase().includes(filter) || device.serial.toLowerCase().includes(filter));
    setFilteredDevices(filteredDevices);
    filteredDevicesRef.current = filteredDevices;
  }, [devices, filter]);

  const handleDeviceClick = (row: ApiDevice) => {
    if (row.uniqueId === selectedDeviceUniqueId) {
      setSelectedDeviceUniqueId(null);
      setPluginName(null);
      setEndpoint(null);
      setDeviceName(null);
      return;
    }
    setSelectedDeviceUniqueId(row.uniqueId);
    setPluginName(row.pluginName);
    setEndpoint(row.endpoint ? row.endpoint.toString() : null);
    setDeviceName(row.name);
  };

  if (debug) console.log('DevicesTable rendering...');
  if (!online) {
    return <Connecting />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', margin: '0px', padding: '0px', gap: '20px', width: '100%', overflow: 'hidden' }}>
      {/* Devices Table */}
      <div className='MbfWindowDiv' style={{ margin: '0px', padding: '0px', gap: '0px', width: '100%', maxHeight: `${pluginName && endpoint ? '30%' : '100%'}`, flex: '1 1 auto', overflow: 'hidden' }}>
        <MbfTable name='Registered devices' getRowKey={getDeviceRowKey} onRowClick={handleDeviceClick} rows={filteredDevices} columns={devicesColumns} footerLeft={`Total devices: ${filteredDevices.length.toString()}`} />
      </div>

      {/* Clusters Table */}
      {pluginName && endpoint && (
        <div className='MbfWindowDiv' style={{ margin: '0px', padding: '0px', gap: '0px', width: '100%', height: '70%', maxHeight: '70%', flex: '1 1 auto', overflow: 'hidden' }}>
          <MbfTable name='Clusters' title={deviceName || ''} getRowKey={getClusterRowKey} rows={clusters} columns={clustersColumns} footerLeft={`Total child endpoints: ${subEndpointsCount - 1}`} />
        </div>
      )}
    </div>
  );
}

export default memo(DevicesTable);
