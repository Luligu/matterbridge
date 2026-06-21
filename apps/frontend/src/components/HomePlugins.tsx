// @mui/icons-material
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import Favorite from '@mui/icons-material/Favorite';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import LanguageIcon from '@mui/icons-material/Language';
import PublishedWithChanges from '@mui/icons-material/PublishedWithChanges';
import QrCode2 from '@mui/icons-material/QrCode2';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import UnpublishedOutlinedIcon from '@mui/icons-material/UnpublishedOutlined';
// @mui/material
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
// React
import { useContext, useEffect, useState, useRef, memo, type SyntheticEvent } from 'react';

import { debug, enableMobile } from '../appState';
import { type BridgeStatus, type ApiPlugin, type MatterbridgeInformation, type SystemInformation, type WsMessageApiResponse } from '../utils/backendShared';
import { getQRColor } from '../utils/getQRColor';
import { ConfigPluginDialog } from './ConfigPluginDialog';
import { Connecting } from './Connecting';
import MbfTable, { type MbfTableColumn } from './MbfTable';
import { MbfWindow } from './MbfWindow';
import { StatusIndicator } from './StatusIndicator';
import { UiContext } from './UiContext';
import { WebSocketContext } from './WebSocketProvider';

interface HomePluginsProps {
  storeId: string | null;
  setStoreId: (id: string | null) => void;
}

