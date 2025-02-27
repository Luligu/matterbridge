/* eslint-disable no-console */
// React
import React, { useState, useContext } from 'react';

// @mui/material
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';

// @mui/icons-material
import DeleteForever from '@mui/icons-material/DeleteForever';

// Frontend
import { WebSocketLogs } from './WebSocketLogs';
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import { debug } from '../App';
// const debug = true;

function Logs() {
  const [logFilterLevel, setLogFilterLevel] = useState(localStorage.getItem('logFilterLevel')??'info');
  const [logFilterSearch, setLogFilterSearch] = useState(localStorage.getItem('logFilterSearch')??'*');
  const { setMessages, setLogFilters, online, autoScroll, setAutoScroll } = useContext(WebSocketContext);

  const handleChangeLevel = (event) => {
    setLogFilterLevel(event.target.value);
    setLogFilters(event.target.value, logFilterSearch);
    localStorage.setItem('logFilterLevel', event.target.value);
    if(debug) console.log('handleChangeLevel called with value:', event.target.value);
  };

  const handleChangeSearch = (event) => {
    setLogFilterSearch(event.target.value);
    setLogFilters(logFilterLevel, event.target.value);
    localStorage.setItem('logFilterSearch', event.target.value);
    if(debug) console.log('handleChangeSearch called with value:', event.target.value);
  };

  const handleClearLogsClick = () => {
    if(debug) console.log('handleClearLogsClick called');
    setMessages([]);
  };

  const handleAutoScrollChange = (event) => {
    setAutoScroll(event.target.checked);
    if(debug) console.log('handleAutoScrollChange called with value:', event.target.checked);
  };

  if(debug) console.log('Logs rendering...');
  if (!online) {
    return ( <Connecting /> );
  }
  return (
    <div className="MbfPageDiv">
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', margin: '0px', padding: '0px', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <InputLabel id="select-level" style={{ color: 'var(--div-text-color)' }}>Filter log by level:</InputLabel>
          <Select style={{ height: '30px', backgroundColor: 'var(--main-bg-color)' }} labelId="select-level" id="debug-level" value={logFilterLevel} onChange={handleChangeLevel}>
            <MenuItem value='debug'>Debug</MenuItem>
            <MenuItem value='info'>Info</MenuItem>
            <MenuItem value='notice'>Notice</MenuItem>
            <MenuItem value='warn'>Warn</MenuItem>
            <MenuItem value='error'>Error</MenuItem>
            <MenuItem value='fatal'>Fatal</MenuItem>
          </Select>
          <InputLabel id="search" style={{ color: 'var(--div-text-color)' }}>Filter log by text:</InputLabel>
          <TextField style={{ width: '300px' }} size="small" id="logsearch" variant="outlined" value={logFilterSearch} onChange={handleChangeSearch}
            InputProps={{
              style: {
                height: '30px',
                padding: '0 0px',
                backgroundColor: 'var(--main-bg-color)',
              },
            }}/>
          <FormControlLabel
            control={<Checkbox checked={autoScroll} onChange={handleAutoScrollChange} />}
            label="Auto Scroll"
            style={{ color: 'var(--div-text-color)' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Tooltip title="Clear the logs">
            <Button onClick={handleClearLogsClick} endIcon={<DeleteForever />} style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px' }}>Clear</Button>
          </Tooltip>        
        </div>
      </div>  
      <div style={{ flex: '1', overflow: 'auto', margin: '0px', padding: '0px' }}>
        <WebSocketLogs/>
      </div>  
    </div>
  );
}

export default Logs;
