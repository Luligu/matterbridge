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
import Favorite from '@mui/icons-material/Favorite';
import Help from '@mui/icons-material/Help';
import Announcement from '@mui/icons-material/Announcement';
import PublishedWithChanges from '@mui/icons-material/PublishedWithChanges';
import Unpublished from '@mui/icons-material/Unpublished';
import DeleteForever from '@mui/icons-material/DeleteForever';
import QrCode2 from '@mui/icons-material/QrCode2';
import Settings from '@mui/icons-material/Settings';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { UiContext } from './UiProvider';
import { Connecting } from './Connecting';
import { StatusIndicator } from './StatusIndicator';
import { sendCommandToMatterbridge } from './sendApiCommand';
import { ConfigPluginDialog } from './ConfigPluginDialog';
import { debug } from '../App';
// const debug = true;

export let selectDevices = [];
export let selectEntities = [];

function HomePluginsTable({ data, columns, columnVisibility }) {
  // Filter columns based on visibility
  const visibleColumns = React.useMemo(
    () => columns.filter(column => columnVisibility[column.accessor]),
    [columns, columnVisibility]
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
              <th {...column.getHeaderProps(undefined)} style={{ border: 'none', borderCollapse: 'collapse', cursor: column.noSort ? 'default' : 'pointer', }}>
                {column.render('Header')}
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

export function HomePlugins({selectPlugin}) {
  const { online, logMessage, sendMessage, addListener, removeListener } = useContext(WebSocketContext);
  const { _showSnackbarMessage, showConfirmCancelDialog } = useContext(UiContext);
  const [_systemInfo, setSystemInfo] = useState(null);
  const [matterbridgeInfo, setMatterbridgeInfo] = useState(null);
  const [plugins, setPlugins] = useState([]);
  const [dialogPluginsColumnsOpen, setDialogPluginsColumnsOpen] = useState(false);
  const [pluginsColumnVisibility, setPluginsColumnVisibility] = useState({
    name: true,
    description: true,
    version: true,
    author: true,
    type: true,
    addedDevices: true,
    actions: true,
    status: true,
  });
  const pluginsColumns = [
    {
      Header: 'Name',
      accessor: 'name',
    },
    {
      Header: 'Description',
      accessor: 'description',
    },
    {
      Header: 'Version',
      accessor: 'version',
      Cell: ({ row: plugin }) => (
        <>
          {plugin.original.latestVersion === undefined || plugin.original.latestVersion === plugin.original.version || (matterbridgeInfo && matterbridgeInfo.readOnly) ?
            <Tooltip title="Plugin version">{plugin.original.version}</Tooltip> :
            <Tooltip title="New plugin version available, click to install"><span className="status-warning" onClick={() => handleUpdatePlugin(plugin.original)}>Update v.{plugin.original.version} to v.{plugin.original.latestVersion}</span></Tooltip>
          }
        </>
      ),
    },
    {
      Header: 'Author',
      accessor: 'author',
      Cell: ({ row: plugin }) => (
        <>{plugin.original.author ? plugin.original.author.replace('https://github.com/', '') : 'Unknown'}</>
      ),
    },
    {
      Header: 'Type',
      accessor: 'type',
      Cell: ({ row: plugin }) => (
        <>{plugin.original.type ? plugin.original.type.replace('Platform', '') : 'Unknown'}</>
      ),
    },
    {
      Header: 'Devices',
      accessor: 'addedDevices',
    },
    {
      Header: 'Actions',
      accessor: 'actions',
      Cell: ({ row: plugin }) => (
        <div style={{ margin: '0px', padding: '0px', gap: '4px', display: 'flex', flexDirection: 'row' }}>
          {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' && !plugin.original.error && plugin.original.enabled && 
            <Tooltip title="Shows the QRCode or the fabrics"><IconButton style={{ margin: '0', padding: '0' }} onClick={() => selectPlugin(plugin.original)} size="small"><QrCode2/></IconButton></Tooltip>
          }
          <Tooltip title="Plugin config"><IconButton style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}} onClick={() => handleConfigPlugin(plugin.original)} size="small"><Settings/></IconButton></Tooltip>
          {matterbridgeInfo && !matterbridgeInfo.readOnly &&
            <Tooltip title="Remove the plugin"><IconButton style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}} onClick={() => { handleActionWithConfirmCancel('Remove plugin', 'Are you sure? This will remove also all the devices and configuration in the controller.', 'remove', plugin.original); }} size="small"><DeleteForever/></IconButton></Tooltip>
          }
          {plugin.original.enabled ? <Tooltip title="Disable the plugin"><IconButton style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}} onClick={() => { handleActionWithConfirmCancel('Disable plugin', 'Are you sure? This will remove also all the devices and configuration in the controller.', 'disable', plugin.original); }} size="small"><Unpublished/></IconButton></Tooltip> : <></>}
          {!plugin.original.enabled ? <Tooltip title="Enable the plugin"><IconButton style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}} onClick={() => handleEnableDisablePlugin(plugin.original)} size="small"><PublishedWithChanges/></IconButton></Tooltip> : <></>}
          <Tooltip title="Plugin help"><IconButton style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}} onClick={() => handleHelpPlugin(plugin.original)} size="small"><Help/></IconButton></Tooltip>
          <Tooltip title="Plugin version history"><IconButton style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}} onClick={() => handleChangelogPlugin(plugin.original)} size="small"><Announcement/></IconButton></Tooltip>
          {matterbridgeInfo && !matterbridgeInfo.readOnly &&
            <Tooltip title="Sponsor the plugin"><IconButton style={{ margin: '0', padding: '0', width: '19px', height: '19px', color: '#b6409c' }} onClick={() => handleSponsorPlugin(plugin.original)} size="small"><Favorite/></IconButton></Tooltip>
          }
        </div>
      ),
    },
    {
      Header: 'Status',
      accessor: 'status',
      Cell: ({ row: plugin }) => (
        <div style={{ display: 'flex', flexDirection: 'row', flex: '1 1 auto', gap: '5px' }}>
  
          {plugin.original.error ?
            <>
              <StatusIndicator status={false} enabledText='Error' disabledText='Error' tooltipText='The plugin is in error state. Check the log!' /></> :
            <>
              {plugin.original.enabled === false ?
                <>
                  <StatusIndicator status={plugin.original.enabled} enabledText='Enabled' disabledText='Disabled' tooltipText='Whether the plugin is enable or disabled' /></> :
                <>
                  {plugin.original.loaded && plugin.original.started && plugin.original.configured && plugin.original.paired ?
                    <>
                      <StatusIndicator status={plugin.original.loaded} enabledText='Running' tooltipText='Whether the plugin is running' /></> :
                    <>
                      {plugin.original.loaded && plugin.original.started && plugin.original.configured ?
                        <>
                          <StatusIndicator status={plugin.original.loaded} enabledText='Running' tooltipText='Whether the plugin is running' /></> :
                        <>
                          <StatusIndicator status={plugin.original.enabled} enabledText='Enabled' disabledText='Disabled' tooltipText='Whether the plugin is enable or disabled' />
                          <StatusIndicator status={plugin.original.loaded} enabledText='Loaded' tooltipText='Whether the plugin has been loaded' />
                          <StatusIndicator status={plugin.original.started} enabledText='Started' tooltipText='Whether the plugin started' />
                          <StatusIndicator status={plugin.original.configured} enabledText='Configured' tooltipText='Whether the plugin has been configured' />
                          {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' ? <StatusIndicator status={plugin.original.paired} enabledText='Paired' tooltipText='Whether the plugin has been paired' /> : <></>}
                        </>
                      }
                    </>
                  }
                </>
              }
            </>
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
          if(debug) console.log('HomePlugins received refresh_required');
          sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (msg.method === '/api/settings') {
          if (debug) console.log('HomePlugins received settings:', msg.response);
          setSystemInfo(msg.response.systemInformation);
          setMatterbridgeInfo(msg.response.matterbridgeInformation);
        }
        if (msg.method === '/api/plugins') {
          if(debug) console.log(`HomePlugins received ${msg.response.length} plugins:`, msg.response);
          setPlugins(msg.response);
        }
        if (msg.method === '/api/select/devices') {
          if (msg.response) {
            if (debug) console.log('Home received /api/select/devices:', msg.response);
            selectDevices = msg.response;
          }
          if (msg.error) {
            console.error('Home received /api/select/devices error:', msg.error);
          }
        }
        if (msg.method === '/api/select/entities') {
          if (msg.response) {
            if (debug) console.log('Home received /api/select/entities:', msg.response);
            selectEntities = msg.response;
          }
          if (msg.error) {
            console.error('Home received /api/select/entities error:', msg.error);
          }
        }
      }
    };

    addListener(handleWebSocketMessage);
    if(debug) console.log('HomePlugins added WebSocket listener');

    return () => {
      removeListener(handleWebSocketMessage);
      if(debug) console.log('HomePlugins removed WebSocket listener');
    };
  }, [addListener, removeListener, sendMessage]);
  
  // Send API requests when online
  useEffect(() => {
    if (online) {
      if(debug) console.log('HomePlugins sending api requests');
      sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
    }
  }, [online, sendMessage]);

  // Load column visibility from local storage
  useEffect(() => {
    const storedVisibility = localStorage.getItem('homePluginsColumnVisibility');
    if (storedVisibility) {
      setPluginsColumnVisibility(JSON.parse(storedVisibility));
    }
  }, []);

  // Toggle configure columns dialog
  const handleDialogPluginsColumnsToggle = () => {
    setDialogPluginsColumnsOpen(!dialogPluginsColumnsOpen);
  };

  const handlePluginsColumnVisibilityChange = (accessor) => {
    setPluginsColumnVisibility((prev) => {
      const newVisibility = {
        ...prev,
        [accessor]: !prev[accessor],
      };
      localStorage.setItem('homePluginsColumnVisibility', JSON.stringify(newVisibility));
      return newVisibility;
    });
  };

  const confirmCancelPluginRef = useRef(null);
  
  const handleActionWithConfirmCancel = (title, message, command, plugin) => {
    if (debug) console.log(`handleActionWithConfirmCancel ${command} ${plugin.name}`);
    confirmCancelPluginRef.current = plugin;
    showConfirmCancelDialog(title, message, command, handleConfirm, handleCancel);
  };

  const handleConfirm = (command) => {
    if (debug) console.log(`handleConfirm action confirmed ${command} ${confirmCancelPluginRef.current}`);
    if (command === 'remove' && confirmCancelPluginRef.current) {
      handleRemovePlugin(confirmCancelPluginRef.current);
    } else if (command === 'disable' && confirmCancelPluginRef.current) {
      handleEnableDisablePlugin(confirmCancelPluginRef.current);
    }
    confirmCancelPluginRef.current = null;
  };

  const handleCancel = (command) => {
    if (debug) console.log(`handleCancel action canceled ${command} ${confirmCancelPluginRef.current}`);
    confirmCancelPluginRef.current = null;
  };

  const handleUpdatePlugin = (plugin) => {
    if (debug) console.log('handleUpdatePlugin plugin:', plugin.name);
    logMessage('Plugins', `Updating plugin: ${plugin.name}`);
    sendCommandToMatterbridge('installplugin', plugin.name);
  };

  const handleRemovePlugin = (plugin) => {
    if (debug) console.log('handleRemovePlugin plugin:', plugin.name);
    logMessage('Plugins', `Removing plugin: ${plugin.name}`);
    sendCommandToMatterbridge('removeplugin', plugin.name);
  };

  const handleEnableDisablePlugin = (plugin) => {
    if (debug) console.log('handleEnableDisablePlugin plugin:', plugin.name, 'enabled:', plugin.enabled);
    if (plugin.enabled === true) {
      plugin.enabled = false;
      logMessage('Plugins', `Disabling plugin: ${plugin.name}`);
      sendCommandToMatterbridge('disableplugin', plugin.name);
    }
    else {
      plugin.enabled = true;
      logMessage('Plugins', `Enabling plugin: ${plugin.name}`);
      sendCommandToMatterbridge('enableplugin', plugin.name);
    }
  };

  const handleSponsorPlugin = (plugin) => {
    if (debug) console.log('handleSponsorPlugin plugin:', plugin.name);
    window.open('https://www.buymeacoffee.com/luligugithub', '_blank');
  };

  const handleHelpPlugin = (plugin) => {
    if (debug) console.log('handleHelpPlugin plugin:', plugin.name);
    window.open(`https://github.com/Luligu/${plugin.name}/blob/main/README.md`, '_blank');
  };

  const handleChangelogPlugin = (plugin) => {
    if (debug) console.log('handleChangelogPlugin plugin:', plugin.name);
    window.open(`https://github.com/Luligu/${plugin.name}/blob/main/CHANGELOG.md`, '_blank');
  };
  
  // ConfigPluginDialog
  const [selectedPlugin, setSelectedPlugin] = useState({});
  const [openConfigPluginDialog, setOpenConfigPluginDialog] = useState(false);

  const handleConfigPlugin = (plugin) => {
    if (debug) console.log('handleConfigPlugin plugin:', plugin.name);
    sendMessage({ method: "/api/select/devices", src: "Frontend", dst: "Matterbridge", params: { plugin: plugin.name } });
    sendMessage({ method: "/api/select/entities", src: "Frontend", dst: "Matterbridge", params: { plugin: plugin.name } });
    setSelectedPlugin(plugin);
    handleOpenConfig();
  };

  const handleOpenConfig = () => {
    setOpenConfigPluginDialog(true);
  };

  const handleCloseConfig = () => {
    setOpenConfigPluginDialog(false);
  };

  if(debug) console.log('HomePlugins rendering...');
  if (!online) {
    return ( <Connecting /> );
  }
  return (
      <div className="MbfWindowDiv" style={{ margin: '0', padding: '0', gap: '0', width: '100%', flex: '0 0 auto', overflow: 'hidden' }}>

        {/* Config plugin dialog */}
        <ConfigPluginDialog open={openConfigPluginDialog} onClose={handleCloseConfig} plugin={selectedPlugin}/>

        {/* HomePlugins Configure Columns Dialog */}
        <Dialog open={dialogPluginsColumnsOpen} onClose={handleDialogPluginsColumnsToggle}>
          <DialogTitle>Configure Plugins Columns</DialogTitle>
          <DialogContent>
            <FormGroup>
              {pluginsColumns.map((column) => (
                <FormControlLabel
                  key={column.accessor}
                  control={
                    <Checkbox
                      disabled={['description', 'actions', 'status'].includes(column.accessor)}
                      checked={pluginsColumnVisibility[column.accessor]}
                      onChange={() => handlePluginsColumnVisibilityChange(column.accessor)}
                    />
                  }
                  label={column.Header}
                />
              ))}
            </FormGroup>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogPluginsColumnsToggle}>Close</Button>
          </DialogActions>
        </Dialog>

        <div className="MbfWindowHeader">
          <div className="MbfWindowHeaderText" style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
            <p style={{margin: '0px', padding: '0px'}}>Plugins</p>
            <IconButton onClick={handleDialogPluginsColumnsToggle} aria-label="Configure Columns" style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}}>
              <Tooltip title="Configure columns">
                <SettingsIcon style={{ color: 'var(--header-text-color)', fontSize: '19px' }}/>
              </Tooltip>
            </IconButton>
          </div>
        </div>
        <div className="MbfWindowBodyColumn" style={{margin: '0px', padding: '0px', gap: '0', overflow: 'auto'}} >
          <HomePluginsTable data={plugins} columns={pluginsColumns} columnVisibility={pluginsColumnVisibility}/>
        </div>
      </div>

  );
}
