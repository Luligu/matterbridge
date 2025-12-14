// React
import { useState, useContext, memo } from 'react';

// @mui/material
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import type { SelectChangeEvent } from '@mui/material/Select';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';

// @mui/icons-material
import DeleteForever from '@mui/icons-material/DeleteForever';

// Frontend
import WebSocketLogs from './WebSocketLogs';
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import { MbfPage } from './MbfPage';
import { debug } from '../App';
// const debug = true;

function Logs(): React.JSX.Element {
  // Contexts
  const { logLength, logAutoScroll, setMessages, setLogFilterLevel: setContextLogFilterLevel, setLogFilterSearch: setContextLogFilterSearch, online, filterLogMessages } = useContext(WebSocketContext);
  // States
  const [logFilterLevel, setLogFilterLevel] = useState(localStorage.getItem('logFilterLevel') ?? 'info');
  const [logFilterSearch, setLogFilterSearch] = useState(localStorage.getItem('logFilterSearch') ?? '*');
  const [localLogLength, setLocalLogLength] = useState(logLength.current.toString());
  const [localLogAutoScroll, setLocalLogAutoScroll] = useState(logAutoScroll.current);

  const handleLogFilterLevelChange = (event: SelectChangeEvent) => {
    const newValue = event.target.value;
    setLogFilterLevel(newValue);
    setContextLogFilterLevel(newValue);
    filterLogMessages(newValue, logFilterSearch);
    localStorage.setItem('logFilterLevel', newValue);
    if (debug) console.log('handleLogFilterLevelChange called with value:', newValue);
  };

  const handleLogFilterSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setLogFilterSearch(newValue);
    setContextLogFilterSearch(newValue);
    filterLogMessages(logFilterLevel, newValue);
    localStorage.setItem('logFilterSearch', newValue);
    if (debug) console.log('handleLogFilterSearchChange called with value:', newValue);
  };

  const handleLogAutoScrollChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setLocalLogAutoScroll(checked);
    logAutoScroll.current = checked;
    filterLogMessages(logFilterLevel, logFilterSearch);
    localStorage.setItem('logAutoScroll', checked ? 'true' : 'false');
    if (debug) console.log('handleAutoScrollChange called with value:', checked);
  };

  const handleLogLengthChange = (event: SelectChangeEvent) => {
    const newValue = event.target.value;
    setLocalLogLength(newValue);
    logLength.current = Number(newValue);
    localStorage.setItem('logLength', newValue);
    if (debug) console.log('handleLogLengthChange called with value:', newValue);
  };

  const handleClearLogsClick = () => {
    if (debug) console.log('handleClearLogsClick called');
    setMessages([]);
  };

  if (debug) console.log('Logs rendering...');
  if (!online) {
    return <Connecting />;
  }
  return (
    <MbfPage name='Logs'>
      {/* Filter and Clear Button */}
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', margin: '0px', padding: '0px', gap: '10px' }}>
        {/* Filter */}
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
            <InputLabel id='select-level' style={{ color: 'var(--div-text-color)' }}>
              Filter log by level:
            </InputLabel>
            <Select style={{ height: '30px', backgroundColor: 'var(--main-bg-color)' }} labelId='select-level' id='debug-level' value={logFilterLevel} onChange={handleLogFilterLevelChange}>
              <MenuItem value='debug'>Debug</MenuItem>
              <MenuItem value='info'>Info</MenuItem>
              <MenuItem value='notice'>Notice</MenuItem>
              <MenuItem value='warn'>Warn</MenuItem>
              <MenuItem value='error'>Error</MenuItem>
              <MenuItem value='fatal'>Fatal</MenuItem>
            </Select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '5px' }}>
            <InputLabel id='search' style={{ color: 'var(--div-text-color)' }}>
              Filter log by text:
            </InputLabel>
            <Tooltip title='Use /text/ for case-insensitive regex search'>
              <TextField
                style={{ width: '210px' }}
                size='small'
                id='logsearch'
                variant='outlined'
                value={logFilterSearch}
                onChange={handleLogFilterSearchChange}
                slotProps={{
                  input: {
                    style: {
                      height: '30px',
                      padding: '0 0px',
                      backgroundColor: 'var(--main-bg-color)',
                    },
                  },
                }}
              />
            </Tooltip>
          </div>
          <FormControlLabel control={<Checkbox checked={localLogAutoScroll} onChange={handleLogAutoScrollChange} />} label='Auto scroll' style={{ color: 'var(--div-text-color)' }} />
        </div>
        {/* Clear Button */}
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <InputLabel id='select-size-label' style={{ color: 'var(--div-text-color)' }}>
            Log length:
          </InputLabel>
          <Select style={{ height: '30px', backgroundColor: 'var(--main-bg-color)' }} labelId='select-size-label' id='select-size' value={localLogLength} onChange={handleLogLengthChange}>
            <MenuItem value={100}>100</MenuItem>
            <MenuItem value={200}>200</MenuItem>
            <MenuItem value={500}>500</MenuItem>
            <MenuItem value={1000}>1000</MenuItem>
          </Select>
          <Tooltip title='Clear the logs'>
            <Button onClick={handleClearLogsClick} endIcon={<DeleteForever />} style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px' }}>
              Clear
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* WebSocket Logs */}
      <div style={{ flex: '1', overflow: 'auto', margin: '0px', padding: '0px' }}>
        <WebSocketLogs />
      </div>
    </MbfPage>
  );
}

export default memo(Logs);
