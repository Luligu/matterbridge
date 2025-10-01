// React
import { memo, useContext } from 'react';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import WebSocketLogs from './WebSocketLogs';
import { Connecting } from './Connecting';
import { debug } from '../App';
// const debug = true;

function HomeLogs(): React.JSX.Element {
  // Contexts
  const { logFilterLevel, logFilterSearch, autoScroll, online } = useContext(WebSocketContext);

  if (debug) console.log('HomeLogs rendering...');
  if (!online) {
    return <Connecting />;
  }
  return (
    <div className='MbfWindowDiv' style={{ flex: '1 1 auto', width: '100%', overflow: 'hidden' }}>
      <div className='MbfWindowHeader' style={{ height: '30px', minHeight: '30px', justifyContent: 'space-between' }}>
        <p className='MbfWindowHeaderText'>Logs</p>
        <div className='MbfWindowHeaderText' style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 'normal', fontSize: '12px', marginTop: '2px' }}>
            Filter: logger level "{logFilterLevel}" and search "{logFilterSearch}" Scroll: {autoScroll ? 'auto' : 'manual'}
          </span>
        </div>
      </div>
      <div style={{ flex: '1 1 auto', margin: '0px', padding: '10px', overflow: 'auto' }}>
        <WebSocketLogs />
      </div>
    </div>
  );
}

export default memo(HomeLogs);
