// Home.js
import React, { useEffect, useState, ChangeEvent } from 'react';
import QRCode from 'qrcode.react';
import { StatusIndicator } from './StatusIndicator';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { Tooltip, IconButton, Button, createTheme } from '@mui/material';
import { sendCommandToMatterbridge } from './Header';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

// npm install @mui/material @emotion/react @emotion/styled
// npm install @mui/icons-material @mui/material @emotion/styled @emotion/react

function Home() {
  const [qrCode, setQrCode] = useState('');
  const [systemInfo, setSystemInfo] = useState({});
  const [matterbridgeInfo, setMatterbridgeInfo] = useState({});
  const [plugins, setPlugins] = useState([]);
  const [selectedRow, setSelectedRow] = useState(-1); // -1 no selection, 0 or greater for selected row
  const [selectedPluginName, setSelectedPluginName] = useState('none'); // -1 no selection, 0 or greater for selected row
  const [open, setSnack] = React.useState(false);

  const handleSnackOpen = () => {
    console.log('handleSnackOpen');
    setSnack(true);
  };

  const handleSnackClose = () => {
    console.log('handleSnackClose');
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
      { Header: 'Status', accessor: 'status'/*, Cell: ({ value }) => <StatusIndicator status={value} /> */},
    ],
    []
  );

 /*
 */
  useEffect(() => {
    // Fetch QR Code
    fetch('/api/qr-code')
      .then(response => response.json())
      .then(data => { 
      setQrCode(data.qrPairingCode); 
      console.log('/api/qr-code:', data.qrPairingCode);
      localStorage.setItem('qrCode', data.qrPairingCode); // Save the QR code in localStorage
      })
      .catch(error => console.error('Error fetching QR code:', error));

    // Fetch System Info
    fetch('/api/system-info')
      .then(response => response.json())
      .then(data => { setSystemInfo(data); console.log('/api/system-info:', data) })
      .catch(error => console.error('Error fetching system info:', error));

      // Fetch Matterbridge Info
    fetch('/api/matterbridge-info')
      .then(response => response.json())
      .then(data => { setMatterbridgeInfo(data); console.log('/api/matterbridge-info:', data) })
      .catch(error => console.error('Error fetching matterbridge info:', error));

    // Fetch Plugins
    fetch('/api/plugins')
      .then(response => response.json())
      .then(data => { setPlugins(data); console.log('/api/plugins:', data)})
      .catch(error => console.error('Error fetching plugins:', error));

  }, []); // The empty array causes this effect to run only once

  const handleSelect = (row) => {
    if (selectedRow === row) {
      setSelectedRow(-1);
      setSelectedPluginName('none');
      setQrCode(localStorage.getItem('qrCode'));
    } else {
      setSelectedRow(row);
      setSelectedPluginName(plugins[row].name);
      setQrCode(plugins[row].qrPairingCode);
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
  };

  /*
        {matterbridgeInfo && <MatterbridgeInfoTable matterbridgeInfo={matterbridgeInfo}/>}
  */
  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: 'calc(100vh - 60px - 40px)', width: 'calc(100vw - 40px)', gap: '20px', margin: '0', padding: '0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: '0 1 auto', gap: '20px' }}>
        {qrCode && <QRDiv qrText={qrCode} qrWidth={256} topText="QRCode" bottomText={selectedPluginName==='none'?'Matterbridge':selectedPluginName}/>}
        {systemInfo && <SystemInfoTable systemInfo={systemInfo}/>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', gap: '20px' }}>
        <AddRemovePluginsDiv plugins={plugins}/>
        <table>
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

                <td className="table-content">{plugin.name}</td>
                <td className="table-content">{plugin.description}</td>
                <td className="table-content">{plugin.version}</td>
                <td className="table-content">{plugin.author}</td>
                <td className="table-content">{plugin.type}</td>
                <td className="table-content">{plugin.registeredDevices}</td>
                <td className="table-content">{plugin.qrPairingCode ?  <>
                  <Tooltip title="Scan the QRCode"><IconButton style={{padding: 0}} className="PluginsIconButton" size="small"><QrCode2Icon /></IconButton></Tooltip>
                  </> : <></>}
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
      </div>
    </div>
  );}

  function AddRemovePluginsDiv({ plugins }) {
    const [pluginName, setPluginName] = useState('matterbridge-');

    // Function that sends the "addplugin" command
    const handleAddPluginClick = () => {
      console.log('handleAddPluginClick', pluginName);
      sendCommandToMatterbridge('addplugin', pluginName);
    };

    // Function that sends the "removeplugin" command
    const handleRemovePluginClick = () => {
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
          <TextField value={pluginName} onChange={(event) => { setPluginName(event.target.value); }} size="small" id="plugin-name" label="Plugin name or plugin path" variant="outlined" fullWidth/>
          <Tooltip title="Add a plugin">
            <Button onClick={handleAddPluginClick} theme={theme} color="primary" variant='contained' size="small" aria-label="add" endIcon={<AddIcon />} style={{ color: '#ffffff', height: '30px' }}> Add</Button>
          </Tooltip>        
          <Tooltip title="Remove a plugin">
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
  function QRDiv({ qrText, qrWidth, topText, bottomText }) {
    return (
      <div className="MbfWindowDiv" style={{alignItems: 'center'}}>
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{textAlign: 'center'}}>{topText}</p>
        </div>
        <QRCode value={qrText} size={qrWidth} bgColor='#9e9e9e' style={{ margin: '20px' }}/>
        <div  className="MbfWindowFooter">
          <div>
            <p style={{ margin: 0, textAlign: 'center' }}>Scan me to pair</p>
            <p className="text-color-selected" style={{ margin: 0, textAlign: 'center' }}>{bottomText}</p>
          </div>
        </div>
      </div>
    );
  }

export default Home;
