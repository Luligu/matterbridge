/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
// Header.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tooltip, Button, createTheme, Backdrop, CircularProgress, ThemeProvider } from '@mui/material';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

import { sendCommandToMatterbridge } from '../App';

export const theme = createTheme({
  components: {
    MuiTooltip: {
      defaultProps: {
        placement: 'top-end', 
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
    /*
    setOpen(true);
    setTimeout(() => {
      setOpen(false);
      window.location.href = window.location.origin;
    }, 5000);
    */
  };

  const handleRestartClick = () => {
    if(matterbridgeInfo.restartMode==='')
      sendCommandToMatterbridge('restart','now');
    else
      sendCommandToMatterbridge('shutdown','now');
    /*
    setOpen(true);
    setTimeout(() => {
      setOpen(false);
      window.location.href = window.location.origin;
    }, 3000);
    */
  };

  const handleShutdownClick = () => {
    sendCommandToMatterbridge('shutdown','now');
    /*
    setOpen(true);
    setTimeout(() => {
      setOpen(false);
      window.location.href = window.location.origin;
    }, 3000);
    */
  };

  useEffect(() => {
    // Fetch settings from the backend
    const fetchSettings = () => {

      fetch('/api/settings')
        .then(response => response.json())
        .then(data => { 
          console.log('From header /api/settings (header):', data); 
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
    };
  
    // Call fetchSettings immediately and then every 10 minutes
    fetchSettings();
    const intervalId = setInterval(fetchSettings, 1 * 60 * 1000);
  
    // Clear the interval when the component is unmounted
    return () => clearInterval(intervalId);
    
  }, []); // The empty array causes this effect to run only once

  return (
    <div className="header">
    <ThemeProvider theme={theme}>
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
          <Tooltip title="New Matterbridge version available"><span className="status-warning" onClick={handleChangelog}>current v{matterbridgeInfo.matterbridgeVersion} latest v{matterbridgeInfo.matterbridgeLatestVersion}</span></Tooltip> 
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
    </ThemeProvider>  
    </div>
  );
}

export default Header;
