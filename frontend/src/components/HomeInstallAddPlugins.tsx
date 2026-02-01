// React
import { useState, useContext, useRef, memo } from 'react';

// @mui/material
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';

// @mui/icons-material
import Download from '@mui/icons-material/Download';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import Add from '@mui/icons-material/Add';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';

// Frontend
import { UiContext } from './UiProvider';
import { WebSocketContext } from './WebSocketProvider';
import { MbfWindow, MbfWindowContent, MbfWindowHeader, MbfWindowHeaderText, MbfWindowIcons } from './MbfWindow';
import { SearchPluginsDialog } from './SearchPluginsDialog';
import { debug, enableMobile } from '../App';

export const pluginIgnoreList = [
  'matterbridge-', // invalid name
  'matterbridge-plugin-template', // standard template repository - someone published on hist name!!!!!!!
  'matterbridge-dyson', // my package
  'matterbridge-irobot', // my package
  'matterbridge-tuya', // my package
  'matterbridge-mqtt', // my package
  'matterbridge-matter', // my package
  'matterbridge-security', // my package
  'matterbridge-automations', // my package
  'matterbridge-securitysystem', // empty place holder
  'matterbridge-adapter', // 5 years ago
];

function HomeInstallAddPlugins() {
  // Contexts
  const { mobile, showSnackbarMessage } = useContext(UiContext);
  const { logMessage, sendMessage, getUniqueId } = useContext(WebSocketContext);

  // States
  const [pluginName, setPluginName] = useState('matterbridge-');
  const [_dragging, setDragging] = useState(false);
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
    if (pluginIgnoreList.includes(pluginName.split('@')[0])) {
      showSnackbarMessage(`Installation of plugin "${pluginName}" is blocked by the ignore list.`);
      return;
    }
    sendMessage({ id: uniqueId.current, sender: 'InstallPlugins', method: '/api/install', src: 'Frontend', dst: 'Matterbridge', params: { packageName: pluginName, restart: false } });
  };

  const handleUninstallPluginClick = () => {
    sendMessage({ id: uniqueId.current, sender: 'InstallPlugins', method: '/api/uninstall', src: 'Frontend', dst: 'Matterbridge', params: { packageName: pluginName } });
  };

  const handleUploadClick = () => {
    document.getElementById('file-upload')?.click();
  };

  const handleAddPluginClick = () => {
    if (pluginIgnoreList.includes(pluginName.split('@')[0])) {
      showSnackbarMessage(`Addition of plugin "${pluginName}" is blocked by the ignore list.`);
      return;
    }
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

  // SearchPluginsDialog states and handlers
  const [openSearchDialog, setOpenSearchDialog] = useState(false);
  const handleOpenSearchDialog = () => {
    setOpenSearchDialog(true);
    console.log('Dialog opened for selection');
  };
  const handleCloseSearchDialog = () => {
    setPluginName('matterbridge-');
    setOpenSearchDialog(false);
    console.log('Dialog closed without selection');
  };
  const handleSelectSearchDialog = (selected: string) => {
    setPluginName(selected);
    setOpenSearchDialog(false);
    console.log('Select plugin:', selected);
  };
  const handleInstallSearchDialog = (selected: string) => {
    setPluginName(selected);
    setOpenSearchDialog(false);
    handleInstallPluginClick();
    console.log('Install plugin:', selected);
  };
  const handleAddSearchDialog = (selected: string) => {
    setPluginName(selected);
    setOpenSearchDialog(false);
    handleAddPluginClick();
    console.log('Add plugin:', selected);
  };

  const [closed, setClosed] = useState(false);

  if (debug) console.log('HomeInstallAddPlugins rendering...');

  if (closed) return null;
  return (
    <MbfWindow>
      <MbfWindowHeader>
        <MbfWindowHeaderText>Install plugins</MbfWindowHeaderText>
        <MbfWindowIcons close={() => setClosed(true)} />
      </MbfWindowHeader>
      <MbfWindowContent
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleFileDrop}
        style={enableMobile && mobile ? { flexWrap: 'wrap', alignItems: 'center', gap: '10px' } : { flexWrap: 'wrap', alignItems: 'center', gap: '20px' }}
      >
        {/* SearchPluginDialog */}
        <SearchPluginsDialog open={openSearchDialog} onClose={handleCloseSearchDialog} onSelect={handleSelectSearchDialog} onInstall={handleInstallSearchDialog} onAdd={handleAddSearchDialog} />

        {/* Input and search IconButton */}
        <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
          <Tooltip title='Provide the npm name or the local path of the plugin to install, uninstall, or add'>
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
          </Tooltip>
          <Tooltip title='Search on npm the plugin to install'>
            <IconButton size='large' onClick={handleOpenSearchDialog}>
              <ManageSearchIcon fontSize='inherit' />
            </IconButton>
          </Tooltip>
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
          <Tooltip title='Add an already installed plugin or a plugin from a local path'>
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
