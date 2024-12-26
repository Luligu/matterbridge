/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
import React, { useEffect, useState, useContext } from 'react';
import WebSocketComponent from './WebSocketComponent';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { ThemeProvider } from '@mui/material/styles';
import { WebSocketContext } from './WebSocketContext';
import Connecting from './Connecting';
import { OnlineContext } from './OnlineContext';
import { theme } from '../App';

function Logs() {
  const [wssHost, setWssHost] = useState(null);
  const [logFilterLevel, setLogFilterLevel] = useState(localStorage.getItem('logFilterLevel')??'info');
  const [logFilterSearch, setLogFilterSearch] = useState(localStorage.getItem('logFilterSearch')??'*');
  const { messages, sendMessage, logMessage, setLogFilters } = useContext(WebSocketContext);
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

  useEffect(() => {
    // Fetch settinggs from the backend
    fetch('./api/settings')
      .then(response => response.json())
      .then(data => { console.log('/api/settings:', data); setWssHost(data.wssHost); localStorage.setItem('wssHost', data.wssHost); })
      .catch(error => console.error('Error fetching settings:', error));

  }, []); 

  if (!online) {
    return ( <Connecting /> );
  }
  // , alignItems: 'center', justifyContent: 'space-between',
  return (
    <div className="MbfPageDiv">
      <ThemeProvider theme={theme}>
        <div style={{ display: 'flex', flexDirection: 'row', margin: '0px', padding: '0px', gap: '10px' }}>
          {/*<h3 style={{ color: 'var(--div-text-color)' }}>Logs:</h3>*/}
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <InputLabel id="select-level" style={{ color: 'var(--div-text-color)' }}>Filter log by level:</InputLabel>
            <Select style={{ height: '30px' }} labelId="select-level" id="debug-level" value={logFilterLevel} onChange={handleChangeLevel}>
              <MenuItem value='debug'>Debug</MenuItem>
              <MenuItem value='info'>Info</MenuItem>
              <MenuItem value='notice'>Notice</MenuItem>
              <MenuItem value='warn'>Warn</MenuItem>
              <MenuItem value='error'>Error</MenuItem>
              <MenuItem value='fatal'>Fatal</MenuItem>
            </Select>
            <InputLabel id="search" style={{ color: 'var(--div-text-color)' }}>Filter log by text:</InputLabel>
            <TextField style={{ width: '300px'}} size="small" id="logsearch"variant="outlined" value={logFilterSearch} onChange={handleChangeSearch}
              InputProps={{
                style: {
                  height: '30px',
                  padding: '0 0px',
                },
              }}/>
          </div>
        </div>  
        <div style={{ flex: '1', overflow: 'auto', margin: '0px', padding: '0px' }}>
          <WebSocketComponent/>
        </div>  
      </ThemeProvider>  
    </div>
  );
}

export default Logs;
