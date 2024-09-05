/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
// Home.js
import React, { useEffect, useState, useRef, useContext } from 'react';
import { StatusIndicator } from './StatusIndicator';
import { sendCommandToMatterbridge } from '../App';
import WebSocketComponent from './WebSocketComponent';
import { WebSocketContext } from './WebSocketContext';
import Connecting from './Connecting';
import { OnlineContext } from './OnlineContext';
import { SystemInfoTable } from './SystemInfoTable';
import { MatterbridgeInfoTable } from './MatterbridgeInfoTable';
import { ConfirmCancelForm } from './ConfirmCancelForm';

// @mui
import { Dialog, DialogTitle, DialogContent, TextField, Alert, Snackbar, Tooltip, IconButton, Button, createTheme, ThemeProvider, Select, MenuItem, Menu } from '@mui/material';
import { DeleteForever, Download, Add, Unpublished, PublishedWithChanges, Settings, Favorite, Help, Announcement, QrCode2, MoreVert } from '@mui/icons-material';

// @rjsf
import Form from '@rjsf/mui';
import validator from '@rjsf/validator-ajv8';

import QRCode from 'qrcode.react';

const theme = createTheme({
  components: {
    MuiTooltip: {
      defaultProps: {
        placement: 'top-start', 
        arrow: true,
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          backgroundColor: '#4CAF50', 
        },
      },
      defaultProps: {
        color: 'primary',
        variant: 'contained',
        size: 'small',
      },
    },
  },
  palette: {
    primary: {
      main: '#4CAF50',
    },
  },
});

