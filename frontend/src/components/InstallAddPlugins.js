/* eslint-disable no-console */
// React
import React, { useState, useContext } from 'react';

// @mui/material
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';

// @mui/icons-material
import Download from '@mui/icons-material/Download';
import Add from '@mui/icons-material/Add';
import MoreVert from '@mui/icons-material/MoreVert';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { sendCommandToMatterbridge } from './sendApiCommand';
import { debug } from '../App';

export function InstallAddPlugins() {
  const [pluginName, setPluginName] = useState('matterbridge-');
  const [anchorEl, setAnchorEl] = React.useState(null);
  const { logMessage } = useContext(WebSocketContext);

  const handleInstallPluginClick = () => {
    const plugin = pluginName.split('@')[0];
    if (plugin === 'matterbridge')
      logMessage('Matterbridge', `Installing matterbridge package: ${pluginName}`);
    else
      logMessage('Plugins', `Installing plugin: ${pluginName}`);
    sendCommandToMatterbridge('installplugin', pluginName);
  };

  const handleAddPluginClick = () => {
    logMessage('Plugins', `Adding plugin: ${pluginName}`);
    sendCommandToMatterbridge('addplugin', pluginName);
  };

  const handleClickVertical = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = (value) => {
    if (value !== '') setPluginName(value);
    setAnchorEl(null);
  };

  if(debug) console.log('AddRemovePlugins rendering...');
  return (
    <div style={{ display: 'flex', flexDirection: 'row', flex: '1 1 auto', alignItems: 'center', justifyContent: 'space-between', margin: '0px', padding: '10px', gap: '20px' }}>
      <TextField value={pluginName} onChange={(event) => { setPluginName(event.target.value); }} size="small" id="plugin-name" label="Plugin name or plugin path" variant="outlined" fullWidth />
      <IconButton onClick={handleClickVertical}>
        <MoreVert />
      </IconButton>
      <Menu id="simple-menu" anchorEl={anchorEl} keepMounted open={Boolean(anchorEl)} onClose={() => handleCloseMenu('')}>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-zigbee2mqtt')}>matterbridge-zigbee2mqtt</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-somfy-tahoma')}>matterbridge-somfy-tahoma</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-shelly')}>matterbridge-shelly</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-hass')}>matterbridge-hass</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-example-accessory-platform')}>matterbridge-example-accessory-platform</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-example-dynamic-platform')}>matterbridge-example-dynamic-platform</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-door')}>matterbridge-eve-door</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-motion')}>matterbridge-eve-motion</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-energy')}>matterbridge-eve-energy</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-weather')}>matterbridge-eve-weather</MenuItem>
        <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-room')}>matterbridge-eve-room</MenuItem>
      </Menu>
      <Tooltip title="Install or update a plugin from npm">
        <Button onClick={handleInstallPluginClick} endIcon={<Download />} style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px', minWidth: '90px' }}> Install</Button>
      </Tooltip>
      <Tooltip title="Add an installed plugin">
        <Button onClick={handleAddPluginClick} endIcon={<Add />} style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px', minWidth: '90px' }}> Add</Button>
      </Tooltip>
    </div>
  );
}

