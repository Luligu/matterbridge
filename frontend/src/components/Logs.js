import React, { useEffect, useState } from 'react';
import WebSocketComponent from './WebSocketComponent';
import TextField from '@mui/material/TextField';

import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';

// export const MatterbridgeInfoContext = React.createContext();

function Logs() {
  const [wssHost, setWssHost] = useState(null);
  const [debugLevel, setDebugLevel] = useState('debug');
  const [searchCriteria, setSearchCriteria] = useState('*');

  const handleChangeLevel = (event) => {
    setDebugLevel(event.target.value);
    console.log('handleChangeLevel called with value:', event.target.value);
  };

  const handleChangeSearch = (event) => {
    setSearchCriteria(event.target.value);
    console.log('handleChangeSearch called with value:', event.target.value);
  };

  useEffect(() => {
    // Fetch settinggs from the backend
    fetch('/api/settings')
      .then(response => response.json())
      .then(data => { console.log('/api/settings:', data); setWssHost(data.wssHost); localStorage.setItem('wssHost', data.wssHost); })
      .catch(error => console.error('Error fetching settings:', error));

  }, []); // The empty array causes this effect to run only onceonChange={handleChange}

  if (wssHost === null) {
    return <div>Loading settings...</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px - 40px)', width: 'calc(100vw - 40px)', gap: '10px' , margin: '0', padding: '0' }}>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: '0px', padding: '0px', gap: '10px' }}>
        <h3>Logs:</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <InputLabel id="select-level">Filter by debug level</InputLabel>
          <Select style={{ height: '40px' }} labelId="select-level" id="debug-level" value={debugLevel} onChange={handleChangeLevel}>
            <MenuItem value='debug' >Debug</MenuItem>
            <MenuItem value='info' >Info</MenuItem>
            <MenuItem value='warn' >Warn</MenuItem>
            <MenuItem value='error' >Error</MenuItem>
          </Select>
          <InputLabel id="search">Filter by text</InputLabel>
          <TextField style={{ height: '40px', width: '300px'}} size="small" id="logsearch" label="Enter search criteria" variant="outlined" value={searchCriteria} onChange={handleChangeSearch}/>
        </div>
      </div>  
      <div style={{ flex: '1', overflow: 'auto', margin: '0px', padding: '0px' }}>
        <WebSocketComponent wssHost={wssHost} debugLevel={debugLevel} searchCriteria={searchCriteria}/>
      </div>  
    </div>
  );
}

export default Logs;
/*
    <div style={{ display: 'flex', flex: 1, flexBasis: 'auto', flexDirection: 'column', height: 'calc(100vh - 60px - 40px)', width: 'calc(100vw - 40px)', gap: '10px' , margin: '0', padding: '0' }}>
      <div style={{ display: 'flex', flexDirection: 'row', flex: '0 0 auto' }}>
        <h3>Logs:</h3>
      </div>  
      <div style={{ display: 'flex', flexDirection: 'row', flex: '1 1 auto', margin: '0px', padding: '0px', overflow: 'auto' }}>
        <WebSocketComponent host={host} port={port} height={300}/>
      </div>  
    </div>




*/