function Home() {
  const [wssHost, setWssHost] = useState(null);
  const [qrCode, setQrCode] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [systemInfo, setSystemInfo] = useState({});
  const [matterbridgeInfo, setMatterbridgeInfo] = useState({});
  const [plugins, setPlugins] = useState([]);
  const [selectedRow, setSelectedRow] = useState(-1); // -1 no selection, 0 or greater for selected row
  const [selectedPluginName, setSelectedPluginName] = useState('none'); // -1 no selection, 0 or greater for selected row
  const [selectedPluginConfig, setSelectedPluginConfig] = useState({}); 
  const [selectedPluginSchema, setSelectedPluginSchema] = useState({}); 
  const [openSnack, setOpenSnack] = useState(false);
  const [openConfig, setOpenConfig] = useState(false);
  const [logFilterLevel, setLogFilterLevel] = useState(localStorage.getItem('logFilterLevel')??'info');
  const [logFilterSearch, setLogFilterSearch] = useState(localStorage.getItem('logFilterSearch')??'*');

  const { messages, sendMessage, logMessage, setLogFilters } = useContext(WebSocketContext);
  const { online, setOnline } = useContext(OnlineContext);

  const refAddRemove = useRef(null);
  const refRegisteredPlugins = useRef(null);

  const handleSnackOpen = () => {
    setOpenSnack(true);
  };

  const handleSnackClose = (event, reason) => {
    if (reason === 'clickaway') return;
    setOpenSnack(false);
  };

  const handleOpenConfig = () => {
    setOpenConfig(true);
  };

  const handleCloseConfig = () => {
    setOpenConfig(false);
    handleSnackOpen();
    setTimeout(() => {
      reloadSettings();
    }, 1000);
  };


  const columns = React.useMemo( () => [
      { Header: 'Name', accessor: 'name' },
      { Header: 'Description', accessor: 'description' },
      { Header: 'Version', accessor: 'version' },
      { Header: 'Author', accessor: 'author' },
      { Header: 'Type', accessor: 'type' },
      { Header: 'Devices', accessor: 'devices'},
      { Header: 'Tools', accessor: 'qrcode' },
      { Header: 'Status', accessor: 'status'},
    ],
    []
  );

  const fetchSettings = () => {
    console.log('From home fetchSettings');

    fetch('/api/settings')
      .then(response => response.json())
      .then(data => { 
        console.log('From home /api/settings:', data); 
        setWssHost(data.wssHost); 
        if(data.matterbridgeInformation.bridgeMode==='bridge') {
          setQrCode(data.matterbridgeInformation.matterbridgeQrPairingCode); 
          setPairingCode(data.matterbridgeInformation.matterbridgeManualPairingCode);
        }
        setSystemInfo(data.systemInformation);
        setMatterbridgeInfo(data.matterbridgeInformation);
      })
      .catch(error => console.error('Error fetching settings:', error));

    fetch('/api/plugins')
      .then(response => response.json())
      .then(data => { 
        console.log('From home /api/plugins:', data)
        setPlugins(data); 
      })
      .catch(error => console.error('Error fetching plugins:', error));
  };  

  useEffect(() => {
    // Call fetchSettings immediately and then every 1 minute
    fetchSettings();
    const intervalId = setInterval(fetchSettings, 1 * 60 * 1000);
  
    // Clear the interval when the component is unmounted
    return () => clearInterval(intervalId);

  }, []); // The empty array causes this effect to run only once

  // Function to reload settings on demand
  const reloadSettings = () => {
    fetchSettings();
    console.log('reloadSettings');
  };

  const handleSelectQRCode = (row) => {
    if (selectedRow === row) {
      setSelectedRow(-1);
      setSelectedPluginName('none');
      setQrCode('');
      setPairingCode('');
    } else {
      reloadSettings();
      setSelectedRow(row);
      setSelectedPluginName(plugins[row].name);
      setQrCode(plugins[row].qrPairingCode);
      setPairingCode(plugins[row].manualPairingCode);
    }
    // console.log('Selected row:', row, 'plugin:', plugins[row].name, 'qrcode:', plugins[row].qrPairingCode);
  };

  const handleEnableDisablePlugin = (row) => {
    console.log('Selected row:', row, 'plugin:', plugins[row].name, 'enabled:', plugins[row].enabled);
    if(plugins[row].enabled===true) {
      plugins[row].enabled=false;
      logMessage('Plugins', `Disabling plugin: ${plugins[row].name}`);
      sendCommandToMatterbridge('disableplugin', plugins[row].name);
    }
    else {
      plugins[row].enabled=true;
      logMessage('Plugins', `Enabling plugin: ${plugins[row].name}`);
      sendCommandToMatterbridge('enableplugin', plugins[row].name);
    }
    if(matterbridgeInfo.bridgeMode === 'childbridge') {
      setTimeout(() => {
        reloadSettings();
      }, 500);
    }
    if(matterbridgeInfo.bridgeMode === 'bridge') {
      setTimeout(() => {
        reloadSettings();
      }, 500);
    }
  };

  const handleUpdatePlugin = (row) => {
    console.log('handleUpdate row:', row, 'plugin:', plugins[row].name);
    logMessage('Plugins', `Updating plugin: ${plugins[row].name}`);
    sendCommandToMatterbridge('installplugin', plugins[row].name);
    handleSnackOpen({ vertical: 'bottom', horizontal: 'right' });
    setTimeout(() => {
      handleSnackClose();
      reloadSettings();
    }, 5000);
  };

  const handleRemovePlugin = (row) => {
    console.log('handleRemovePluginClick row:', row, 'plugin:', plugins[row].name);
    logMessage('Plugins', `Removing plugin: ${plugins[row].name}`);
    sendCommandToMatterbridge('removeplugin', plugins[row].name);
    setTimeout(() => {
      reloadSettings();
    }, 500);
  };

  const handleConfigPlugin = (row) => {
    console.log('handleConfigPlugin row:', row, 'plugin:', plugins[row].name);
    setSelectedPluginConfig(plugins[row].configJson);
    setSelectedPluginSchema(plugins[row].schemaJson);
    handleOpenConfig();
  };

  const handleSponsorPlugin = (row) => {
    console.log('handleSponsorPlugin row:', row, 'plugin:', plugins[row].name);
    window.open('https://www.buymeacoffee.com/luligugithub', '_blank');
  };

  const handleHelpPlugin = (row) => {
    console.log('handleHelpPlugin row:', row, 'plugin:', plugins[row].name);
    window.open(`https://github.com/Luligu/${plugins[row].name}/blob/main/README.md`, '_blank');
  };

  const handleChangelogPlugin = (row) => {
    console.log('handleChangelogPlugin row:', row, 'plugin:', plugins[row].name);
    window.open(`https://github.com/Luligu/${plugins[row].name}/blob/main/CHANGELOG.md`, '_blank');
  };

  /*
                        {plugin.enabled ? <Tooltip title="Disable the plugin"><IconButton style={{padding: 0}} className="PluginsIconButton" onClick={() => { handleActionWithConfirmCancel('Disable the plugin', 'Are you sure? This will remove also all the devices and configuration in the controller.', 'disable', index); } } size="small"><Unpublished /></IconButton></Tooltip> : <></>}
                        <Tooltip title="Remove the plugin"><IconButton style={{padding: 0}} className="PluginsIconButton" onClick={() => { handleRemovePlugin(index); }} size="small"><DeleteForever /></IconButton></Tooltip>
  */
  const [showConfirmCancelForm, setShowConfirmCancelForm] = useState(false);
  const [confirmCancelFormTitle, setConfirmCancelFormTitle] = useState('');
  const [confirmCancelFormMessage, setConfirmCancelFormMessage] = useState('');
  const [confirmCancelFormCommand, setConfirmCancelFormCommand] = useState('');
  const [confirmCancelFormRow, setConfirmCancelFormRow] = useState(-1);

  const handleActionWithConfirmCancel = (title, message, command, index) => {
    setConfirmCancelFormTitle(title);
    setConfirmCancelFormMessage(message);
    setConfirmCancelFormCommand(command);
    setConfirmCancelFormRow(index);
    setShowConfirmCancelForm(true);
  };
  const handleConfirm = () => {
    console.log(`Action confirmed ${confirmCancelFormCommand} ${confirmCancelFormRow}`);
    setShowConfirmCancelForm(false);
    if(confirmCancelFormCommand === 'remove' && confirmCancelFormRow !== -1) {
      handleRemovePlugin(confirmCancelFormRow);
    } else if(confirmCancelFormCommand === 'disable' && confirmCancelFormRow !== -1) {
      handleEnableDisablePlugin(confirmCancelFormRow);
    }
  };
  const handleCancel = () => {
    console.log("Action canceled");
    setShowConfirmCancelForm(false);
  };

  if (!online) {
    return ( <Connecting /> );
  }
  return (
    <div className="MbfPageDiv" style={{ flexDirection: 'row' }}>

    <ThemeProvider theme={theme}>

      <Dialog  open={openConfig} onClose={handleCloseConfig} maxWidth='600px' PaperProps={{style: { border: "2px solid #ddd", backgroundColor: '#c4c2c2', boxShadow: '5px 5px 10px #888'}}}>
        <DialogTitle gap={'20px'}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
            <img src="matterbridge 64x64.png" alt="Matterbridge Logo" style={{ height: '64px', width: '64px' }} />
            <h3>Matterbridge plugin configuration</h3>
          </div>
        </DialogTitle>
        <DialogContent>
          <DialogConfigPlugin config={selectedPluginConfig} schema={selectedPluginSchema} handleCloseConfig={handleCloseConfig}/>
        </DialogContent>
      </Dialog>

      <ConfirmCancelForm open={showConfirmCancelForm} title={confirmCancelFormTitle} message={confirmCancelFormMessage} onConfirm={handleConfirm} onCancel={handleCancel} />

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '302px', minWidth: '302px', gap: '20px' }}>
        <QRDiv qrText={qrCode} pairingText={pairingCode} qrWidth={256} topText="QR pairing code" bottomText={selectedPluginName==='none'?'Matterbridge':selectedPluginName} matterbridgeInfo={matterbridgeInfo} plugin={selectedRow===-1?undefined:plugins[selectedRow]}/>
        {systemInfo && <SystemInfoTable systemInfo={systemInfo} compact={true}/>}
        {qrCode==='' && matterbridgeInfo && <MatterbridgeInfoTable matterbridgeInfo={matterbridgeInfo}/>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', gap: '20px' }}>

        <div className="MbfWindowDiv" style={{ flex: '0 0 auto', width: '100%', overflow: 'hidden' }}>
          <div className="MbfWindowHeader">
            <p className="MbfWindowHeaderText">Install add plugin</p>
          </div>
          <AddRemovePlugins ref={refAddRemove} plugins={plugins} reloadSettings={reloadSettings}/>
        </div>

        <div className="MbfWindowDiv" style={{ flex: '0 0 auto', width: '100%', overflow: 'hidden' }}>
          <div className="MbfWindowDivTable" style={{ flex: '0 0 auto', overflow: 'hidden' }}>
            <table ref={refRegisteredPlugins}>
              <thead>
                <tr>
                  <th colSpan="8">Registered plugins</th>
                </tr>
                <tr>
                  {columns.map((column, index) => (
                    <th key={index}>{column.Header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plugins.map((plugin, index) => (

                  <tr key={index} className={selectedRow === index ? 'table-content-selected' : index % 2 === 0 ? 'table-content-even' : 'table-content-odd'}>

                    <td><Tooltip title={plugin.path}>{plugin.name}</Tooltip></td>
                    <td>{plugin.description}</td>

                    {plugin.latestVersion === undefined || plugin.latestVersion === plugin.version ?
                      <td><Tooltip title="Plugin version">{plugin.version}</Tooltip></td> :
                      <td><Tooltip title="New plugin version available, click to install"><span className="status-warning" onClick={() => handleUpdatePlugin(index)}>Update v.{plugin.version} to v.{plugin.latestVersion}</span></Tooltip></td>
                    }
                    <td>{plugin.author.replace('https://github.com/', '')}</td>

                    <td>{plugin.type === 'DynamicPlatform'?'Dynamic':'Accessory'}</td>
                    <td>{plugin.registeredDevices}</td>
                    <td>  
                      <>
                        {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' && !plugin.error && plugin.enabled ? <Tooltip title="Shows the QRCode or the fabrics"><IconButton style={{padding: 0}} className="PluginsIconButton" onClick={() => handleSelectQRCode(index)} size="small"><QrCode2 /></IconButton></Tooltip> : <></>}
                        <Tooltip title="Plugin config"><IconButton style={{padding: 0}} className="PluginsIconButton" onClick={() => handleConfigPlugin(index)} size="small"><Settings /></IconButton></Tooltip>
                        <Tooltip title="Remove the plugin"><IconButton style={{padding: 0}} className="PluginsIconButton" onClick={() => { handleActionWithConfirmCancel('Remove plugin', 'Are you sure? This will remove also all the devices and configuration in the controller.', 'remove', index); {/* handleRemovePlugin(index);*/} } } size="small"><DeleteForever /></IconButton></Tooltip>
                        {plugin.enabled ? <Tooltip title="Disable the plugin"><IconButton style={{padding: 0}} className="PluginsIconButton" onClick={() => { handleActionWithConfirmCancel('Disable plugin', 'Are you sure? This will remove also all the devices and configuration in the controller.', 'disable', index); {/* handleEnableDisablePlugin(index);*/}} } size="small"><Unpublished /></IconButton></Tooltip> : <></>}
                        {!plugin.enabled ? <Tooltip title="Enable the plugin"><IconButton style={{padding: 0}} className="PluginsIconButton" onClick={() => handleEnableDisablePlugin(index) } size="small"><PublishedWithChanges /></IconButton></Tooltip> : <></>}
                        <Tooltip title="Plugin help"><IconButton style={{padding: 0}} className="PluginsIconButton" onClick={() => handleHelpPlugin(index)} size="small"><Help /></IconButton></Tooltip>
                        <Tooltip title="Plugin version history"><IconButton style={{padding: 0}} className="PluginsIconButton" onClick={() => handleChangelogPlugin(index)} size="small"><Announcement /></IconButton></Tooltip>
                        <Tooltip title="Sponsor the plugin"><IconButton style={{padding: 0, color: '#b6409c'}} className="PluginsIconButton" onClick={() => handleSponsorPlugin(index)} size="small"><Favorite /></IconButton></Tooltip>
                      </>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'row', flex: '1 1 auto', gap: '5px' }}>

                        <Snackbar anchorOrigin={{vertical: 'bottom', horizontal: 'right'}} open={openSnack} onClose={handleSnackClose} autoHideDuration={10000}>
                          <Alert onClose={handleSnackClose} severity="info" variant="filled" sx={{ width: '100%', bgcolor: '#4CAF50' }}>Restart needed!</Alert>
                        </Snackbar>
                        {plugin.error ? 
                          <>
                            <StatusIndicator status={false} enabledText='Error' disabledText='Error' tooltipText='The plugin is in error state. Check the log!'/></> :
                          <>
                            {plugin.enabled === false ?
                              <>
                                <StatusIndicator status={plugin.enabled} enabledText='Enabled' disabledText='Disabled' tooltipText='Whether the plugin is enable or disabled'/></> :
                              <>
                                {plugin.loaded && plugin.started && plugin.configured && plugin.paired && plugin.connected ? 
                                  <>
                                    <StatusIndicator status={plugin.loaded} enabledText='Running' tooltipText='Whether the plugin is running'/></> : 
                                  <>
                                    {plugin.loaded && plugin.started && plugin.configured && plugin.connected===undefined ? 
                                      <>
                                        <StatusIndicator status={plugin.loaded} enabledText='Running' tooltipText='Whether the plugin is running'/></> : 
                                      <>
                                        <StatusIndicator status={plugin.enabled} enabledText='Enabled' disabledText='Disabled' tooltipText='Whether the plugin is enable or disabled'/>
                                        <StatusIndicator status={plugin.loaded} enabledText='Loaded' tooltipText='Whether the plugin has been loaded'/>
                                        <StatusIndicator status={plugin.started} enabledText='Started' tooltipText='Whether the plugin started'/>
                                        <StatusIndicator status={plugin.configured} enabledText='Configured' tooltipText='Whether the plugin has been configured'/>
                                        {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' ? <StatusIndicator status={plugin.paired} enabledText='Paired' tooltipText='Whether the plugin has been paired'/> : <></>}
                                        {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' ? <StatusIndicator status={plugin.connected} enabledText='Connected' tooltipText='Whether the controller connected'/> : <></>}
                                      </>
                                    }
                                  </>
                                }
                              </>
                            }
                          </>
                        }
                      </div> 
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="MbfWindowDiv" style={{flex: '1 1 auto', width: '100%', overflow: 'hidden'}}>
          <div className="MbfWindowHeader" style={{ flexShrink: 0 }}>
            <p className="MbfWindowHeaderText" style={{ display: 'flex', justifyContent: 'space-between' }}>Logs <span style={{ fontWeight: 'normal', fontSize: '12px',marginTop: '2px' }}>Filter: logger level "{logFilterLevel}" and search "{logFilterSearch}"</span></p>
          </div>
          <div style={{ flex: '1 1 auto', margin: '0px', padding: '10px', overflow: 'auto'}}>
            <WebSocketComponent/>
          </div>
        </div>

      </div>
    </ThemeProvider>  
    </div>
  );
}

/*
*/

function AddRemovePlugins({ plugins, reloadSettings }) {
  const [pluginName, setPluginName] = useState('matterbridge-');
  const [open, setSnack] = useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const { messages, sendMessage, logMessage } = useContext(WebSocketContext);

  const handleSnackOpen = () => {
    setSnack(true);
  };

  const handleSnackClose = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnack(false);
  };

  const handleInstallPluginClick = () => {
    logMessage('Plugins', `Installing plugin: ${pluginName}`);
    sendCommandToMatterbridge('installplugin', pluginName);
    setTimeout(() => {
      reloadSettings();
    }, 5000);
  };

  const handleAddPluginClick = () => {
    logMessage('Plugins', `Adding plugin: ${pluginName}`);
    sendCommandToMatterbridge('addplugin', pluginName);
    setTimeout(() => {
      reloadSettings();
    }, 1000);
  };

  const handleClickVertical = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = (value) => {
    console.log('handleCloseMenu:', value);
    if(value !== '') setPluginName(value);
    setAnchorEl(null);
  };

  const theme = createTheme({
    components: {
      MuiTooltip: {
        defaultProps: {
          placement: 'bottom', 
          arrow: true,
        },
      },
    },
    palette: {
      primary: {
        main: '#4CAF50',
      },
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'row', flex: '1 1 auto', alignItems: 'center', justifyContent: 'space-between', margin: '0px', padding: '10px', gap: '20px' }}>
      <ThemeProvider theme={theme}>
      <Snackbar anchorOrigin={{vertical: 'bottom', horizontal: 'right'}} open={open} onClose={handleSnackClose} autoHideDuration={5000}>
        <Alert onClose={handleSnackClose} severity="info" variant="filled" sx={{ width: '100%', bgcolor: '#4CAF50' }}>Restart required</Alert>
      </Snackbar>
      <TextField value={pluginName} onChange={(event) => { setPluginName(event.target.value); }} size="small" id="plugin-name" label="Plugin name or plugin path" variant="outlined" fullWidth/>
      <IconButton onClick={handleClickVertical}>
        <MoreVert />
      </IconButton>
      <Menu id="simple-menu" anchorEl={anchorEl} keepMounted open={Boolean(anchorEl)} onClose={() => handleCloseMenu('')} sx={{ '& .MuiPaper-root': { backgroundColor: '#e2e2e2' } }}>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-zigbee2mqtt')}>matterbridge-zigbee2mqtt</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-somfy-tahoma')}>matterbridge-somfy-tahoma</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-shelly')}>matterbridge-shelly</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-example-accessory-platform')}>matterbridge-example-accessory-platform</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-example-dynamic-platform')}>matterbridge-example-dynamic-platform</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-door')}>matterbridge-eve-door</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-motion')}>matterbridge-eve-motion</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-energy')}>matterbridge-eve-energy</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-weather')}>matterbridge-eve-weather</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-room')}>matterbridge-eve-room</MenuItem>
      </Menu>
      <Tooltip title="Install or update a plugin from npm">
        <Button onClick={handleInstallPluginClick} theme={theme} color="primary" variant='contained' size="small" aria-label="install" endIcon={<Download />} style={{ color: '#ffffff', height: '30px', minWidth: '90px' }}> Install</Button>
      </Tooltip>        
      <Tooltip title="Add an installed plugin">
        <Button onClick={handleAddPluginClick} theme={theme} color="primary" variant='contained' size="small" aria-label="add" endIcon={<Add />} style={{ color: '#ffffff', height: '30px', minWidth: '90px' }}> Add</Button>
      </Tooltip>        
      </ThemeProvider>  
    </div>
  );
}

