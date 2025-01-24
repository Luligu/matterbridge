/* eslint-disable no-console */

// React
import React, { useEffect, useState, useRef, useContext, useMemo } from 'react';

// @mui/material
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import { ThemeProvider } from '@mui/material';

// @mui/icons-material
import DeleteForever from '@mui/icons-material/DeleteForever';
import Download from '@mui/icons-material/Download';
import Add from '@mui/icons-material/Add';
import PublishedWithChanges from '@mui/icons-material/PublishedWithChanges';
import Settings from '@mui/icons-material/Settings';
import Favorite from '@mui/icons-material/Favorite';
import Help from '@mui/icons-material/Help';
import Announcement from '@mui/icons-material/Announcement';
import QrCode2 from '@mui/icons-material/QrCode2';
import MoreVert from '@mui/icons-material/MoreVert';
import Unpublished from '@mui/icons-material/Unpublished';

// @rjsf
import Form from '@rjsf/mui';
import validator from '@rjsf/validator-ajv8';

// QRCode
import { QRCodeSVG } from 'qrcode.react';

// Frontend
import { StatusIndicator } from './StatusIndicator';
import { sendCommandToMatterbridge } from './sendApiCommand';
import { WebSocketLogs } from './WebSocketLogs';
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import { SystemInfoTable } from './SystemInfoTable';
import { MatterbridgeInfoTable } from './MatterbridgeInfoTable';
import { ConfirmCancelForm } from './ConfirmCancelForm';
import { configUiSchema, ArrayFieldTemplate, ObjectFieldTemplate, ErrorListTemplate, FieldErrorTemplate, RemoveButton, CheckboxWidget, createConfigTheme, DescriptionFieldTemplate } from './configEditor';
import { getCssVariable } from './muiTheme';
import { debug } from '../App';

export let pluginName = '';
export let selectDevices = [];
export let selectEntities = [];

