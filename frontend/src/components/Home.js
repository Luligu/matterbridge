// Home.js
import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode.react';
import { StatusIndicator } from './StatusIndicator';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { Tooltip, IconButton, Button, createTheme,  } from '@mui/material';
import { sendCommandToMatterbridge } from './Header';
import WebSocketComponent from './WebSocketComponent';

import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DownloadIcon from '@mui/icons-material/Download';

// npm install @mui/material @emotion/react @emotion/styled
// npm install @mui/icons-material @mui/material @emotion/styled @emotion/react

function Home() {
  const [wssHost, setWssHost] = useState(null);
  const [qrCode, setQrCode] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [systemInfo, setSystemInfo] = useState({});
  const [matterbridgeInfo, setMatterbridgeInfo] = useState({});
  const [plugins, setPlugins] = useState([]);
  const [selectedRow, setSelectedRow] = useState(-1); // -1 no selection, 0 or greater for selected row
  const [selectedPluginName, setSelectedPluginName] = useState('none'); // -1 no selection, 0 or greater for selected row
  const [open, setSnack] = useState(false);

  const refAddRemove = useRef(null);
  const refRegisteredPlugins = useRef(null);

  const handleSnackOpen = () => {
    console.log('handleSnackOpen');
    setSnack(true);
  };

  const handleSnackClose = (event, reason) => {
    console.log('handleSnackClose:', reason);
    if (reason === 'clickaway') return;
    setSnack(false);
  };

  const columns = React.useMemo( () => [
      { Header: 'Name', accessor: 'name' },
      { Header: 'Description', accessor: 'description' },
      { Header: 'Version', accessor: 'version' },
      { Header: 'Author', accessor: 'author' },
      { Header: 'Type', accessor: 'type' },
      { Header: 'Devices', accessor: 'devices'},
      { Header: 'QR', accessor: 'qrcode' },
      { Header: 'Status', accessor: 'status'},
    ],
    []
  );

  /*
  */
  useEffect(() => {

    fetch('/api/settings')
      .then(response => response.json())
      .then(data => { 
        console.log('/api/settings:', data); 
        setWssHost(data.wssHost); 
        setQrCode(data.qrPairingCode); 
        setPairingCode(data.manualPairingCode);
        setSystemInfo(data.systemInformation);
        setMatterbridgeInfo(data.matterbridgeInformation);
        localStorage.setItem('wssHost', data.wssHost);
        localStorage.setItem('manualPairingCode', data.manualPairingCode); 
        localStorage.setItem('qrPairingCode', data.qrPairingCode); 
        localStorage.setItem('systemInformation', data.systemInformation); 
        localStorage.setItem('matterbridgeInformation', data.matterbridgeInformation); 
      })
      .catch(error => console.error('Error fetching settings:', error));

    fetch('/api/plugins')
      .then(response => response.json())
      .then(data => { setPlugins(data); console.log('/api/plugins:', data)})
      .catch(error => console.error('Error fetching plugins:', error));

  }, []); // The empty array causes this effect to run only once

  const handleSelect = (row) => {
    if (selectedRow === row) {
      setSelectedRow(-1);
      setSelectedPluginName('none');
      setQrCode(localStorage.getItem('qrPairingCode'));
      setPairingCode(localStorage.getItem('manualPairingCode'));
    } else {
      setSelectedRow(row);
      setSelectedPluginName(plugins[row].name);
      setQrCode(plugins[row].qrPairingCode);
      setPairingCode(plugins[row].manualPairingCode);
    }
    console.log('Selected row:', row, 'plugin:', plugins[row].name, 'qrcode:', plugins[row].qrPairingCode);
  };

  const handleEnableDisable = (row) => {
    console.log('Selected row:', row, 'plugin:', plugins[row].name, 'enabled:', plugins[row].enabled);
    if(plugins[row].enabled===true) {
      plugins[row].enabled=false;
      sendCommandToMatterbridge('disableplugin', plugins[row].name);
    }
    else {
      plugins[row].enabled=true;
      sendCommandToMatterbridge('enableplugin', plugins[row].name);
    }
    console.log('Updating page');
    setPlugins(prevPlugins => [...prevPlugins]);
    handleSnackOpen({ vertical: 'bottom', horizontal: 'right' });
    setTimeout(() => {
      window.location.reload();
    }, 5000);
  };

  const handleUpdate = (row) => {
    console.log('handleUpdate row:', row, 'plugin:', plugins[row].name);
    sendCommandToMatterbridge('installplugin', plugins[row].name);
  };

  /*
        {matterbridgeInfo && <MatterbridgeInfoTable matterbridgeInfo={matterbridgeInfo}/>}
  */

  if (wssHost === null) {
    return <div>Loading settings...</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: 'calc(100vh - 60px - 40px)', width: 'calc(100vw - 40px)', gap: '20px', margin: '0', padding: '0' }}>
      <div  style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px - 40px)', flex: '0 1 auto', gap: '20px' }}>
        {qrCode && <QRDiv qrText={qrCode} pairingText={pairingCode} qrWidth={256} topText="QRCode" bottomText={selectedPluginName==='none'?'Matterbridge':selectedPluginName}/>}
        {systemInfo && <SystemInfoTable systemInfo={systemInfo}/>}
      </div>
      <div  style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px - 40px)', flex: '0 1 auto', width: '100%', gap: '20px' }}>
        <AddRemovePluginsDiv ref={refAddRemove} plugins={plugins}/>
        <table ref={refRegisteredPlugins}>
          <thead>
            <tr>
              <th className="table-header" colSpan="8">Registered plugins</th>
            </tr>
            <tr>
              {columns.map((column, index) => (
                <th className="table-header" key={index}>{column.Header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plugins.map((plugin, index) => (

              <tr key={index} onClick={() => handleSelect(index)} className={selectedRow === index ? 'table-content-selected' : index % 2 === 0 ? 'table-content-even' : 'table-content-odd'}>

                <td className="table-content"><Tooltip title={plugin.path}>{plugin.name}</Tooltip></td>
                <td className="table-content">{plugin.description}</td>
                <td className="table-content">{plugin.latestVersion === plugin.version ? plugin.version : <span className="status-warning" onClick={() => handleUpdate(index)}>{`${plugin.version} -> ${plugin.latestVersion}`}</span>}</td>
                <td className="table-content">{plugin.author}</td>
                <td className="table-content">{plugin.type}</td>
                <td className="table-content">{plugin.registeredDevices}</td>
                <td className="table-content">{plugin.qrPairingCode ?  
                  <>
                    <Tooltip title="Scan the QRCode"><IconButton style={{padding: 0}} className="PluginsIconButton" size="small"><QrCode2Icon /></IconButton></Tooltip>
                  </> : 
                  <>
                  </>
                }
                </td>
                <td className="table-content">
                  <div style={{ display: 'flex', flexDirection: 'row', flex: '1 1 auto', gap: '5px' }}>

                    <Snackbar anchorOrigin={{vertical: 'bottom', horizontal: 'right'}} open={open} onClose={handleSnackClose} autoHideDuration={10000}>
                      <Alert onClose={handleSnackClose} severity="info" variant="filled" sx={{ width: '100%', bgcolor: '#4CAF50' }}>Restart needed!</Alert>
                    </Snackbar>

                    <StatusIndicator status={plugin.enabled} onClick={() => handleEnableDisable(index)} enabledText='Enabled' disabledText='Disabled' tooltipText='Enable or disable the plugin'/>
                    {plugin.loaded && plugin.started && plugin.configured && plugin.paired && plugin.connected ? 
                      <>
                        <StatusIndicator status={plugin.loaded} enabledText='Running' tooltipText='Whether the plugin is running'/>
                      </> : 
                      <>
                        {plugin.loaded && plugin.started && plugin.configured && plugin.connected===undefined ? 
                          <>
                            <StatusIndicator status={plugin.loaded} enabledText='Running' tooltipText='Whether the plugin is running'/>
                          </> : 
                          <>
                            <StatusIndicator status={plugin.loaded} enabledText='Loaded' tooltipText='Whether the plugin has been loaded'/>
                            <StatusIndicator status={plugin.started} enabledText='Started' tooltipText='Whether the plugin started'/>
                            <StatusIndicator status={plugin.configured} enabledText='Configured' tooltipText='Whether the plugin has been configured'/>
                            <StatusIndicator status={plugin.paired} enabledText='Paired' tooltipText='Whether the plugin has been paired'/>
                            <StatusIndicator status={plugin.connected} enabledText='Connected' tooltipText='Whether the controller connected'/>
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

        <div className="MbfWindowDiv" style={{display: 'flex', flexDirection: 'column', flex: '0 1 auto'}}>
          <div className="MbfWindowHeader">
            <p className="MbfWindowHeaderText" style={{textAlign: 'left'}}>Logs</p>
          </div>
          <div style={{ flex: '1 1', margin: '5px', padding: '5px', height: '200px', maxHeight: '200px', overflow: 'auto'}}>
            <WebSocketComponent wssHost={wssHost} debugLevel='debug' searchCriteria='*'/>
          </div>
        </div>

      </div>
    </div>
  );}
  /*
        Working
        <div className="MbfWindowDiv" style={{display: 'flex', flexDirection: 'column', flex: '0 1 auto'}}>
          <div className="MbfWindowHeader">
            <p className="MbfWindowHeaderText" style={{textAlign: 'left'}}>Log</p>
          </div>
          <div style={{ flex: '1', margin: '5px', padding: '5px', height: '200px', maxHeight: '200px', overflow: 'auto'}}>
            <WebSocketComponent wssHost={wssHost}/>
          </div>
        </div>
  */

  function AddRemovePluginsDiv({ plugins }) {
    const [pluginName, setPluginName] = useState('matterbridge-');
    const [open, setSnack] = useState(false);

    const handleSnackOpen = () => {
      console.log('handleSnackOpen');
      setSnack(true);
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    };
  
    const handleSnackClose = (event, reason) => {
      console.log('handleSnackClose:', reason);
      if (reason === 'clickaway') return;
      setSnack(false);
    };
  
    // Function that sends the "addplugin" command
    const handleInstallPluginClick = () => {
      handleSnackOpen();
      console.log('handleInstallPluginClick', pluginName);
      sendCommandToMatterbridge('installplugin', pluginName);
    };

    // Function that sends the "addplugin" command
    const handleAddPluginClick = () => {
      handleSnackOpen();
      console.log('handleAddPluginClick', pluginName);
      sendCommandToMatterbridge('addplugin', pluginName);
    };

    // Function that sends the "removeplugin" command
    const handleRemovePluginClick = () => {
      handleSnackOpen();
      console.log('handleRemovePluginClick', pluginName);
      sendCommandToMatterbridge('removeplugin', pluginName);
    };

    const theme = createTheme({
      palette: {
        primary: {
          main: '#4CAF50', // your custom primary color
        },
      },
    });

    return (
      <div className="MbfWindowDiv">
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText">Add remove plugin</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', flex: '1 1 auto', alignItems: 'center', justifyContent: 'space-between', margin: '0px', padding: '10px', gap: '20px' }}>
          <Snackbar anchorOrigin={{vertical: 'bottom', horizontal: 'right'}} open={open} onClose={handleSnackClose} autoHideDuration={5000}>
            <Alert onClose={handleSnackClose} severity="info" variant="filled" sx={{ width: '100%', bgcolor: '#4CAF50' }}>Restart required</Alert>
          </Snackbar>
          <TextField value={pluginName} onChange={(event) => { setPluginName(event.target.value); }} size="small" id="plugin-name" label="Plugin name or plugin path" variant="outlined" fullWidth/>
          <Tooltip title="Install or update a plugin from npm">
            <Button onClick={handleInstallPluginClick} theme={theme} color="primary" variant='contained' size="small" aria-label="install" endIcon={<DownloadIcon />} style={{ color: '#ffffff', height: '30px' }}> Install</Button>
          </Tooltip>        
          <Tooltip title="Add an installed plugin">
            <Button onClick={handleAddPluginClick} theme={theme} color="primary" variant='contained' size="small" aria-label="add" endIcon={<AddIcon />} style={{ color: '#ffffff', height: '30px' }}> Add</Button>
          </Tooltip>        
          <Tooltip title="Remove a registered plugin">
            <Button onClick={handleRemovePluginClick} theme={theme} color="primary" variant='contained' size="small" aria-label="remove" endIcon={<RemoveIcon />} style={{ color: '#ffffff', height: '30px' }}> Remove</Button>
          </Tooltip>        
        </div>
      </div>
    );
  }

  // This function takes systemInfo as a parameter
  // It returns a table element with the systemInfo
  function SystemInfoTable({ systemInfo }) {
    return (
      <table>
        <thead>
          <tr>
            <th colSpan="2" className="table-header">System Information</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(systemInfo).map(([key, value], index) => (
            <tr key={key} className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'}>
              <td className="table-content">{key}</td>
              <td className="table-content">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // This function takes systemInfo as a parameter
  // It returns a table element with the systemInfo
  function MatterbridgeInfoTable({ matterbridgeInfo }) {
    return (
      <table>
        <thead>
          <tr>
            <th colSpan="2" className="table-header">Matterbridge Information</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(matterbridgeInfo).map(([key, value], index) => (
            <tr key={key} className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'}>
              <td className="table-content">{key}</td>
              <td className="table-content">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // This function takes four parameters: qrText, qrWidth, topText, and bottomText
  // It returns a div element with a rectangle, a QR code, and two texts
  function QRDiv({ qrText, pairingText, qrWidth, topText, bottomText }) {
    return (
      <div className="MbfWindowDiv" style={{alignItems: 'center'}} minWidth='360px'>
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{textAlign: 'center'}}>{topText}</p>
        </div>
        <QRCode value={qrText} size={qrWidth} bgColor='#9e9e9e' style={{ margin: '20px' }}/>
        <div  className="MbfWindowFooter">
          <div>
            <p style={{ margin: 0, textAlign: 'center' }}>Use {pairingText} or scan the QR to pair</p>
            <p className="text-color-selected" style={{ margin: 0, textAlign: 'center' }}>{bottomText}</p>
          </div>
        </div>
      </div>
    );
  }

export default Home;
