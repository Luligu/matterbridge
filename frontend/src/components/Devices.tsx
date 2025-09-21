// React
import { useContext, useEffect, useState, useRef, memo } from 'react';

// @mui/material
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// @mui/icons-material
import SettingsIcon from '@mui/icons-material/Settings';
import TableViewIcon from '@mui/icons-material/TableView';
import ViewModuleIcon from '@mui/icons-material/ViewModule';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import DevicesIcons from './DevicesIcons';
import { debug } from '../App';
import { ApiClusters, ApiDevices } from '../../../src/matterbridgeTypes';
import { isApiResponse, isBroadcast, WsMessage } from '../../../src/frontendTypes';
import MbfTable, { MbfTableColumn } from './MbfTable';

const devicesColumns: MbfTableColumn<ApiDevices>[] = [
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
    render: (value, rowKey, device, _column) => (
      device.configUrl ? (
      <IconButton
        onClick={() => window.open(device.configUrl, '_blank')}
        aria-label="Open Config"
        sx={{ margin: 0, padding: 0 }}
      >
        <SettingsIcon fontSize="small"/>
      </IconButton>
      ) : null
    ),
  },
  {
    label: 'Cluster',
    id: 'cluster',
  },
];

const clustersColumns: MbfTableColumn<ApiClusters>[] = [
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
    render: (value, _rowKey, _device, _column) => Array.isArray(value) ? <>{value.map(num => `0x${num.toString(16).padStart(4, '0')}`).join(', ')}</> : <>{value}</>, // Handle array of numbers
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
      <Tooltip title={String(value)} componentsProps={{
          tooltip: { sx: { fontSize: '14px', fontWeight: 'normal', color: '#ffffff', backgroundColor: 'var(--primary-color)'  } },
        }}>
        <div style={{ maxWidth: '500px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {String(value)}
        </div>
      </Tooltip>
    ),
  },
];

const getDeviceRowKey = (row: ApiDevices) => {
  return `${row.pluginName}::${row.uniqueId}`;
};

const getClusterRowKey = (row: ApiClusters) => {
  return `${row.endpoint}::${row.clusterName}::${row.attributeName}`;
};

