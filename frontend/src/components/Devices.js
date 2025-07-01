/* eslint-disable no-console */
// React
import React, { useContext, useEffect, useState, useRef } from 'react';
import { useTable, useSortBy } from 'react-table';

// @mui/material
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// @mui/icons-material
import SettingsIcon from '@mui/icons-material/Settings';
import TableViewIcon from '@mui/icons-material/TableView';
import ViewModuleIcon from '@mui/icons-material/ViewModule';

// @mdi/js
import Icon from '@mdi/react';
import { mdiSortAscending, mdiSortDescending } from '@mdi/js';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import { DevicesIcons } from './DevicesIcons';
import { debug } from '../App';

const devicesColumns = [
  {
    Header: 'Plugin name',
    accessor: 'pluginName',
  },
  {
    Header: 'Device type',
    accessor: 'type',
  },
  {
    Header: 'Endpoint',
    accessor: 'endpoint',
  },
  {
    Header: 'Name',
    accessor: 'name',
  },
  {
    Header: 'Serial number',
    accessor: 'serial',
  },
  {
    Header: 'Unique ID',
    accessor: 'uniqueId',
  },
  {
    Header: 'Url',
    accessor: 'configUrl',
  },
  {
    Header: 'Config',
    accessor: 'configButton',
    noSort: true,
    Cell: ({ row }) => (
      row.original.configUrl ? (
      <IconButton
        onClick={() => window.open(row.original.configUrl, '_blank')}
        aria-label="Open Config"
        sx={{ margin: 0, padding: 0 }}
      >
        <SettingsIcon fontSize="small"/>
      </IconButton>
      ) : null
    ),
  },
  {
    Header: 'Cluster',
    accessor: 'cluster',
  },
];

