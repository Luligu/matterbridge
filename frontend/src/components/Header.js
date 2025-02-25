/* eslint-disable no-console */

// React
import React, { useState, useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';

// @mui
import { Tooltip, IconButton, Menu, MenuItem, Divider, ListItemIcon, ListItemText } from '@mui/material';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import MoreHoriz from '@mui/icons-material/MoreHoriz';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AnnouncementOutlinedIcon from '@mui/icons-material/AnnouncementOutlined';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import IosShareIcon from '@mui/icons-material/IosShare';
import BlockIcon from '@mui/icons-material/Block';

// Frontend
import { sendCommandToMatterbridge } from './sendApiCommand';
import { UiContext } from './UiProvider';
import { WebSocketContext, WS_ID_SHELLY_SYS_UPDATE, WS_ID_SHELLY_MAIN_UPDATE } from './WebSocketProvider';
import { debug } from '../App';
// const debug = true;

function Header() {
  const { showSnackbarMessage, showConfirmCancelDialog } = useContext(UiContext);
  const { online, sendMessage, logMessage, addListener, removeListener } = useContext(WebSocketContext);
  const [settings, setSettings] = useState({});
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [backupMenuAnchorEl, setBackupMenuAnchorEl] = useState(null);
  const [downloadMenuAnchorEl, setDownloadMenuAnchorEl] = useState(null);
  const [resetMenuAnchorEl, setResetMenuAnchorEl] = useState(null);

  const handleSponsorClick = () => {
    window.open('https://www.buymeacoffee.com/luligugithub', '_blank');
  };

  const handleHelpClick = () => {
    window.open(`https://github.com/Luligu/matterbridge/blob/main/README.md`, '_blank');
  };

  const handleChangelogClick = () => {
    window.open(`https://github.com/Luligu/matterbridge/blob/main/CHANGELOG.md`, '_blank');
  };

  const handleUpdateClick = () => {
    sendMessage({ method: "/api/install", src: "Frontend", dst: "Matterbridge", params: { packageName: 'matterbridge', restart: true } });
  };

  const handleShellySystemUpdateClick = () => {
    if(debug) console.log('Header: handleShellySystemUpdateClick');
    logMessage('Matterbridge', `Installing system updates...`);
    sendMessage({ method: "/api/shellysysupdate", src: "Frontend", dst: "Matterbridge", params: { } });
  };

  const handleShellyMainUpdateClick = () => {
    if(debug) console.log('Header: handleShellyMainUpdateClick');
    logMessage('Matterbridge', `Installing software updates...`);
    sendMessage({ method: "/api/shellymainupdate", src: "Frontend", dst: "Matterbridge", params: { } });
  };

  const handleRestartClick = () => {
    if (settings.matterbridgeInformation.restartMode === '') {
      sendMessage({ method: "/api/restart", src: "Frontend", dst: "Matterbridge", params: {} });
    }
    else {
      sendMessage({ method: "/api/shutdown", src: "Frontend", dst: "Matterbridge", params: {} });
    }
  };

  const handleShutdownClick = () => {
    sendMessage({ method: "/api/shutdown", src: "Frontend", dst: "Matterbridge", params: {} });
  };

  const handleStartAdvertiseClick = () => {
    sendMessage({ method: "/api/advertise", src: "Frontend", dst: "Matterbridge", params: {} });
  };

  const handleStopAdvertiseClick = () => {
    sendMessage({ method: "/api/stopadvertise", src: "Frontend", dst: "Matterbridge", params: {} });
  };

  const handleMenuOpen = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuCloseConfirm = (value) => {
    if(debug) console.log('Header: handleMenuClose', value);
    setMenuAnchorEl(null);
    if (value === 'download-mblog') {
      logMessage('Matterbridge', `Downloading matterbridge log...`);
      showSnackbarMessage('Downloading matterbridge log...', 5);
      window.location.href = './api/download-mblog';
    } else if (value === 'download-mjlog') {
      logMessage('Matterbridge', `Downloading matter log...`);
      showSnackbarMessage('Downloading matter log...', 5);
      window.location.href = './api/download-mjlog';
    } else if (value === 'download-mbstorage') {
      logMessage('Matterbridge', `Downloading matterbridge storage...`);
      showSnackbarMessage('Downloading matterbridge storage...', 5);
      window.location.href = './api/download-mbstorage';
    } else if (value === 'download-mjstorage') {
      logMessage('Matterbridge', `Downloading matter storage...`);
      showSnackbarMessage('Downloading matter storage...', 5);
      window.location.href = './api/download-mjstorage';
    } else if (value === 'download-backup') {
      logMessage('Matterbridge', `Downloading backup...`);
      showSnackbarMessage('Downloading backup...', 10);
      window.location.href = './api/download-backup';
    } else if (value === 'update') {
      handleUpdateClick();
    } else if (value === 'shelly-sys-update') {
      handleShellySystemUpdateClick();
    } else if (value === 'shelly-main-update') {
      handleShellyMainUpdateClick();
    } else if (value === 'restart') {
      handleRestartClick();
    } else if (value === 'shutdown') {
      handleShutdownClick();
    } else if (value === 'startshare') {
      handleStartAdvertiseClick();
    } else if (value === 'stopshare') {
      handleStopAdvertiseClick();
    } else if (value === 'create-backup') {
      logMessage('Matterbridge', `Creating backup...`);
      showSnackbarMessage('Creating backup...', 10);
      sendCommandToMatterbridge('backup', 'create');
    } else if (value === 'unregister') {
      logMessage('Matterbridge', `Uregistering all bridged devices...`);
      showSnackbarMessage('Uregistering all bridged devices...', 10);
      sendCommandToMatterbridge('unregister', 'now');
    } else if (value === 'reset') {
      logMessage('Matterbridge', `Resetting matterbridge commissioning...`);
      showSnackbarMessage('Resetting matterbridge commissioning...', 10);
      sendCommandToMatterbridge('reset', 'now');
    } else if (value === 'factoryreset') {
      logMessage('Matterbridge', `Factory reset of matterbridge...`);
      showSnackbarMessage('Factory reset of matterbridge...', 10);
      sendCommandToMatterbridge('factoryreset', 'now');
    }
  };

  const handleMenuCloseCancel = (value) => {
    if(debug) console.log('Header: handleMenuCloseCancel:', value);
    setMenuAnchorEl(null);
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

  const handleResetMenuOpen = (event) => {
    setResetMenuAnchorEl(event.currentTarget);
  };

  const handleResetMenuClose = () => {
    setResetMenuAnchorEl(null);
  };

  useEffect(() => {
    const handleWebSocketMessage = (msg) => {
      /* Header listener */
      if (debug) console.log('Header received WebSocket Message:', msg);
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'refresh_required') {
          if (debug) console.log('Header received refresh_required');
          sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (msg.method === '/api/settings') {
          if (debug) console.log('Header received settings:', msg.response);
          setSettings(msg.response);
        }
        if (msg.method === '/api/advertise') {
          if (debug) console.log('Header received advertise:', msg.response);
        }
        if (msg.method === '/api/stopadvertise') {
          if (debug) console.log('Header received advertise:', msg.response);
        }
        if (msg.id === WS_ID_SHELLY_SYS_UPDATE) {
          if (debug) console.log('Header received WS_ID_SHELLY_SYS_UPDATE:');
          setSettings(prevSettings => ({ ...prevSettings, matterbridgeInformation: { ...prevSettings.matterbridgeInformation, shellySysUpdate: msg.params.available } }));

        }
        if (msg.id === WS_ID_SHELLY_MAIN_UPDATE) {
          if (debug) console.log('Header received WS_ID_SHELLY_MAIN_UPDATE:');
          setSettings(prevSettings => ({ ...prevSettings, matterbridgeInformation: { ...prevSettings.matterbridgeInformation, shellyMainUpdate: msg.params.available } }));
        }
      }
    };

    addListener(handleWebSocketMessage);
    if (debug) console.log('Header added WebSocket listener');

    return () => {
      removeListener(handleWebSocketMessage);
      if (debug) console.log('Header removed WebSocket listener');
    };
  }, [addListener, removeListener, sendMessage, showSnackbarMessage]);

  useEffect(() => {
    if (online) {
      if (debug) console.log('Header sending /api/settings requests');
      sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
    }
  }, [online, sendMessage]);

  if(debug) console.log('Header rendering...');
  if (!online || settings.matterbridgeInformation === undefined) {
    return null;
  }
  return (
    <div className="header">
      <div className="sub-header">
        <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '30px' }} />
        <h2 style={{ fontSize: '22px', color: 'var(--main-icon-color)', margin: '0px' }}>Matterbridge</h2>
        <nav>
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/devices" className="nav-link">Devices</Link>
          <Link to="/log" className="nav-link">Logs</Link>
          <Link to="/settings" className="nav-link">Settings</Link>
        </nav>
      </div>
      <div className="sub-header">
        {settings.matterbridgeInformation && !settings.matterbridgeInformation.readOnly &&
          <Tooltip title="Sponsor Matterbridge and its plugins">
            <span className="status-sponsor" onClick={handleSponsorClick}>Sponsor</span>
          </Tooltip>
        }
        {!settings.matterbridgeInformation.readOnly && (settings.matterbridgeInformation.matterbridgeLatestVersion === undefined || settings.matterbridgeInformation.matterbridgeVersion === settings.matterbridgeInformation.matterbridgeLatestVersion) &&
          <Tooltip title="Matterbridge version">
            <span className="status-information" onClick={handleChangelogClick}>
              v.{settings.matterbridgeInformation.matterbridgeVersion}
            </span>
          </Tooltip>
        }
        {!settings.matterbridgeInformation.readOnly && settings.matterbridgeInformation.matterbridgeLatestVersion !== undefined && settings.matterbridgeInformation.matterbridgeVersion !== settings.matterbridgeInformation.matterbridgeLatestVersion &&
          <Tooltip title="New Matterbridge version available, click to install">
            <span className="status-warning" onClick={handleUpdateClick}>
              Update v.{settings.matterbridgeInformation.matterbridgeVersion} to v.{settings.matterbridgeInformation.matterbridgeLatestVersion}
            </span>
          </Tooltip>
        }
        {settings.matterbridgeInformation.shellyBoard &&
          <img src="Shelly.svg" alt="Shelly Icon" style={{ height: '30px', padding: '0px', margin: '0px', marginRight: '30px' }}/>
        }
        {settings.matterbridgeInformation.shellyBoard && settings.matterbridgeInformation.xxxmatterbridgeVersion &&
          <Tooltip title="Matterbridge version">
            <span style={{ fontSize: '12px', color: 'var(--main-icon-color)' }} onClick={handleChangelogClick}>
              v.{settings.matterbridgeInformation.matterbridgeVersion}
            </span>
          </Tooltip>
        }
        {settings.matterbridgeInformation.bridgeMode !== '' && settings.matterbridgeInformation.readOnly === false ? (
          <Tooltip title="Bridge mode">
            <span className="status-information" style={{ cursor: 'default' }}>{settings.matterbridgeInformation.bridgeMode}</span>
          </Tooltip>
        ) : null}
        {settings.matterbridgeInformation.restartMode !== '' && settings.matterbridgeInformation.readOnly === false ? (
          <Tooltip title="Restart mode">
            <span className="status-information" style={{ cursor: 'default' }}>{settings.matterbridgeInformation.restartMode}</span>
          </Tooltip>
        ) : null}
      </div>
      <div className="sub-header" style={{ gap: '5px' }}>
        <Tooltip title="Matterbridge help">
          <IconButton onClick={handleHelpClick}>
            <HelpOutlineIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Matterbridge changelog">
          <IconButton onClick={handleChangelogClick}>
            <AnnouncementOutlinedIcon />
          </IconButton>
        </Tooltip>
        {settings.matterbridgeInformation && !settings.matterbridgeInformation.readOnly &&
          <Tooltip title="Update matterbridge">
            <IconButton onClick={handleUpdateClick}>
              <SystemUpdateAltIcon />
            </IconButton>
          </Tooltip>
        }
        {settings.matterbridgeInformation && settings.matterbridgeInformation.shellyBoard && settings.matterbridgeInformation.shellySysUpdate &&
          <Tooltip title="Shelly system update">
            <IconButton style={{ color: 'var(--primary-color)' }} onClick={handleShellySystemUpdateClick}>
              <SystemUpdateAltIcon />
            </IconButton>
          </Tooltip>
        }
        {settings.matterbridgeInformation && settings.matterbridgeInformation.shellyBoard && settings.matterbridgeInformation.shellyMainUpdate &&
          <Tooltip title="Shelly software update">
            <IconButton style={{ color: 'var(--primary-color)' }} onClick={handleShellyMainUpdateClick}>
              <SystemUpdateAltIcon />
            </IconButton>
          </Tooltip>
        }
        <Tooltip title="Restart matterbridge">
          <IconButton onClick={handleRestartClick}>
            <RestartAltIcon />
          </IconButton>
        </Tooltip>
        {settings.matterbridgeInformation.restartMode === '' ? (
          <Tooltip title="Shut down matterbridge">
            <IconButton onClick={handleShutdownClick}>
              <PowerSettingsNewIcon />
            </IconButton>
          </Tooltip>
        ) : null}
        <Tooltip title="Download, backup and more">
          <IconButton onClick={handleMenuOpen}>
            <MoreHoriz />
          </IconButton>
        </Tooltip>
        <Menu id="command-menu" anchorEl={menuAnchorEl} keepMounted open={Boolean(menuAnchorEl)} onClose={() => handleMenuCloseConfirm('')} >
        {settings.matterbridgeInformation && !settings.matterbridgeInformation.readOnly &&
            <MenuItem onClick={() => handleMenuCloseConfirm('update')}>
              <ListItemIcon><SystemUpdateAltIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Update" />
            </MenuItem>
          }
          {settings.matterbridgeInformation && settings.matterbridgeInformation.shellyBoard && settings.matterbridgeInformation.shellySysUpdate &&
            <MenuItem onClick={() => handleMenuCloseConfirm('shelly-sys-update')}>
              <ListItemIcon><SystemUpdateAltIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Shelly system update" />
            </MenuItem>
          }
          {settings.matterbridgeInformation && settings.matterbridgeInformation.shellyBoard && settings.matterbridgeInformation.shellyMainUpdate &&
            <MenuItem onClick={() => handleMenuCloseConfirm('shelly-main-update')}>
              <ListItemIcon><SystemUpdateAltIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Shelly software update" />
            </MenuItem>
          }
          <MenuItem onClick={() => handleMenuCloseConfirm('restart')}>
            <ListItemIcon><RestartAltIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
            <ListItemText primary="Restart" />
          </MenuItem>
          {settings.matterbridgeInformation.restartMode === '' ?
            <MenuItem onClick={() => handleMenuCloseConfirm('shutdown')}>
              <ListItemIcon><PowerSettingsNewIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Shutdown" />
            </MenuItem>
            : null}
          {settings.matterbridgeInformation.matterbridgePaired === true && settings.matterbridgeInformation.matterbridgeAdvertise === false?
            <MenuItem onClick={() => handleMenuCloseConfirm('startshare')}>
              <ListItemIcon><IosShareIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Share fabrics" />
            </MenuItem>
            : null}
          {settings.matterbridgeInformation.matterbridgeAdvertise === true ?
            <MenuItem onClick={() => handleMenuCloseConfirm('stopshare')}>
              <ListItemIcon><BlockIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Stop sharing" />
            </MenuItem>
            : null}
          <Divider />
          <MenuItem onClick={handleDownloadMenuOpen}>
            <ListItemIcon><DownloadIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
            <ListItemText primary="Download" />
          </MenuItem>
          <Menu id="sub-menu-download" anchorEl={downloadMenuAnchorEl} keepMounted open={Boolean(downloadMenuAnchorEl)} onClose={handleDownloadMenuClose} sx={{ '& .MuiPaper-root': { backgroundColor: '#e2e2e2' } }}>
            <MenuItem onClick={() => { handleMenuCloseConfirm('download-mblog'); handleDownloadMenuClose(); }}>
              <ListItemIcon><DownloadIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Matterbridge log" />
            </MenuItem>
            <MenuItem onClick={() => { handleMenuCloseConfirm('download-mjlog'); handleDownloadMenuClose(); }}>
              <ListItemIcon><DownloadIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Matter log" />
            </MenuItem>
            <MenuItem onClick={() => { handleMenuCloseConfirm('download-mbstorage'); handleDownloadMenuClose(); }}>
              <ListItemIcon><DownloadIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Matterbridge storage" />
            </MenuItem>
            <MenuItem onClick={() => { handleMenuCloseConfirm('download-mjstorage'); handleDownloadMenuClose(); }}>
              <ListItemIcon><DownloadIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Matter storage" />
            </MenuItem>
          </Menu>

          <Divider />
          <MenuItem onClick={handleBackupMenuOpen}>
            <ListItemIcon><SaveIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
            <ListItemText primary="Backup" />
          </MenuItem>
          <Menu id="sub-menu-backup" anchorEl={backupMenuAnchorEl} keepMounted open={Boolean(backupMenuAnchorEl)} onClose={handleBackupMenuClose} sx={{ '& .MuiPaper-root': { backgroundColor: '#e2e2e2' } }}>
            <MenuItem onClick={() => { handleMenuCloseConfirm('create-backup'); handleBackupMenuClose(); }}>
              <ListItemIcon><SaveIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Create backup" />
            </MenuItem>
            <MenuItem onClick={() => { handleMenuCloseConfirm('download-backup'); handleBackupMenuClose(); }}>
              <ListItemIcon><SaveIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Download backup" />
            </MenuItem>
          </Menu>

          <Divider />
          <MenuItem onClick={handleResetMenuOpen}>
            <ListItemIcon><ReportProblemIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
            <ListItemText primary="Reset" />
          </MenuItem>
          <Menu id="sub-menu-reset" anchorEl={resetMenuAnchorEl} keepMounted open={Boolean(resetMenuAnchorEl)} onClose={handleResetMenuClose} sx={{ '& .MuiPaper-root': { backgroundColor: '#e2e2e2' } }}>
            <MenuItem onClick={() => { handleResetMenuClose(); showConfirmCancelDialog('Reset all devices and shutdown', 'Are you sure you want to unregister all devices? This will temporarily remove all devices from the controller and you may loose the controller configuration.', 'unregister', handleMenuCloseConfirm, handleMenuCloseCancel); }}>
              <ListItemIcon><PowerSettingsNewIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Reset all devices..." />
            </MenuItem>
            <MenuItem onClick={() => { handleResetMenuClose(); showConfirmCancelDialog('Reset commissioning and shutdown', 'Are you sure you want to reset the commissioning? You will have to manually remove Matterbridge from the controller.', 'reset', handleMenuCloseConfirm, handleMenuCloseCancel); }}>
              <ListItemIcon><PowerSettingsNewIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Reset commissioning..." />
            </MenuItem>
            {!settings.matterbridgeInformation.readOnly &&
              <MenuItem onClick={() => { handleResetMenuClose(); showConfirmCancelDialog('Factory reset and shutdown', 'Are you sure you want to factory reset Matterbridge? You will have to manually remove Matterbridge from the controller.', 'factoryreset', handleMenuCloseConfirm, handleMenuCloseCancel); }}>
                <ListItemIcon><PowerSettingsNewIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
                <ListItemText primary="Factory reset..." />
              </MenuItem>
            }
          </Menu>

        </Menu>
      </div>
    </div>
  );
}

export default Header;
