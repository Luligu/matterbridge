// React
import { useState, useContext, useRef, memo } from 'react';

// @mui/material
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

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
  const [pluginVersions, setPluginVersions] = useState<string[]>(['latest', 'dev']);
  const [selectedPluginVersion, setSelectedPluginVersion] = useState<string>('latest');
  const [_dragging, setDragging] = useState(false);
  // Refs
  const uniqueId = useRef(getUniqueId());

  const splitPackageNameAndSpecifier = (input: string): { name: string; specifier: string | null } => {
    const s = String(input ?? '').trim();
    if (!s) return { name: '', specifier: null };

    // Scoped package: @scope/name@specifier
    if (s.startsWith('@')) {
      const at = s.lastIndexOf('@');
      if (at > 0) {
        const before = s.slice(0, at);
        const after = s.slice(at + 1);
        if (before.includes('/') && after) return { name: before, specifier: after };
      }
      return { name: s, specifier: null };
    }

    // Unscoped: name@specifier
    const at = s.indexOf('@');
    if (at > 0) {
      const before = s.slice(0, at);
      const after = s.slice(at + 1);
      if (after) return { name: before, specifier: after };
      return { name: before, specifier: null };
    }

    return { name: s, specifier: null };
  };

  const buildInstallPackageName = (): string => {
    const { name, specifier } = splitPackageNameAndSpecifier(pluginName);
    if (!name) return '';

    // If the user typed a specifier directly, respect it.
    if (specifier) return `${name}@${specifier}`;

    // Otherwise, apply dropdown selection (latest/dev/version) if available.
    if (selectedPluginVersion) return `${name}@${selectedPluginVersion}`;

    return name;
  };

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
    const installName = buildInstallPackageName();
    if (!installName) return;
    if (pluginIgnoreList.includes(installName.split('@')[0])) {
      showSnackbarMessage(`Installation of plugin "${installName}" is blocked by the ignore list.`);
      return;
    }
    sendMessage({ id: uniqueId.current, sender: 'InstallPlugins', method: '/api/install', src: 'Frontend', dst: 'Matterbridge', params: { packageName: installName, restart: false } });
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
    if (debug) console.log('Right-clicked Upload button');
  };

  const handleAddRightClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (debug) console.log('Right-clicked Add button');
  };

  // SearchPluginsDialog states and handlers
  const [openSearchDialog, setOpenSearchDialog] = useState(false);
  const handleOpenSearchDialog = () => {
    setOpenSearchDialog(true);
    if (debug) console.log('Dialog opened for selection');
  };
  const handleCloseSearchDialog = () => {
    setPluginName('matterbridge-');
    setOpenSearchDialog(false);
    if (debug) console.log('Dialog closed without selection');
  };
  const handleSelectSearchDialog = (selected: string) => {
    setPluginName(selected);
    setOpenSearchDialog(false);
    if (debug) console.log('Select plugin:', selected);
  };
  const handleVersionsSearchDialog = (versions: string[]) => {
    setPluginVersions(versions);
    // Default to 'latest' tag if present.
    setSelectedPluginVersion(versions.includes('latest') ? 'latest' : (versions[0] ?? ''));
    if (debug) console.log('Select plugin versions:', versions);
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
        <SearchPluginsDialog open={openSearchDialog} onClose={handleCloseSearchDialog} onSelect={handleSelectSearchDialog} onVersions={handleVersionsSearchDialog} />

        {/* Input and search IconButton */}
        <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
          <Tooltip title='Provide the npm name or the local path of the plugin to install, uninstall, or add'>
            <TextField
              value={pluginName}
              onChange={(event) => {
                const next = event.target.value;
                // Manual edit: clear the versions list so the dropdown disappears.
                setPluginVersions(['latest', 'dev']);
                setSelectedPluginVersion('latest');
                setPluginName(next);
              }}
              size='small'
              id='plugin-name'
              label='Plugin name or plugin path'
              variant='outlined'
              fullWidth
            />
          </Tooltip>
          {pluginVersions.length > 0 && (
            <Tooltip title='Select the npm tag/version to install'>
              <span>
                <FormControl size='small' style={{ minWidth: '150px' }}>
                  <InputLabel id='plugin-version-label'>Tag or version</InputLabel>
                  <Select labelId='plugin-version-label' id='plugin-version' value={selectedPluginVersion} label='Tag or version' onChange={(event) => setSelectedPluginVersion(String(event.target.value ?? ''))}>
                    {pluginVersions.map((v) => (
                      <MenuItem key={v} value={v}>
                        {v}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </span>
            </Tooltip>
          )}
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