const clustersColumns = [
  {
    Header: 'Endpoint',
    accessor: 'endpoint',
  },
  {
    Header: 'Id',
    accessor: 'id',
  },
  {
    Header: 'Device Types',
    accessor: 'deviceTypes',
    Cell: ({ value }) => Array.isArray(value) ? value.map(num => `0x${num.toString(16).padStart(4, '0')}`).join(', ') : value, // Handle array of numbers
  },
  {
    Header: 'Cluster Name',
    accessor: 'clusterName',
  },
  {
    Header: 'Cluster ID',
    accessor: 'clusterId',
  },
  {
    Header: 'Attribute Name',
    accessor: 'attributeName',
  },
  {
    Header: 'Attribute ID',
    accessor: 'attributeId',
  },
  {
    Header: 'Attribute Value',
    accessor: 'attributeValue',
    Cell: ({ value }) => (
      <Tooltip title={value} componentsProps={{
          tooltip: { sx: { fontSize: '14px', fontWeight: 'normal', color: '#ffffff', backgroundColor: 'var(--primary-color)'  } },
        }}>
        <div style={{ maxWidth: '500px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </div>
      </Tooltip>
    ),
  },
];

function DevicesTable({ data, columnVisibility, setPlugin, setEndpoint, setDeviceName }) {
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(null);

  // Filter columns based on visibility
  const visibleColumns = React.useMemo(
    () => devicesColumns.filter(column => columnVisibility[column.accessor]),
    [columnVisibility]
  );
  
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({ columns: visibleColumns, data }, useSortBy);

  const handleDeviceClick = (index) => {
    const row = rows[index];
    if(index === selectedDeviceIndex) {
      setSelectedDeviceIndex(null);
      setPlugin(null);
      setEndpoint(null);
      setDeviceName(null);
      if(debug) console.log('Device unclicked:', index, 'selectedDeviceIndex:', selectedDeviceIndex);
      return;
    }
    setSelectedDeviceIndex(index);
    setPlugin(row.original.pluginName);
    setEndpoint(row.original.endpoint);
    setDeviceName(row.original.name);
    if(debug) console.log('Device clicked:', index, 'selectedDeviceIndex:', selectedDeviceIndex, 'pluginName:', data[index].pluginName, 'endpoint:', data[index].endpoint);
  };

  return (
    <table {...getTableProps()} style={{ margin: '-1px', border: '1px solid var(--table-border-color)' }}>
      <thead>
        {headerGroups.map(headerGroup => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map(column => (
              <th {...column.getHeaderProps(column.noSort ? undefined : column.getSortByToggleProps())}>
                {column.render('Header')}
                {/* Add a sort direction indicator */}
                {!column.noSort && (
                  <span style={{ margin: '0px', marginLeft: '5px', padding: '0px' }}>
                    {column.isSorted
                      ? column.isSortedDesc
                        ? <Icon path={mdiSortDescending} size='15px'/>
                        : <Icon path={mdiSortAscending} size='15px'/>
                    : null}
                  </span>
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row, index) => {
          prepareRow(row);
          return (
            <tr 
              key={index} 
              className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'} 
              {...row.getRowProps()} 
              onClick={() => handleDeviceClick(index)}
              style={{
                backgroundColor: selectedDeviceIndex === index ? 'var(--table-selected-bg-color)' : '',
                cursor: 'pointer',
              }}
            >
              {row.cells.map(cell => (
                <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ClustersTable({ data, columnVisibility }) {
  // Filter columns based on visibility
  const visibleColumns = React.useMemo(
    () => clustersColumns.filter(column => columnVisibility[column.accessor]),
    [columnVisibility]
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({ columns: visibleColumns, data }, useSortBy);

  return (
    <table {...getTableProps()} style={{ margin: '-1px' }}>
      <thead>
        {headerGroups.map(headerGroup => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map(column => (
              <th {...column.getHeaderProps()}>
                {column.render('Header')}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row, index) => {
          prepareRow(row);
          return (
            <tr 
              key={index} 
              className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'} 
              {...row.getRowProps()}
            >
              {row.cells.map(cell => (
                <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Devices() {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);

  // Local states
  const [devices, setDevices] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [plugin, setPlugin] = useState(null);
  const [endpoint, setEndpoint] = useState(null);
  const [deviceName, setDeviceName] = useState(null);
  const [subEndpointsCount, setSubEndpointsCount] = useState(0);
  const [dialogDevicesOpen, setDialogDevicesOpen] = useState(false);
  const [devicesColumnVisibility, setDevicesColumnVisibility] = useState({
    pluginName: true,
    type: true,
    endpoint: true,
    name: true,
    serial: true,
    uniqueId: false,
    configUrl: false,
    configButton: true,
    cluster: true,
  });
  const [dialogClustersOpen, setDialogClustersOpen] = useState(false);
  const [clustersColumnVisibility, setClustersColumnVisibility] = useState({
    endpoint: true,
    id: true,
    deviceTypes: true,
    clusterName: true,
    clusterId: true,
    attributeName: true,
    attributeId: true,
    attributeValue: true,
  });

  // Filter devices
  const [filter, setFilter] = useState('');
  const [filteredDevices, setFilteredDevices] = useState(devices);

  // View mode
  const [viewMode, setViewMode] = useState('icon'); // Default to icon view

  // Refs
  const uniqueId = useRef(getUniqueId());

  // WebSocket message handler effect
  useEffect(() => {
    const handleWebSocketMessage = (msg) => {
      if(debug) console.log('Devices received WebSocket Message:', msg);
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'refresh_required') {
          if(debug) console.log('Devices received refresh_required');
          sendMessage({ id: uniqueId.current, sender: 'Devices', method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (msg.method === '/api/devices') {
          if(debug) console.log(`Devices received ${msg.response.length} devices:`, msg.response);
          setDevices(msg.response);
        }
        if (msg.method === '/api/clusters') {
          if(debug) console.log(`Devices received ${msg.response.length} clusters:`, msg.response);
          setClusters(msg.response);
  
          const endpointCounts = {};
          for (const cluster of msg.response) {
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
    if (plugin && endpoint) {
      if(debug) console.log('Devices sending /api/clusters');
      sendMessage({ id: uniqueId.current, sender: 'Devices', method: "/api/clusters", src: "Frontend", dst: "Matterbridge", params: { plugin: plugin, endpoint: endpoint } });
    }
  }, [plugin, endpoint, sendMessage]);

  const handleDialogDevicesToggle = () => {
    setDialogDevicesOpen(!dialogDevicesOpen);
  };

  const handleDevicesColumnVisibilityChange = (accessor) => {
    setDevicesColumnVisibility((prev) => {
      const newVisibility = {
        ...prev,
        [accessor]: !prev[accessor],
      };
      localStorage.setItem('devicesColumnVisibility', JSON.stringify(newVisibility));
      return newVisibility;
    });
  };

  useEffect(() => {
    const storedVisibility = localStorage.getItem('devicesColumnVisibility');
    if (storedVisibility) {
      setDevicesColumnVisibility(JSON.parse(storedVisibility));
    }
  }, []);

  const handleDialogClustersToggle = () => {
    setDialogClustersOpen(!dialogClustersOpen);
  };

  const handleClustersColumnVisibilityChange = (accessor) => {
    setClustersColumnVisibility((prev) => {
      const newVisibility = {
        ...prev,
        [accessor]: !prev[accessor],
      };
      localStorage.setItem('clustersColumnVisibility', JSON.stringify(newVisibility));
      return newVisibility;
    });
  };

  useEffect(() => {
    const storedVisibility = localStorage.getItem('clustersColumnVisibility');
    if (storedVisibility) {
      setClustersColumnVisibility(JSON.parse(storedVisibility));
    }
  }, []);

  const handleFilterChange = (event) => {
    setFilter(event.target.value.toLowerCase());
    localStorage.setItem('devicesFilter', event.target.value.toLowerCase());
  };
  
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('devicesViewMode', mode);
  };

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

      {/* Devices Configure Columns Dialog */}
      <Dialog open={dialogDevicesOpen} onClose={handleDialogDevicesToggle}>
        <DialogTitle>Configure Devices Columns</DialogTitle>
        <DialogContent>
          <FormGroup>
            {devicesColumns.map((column) => (
              <FormControlLabel
                key={column.accessor}
                control={
                  <Checkbox
                    disabled={['pluginName', 'name', 'configButton'].includes(column.accessor)}
                    checked={devicesColumnVisibility[column.accessor]}
                    onChange={() => handleDevicesColumnVisibilityChange(column.accessor)}
                  />
                }
                label={column.Header}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogDevicesToggle}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Devices Table */}
      {viewMode === 'table' && 
        <div className="MbfWindowDiv" style={{ margin: '0', padding: '0', gap: '0', maxHeight: `${plugin && endpoint ? '50%' : '100%'}`, width: '100%', flex: '1 1 auto', overflow: 'hidden' }}>
          <div className="MbfWindowHeader">
            <div className="MbfWindowHeaderText" style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
              <p style={{margin: '0px', padding: '0px'}}>Registered devices</p>
              <IconButton onClick={handleDialogDevicesToggle} aria-label="Configure Columns" style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}}>
                <Tooltip title="Configure columns">
                  <SettingsIcon style={{ color: 'var(--header-text-color)', fontSize: '19px' }}/>
                </Tooltip>
              </IconButton>
            </div>
          </div>
          <div className="MbfWindowBodyColumn" style={{ margin: '0', padding: '0', gap: '0' }}>
            <DevicesTable data={filteredDevices} columnVisibility={devicesColumnVisibility} setPlugin={setPlugin} setEndpoint={setEndpoint} setDeviceName={setDeviceName}/>
          </div>
          <div className="MbfWindowFooter" style={{height: '', padding: '0', borderTop: '1px solid var(--table-border-color)'}}>
            <p className="MbfWindowFooterText" style={{paddingLeft: '10px', fontWeight: 'normal', textAlign: 'left'}}>Total devices: {filteredDevices.length.toString()}</p>
          </div>
        </div>
      }

      {/* Clusters Configure Columns Dialog */}
      <Dialog open={dialogClustersOpen} onClose={handleDialogClustersToggle}>
        <DialogTitle>Configure Clusters Columns</DialogTitle>
        <DialogContent>
          <FormGroup>
            {clustersColumns.map((column) => (
              <FormControlLabel
                key={column.accessor}
                control={
                  <Checkbox
                    disabled={['clusterName', 'attributeName', 'attributeValue'].includes(column.accessor)}
                    checked={clustersColumnVisibility[column.accessor]}
                    onChange={() => handleClustersColumnVisibilityChange(column.accessor)}
                  />
                }
                label={column.Header}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClustersToggle}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Clusters Table */}
      {viewMode === 'table' && plugin && endpoint && (
        <div className="MbfWindowDiv" style={{ margin: '0', padding: '0', gap: '0', height: '50%', maxHeight: '50%', width: '100%', flex: '1 1 auto', overflow: 'hidden' }}>
          <div className="MbfWindowHeader">
            <div className="MbfWindowHeaderText" style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
              <p style={{margin: '0px', padding: '0px'}}>Clusters for device "{deviceName}" on endpoint {endpoint}</p>
              <IconButton onClick={handleDialogClustersToggle} aria-label="Configure Columns" style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}}>
                <Tooltip title="Configure columns">
                  <SettingsIcon style={{ color: 'var(--header-text-color)', fontSize: '19px' }}/>
                </Tooltip>
              </IconButton>
            </div>
          </div>
          <div className="MbfWindowBodyColumn" style={{ margin: '0', padding: '0', gap: '0' }}>
            <ClustersTable data={clusters} columnVisibility={clustersColumnVisibility} />
          </div>
          <div className="MbfWindowFooter" style={{height: '', padding: '0', borderTop: '1px solid var(--table-border-color)'}}>
            <p className="MbfWindowFooterText" style={{paddingLeft: '10px', fontWeight: 'normal', textAlign: 'left'}}>Total child endpoints: {subEndpointsCount - 1}</p>
          </div>
        </div>
      )}

      {/* Icon View mode*/}
      {viewMode === 'icon' && (
        <DevicesIcons filter={filter} devices={filteredDevices} />
      )}

    </div>
  );
}

export default Devices;