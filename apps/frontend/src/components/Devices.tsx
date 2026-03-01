// React
import { useEffect, useState, memo, useContext, useRef } from 'react';

// @mui/material
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';

// @mui/icons-material
import TableViewIcon from '@mui/icons-material/TableView';
import ViewModuleIcon from '@mui/icons-material/ViewModule';

// Backend
import { WsMessageApiResponse } from '../utils/backendTypes';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import DevicesIcons from './DevicesIcons';
import DevicesTable from './DevicesTable';
import { Connecting } from './Connecting';
import { MbfPage } from './MbfPage';
import { MbfLsk } from '../utils/localStorage';
// import { debug } from '../App';
const debug = true; // Set to true to enable debug logs in Devices component

function Devices(): React.JSX.Element {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);

  // Filter and view mode states
  const [plugins, setPlugins] = useState<string[]>(['All plugins']);
  const [filterPlugins, setFilterPlugins] = useState('All plugins');
  const [filterDevices, setFilterDevices] = useState('');
  const [viewMode, setViewMode] = useState('icon'); // Default to icon view

  // Refs
  const uniqueId = useRef(getUniqueId());

  const normalizePluginSelection = (value: string, options: string[]) => {
    const normalizedValue = value?.trim().toLowerCase();
    const fallback = options[0] ?? 'All plugins';
    if (!normalizedValue) return fallback;
    return options.find((p) => p.toLowerCase() === normalizedValue) ?? fallback;
  };

  useEffect(() => {
    const savedPlugin = localStorage.getItem(MbfLsk.devicesPlugin);
    if (savedPlugin) {
      setFilterPlugins(savedPlugin);
    }
  }, []);

  useEffect(() => {
    setFilterPlugins((current) => normalizePluginSelection(current, plugins));
  }, [plugins]);

  useEffect(() => {
    const savedFilter = localStorage.getItem(MbfLsk.devicesFilter);
    if (savedFilter) {
      setFilterDevices(savedFilter);
    }
  }, []);

  useEffect(() => {
    const savedViewMode = localStorage.getItem(MbfLsk.devicesViewMode);
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  // WebSocket message handler effect
  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessageApiResponse) => {
      if (debug) console.log('Devices received WebSocket Message:', msg);
      if (msg.method === 'refresh_required' && msg.response.changed === 'plugins' && !msg.response.lock) {
        if (debug) console.log('Devices received refresh_required for plugins, sending /api/plugins request with id ', uniqueId.current);
        sendMessage({ id: uniqueId.current, sender: 'Devices', method: '/api/plugins', src: 'Frontend', dst: 'Matterbridge', params: {} });
      } else if (msg.method === '/api/plugins' && msg.id === uniqueId.current && msg.response) {
        if (debug) console.log(`Plugins received ${msg.response.length} plugins:`, msg.response);
        setPlugins(['All plugins', ...msg.response.map((p) => p.name)]);
        if (debug) console.log(`Plugins list:`, plugins.join(', '));
      }
    };

    addListener(handleWebSocketMessage, uniqueId.current);
    if (debug) console.log('Devices added WebSocket listener');

    return () => {
      removeListener(handleWebSocketMessage);
      if (debug) console.log('Devices removed WebSocket listener');
    };
  }, [sendMessage, addListener, removeListener, plugins]);

  // Send API requests when online
  useEffect(() => {
    if (online) {
      if (debug) console.log('Devices sending /api/plugins request with id ', uniqueId.current);
      sendMessage({ id: uniqueId.current, sender: 'Devices', method: '/api/plugins', src: 'Frontend', dst: 'Matterbridge', params: {} });
    }
  }, [online, sendMessage]);

  const handlePluginChange = (event: SelectChangeEvent<string>) => {
    const selected = event.target.value;
    setFilterPlugins(selected);
    localStorage.setItem(MbfLsk.devicesPlugin, selected);
  };

  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilterDevices(event.target.value.toLowerCase());
    localStorage.setItem(MbfLsk.devicesFilter, event.target.value.toLowerCase());
  };

  const handleViewModeChange = (mode: string) => {
    setViewMode(mode);
    localStorage.setItem(MbfLsk.devicesViewMode, mode);
  };

  if (debug) console.log('Devices rendering...');
  if (!online) {
    return <Connecting />;
  }
  return (
    <MbfPage name='Devices'>
      {/* Devices Filter and View Mode Dialog */}
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: 0, margin: 0, gap: '20px', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: 0, margin: 0, gap: '20px' }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
            <Typography sx={{ fontSize: '16px', fontWeight: 'normal', color: 'var(--div-text-color)', marginLeft: '5px', whiteSpace: 'nowrap' }}>Plugin:</Typography>
            <Select
              variant='outlined'
              value={filterPlugins}
              onChange={handlePluginChange}
              sx={{
                width: '260px',
                backgroundColor: 'var(--main-bg-color)',
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'var(--main-bg-color)',
                },
                '& .MuiSelect-select': {
                  backgroundColor: 'var(--main-bg-color)',
                },
                '& .MuiSelect-icon': {
                  color: 'var(--main-label-color)',
                },
              }}
              input={<OutlinedInput sx={{ backgroundColor: 'var(--main-bg-color)' }} />}
            >
              {plugins.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
            <Typography sx={{ fontSize: '16px', fontWeight: 'normal', color: 'var(--div-text-color)', marginLeft: '5px', whiteSpace: 'nowrap' }}>Filter by:</Typography>
            <TextField
              variant='outlined'
              value={filterDevices}
              onChange={handleFilterChange}
              placeholder='Enter the device name or serial'
              sx={{
                width: '260px',
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'var(--main-bg-color)',
                },
              }}
            />
          </Box>
        </div>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
          <Typography sx={{ fontSize: '16px', fontWeight: 'normal', color: 'var(--div-text-color)', marginLeft: '5px', whiteSpace: 'nowrap' }}>View mode:</Typography>
          <IconButton onClick={() => handleViewModeChange('table')} aria-label='Table View' disabled={viewMode === 'table'}>
            <Tooltip title='Table View'>
              <TableViewIcon style={{ color: viewMode === 'table' ? 'var(--main-icon-color)' : 'var(--primary-color)' }} />
            </Tooltip>
          </IconButton>
          <IconButton onClick={() => handleViewModeChange('icon')} aria-label='Icon View' disabled={viewMode === 'icon'}>
            <Tooltip title='Icon View (beta)'>
              <ViewModuleIcon style={{ color: viewMode === 'icon' ? 'var(--main-icon-color)' : 'var(--primary-color)' }} />
            </Tooltip>
          </IconButton>
        </Box>
      </div>

      {/* Table View mode*/}
      {viewMode === 'table' && <DevicesTable filterPlugins={filterPlugins} filterDevices={filterDevices} />}

      {/* Icon View mode*/}
      {viewMode === 'icon' && <DevicesIcons filterPlugins={filterPlugins} filterDevices={filterDevices} />}
    </MbfPage>
  );
}

export default memo(Devices);
