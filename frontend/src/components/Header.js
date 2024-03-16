// Header.js
import React from 'react';
import { Link } from 'react-router-dom';
import { Tooltip, IconButton, Button, createTheme } from '@mui/material';
import DriveFolderUploadIcon from '@mui/icons-material/DriveFolderUpload';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
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
  // Define the function that sends the "restart" command
  const handleAddPluginClick = () => {
    sendCommandToMatterbridge('addplugin','xxxx');
  };

  const handleUpdateClick = () => {
    sendCommandToMatterbridge('update','now');
  };

  const handleRestartClick = () => {
    sendCommandToMatterbridge('restart','now');
  };

  return (
    <div className="header">
      <img src="matterbridge 64x64.png" alt="Matterbridge Logo" style={{ height: '30px' }} />
      <h2>Matterbridge</h2>
      <nav>
        <Link to="/" className="nav-link">Home</Link>
        <Link to="/devices" className="nav-link">Devices</Link>
        <Link to="/settings" className="nav-link">Settings</Link>
      </nav>
      <div className="header" style={{ flex: 1, display: 'flex', flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Tooltip title="Add plugin"><Button theme={theme} color="primary" variant="contained" size="small" endIcon={<DriveFolderUploadIcon />} style={{ color: '#ffffff' }} onClick={handleAddPluginClick}>Add plugin</Button></Tooltip>        
        <Tooltip title="Update matterbridge"><Button theme={theme} color="primary" variant="contained" size="small" endIcon={<SystemUpdateAltIcon />} style={{ color: '#ffffff' }} onClick={handleUpdateClick}>Update</Button></Tooltip>        
        <Tooltip title="Restart matterbridge"><Button theme={theme} color="primary" variant="contained" size="small" endIcon={<RestartAltIcon />} style={{ color: '#ffffff' }} onClick={handleRestartClick}>Restart</Button></Tooltip>        
      </div>
    </div>
  );
}

export default Header;
