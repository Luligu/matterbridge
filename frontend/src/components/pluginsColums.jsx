 

// React
// @mui/material
import { Tooltip, IconButton } from '@mui/material';
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
import { StatusIndicator } from './StatusIndicator';

/**
 * Build MbfTable columns for Plugins view.
 * Consumers should pass the same handler functions currently used in HomePlugins.
 *
 * @param {Object} args
 * @param {Object} args.matterbridgeInfo
 * @param {(plugin: Object) => void} args.selectPlugin
 * @param {Object} args.handlers - callbacks used by action renderers
 * @param {(plugin: Object) => void} args.handlers.handleHomepagePlugin
 * @param {(plugin: Object) => void} args.handlers.handleUpdatePlugin
 * @param {(plugin: Object) => void} args.handlers.handleUpdateDevPlugin
 * @param {(plugin: Object) => void} args.handlers.handleRemovePlugin
 * @param {(plugin: Object) => void} args.handlers.handleRestartPlugin
 * @param {(plugin: Object) => void} args.handlers.handleConfigPlugin
 * @param {(title:string, message:string, command:string, plugin:Object) => void} args.handlers.handleActionWithConfirmCancel
 * @param {(plugin: Object) => void} args.handlers.handleEnableDisablePlugin
 * @param {(plugin: Object) => void} args.handlers.handleHelpPlugin
 * @param {(plugin: Object) => void} args.handlers.handleChangelogPlugin
 * @param {(plugin: Object) => void} args.handlers.handleSponsorPlugin
 * @param {(plugin: Object) => string} args.getQRColor
 * @returns {Array} columns compatible with MbfTable
 */
