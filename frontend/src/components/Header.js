// Header.js
import React from 'react';
import { Link } from 'react-router-dom';
import { Tooltip, IconButton, Button, ThemeProvider, createTheme } from '@mui/material';
import RestartAlt from '@mui/icons-material/RestartAlt';

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

function Header() {
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
        <Tooltip title="Restart matterbridge"><Button theme={theme} color="primary" variant="contained" size="small" endIcon={<RestartAlt />} style={{ color: '#ffffff' }}>Restart</Button></Tooltip>        
      </div>
    </div>
  );
}

export default Header;
