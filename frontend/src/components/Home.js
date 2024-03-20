// Home.js
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode.react';
import { StatusIndicator } from './StatusIndicator';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { Tooltip, IconButton } from '@mui/material';
import { sendCommandToMatterbridge } from './Header';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

// npm install @mui/material @emotion/react @emotion/styled
// npm install @mui/icons-material @mui/material @emotion/styled @emotion/react

function Home() {
  const [qrCode, setQrCode] = useState('');
  const [systemInfo, setSystemInfo] = useState({});
  const [plugins, setPlugins] = useState([]);
  const [selectedRow, setSelectedRow] = useState(-1); // -1 no selection, 0 or greater for selected row
  const [selectedPluginName, setSelectedPluginName] = useState('none'); // -1 no selection, 0 or greater for selected row

  const [open, setSnack] = React.useState(false);

  const handleSnackOpen = () => () => {
    setSnack(true);
  };

  const handleSnackClose = () => {
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
      { Header: 'Status', accessor: 'status', Cell: ({ value }) => <StatusIndicator status={value} /> },
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
    setSnack(true);
    console.log('Updating page');
    setPlugins(prevPlugins => [...prevPlugins]);
    handleSnackOpen({ vertical: 'bottom', horizontal: 'right' });
    // Set a timeout to update the page after 5 seconds
    /*
    setTimeout(() => {
      // Trigger a state update
      console.log('Updating page after 20 seconds');
      setPlugins(prevPlugins => [...prevPlugins]);
      window.location.reload();
    }, 20000);
    */
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: 'calc(100vh - 60px - 40px)', width: 'calc(100vw - 40px)', gap: '20px', margin: '0', padding: '0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: '0 1 auto'/*, width: '310px'*/, gap: '20px' }}>
        {qrCode && <QRDiv qrText={qrCode} qrWidth={256} topText="QRCode" bottomText={selectedPluginName==='none'?'Matterbridge':selectedPluginName} />}
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
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto' }}>
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
                      </> : 
                      <>
                        {plugin.loaded && plugin.started && plugin.configured && plugin.paired===undefined && plugin.connected===undefined ? 
                          <>
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

  //data.push({ name: plugin.name, description: plugin.description, version: plugin.version, author: plugin.author, type: plugin.type, devices: count, status: plugin.enabled! });
  
  // This function takes four parameters: qrText, qrWidth, topText, and bottomText
  // It returns a div element with a rectangle, a QR code, and two texts
  function QRDiv({ qrText, qrWidth, topText, bottomText }) {
    // Define the style for the div element
    const divStyle = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxShadow: '5px 5px 10px #888',
      border: '1px solid #ddd',
      backgroundColor: '#9e9e9e'
    };
  
    // Define the style for the text element
    const textStyle = {
      fontWeight: 'bold',
      color: 'white'
    };
  
    // Define the style for the header element
    const headerStyle = {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '30px',
      backgroundColor: '#4CAF50',
      color: 'white',
      border: '1px solid #ddd'
    };

    // Define the style for the header element
    const footerStyle = {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      //width: '100%',
      height: '30px',
      color: 'black',
      margin: '0px',
      padding: '10px',
      paddingTop: '0px',
    };
  
    // Return the JSX code for the div element
    return (
      <div className="main-background" style={divStyle}>
        <div style={headerStyle}>
          <p style={textStyle}>{topText}</p>
        </div>
        <QRCode value={qrText} size={qrWidth} bgColor={divStyle.backgroundColor} style={{ marginTop: '20px', marginBottom: '20px' }}/>
        <div style={footerStyle}>
          <div>
            <p style={{ margin: 0, textAlign: 'center' }}>Scan me to pair</p>
            <p className="text-color-selected" style={{ margin: 0, textAlign: 'center' }}>{bottomText}</p>
          </div>
        </div>
      </div>
    );
  }

export default Home;
