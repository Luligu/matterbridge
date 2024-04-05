// Header.js
import React from 'react';
import { Link } from 'react-router-dom';
import { Tooltip, Button, createTheme } from '@mui/material';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import info from './Settings';

/*
*/

const theme = createTheme({
  palette: {
    primary: {
      main: '#4CAF50', // your custom primary color
    },
  },
});

export function sendCommandToMatterbridge(command, param) {
  const sanitizedParam = param.replace(/\\/g, '*');
  console.log('sendCommandToMatterbridge:', command, param, sanitizedParam);
  // Send a POST request to the Matterbridge API
  fetch(`/api/command/${command}/${sanitizedParam}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
  const handleClose = () => {
    setOpen(false);
  };

  const handleUpdateClick = () => {
    sendCommandToMatterbridge('update','now');
    setOpen(true);
    setTimeout(() => {
      setOpen(false);
    }, 20000);
  };

  const handleRestartClick = () => {
    sendCommandToMatterbridge('restart','now');
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

  return (
    <div className="header">
      <img src="matterbridge 64x64.png" alt="Matterbridge Logo" style={{ height: '30px' }} />
      <h2>Matterbridge {info.matterbridgeVersion}</h2>
      <nav>
        <Link to="/" className="nav-link">Home</Link>
        <Link to="/devices" className="nav-link">Devices</Link>
        <Link to="/settings" className="nav-link">Settings</Link>
      </nav>
      <div className="header" style={{ flex: 1, display: 'flex', flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Tooltip title="Update matterbridge">
          <Button disabled theme={theme} color="primary" variant="contained" size="small" endIcon={<SystemUpdateAltIcon />} style={{ color: '#ffffff' }} onClick={handleUpdateClick}>Update</Button>
        </Tooltip>        
        <Tooltip title="Restart matterbridge">
          <Button theme={theme} color="primary" variant="contained" size="small" endIcon={<RestartAltIcon />} style={{ color: '#ffffff' }} onClick={handleRestartClick}>Restart</Button>
        </Tooltip>        
        <Tooltip title="Shut down matterbridge">
          <Button theme={theme} color="primary" variant="contained" size="small" endIcon={<PowerSettingsNewIcon />} style={{ color: '#ffffff' }} onClick={handleShutdownClick}>Shutdown</Button>
        </Tooltip>        
        <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={open} onClick={handleClose}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    </div>
  );
}

export default Header;