function QRDiv({ qrText, pairingText, qrWidth, topText, bottomText, matterbridgeInfo, plugin }) {
  // console.log('QRDiv:', matterbridgeInfo, plugin);
  if(matterbridgeInfo.bridgeMode === 'bridge' && matterbridgeInfo.matterbridgePaired === true && matterbridgeInfo.matterbridgeFabricInformations && matterbridgeInfo.matterbridgeSessionInformations) {
    console.log(`QRDiv: ${matterbridgeInfo.matterbridgeFabricInformations.length} fabrics, ${matterbridgeInfo.matterbridgeSessionInformations.length} sessions`);
    return ( 
      <div className="MbfWindowDiv" style={{alignItems: 'center', minWidth: '302px', overflow: 'hidden'}} >
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{textAlign: 'left', overflow: 'hidden'}}>Paired fabrics</p>
        </div>
        <div className="MbfWindowBodyColumn">
          {matterbridgeInfo.matterbridgeFabricInformations.map((fabric, index) => (
            <div key={index} style={{ margin: '0px', padding: '10px', gap: '0px', backgroundColor: '#9e9e9e', textAlign: 'left', fontSize: '14px' }}>
                <p className="status-blue" style={{ margin: '0px 10px 10px 10px', fontSize: '14px', padding: 0 }}>Fabric: {fabric.fabricIndex}</p>
                <p style={{ margin: '0px 20px 0px 20px'}}>Vendor: {fabric.rootVendorId} {fabric.rootVendorName}</p>
                {fabric.label !== '' && <p style={{ margin: '0px 20px 0px 20px'}}>Label: {fabric.label}</p>}
                <p style={{ margin: '0px 20px 0px 20px'}}>Active sessions: {matterbridgeInfo.matterbridgeSessionInformations.filter(session => session.fabric.fabricIndex === fabric.fabricIndex).length}</p>
            </div>  
          ))}
        </div>  
      </div>
    );  
  } else if(matterbridgeInfo.bridgeMode === 'childbridge' && plugin && plugin.paired === true && plugin.fabricInformations && plugin.sessionInformations) {
    console.log(`QRDiv: ${plugin.fabricInformations.length} fabrics, ${plugin.sessionInformations.length} sessions`);
    return ( 
      <div className="MbfWindowDiv" style={{alignItems: 'center', minWidth: '302px', overflow: 'hidden'}} >
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{textAlign: 'left'}}>Paired fabrics</p>
        </div>
        <div className="MbfWindowBodyColumn">
          {plugin.fabricInformations.map((fabric, index) => (
            <div key={index} style={{ margin: '0px', padding: '10px', gap: '0px', backgroundColor: '#9e9e9e', textAlign: 'left', fontSize: '14px' }}>
                <p className="status-blue" style={{ margin: '0px 10px 10px 10px', fontSize: '14px', padding: 0 }}>Fabric: {fabric.fabricIndex}</p>
                <p style={{ margin: '0px 20px 0px 20px' }}>Vendor: {fabric.rootVendorId} {fabric.rootVendorName}</p>
                {fabric.label !== '' && <p style={{ margin: '0px 20px 0px 20px'}}>Label: {fabric.label}</p>}
                <p style={{ margin: '0px 20px 0px 20px' }}>Active sessions: {plugin.sessionInformations.filter(session => session.fabric.fabricIndex === fabric.fabricIndex).length}</p>
            </div>  
          ))}
        </div>  
      </div>
    );
  } else if(matterbridgeInfo.bridgeMode === 'bridge' && matterbridgeInfo.matterbridgePaired !== true) {
    console.log(`QRDiv: qrText ${qrText} pairingText ${pairingText}`);
    return (
      <div className="MbfWindowDiv" style={{alignItems: 'center', minWidth: '302px'}}>
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{textAlign: 'left'}}>{topText}</p>
        </div>
        <QRCode value={qrText} size={qrWidth} bgColor='#9e9e9e' style={{ margin: '20px' }}/>
        <div className="MbfWindowFooter" style={{padding: 0, marginTop: '-5px', height: '30px'}}>
          <div>
            <p style={{ margin: 0, textAlign: 'center', fontSize: '14px' }}>Manual pairing code: {pairingText}</p>
          </div>
        </div>
      </div>
    );
  } else if(matterbridgeInfo.bridgeMode === 'childbridge' && plugin && plugin.paired !== true) {
    console.log(`QRDiv: qrText ${qrText} pairingText ${pairingText}`);
    return (
      <div className="MbfWindowDiv" style={{alignItems: 'center', minWidth: '302px'}}>
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{textAlign: 'left'}}>{topText}</p>
        </div>
        <QRCode value={qrText} size={qrWidth} bgColor='#9e9e9e' style={{ margin: '20px' }}/>
        <div className="MbfWindowFooter" style={{padding: 0, marginTop: '-5px', height: '30px'}}>
          <div>
            <p style={{ margin: 0, textAlign: 'center', fontSize: '14px' }}>Manual pairing code: {pairingText}</p>
          </div>
        </div>
      </div>
    );
  }
}

