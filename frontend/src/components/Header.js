// Header.js
import React from 'react';
import { Link } from 'react-router-dom';
import { Tooltip, Button, createTheme } from '@mui/material';
import DriveFolderUploadIcon from '@mui/icons-material/DriveFolderUpload';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import info from './Settings';

/*
    <div className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '20px', margin: '0', padding: '20px', height: '40px' }}>
        <Link to="/test" className="nav-link">Test</Link>
        <Tooltip title="Restart matterbridge"><IconButton style={{padding: 0}} className="PluginsIconButton" size="small"><RestartAlt /></IconButton></Tooltip>        
*/

const theme = createTheme({
  palette: {
    primary: {
      main: '#4CAF50', // your custom primary color
    },
  },
});

export function sendCommandToMatterbridge(command, param) {
  console.log('sendCommandToMatterbridge:', command, param);
  // Send a POST request to the Matterbridge API
  fetch(`/api/command/${command}/${param}`, {
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

  // Define the function that sends the "restart" command
  const handleAddPluginClick = () => {
    sendCommandToMatterbridge('addplugin','xxxx');
    setOpen(true);
    setTimeout(() => {
      setOpen(false);
    }, 20000);
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
        <Tooltip title="Update matterbridge"><Button disabled theme={theme} color="primary" variant="contained" size="small" endIcon={<SystemUpdateAltIcon />} style={{ color: '#ffffff' }} onClick={handleUpdateClick}>Update</Button></Tooltip>        
        <Tooltip title="Restart matterbridge"><Button theme={theme} color="primary" variant="contained" size="small" endIcon={<RestartAltIcon />} style={{ color: '#ffffff' }} onClick={handleRestartClick}>Restart</Button></Tooltip>        
        <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={open} onClick={handleClose}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    </div>
  );
}

export default Header;
