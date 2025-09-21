 
// React
import { useContext, useEffect, useState, useRef, memo } from 'react';

// @mui/material
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

// @mui/icons-material
import Favorite from '@mui/icons-material/Favorite';
import Help from '@mui/icons-material/Help';
import Announcement from '@mui/icons-material/Announcement';
import PublishedWithChanges from '@mui/icons-material/PublishedWithChanges';
import Unpublished from '@mui/icons-material/Unpublished';
import DeleteForever from '@mui/icons-material/DeleteForever';
import QrCode2 from '@mui/icons-material/QrCode2';
import Settings from '@mui/icons-material/Settings';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { UiContext } from './UiProvider';
import { Connecting } from './Connecting';
import { StatusIndicator } from './StatusIndicator';
import { ConfigPluginDialog } from './ConfigPluginDialog';
import { BaseRegisteredPlugin, MatterbridgeInformation, SystemInformation } from '../../../src/matterbridgeTypes';
import { isApiResponse, isBroadcast, WsMessage } from '../../../src/frontendTypes';
import { getQRColor } from './getQRColor';
import { debug } from '../App';
import MbfTable, { MbfTableColumn } from './MbfTable';
// const debug = true;

interface HomePluginsProps {
  storeId: string | null;
  setStoreId: (id: string | null) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function HomePlugins({storeId, setStoreId}: HomePluginsProps) {
  // Contexts
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);
  const { showConfirmCancelDialog } = useContext(UiContext);
  // Refs
  const uniqueId = useRef(getUniqueId());
  // States
  const [_systemInfo, setSystemInfo] = useState<SystemInformation | null>(null);
  const [matterbridgeInfo, setMatterbridgeInfo] = useState<MatterbridgeInformation | null>(null);
  const [plugins, setPlugins] = useState<BaseRegisteredPlugin[]>([]);