export function createPluginsColumns({ matterbridgeInfo, selectPlugin, handlers, getQRColor }) {
  const {
    handleHomepagePlugin,
    handleUpdatePlugin,
    handleUpdateDevPlugin,
    handleActionWithConfirmCancel,
    handleRestartPlugin,
    handleConfigPlugin,
    handleEnableDisablePlugin,
    handleHelpPlugin,
    handleChangelogPlugin,
    handleSponsorPlugin,
  } = handlers || {};

  return [
    {
      id: 'name',
      label: 'Name',
      render: (_value, _rowKey, row) => (
        <Tooltip title="Open the plugin homepage">
          <span style={{ cursor: 'pointer' }} onClick={() => handleHomepagePlugin && handleHomepagePlugin(row)}>
            {row?.name}
          </span>
        </Tooltip>
      ),
    },
    {
      id: 'description',
      label: 'Description',
      minWidth: 200,
      required: true, // keep always visible as in previous UI
      render: (_value, _rowKey, row) => (
        <Tooltip title="Open the plugin homepage">
          <span style={{ cursor: 'pointer' }} onClick={() => handleHomepagePlugin && handleHomepagePlugin(row)}>
            {row?.description}
          </span>
        </Tooltip>
      ),
    },
    {
      id: 'version',
      label: 'Version',
      render: (_value, _rowKey, row) => (
        <>
          {row?.latestVersion !== undefined && row?.latestVersion !== row?.version && matterbridgeInfo && !matterbridgeInfo.readOnly && (
            <Tooltip title="New plugin stable version available, click to install">
              <span className="status-warning" style={{ marginRight: '10px', cursor: 'pointer' }} onClick={() => handleUpdatePlugin && handleUpdatePlugin(row)}>
                {`Update to v.${row?.latestVersion}`}
              </span>
            </Tooltip>
          )}
          {row?.version?.includes('-dev-') && row?.devVersion !== undefined && row?.devVersion !== row?.version && matterbridgeInfo && !matterbridgeInfo.readOnly && (
            <Tooltip title="New plugin dev version available, click to install">
              <span className="status-warning" style={{ marginRight: '10px', cursor: 'pointer' }} onClick={() => handleUpdateDevPlugin && handleUpdateDevPlugin(row)}>
                {`Update to new dev v.${String(row?.devVersion).split('-dev-')[0]}`}
              </span>
            </Tooltip>
          )}
          <Tooltip title="Plugin version">{row?.version}</Tooltip>
        </>
      ),
    },
    {
      id: 'author',
      label: 'Author',
      render: (_value, _rowKey, row) => <>{row?.author ? String(row.author).replace('https://github.com/', '') : 'Unknown'}</>,
    },
    {
      id: 'type',
      label: 'Type',
      render: (_value, _rowKey, row) => <>{row?.type ? String(row.type).replace('Platform', '') : 'Unknown'}</>,
    },
    {
      id: 'registeredDevices',
      label: 'Devices',
      align: 'right',
    },
    {
      id: 'actions',
      label: 'Actions',
      nosort: true,
      required: true,
      render: (_value, _rowKey, row) => (
        <div style={{ margin: 0, padding: 0, gap: '4px', display: 'flex', flexDirection: 'row' }}>
          {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' && !row?.error && row?.enabled && (
            <Tooltip title="Shows the QRCode or the fabrics" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton style={{ margin: 0, padding: 0, width: '19px', height: '19px', color: getQRColor ? getQRColor(row) : undefined }} onClick={() => selectPlugin && selectPlugin(row)} size="small">
                <QrCode2 />
              </IconButton>
            </Tooltip>
          )}
          {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' && !row?.error && row?.enabled && (
            <Tooltip title="Restart the plugin" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton style={{ margin: 0, padding: 0, width: '19px', height: '19px' }} onClick={() => handleRestartPlugin && handleRestartPlugin(row)} size="small">
                <RestartAltIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Plugin config" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
            <IconButton disabled={row?.restartRequired === true} style={{ margin: 0, padding: 0, width: '19px', height: '19px' }} onClick={() => handleConfigPlugin && handleConfigPlugin(row)} size="small">
              <Settings />
            </IconButton>
          </Tooltip>
          {matterbridgeInfo && !matterbridgeInfo.readOnly && (
            <Tooltip title="Remove the plugin" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton style={{ margin: 0, padding: 0, width: '19px', height: '19px' }} onClick={() => handleActionWithConfirmCancel && handleActionWithConfirmCancel('Remove plugin', 'Are you sure? This will remove also all the devices and configuration in the controller.', 'remove', row)} size="small">
                <DeleteForever />
              </IconButton>
            </Tooltip>
          )}
          {row?.enabled ? (
            <Tooltip title="Disable the plugin" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton style={{ margin: 0, padding: 0, width: '19px', height: '19px' }} onClick={() => handleActionWithConfirmCancel && handleActionWithConfirmCancel('Disable plugin', 'Are you sure? This will remove also all the devices and configuration in the controller.', 'disable', row)} size="small">
                <Unpublished />
              </IconButton>
            </Tooltip>
          ) : null}
          {!row?.enabled ? (
            <Tooltip title="Enable the plugin" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton style={{ margin: 0, padding: 0, width: '19px', height: '19px' }} onClick={() => handleEnableDisablePlugin && handleEnableDisablePlugin(row)} size="small">
                <PublishedWithChanges />
              </IconButton>
            </Tooltip>
          ) : null}
          <Tooltip title="Open the plugin help" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
            <IconButton style={{ margin: 0, padding: 0, width: '19px', height: '19px' }} onClick={() => handleHelpPlugin && handleHelpPlugin(row)} size="small">
              <Help />
            </IconButton>
          </Tooltip>
          <Tooltip title="Open the plugin version history" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
            <IconButton style={{ margin: 0, padding: 0, width: '19px', height: '19px' }} onClick={() => handleChangelogPlugin && handleChangelogPlugin(row)} size="small">
              <Announcement />
            </IconButton>
          </Tooltip>
          {matterbridgeInfo && !matterbridgeInfo.readOnly && (
            <Tooltip title="Sponsor the plugin" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton style={{ margin: 0, padding: 0, width: '19px', height: '19px', color: '#b6409c' }} onClick={() => handleSponsorPlugin && handleSponsorPlugin(row)} size="small">
                <Favorite />
              </IconButton>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      nosort: true,
      required: true,
      render: (_value, _rowKey, row) => (
        <div style={{ display: 'flex', flexDirection: 'row', flex: '1 1 auto', gap: '5px' }}>
          {row?.error ? (
            <StatusIndicator status={false} enabledText='Error' disabledText='Error' tooltipText='The plugin is in error state. Check the log!' />
          ) : (
            <>
              {row?.enabled === false ? (
                <StatusIndicator status={row?.enabled} enabledText='Enabled' disabledText='Disabled' tooltipText='Whether the plugin is enable or disabled' />
              ) : (
                <>
                  {row?.loaded && row?.started && row?.configured && row?.paired ? (
                    <StatusIndicator status={row?.loaded} enabledText='Running' tooltipText='Whether the plugin is running' />
                  ) : (
                    <>
                      {row?.loaded && row?.started && row?.configured ? (
                        <StatusIndicator status={row?.loaded} enabledText='Running' tooltipText='Whether the plugin is running' />
                      ) : (
                        <>
                          <StatusIndicator status={row?.enabled} enabledText='Enabled' disabledText='Disabled' tooltipText='Whether the plugin is enable or disabled' />
                          <StatusIndicator status={row?.loaded} enabledText='Loaded' tooltipText='Whether the plugin has been loaded' />
                          <StatusIndicator status={row?.started} enabledText='Started' tooltipText='Whether the plugin started' />
                          <StatusIndicator status={row?.configured} enabledText='Configured' tooltipText='Whether the plugin has been configured' />
                          {matterbridgeInfo && matterbridgeInfo.bridgeMode === 'childbridge' ? (
                            <StatusIndicator status={row?.paired} enabledText='Paired' tooltipText='Whether the plugin has been paired' />
                          ) : null}
                        </>
                      )}
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
}

export default createPluginsColumns;
