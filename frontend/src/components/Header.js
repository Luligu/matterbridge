/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
// Header.js
import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Tooltip, Button, createTheme, Backdrop, CircularProgress, ThemeProvider, IconButton, Menu, MenuItem, Divider } from '@mui/material';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import { MoreHoriz } from '@mui/icons-material';

import { sendCommandToMatterbridge } from '../App';
import { WebSocketContext } from './WebSocketContext';

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
  const { messages, sendMessage, logMessage } = useContext(WebSocketContext);
  const [anchorEl, setAnchorEl] = React.useState(null);

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
    logMessage('Matterbridge', `Updating matterbridge...`);
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
    logMessage('Matterbridge', `Restarting matterbridge...`);
    if(matterbridgeInfo.restartMode==='') {
      sendCommandToMatterbridge('restart','now');
    }
    else {
      sendCommandToMatterbridge('shutdown','now');
    }
    /*
    setOpen(true);
    setTimeout(() => {
      setOpen(false);
      window.location.href = window.location.origin;
    }, 3000);
    */
  };

  const handleShutdownClick = () => {
    logMessage('Matterbridge', `Shutting down matterbridge...`);
    sendCommandToMatterbridge('shutdown','now');
    /*
    setOpen(true);
    setTimeout(() => {
      setOpen(false);
      window.location.href = window.location.origin;
    }, 3000);
    */
  };

  const handleClickCommand = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseCommand = (value) => {
    console.log('handleCloseCommand:', value);
    setAnchorEl(null);
    if(value==='download-mblog') {
      window.location.href = '/api/download-mblog';
    } else if(value==='download-mjlog') {
      window.location.href = '/api/download-mjlog';
    } else if(value==='download-mbstorage') {
      window.location.href = '/api/download-mbstorage';
    } else if(value==='download-mjstorage') {
      window.location.href = '/api/download-mjstorage';
    } else if(value==='download-pluginstorage') {
      window.location.href = '/api/download-pluginstorage';
    } else if(value==='download-pluginconfig') {
      window.location.href = '/api/download-pluginconfig';
    } else if(value==='update') {
      handleUpdateClick();
    } else if(value==='restart') {
      handleRestartClick();
    } else if(value==='shutdown') {
      handleShutdownClick();
    }
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
          <Tooltip title="Matterbridge version"><span className="status-information" onClick={handleChangelog}>v.{matterbridgeInfo.matterbridgeVersion}</span></Tooltip> :
          <Tooltip title="New Matterbridge version available, click to install"><span className="status-warning" onClick={handleUpdateClick}>Update v.{matterbridgeInfo.matterbridgeVersion} to v.{matterbridgeInfo.matterbridgeLatestVersion}</span></Tooltip> 
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
        <IconButton onClick={handleClickCommand}>
          <MoreHoriz />
        </IconButton>
        <Menu id="command-menu" anchorEl={anchorEl} keepMounted open={Boolean(anchorEl)} onClose={() => handleCloseCommand('')} sx={{ '& .MuiPaper-root': { backgroundColor: '#e2e2e2' } }}>
          <MenuItem onClick={() => handleCloseCommand('update')}>Update</MenuItem>
          <MenuItem onClick={() => handleCloseCommand('restart')}>Restart</MenuItem>
          {matterbridgeInfo.restartMode === '' ? ( <MenuItem onClick={() => handleCloseCommand('shutdown')}>Shutdown</MenuItem> ) : null }
          <Divider />
          <MenuItem onClick={() => handleCloseCommand('download-mblog')}>Download matterbridge.log</MenuItem>
          <MenuItem onClick={() => handleCloseCommand('download-mjlog')}>Download matter.log</MenuItem>
          <MenuItem onClick={() => handleCloseCommand('download-mjstorage')}>Download matter storage</MenuItem>
          <MenuItem onClick={() => handleCloseCommand('download-mbstorage')}>Download node storage</MenuItem>
          <MenuItem onClick={() => handleCloseCommand('download-pluginstorage')}>Download plugin storage</MenuItem>
          <MenuItem onClick={() => handleCloseCommand('download-pluginconfig')}>Download plugins config files</MenuItem>
        </Menu>
        <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={open} onClick={handleClose}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    </ThemeProvider>  
    </div>
  );
}
/*
 sx={{ '& .MuiPaper-root': { backgroundColor: '#e2e2e2' } }}
        <IconButton onClick={handleClickCommand}>
          <MoreHoriz />
        </IconButton>
        <Menu id="command-menu" anchorEl={anchorEl} keepMounted open={Boolean(anchorEl)} onClose={() => handleCloseCommand('')}>
          <MenuItem onClick={() => handleCloseCommand('download-log')}>Download log</MenuItem>
          <MenuItem onClick={() => handleCloseCommand('download-log')}>Download storage</MenuItem>
          <MenuItem onClick={() => handleCloseCommand('download-log')}>Download configs</MenuItem>
        </Menu>
*/
export default Header;
