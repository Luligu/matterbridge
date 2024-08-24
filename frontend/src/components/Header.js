/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
// Header.js
import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Tooltip, Button, createTheme, Backdrop, CircularProgress, ThemeProvider, IconButton, Menu, MenuItem, Divider, ListItemIcon, ListItemText } from '@mui/material';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import { MoreHoriz } from '@mui/icons-material';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';

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
  const [open, setOpen] = useState(false);
  const [wssHost, setWssHost] = useState(null);
  const [qrCode, setQrCode] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [systemInfo, setSystemInfo] = useState({});
  const [matterbridgeInfo, setMatterbridgeInfo] = useState({});
  const { messages, sendMessage, logMessage } = useContext(WebSocketContext);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [subMenuAnchorEl, setSubMenuAnchorEl] = useState(null);


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

  const handleMenuClick = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = (value) => {
    console.log('handleCloseCommand:', value);
    setMenuAnchorEl(null);
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
    } else if(value==='download-backup') {
      window.location.href = '/api/download-backup';
    } else if(value==='update') {
      handleUpdateClick();
    } else if(value==='restart') {
      handleRestartClick();
    } else if(value==='shutdown') {
      handleShutdownClick();
    } else if(value==='create-backup') {
      sendCommandToMatterbridge('backup','create');
    }
  };

  const handleSubMenuClick = (event) => {
    setSubMenuAnchorEl(event.currentTarget);
  };

  const handleSubMenuClose = () => {
    setSubMenuAnchorEl(null);
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
        <IconButton onClick={handleMenuClick}>
          <MoreHoriz />
        </IconButton>
        <Menu id="command-menu" anchorEl={menuAnchorEl} keepMounted open={Boolean(menuAnchorEl)} onClose={() => handleMenuClose('')} sx={{ '& .MuiPaper-root': { backgroundColor: '#e2e2e2' } }}>
          <MenuItem onClick={() => handleMenuClose('update')}>
            <ListItemIcon><SystemUpdateAltIcon /></ListItemIcon>
            <ListItemText primary="Update" />
          </MenuItem>
          <MenuItem onClick={() => handleMenuClose('restart')}>
            <ListItemIcon><RestartAltIcon /></ListItemIcon>
            <ListItemText primary="Restart" />
          </MenuItem>
          {matterbridgeInfo.restartMode === '' ? 
            <MenuItem onClick={() => handleMenuClose('shutdown')}>
              <ListItemIcon><PowerSettingsNewIcon /></ListItemIcon>
              <ListItemText primary="Shutdown" />
            </MenuItem>
           : null }
          <Divider />
          <MenuItem onClick={() => handleMenuClose('download-mblog')}>
              <ListItemIcon><DownloadIcon /></ListItemIcon>
              <ListItemText primary="Download matterbridge.log" /></MenuItem>
          <MenuItem onClick={() => handleMenuClose('download-mjlog')}>
              <ListItemIcon><DownloadIcon /></ListItemIcon>
              <ListItemText primary="Download matter.log" /></MenuItem>
          <MenuItem onClick={() => handleMenuClose('download-mjstorage')}>
              <ListItemIcon><DownloadIcon /></ListItemIcon>
              <ListItemText primary="Download matter storage" /></MenuItem>
          <MenuItem onClick={() => handleMenuClose('download-mbstorage')}>
              <ListItemIcon><DownloadIcon /></ListItemIcon>
              <ListItemText primary="Download node storage" /></MenuItem>
          <Divider />
          <MenuItem onClick={handleSubMenuClick}>
            <ListItemIcon><SaveIcon /></ListItemIcon>
            <ListItemText primary="Backup" />
          </MenuItem>
            <Menu
              id="sub-menu"
              anchorEl={subMenuAnchorEl}
              keepMounted
              open={Boolean(subMenuAnchorEl)}
              onClose={handleSubMenuClose}
              sx={{ '& .MuiPaper-root': { backgroundColor: '#e2e2e2' } }}
            >
              <MenuItem onClick={() => { handleMenuClose('create-backup'); handleSubMenuClose(); }}>Create backup</MenuItem>
              <MenuItem onClick={() => { handleMenuClose('download-backup'); handleSubMenuClose(); }}>Download backup</MenuItem>
            </Menu>
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
          <Divider />
          <MenuItem onClick={handleSubMenuClick}>Backup Options</MenuItem>
            <Menu
              id="sub-menu"
              anchorEl={subMenuAnchorEl}
              keepMounted
              open={Boolean(subMenuAnchorEl)}
              onClose={handleSubMenuClose}
              sx={{ '& .MuiPaper-root': { backgroundColor: '#e2e2e2' } }}
            >
              <MenuItem onClick={() => { handleMenuClose('create-backup'); handleSubMenuClose(); }}>Create backup</MenuItem>
              <MenuItem onClick={() => { handleMenuClose('download-backup'); handleSubMenuClose(); }}>Download backup</MenuItem>
            </Menu>
*/
export default Header;
