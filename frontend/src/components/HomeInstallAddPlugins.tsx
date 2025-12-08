// React
import { useState, useContext, useRef, memo } from 'react';

// @mui/material
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';

// @mui/icons-material
import Download from '@mui/icons-material/Download';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import Add from '@mui/icons-material/Add';
import MoreVert from '@mui/icons-material/MoreVert';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';

// Frontend
import { UiContext } from './UiProvider';
import { WebSocketContext } from './WebSocketProvider';
import { MbfWindow, MbfWindowContent, MbfWindowHeader, MbfWindowHeaderText, MbfWindowIcons } from './MbfWindow';
import { debug, enableMobile } from '../App';

function HomeInstallAddPlugins() {
  // Contexts
  const { mobile } = useContext(UiContext);
  const { logMessage, sendMessage, getUniqueId } = useContext(WebSocketContext);

  // States
  const [pluginName, setPluginName] = useState('matterbridge-');
  const [_dragging, setDragging] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  // @mui/material
  // Refs
  const uniqueId = useRef(getUniqueId());

  // Handle drag events
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      logMessage('Plugins', `Installing package ${file.name}. Please wait...`);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', file.name);

      // Send the file content and filename to the server
      fetch('./api/uploadpackage', {
        method: 'POST',
        body: formData,
      })
        .then((response) => response.text())
        .then((data) => {
          logMessage('Plugins', `Server response: ${data}`);
        })
        .catch((error) => {
          console.error('Error uploading plugin file:', error);
          logMessage('Plugins', `Error installing package ${error}`);
        });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      logMessage('Plugins', `Uploading package ${file.name}`);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', file.name);

      // Send the file content and filename to the server
      fetch('./api/uploadpackage', {
        method: 'POST',
        body: formData,
      })
        .then((response) => response.text())
        .then((data) => {
          logMessage('Plugins', `Server response: ${data}`);
        })
        .catch((error) => {
          console.error('Error uploading plugin file:', error);
          logMessage('Plugins', `Error uploading package ${error}`);
        });
    }
  };

  const handleInstallPluginClick = () => {
    sendMessage({ id: uniqueId.current, sender: 'InstallPlugins', method: '/api/install', src: 'Frontend', dst: 'Matterbridge', params: { packageName: pluginName, restart: false } });
  };

  const handleUninstallPluginClick = () => {
    sendMessage({ id: uniqueId.current, sender: 'InstallPlugins', method: '/api/uninstall', src: 'Frontend', dst: 'Matterbridge', params: { packageName: pluginName } });
  };

  const handleUploadClick = () => {
    document.getElementById('file-upload')?.click();
  };

  const handleAddPluginClick = () => {
    sendMessage({ id: uniqueId.current, sender: 'InstallPlugins', method: '/api/addplugin', src: 'Frontend', dst: 'Matterbridge', params: { pluginNameOrPath: pluginName } });
  };

  // Right-click handlers
  const handleUploadRightClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    console.log('Right-clicked Upload button');
  };

  const handleAddRightClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    console.log('Right-clicked Add button');
  };

  const handleClickVertical = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget as HTMLElement);
  };

  const handleCloseMenu = (value: string) => {
    if (value !== '') setPluginName(value);
    setAnchorEl(null);
  };

  const [closed, setClosed] = useState(false);

  if (debug) console.log('HomeInstallAddPlugins rendering...');

  if (closed) return null;
  return (
    <MbfWindow>
      <MbfWindowHeader>
        <MbfWindowHeaderText>Install plugins</MbfWindowHeaderText>
        <MbfWindowIcons onClose={() => setClosed(true)} />
      </MbfWindowHeader>
      <MbfWindowContent
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleFileDrop}
        style={enableMobile && mobile ? { flexWrap: 'wrap', alignItems: 'center', gap: '10px' } : { flexWrap: 'wrap', alignItems: 'center', gap: '20px' }}
      >
        {/* Input and menu */}
        <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
          <TextField
            value={pluginName}
            onChange={(event) => {
              setPluginName(event.target.value);
            }}
            size='small'
            id='plugin-name'
            label='Plugin name or plugin path'
            variant='outlined'
            fullWidth
          />
          <IconButton onClick={handleClickVertical}>
            <MoreVert />
          </IconButton>
          <Menu id='simple-menu' anchorEl={anchorEl} keepMounted open={Boolean(anchorEl)} onClose={() => handleCloseMenu('')}>
            <MenuItem onClick={() => handleCloseMenu('matterbridge-zigbee2mqtt')}>matterbridge-zigbee2mqtt</MenuItem>
            <MenuItem onClick={() => handleCloseMenu('matterbridge-somfy-tahoma')}>matterbridge-somfy-tahoma</MenuItem>
            <MenuItem onClick={() => handleCloseMenu('matterbridge-shelly')}>matterbridge-shelly</MenuItem>
            <MenuItem onClick={() => handleCloseMenu('matterbridge-hass')}>matterbridge-hass</MenuItem>
            <MenuItem onClick={() => handleCloseMenu('matterbridge-webhooks')}>matterbridge-webhooks</MenuItem>
            <MenuItem onClick={() => handleCloseMenu('matterbridge-bthome')}>matterbridge-bthome</MenuItem>
            <MenuItem onClick={() => handleCloseMenu('matterbridge-test')}>matterbridge-test</MenuItem>
            <MenuItem onClick={() => handleCloseMenu('matterbridge-example-accessory-platform')}>matterbridge-example-accessory-platform</MenuItem>
            <MenuItem onClick={() => handleCloseMenu('matterbridge-example-dynamic-platform')}>matterbridge-example-dynamic-platform</MenuItem>
            <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-door')}>matterbridge-eve-door</MenuItem>
            <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-motion')}>matterbridge-eve-motion</MenuItem>
            <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-energy')}>matterbridge-eve-energy</MenuItem>
            <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-weather')}>matterbridge-eve-weather</MenuItem>
            <MenuItem onClick={() => handleCloseMenu('matterbridge-eve-room')}>matterbridge-eve-room</MenuItem>
          </Menu>
        </div>
        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <Tooltip title='Install or update a plugin from npm'>
            <Button onClick={handleInstallPluginClick} endIcon={<Download />} style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px', minWidth: '90px' }}>
              {' '}
              Install
            </Button>
          </Tooltip>
          <Tooltip title='Uninstall and remove a plugin'>
            <Button onClick={handleUninstallPluginClick} endIcon={<DeleteForeverOutlinedIcon />} style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px', minWidth: '90px' }}>
              {' '}
              Uninstall
            </Button>
          </Tooltip>
          <Tooltip title='Upload and install a plugin from a tarball'>
            <Button onClick={handleUploadClick} onContextMenu={handleUploadRightClick} endIcon={<FileUploadIcon />} style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px', minWidth: '90px' }}>
              {' '}
              Upload
            </Button>
          </Tooltip>
          <Tooltip title='Add an installed plugin'>
            <Button onClick={handleAddPluginClick} onContextMenu={handleAddRightClick} endIcon={<Add />} style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px', minWidth: '90px' }}>
              {' '}
              Add
            </Button>
          </Tooltip>
          <input id='file-upload' type='file' accept='.tgz' style={{ display: 'none' }} onChange={handleFileUpload} />
        </div>
      </MbfWindowContent>
    </MbfWindow>
  );
}

export default memo(HomeInstallAddPlugins);
