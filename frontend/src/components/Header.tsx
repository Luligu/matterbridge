// React
import { useState, useContext, useEffect, useRef, memo } from 'react';
import { Link } from 'react-router';

// @mui/material
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

// @mui/icons-material
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import MoreHoriz from '@mui/icons-material/MoreHoriz';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AnnouncementOutlinedIcon from '@mui/icons-material/AnnouncementOutlined';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import ViewHeadlineIcon from '@mui/icons-material/ViewHeadline';
import StarIcon from '@mui/icons-material/Star';
import Favorite from '@mui/icons-material/Favorite';

// Backend
import { ApiSettingResponse, isApiResponse, isBroadcast, WsBroadcastMessageId, WsMessage } from '../../../src/frontendTypes';

// Frontend
import { UiContext } from './UiProvider';
import { WebSocketContext } from './WebSocketProvider';
import { debug, toggleDebug } from '../App';
// const debug = true;

function Header() {
  // Contexts
  const { showSnackbarMessage, showConfirmCancelDialog } = useContext(UiContext);
  const { online, sendMessage, logMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);
  // States
  const [restart, setRestart] = useState(false);
  const [fixedRestart, setFixedRestart] = useState(false);
  const [update, setUpdate] = useState(false);
  const [updateDev, setUpdateDev] = useState(false);
  const [settings, setSettings] = useState<ApiSettingResponse | null>(null);
  // Refs
  const uniqueId = useRef(getUniqueId());
  // Menu states
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [backupMenuAnchorEl, setBackupMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [viewMenuAnchorEl, setViewMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [downloadMenuAnchorEl, setDownloadMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [resetMenuAnchorEl, setResetMenuAnchorEl] = useState<HTMLElement | null>(null);

  const handleSponsorClick = () => {
    window.open('https://www.buymeacoffee.com/luligugithub', '_blank');
  };

  const handleHelpClick = () => {
    window.open(`https://github.com/Luligu/matterbridge/blob/main/README.md`, '_blank');
  };

  const handleChangelogClick = () => {
    if(settings?.matterbridgeInformation.matterbridgeVersion.includes('-dev-')) {
      window.open(`https://github.com/Luligu/matterbridge/blob/dev/CHANGELOG.md`, '_blank');
    } else {
      window.open(`https://github.com/Luligu/matterbridge/blob/main/CHANGELOG.md`, '_blank');
    }
  };

  const handleDiscordLogoClick = () => {
    window.open(`https://discord.gg/QX58CDe6hd`, '_blank');
  };

  const handleStarClick = () => {
    window.open('https://github.com/Luligu/matterbridge', '_blank');
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
    if (settings?.matterbridgeInformation.restartMode === '') {
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

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuCloseConfirm = (value: string) => {
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

  const handleMenuCloseCancel = (value: string) => {
    if(debug) console.log('Header: handleMenuCloseCancel:', value);
    setMenuAnchorEl(null);
  };


  const handleBackupMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setBackupMenuAnchorEl(event.currentTarget);
  };

  const handleBackupMenuClose = () => {
    setBackupMenuAnchorEl(null);
  };


  const handleViewMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setViewMenuAnchorEl(event.currentTarget);
  };

  const handleViewMenuClose = () => {
    setViewMenuAnchorEl(null);
  };


  const handleDownloadMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setDownloadMenuAnchorEl(event.currentTarget);
  };

  const handleDownloadMenuClose = () => {
    setDownloadMenuAnchorEl(null);
  };

  const handleResetMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
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
    const handleWebSocketMessage = (msg: WsMessage) => {
      /* Header listener */
      // if (debug) console.log(`Header received WebSocket Message id ${msg.id}:`, msg);
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        // Local messages
        if (isApiResponse(msg) && msg.method === '/api/settings' && msg.id === uniqueId.current ) {
          if (debug) console.log('Header received settings:', msg.response);
          setSettings(msg.response);
          setRestart(msg.response.matterbridgeInformation.restartRequired || msg.response.matterbridgeInformation.fixedRestartRequired);
          setFixedRestart(msg.response.matterbridgeInformation.fixedRestartRequired);
          setUpdate(msg.response.matterbridgeInformation.updateRequired);
        }
        // Broadcast messages
        if (isBroadcast(msg) && msg.method === 'refresh_required' && msg.params.changed === 'settings') {
          if (debug) console.log(`Header received refresh_required: changed=${msg.params.changed} and sending /api/settings request`);
          sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (isBroadcast(msg) && msg.method === 'restart_required') {
          if (debug) console.log(`Header received restart_required with fixed: ${msg.params.fixed}`);
          setRestart(true);
          if(msg.params.fixed === true) setFixedRestart(true);
        }
        if (isBroadcast(msg) && msg.method === 'restart_not_required') {
          if (debug) console.log(`Header received restart_not_required`);
          setRestart(false);
        }
        if (isBroadcast(msg) && msg.method === 'update_required') {
          if (debug) console.log('Header received update_required');
          setUpdate(true);
          sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (isBroadcast(msg) && msg.method === 'update_required_dev') {
          if (debug) console.log('Header received update_required_dev');
          setUpdateDev(true);
          sendMessage({ id: uniqueId.current, sender: 'Header', method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (isBroadcast(msg) && msg.id === WsBroadcastMessageId.ShellySysUpdate) {
          if (debug) console.log('Header received WS_ID_SHELLY_SYS_UPDATE:');
          setSettings(prevSettings =>
            prevSettings
              ? {
                  matterbridgeInformation: { ...prevSettings.matterbridgeInformation, shellySysUpdate: msg.params.available },
                  systemInformation: prevSettings.systemInformation,
                }
              : null
          );
        }
        if (isBroadcast(msg) && msg.id === WsBroadcastMessageId.ShellyMainUpdate) {
          if (debug) console.log('Header received WS_ID_SHELLY_MAIN_UPDATE:');
          setSettings(prevSettings =>
            prevSettings
              ? {
                  matterbridgeInformation: { ...prevSettings.matterbridgeInformation, shellyMainUpdate: msg.params.available },
                  systemInformation: prevSettings.systemInformation,
                }
              : null
          );
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
        {!settings.matterbridgeInformation.readOnly && update &&
          <Tooltip title="New Matterbridge version available, click to install">
            <span className="status-warning" onClick={handleUpdateClick}>
              Update to v.{settings.matterbridgeInformation.matterbridgeLatestVersion}
            </span>
          </Tooltip>
        }
        {!settings.matterbridgeInformation.readOnly && updateDev &&
          <Tooltip title="New Matterbridge dev version available, click to install">
            <span className="status-warning" onClick={handleUpdateDevClick}>
              Update to new dev v.{settings.matterbridgeInformation.matterbridgeDevVersion.split('-dev-')[0]}
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
        {/*settings.matterbridgeInformation.shellyBoard && settings.matterbridgeInformation.xxxmatterbridgeVersion &&
          <Tooltip title="Matterbridge version">
            <span style={{ fontSize: '12px', color: 'var(--main-icon-color)' }} onClick={handleChangelogClick}>
              v.{settings.matterbridgeInformation.matterbridgeVersion}
            </span>
          </Tooltip>
        */}
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
            <img src="discord.svg" alt="Discord Logo" style={{ cursor: 'pointer', height: '25px' }} onClick={handleDiscordLogoClick}/>
          </Tooltip>
        ) : null}
        {settings.matterbridgeInformation.readOnly === false ? (
          <Tooltip title="Give a star to Matterbridge">
            <IconButton style={{ color: '#FFD700', margin: '0', padding: '0' }} onClick={handleStarClick}>
              <StarIcon  />
            </IconButton>
          </Tooltip>
        ) : null}
        {settings.matterbridgeInformation.readOnly === false ? (
          <Tooltip title="Sponsor Matterbridge">
            <IconButton style={{ color: '#b6409c', margin: '0', padding: '0' }} onClick={handleSponsorClick}>
              <Favorite  />
            </IconButton>
          </Tooltip>
        ) : null}
        <Tooltip title="Matterbridge help">
          <IconButton style={{ color: 'var(--main-icon-color)', margin: '0', marginLeft: '5px', padding: '0' }} onClick={handleHelpClick}>
            <HelpOutlineIcon  />
          </IconButton>
        </Tooltip>
        <Tooltip title="Matterbridge changelog">
          <IconButton style={{ color: 'var(--main-icon-color)', margin: '0', marginLeft: '5px', padding: '0' }} onClick={handleChangelogClick}>
            <AnnouncementOutlinedIcon  />
          </IconButton>
        </Tooltip>
        {settings.matterbridgeInformation && !settings.matterbridgeInformation.readOnly &&
          <Tooltip title="Update matterbridge to latest version">
            <IconButton style={{ color: update ? 'var(--primary-color)' : 'var(--main-icon-color)', margin: '0', marginLeft: '5px', padding: '0' }} onClick={handleUpdateClick}>
              <SystemUpdateAltIcon />
            </IconButton>
          </Tooltip>
        }
        {settings.matterbridgeInformation && settings.matterbridgeInformation.shellyBoard && settings.matterbridgeInformation.shellySysUpdate &&
          <Tooltip title="Shelly system update">
            <IconButton style={{ color: 'var(--primary-color)', margin: '0', marginLeft: '5px', padding: '0px' }} onClick={handleShellySystemUpdateClick}>
              <SystemUpdateAltIcon />
            </IconButton>
          </Tooltip>
        }
        {settings.matterbridgeInformation && settings.matterbridgeInformation.shellyBoard && settings.matterbridgeInformation.shellyMainUpdate &&
          <Tooltip title="Shelly software update">
            <IconButton style={{ color: 'var(--primary-color)', margin: '0', marginLeft: '5px', padding: '0px' }} onClick={handleShellyMainUpdateClick}>
              <SystemUpdateAltIcon />
            </IconButton>
          </Tooltip>
        }
        <Tooltip title="Restart matterbridge">
          <IconButton style={{ color: restart || fixedRestart ? 'var(--primary-color)' : 'var(--main-icon-color)', margin: '0', marginLeft: '5px', padding: '0px' }} onClick={handleRestartClick}>
            <RestartAltIcon />
          </IconButton>
        </Tooltip>
        {settings.matterbridgeInformation.restartMode === '' ? (
          <Tooltip title="Shut down matterbridge">
            <IconButton style={{ color: restart || fixedRestart ? 'var(--primary-color)' : 'var(--main-icon-color)', margin: '0', marginLeft: '5px', padding: '0px' }} onClick={handleShutdownClick}>
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

export default memo(Header);
