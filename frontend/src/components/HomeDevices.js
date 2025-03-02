/* eslint-disable no-console */
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

// @mdi/js
import Icon from '@mdi/react';
import { mdiSortAscending, mdiSortDescending } from '@mdi/js';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
// import { debug } from '../App';
const debug = true;


export function HomeDevicesTable({ data, columns, columnVisibility }) {
  // Add state to manage the sorting state
  const [sortBy, setSortBy] = useState([]);
  
  // Filter columns based on visibility
  const visibleColumns = React.useMemo(
    () => columns.filter(column => columnVisibility[column.accessor]),
    [columnVisibility, columns]
  );
  
  // React-Table
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({ columns: visibleColumns, data }, useSortBy);

  return (
    <table {...getTableProps()} style={{ border: 'none', borderCollapse: 'collapse' }}>
      <thead style={{ border: 'none', borderCollapse: 'collapse' }}>
        {headerGroups.map(headerGroup => (
          <tr {...headerGroup.getHeaderGroupProps()} style={{ border: 'none', borderCollapse: 'collapse' }}>
            {headerGroup.headers.map(column => (
              <th {...column.getHeaderProps(column.noSort ? undefined : column.getSortByToggleProps())} style={{ border: 'none', borderCollapse: 'collapse', cursor: column.noSort ? 'default' : 'pointer', }}>
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
      <tbody {...getTableBodyProps()} style={{ border: 'none', borderCollapse: 'collapse' }}>
        {rows.map((row, index) => {
          prepareRow(row);
          return (
            <tr 
              key={index} 
              className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'} 
              {...row.getRowProps()} style={{ border: 'none', borderCollapse: 'collapse' }}
            >
              {row.cells.map(cell => (
                <td {...cell.getCellProps()} style={{ border: 'none', borderCollapse: 'collapse' }}>{cell.render('Cell')}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function HomeDevices() {
  const { online, sendMessage, addListener, removeListener } = useContext(WebSocketContext);
  const [plugins, setPlugins] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectDevices, setSelectDevices] = useState([]);
  const [mixedDevices, setMixedDevices] = useState([]);
  const [dialogDevicesOpen, setDialogDevicesOpen] = useState(false);
  const [devicesColumnVisibility, setDevicesColumnVisibility] = useState({
    pluginName: true,
    name: true,
    serial: true,
    reachable: true,
    configUrl: false,
    actions: true,
  });

  const devicesColumns = [
    {
      Header: 'Plugin',
      accessor: 'pluginName',
    },
    {
      Header: 'Name',
      accessor: 'name',
    },
    {
      Header: 'Serial',
      accessor: 'serial',
    },
    {
      Header: 'Availability',
      accessor: 'reachable',
      Cell: ({ row }) => (
        row.original.reachable===true ? 'Online' : row.original.reachable===false ? <span style={{ color: 'red' }}>Offline</span> : ''
      ),
      sortType: (rowA, rowB) => {
        const a = rowA.original.reachable===true ? 1 : rowA.original.reachable===false ? 0 : -1;
        const b = rowB.original.reachable===true ? 1 : rowB.original.reachable===false ? 0 : -1;
        return a - b;
      },
    },
    {
      Header: 'Url',
      accessor: 'configUrl',
    },
    {
      Header: 'Actions',
      accessor: 'actions',
      noSort: true,
      Cell: ({ row }) => (
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          {row.original.configUrl ?
            <Tooltip title="Open the configuration page">
              <IconButton
                onClick={() => window.open(row.original.configUrl, '_blank')}
                aria-label="Open config url"
                sx={{ margin: 0, padding: 0 }}
              >
                <SettingsIcon fontSize="small"/>
              </IconButton>
            </Tooltip> 
          :
            <div style={{ width: '20px', height: '20px' }}></div>
          }
          {row.original.selected!==undefined ?
            <Tooltip title="Select/unselect the device">
              <Checkbox
                checked={row.original.selected} 
                onChange={(event) => handleCheckboxChange(event, row.original)} 
                sx={{ margin: '0', marginLeft: '8px', padding: '0', }}
                size="small"
              />
            </Tooltip>
          :
            <div style={{ width: '20px', height: '20px' }}></div>
          }
        </div>
      ),
    },
  ];
  
  // WebSocket message handler effect
  useEffect(() => {
    const handleWebSocketMessage = (msg) => {
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'refresh_required') {
          if(debug) console.log('HomeDevices received refresh_required');
          sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (msg.method === '/api/plugins') {
          if(debug) console.log(`HomeDevices received ${msg.response?.length} plugins:`, msg.response);
          if(msg.response) {
            setPlugins(msg.response);

            sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
            if(debug) console.log(`HomeDevices sent /api/devices`);

            for (const plugin of msg.response) {
              if(plugin.started && !plugin.error) {
                sendMessage({ method: "/api/select/devices", src: "Frontend", dst: "Matterbridge", params: { plugin: plugin.name} });
                if(debug) console.log(`HomeDevices sent /api/select/devices for plugin: ${plugin.name}`);
              } 
            }
          }
        }
        if (msg.method === '/api/devices') {
          if(debug) console.log(`HomeDevices received ${msg.response?.length} devices:`, msg.response);
          if(msg.response) {
            for (const device of msg.response) {
              if(plugins.length===0) console.error(`HomeDevices: /api/devices with plugins lenght 0`);
              const plugin = plugins.find((p) => p.name === device.pluginName);
              if(!plugin) console.error(`HomeDevices: device ${device.deviceName} has no plugin ${device.pluginName}`);
              if(plugin?.hasBlackList===true) {
                device.selected = true;
              } else {
                device.selected = undefined;
              }
            }
            setDevices(msg.response);
          }
        }
        if (msg.method === '/api/select/devices') {
          if(debug) console.log(`HomeDevices received ${msg.response?.length} selectDevices:`, msg.response);
          if(msg.response) {
            for (const device of msg.response) device.selected = false;
            setSelectDevices(msg.response);
          }
        }
      }
    };

    addListener(handleWebSocketMessage);
    if(debug) console.log('HomeDevices added WebSocket listener');

    return () => {
      removeListener(handleWebSocketMessage);
      if(debug) console.log('HomeDevices removed WebSocket listener');
    };
  }, [plugins, addListener, removeListener, sendMessage]);
  
  // Mix devices and selectDevices
  useEffect(() => {
    if(debug) console.log('HomeDevices mixing devices and selectDevices');
    const mixed = [];
    for (const device of devices) {
      mixed.push(device);
    }
    for (const selectDevice of selectDevices) {
      if (!devices.find((d) => d.pluginName === selectDevice.pluginName && d.serial.includes(selectDevice.serial))) {
        // if(debug) console.log('HomeDevices mixing selectDevice:', storedDevice.pluginName, storedDevice.serial);
        mixed.push(selectDevice);
      }
    }
    setMixedDevices(mixed);
  }, [plugins, devices, selectDevices, setMixedDevices]);
  
  // Send API requests when online
  useEffect(() => {
    if (online) {
      if(debug) console.log('HomeDevices sending api requests');
      sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
      // sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
    }
  }, [online, sendMessage]);

  const handleDialogDevicesToggle = () => {
    setDialogDevicesOpen(!dialogDevicesOpen);
  };

  const handleDevicesColumnVisibilityChange = (accessor) => {
    setDevicesColumnVisibility((prev) => {
      const newVisibility = {
        ...prev,
        [accessor]: !prev[accessor],
      };
      localStorage.setItem('homeDevicesColumnVisibility', JSON.stringify(newVisibility));
      if(debug) console.log(`HomeDevices effect: saved column visibility to localStorage`);
      return newVisibility;
    });
  };

  const handleCheckboxChange = (event, device) => {
    if(debug) console.log(`handleCheckboxChange: checkbox changed to ${event.target.checked} for device ${device.name} serial ${device.serial}`);
    setMixedDevices((prevDevices) =>
      prevDevices.map((d) =>
        d.serial === device.serial ? { ...d, selected: event.target.checked } : d
      )
    );
    if(event.target.checked ) {
      sendMessage({ method: "/api/command", src: "Frontend", dst: "Matterbridge", params: { command: 'selectdevice', plugin: device.pluginName, serial: device.serial } });
    } else {
      sendMessage({ method: "/api/command", src: "Frontend", dst: "Matterbridge", params: { command: 'unselectdevice', plugin: device.pluginName, serial: device.serial } });
    }
  };

  useEffect(() => {
    const storedVisibility = localStorage.getItem('homeDevicesColumnVisibility');
    if (storedVisibility) {
      setDevicesColumnVisibility(JSON.parse(storedVisibility));
      if(debug) console.log(`HomeDevices effect: loaded column visibility from localStorage`);
    }
  }, []);

  if(debug) console.log('HomeDevices rendering...');
  if (!online) {
    return ( <Connecting /> );
  }
  return (
      <div className="MbfWindowDiv" style={{ margin: '0', padding: '0', gap: '0', width: '100%', flex: '1 1 auto', overflow: 'hidden' }}>

        {/* HomeDevices Configure Columns Dialog */}
        <Dialog open={dialogDevicesOpen} onClose={handleDialogDevicesToggle}>
          <DialogTitle>Configure Devices Columns</DialogTitle>
          <DialogContent>
            <FormGroup>
              {devicesColumns.map((column) => (
                <FormControlLabel
                  key={column.accessor}
                  control={
                    <Checkbox
                      disabled={['name', 'actions'].includes(column.accessor)}
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

        <div className="MbfWindowHeader">
          <div className="MbfWindowHeaderText" style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
            <p style={{margin: '0px', padding: '0px'}}>Devices</p>
            <IconButton onClick={handleDialogDevicesToggle} aria-label="Configure Columns" style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}}>
              <Tooltip title="Configure columns">
                <SettingsIcon style={{ color: 'var(--header-text-color)', fontSize: '19px' }}/>
              </Tooltip>
            </IconButton>
          </div>
        </div>
        <div className="MbfWindowBodyColumn" style={{margin: '0px', padding: '0px', gap: '0', overflow: 'auto'}} >
          <HomeDevicesTable data={mixedDevices} columns={devicesColumns} columnVisibility={devicesColumnVisibility}/>
        </div>
      </div>

  );
}
