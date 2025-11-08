// React
import { useContext, useEffect, useState, useRef, memo } from 'react';

// @mui/material
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

// @mui/icons-material
import Favorite from '@mui/icons-material/Favorite';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AnnouncementOutlinedIcon from '@mui/icons-material/AnnouncementOutlined';
import PublishedWithChanges from '@mui/icons-material/PublishedWithChanges';
import UnpublishedOutlinedIcon from '@mui/icons-material/UnpublishedOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import QrCode2 from '@mui/icons-material/QrCode2';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { UiContext } from './UiProvider';
import { Connecting } from './Connecting';
import { StatusIndicator } from './StatusIndicator';
import MbfTable, { MbfTableColumn } from './MbfTable';
import { ConfigPluginDialog } from './ConfigPluginDialog';
import { ApiPlugin, MatterbridgeInformation, SystemInformation } from '../../../src/matterbridgeTypes';
import { WsMessageApiResponse } from '../../../src/frontendTypes';
import { getQRColor } from './getQRColor';
import { debug } from '../App';
import { MbfWindow } from './MbfWindow';
// const debug = true;

interface HomePluginsProps {
  storeId: string | null;
  setStoreId: (id: string | null) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function HomePlugins({ storeId, setStoreId }: HomePluginsProps) {
  // Contexts
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);
  const { showConfirmCancelDialog } = useContext(UiContext);
  // Refs
  const uniqueId = useRef(getUniqueId());
  // States
  const [_systemInfo, setSystemInfo] = useState<SystemInformation | null>(null);
  const [matterbridgeInfo, setMatterbridgeInfo] = useState<MatterbridgeInformation | null>(null);
  const [plugins, setPlugins] = useState<ApiPlugin[]>([]);