function Home() {
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
  const [logFilterLevel] = useState(localStorage.getItem('logFilterLevel') ?? 'info');
  const [logFilterSearch] = useState(localStorage.getItem('logFilterSearch') ?? '*');

  const { setMessages, logMessage, addListener, removeListener, online, sendMessage } = useContext(WebSocketContext);

  const refAddRemove = useRef(null);
  const refRegisteredPlugins = useRef(null);

  const primaryColor = useMemo(() => getCssVariable('--primary-color', '#009a00'), []);
  const theme = useMemo(() => createConfigTheme(primaryColor), []);

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

  const columns = React.useMemo(() => [
    { Header: 'Name', accessor: 'name' },
    { Header: 'Description', accessor: 'description' },
    { Header: 'Version', accessor: 'version' },
    { Header: 'Author', accessor: 'author' },
    { Header: 'Type', accessor: 'type' },
    { Header: 'Devices', accessor: 'devices' },
    { Header: 'Tools', accessor: 'qrcode' },
    { Header: 'Status', accessor: 'status' },
  ],
    []
  );

  // Function to reload settings on demand
  const reloadSettings = () => {
    if (debug) console.log('reloadSettings');
    sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
    sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
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
    // console.log('Selected row:', row, 'plugin:', plugins[row].name, 'enabled:', plugins[row].enabled);
    if (plugins[row].enabled === true) {
      plugins[row].enabled = false;
      logMessage('Plugins', `Disabling plugin: ${plugins[row].name}`);
      sendCommandToMatterbridge('disableplugin', plugins[row].name);
    }
    else {
      plugins[row].enabled = true;
      logMessage('Plugins', `Enabling plugin: ${plugins[row].name}`);
      sendCommandToMatterbridge('enableplugin', plugins[row].name);
    }
    if (matterbridgeInfo.bridgeMode === 'childbridge') {
      setTimeout(() => {
        reloadSettings();
      }, 500);
    }
    if (matterbridgeInfo.bridgeMode === 'bridge') {
      setTimeout(() => {
        reloadSettings();
      }, 500);
    }
  };

  const handleUpdatePlugin = (row) => {
    // console.log('handleUpdate row:', row, 'plugin:', plugins[row].name);
    logMessage('Plugins', `Updating plugin: ${plugins[row].name}`);
    sendCommandToMatterbridge('installplugin', plugins[row].name);
    handleSnackOpen({ vertical: 'bottom', horizontal: 'right' });
    setTimeout(() => {
      handleSnackClose();
      reloadSettings();
    }, 5000);
  };

  const handleRemovePlugin = (row) => {
    // console.log('handleRemovePluginClick row:', row, 'plugin:', plugins[row].name);
    logMessage('Plugins', `Removing plugin: ${plugins[row].name}`);
    sendCommandToMatterbridge('removeplugin', plugins[row].name);
    setTimeout(() => {
      reloadSettings();
    }, 500);
  };

  const handleConfigPlugin = (row) => {
    // console.log('handleConfigPlugin row:', row, 'plugin:', plugins[row].name);
    pluginName = plugins[row].name;
    sendMessage({ method: "/api/select", src: "Frontend", dst: "Matterbridge", params: { plugin: pluginName } });
    sendMessage({ method: "/api/select/entities", src: "Frontend", dst: "Matterbridge", params: { plugin: pluginName } });
    setSelectedPluginConfig(plugins[row].configJson);
    setSelectedPluginSchema(plugins[row].schemaJson);
    handleOpenConfig();
  };

  const handleSponsorPlugin = () => {
    // console.log('handleSponsorPlugin row:', row, 'plugin:', plugins[row].name);
    window.open('https://www.buymeacoffee.com/luligugithub', '_blank');
  };

  const handleHelpPlugin = (row) => {
    // console.log('handleHelpPlugin row:', row, 'plugin:', plugins[row].name);
    window.open(`https://github.com/Luligu/${plugins[row].name}/blob/main/README.md`, '_blank');
  };

  const handleChangelogPlugin = (row) => {
    // console.log('handleChangelogPlugin row:', row, 'plugin:', plugins[row].name);
    window.open(`https://github.com/Luligu/${plugins[row].name}/blob/main/CHANGELOG.md`, '_blank');
  };

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
    // console.log(`Action confirmed ${confirmCancelFormCommand} ${confirmCancelFormRow}`);
    setShowConfirmCancelForm(false);
    if (confirmCancelFormCommand === 'remove' && confirmCancelFormRow !== -1) {
      handleRemovePlugin(confirmCancelFormRow);
    } else if (confirmCancelFormCommand === 'disable' && confirmCancelFormRow !== -1) {
      handleEnableDisablePlugin(confirmCancelFormRow);
    }
  };

  const handleCancel = () => {
    // console.log("Action canceled");
    setShowConfirmCancelForm(false);
  };

  useEffect(() => {
    const handleWebSocketMessage = (msg) => {
      // console.log('Home Received WebSocket Message:', msg);
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'refresh_required') {
          if (debug) console.log('Home received refresh_required');
          reloadSettings();
        }
        if (msg.method === '/api/settings') {
          if (debug) console.log('Home received settings:', msg.response);
          if (msg.response.matterbridgeInformation.bridgeMode === 'bridge') {
            setQrCode(msg.response.matterbridgeInformation.matterbridgeQrPairingCode);
            setPairingCode(msg.response.matterbridgeInformation.matterbridgeManualPairingCode);
          }
          setSystemInfo(msg.response.systemInformation);
          setMatterbridgeInfo(msg.response.matterbridgeInformation);
        }
        if (msg.method === '/api/plugins') {
          if (debug) console.log('Home received plugins:', msg.response);
          setPlugins(msg.response);
        }
        if (msg.method === '/api/select') {
          if (msg.response) {
            if (debug) console.log('Home received /api/select:', msg.response);
            selectDevices = msg.response;
          }
          if (msg.error) {
            console.error('Home received /api/select error:', msg.error);
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
    if (debug) console.log('Home added WebSocket listener');

    return () => {
      removeListener(handleWebSocketMessage);
      if (debug) console.log('Home removed WebSocket listener');
    };
  }, [addListener, removeListener, sendMessage]);

  useEffect(() => {
    if (online) {
      if (debug) console.log('Home received online');
      reloadSettings();
    }
  }, [online]);

  if (!online) {
    return (<Connecting />);
  }
  return (
    <div className="MbfPageDiv" style={{ flexDirection: 'row' }}>
      <ThemeProvider theme={theme}>
        <Dialog
          open={openConfig}
          onClose={handleCloseConfig}
          maxWidth='800px'>
          <DialogTitle gap={'20px'}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
              <img src="matterbridge 64x64.png" alt="Matterbridge Logo" style={{ height: '64px', width: '64px' }} />
              <h3>Matterbridge plugin configuration</h3>
            </div>
          </DialogTitle>
          <DialogContent style={{ padding: '0px', margin: '0px' }}>
            <DialogConfigPlugin config={selectedPluginConfig} schema={selectedPluginSchema} handleCloseConfig={handleCloseConfig} />
          </DialogContent>
        </Dialog>
      </ThemeProvider>

      <ConfirmCancelForm open={showConfirmCancelForm} title={confirmCancelFormTitle} message={confirmCancelFormMessage} onConfirm={handleConfirm} onCancel={handleCancel} />

      {/*Left column*/}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '302px', minWidth: '302px', gap: '20px' }}>
        <QRDiv matterbridgeInfo={matterbridgeInfo} plugin={selectedRow === -1 ? undefined : plugins[selectedRow]} />
        {systemInfo && <SystemInfoTable systemInfo={systemInfo} compact={true} />}
        {qrCode === '' && matterbridgeInfo && <MatterbridgeInfoTable matterbridgeInfo={matterbridgeInfo} />}
      </div>

      {/*Right column*/}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', gap: '20px' }}>

        {/*Install add plugin*/}
        {matterbridgeInfo && !matterbridgeInfo.readOnly &&
          <div className="MbfWindowDiv" style={{ flex: '0 0 auto', width: '100%', overflow: 'hidden' }}>
            <div className="MbfWindowHeader">
              <p className="MbfWindowHeaderText">Install add plugin</p>
            </div>
            <AddRemovePlugins ref={refAddRemove} plugins={plugins} reloadSettings={reloadSettings} />
          </div>
        }

        {/*Registered plugins*/}
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

                    {plugin.latestVersion === undefined || plugin.latestVersion === plugin.version || (matterbridgeInfo && matterbridgeInfo.readOnly) ?
                      <td><Tooltip title="Plugin version">{plugin.version}</Tooltip></td> :
                      <td><Tooltip title="New plugin version available, click to install"><span className="status-warning" onClick={() => handleUpdatePlugin(index)}>Update v.{plugin.version} to v.{plugin.latestVersion}</span></Tooltip></td>
                    }
                    <td>{plugin.author.replace('https://github.com/', '')}</td>

                    <td>{plugin.type === 'DynamicPlatform' ? 'Dynamic' : 'Accessory'}</td>
                    <td>{plugin.registeredDevices}</td>
                    <td>
                      <>
                        {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' && !plugin.error && plugin.enabled ? <Tooltip title="Shows the QRCode or the fabrics"><IconButton style={{ margin: '0', padding: '0' }} onClick={() => handleSelectQRCode(index)} size="small"><QrCode2 /></IconButton></Tooltip> : <></>}
                        <Tooltip title="Plugin config"><IconButton style={{ margin: '0', padding: '0' }} onClick={() => handleConfigPlugin(index)} size="small"><Settings /></IconButton></Tooltip>
                        {matterbridgeInfo && !matterbridgeInfo.readOnly &&
                          <Tooltip title="Remove the plugin"><IconButton style={{ margin: '0', padding: '0' }} onClick={() => { handleActionWithConfirmCancel('Remove plugin', 'Are you sure? This will remove also all the devices and configuration in the controller.', 'remove', index); }} size="small"><DeleteForever /></IconButton></Tooltip>
                        }
                        {plugin.enabled ? <Tooltip title="Disable the plugin"><IconButton style={{ margin: '0', padding: '0' }} onClick={() => { handleActionWithConfirmCancel('Disable plugin', 'Are you sure? This will remove also all the devices and configuration in the controller.', 'disable', index); }} size="small"><Unpublished /></IconButton></Tooltip> : <></>}
                        {!plugin.enabled ? <Tooltip title="Enable the plugin"><IconButton style={{ margin: '0', padding: '0' }} onClick={() => handleEnableDisablePlugin(index)} size="small"><PublishedWithChanges /></IconButton></Tooltip> : <></>}
                        <Tooltip title="Plugin help"><IconButton style={{ margin: '0', padding: '0' }} onClick={() => handleHelpPlugin(index)} size="small"><Help /></IconButton></Tooltip>
                        <Tooltip title="Plugin version history"><IconButton style={{ margin: '0', padding: '0' }} onClick={() => handleChangelogPlugin(index)} size="small"><Announcement /></IconButton></Tooltip>
                        {matterbridgeInfo && !matterbridgeInfo.readOnly &&
                          <Tooltip title="Sponsor the plugin"><IconButton style={{ margin: '0', padding: '0', color: '#b6409c' }} onClick={() => handleSponsorPlugin(index)} size="small"><Favorite /></IconButton></Tooltip>
                        }
                      </>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'row', flex: '1 1 auto', gap: '5px' }}>

                        <Snackbar anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} open={openSnack} onClose={handleSnackClose} autoHideDuration={10000}>
                          <Alert onClose={handleSnackClose} severity="info" variant="filled" sx={{ width: '100%', bgcolor: 'var(--primary-color)' }}>Restart needed!</Alert>
                        </Snackbar>
                        {plugin.error ?
                          <>
                            <StatusIndicator status={false} enabledText='Error' disabledText='Error' tooltipText='The plugin is in error state. Check the log!' /></> :
                          <>
                            {plugin.enabled === false ?
                              <>
                                <StatusIndicator status={plugin.enabled} enabledText='Enabled' disabledText='Disabled' tooltipText='Whether the plugin is enable or disabled' /></> :
                              <>
                                {plugin.loaded && plugin.started && plugin.configured && plugin.paired ?
                                  <>
                                    <StatusIndicator status={plugin.loaded} enabledText='Running' tooltipText='Whether the plugin is running' /></> :
                                  <>
                                    {plugin.loaded && plugin.started && plugin.configured ?
                                      <>
                                        <StatusIndicator status={plugin.loaded} enabledText='Running' tooltipText='Whether the plugin is running' /></> :
                                      <>
                                        <StatusIndicator status={plugin.enabled} enabledText='Enabled' disabledText='Disabled' tooltipText='Whether the plugin is enable or disabled' />
                                        <StatusIndicator status={plugin.loaded} enabledText='Loaded' tooltipText='Whether the plugin has been loaded' />
                                        <StatusIndicator status={plugin.started} enabledText='Started' tooltipText='Whether the plugin started' />
                                        <StatusIndicator status={plugin.configured} enabledText='Configured' tooltipText='Whether the plugin has been configured' />
                                        {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' ? <StatusIndicator status={plugin.paired} enabledText='Paired' tooltipText='Whether the plugin has been paired' /> : <></>}
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

        {/*Logs*/}
        <div className="MbfWindowDiv" style={{ flex: '1 1 auto', width: '100%', overflow: 'hidden' }}>
          <div className="MbfWindowHeader" style={{ flexShrink: 0 }}>
            <div className="MbfWindowHeaderText" style={{ display: 'flex', justifyContent: 'space-between' }}>
              Logs
              <span style={{ fontWeight: 'normal', fontSize: '12px', marginTop: '2px' }}>
                Filter: logger level "{logFilterLevel}" and search "{logFilterSearch}"
              </span>
            </div>
          </div>
          <div style={{ flex: '1 1 auto', margin: '0px', padding: '10px', overflow: 'auto' }}>
            <WebSocketLogs />
          </div>
        </div>

      </div>
    </div>
  );
}

/*
        <div className="MbfWindowDiv" style={{ flex: '1 1 auto', width: '100%', overflow: 'hidden' }}>
          <div className="MbfWindowHeader" style={{ flexShrink: 0 }}>
            <div className="MbfWindowHeaderText" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>

              <div>
                Logs
              </div>

              <div style={{ display: 'flex', flexDirection: 'row', gap: '2px' }}>
                <p style={{ margin: '0px', padding: '0px' }}>
                  Filter: logger level "{logFilterLevel}" and search "{logFilterSearch}"
                </p>
                <Tooltip title="Clear the logs">
                  <IconButton onClick={setMessages([])} style={{ margin: '0px', padding: '0px', width: '19px', height: '19px' }}>
                    <DeleteForever style={{ color: 'var(--header-text-color)', fontSize: '19px' }} />
                  </IconButton>
                </Tooltip>
              </div>

            </div>
          </div>
          <div style={{ flex: '1 1 auto', margin: '0px', padding: '10px', overflow: 'auto' }}>
            <WebSocketLogs />
          </div>
        </div>
*/

function AddRemovePlugins({ reloadSettings }) {
  const [pluginName, setPluginName] = useState('matterbridge-');
  const [open, setSnack] = useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const { logMessage } = useContext(WebSocketContext);


  const handleSnackClose = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnack(false);
  };

  const handleInstallPluginClick = () => {
    const plugin = pluginName.split('@')[0];
    if (plugin === 'matterbridge')
      logMessage('Matterbridge', `Installing matterbridge package: ${pluginName}`);
    else
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
    // console.log('handleCloseMenu:', value);
    if (value !== '') setPluginName(value);
    setAnchorEl(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', flex: '1 1 auto', alignItems: 'center', justifyContent: 'space-between', margin: '0px', padding: '10px', gap: '20px' }}>
      <Snackbar anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} open={open} onClose={handleSnackClose} autoHideDuration={5000}>
        <Alert onClose={handleSnackClose} severity="info" variant="filled" sx={{ width: '100%', bgcolor: 'var(--primary-color)' }}>Restart required</Alert>
      </Snackbar>
      <TextField value={pluginName} onChange={(event) => { setPluginName(event.target.value); }} size="small" id="plugin-name" label="Plugin name or plugin path" variant="outlined" fullWidth />
      <IconButton onClick={handleClickVertical}>
        <MoreVert />
      </IconButton>
      <Menu id="simple-menu" anchorEl={anchorEl} keepMounted open={Boolean(anchorEl)} onClose={() => handleCloseMenu('')}>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-zigbee2mqtt')}>matterbridge-zigbee2mqtt</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-somfy-tahoma')}>matterbridge-somfy-tahoma</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-shelly')}>matterbridge-shelly</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-hass')}>matterbridge-hass</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-example-accessory-platform')}>matterbridge-example-accessory-platform</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-example-dynamic-platform')}>matterbridge-example-dynamic-platform</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-door')}>matterbridge-eve-door</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-motion')}>matterbridge-eve-motion</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-energy')}>matterbridge-eve-energy</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-weather')}>matterbridge-eve-weather</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-room')}>matterbridge-eve-room</MenuItem>
      </Menu>
      <Tooltip title="Install or update a plugin from npm">
        <Button onClick={handleInstallPluginClick} endIcon={<Download />} style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px', minWidth: '90px' }}> Install</Button>
      </Tooltip>
      <Tooltip title="Add an installed plugin">
        <Button onClick={handleAddPluginClick} endIcon={<Add />} style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px', minWidth: '90px' }}> Add</Button>
      </Tooltip>
    </div>
  );
}

