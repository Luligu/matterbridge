// React
import { useContext, useEffect, useState, useRef, useCallback, memo } from 'react';

// @mui/material
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

// @mui/icons-material
import SettingsIcon from '@mui/icons-material/Settings';
import Battery4BarIcon from '@mui/icons-material/Battery4Bar';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import QrCode2 from '@mui/icons-material/QrCode2';

// @mdi/js

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import { getQRColor } from './getQRColor';
import MbfTable, { MbfTableColumn } from './MbfTable';
import { ApiDevice, ApiMatter, ApiPlugin } from '../../../src/matterbridgeTypes';
import { ApiSelectDevice, ApiSettings, WsMessageApiResponse } from '../../../src/frontendTypes';
import { debug } from '../App';
import { MbfWindow } from './MbfWindow';
// const debug = true;

/**
 * Get the unique row ID for a device.
 * @param {*} row
 * @returns A string in the format 'pluginName::serial'.
 */
const getRowKey = (row: MixedApiDevices) => {
  return `${row.pluginName}::${row.serial}`;
};

interface ExtendedBaseRegisteredPlugin extends Omit<ApiPlugin, 'schemaJson' | 'configJson'> {
  schemaJson: { properties: { whiteList?: { selectFrom?: string } } };
  configJson: { whiteList: string[]; blackList: string[]; postfix?: string };
}

interface ApiDevicesWithSelected extends ApiDevice {
  selected?: boolean;
}

interface ApiSelectDevicesWithSelected extends ApiSelectDevice {
  selected?: boolean;
}

interface MixedApiDevices {
  pluginName: string;
  type?: string;
  endpoint?: number | undefined;
  name: string;
  serial: string;
  productUrl?: string;
  configUrl?: string;
  uniqueId?: string;
  reachable?: boolean;
  powerSource?: 'ac' | 'dc' | 'ok' | 'warning' | 'critical';
  cluster?: string;
  matter?: ApiMatter;
  selected?: boolean;
}

interface HomeDevicesProps {
  storeId: string | null;
  setStoreId: (id: string | null) => void;
}

/**
 * Starts with sending api/plugins to get the list of plugins.
 * For each plugin, if enabled, loaded and started, send api/select/devices to get the list of selected devices.
 * Then send api/devices to get the list of all devices.
 * Mix both lists, giving priority to devices in the api/devices list.
 * The mixed list is displayed in a table.
 * The user can select/unselect devices using checkboxes. This sends api/command to selectdevice/unselectdevice.
 * The user can open the configuration page of a device if configUrl is set.
 * The user can open a QR code dialog if the device has matter information.
 * The user can configure the columns to display in the table.
 * The user can sort the table by clicking on the column headers. The sort state is saved in localStorage.
 * The user can see a footer with the number of registered devices, a loading message if plugins are not fully loaded, and a restart required message if needed.
 */
