// React
import React, { useContext, useEffect, useState } from 'react';
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

// @mui/icons-material
import SettingsIcon from '@mui/icons-material/Settings';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';

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
    Header: 'Config Url',
    accessor: 'configUrl',
  },
  {
    Header: 'Config',
    accessor: 'configButton',
    noSort: true,
    Cell: ({ row }) => (
      <IconButton
        onClick={() => window.open(row.original.configUrl, '_blank')}
        aria-label="Open Config"
        disabled={!row.original.configUrl}
      >
        <SettingsIcon />
      </IconButton>
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
    if(index === selectedDeviceIndex) {
      setSelectedDeviceIndex(null);
      setPlugin(null);
      setEndpoint(null);
      setDeviceName(null);
      console.log('Device unclicked:', index, 'selectedDeviceIndex:', selectedDeviceIndex);
      return;
    }
    setSelectedDeviceIndex(index);
    setPlugin(data[index].pluginName);
    setEndpoint(data[index].endpoint);
    setDeviceName(data[index].name);
    console.log('Device clicked:', index, 'selectedDeviceIndex:', selectedDeviceIndex, 'pluginName:', data[index].pluginName, 'endpoint:', data[index].endpoint);
  };

  return (
    <table {...getTableProps()} style={{ margin: '-1px', border: '1px solid var(--table-border-color)' }}>
      <thead>
        {headerGroups.map(headerGroup => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map(column => (
              <th {...column.getHeaderProps({ ...column.getSortByToggleProps(), title: '' })}>
                {column.render('Header')}
                {/* Add a sort direction indicator */}
                {!column.noSort && (
                  <span>
                    {column.isSorted
                      ? column.isSortedDesc
                        ? ' 🔽'
                        : ' 🔼'
                      : '🔽🔼'}
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

function ClustersTable({ data }) {
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({ columns: clustersColumns, data }, useSortBy);

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
  const { online, sendMessage, addListener, removeListener } = useContext(WebSocketContext);
  const [devices, setDevices] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [plugin, setPlugin] = useState(null);
  const [endpoint, setEndpoint] = useState(null);
  const [deviceName, setDeviceName] = useState(null);
  const [subEndpointsCount, setSubEndpointsCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState({
    pluginName: true,
    type: true,
    endpoint: true,
    name: true,
    serial: true,
    uniqueId: false,
    cluster: true,
  });

  useEffect(() => {
    const handleWebSocketMessage = (msg) => {
      // console.log('Test received WebSocket Message:', msg);
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'refresh_required') {
          console.log('Devices received refresh_required');
          sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (msg.method === '/api/devices') {
          console.log(`Devices received ${msg.response.length} devices:`, msg.response);
          setDevices(msg.response);
        }
        if (msg.method === '/api/clusters') {
          console.log(`Devices received ${msg.response.length} clusters:`, msg.response);
          setClusters(msg.response);
  
          const endpointCounts = {};
          for (const cluster of msg.response) {
            console.log('Cluster:', cluster.endpoint);
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
    console.log('Devices added WebSocket listener');
    return () => {
      removeListener(handleWebSocketMessage);
      console.log('Devices removed WebSocket listener');
    };
  }, [addListener, removeListener, sendMessage]);
  
  useEffect(() => {
    if (online) {
      console.log('Devices sending api requests');
      sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
    }
  }, [online, sendMessage]);

  useEffect(() => {
    if (plugin && endpoint) {
      console.log('Devices sending /api/clusters');
      sendMessage({ method: "/api/clusters", src: "Frontend", dst: "Matterbridge", params: { plugin: plugin, endpoint: endpoint } });
    }
  }, [plugin, endpoint, sendMessage]);

  const handleDialogToggle = () => {
    setDialogOpen(!dialogOpen);
  };

  const handleColumnVisibilityChange = (accessor) => {
    setColumnVisibility((prev) => {
      const newVisibility = {
        ...prev,
        [accessor]: !prev[accessor],
      };
      localStorage.setItem('columnVisibility', JSON.stringify(newVisibility));
      return newVisibility;
    });
  };

  useEffect(() => {
    const storedVisibility = localStorage.getItem('columnVisibility');
    if (storedVisibility) {
      setColumnVisibility(JSON.parse(storedVisibility));
    }
  }, []);

  if (!online) {
    return ( <Connecting /> );
  }
  return (
    <div className="MbfPageDiv">

      <Dialog open={dialogOpen} onClose={handleDialogToggle} 
        PaperProps={{style: { 
          color: 'var(--div-text-color)', 
          backgroundColor: 'var(--div-bg-color)', 
          border: "2px solid var(--div-border-color)", 
          borderRadius: 'var(--div-border-radius)', 
          boxShadow: '2px 2px 5px var(--div-shadow-color)'}}}>
        <DialogTitle>Configure Columns</DialogTitle>
        <DialogContent>
          <FormGroup>
            {devicesColumns.filter(column => column.accessor !== 'pluginName' && column.accessor !== 'name').map((column) => (
              <FormControlLabel
                key={column.accessor}
                control={
                  <Checkbox
                    checked={columnVisibility[column.accessor]}
                    onChange={() => handleColumnVisibilityChange(column.accessor)}
                  />
                }
                label={column.Header}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogToggle}>Close</Button>
        </DialogActions>
      </Dialog>

      <div className="MbfWindowDiv" style={{ margin: '0', padding: '0', gap: '0', maxHeight: `${plugin && endpoint ? '50%' : '100%'}`, width: '100%', flex: '1 1 auto', overflow: 'hidden' }}>
        <div className="MbfWindowHeader">
          <div className="MbfWindowHeaderText" style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
            <p style={{margin: '0px', padding: '0px'}}>Registered devices</p>
            <IconButton onClick={handleDialogToggle} aria-label="Configure Columns" style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}}>
              <Tooltip title="Configure columns">
                <SettingsIcon style={{ color: 'var(--header-text-color)', fontSize: '19px' }}/>
              </Tooltip>
            </IconButton>
          </div>
        </div>
        <div className="MbfWindowBodyColumn" style={{ margin: '0', padding: '0', gap: '0' }}>
          <DevicesTable data={devices} columnVisibility={columnVisibility} setPlugin={setPlugin} setEndpoint={setEndpoint} setDeviceName={setDeviceName}/>
        </div>
        <div className="MbfWindowFooter" style={{height: '', padding: '0', borderTop: '1px solid var(--table-border-color)'}}>
          <p className="MbfWindowFooterText" style={{paddingLeft: '10px', fontWeight: 'normal', textAlign: 'left'}}>Total devices: {devices.length.toString()}</p>
        </div>
      </div>
      {plugin && endpoint && (
        <div className="MbfWindowDiv" style={{ margin: '0', padding: '0', gap: '0', height: '50%', maxHeight: '50%', width: '100%', flex: '1 1 auto', overflow: 'hidden' }}>
          <div className="MbfWindowHeader">
            <p className="MbfWindowHeaderText">Clusters for device "{deviceName}" on endpoint {endpoint}</p>
          </div>
          <div className="MbfWindowBodyColumn" style={{ margin: '0', padding: '0', gap: '0' }}>
            <ClustersTable data={clusters}/>
          </div>
          <div className="MbfWindowFooter" style={{height: '', padding: '0', borderTop: '1px solid var(--table-border-color)'}}>
            <p className="MbfWindowFooterText" style={{paddingLeft: '10px', fontWeight: 'normal', textAlign: 'left'}}>Total child endpoints: {subEndpointsCount - 1}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Devices;