function QRDiv({ matterbridgeInfo, plugin }) {
  console.log('QRDiv:', matterbridgeInfo, plugin);
  if (matterbridgeInfo.bridgeMode === 'bridge' && matterbridgeInfo.matterbridgePaired === true && matterbridgeInfo.matterbridgeFabricInformations) {
    console.log(`QRDiv: paired ${matterbridgeInfo.matterbridgePaired}, got ${matterbridgeInfo.matterbridgeFabricInformations?.length} fabrics, got ${matterbridgeInfo.matterbridgeSessionInformations?.length} sessions`);
    return (
      <div className="MbfWindowDiv" style={{ alignItems: 'center', minWidth: '302px', overflow: 'hidden' }} >
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{ textAlign: 'left', overflow: 'hidden' }}>Paired fabrics</p>
        </div>
        <div className="MbfWindowBodyColumn">
          {matterbridgeInfo.matterbridgeFabricInformations.map((fabric, index) => (
            <div key={index} style={{ margin: '0px', padding: '10px', gap: '0px', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)', textAlign: 'left', fontSize: '14px' }}>
              <p className="status-blue" style={{ margin: '0px 10px 10px 10px', fontSize: '14px', padding: 0, color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)' }}>Fabric: {fabric.fabricIndex}</p>
              <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Vendor: {fabric.rootVendorId} {fabric.rootVendorName}</p>
              {fabric.label !== '' && <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Label: {fabric.label}</p>}
              <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Active sessions: {matterbridgeInfo.matterbridgeSessionInformations ? matterbridgeInfo.matterbridgeSessionInformations.filter(session => session.fabric.fabricIndex === fabric.fabricIndex).length : '0'}</p>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (matterbridgeInfo.bridgeMode === 'childbridge' && plugin && plugin.paired === true && plugin.fabricInformations) {
    console.log(`QRDiv: paired ${plugin.paired}, got ${plugin.fabricInformations?.length} fabrics, got ${plugin.sessionInformations?.length} sessions`);
    return (
      <div className="MbfWindowDiv" style={{ alignItems: 'center', minWidth: '302px', overflow: 'hidden' }} >
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{ textAlign: 'left' }}>Paired fabrics</p>
        </div>
        <div className="MbfWindowBodyColumn">
          {plugin.fabricInformations.map((fabric, index) => (
            <div key={index} style={{ margin: '0px', padding: '10px', gap: '0px', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)', textAlign: 'left', fontSize: '14px' }}>
              <p className="status-blue" style={{ margin: '0px 10px 10px 10px', fontSize: '14px', padding: 0, color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)' }}>Fabric: {fabric.fabricIndex}</p>
              <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Vendor: {fabric.rootVendorId} {fabric.rootVendorName}</p>
              {fabric.label !== '' && <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Label: {fabric.label}</p>}
              <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Active sessions: {plugin.sessionInformations ? plugin.sessionInformations.filter(session => session.fabric.fabricIndex === fabric.fabricIndex).length : '0'}</p>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (matterbridgeInfo.bridgeMode === 'bridge' && matterbridgeInfo.matterbridgePaired === false && matterbridgeInfo.matterbridgeQrPairingCode && matterbridgeInfo.matterbridgeManualPairingCode) {
    // console.log(`QRDiv: qrText ${qrText} pairingText ${pairingText}`);
    return (
      <div className="MbfWindowDiv" style={{ alignItems: 'center', minWidth: '302px' }}>
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{ textAlign: 'left' }}>QR pairing code</p>
        </div>
        <QRCodeSVG value={matterbridgeInfo.matterbridgeQrPairingCode} size={256} level='M' fgColor={'var(--div-text-color)'} bgColor={'var(--div-bg-color)'} style={{ margin: '20px' }} />
        <div className="MbfWindowFooter" style={{ padding: 0, marginTop: '-5px', height: '30px' }}>
          <p className="MbfWindowFooterText" style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' }}>Manual pairing code: {matterbridgeInfo.matterbridgeManualPairingCode}</p>
        </div>
      </div>
    );
  } else if (matterbridgeInfo.bridgeMode === 'childbridge' && plugin && plugin.paired === false && plugin.qrPairingCode && plugin.manualPairingCode) {
    // console.log(`QRDiv: qrText ${qrText} pairingText ${pairingText}`);
    return (
      <div className="MbfWindowDiv" style={{ alignItems: 'center', minWidth: '302px' }}>
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{ textAlign: 'left' }}>QR pairing code</p>
        </div>
        <QRCodeSVG value={plugin.qrPairingCode} size={256} level='M' fgColor={'var(--div-text-color)'} bgColor={'var(--div-bg-color)'} style={{ margin: '20px' }} />
        <div className="MbfWindowFooter" style={{ padding: 0, marginTop: '-5px', height: '30px' }}>
          <p className="MbfWindowFooterText" style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' }}>Manual pairing code: {plugin.manualPairingCode}</p>
        </div>
      </div>
    );
  }
}

function DialogConfigPlugin({ config, schema, handleCloseConfig }) {
  // console.log('DialogConfigPlugin:', config, schema);

  const handleSaveChanges = ({ formData }) => {
    // console.log('handleSaveChanges:', formData);
    const config = JSON.stringify(formData, null, 2)
    sendCommandToMatterbridge('saveconfig', formData.name, config);
    // Close the dialog
    handleCloseConfig();
  };

  const primaryColor = useMemo(() => getCssVariable('--primary-color', '#009a00'), []);
  const configTheme = useMemo(() => createConfigTheme(primaryColor), [primaryColor]);

  return (
    <ThemeProvider theme={configTheme}>
      <div style={{ width: '800px', height: '600px', overflow: 'auto' }}>
        <Form
          schema={schema}
          formData={config}
          uiSchema={configUiSchema}
          validator={validator}
          widgets={{ CheckboxWidget: CheckboxWidget }}
          templates={{ ArrayFieldTemplate, ObjectFieldTemplate, DescriptionFieldTemplate, FieldErrorTemplate, ErrorListTemplate, ButtonTemplates: { RemoveButton } }}
          onSubmit={handleSaveChanges} />
      </div>
    </ThemeProvider>
  );
}

export default Home;