function HomeDevices({ storeId, setStoreId }: HomeDevicesProps) {
  // Contexts
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);

  // States
  const [restart, setRestart] = useState(false); // Restart required state, used in the footer dx. Set by /api/settings response and restart_required and restart_not_required messages.
  const [loading, setLoading] = useState(true); // Loading state, used in the footer sx. Set to false when all plugins are loaded.
  const [settings, setSettings] = useState<ApiSettings | null>(null); // Settings from /api/settings response
  const [plugins, setPlugins] = useState<ExtendedBaseRegisteredPlugin[]>([]);
  const [devices, setDevices] = useState<ApiDevicesWithSelected[]>([]);
  const [selectDevices, setSelectDevices] = useState<ApiSelectDevicesWithSelected[]>([]);
  const [mixedDevices, setMixedDevices] = useState<MixedApiDevices[]>([]); // The table show these ones, mix of devices and selectDevices

  // Refs
  const uniqueId = useRef(getUniqueId());

  const devicesColumns: MbfTableColumn<MixedApiDevices>[] = [
    {
      label: 'Plugin',
      id: 'pluginName',
    },
    {
      label: 'Name',
      id: 'name',
      required: true,
    },
    {
      label: 'Serial',
      id: 'serial',
    },
    {
      label: 'Availability',
      id: 'availability',
      render: (value, rowKey, mixedDevice, _column) => (mixedDevice.reachable === true ? 'Online' : mixedDevice.reachable === false ? <span style={{ color: 'red' }}>Offline</span> : ''),
      comparator: (rowA, rowB) => {
        const a = rowA.reachable === true ? 1 : rowA.reachable === false ? 0 : -1;
        const b = rowB.reachable === true ? 1 : rowB.reachable === false ? 0 : -1;
        return a - b;
      },
    },
    {
      label: 'Power',
      id: 'powerSource',
      render: (value, rowKey, mixedDevice, _column) => {
        if (mixedDevice.powerSource === 'ac' || mixedDevice.powerSource === 'dc') {
          return <ElectricalServicesIcon fontSize='small' sx={{ color: 'var(--primary-color)' }} />;
        } else if (mixedDevice.powerSource === 'ok') {
          return <Battery4BarIcon fontSize='small' sx={{ color: 'green' }} />;
        } else if (mixedDevice.powerSource === 'warning') {
          return <Battery4BarIcon fontSize='small' sx={{ color: 'yellow' }} />;
        } else if (mixedDevice.powerSource === 'critical') {
          return <Battery4BarIcon fontSize='small' sx={{ color: 'red' }} />;
        } else return <span></span>;
      },
    },
    {
      label: 'Url',
      id: 'configUrl',
      maxWidth: 150,
    },
    {
      label: 'Actions',
      id: 'selected',
      required: true,
      // noSort: true,
      render: (value, rowKey, mixedDevice, _column) => (
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          {mixedDevice.matter !== undefined ? (
            <Tooltip title='Show the QRCode or the fabrics' slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton
                onClick={() => setStoreId(storeId === mixedDevice.matter?.id ? (settings?.matterbridgeInformation.bridgeMode === 'bridge' ? 'Matterbridge' : null) : mixedDevice.matter?.id || null)}
                aria-label='Show the QRCode'
                sx={{ margin: 0, padding: 0, color: getQRColor(mixedDevice.matter) }}
              >
                <QrCode2 fontSize='small' />
              </IconButton>
            </Tooltip>
          ) : (
            <div style={{ width: '20px', height: '20px' }}></div>
          )}
          {mixedDevice.configUrl ? (
            <Tooltip title='Open the configuration page' slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <IconButton onClick={() => window.open(mixedDevice.configUrl, '_blank')} aria-label='Open config url' sx={{ margin: 0, padding: 0 }}>
                <SettingsIcon fontSize='small' />
              </IconButton>
            </Tooltip>
          ) : (
            <div style={{ width: '20px', height: '20px' }}></div>
          )}
          {mixedDevice.selected !== undefined ? (
            <Tooltip title='Select/unselect the device' slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
              <Checkbox checked={mixedDevice.selected} onChange={(event) => handleCheckboxChange(event, mixedDevice)} sx={{ margin: '0', marginLeft: '8px', padding: '0' }} size='small' />
            </Tooltip>
          ) : (
            <div style={{ width: '20px', height: '20px' }}></div>
          )}
        </div>
      ),
    },
  ];

  // Function to determine if a device is selected based on the plugin's whiteList/blackList and selectFrom configuration
  const isSelected = useCallback(
    (device: ApiSelectDevicesWithSelected) => {
      // if(debug) console.log(`HomeDevices isSelected: plugin ${device.pluginName} name ${device.name} serial ${device.serial}`);
      device.selected = undefined;
      const plugin = plugins.find((p) => p.name === device.pluginName);
      if (!plugin) {
        console.error(`HomeDevices isSelected: plugin ${device.pluginName} not found for device ${device.name} `);
        return device.selected;
      }
      const selectMode = plugin.schemaJson?.properties?.whiteList?.selectFrom;
      let postfix = plugin.configJson.postfix;
      if (postfix === '') postfix = undefined;
      if (plugin.hasWhiteList === true && plugin.hasBlackList === true && selectMode) {
        device.selected = true;
        if (selectMode === 'serial' && plugin.configJson.whiteList && plugin.configJson.whiteList.length > 0 && plugin.configJson.whiteList.includes(postfix ? device.serial.replace('-' + postfix, '') : device.serial)) device.selected = true;
        if (selectMode === 'serial' && plugin.configJson.whiteList && plugin.configJson.whiteList.length > 0 && !plugin.configJson.whiteList.includes(postfix ? device.serial.replace('-' + postfix, '') : device.serial)) device.selected = false;
        if (selectMode === 'serial' && plugin.configJson.blackList && plugin.configJson.blackList.length > 0 && plugin.configJson.blackList.includes(postfix ? device.serial.replace('-' + postfix, '') : device.serial)) device.selected = false;
        if (selectMode === 'name' && plugin.configJson.whiteList && plugin.configJson.whiteList.length > 0 && plugin.configJson.whiteList.includes(device.name)) device.selected = true;
        if (selectMode === 'name' && plugin.configJson.whiteList && plugin.configJson.whiteList.length > 0 && !plugin.configJson.whiteList.includes(device.name)) device.selected = false;
        if (selectMode === 'name' && plugin.configJson.blackList && plugin.configJson.blackList.length > 0 && plugin.configJson.blackList.includes(device.name)) device.selected = false;
      }
      // if(debug) console.log(`HomeDevices isSelected: plugin ${device.pluginName} selectMode ${selectMode} postfix ${postfix} name ${device.name} serial ${device.serial} select ${device.selected}`);
      return device.selected;
    },
    [plugins],
  );

  // WebSocket message handler effect
  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessageApiResponse) => {
      if (debug) console.log('HomeDevices received WebSocket Message:', msg);
      // Broadcast messages
      // 'settings' | 'plugins' | 'devices' | 'matter';
      if (msg.method === 'refresh_required' && msg.response.changed !== 'matter') {
        if (debug) console.log(`HomeDevices received refresh_required: changed=${msg.response.changed} and sending /api/plugins request`);
        sendMessage({ id: uniqueId.current, sender: 'HomeDevices', method: '/api/plugins', src: 'Frontend', dst: 'Matterbridge', params: {} });
      } else if (msg.method === 'refresh_required' && msg.response.changed === 'matter') {
        if (debug) console.log(`HomeDevices received refresh_required: changed=${msg.response.changed} and setting matter id ${msg.response.matter?.id}`);
        setMixedDevices((prev) => {
          const i = prev.findIndex((d) => d.name.replaceAll(' ', '') === msg.response.matter?.id);
          if (i < 0) {
            if (debug) console.debug(`HomeDevices: matter id ${msg.response.matter?.id} not found`);
            return prev;
          }
          const next = [...prev];
          next[i] = { ...next[i], matter: msg.response.matter };
          if (debug) console.log(`HomeDevices received refresh_required: changed=${msg.response.changed} and set matter id ${msg.response.matter?.id}`);
          return next;
        });
      } else if (msg.method === 'restart_required') {
        if (debug) console.log('HomeDevices received restart_required');
        setRestart(true);
      } else if (msg.method === 'restart_not_required') {
        if (debug) console.log('HomeDevices received restart_not_required');
        setRestart(false);
      } else if (msg.method === 'state_update') {
        if (msg.response.plugin && msg.response.serialNumber && msg.response.cluster.includes('BasicInformation') && msg.response.attribute === 'reachable') {
          if (debug) console.log(`HomeDevices updating device reachability for plugin ${msg.response.plugin} serial ${msg.response.serialNumber} value ${msg.response.value}`);
          setDevices((prev) => {
            const index = prev.findIndex((d) => d.pluginName === msg.response.plugin && d.serial === msg.response.serialNumber);
            if (index < 0) {
              if (debug) console.warn(`HomeDevices: device to update not found for plugin ${msg.response.plugin} serial ${msg.response.serialNumber}`);
              return prev;
            }
            prev[index] = { ...prev[index], reachable: msg.response.value as boolean };
            return [...prev];
          });
        }
      }
      // Local messages
      if (msg.id === uniqueId.current && msg.method === '/api/settings') {
        if (debug) console.log(`HomeDevices (id: ${msg.id}) received settings:`, msg.response);
        setSettings(msg.response); // Store the settings response
        setRestart(msg.response.matterbridgeInformation.restartRequired || msg.response.matterbridgeInformation.fixedRestartRequired); // Set the restart state based on the response. Used in the footer.
      } else if (msg.id === uniqueId.current && msg.method === '/api/plugins') {
        if (debug) console.log(`HomeDevices (id: ${msg.id}) received ${msg.response?.length} plugins:`, msg.response);
        if (msg.response) {
          // Check if all plugins are loaded and started and not in error state before continuing
          let running = true;
          for (const plugin of msg.response) {
            if (plugin.enabled !== true) continue;
            if (plugin.loaded !== true || plugin.started !== true /* || plugin.configured!==true */ || plugin.error === true) {
              running = false;
            }
          }
          if (!running) return; // Do nothing until all plugins are loaded and started and not in error state

          if (debug) console.log(`HomeDevices reset plugins, devices and selectDevices`);
          setLoading(false); // Set loading to false only when all plugins are loaded. Used in the footer.
          setPlugins(msg.response as unknown as ExtendedBaseRegisteredPlugin[]); // Store the plugins response
          setDevices([]);
          setSelectDevices([]);
          // Request all the devices
          sendMessage({ id: uniqueId.current, sender: 'HomeDevices', method: '/api/devices', src: 'Frontend', dst: 'Matterbridge', params: {} });
          if (debug) console.log(`HomeDevices sent /api/devices`);
          // Request the selected devices for each plugin
          for (const plugin of msg.response) {
            if (plugin.enabled === true && plugin.loaded === true && plugin.started === true /* && plugin.configured===true */ && plugin.error !== true) {
              sendMessage({ id: uniqueId.current, sender: 'HomeDevices', method: '/api/select/devices', src: 'Frontend', dst: 'Matterbridge', params: { plugin: plugin.name } });
              if (debug) console.log(`HomeDevices sent /api/select/devices for plugin: ${plugin.name}`);
            }
          }
        }
      } else if (msg.id === uniqueId.current && msg.method === '/api/devices') {
        if (debug) console.log(`HomeDevices (id: ${msg.id}) received ${msg.response?.length} devices:`, msg.response);
        if (msg.response) {
          for (const device of msg.response as ApiDevicesWithSelected[]) {
            device.selected = isSelected(device);
          }
          setDevices(msg.response);
        }
      } else if (msg.id === uniqueId.current && msg.method === '/api/select/devices') {
        if (debug) console.log(`HomeDevices (id: ${msg.id}) received ${msg.response?.length} selectDevices for plugin ${msg.response && msg.response.length > 0 ? msg.response[0].pluginName : 'without select devices'}:`, msg.response);
        if (msg.response && msg.response.length > 0) {
          setSelectDevices((prevSelectDevices) => {
            // Filter out devices not from the current plugin
            const filteredDevices = prevSelectDevices.filter((device) => device.pluginName !== msg.response[0].pluginName);
            // Add the new devices from the current plugin
            const updatedDevices = msg.response.map((device) => ({ ...device, selected: isSelected(device) }));
            return [...filteredDevices, ...updatedDevices];
          });
        }
      }
    };

    addListener(handleWebSocketMessage, uniqueId.current);
    if (debug) console.log(`HomeDevices added WebSocket listener id ${uniqueId.current}`);

    return () => {
      removeListener(handleWebSocketMessage);
      if (debug) console.log(`HomeDevices removed WebSocket listener`);
    };
  }, [plugins, addListener, removeListener, sendMessage, isSelected]);

  // Mix devices and selectDevices
  useEffect(() => {
    if (devices.length === 0 && selectDevices.length === 0) {
      setMixedDevices([]);
      return;
    }
    if (debug) console.log(`HomeDevices mixing devices (${devices.length}) and selectDevices (${selectDevices.length})`);
    const mixed: MixedApiDevices[] = [];
    for (const device of devices) {
      mixed.push(device);
    }
    for (const selectDevice of selectDevices) {
      if (!devices.find((d) => d.pluginName === selectDevice.pluginName && d.serial.includes(selectDevice.serial))) {
        // if(debug) console.log('HomeDevices mixing selectDevice:', storedDevice.pluginName, storedDevice.serial);
        mixed.push(selectDevice);
      }
    }
    if (mixed.length > 0) {
      setMixedDevices(mixed);
      if (debug) console.log(`HomeDevices mixed ${mixed.length} devices and selectDevices`);
    }
  }, [plugins, devices, selectDevices, setMixedDevices]);

  // Send API requests when online or mounting
  useEffect(() => {
    if (online) {
      if (debug) console.log('HomeDevices sending /api/settings and /api/plugins requests');
      sendMessage({ id: uniqueId.current, sender: 'HomeDevices', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });
      sendMessage({ id: uniqueId.current, sender: 'HomeDevices', method: '/api/plugins', src: 'Frontend', dst: 'Matterbridge', params: {} });
    }
  }, [online, sendMessage]);

  // Handle checkbox change to select/unselect a device
  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>, device: MixedApiDevices) => {
    if (debug) console.log(`handleCheckboxChange: checkbox changed to ${event.target.checked} for device ${device.name} serial ${device.serial}`);
    if (devices.findIndex((d) => d.pluginName === device.pluginName && d.serial === device.serial) < 0) {
      if (debug) console.warn(`handleCheckboxChange: device ${device.name} serial ${device.serial} not found in devices, trying in mixedDevices`);
      setMixedDevices((prev) => {
        const index = prev.findIndex((d) => d.pluginName === device.pluginName && d.serial === device.serial);
        if (index < 0) {
          console.error(`handleCheckboxChange: device ${device.name} serial ${device.serial} not found in mixedDevices`);
          return prev;
        }
        prev[index] = { ...prev[index], selected: event.target.checked };
        return [...prev];
      });
    } else {
      setDevices((prev) => {
        const index = prev.findIndex((d) => d.pluginName === device.pluginName && d.serial === device.serial);
        if (index < 0) {
          console.error(`handleCheckboxChange: device ${device.name} serial ${device.serial} not found in devices`);
          return prev;
        }
        prev[index] = { ...prev[index], selected: event.target.checked };
        return [...prev];
      });
    }
    if (event.target.checked) {
      sendMessage({ id: uniqueId.current, sender: 'HomeDevices', method: '/api/command', src: 'Frontend', dst: 'Matterbridge', params: { command: 'selectdevice', plugin: device.pluginName, serial: device.serial, name: device.name } });
    } else {
      sendMessage({ id: uniqueId.current, sender: 'HomeDevices', method: '/api/command', src: 'Frontend', dst: 'Matterbridge', params: { command: 'unselectdevice', plugin: device.pluginName, serial: device.serial, name: device.name } });
    }
  };

  if (debug) console.log('HomeDevices rendering...');
  if (!online) {
    return <Connecting />;
  }
  return (
    <MbfWindow style={{ flex: '1 1 auto' }}>
      <MbfTable
        name='Devices'
        getRowKey={getRowKey}
        rows={mixedDevices}
        columns={devicesColumns}
        footerLeft={loading ? 'Waiting for the plugins to fully load...' : `Registered devices: ${devices.length.toString()}/${mixedDevices.length.toString()}`}
        footerRight={restart ? 'Restart required' : ''}
      />
    </MbfWindow>
  );
}

export default memo(HomeDevices);
