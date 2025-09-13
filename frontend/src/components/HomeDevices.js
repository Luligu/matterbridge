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

// @mui/icons-material
import SettingsIcon from '@mui/icons-material/Settings';
import Battery4BarIcon from '@mui/icons-material/Battery4Bar';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import QrCode2 from '@mui/icons-material/QrCode2';

// @mdi/js
import Icon from '@mdi/react';
import { mdiSortAscending, mdiSortDescending } from '@mdi/js';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import { debug } from '../App';
import { QRDivDevice } from './QRDivDevice';
// const debug = true;


export function HomeDevicesTable({ data, columns, columnVisibility }) {
  // Load saved sort state from localStorage
  const initialSortBy = React.useMemo(() => {
    const saved = localStorage.getItem('homeDevicesColumnsSortBy');
    // if(debug) console.log(`HomeDevicesTable retrieved sortBy: ${JSON.stringify(JSON.parse(saved), null, 2)}`);
    return saved ? JSON.parse(saved) : [{id: 'name', desc: false}];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]);

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
    state: { sortBy },
  } = useTable({ columns: visibleColumns, data, initialState: { sortBy: initialSortBy }, }, useSortBy);

  // Persist sort state whenever it changes
  React.useEffect(() => {
    // if(debug) console.log(`HomeDevicesTable saved sortBy: ${JSON.stringify(sortBy, null, 2)}`);
    localStorage.setItem('homeDevicesColumnsSortBy', JSON.stringify(sortBy));
  }, [sortBy]);

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
  // Contexts
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);
  // States
  const [restart, setRestart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [_systemInfo, setSystemInfo] = useState(null);
  const [_matterbridgeInfo, setMatterbridgeInfo] = useState(null);
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
    powerSource: true,
    configUrl: false,
    actions: true,
  });
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrDialogData, setQrDialogData] = useState(null);
  // Refs
  const uniqueId = useRef(getUniqueId());

  const getQRColor = (matter) => {
    if (matter === undefined) return 'red';
    if (!matter.qrPairingCode && !matter.manualPairingCode && !matter.fabricInformations && !matter.sessionInformations) return 'red';
    if (matter.commissioned === false && matter.qrPairingCode && matter.manualPairingCode) return 'var(--primary-color)';

    var sessions = 0;
    var subscriptions = 0;
    for (const session of matter.sessionInformations ?? []) {
      if (session.fabric && session.isPeerActive === true) sessions++;
      if (session.numberOfActiveSubscriptions > 0) subscriptions += session.numberOfActiveSubscriptions;
    }
    if (matter.commissioned === true && matter.fabricInformations && matter.sessionInformations && (sessions === 0 || subscriptions === 0)) return 'var(--secondary-color)';
    return 'var(--div-text-color)';
  };

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
      Header: 'Power',
      accessor: 'powerSource',
      Cell: ({ row }) => {
        if (row.original.powerSource === 'ac' || row.original.powerSource === 'dc') {
          return <ElectricalServicesIcon fontSize="small" sx={{ color: 'var(--primary-color)' }} />;
        } else if (row.original.powerSource === 'ok') {
          return <Battery4BarIcon fontSize="small" sx={{ color: 'green' }} />;
        } else if (row.original.powerSource === 'warning') {
          return <Battery4BarIcon fontSize="small" sx={{ color: 'yellow' }} />;
        } else if (row.original.powerSource === 'critical') {
          return <Battery4BarIcon fontSize="small" sx={{ color: 'red' }} />;
        } else return <span></span>;
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
          {row.original.matter!==undefined ?
            <Tooltip title="Show the QRCode or the fabrics" slotProps={{popper:{modifiers:[{name:'offset',options:{offset: [30, 15]}}]}}}>
              <IconButton
                onClick={() => handleOpenQrDialog(row.original.matter.id)}
                aria-label="Show the QRCode"
                sx={{ margin: 0, padding: 0, color: getQRColor(row.original.matter) }}
              >
                <QrCode2 fontSize="small"/>
              </IconButton>
            </Tooltip> 
          :
            <div style={{ width: '20px', height: '20px' }}></div>
          }
          {row.original.configUrl ?
            <Tooltip title="Open the configuration page" slotProps={{popper:{modifiers:[{name:'offset',options:{offset: [30, 15]}}]}}}>
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
            <Tooltip title="Select/unselect the device" slotProps={{popper:{modifiers:[{name:'offset',options:{offset: [30, 15]}}]}}}>
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
  
  const isSelected = React.useCallback((device) => {
    // if(debug) console.log(`HomeDevices isSelected: plugin ${device.pluginName} name ${device.name} serial ${device.serial}`);
    device.selected = undefined;
    const plugin = plugins.find((p) => p.name === device.pluginName);
    if(!plugin) {
      console.error(`HomeDevices isSelected: plugin ${device.pluginName} not found for device ${device.deviceName} `);
      return device.selected;
    }
    const selectMode = plugin.schemaJson?.properties?.whiteList?.selectFrom;
    let postfix = plugin.configJson?.postfix;
    if(postfix === '') postfix = undefined;
    if(plugin.hasWhiteList===true && plugin.hasBlackList===true && selectMode) {
      device.selected = true;
      if(selectMode==='serial' && plugin.configJson.whiteList && plugin.configJson.whiteList.length > 0 && plugin.configJson.whiteList.includes(postfix ? device.serial.replace('-'+postfix, '') : device.serial)) device.selected = true;
      if(selectMode==='serial' && plugin.configJson.whiteList && plugin.configJson.whiteList.length > 0 && !plugin.configJson.whiteList.includes(postfix ? device.serial.replace('-'+postfix, '') : device.serial)) device.selected = false;
      if(selectMode==='serial' && plugin.configJson.blackList && plugin.configJson.blackList.length > 0 && plugin.configJson.blackList.includes(postfix ? device.serial.replace('-'+postfix, '') : device.serial)) device.selected = false;
      if(selectMode==='name' && plugin.configJson.whiteList && plugin.configJson.whiteList.length > 0 && plugin.configJson.whiteList.includes(device.name)) device.selected = true;
      if(selectMode==='name' && plugin.configJson.whiteList && plugin.configJson.whiteList.length > 0 && !plugin.configJson.whiteList.includes(device.name)) device.selected = false;
      if(selectMode==='name' && plugin.configJson.blackList && plugin.configJson.blackList.length > 0 && plugin.configJson.blackList.includes(device.name)) device.selected = false;
    }
    // if(debug) console.log(`HomeDevices isSelected: plugin ${device.pluginName} selectMode ${selectMode} postfix ${postfix} name ${device.name} serial ${device.serial} select ${device.selected}`);
    return device.selected;
  }, [plugins]);

  // WebSocket message handler effect
  useEffect(() => {
    const handleWebSocketMessage = (msg) => {
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        // Broadcast messages
        if (msg.method === 'refresh_required' && msg.params.changed !== 'commissioning' && msg.params.changed !== 'pluginsRestart' && msg.params.changed !== 'sessions' && msg.params.changed !== 'matterbridgeLatestVersion' && msg.params.changed !== 'reachability') {
          if (debug) console.log(`HomeDevices received refresh_required: changed=${msg.params.changed}`);
          sendMessage({ id: uniqueId.current, sender: 'HomeDevices', method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (msg.method === 'restart_required') {
          if(debug) console.log('HomeDevices received restart_required');
          setRestart(true);
        }
        if (msg.method === 'restart_not_required') {
          if(debug) console.log('HomeDevices received restart_not_required');
          setRestart(false);
        }
        if (msg.method === 'state_update') {
          if (msg.params.plugin && msg.params.serialNumber && msg.params.cluster.includes('BasicInformationServer') && msg.params.attribute === 'reachable') {
            if(debug) console.log(`HomeDevices updating device reachability for plugin ${msg.params.plugin} serial ${msg.params.serialNumber} value ${msg.params.value}`);
            setDevices((prevDevices) =>
              prevDevices.map((d) =>
                d.pluginName === msg.params.plugin && d.serial === msg.params.serialNumber
                  ? { ...d, reachable: msg.params.value }
                  : d
              )
            );
          }
        }
        // Local messages
        if (msg.id === uniqueId.current && msg.method === '/api/settings') {
          if (debug) console.log(`HomeDevices (id: ${msg.id}) received settings:`, msg.response);
          setSystemInfo(msg.response.systemInformation);
          setMatterbridgeInfo(msg.response.matterbridgeInformation);
          setRestart(msg.response.matterbridgeInformation.restartRequired); // Set the restart state based on the response. Used in the footer.
        }
        if (msg.id === uniqueId.current && msg.method === '/api/plugins') {
          if(debug) console.log(`HomeDevices (id: ${msg.id}) received ${msg.response?.length} plugins:`, msg.response);
          if(msg.response) {

            let running = true;
            for (const plugin of msg.response) {
              if(plugin.enabled!==true) continue;
              if(plugin.loaded!==true || plugin.started!==true /* || plugin.configured!==true */ || plugin.error===true) {
                running = false;
              }
            }
            if(!running) return;

            if(debug) console.log(`HomeDevices reset plugins, devices and selectDevices`);
            setLoading(false); // Set loading to false only when all plugins are loaded. Used in the footer.
            setPlugins(msg.response);
            setDevices([]);
            setSelectDevices([]);

            sendMessage({ id: uniqueId.current, sender: 'HomeDevices', method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
            if(debug) console.log(`HomeDevices sent /api/devices`);

            for (const plugin of msg.response) {
              if(plugin.enabled===true && plugin.loaded===true && plugin.started===true /* && plugin.configured===true */ && plugin.error!==true) {
                sendMessage({ id: uniqueId.current, sender: 'HomeDevices', method: "/api/select/devices", src: "Frontend", dst: "Matterbridge", params: { plugin: plugin.name} });
                if(debug) console.log(`HomeDevices sent /api/select/devices for plugin: ${plugin.name}`);
              } 
            }
          }
        }
        if (msg.id === uniqueId.current && msg.method === '/api/devices') {
          if(debug) console.log(`HomeDevices (id: ${msg.id}) received ${msg.response?.length} devices:`, msg.response);
          if(msg.response) {
            for (const device of msg.response) {
              device.selected = isSelected(device);
            }
            setDevices(msg.response);
          }
        }
        if (msg.id === uniqueId.current && msg.method === '/api/select/devices') {
          if(debug) console.log(`HomeDevices (id: ${msg.id}) received ${msg.response?.length} selectDevices for plugin ${msg.plugin}:`, msg.response);
          if(msg.response) {
            setSelectDevices((prevSelectDevices) => {
              // Filter out devices not from the current plugin
              const filteredDevices = prevSelectDevices.filter(device => device.pluginName !== msg.plugin);
              // Add the new devices from the current plugin
              const updatedDevices = msg.response.map(device => ({ ...device, selected: isSelected(device) }));
              return [...filteredDevices, ...updatedDevices];
            });
          }
        }
      }
    };

    addListener(handleWebSocketMessage);
    if (debug) console.log(`HomeDevices added WebSocket listener id ${uniqueId.current}`);

    return () => {
      removeListener(handleWebSocketMessage);
      if(debug) console.log('HomeDevices removed WebSocket listener');
    };
  }, [plugins, addListener, removeListener, sendMessage, isSelected]);
  
  // Mix devices and selectDevices
  useEffect(() => {
    if(debug) console.log(`HomeDevices mixing devices (${devices.length}) and selectDevices (${selectDevices.length})`);
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
    if(debug) console.log(`HomeDevices mixed ${mixed.length} devices and selectDevices`);
  }, [plugins, devices, selectDevices, setMixedDevices]);
  
  // Send API requests when online
  useEffect(() => {
    if (online) {
      if(debug) console.log('HomeDevices sending /api/settings and /api/plugins requests');
      sendMessage({ id: uniqueId.current, sender: 'HomeDevices', method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ id: uniqueId.current, sender: 'HomeDevices', method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
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
      if(debug) console.log(`HomeDevices saved column visibility to localStorage`);
      return newVisibility;
    });
  };

  const handleOpenQrDialog = (data) => {
    setQrDialogData(data);
    setQrDialogOpen(true);
  };

  const handleCloseQrDialog = () => {
    setQrDialogOpen(false);
    setQrDialogData(null);
  };

  const handleCheckboxChange = (event, device) => {
    if(debug) console.log(`handleCheckboxChange: checkbox changed to ${event.target.checked} for device ${device.name} serial ${device.serial}`);
    setMixedDevices((prevDevices) =>
      prevDevices.map((d) =>
        d.serial === device.serial ? { ...d, selected: event.target.checked } : d
      )
    );
    if(event.target.checked ) {
      sendMessage({ id: uniqueId.current, sender: 'HomeDevices', method: "/api/command", src: "Frontend", dst: "Matterbridge", params: { command: 'selectdevice', plugin: device.pluginName, serial: device.serial, name: device.name } });
    } else {
      sendMessage({ id: uniqueId.current, sender: 'HomeDevices', method: "/api/command", src: "Frontend", dst: "Matterbridge", params: { command: 'unselectdevice', plugin: device.pluginName, serial: device.serial, name: device.name } });
    }
  };

  useEffect(() => {
    const storedVisibility = localStorage.getItem('homeDevicesColumnVisibility');
    if (storedVisibility) {
      const visibility = JSON.parse(storedVisibility);
      if(visibility.powerSource === undefined) visibility['powerSource'] = true; // Fix for old versions
      setDevicesColumnVisibility(visibility);
      if(debug) console.log(`HomeDevices loaded column visibility from localStorage`);
    }
  }, []);

  if(debug) console.log('HomeDevices rendering...');
  if (!online) {
    return ( <Connecting /> );
  }
  return (
      <div className="MbfWindowDiv" style={{ margin: '0', padding: '0', gap: '0', width: '100%', flex: '1 1 auto', overflow: 'hidden' }}>

        {/* QR Code Dialog */}
        <QRDivDevice id={qrDialogData} open={qrDialogOpen} onClose={handleCloseQrDialog} />
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
        <div className="MbfWindowFooter" style={{margin: '0', padding: '0px', paddingLeft: '10px', paddingRight: '10px', borderTop: '1px solid var(--table-border-color)', display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
            {loading && <p className="MbfWindowFooterText" style={{margin: '0', padding: '2px', fontWeight: 'normal', fontSize: '14px', color:'var(--secondary-color)'}}>Waiting for the plugins to fully load...</p>}  
            {!loading && <p className="MbfWindowFooterText" style={{margin: '0', padding: '5px', fontWeight: 'normal', fontSize: '14px', color: 'var(--secondary-color)'}}>Registered devices: {devices.length.toString()}</p>}
            {restart && <p className="MbfWindowFooterText" style={{margin: '0', padding: '2px', fontWeight: 'normal', fontSize: '14px', color:'var(--secondary-color)'}}>Restart required</p>}  
        </div>
      </div>

  );
}