  const pluginsColumns: MbfTableColumn<ApiPlugin>[] = [
    {
      label: 'Name',
      id: 'name',
      required: true,
      render: (value, rowKey, plugin, _column) => (
        <Tooltip title={`Plugin path ${plugin.path}`}>
          <span style={{ cursor: 'pointer' }} onClick={() => handleHomepagePlugin(plugin)}>
            {plugin.name}
          </span>
        </Tooltip>
      ),
    },
    {
      label: 'Description',
      id: 'description',
      render: (value, rowKey, plugin, _column) => (
        <Tooltip title='Open the plugin homepage'>
          <span style={{ cursor: 'pointer' }} onClick={() => handleHomepagePlugin(plugin)}>
            {plugin.description}
          </span>
        </Tooltip>
      ),
    },
    {
      label: 'Version',
      id: 'version',
      render: (value, rowKey, plugin, _column) => (
        <>
          {/*plugin.latestVersion !== undefined && plugin.latestVersion !== plugin.version && matterbridgeInfo && !matterbridgeInfo.readOnly && (
            <Tooltip title='New plugin stable version available, click to install'>
              <span className='status-warning' style={{ marginRight: '10px' }} onClick={() => handleUpdatePlugin(plugin)}>
                Update to v.{plugin.latestVersion}
              </span>
            </Tooltip>
          )}
          {plugin.version.includes('-dev-') && plugin.devVersion !== undefined && plugin.devVersion !== plugin.version && matterbridgeInfo && !matterbridgeInfo.readOnly && (
            <Tooltip title='New plugin dev version available, click to install'>
              <span className='status-warning' style={{ marginRight: '10px' }} onClick={() => handleUpdateDevPlugin(plugin)}>
                Update to new dev v.{plugin.devVersion.split('-dev-')[0]}
              </span>
            </Tooltip>
          )*/}
          <Tooltip title={`Plugin v.${plugin.version}`}>
            <span>{plugin.version.split('-dev-')[0] + (plugin.version.includes('-dev-') ? '@dev' : '')}</span>
          </Tooltip>
        </>
      ),
    },
    {
      label: 'Author',
      id: 'author',
      render: (value, rowKey, plugin, _column) => <>{plugin.author ? plugin.author.replace('https://github.com/', '') : 'Unknown'}</>,
    },
    {
      label: 'Type',
      id: 'type',
      render: (value, rowKey, plugin, _column) => <>{plugin.type ? plugin.type.replace('Platform', '') : 'Unknown'}</>,
    },
    {
      label: 'Devices',
      id: 'registeredDevices',
    },
    {
      label: 'Actions',
      id: 'actions',
      required: true,
      noSort: true,
      render: (value, rowKey, plugin, _column) => (
        <div style={{ margin: '0px', padding: '0px', gap: '4px', display: 'flex', flexDirection: 'row' }}>
          {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' && !plugin.error && plugin.enabled && (
            <Tooltip title='Shows the QRCode or the fabrics' slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton
                style={{ margin: '0', padding: '0', width: '19px', height: '19px', color: getQRColor(plugin.matter) }}
                onClick={() => {
                  if (plugin.matter?.id) setStoreId(plugin.matter?.id);
                }}
                size='small'
              >
                <QrCode2 />
              </IconButton>
            </Tooltip>
          )}
          {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' && !plugin.error && plugin.enabled && (
            <Tooltip title='Restart the plugin' slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton style={{ margin: '0', padding: '0', width: '19px', height: '19px' }} onClick={() => handleRestartPlugin(plugin)} size='small'>
                <RestartAltIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title='Plugin config' slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
            <IconButton disabled={plugin.restartRequired === true} style={{ margin: '0px', padding: '0px', width: '19px', height: '19px' }} onClick={() => handleConfigPlugin(plugin)} size='small'>
              <SettingsOutlinedIcon />
            </IconButton>
          </Tooltip>
          {matterbridgeInfo && !matterbridgeInfo.readOnly && (
            <Tooltip title='Remove the plugin' slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton
                style={{ margin: '0px', padding: '0px', width: '19px', height: '19px' }}
                onClick={() => {
                  handleActionWithConfirmCancel('Remove plugin', 'Are you sure? This will also remove all devices and configuration from the controller.', 'remove', plugin);
                }}
                size='small'
              >
                <DeleteForeverOutlinedIcon />
              </IconButton>
            </Tooltip>
          )}
          {plugin.enabled ? (
            <Tooltip title='Disable the plugin' slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton
                style={{ margin: '0px', padding: '0px', width: '19px', height: '19px' }}
                onClick={() => {
                  handleActionWithConfirmCancel('Disable plugin', 'Are you sure? This will also remove all devices and configuration from the controller.', 'disable', plugin);
                }}
                size='small'
              >
                <UnpublishedOutlinedIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <></>
          )}
          {!plugin.enabled ? (
            <Tooltip title='Enable the plugin' slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton style={{ margin: '0px', padding: '0px', width: '19px', height: '19px' }} onClick={() => handleEnableDisablePlugin(plugin)} size='small'>
                <PublishedWithChanges />
              </IconButton>
            </Tooltip>
          ) : (
            <></>
          )}
          <Tooltip title='Open the plugin help' slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
            <IconButton style={{ margin: '0px 2px', padding: '0px', width: '19px', height: '19px' }} onClick={() => handleHelpPlugin(plugin)} size='small'>
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title='Open the plugin version history' slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
            <IconButton style={{ margin: '0px 2px', padding: '0px', width: '19px', height: '19px' }} onClick={() => handleChangelogPlugin(plugin)} size='small'>
              <AnnouncementOutlinedIcon />
            </IconButton>
          </Tooltip>
          {plugin.latestVersion !== undefined && plugin.latestVersion !== plugin.version && matterbridgeInfo && !matterbridgeInfo.readOnly && (
            <Tooltip title='Update the plugin to the latest version' slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton style={{ color: 'var(--primary-color)', margin: '0px 2px', padding: '0px', width: '19px', height: '19px' }} onClick={() => handleUpdatePlugin(plugin)} size='small'>
                <SystemUpdateAltIcon />
              </IconButton>
            </Tooltip>
          )}
          {plugin.version.includes('-dev-') && plugin.devVersion !== undefined && plugin.devVersion !== plugin.version && matterbridgeInfo && !matterbridgeInfo.readOnly && (
            <Tooltip title='Update the plugin to the latest dev version' slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton style={{ color: 'var(--primary-color)', margin: '0px 2px', padding: '0px', width: '19px', height: '19px' }} onClick={() => handleUpdateDevPlugin(plugin)} size='small'>
                <SystemUpdateAltIcon />
              </IconButton>
            </Tooltip>
          )}
          {matterbridgeInfo && !matterbridgeInfo.readOnly && (
            <Tooltip title='Sponsor the plugin' slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton style={{ margin: '0', padding: '0', width: '19px', height: '19px', color: '#b6409c' }} onClick={() => handleSponsorPlugin(plugin)} size='small'>
                <Favorite />
              </IconButton>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      label: 'Status',
      id: 'status',
      required: true,
      noSort: true,
      render: (value, rowKey, plugin, _column) => (
        <div style={{ display: 'flex', flexDirection: 'row', flex: '1 1 auto', margin: '0', padding: '0', gap: '5px', width: 'auto', maxWidth: 'max-content' }}>
          {plugin.error ? (
            <>
              <StatusIndicator status={false} enabledText='Error' disabledText='Error' tooltipText='The plugin is in error state. Check the log!' />
            </>
          ) : (
            <>
              {plugin.enabled === false ? (
                <>
                  <StatusIndicator status={plugin.enabled} enabledText='Enabled' disabledText='Disabled' tooltipText='Whether the plugin is enable or disabled' />
                </>
              ) : (
                <>
                  {plugin.loaded && plugin.started && plugin.configured ? (
                    <>
                      <StatusIndicator status={plugin.loaded} enabledText='Running' tooltipText='Whether the plugin is running' />
                    </>
                  ) : (
                    <>
                      <StatusIndicator status={plugin.loaded} enabledText='Loaded' tooltipText='Whether the plugin has been loaded' />
                      <StatusIndicator status={plugin.started} enabledText='Started' tooltipText='Whether the plugin started' />
                      <StatusIndicator status={plugin.configured} enabledText='Configured' tooltipText='Whether the plugin has been configured' />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  // WebSocket message handler effect
  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessageApiResponse) => {
      if (debug) console.log('HomePlugins received WebSocket Message:', msg);
      // Broadcast messages
      if (msg.method === 'refresh_required' && msg.response.changed === 'plugins') {
        if (debug) console.log(`HomePlugins received refresh_required: changed=${msg.response.changed} and sending /api/plugins request`);
        sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: '/api/plugins', src: 'Frontend', dst: 'Matterbridge', params: {} });
      } else if (msg.method === 'refresh_required' && msg.response.changed === 'matter') {
        if (debug) console.log(`HomePlugins received refresh_required: changed=${msg.response.changed} and setting matter id ${msg.response.matter?.id}`);
        setPlugins((prevPlugins) => {
          const i = prevPlugins.findIndex((p) => p.matter?.id === msg.response.matter?.id);
          if (i < 0) {
            if (debug) console.log(`HomePlugins received refresh_required: changed=${msg.response.changed} and matter id ${msg.response.matter?.id} not found`);
            return prevPlugins;
          }
          if (debug) console.log(`HomePlugins received refresh_required: changed=${msg.response.changed} set matter id ${msg.response.matter?.id}`);
          const next = [...prevPlugins];
          next[i] = { ...next[i], matter: msg.response.matter };
          return next;
        });
      } else if (msg.method === 'refresh_required' && msg.response.changed === 'settings') {
        if (debug) console.log(`HomePlugins received refresh_required: changed=${msg.response.changed} and sending /api/settings request`);
        sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });
      }
      // Local messages
      if (msg.id === uniqueId.current && msg.method === '/api/settings') {
        if (debug) console.log(`HomePlugins (id: ${msg.id}) received settings:`, msg.response);
        setSystemInfo(msg.response.systemInformation);
        setMatterbridgeInfo(msg.response.matterbridgeInformation);
      } else if (msg.id === uniqueId.current && msg.method === '/api/plugins') {
        if (debug) console.log(`HomePlugins (id: ${msg.id}) received ${msg.response.length} plugins:`, msg.response);
        setPlugins(msg.response);
      }
    };

    addListener(handleWebSocketMessage, uniqueId.current);
    if (debug) console.log('HomePlugins added WebSocket listener id:', uniqueId.current);

    return () => {
      removeListener(handleWebSocketMessage);
      if (debug) console.log('HomePlugins removed WebSocket listener');
    };
  }, [addListener, removeListener, sendMessage]);

  // Send API requests when online or mounting
  useEffect(() => {
    if (online) {
      if (debug) console.log('HomePlugins sending api requests');
      sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });
      sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: '/api/plugins', src: 'Frontend', dst: 'Matterbridge', params: {} });
    }
  }, [online, sendMessage]);

  const confirmCancelPluginRef = useRef<ApiPlugin | null>(null);

  const handleActionWithConfirmCancel = (title: string, message: string, command: string, plugin: ApiPlugin) => {
    if (debug) console.log(`handleActionWithConfirmCancel ${command} ${plugin.name}`);
    confirmCancelPluginRef.current = plugin;
    showConfirmCancelDialog(title, message, command, handleConfirm, handleCancel);
  };

  const handleConfirm = (command: string) => {
    if (debug) console.log(`handleConfirm action confirmed ${command} ${confirmCancelPluginRef.current?.name}`);
    if (command === 'remove' && confirmCancelPluginRef.current) {
      handleRemovePlugin(confirmCancelPluginRef.current);
    } else if (command === 'disable' && confirmCancelPluginRef.current) {
      handleEnableDisablePlugin(confirmCancelPluginRef.current);
    }
    confirmCancelPluginRef.current = null;
  };

  const handleCancel = (command: string) => {
    if (debug) console.log(`handleCancel action canceled ${command} ${confirmCancelPluginRef.current?.name}`);
    confirmCancelPluginRef.current = null;
  };

  const handleUpdatePlugin = (plugin: ApiPlugin) => {
    if (debug) console.log('handleUpdatePlugin plugin:', plugin.name);
    sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: '/api/install', src: 'Frontend', dst: 'Matterbridge', params: { packageName: plugin.name, restart: false } });
  };

  const handleUpdateDevPlugin = (plugin: ApiPlugin) => {
    if (debug) console.log('handleUpdateDevPlugin plugin:', plugin.name);
    sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: '/api/install', src: 'Frontend', dst: 'Matterbridge', params: { packageName: plugin.name + '@dev', restart: false } });
  };

  const handleRemovePlugin = (plugin: ApiPlugin) => {
    if (debug) console.log('handleRemovePlugin plugin:', plugin.name);
    sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: '/api/removeplugin', src: 'Frontend', dst: 'Matterbridge', params: { pluginName: plugin.name } });
  };

  const handleRestartPlugin = (plugin: ApiPlugin) => {
    if (debug) console.log('handleRestartPlugin plugin:', plugin.name);
    sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: '/api/restartplugin', src: 'Frontend', dst: 'Matterbridge', params: { pluginName: plugin.name } });
  };

  const handleEnableDisablePlugin = (plugin: ApiPlugin) => {
    if (debug) console.log('handleEnableDisablePlugin plugin:', plugin.name, 'enabled:', plugin.enabled);
    if (plugin.enabled === true) {
      plugin.enabled = false;
      sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: '/api/disableplugin', src: 'Frontend', dst: 'Matterbridge', params: { pluginName: plugin.name } });
    } else {
      plugin.enabled = true;
      sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: '/api/enableplugin', src: 'Frontend', dst: 'Matterbridge', params: { pluginName: plugin.name } });
    }
  };

  const handleHomepagePlugin = (plugin: ApiPlugin) => {
    if (debug) console.log(`handleHomepagePlugin plugin: ${plugin.name} homepage: ${plugin.homepage}`);
    if (plugin.homepage) window.open(plugin.homepage, '_blank');
  };

  const handleSponsorPlugin = (plugin: ApiPlugin) => {
    if (debug) console.log('handleSponsorPlugin plugin:', plugin.name, 'funding:', plugin.funding);
    if (plugin.funding) window.open(plugin.funding, '_blank');
  };

  const handleHelpPlugin = (plugin: ApiPlugin) => {
    if (debug) console.log('handleHelpPlugin plugin:', plugin.name, 'help:', plugin.help);
    if (plugin.help) window.open(plugin.help, '_blank');
  };

  const handleChangelogPlugin = (plugin: ApiPlugin) => {
    if (debug) console.log('handleChangelogPlugin plugin:', plugin.name, 'changelog:', plugin.changelog);
    if (plugin.changelog) window.open(plugin.changelog, '_blank');
  };

  // ConfigPluginDialog
  const [selectedPlugin, setSelectedPlugin] = useState<ApiPlugin>();
  const [openConfigPluginDialog, setOpenConfigPluginDialog] = useState(false);

  const handleConfigPlugin = (plugin: ApiPlugin) => {
    if (debug) console.log('handleConfigPlugin plugin:', plugin.name);
    sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: '/api/select/devices', src: 'Frontend', dst: 'Matterbridge', params: { plugin: plugin.name } });
    sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: '/api/select/entities', src: 'Frontend', dst: 'Matterbridge', params: { plugin: plugin.name } });
    setSelectedPlugin(plugin);
    handleOpenConfig();
  };

  const handleOpenConfig = () => {
    setOpenConfigPluginDialog(true);
  };

  const handleCloseConfig = () => {
    setOpenConfigPluginDialog(false);
  };

  if (debug) console.log('HomePlugins rendering...');
  if (!online) {
    return <Connecting />;
  }
  return (
    <MbfWindow>
      {/* Config plugin dialog */}
      {selectedPlugin && <ConfigPluginDialog open={openConfigPluginDialog} onClose={handleCloseConfig} plugin={selectedPlugin} />}

      <MbfTable<ApiPlugin> name='Plugins' columns={pluginsColumns} rows={plugins} footerRight='' footerLeft='' />
    </MbfWindow>
  );
}

export default memo(HomePlugins);