// oxlint-disable-next-line no-unused-vars
function HomePlugins({ storeId, setStoreId }: HomePluginsProps) {
  // Contexts
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);
  const { mobile, showConfirmCancelDialog } = useContext(UiContext);
  // Refs
  const uniqueId = useRef(getUniqueId());
  // States
  const [_systemInfo, setSystemInfo] = useState<SystemInformation | null>(null);
  const [matterbridgeInfo, setMatterbridgeInfo] = useState<MatterbridgeInformation | null>(null);
  const [plugins, setPlugins] = useState<ApiPlugin[]>([]);
  const [selectedPluginFrontend, setSelectedPluginFrontend] = useState<{ name: string; path: string } | null>(null);
  const [_status, setStatus] = useState<BridgeStatus>('inactive');

  const pluginsColumns: MbfTableColumn<ApiPlugin>[] = [
    {
      label: 'Name',
      id: 'name',
      required: true,
      render: (value, rowKey, plugin, _column) => (
        <Tooltip title={`Plugin path ${plugin.path}`}>
          <button
            type="button"
            style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left' }}
            onClick={() => handleHomepagePlugin(plugin)}
          >
            {plugin.name}
          </button>
        </Tooltip>
      ),
    },
    {
      label: 'Description',
      id: 'description',
      render: (value, rowKey, plugin, _column) => (
        <Tooltip title="Open the plugin homepage">
          <button
            type="button"
            style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left' }}
            onClick={() => handleHomepagePlugin(plugin)}
          >
            {plugin.description}
          </button>
        </Tooltip>
      ),
    },
    {
      label: 'Version',
      id: 'version',
      render: (value, rowKey, plugin, _column) => (
        <>
          <Tooltip title={`Plugin v.${plugin.version}`}>
            <span>{plugin.version.split('-')[0] + (plugin.version.includes('-dev-') ? '@dev' : '') + (plugin.version.includes('-git-') ? '@git' : '')}</span>
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
            <Tooltip title="Shows the QRCode or the fabrics" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton
                style={{ margin: '0', padding: '0', width: '19px', height: '19px', color: getQRColor(plugin.matter) }}
                onClick={() => {
                  if (plugin.matter?.id) setStoreId(plugin.matter?.id);
                }}
                size="small"
              >
                <QrCode2 />
              </IconButton>
            </Tooltip>
          )}
          {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' && !plugin.error && plugin.enabled && (
            <Tooltip title="Restart the plugin" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton style={{ margin: '0', padding: '0', width: '19px', height: '19px' }} onClick={() => handleRestartPlugin(plugin)} size="small">
                <RestartAltIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Plugin config" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
            <IconButton
              disabled={plugin.restartRequired === true}
              style={{ margin: '0px', padding: '0px', width: '19px', height: '19px' }}
              onClick={() => handleConfigPlugin(plugin)}
              size="small"
            >
              <SettingsOutlinedIcon />
            </IconButton>
          </Tooltip>
          {matterbridgeInfo && !matterbridgeInfo.readOnly && (
            <Tooltip title="Remove the plugin" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton
                style={{ margin: '0px', padding: '0px', width: '19px', height: '19px' }}
                onClick={() => {
                  handleActionWithConfirmCancel('Remove plugin', 'Are you sure? This will also remove all devices and configuration from the controller.', 'remove', plugin);
                }}
                size="small"
              >
                <DeleteForeverOutlinedIcon />
              </IconButton>
            </Tooltip>
          )}
          {plugin.enabled ? (
            <Tooltip title="Disable the plugin" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton
                style={{ margin: '0px', padding: '0px', width: '19px', height: '19px' }}
                onClick={() => {
                  handleActionWithConfirmCancel('Disable plugin', 'Are you sure? This will also remove all devices and configuration from the controller.', 'disable', plugin);
                }}
                size="small"
              >
                <UnpublishedOutlinedIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <></>
          )}
          {!plugin.enabled ? (
            <Tooltip title="Enable the plugin" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton style={{ margin: '0px', padding: '0px', width: '19px', height: '19px' }} onClick={() => handleEnableDisablePlugin(plugin)} size="small">
                <PublishedWithChanges />
              </IconButton>
            </Tooltip>
          ) : (
            <></>
          )}
          <Tooltip title="Open the plugin help" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
            <IconButton style={{ margin: '0px 2px', padding: '0px', width: '19px', height: '19px' }} onClick={() => handleHelpPlugin(plugin)} size="small">
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Open the plugin version history" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
            <IconButton style={{ margin: '0px 2px', padding: '0px', width: '19px', height: '19px' }} onClick={() => handleChangelogPlugin(plugin)} size="small">
              <HistoryOutlinedIcon />
            </IconButton>
          </Tooltip>

          {plugin.enabled && plugin.frontendPath && (
            <Tooltip title="Open the plugin frontend" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton style={{ margin: '0px 2px', padding: '0px', width: '19px', height: '19px' }} onClick={() => handleFrontendPlugin(plugin)} size="small">
                <LanguageIcon />
              </IconButton>
            </Tooltip>
          )}

          {plugin.latestVersion !== undefined && plugin.latestVersion !== plugin.version && matterbridgeInfo && !matterbridgeInfo.readOnly && (
            <Tooltip
              title={`Update the plugin to the latest version v.${plugin.latestVersion}`}
              slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}
            >
              <IconButton
                style={{ color: 'var(--primary-color)', margin: '0px 2px', padding: '0px', width: '19px', height: '19px' }}
                onClick={() => handleUpdatePlugin(plugin)}
                size="small"
              >
                <SystemUpdateAltIcon />
              </IconButton>
            </Tooltip>
          )}
          {(plugin.version.includes('-dev-') || plugin.version.includes('-git-')) &&
            plugin.devVersion !== undefined &&
            plugin.devVersion !== plugin.version &&
            matterbridgeInfo &&
            !matterbridgeInfo.readOnly && (
              <Tooltip
                title={`Update the plugin to the latest dev version v.${plugin.devVersion}`}
                slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}
              >
                <IconButton
                  style={{ color: 'var(--secondary-color)', margin: '0px 2px', padding: '0px', width: '19px', height: '19px' }}
                  onClick={() => handleUpdateDevPlugin(plugin)}
                  size="small"
                >
                  <SystemUpdateAltIcon />
                </IconButton>
              </Tooltip>
            )}
          {matterbridgeInfo && !matterbridgeInfo.readOnly && (
            <Tooltip title="Sponsor the plugin" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton style={{ margin: '0', padding: '0', width: '19px', height: '19px', color: '#b6409c' }} onClick={() => handleSponsorPlugin(plugin)} size="small">
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
              <StatusIndicator status={false} enabledText="Error" disabledText="Error" tooltipText="The plugin is in error state. Check the log!" />
            </>
          ) : (
            <>
              {!plugin.enabled ? (
                <>
                  <StatusIndicator status={plugin.enabled} enabledText="Enabled" disabledText="Disabled" tooltipText="Whether the plugin is enable or disabled" />
                </>
              ) : (
                <>
                  {plugin.loaded && plugin.started && plugin.configured ? (
                    <>
                      <StatusIndicator status={plugin.loaded} enabledText="Running" tooltipText="Whether the plugin is running" />
                    </>
                  ) : (
                    <>
                      <StatusIndicator status={plugin.loaded} enabledText="Loaded" tooltipText="Whether the plugin has been loaded" />
                      <StatusIndicator status={plugin.started} enabledText="Started" tooltipText="Whether the plugin started" />
                      <StatusIndicator status={plugin.configured} enabledText="Configured" tooltipText="Whether the plugin has been configured" />
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
        if (msg.response.lock) {
          if (debug) console.log(`HomePlugins received refresh_required: changed=${msg.response.changed} lock=${msg.response.lock} and locking plugins list`);
          setPlugins((prevPlugins) => {
            return prevPlugins.map((p) => (p.name === msg.response.lock ? { ...p, restartRequired: true } : p));
          });
        } else {
          if (debug) console.log(`HomePlugins received refresh_required: changed=${msg.response.changed} lock=${msg.response.lock} and sending /api/plugins request`);
          sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: '/api/plugins', src: 'Frontend', dst: 'Matterbridge', params: {} });
        }
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
      } else if (msg.method === 'plugin_update_required') {
        if (debug) console.log('HomePlugins received plugin_update_required', msg.response);
        setPlugins((prevPlugins) =>
          prevPlugins.map((plugin) =>
            plugin.name === msg.response.plugin
              ? msg.response.devVersion
                ? { ...plugin, devVersion: msg.response.version }
                : { ...plugin, latestVersion: msg.response.version }
              : plugin,
          ),
        );
      } else if (msg.method === 'plugin_status_update') {
        if (debug) console.log('HomePlugins received plugin_status_update', msg.response);
        setPlugins((prevPlugins) => prevPlugins.map((plugin) => (plugin.name === msg.response.plugin ? { ...plugin, ...msg.response.status } : plugin)));
      } else if (msg.method === 'matterbridge_status_update') {
        if (debug) console.log(`HomePlugins received matterbridge_status_update: ${msg.response.status}`);
        setStatus(msg.response.status);
      }
      // Local messages
      if (msg.id === uniqueId.current && msg.method === '/api/settings') {
        if (debug) console.log(`HomePlugins (id: ${msg.id}) received settings:`, msg.response);
        setSystemInfo(msg.response.systemInformation);
        setMatterbridgeInfo(msg.response.matterbridgeInformation);
        setStatus(msg.response.matterbridgeInformation.bridgeStatus);
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
    sendMessage({
      id: uniqueId.current,
      sender: 'HomePlugins',
      method: '/api/install',
      src: 'Frontend',
      dst: 'Matterbridge',
      params: { packageName: plugin.name, restart: false },
    });
  };

  const handleUpdateDevPlugin = (plugin: ApiPlugin) => {
    if (debug) console.log('handleUpdateDevPlugin plugin:', plugin.name);
    sendMessage({
      id: uniqueId.current,
      sender: 'HomePlugins',
      method: '/api/install',
      src: 'Frontend',
      dst: 'Matterbridge',
      params: { packageName: plugin.name + '@dev', restart: false },
    });
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
    if (plugin.enabled) {
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

  const handleFrontendPlugin = (plugin: ApiPlugin) => {
    const pluginFrontendPath = `./plugins/${plugin.name}`;
    if (debug) console.log('handleFrontendPlugin plugin:', plugin.name, 'frontend:', plugin.frontendPath, 'path:', pluginFrontendPath);
    if (plugin.frontendPath) setSelectedPluginFrontend({ name: plugin.name, path: pluginFrontendPath });
  };

  const handlePluginFrontendLoad = (event: SyntheticEvent<HTMLIFrameElement>) => {
    const iframeDocument = event.currentTarget.contentDocument;
    if (!iframeDocument?.head) return;

    const computedStyle = getComputedStyle(document.body);
    const primaryColor = computedStyle.getPropertyValue('--primary-color').trim() || '#0d6efd';
    const backgroundColor = computedStyle.getPropertyValue('--div-bg-color').trim() || '#111111';

    iframeDocument.getElementById('matterbridge-plugin-scrollbar-style')?.remove();
    const style = iframeDocument.createElement('style');
    style.id = 'matterbridge-plugin-scrollbar-style';
    style.textContent = `
      html,
      body {
        background-color: ${backgroundColor};
        scrollbar-width: thin;
        scrollbar-color: ${primaryColor} ${backgroundColor};
      }

      ::-webkit-scrollbar {
        width: 10px;
      }

      ::-webkit-scrollbar-thumb {
        background: ${primaryColor};
        border-radius: 5px;
      }

      ::-webkit-scrollbar-track {
        background: ${backgroundColor};
      }
    `;
    iframeDocument.head.appendChild(style);
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
    <>
      <MbfWindow>
        {/* Config plugin dialog */}
        {selectedPlugin && <ConfigPluginDialog open={openConfigPluginDialog} onClose={handleCloseConfig} plugin={selectedPlugin} />}

        <MbfTable<ApiPlugin> name="Plugins" columns={pluginsColumns} rows={plugins} footerRight="" footerLeft="" />
      </MbfWindow>
      <Dialog
        open={selectedPluginFrontend !== null}
        onClose={() => setSelectedPluginFrontend(null)}
        slotProps={{
          paper: {
            sx: {
              width: enableMobile && mobile ? '100vw' : '75vw',
              height: enableMobile && mobile ? '100vh' : '75vh',
              maxWidth: enableMobile && mobile ? '100vw' : '75vw',
              maxHeight: enableMobile && mobile ? '100vh' : '75vh',
              margin: enableMobile && mobile ? '0px' : undefined,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'var(--div-bg-color)',
            },
          },
        }}
      >
        <DialogContent style={{ display: 'flex', flex: '1 1 auto', minHeight: 0, padding: '0px', margin: '0px', overflow: 'hidden', backgroundColor: 'var(--div-bg-color)' }}>
          {selectedPluginFrontend && (
            // Plugin frontends are same-origin app content needing scripts + same-origin access (WebSocket/storage); a restrictive sandbox would break them.
            // oxlint-disable-next-line react/iframe-missing-sandbox
            <iframe
              title={`${selectedPluginFrontend.name} frontend`}
              src={selectedPluginFrontend.path}
              onLoad={handlePluginFrontendLoad}
              style={{ display: 'block', flex: '1 1 auto', width: '100%', height: '100%', border: 'none', backgroundColor: 'var(--div-bg-color)' }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ flex: '0 0 auto', justifyContent: 'center' }}>
          <Button onClick={() => setSelectedPluginFrontend(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default memo(HomePlugins);
