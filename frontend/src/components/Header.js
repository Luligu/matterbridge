/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
 
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
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AnnouncementOutlinedIcon from '@mui/icons-material/AnnouncementOutlined';

import { sendCommandToMatterbridge } from '../App';
import { WebSocketContext } from './WebSocketContext';
import { OnlineContext } from './OnlineContext';

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

function Header() {
  const { online } = useContext(OnlineContext);
  const { messages, sendMessage, logMessage } = useContext(WebSocketContext);
  const [backdropOpen, setBackdropOpen] = useState(false);
  // const [wssHost, setWssHost] = useState(null);
  // const [qrCode, setQrCode] = useState('');
  // const [pairingCode, setPairingCode] = useState('');
  // const [systemInfo, setSystemInfo] = useState({});
  const [matterbridgeInfo, setMatterbridgeInfo] = useState({});
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [backupMenuAnchorEl, setBackupMenuAnchorEl] = useState(null);
  const [downloadMenuAnchorEl, setDownloadMenuAnchorEl] = useState(null);

  const handleBackdropClose = () => {
    setBackdropOpen(false);
  };

  const handleSponsorClick = () => {
    window.open('https://www.buymeacoffee.com/luligugithub', '_blank');
  };

  const handleHelpClick = (row) => {
    window.open(`https://github.com/Luligu/matterbridge/blob/main/README.md`, '_blank');
  };

  const handleChangelogClick = () => {
    window.open(`https://github.com/Luligu/matterbridge/blob/main/CHANGELOG.md`, '_blank');
  };

  const handleUpdateClick = () => {
    logMessage('Matterbridge', `Updating matterbridge...`);
    sendCommandToMatterbridge('update','now');
  };

  const handleRestartClick = () => {
    logMessage('Matterbridge', `Restarting matterbridge...`);
    if(matterbridgeInfo.restartMode==='') {
      sendCommandToMatterbridge('restart','now');
    }
    else {
      sendCommandToMatterbridge('shutdown','now');
    }
  };

  const handleShutdownClick = () => {
    logMessage('Matterbridge', `Shutting down matterbridge...`);
    sendCommandToMatterbridge('shutdown','now');
    /*
    setBackdropOpen(true);
    setTimeout(() => {
      setBackdropOpen(false);
      window.location.href = window.location.origin;
    }, 60 * 1000);
    */
  };

  const handleMenuOpen = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = (value) => {
    console.log('handleCloseCommand:', value);
    setMenuAnchorEl(null);
    if(value==='download-mblog') {
      logMessage('Matterbridge', `Downloading matterbridge log...`);
      window.location.href = '/api/download-mblog';
    } else if(value==='download-mjlog') {
      logMessage('Matterbridge', `Downloading matter log...`);
      window.location.href = '/api/download-mjlog';
    } else if(value==='download-mbstorage') {
      logMessage('Matterbridge', `Downloading matterbridge storage...`);
      window.location.href = '/api/download-mbstorage';
    } else if(value==='download-mjstorage') {
      logMessage('Matterbridge', `Downloading matter storage...`);
      window.location.href = '/api/download-mjstorage';
    } else if(value==='download-pluginstorage') {
      window.location.href = '/api/download-pluginstorage';
    } else if(value==='download-pluginconfig') {
      window.location.href = '/api/download-pluginconfig';
    } else if(value==='download-backup') {
      logMessage('Matterbridge', `Downloading backup...`);
      window.location.href = '/api/download-backup';
    } else if(value==='update') {
      handleUpdateClick();
    } else if(value==='restart') {
      handleRestartClick();
    } else if(value==='shutdown') {
      handleShutdownClick();
    } else if(value==='create-backup') {
      logMessage('Matterbridge', `Creating backup...`);
      sendCommandToMatterbridge('backup','create');
    } else if(value==='unregister') {
      logMessage('Matterbridge', `Uregistering all bridged devices...`);
      sendCommandToMatterbridge('unregister','now');
    } else if(value==='reset') {
      logMessage('Matterbridge', `Resetting matterbridge commissioning...`);
      sendCommandToMatterbridge('reset','now');
    } else if(value==='factoryreset') {
      logMessage('Matterbridge', `Factory reset of matterbridge...`);
      sendCommandToMatterbridge('factoryreset','now');
    }
  };

  const handleBackupMenuOpen = (event) => {
    setBackupMenuAnchorEl(event.currentTarget);
  };

  const handleBackupMenuClose = () => {
    setBackupMenuAnchorEl(null);
  };

  const handleDownloadMenuOpen = (event) => {
    setDownloadMenuAnchorEl(event.currentTarget);
  };

  const handleDownloadMenuClose = () => {
    setDownloadMenuAnchorEl(null);
  };

  // Fetch settings from the backend
  const fetchSettings = () => {

    fetch('/api/settings')
      .then(response => response.json())
      .then(data => { 
        console.log('From header /api/settings (header):', data); 
        // setOnline(true);
        // setWssHost(data.wssHost); 
        // setQrCode(data.qrPairingCode); 
        // setPairingCode(data.manualPairingCode);
        // setSystemInfo(data.systemInformation);
        setMatterbridgeInfo(data.matterbridgeInformation);
        // localStorage.setItem('wssHost', data.wssHost);
        // localStorage.setItem('qrPairingCode', data.qrPairingCode); 
        // localStorage.setItem('manualPairingCode', data.manualPairingCode); 
        // localStorage.setItem('systemInformation', data.systemInformation); 
        localStorage.setItem('matterbridgeInformation', data.matterbridgeInformation); 
      })
      .catch(error => {
        console.log('Error fetching settings:', error);
        // setOnline(false);
      });
  };

  useEffect(() => {
    // Call fetchSettings immediately and then every 10 minutes
    fetchSettings();
    const fetchInterval = setInterval(fetchSettings, 60 * 1000);
  
    // Clear the interval when the component is unmounted
    return () => clearInterval(fetchInterval);
    
  }, []); // The empty array causes this effect to run only once

  return (
    <div className="header" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
    <ThemeProvider theme={theme}>
      <div className="header" style={{ flex: 1, display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center' }}>
        <img src="matterbridge 64x64.png" alt="Matterbridge Logo" style={{ height: '30px' }} />
        <h2 style={{ fontSize: '22px' }}>Matterbridge</h2>
        <nav>
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/devices" className="nav-link">Devices</Link>
          <Link to="/log" className="nav-link">Logs</Link>
          <Link to="/settings" className="nav-link">Settings</Link>
        </nav>
      </div>
      <div className="header" style={{ flex: 1, display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
        <Tooltip title="Sponsor Matterbridge and its plugins">
          {online ? <span className="status-enabled">Online</span> : <span className="status-disabled">Offline</span>}
        </Tooltip>        
        <Tooltip title="Sponsor Matterbridge and its plugins">
          <span className="status-sponsor" onClick={handleSponsorClick}>Sponsor</span> 
        </Tooltip>        
        {matterbridgeInfo.matterbridgeLatestVersion === undefined || matterbridgeInfo.matterbridgeVersion === matterbridgeInfo.matterbridgeLatestVersion ?
          <Tooltip title="Matterbridge version"><span className="status-information" onClick={handleChangelogClick}>v.{matterbridgeInfo.matterbridgeVersion}</span></Tooltip> :
          <Tooltip title="New Matterbridge version available, click to install"><span className="status-warning" onClick={handleUpdateClick}>Update v.{matterbridgeInfo.matterbridgeVersion} to v.{matterbridgeInfo.matterbridgeLatestVersion}</span></Tooltip> 
        }  
        {/* <Tooltip title="Matterbridge help">
          <span className="status-information" onClick={handleHelpClick}>help</span>
        </Tooltip>
        <Tooltip title="Matterbridge version history">
          <span className="status-information" onClick={handleChangelogClick}>info</span>
        </Tooltip>*/}
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
      </div>
      <div className="header" style={{ flex: 1, display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: '5px' }}>
        {/* <Tooltip title="Update matterbridge">
          <Button theme={theme} color="primary" variant="contained" size="small" endIcon={<SystemUpdateAltIcon />} style={{ color: '#ffffff' }} onClick={handleUpdateClick}>Update</Button>
        </Tooltip>        
        <Tooltip title="Restart matterbridge">
          <Button theme={theme} color="primary" variant="contained" size="small" endIcon={<RestartAltIcon />} style={{ color: '#ffffff' }} onClick={handleRestartClick}>Restart</Button>
        </Tooltip>
        {matterbridgeInfo.restartMode === '' ? (        
          <Tooltip title="Shut down matterbridge">
            <Button theme={theme} color="primary" variant="contained" size="small" endIcon={<PowerSettingsNewIcon />} style={{ color: '#ffffff' }} onClick={handleShutdownClick}>Shutdown</Button>
          </Tooltip>
        ) : null}*/}        
        <Tooltip title="Matterbridge help">
          <IconButton onClick={handleHelpClick}>
            <HelpOutlineIcon fontSize="small"/>
          </IconButton>
        </Tooltip>
        <Tooltip title="Matterbridge changelog">
          <IconButton onClick={handleChangelogClick}>
            <AnnouncementOutlinedIcon fontSize="small"/>
          </IconButton>
        </Tooltip>
        <Tooltip title="Update matterbridge">
          <IconButton onClick={handleUpdateClick}>
            <SystemUpdateAltIcon fontSize="small"/>
          </IconButton>
        </Tooltip>
        <Tooltip title="Restart matterbridge">
          <IconButton onClick={handleRestartClick}>
            <RestartAltIcon fontSize="small"/>
          </IconButton>
        </Tooltip>
        {matterbridgeInfo.restartMode === '' ? (        
          <Tooltip title="Shut down matterbridge">
            <IconButton onClick={handleShutdownClick}>
              <PowerSettingsNewIcon fontSize="small"/>
            </IconButton>
          </Tooltip>
        ) : null}        
        <Tooltip title="Download, backup and more">
          <IconButton onClick={handleMenuOpen}>
            <MoreHoriz fontSize="small"/>
          </IconButton>
        </Tooltip>
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
          <MenuItem onClick={handleDownloadMenuOpen}>
            <ListItemIcon><DownloadIcon /></ListItemIcon>
            <ListItemText primary="Download" />
          </MenuItem>
            <Menu id="sub-menu-download" anchorEl={downloadMenuAnchorEl} keepMounted open={Boolean(downloadMenuAnchorEl)} onClose={handleDownloadMenuClose} sx={{ '& .MuiPaper-root': { backgroundColor: '#e2e2e2' } }}>
              <MenuItem onClick={() => { handleMenuClose('download-mblog'); handleDownloadMenuClose(); }}>
                  <ListItemIcon><DownloadIcon /></ListItemIcon>
                  <ListItemText primary="Matterbridge log" />
              </MenuItem>
              <MenuItem onClick={() => { handleMenuClose('download-mjlog'); handleDownloadMenuClose(); }}>
                  <ListItemIcon><DownloadIcon /></ListItemIcon>
                  <ListItemText primary="Matter log" />
              </MenuItem>
              <MenuItem onClick={() => { handleMenuClose('download-mbstorage'); handleDownloadMenuClose(); }}>
                  <ListItemIcon><DownloadIcon /></ListItemIcon>
                  <ListItemText primary="Matterbridge storage" />
              </MenuItem>
              <MenuItem onClick={() => { handleMenuClose('download-mjstorage'); handleDownloadMenuClose(); }}>
                  <ListItemIcon><DownloadIcon /></ListItemIcon>
                  <ListItemText primary="Matter storage" />
              </MenuItem>
            </Menu>
          <Divider />
          <MenuItem onClick={handleBackupMenuOpen}>
            <ListItemIcon><SaveIcon /></ListItemIcon>
            <ListItemText primary="Backup" />
          </MenuItem>
            <Menu id="sub-menu-backup" anchorEl={backupMenuAnchorEl} keepMounted open={Boolean(backupMenuAnchorEl)} onClose={handleBackupMenuClose} sx={{ '& .MuiPaper-root': { backgroundColor: '#e2e2e2' } }}>
              <MenuItem onClick={() => { handleMenuClose('create-backup'); handleBackupMenuClose(); }}>
                <ListItemIcon><SaveIcon /></ListItemIcon>
                <ListItemText primary="Create backup" />
              </MenuItem>
              <MenuItem onClick={() => { handleMenuClose('download-backup'); handleBackupMenuClose(); }}>
                <ListItemIcon><SaveIcon /></ListItemIcon>
                <ListItemText primary="Download backup" />
              </MenuItem>
            </Menu>

          <Divider />
          <MenuItem onClick={() => handleMenuClose('unregister')}>
            <ListItemIcon><PowerSettingsNewIcon /></ListItemIcon>
            <ListItemText primary="Unregister all devices" />
          </MenuItem>
          <MenuItem onClick={() => handleMenuClose('reset')}>
            <ListItemIcon><PowerSettingsNewIcon /></ListItemIcon>
            <ListItemText primary="Reset commissioning" />
          </MenuItem>
          <MenuItem onClick={() => handleMenuClose('factoryreset')}>
            <ListItemIcon><PowerSettingsNewIcon /></ListItemIcon>
            <ListItemText primary="Factory reset" />
          </MenuItem>


        </Menu>
        <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={backdropOpen} onClick={handleBackdropClose}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    </ThemeProvider>  
    </div>
  );
}

export default Header;

/*
*/