function Devices() {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);

  // Local states
  const [devices, setDevices] = useState<ApiDevices[]>([]);
  const [filteredDevices, setFilteredDevices] = useState(devices);
  const [clusters, setClusters] = useState<ApiClusters[]>([]);
  const [subEndpointsCount, setSubEndpointsCount] = useState(0);

  // Filter and view mode states
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState('icon'); // Default to icon view

  // Selected device for clusters view
  const [pluginName, setPluginName] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [selectedDeviceUniqueId, setSelectedDeviceUniqueId] = useState<string | null>(null);

  // Refs
  const uniqueId = useRef(getUniqueId());

  // WebSocket message handler effect
  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessage) => {
      if(debug) console.log('Devices received WebSocket Message:', msg);
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        // Handle broadcast messages
        if (isBroadcast(msg) && msg.method === 'refresh_required' && msg.params.changed === 'devices') {
          if(debug) console.log(`Devices received refresh_required: changed=${msg.params.changed} and sending /api/devices request`);
          sendMessage({ id: uniqueId.current, sender: 'Devices', method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        // Handle responses to our requests
        if (isApiResponse(msg) && msg.method === '/api/devices') {
          if(debug) console.log(`Devices received ${msg.response.length} devices:`, msg.response);
          setDevices(msg.response);
        }
        if (isApiResponse(msg) && msg.method === '/api/clusters') {
          if(debug) console.log(`Clusters received ${msg.response.clusters.length} clusters for plugin ${msg.response.plugin}:`, msg.response);
          setClusters(msg.response.clusters);
  
          const endpointCounts: Record<string, number> = {};
          for (const cluster of msg.response.clusters) {
            if(debug) console.log('Cluster:', cluster.endpoint);
            if (endpointCounts[cluster.endpoint]) {
              endpointCounts[cluster.endpoint]++;
            } else {
              endpointCounts[cluster.endpoint] = 1;
            }
          }
          setSubEndpointsCount(Object.keys(endpointCounts).length);
        }
      }
    };

    addListener(handleWebSocketMessage);
    if(debug) console.log('Devices added WebSocket listener');

    return () => {
      removeListener(handleWebSocketMessage);
      if(debug) console.log('Devices removed WebSocket listener');
    };
  }, [addListener, removeListener, sendMessage]);
  
  // Send API requests when online
  useEffect(() => {
    if (online) {
      if(debug) console.log('Devices sending api requests');
      sendMessage({ id: uniqueId.current, sender: 'Devices', method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ id: uniqueId.current, sender: 'Devices', method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ id: uniqueId.current, sender: 'Devices', method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
    }
  }, [online, sendMessage]);

  // Send /api/clusters request when plugin and endpoint are set
  useEffect(() => {
    if (pluginName && endpoint) {
      if(debug) console.log('Devices sending /api/clusters');
      sendMessage({ id: uniqueId.current, sender: 'Devices', method: "/api/clusters", src: "Frontend", dst: "Matterbridge", params: { plugin: pluginName, endpoint: Number(endpoint) } });
    }
  }, [pluginName, endpoint, sendMessage]);

  useEffect(() => {
    if(filter === '') {
      setFilteredDevices(devices);
      return;
    }
    const filteredDevices = devices.filter((device) => device.name.toLowerCase().includes(filter) || device.serial.toLowerCase().includes(filter) );
    setFilteredDevices(filteredDevices);
  }, [devices, filter]);

  useEffect(() => {
    const savedFilter = localStorage.getItem('devicesFilter');
    if (savedFilter) {
      setFilter(savedFilter);
    }
  }, []);

  useEffect(() => {
    const savedViewMode = localStorage.getItem('devicesViewMode');
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(event.target.value.toLowerCase());
    localStorage.setItem('devicesFilter', event.target.value.toLowerCase());
  };
  
  const handleViewModeChange = (mode: string) => {
    setViewMode(mode);
    localStorage.setItem('devicesViewMode', mode);
  };

  const handleDeviceClick = (row: ApiDevices) => {
    if(row.uniqueId === selectedDeviceUniqueId) {
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

  if(debug) console.log('Devices rendering...');
  if (!online) {
    return ( <Connecting /> );
  }
  return (
    <div className="MbfPageDiv">

      {/* Devices Filter and View Mode Dialog */}
      <div className="MbfWindowBodyRow" style={{ justifyContent: 'space-between', padding: 0, gap: '20px', width: '100%', height: '45px', minHeight: '45px', maxHeight: '45px' }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
          <Typography sx={{ fontSize: '16px', fontWeight: 'normal', color: 'var(--div-text-color)', marginLeft: '5px', whiteSpace: 'nowrap' }}>Filter by:</Typography>
          <TextField
            variant="outlined"
            value={filter}
            onChange={handleFilterChange}
            placeholder="Enter the device name or serial number"
            sx={{ width: '320px' }}
            InputProps={{
              style: {
                backgroundColor: 'var(--main-bg-color)',
              },
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
          <Typography sx={{ fontSize: '16px', fontWeight: 'normal', color: 'var(--div-text-color)', marginLeft: '5px', whiteSpace: 'nowrap' }}>View mode:</Typography>
          <IconButton onClick={() => handleViewModeChange('table')} aria-label="Table View" disabled={viewMode === 'table'}>
              <Tooltip title="Table View">
                <TableViewIcon style={{ color: viewMode === 'table' ? 'var(--main-icon-color)' : 'var(--primary-color)' }} />
              </Tooltip>
            </IconButton>
            <IconButton onClick={() => handleViewModeChange('icon')} aria-label="Icon View" disabled={viewMode === 'icon'}>
              <Tooltip title="Icon View (beta)">
                <ViewModuleIcon style={{ color: viewMode === 'icon' ? 'var(--main-icon-color)' : 'var(--primary-color)' }} />
              </Tooltip>
            </IconButton>         
        </Box>
      </div>

      {/* Devices Table */}
      {viewMode === 'table' && 
        <div className="MbfWindowDiv" style={{ margin: '0', padding: '0', gap: '0', maxHeight: `${pluginName && endpoint ? '50%' : '100%'}`, width: '100%', flex: '1 1 auto', overflow: 'hidden' }}>
          <MbfTable name="Registered devices" getRowKey={getDeviceRowKey} onRowClick={handleDeviceClick} rows={filteredDevices} columns={devicesColumns} footerLeft={`Total devices: ${filteredDevices.length.toString()}`}/>
        </div>
      }

      {/* Clusters Table */}
      {viewMode === 'table' && pluginName && endpoint && (
        <div className="MbfWindowDiv" style={{ margin: '0', padding: '0', gap: '0', height: '50%', maxHeight: '50%', width: '100%', flex: '1 1 auto', overflow: 'hidden' }}>
          <MbfTable name="Clusters" title={deviceName || ''} getRowKey={getClusterRowKey} rows={clusters} columns={clustersColumns} footerLeft={`Total child endpoints: ${subEndpointsCount - 1}`} />
        </div>
      )}

      {/* Icon View mode*/}
      {viewMode === 'icon' && (
        <DevicesIcons filter={filter} />
      )}

    </div>
  );
}

export default memo(Devices);