function DialogConfigPlugin( { config, schema, handleCloseConfig }) {
  console.log('DialogConfigPlugin:', config, schema);

  const theme = createTheme({
    palette: {
      primary: {
        main: '#4CAF50', 
      },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            border: "1px solid #ddd", 
            backgroundColor: '#c4c2c2', 
            boxShadow: '5px 5px 10px #888'
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: 'small',
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            color: '#ffffff',
            backgroundColor: '#4CAF50', 
          },
        },
        defaultProps: {
          color: 'primary',
          variant: 'contained',
          size: 'small',
        },
      },
    },
  });

  const uiSchema = {
    "password": {
      "ui:widget": "password",
    },
    "ui:submitButtonOptions": {
      "props": {
        "variant": "contained",
        "disabled": false,
      },
      "norender": false,
      "submitText": "Save the changes to the config file",
    },
    'ui:globalOptions': { orderable: false },
  };
  
  const handleSaveChanges = ({ formData }, event) => {
    console.log('handleSaveChanges:', formData);
    const config = JSON.stringify(formData, null, 2)
    sendCommandToMatterbridge('saveconfig', formData.name, config);
    // Close the dialog
    handleCloseConfig();
    // window.location.reload();
  };    

  return (
    <ThemeProvider theme={theme}>
      <div style={{ maxWidth: '800px' }}>
        <Form schema={schema} formData={config} uiSchema={uiSchema} validator={validator} onSubmit={handleSaveChanges} />
        <div style={{ paddingTop: '10px' }}>Restart Matterbridge to apply the changes</div>
      </div>
    </ThemeProvider>  
  );
}
  
export default Home;
