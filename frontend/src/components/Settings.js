import React from 'react';
import { StatusIndicator } from './StatusIndicator';

function Settings() {

  return (
    <div style={{ display: 'flex', flex: 1, flexBasis: 'auto', flexDirection: 'column', height: 'calc(100vh - 80px - 20px)', width: 'calc(100vw - 40px)', gap: '20px' , margin: '0', padding: '20px', paddingTop: '0px' }}>
      <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
        <h4>Matterbridge settings:</h4>
      </div>  
      <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
        Mode: <StatusIndicator status={true} enabledText = 'childbridge'/>
      </div>  
    </div>
  );
}

export default Settings;
