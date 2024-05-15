// Header.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tooltip, Button, createTheme, IconButton, Backdrop, CircularProgress } from '@mui/material';
import { Help, Announcement } from '@mui/icons-material';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

/*
*/

export const theme = createTheme({
  palette: {
    primary: {
      main: '#4CAF50', // your custom primary color
    },
  },
});

export function sendCommandToMatterbridge(command, param, body) {
  const sanitizedParam = param.replace(/\\/g, '*');
  console.log('sendCommandToMatterbridge:', command, param, sanitizedParam);
  // Send a POST request to the Matterbridge API
  fetch(`/api/command/${command}/${sanitizedParam}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(json => {
    console.log('Command sent successfully:', json);
  })
  .catch(error => {
    console.error('Error sending command:', error);
  });
}

function Header() {
  const [open, setOpen] = React.useState(false);
  const [wssHost, setWssHost] = useState(null);
  const [qrCode, setQrCode] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [systemInfo, setSystemInfo] = useState({});
  const [matterbridgeInfo, setMatterbridgeInfo] = useState({});

  const handleClose = () => {
    setOpen(false);
  };

  const handleSponsorClick = () => {
    window.open('https://www.buymeacoffee.com/luligugithub', '_blank');
  };

  const handleHelp = (row) => {
    window.open(`https://github.com/Luligu/matterbridge/blob/main/README.md`, '_blank');
  };

  const handleChangelog = () => {
    window.open(`https://github.com/Luligu/matterbridge/blob/main/CHANGELOG.md`, '_blank');
  };


  const handleUpdateClick = () => {
    sendCommandToMatterbridge('update','now');
    setOpen(true);
    setTimeout(() => {
      setOpen(false);
      window.location.reload();
    }, 20000);
  };

  const handleRestartClick = () => {
    if(matterbridgeInfo.restartMode==='')
      sendCommandToMatterbridge('restart','now');
    else
      sendCommandToMatterbridge('shutdown','now');
    setOpen(true);
    setTimeout(() => {
      setOpen(false);
      window.location.reload();
    }, 20000);
  };

  const handleShutdownClick = () => {
    sendCommandToMatterbridge('shutdown','now');
    setOpen(true);
    setTimeout(() => {
      setOpen(false);
      window.location.reload();
    }, 20000);
  };

  useEffect(() => {
    // Fetch settinggs from the backend
    fetch('/api/settings')
      .then(response => response.json())
      .then(data => { 
        console.log('/api/settings (header):', data); 
        setWssHost(data.wssHost); 
        setQrCode(data.qrPairingCode); 
        setPairingCode(data.manualPairingCode);
        setSystemInfo(data.systemInformation);
        setMatterbridgeInfo(data.matterbridgeInformation);
        localStorage.setItem('wssHost', data.wssHost);
        localStorage.setItem('qrPairingCode', data.qrPairingCode); 
        localStorage.setItem('manualPairingCode', data.manualPairingCode); 
        localStorage.setItem('systemInformation', data.systemInformation); 
        localStorage.setItem('matterbridgeInformation', data.matterbridgeInformation); 
      })
      .catch(error => console.error('Error fetching settings:', error));

  }, []); // The empty array causes this effect to run only once

  return (
    <div className="header">
      <img src="matterbridge 64x64.png" alt="Matterbridge Logo" style={{ height: '30px' }} />
      <h2>Matterbridge</h2>
      <nav>
        <Link to="/" className="nav-link">Home</Link>
        <Link to="/devices" className="nav-link">Devices</Link>
        <Link to="/log" className="nav-link">Logs</Link>
        <Link to="/settings" className="nav-link">Settings</Link>
      </nav>
      <div className="header" style={{ flex: 1, display: 'flex', flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Tooltip title="Sponsor Matterbridge and its plugins">
          <span className="status-sponsor" onClick={handleSponsorClick}>Sponsor</span> 
        </Tooltip>        
        {matterbridgeInfo.matterbridgeLatestVersion === undefined || matterbridgeInfo.matterbridgeVersion === matterbridgeInfo.matterbridgeLatestVersion ?
          <Tooltip title="Matterbridge version"><span className="status-information" onClick={handleChangelog}>v{matterbridgeInfo.matterbridgeVersion}</span></Tooltip> :
          <Tooltip title="New Matterbridge version available"><span className="status-warning" onClick={handleUpdateClick}>current v{matterbridgeInfo.matterbridgeVersion} latest v{matterbridgeInfo.matterbridgeLatestVersion}</span></Tooltip> 
        }  
        <Tooltip title="Matterbridge help">
          <span className="status-information" onClick={handleHelp}>help</span>
        </Tooltip>
        <Tooltip title="Matterbridge version history">
          <span className="status-information" onClick={handleChangelog}>info</span>
        </Tooltip>
        {matterbridgeInfo.bridgeMode !== '' ? (        
          <Tooltip title="Bridge mode">
            <span className="status-information" style={{ cursor: 'default' }}>{matterbridgeInfo.bridgeMode}</span>
          </Tooltip>
        ) : null}
        {matterbridgeInfo.restartMode !== '' ? (        
          <Tooltip title="Restart mode">
            <span className="status-information" style={{ cursor: 'default' }}>{matterbridgeInfo.restartMode}</span>
          </Tooltip>        
        ) : null}
        <Tooltip title="Update matterbridge">
          <Button theme={theme} color="primary" variant="contained" size="small" endIcon={<SystemUpdateAltIcon />} style={{ color: '#ffffff' }} onClick={handleUpdateClick}>Update</Button>
        </Tooltip>        
        <Tooltip title="Restart matterbridge">
          <Button theme={theme} color="primary" variant="contained" size="small" endIcon={<RestartAltIcon />} style={{ color: '#ffffff' }} onClick={handleRestartClick}>Restart</Button>
        </Tooltip>
        {matterbridgeInfo.restartMode === '' ? (        
          <Tooltip title="Shut down matterbridge">
            <Button theme={theme} color="primary" variant="contained" size="small" endIcon={<PowerSettingsNewIcon />} style={{ color: '#ffffff' }} onClick={handleShutdownClick}>Shutdown</Button>
          </Tooltip>
        ) : null}        
        <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={open} onClick={handleClose}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    </div>
  );
}

export default Header;