  const pluginsColumns: MbfTableColumn<BaseRegisteredPlugin>[] = [
    {
      label: 'Name',
      id: 'name',
      required: true,
      render: (value, rowKey, plugin, _column) => (
        <Tooltip title="Open the plugin homepage">
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
        <Tooltip title="Open the plugin homepage">
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
          {plugin.latestVersion !== undefined && plugin.latestVersion !== plugin.version && matterbridgeInfo && !matterbridgeInfo.readOnly &&
            <Tooltip title="New plugin stable version available, click to install"><span className="status-warning" style={{ marginRight: '10px' }} onClick={() => handleUpdatePlugin(plugin)}>Update to v.{plugin.latestVersion}</span></Tooltip>
          }
          {plugin.version.includes('-dev-') && plugin.devVersion !== undefined && plugin.devVersion !== plugin.version && matterbridgeInfo && !matterbridgeInfo.readOnly &&
            <Tooltip title="New plugin dev version available, click to install"><span className="status-warning" style={{ marginRight: '10px' }} onClick={() => handleUpdateDevPlugin(plugin)}>Update to new dev v.{plugin.devVersion.split('-dev-')[0]}</span></Tooltip>
          }
          <Tooltip title="Plugin version"><span>{plugin.version}</span></Tooltip>
        </>
      ),
    },
    {
      label: 'Author',
      id: 'author',
      render: (value, rowKey, plugin, _column) => (
        <>
          {plugin.author ? plugin.author.replace('https://github.com/', '') : 'Unknown'}
        </>
      ),
    },
    {
      label: 'Type',
      id: 'type',
      render: (value, rowKey, plugin, _column) => (
        <>
          {plugin.type ? plugin.type.replace('Platform', '') : 'Unknown'}
        </>
      ),
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
          {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' && !plugin.error && plugin.enabled &&
            <Tooltip title="Shows the QRCode or the fabrics" slotProps={{popper:{modifiers:[{name:'offset',options:{offset: [30, 15]}}]}}}><IconButton style={{ margin: '0', padding: '0', width: '19px', height: '19px', color: getQRColor(plugin.matter) }} onClick={() => { if(plugin.matter?.id) setStoreId(plugin.matter?.id) }} size="small"><QrCode2/></IconButton></Tooltip>
          }
          {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' && !plugin.error && plugin.enabled &&
            <Tooltip title="Restart the plugin" slotProps={{popper:{modifiers:[{name:'offset',options:{offset: [30, 15]}}]}}}><IconButton style={{ margin: '0', padding: '0', width: '19px', height: '19px' }} onClick={() => handleRestartPlugin(plugin)} size="small"><RestartAltIcon/></IconButton></Tooltip>
          }
          <Tooltip title="Plugin config" slotProps={{popper:{modifiers:[{name:'offset',options:{offset: [30, 15]}}]}}}><IconButton disabled={plugin.restartRequired === true} style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}} onClick={() => handleConfigPlugin(plugin)} size="small"><Settings/></IconButton></Tooltip>
          {matterbridgeInfo && !matterbridgeInfo.readOnly &&
            <Tooltip title="Remove the plugin" slotProps={{popper:{modifiers:[{name:'offset',options:{offset: [30, 15]}}]}}}><IconButton style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}} onClick={() => { handleActionWithConfirmCancel('Remove plugin', 'Are you sure? This will also remove all devices and configuration from the controller.', 'remove', plugin); }} size="small"><DeleteForever/></IconButton></Tooltip>
          }
          {plugin.enabled ? <Tooltip title="Disable the plugin" slotProps={{popper:{modifiers:[{name:'offset',options:{offset: [30, 15]}}]}}}><IconButton style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}} onClick={() => { handleActionWithConfirmCancel('Disable plugin', 'Are you sure? This will also remove all devices and configuration from the controller.', 'disable', plugin); }} size="small"><Unpublished/></IconButton></Tooltip> : <></>}
          {!plugin.enabled ? <Tooltip title="Enable the plugin" slotProps={{popper:{modifiers:[{name:'offset',options:{offset: [30, 15]}}]}}}><IconButton style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}} onClick={() => handleEnableDisablePlugin(plugin)} size="small"><PublishedWithChanges/></IconButton></Tooltip> : <></>}
          <Tooltip title="Open the plugin help" slotProps={{popper:{modifiers:[{name:'offset',options:{offset: [30, 15]}}]}}}><IconButton style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}} onClick={() => handleHelpPlugin(plugin)} size="small"><Help/></IconButton></Tooltip>
          <Tooltip title="Open the plugin version history" slotProps={{popper:{modifiers:[{name:'offset',options:{offset: [30, 15]}}]}}}><IconButton style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}} onClick={() => handleChangelogPlugin(plugin)} size="small"><Announcement/></IconButton></Tooltip>
          {matterbridgeInfo && !matterbridgeInfo.readOnly &&
            <Tooltip title="Sponsor the plugin" slotProps={{popper:{modifiers:[{name:'offset',options:{offset: [30, 15]}}]}}}><IconButton style={{ margin: '0', padding: '0', width: '19px', height: '19px', color: '#b6409c' }} onClick={() => handleSponsorPlugin(plugin)} size="small"><Favorite/></IconButton></Tooltip>
          }
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
          {plugin.error ?
            <>
              <StatusIndicator status={false} enabledText='Error' disabledText='Error' tooltipText='The plugin is in error state. Check the log!' />
            </>
            :
            <>
              {plugin.enabled === false ?
                <>
                  <StatusIndicator status={plugin.enabled} enabledText='Enabled' disabledText='Disabled' tooltipText='Whether the plugin is enable or disabled' />
                </>
                :
                <>
                  {plugin.loaded && plugin.started && plugin.configured ?
                    <>
                      <StatusIndicator status={plugin.loaded} enabledText='Running' tooltipText='Whether the plugin is running' />
                    </>
                    :
                    <>
                      <StatusIndicator status={plugin.loaded} enabledText='Loaded' tooltipText='Whether the plugin has been loaded' />
                      <StatusIndicator status={plugin.started} enabledText='Started' tooltipText='Whether the plugin started' />
                      <StatusIndicator status={plugin.configured} enabledText='Configured' tooltipText='Whether the plugin has been configured' />
                    </>
                  }
                </>
              }
            </>
          }
        </div>
      ),
    },
  ];
  
  // WebSocket message handler effect
  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessage) => {
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        // Broadcast messages
        if (isBroadcast(msg) && msg.method === 'refresh_required' && msg.params.changed === 'plugins') {
          if(debug) console.log(`HomePlugins received refresh_required: changed=${msg.params.changed} and sending /api/plugins request`);
          sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (isBroadcast(msg) && msg.method === 'refresh_required' && msg.params.changed === 'matter') {
          if(debug) console.log(`HomePlugins received refresh_required: changed=${msg.params.changed} and setting matter id ${msg.params.matter?.id}`);
          setPlugins((prevPlugins) => {
            const i = prevPlugins.findIndex(p => p.matter?.id === msg.params.matter?.id);
            if (i < 0) {
              if (debug) console.log(`HomePlugins received refresh_required: changed=${msg.params.changed} and matter id ${msg.params.matter?.id} not found`);
              return prevPlugins;
            }
            if (debug) console.log(`HomePlugins received refresh_required: changed=${msg.params.changed} set matter id ${msg.params.matter?.id}`);
            const next = [...prevPlugins];
            next[i] = { ...next[i], matter: msg.params.matter };
            return next;
          });
        }
        if (isBroadcast(msg) && msg.method === 'refresh_required' && msg.params.changed === 'settings') {
          if(debug) console.log(`HomePlugins received refresh_required: changed=${msg.params.changed} and sending /api/settings request`);
          sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        // Local messages
        if (isApiResponse(msg) && msg.id === uniqueId.current && msg.method === '/api/settings') {
          if (debug) console.log(`HomePlugins (id: ${msg.id}) received settings:`, msg.response);
          setSystemInfo(msg.response.systemInformation);
          setMatterbridgeInfo(msg.response.matterbridgeInformation);
        }
        if (isApiResponse(msg) && msg.id === uniqueId.current && msg.method === '/api/plugins') {
          if(debug) console.log(`HomePlugins (id: ${msg.id}) received ${msg.response.length} plugins:`, msg.response);
          setPlugins(msg.response);
        }
      }
    };

    addListener(handleWebSocketMessage);
    if(debug) console.log('HomePlugins added WebSocket listener id:', uniqueId.current);

    return () => {
      removeListener(handleWebSocketMessage);
      if(debug) console.log('HomePlugins removed WebSocket listener');
    };
  }, [addListener, removeListener, sendMessage]);
  
  // Send API requests when online or mounting
  useEffect(() => {
    if (online) {
      if(debug) console.log('HomePlugins sending api requests');
      sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
    }
  }, [online, sendMessage]);

  const confirmCancelPluginRef = useRef<BaseRegisteredPlugin | null>(null);

  const handleActionWithConfirmCancel = (title: string, message: string, command: string, plugin: BaseRegisteredPlugin) => {
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

  const handleUpdatePlugin = (plugin: BaseRegisteredPlugin) => {
    if (debug) console.log('handleUpdatePlugin plugin:', plugin.name);
    sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: "/api/install", src: "Frontend", dst: "Matterbridge", params: { packageName: plugin.name, restart: false } });
  };

  const handleUpdateDevPlugin = (plugin: BaseRegisteredPlugin) => {
    if (debug) console.log('handleUpdateDevPlugin plugin:', plugin.name);
    sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: "/api/install", src: "Frontend", dst: "Matterbridge", params: { packageName: plugin.name+'@dev', restart: false } });
  };

  const handleRemovePlugin = (plugin: BaseRegisteredPlugin) => {
    if (debug) console.log('handleRemovePlugin plugin:', plugin.name);
    sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: "/api/removeplugin", src: "Frontend", dst: "Matterbridge", params: { pluginName: plugin.name } });
  };

  const handleRestartPlugin = (plugin: BaseRegisteredPlugin) => {
    if (debug) console.log('handleRestartPlugin plugin:', plugin.name);
    sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: "/api/restartplugin", src: "Frontend", dst: "Matterbridge", params: { pluginName: plugin.name } });
  };

  const handleEnableDisablePlugin = (plugin: BaseRegisteredPlugin) => {
    if (debug) console.log('handleEnableDisablePlugin plugin:', plugin.name, 'enabled:', plugin.enabled);
    if (plugin.enabled === true) {
      plugin.enabled = false;
      sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: "/api/disableplugin", src: "Frontend", dst: "Matterbridge", params: { pluginName: plugin.name } });
    }
    else {
      plugin.enabled = true;
      sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: "/api/enableplugin", src: "Frontend", dst: "Matterbridge", params: { pluginName: plugin.name } });
    }
  };

  const handleHomepagePlugin = (plugin: BaseRegisteredPlugin) => {
    if (debug) console.log(`handleHomepagePlugin plugin: ${plugin.name} homepage: ${plugin.homepage}`);
    if (plugin.homepage) window.open(plugin.homepage, '_blank');
  };

  const handleSponsorPlugin = (plugin: BaseRegisteredPlugin) => {
    if (debug) console.log('handleSponsorPlugin plugin:', plugin.name, 'funding:', plugin.funding);
    if (plugin.funding) window.open(plugin.funding, '_blank');
  };

  const handleHelpPlugin = (plugin: BaseRegisteredPlugin) => {
    if (debug) console.log('handleHelpPlugin plugin:', plugin.name, 'help:', plugin.help);
    if (plugin.help) window.open(plugin.help, '_blank');
  };

  const handleChangelogPlugin = (plugin: BaseRegisteredPlugin) => {
    if (debug) console.log('handleChangelogPlugin plugin:', plugin.name, 'changelog:', plugin.changelog);
    if (plugin.changelog) window.open(plugin.changelog, '_blank');
  };
  
  // ConfigPluginDialog
  const [selectedPlugin, setSelectedPlugin] = useState<BaseRegisteredPlugin>();
  const [openConfigPluginDialog, setOpenConfigPluginDialog] = useState(false);

  const handleConfigPlugin = (plugin: BaseRegisteredPlugin) => {
    if (debug) console.log('handleConfigPlugin plugin:', plugin.name);
    sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: "/api/select/devices", src: "Frontend", dst: "Matterbridge", params: { plugin: plugin.name } });
    sendMessage({ id: uniqueId.current, sender: 'HomePlugins', method: "/api/select/entities", src: "Frontend", dst: "Matterbridge", params: { plugin: plugin.name } });
    setSelectedPlugin(plugin);
    handleOpenConfig();
  };

  const handleOpenConfig = () => {
    setOpenConfigPluginDialog(true);
  };

  const handleCloseConfig = () => {
    setOpenConfigPluginDialog(false);
  };

  if(debug) console.log('HomePlugins rendering...');
  if (!online) {
    return ( <Connecting /> );
  }
  return (
      <div className="MbfWindowDiv" style={{ margin: '0', padding: '0', gap: '0', width: '100%', flex: '0 0 auto', overflow: 'hidden' }}>
        {/* Config plugin dialog */}
        {selectedPlugin && <ConfigPluginDialog open={openConfigPluginDialog} onClose={handleCloseConfig} plugin={selectedPlugin}/>} 

        <MbfTable<BaseRegisteredPlugin>
          name="Plugins"
          columns={pluginsColumns}
          rows={plugins}
          footerRight=''
          footerLeft=''
        />
      </div>
  );
}

export default memo(HomePlugins);