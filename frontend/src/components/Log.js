import React, { useEffect, useState } from 'react';
import WebSocketComponent from './WebSocketComponent';

export const MatterbridgeInfoContext = React.createContext();

function Log() {
  const [host, setHost] = useState(null);
  const [port, setPort] = useState(null);

  useEffect(() => {
    // Fetch wss host
    fetch('/api/wsshost')
      .then(response => response.json())
      .then(data => { console.log('/api/wsshost:', data.host); setHost(data.host); localStorage.setItem('host', data.host); })
      .catch(error => console.error('Error fetching wsshost:', error));

    // Fetch wss port
    fetch('/api/wssport')
      .then(response => response.json())
      .then(data => { console.log('/api/wssport:', data.port); setPort(data.port); localStorage.setItem('port', data.port); })
      .catch(error => console.error('Error fetching wssport:', error));
  }, []); // The empty array causes this effect to run only once

  if (host === null || port === null) {
    return <div>Loading...</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px - 40px)', width: 'calc(100vw - 40px)', gap: '10px' , margin: '0', padding: '0' }}>
      <h3>Logs:</h3>
      <div style={{ flex: '1', overflow: 'auto', margin: '0px', padding: '0px' }}>
        <WebSocketComponent host={host} port={port} height={300}/>
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