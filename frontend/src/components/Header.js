/* eslint-disable no-console */

// React
import React, { useState, useContext, useEffect, useRef } from 'react';
import { Link } from 'react-router';

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
import ViewHeadlineIcon from '@mui/icons-material/ViewHeadline';

// Frontend
// import { sendCommandToMatterbridge } from './sendApiCommand';
import { UiContext } from './UiProvider';
import { WebSocketContext, WS_ID_SHELLY_SYS_UPDATE, WS_ID_SHELLY_MAIN_UPDATE } from './WebSocketProvider';
import { debug, toggleDebug } from '../App';
// const debug = true;

function Header() {
  // Contexts
  const { showSnackbarMessage, showConfirmCancelDialog } = useContext(UiContext);
  const { online, sendMessage, logMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);
  // States
  const [restart, setRestart] = useState(false);
  const [update, setUpdate] = useState(false);
  const [updateDev, setUpdateDev] = useState(false);
  const [settings, setSettings] = useState(null);
  // Refs
  const uniqueId = useRef(getUniqueId());
  // Menu states
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [backupMenuAnchorEl, setBackupMenuAnchorEl] = useState(null);
  const [viewMenuAnchorEl, setViewMenuAnchorEl] = useState(null);
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

  const handleDiscordLogoClick = () => {
    window.open(`https://discord.gg/QX58CDe6hd`, '_blank');
  };

  const handleUpdateClick = () => {
    sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/install", src: "Frontend", dst: "Matterbridge", params: { packageName: 'matterbridge', restart: true } });
  };

  const handleUpdateDevClick = () => {
    sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/install", src: "Frontend", dst: "Matterbridge", params: { packageName: 'matterbridge@dev', restart: true } });
  };

  const handleUpdateCheckClick = () => {
    sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/checkupdates", src: "Frontend", dst: "Matterbridge", params: { } });
  };

  const handleShellySystemUpdateClick = () => {
    if(debug) console.log('Header: handleShellySystemUpdateClick');
    logMessage('Matterbridge', `Installing system updates...`);
    sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/shellysysupdate", src: "Frontend", dst: "Matterbridge", params: { } });
  };

  const handleShellyMainUpdateClick = () => {
    if(debug) console.log('Header: handleShellyMainUpdateClick');
    logMessage('Matterbridge', `Installing software updates...`);
    sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/shellymainupdate", src: "Frontend", dst: "Matterbridge", params: { } });
  };

  const handleShellyCreateSystemLog = () => {
    if(debug) console.log('Header: handleShellyCreateSystemLog');
    sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/shellycreatesystemlog", src: "Frontend", dst: "Matterbridge", params: { } });
  };

  const handleShellyDownloadSystemLog = () => {
    if(debug) console.log('Header: handleShellyDownloadSystemLog');
    logMessage('Matterbridge', `Downloading Shelly system log...`);
    showSnackbarMessage('Downloading Shelly system log...', 5);
    window.location.href = './api/shellydownloadsystemlog';
  };

  const handleRestartClick = () => {
    if (settings.matterbridgeInformation.restartMode === '') {
      sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/restart", src: "Frontend", dst: "Matterbridge", params: {} });
    }
    else {
      sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/shutdown", src: "Frontend", dst: "Matterbridge", params: {} });
    }
  };

  const handleShutdownClick = () => {
    sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/shutdown", src: "Frontend", dst: "Matterbridge", params: {} });
  };

  const handleRebootClick = () => {
    sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/reboot", src: "Frontend", dst: "Matterbridge", params: {} });
  };

  const handleSoftResetClick = () => {
    sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/softreset", src: "Frontend", dst: "Matterbridge", params: {} });
  };

  const handleHardResetClick = () => {
    sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/hardreset", src: "Frontend", dst: "Matterbridge", params: {} });
  };

  const handleStartAdvertiseClick = () => {
    sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/advertise", src: "Frontend", dst: "Matterbridge", params: {} });
  };

  const handleStopAdvertiseClick = () => {
    sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/stopadvertise", src: "Frontend", dst: "Matterbridge", params: {} });
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
    } else if (value === 'view-mblog') {
      logMessage('Matterbridge', `Loading matterbridge log...`);
      showSnackbarMessage('Loading matterbridge log...', 5);
      window.location.href = './api/view-mblog';
    } else if (value === 'view-mjlog') {
      logMessage('Matterbridge', `Loading matter log...`);
      showSnackbarMessage('Loading matter log...', 5);
      window.location.href = './api/view-mjlog';
    } else if (value === 'view-shellylog') {
      logMessage('Matterbridge', `Loading shelly system log...`);
      showSnackbarMessage('Loading shelly system log...', 5);
      window.location.href = './api/shellyviewsystemlog';
    } else if (value === 'download-mbstorage') {
      logMessage('Matterbridge', `Downloading matterbridge storage...`);
      showSnackbarMessage('Downloading matterbridge storage...', 5);
      window.location.href = './api/download-mbstorage';
    } else if (value === 'download-pluginstorage') {
      logMessage('Matterbridge', `Downloading matterbridge plugins storage...`);
      showSnackbarMessage('Downloading matterbridge plugins storage...', 5);
      window.location.href = './api/download-pluginstorage';
    } else if (value === 'download-pluginconfig') {
      logMessage('Matterbridge', `Downloading matterbridge plugins config...`);
      showSnackbarMessage('Downloading matterbridge plugins config...', 5);
      window.location.href = './api/download-pluginconfig';
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
    } else if (value === 'updatedev') {
      handleUpdateDevClick();
    } else if (value === 'updatecheck') {
      handleUpdateCheckClick();
    } else if (value === 'shelly-sys-update') {
      handleShellySystemUpdateClick();
    } else if (value === 'shelly-main-update') {
      handleShellyMainUpdateClick();
    } else if (value === 'shelly-create-system-log') {
      handleShellyCreateSystemLog();
    } else if (value === 'shelly-download-system-log') {
      handleShellyDownloadSystemLog(); 
    } else if (value === 'softreset') {
      handleSoftResetClick();
    } else if (value === 'hardreset') {
      handleHardResetClick();
    } else if (value === 'restart') {
      handleRestartClick();
    } else if (value === 'shutdown') {
      handleShutdownClick();
    } else if (value === 'reboot') {
      handleRebootClick();
    } else if (value === 'startshare') {
      handleStartAdvertiseClick();
    } else if (value === 'stopshare') {
      handleStopAdvertiseClick();
    } else if (value === 'create-backup') {
      sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/create-backup", src: "Frontend", dst: "Matterbridge", params: {} });
    } else if (value === 'unregister') {
      sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/unregister", src: "Frontend", dst: "Matterbridge", params: {} });
    } else if (value === 'reset') {
      sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/reset", src: "Frontend", dst: "Matterbridge", params: {} });
    } else if (value === 'factoryreset') {
      sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/factoryreset", src: "Frontend", dst: "Matterbridge", params: {} });
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

  const handleViewMenuOpen = (event) => {
    setViewMenuAnchorEl(event.currentTarget);
  };

  const handleViewMenuClose = () => {
    setViewMenuAnchorEl(null);
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

  const handleLogoClick = () => {
    toggleDebug();
    if (debug) console.log('Matterbridge logo clicked: debug is now', debug);
  };

  useEffect(() => {
    const handleWebSocketMessage = (msg) => {
      /* Header listener */
      // if (debug) console.log(`Header received WebSocket Message id ${msg.id}:`, msg);
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        // Local messages
        if (msg.id === uniqueId.current && msg.method === '/api/settings') {
          if (debug) console.log('Header received settings:', msg.response);
          setSettings(msg.response);
          setRestart(msg.response.matterbridgeInformation.restartRequired || msg.response.matterbridgeInformation.fixedRestartRequired);
          setUpdate(msg.response.matterbridgeInformation.updateRequired);
        }
        // Broadcast messages
        if (msg.method === 'refresh_required') {
          if (msg.params.changed === null || msg.params.changed === 'matterbridgeLatestVersion' || msg.params.changed === 'matterbridgeAdvertise' || msg.params.changed === 'fabrics') {
            if (debug) console.log(`Header received refresh_required: changed=${msg.params.changed}`);
            sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
          }
        }
        if (msg.method === 'restart_required') {
          if (debug) console.log('Header received restart_required');
          setRestart(true);
          if(msg.params.fixed === true) 
            setSettings(prevSettings => ({ ...prevSettings, matterbridgeInformation: { ...prevSettings.matterbridgeInformation, fixedRestartRequired: true } }));
        }
        if (msg.method === 'restart_not_required') {
          if (debug) console.log('Header received restart_not_required');
          setRestart(settings.matterbridgeInformation.fixedRestartRequired);
        }
        if (msg.method === 'update_required') {
          if (debug) console.log('Header received update_required');
          setUpdate(true);
        }
        if (msg.method === 'update_required_dev') {
          if (debug) console.log('Header received update_required_dev');
          setUpdateDev(true);
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
    if (debug) console.log(`Header added WebSocket listener id ${uniqueId.current}`);

    return () => {
      removeListener(handleWebSocketMessage);
      if (debug) console.log(`Header removed WebSocket listener`);
    };
  }, [addListener, removeListener, sendMessage, showSnackbarMessage]);

  useEffect(() => {
    if (online) {
      if (debug) console.log('Header sending /api/settings requests');
      sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
    }
  }, [online, sendMessage]);

  if(debug) console.log('Header rendering...');
  if (!online || !settings) {
    return null;
  }
  return (
    <div className="header">
      <div className="sub-header">
        <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '30px' }} onClick={handleLogoClick}/>
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
        {!settings.matterbridgeInformation.readOnly && update &&
          <Tooltip title="New Matterbridge stable version available, click to install">
            <span className="status-warning" onClick={handleUpdateClick}>
              Update to stable v.{settings.matterbridgeInformation.matterbridgeLatestVersion}
            </span>
          </Tooltip>
        }
        {!settings.matterbridgeInformation.readOnly && updateDev &&
          <Tooltip title="New Matterbridge dev version available, click to install">
            <span className="status-warning" onClick={handleUpdateDevClick}>
              Update to dev v.{settings.matterbridgeInformation.matterbridgeDevVersion}
            </span>
          </Tooltip>
        }
        {!settings.matterbridgeInformation.readOnly &&
          <Tooltip title="Matterbridge version, click to see the changelog">
            <span className="status-information" onClick={handleChangelogClick}>
              v.{settings.matterbridgeInformation.matterbridgeVersion}
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
        {settings.matterbridgeInformation.profile && settings.matterbridgeInformation.profile !== '' && settings.matterbridgeInformation.readOnly === false ? (
          <Tooltip title="Current profile">
            <span className="status-information" style={{ cursor: 'default' }}>{settings.matterbridgeInformation.profile}</span>
          </Tooltip>
        ) : null}
      </div>
      <div className="sub-header" style={{ gap: '5px' }}>
        {settings.matterbridgeInformation.readOnly === false ? (
          <Tooltip title="Matterbridge discord group">
            <img src="discord.svg" alt="Discord Logo" style={{ height: '25px' }} onClick={handleDiscordLogoClick}/>
          </Tooltip>
        ) : null}
        <Tooltip title="Matterbridge help">
          <IconButton onClick={handleHelpClick}>
            <HelpOutlineIcon style={{ color: 'var(--main-icon-color)' }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Matterbridge changelog">
          <IconButton onClick={handleChangelogClick}>
            <AnnouncementOutlinedIcon style={{ color: 'var(--main-icon-color)' }} />
          </IconButton>
        </Tooltip>
        {settings.matterbridgeInformation && !settings.matterbridgeInformation.readOnly &&
          <Tooltip title="Update matterbridge">
            <IconButton style={{ color: update ? 'var(--primary-color)' : 'var(--main-icon-color)' }} onClick={handleUpdateClick}>
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
          <IconButton style={{ color: restart ? 'var(--primary-color)' : 'var(--main-icon-color)' }} onClick={handleRestartClick}>
            <RestartAltIcon />
          </IconButton>
        </Tooltip>
        {settings.matterbridgeInformation.restartMode === '' ? (
          <Tooltip title="Shut down matterbridge">
            <IconButton style={{ color: restart ? 'var(--primary-color)' : 'var(--main-icon-color)' }} onClick={handleShutdownClick}>
              <PowerSettingsNewIcon />
            </IconButton>
          </Tooltip>
        ) : null}
        <Tooltip title="Download, backup and more">
          <IconButton onClick={handleMenuOpen}>
            <MoreHoriz style={{ color: 'var(--main-icon-color)' }} />
          </IconButton>
        </Tooltip>
        <Menu id="command-menu" anchorEl={menuAnchorEl} keepMounted open={Boolean(menuAnchorEl)} onClose={() => handleMenuCloseConfirm('')} >
          {settings.matterbridgeInformation && !settings.matterbridgeInformation.readOnly &&
            <MenuItem onClick={() => handleMenuCloseConfirm('update')}>
              <ListItemIcon><SystemUpdateAltIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Install latest stable" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }}/>
            </MenuItem>
          }
          {settings.matterbridgeInformation && !settings.matterbridgeInformation.readOnly &&
            <MenuItem onClick={() => handleMenuCloseConfirm('updatedev')}>
              <ListItemIcon><SystemUpdateAltIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Install latest dev" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }}/>
            </MenuItem>
          }
          {settings.matterbridgeInformation && !settings.matterbridgeInformation.readOnly &&
            <MenuItem onClick={() => handleMenuCloseConfirm('updatecheck')}>
              <ListItemIcon><SystemUpdateAltIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Check for updates" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }}/>
            </MenuItem>
          }
          {settings.matterbridgeInformation && settings.matterbridgeInformation.shellyBoard && settings.matterbridgeInformation.shellySysUpdate &&
            <MenuItem onClick={() => handleMenuCloseConfirm('shelly-sys-update')}>
              <ListItemIcon><SystemUpdateAltIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Shelly system update" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>
          }
          {settings.matterbridgeInformation && settings.matterbridgeInformation.shellyBoard && settings.matterbridgeInformation.shellyMainUpdate &&
            <MenuItem onClick={() => handleMenuCloseConfirm('shelly-main-update')}>
              <ListItemIcon><SystemUpdateAltIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Shelly software update" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>
          }
          <MenuItem onClick={() => handleMenuCloseConfirm('restart')}>
            <ListItemIcon><RestartAltIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
            <ListItemText primary="Restart" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
          </MenuItem>
          {settings.matterbridgeInformation.restartMode === '' ?
            <MenuItem onClick={() => handleMenuCloseConfirm('shutdown')}>
              <ListItemIcon><PowerSettingsNewIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Shutdown" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>
            : null}
          {settings.matterbridgeInformation && settings.matterbridgeInformation.shellyBoard &&
            <MenuItem onClick={() => { showConfirmCancelDialog('Reboot', 'Are you sure you want to reboot the Shelly board?', 'reboot', handleMenuCloseConfirm, handleMenuCloseCancel); }}>
              <ListItemIcon><RestartAltIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Reboot..." primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>
          }
          {settings.matterbridgeInformation.matterbridgePaired === true && settings.matterbridgeInformation.matterbridgeAdvertise === false ?
            <MenuItem onClick={() => handleMenuCloseConfirm('startshare')}>
              <ListItemIcon><IosShareIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Share fabrics" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>
            : null}
          {settings.matterbridgeInformation.matterbridgeAdvertise === true ?
            <MenuItem onClick={() => handleMenuCloseConfirm('stopshare')}>
              <ListItemIcon><BlockIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Stop sharing" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>
            : null}
          <Divider />

          <MenuItem onClick={handleViewMenuOpen}>
            <ListItemIcon><ViewHeadlineIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
            <ListItemText primary="View" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
          </MenuItem>
            <Menu id="sub-menu-view" anchorEl={viewMenuAnchorEl} keepMounted open={Boolean(viewMenuAnchorEl)} onClose={handleViewMenuClose} sx={{ '& .MuiPaper-root': { backgroundColor: '#e2e2e2' } }}>
            <MenuItem onClick={() => { handleMenuCloseConfirm('view-mblog'); handleViewMenuClose(); }}>
                <ListItemIcon><ViewHeadlineIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
                <ListItemText primary="Matterbridge log" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
              </MenuItem>
              <MenuItem onClick={() => { handleMenuCloseConfirm('view-mjlog'); handleViewMenuClose(); }}>
                <ListItemIcon><ViewHeadlineIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
                <ListItemText primary="Matter log" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
              </MenuItem>
              {settings.matterbridgeInformation && settings.matterbridgeInformation.shellyBoard &&
                <MenuItem onClick={() => { handleMenuCloseConfirm('view-shellylog'); handleViewMenuClose(); }}>
                  <ListItemIcon><ViewHeadlineIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
                  <ListItemText primary="Shelly system log" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
                </MenuItem>
              }
            </Menu>

          <Divider />
          <MenuItem onClick={handleDownloadMenuOpen}>
            <ListItemIcon><DownloadIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
            <ListItemText primary="Download" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
          </MenuItem>
          <Menu id="sub-menu-download" anchorEl={downloadMenuAnchorEl} keepMounted open={Boolean(downloadMenuAnchorEl)} onClose={handleDownloadMenuClose} sx={{ '& .MuiPaper-root': { backgroundColor: '#e2e2e2' } }}>
            <MenuItem onClick={() => { handleMenuCloseConfirm('download-mbstorage'); handleDownloadMenuClose(); }}>
              <ListItemIcon><DownloadIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Matterbridge storage" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>
            <MenuItem onClick={() => { handleMenuCloseConfirm('download-pluginstorage'); handleDownloadMenuClose(); }}>
              <ListItemIcon><DownloadIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Matterbridge plugins storage" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>
            <MenuItem onClick={() => { handleMenuCloseConfirm('download-pluginconfig'); handleDownloadMenuClose(); }}>
              <ListItemIcon><DownloadIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Matterbridge plugins config" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>
            <MenuItem onClick={() => { handleMenuCloseConfirm('download-mblog'); handleDownloadMenuClose(); }}>
              <ListItemIcon><DownloadIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Matterbridge log" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>
            <MenuItem onClick={() => { handleMenuCloseConfirm('download-mjstorage'); handleDownloadMenuClose(); }}>
              <ListItemIcon><DownloadIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Matter storage" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>
            <MenuItem onClick={() => { handleMenuCloseConfirm('download-mjlog'); handleDownloadMenuClose(); }}>
              <ListItemIcon><DownloadIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Matter log" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>

            {settings.matterbridgeInformation && settings.matterbridgeInformation.shellyBoard &&
              <MenuItem onClick={() => { handleMenuCloseConfirm('shelly-create-system-log'); handleDownloadMenuClose(); }}>
                <ListItemIcon><DownloadIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
                <ListItemText primary="Create Shelly system log" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
              </MenuItem>
            }
            {settings.matterbridgeInformation && settings.matterbridgeInformation.shellyBoard &&
              <MenuItem onClick={() => { handleMenuCloseConfirm('shelly-download-system-log'); handleDownloadMenuClose(); }}>
                <ListItemIcon><DownloadIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
                <ListItemText primary="Download Shelly system log" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
              </MenuItem>
            }

          </Menu>

          <Divider />
          <MenuItem onClick={handleBackupMenuOpen}>
            <ListItemIcon><SaveIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
            <ListItemText primary="Backup" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
          </MenuItem>
          <Menu id="sub-menu-backup" anchorEl={backupMenuAnchorEl} keepMounted open={Boolean(backupMenuAnchorEl)} onClose={handleBackupMenuClose} sx={{ '& .MuiPaper-root': { backgroundColor: '#e2e2e2' } }}>
            <MenuItem onClick={() => { handleMenuCloseConfirm('create-backup'); handleBackupMenuClose(); }}>
              <ListItemIcon><SaveIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Create backup" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>
            <MenuItem onClick={() => { handleMenuCloseConfirm('download-backup'); handleBackupMenuClose(); }}>
              <ListItemIcon><SaveIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Download backup" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>
          </Menu>

          <Divider />
          <MenuItem onClick={handleResetMenuOpen}>
            <ListItemIcon><ReportProblemIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
            <ListItemText primary="Reset" primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
          </MenuItem>
          <Menu id="sub-menu-reset" anchorEl={resetMenuAnchorEl} keepMounted open={Boolean(resetMenuAnchorEl)} onClose={handleResetMenuClose} sx={{ '& .MuiPaper-root': { backgroundColor: '#e2e2e2' } }}>
            <MenuItem onClick={() => { handleResetMenuClose(); showConfirmCancelDialog('Reset all devices and shutdown', 'Are you sure you want to unregister all devices? This will temporarily remove all devices from the controller and you may loose the controller configuration.', 'unregister', handleMenuCloseConfirm, handleMenuCloseCancel); }}>
              <ListItemIcon><PowerSettingsNewIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Reset all devices..." primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>
            <MenuItem onClick={() => { handleResetMenuClose(); showConfirmCancelDialog('Reset commissioning and shutdown', 'Are you sure you want to reset the commissioning? You will have to manually remove Matterbridge from the controller.', 'reset', handleMenuCloseConfirm, handleMenuCloseCancel); }}>
              <ListItemIcon><PowerSettingsNewIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
              <ListItemText primary="Reset commissioning..." primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
            </MenuItem>
            {!settings.matterbridgeInformation.readOnly &&
              <MenuItem onClick={() => { handleResetMenuClose(); showConfirmCancelDialog('Factory reset and shutdown', 'Are you sure you want to factory reset Matterbridge? You will have to manually remove Matterbridge from the controller.', 'factoryreset', handleMenuCloseConfirm, handleMenuCloseCancel); }}>
                <ListItemIcon><PowerSettingsNewIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
                <ListItemText primary="Factory reset..." primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
              </MenuItem>
            }
            {settings.matterbridgeInformation && settings.matterbridgeInformation.shellyBoard &&
              <MenuItem onClick={() => { handleResetMenuClose(); showConfirmCancelDialog('Network reset', 'Are you sure you want to factory reset the network parameters?', 'softreset', handleMenuCloseConfirm, handleMenuCloseCancel); }}>
                <ListItemIcon><PowerSettingsNewIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
                <ListItemText primary="Reset network..." primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
              </MenuItem>
            }
            {settings.matterbridgeInformation && settings.matterbridgeInformation.shellyBoard &&
              <MenuItem onClick={() => { handleResetMenuClose(); showConfirmCancelDialog('Factory reset', 'Are you sure you want to factory reset Matterbridge? You will have to manually remove Matterbridge from the controller.', 'hardreset', handleMenuCloseConfirm, handleMenuCloseCancel); }}>
                <ListItemIcon><PowerSettingsNewIcon style={{ color: 'var(--main-icon-color)' }} /></ListItemIcon>
                <ListItemText primary="Factory reset..." primaryTypographyProps={{ style: { fontWeight: 'normal', color: 'var(--main-icon-color)' } }} />
              </MenuItem>
            }
          </Menu>

        </Menu>
      </div>
    </div>
  );
}

export default Header;
