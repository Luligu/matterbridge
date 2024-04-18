import React, { useEffect, useState, useRef } from 'react';
import WebSocketComponent from './WebSocketComponent';

export const MatterbridgeInfoContext = React.createContext();

function Log() {
  const [wssHost, setWssHost] = useState(null);

  useEffect(() => {
    // Fetch settinggs from the backend
    fetch('/api/settings')
      .then(response => response.json())
      .then(data => { console.log('/api/settings:', data); setWssHost(data.wssHost); localStorage.setItem('wssHost', data.wssHost); })
      .catch(error => console.error('Error fetching settings:', error));

  }, []); // The empty array causes this effect to run only once

  if (wssHost === null) {
    return <div>Loading settings...</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px - 40px)', width: 'calc(100vw - 40px)', gap: '10px' , margin: '0', padding: '0' }}>
      <h3>Logs:</h3>
      <div style={{ flex: '1', overflow: 'auto', margin: '0px', padding: '0px' }}>
        <WebSocketComponent wssHost={wssHost}/>
      </div>  
    </div>
  );
}

export default Log;
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