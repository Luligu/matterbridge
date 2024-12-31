/* eslint-disable no-console */
import React, { useState, useContext } from 'react';
import WebSocketLogs from './WebSocketLogs';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { WebSocketContext } from './WebSocketProvider';
import Connecting from './Connecting';
import { OnlineContext } from './OnlineProvider';

function Logs() {
  const [logFilterLevel, setLogFilterLevel] = useState(localStorage.getItem('logFilterLevel')??'info');
  const [logFilterSearch, setLogFilterSearch] = useState(localStorage.getItem('logFilterSearch')??'*');
  const { setLogFilters } = useContext(WebSocketContext);
  const { online } = useContext(OnlineContext);

  const handleChangeLevel = (event) => {
    setLogFilterLevel(event.target.value);
    setLogFilters(event.target.value, logFilterSearch);
    localStorage.setItem('logFilterLevel', event.target.value);
    console.log('handleChangeLevel called with value:', event.target.value);
  };

  const handleChangeSearch = (event) => {
    setLogFilterSearch(event.target.value);
    setLogFilters(logFilterLevel, event.target.value);
    localStorage.setItem('logFilterSearch', event.target.value);
    console.log('handleChangeSearch called with value:', event.target.value);
  };

  if (!online) {
    return ( <Connecting /> );
  }
  return (
    <div className="MbfPageDiv">
      <div style={{ display: 'flex', flexDirection: 'row', margin: '0px', padding: '0px', gap: '10px' }}>
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
        </div>
      </div>  
      <div style={{ flex: '1', overflow: 'auto', margin: '0px', padding: '0px' }}>
        <WebSocketLogs/>
      </div>  
    </div>
  );
}

export default Logs;
