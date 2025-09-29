// React
import { useEffect, useState, memo, useContext } from 'react';

// @mui/material
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// @mui/icons-material
import TableViewIcon from '@mui/icons-material/TableView';
import ViewModuleIcon from '@mui/icons-material/ViewModule';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import DevicesIcons from './DevicesIcons';
import DevicesTable from './DevicesTable';
import { Connecting } from './Connecting';
import { MbfPage } from './MbfPage';
import { debug } from '../App';

function Devices(): React.JSX.Element {
  // WebSocket context
  const { online } = useContext(WebSocketContext);

  // Filter and view mode states
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState('icon'); // Default to icon view

  // Refs

  useEffect(() => {
    const savedFilter = localStorage.getItem('devicesFilter');
    if (savedFilter) {
      setFilter(savedFilter);
    }
  }, []);

  useEffect(() => {
    const savedViewMode = localStorage.getItem('devicesViewMode');
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(event.target.value.toLowerCase());
    localStorage.setItem('devicesFilter', event.target.value.toLowerCase());
  };
  
  const handleViewModeChange = (mode: string) => {
    setViewMode(mode);
    localStorage.setItem('devicesViewMode', mode);
  };

  if(debug) console.log('Devices rendering...');
  if (!online) {
    return ( <Connecting /> );
  }
  return (
    <MbfPage>

      {/* Devices Filter and View Mode Dialog */}
      <div className="MbfWindowBodyRow" style={{ justifyContent: 'space-between', padding: 0, gap: '20px', width: '100%', height: '45px', minHeight: '45px', maxHeight: '45px' }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
          <Typography sx={{ fontSize: '16px', fontWeight: 'normal', color: 'var(--div-text-color)', marginLeft: '5px', whiteSpace: 'nowrap' }}>Filter by:</Typography>
          <TextField
            variant="outlined"
            value={filter}
            onChange={handleFilterChange}
            placeholder="Enter the device name or serial number"
            sx={{ width: '320px' }}
            InputProps={{
              style: {
                backgroundColor: 'var(--main-bg-color)',
              },
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
          <Typography sx={{ fontSize: '16px', fontWeight: 'normal', color: 'var(--div-text-color)', marginLeft: '5px', whiteSpace: 'nowrap' }}>View mode:</Typography>
          <IconButton onClick={() => handleViewModeChange('table')} aria-label="Table View" disabled={viewMode === 'table'}>
              <Tooltip title="Table View">
                <TableViewIcon style={{ color: viewMode === 'table' ? 'var(--main-icon-color)' : 'var(--primary-color)' }} />
              </Tooltip>
            </IconButton>
            <IconButton onClick={() => handleViewModeChange('icon')} aria-label="Icon View" disabled={viewMode === 'icon'}>
              <Tooltip title="Icon View (beta)">
                <ViewModuleIcon style={{ color: viewMode === 'icon' ? 'var(--main-icon-color)' : 'var(--primary-color)' }} />
              </Tooltip>
            </IconButton>         
        </Box>
      </div>

      {/* Table View mode*/}
      {viewMode === 'table' && (
        <DevicesTable filter={filter} />
      )}

      {/* Icon View mode*/}
      {viewMode === 'icon' && (
        <DevicesIcons filter={filter} />
      )}

    </MbfPage>
  );
}

export default memo(Devices);