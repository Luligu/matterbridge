// React
import { memo, useContext } from 'react';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import WebSocketLogs from './WebSocketLogs';
import { Connecting } from './Connecting';
import { debug } from '../App';
import { MbfWindow, MbfWindowContent, MbfWindowHeader, MbfWindowHeaderText } from './MbfWindow';
// const debug = true;

function HomeLogs(): React.JSX.Element {
  // Contexts
  const { logFilterLevel, logFilterSearch, autoScroll, online } = useContext(WebSocketContext);

  if (debug) console.log('HomeLogs rendering...');
  if (!online) {
    return <Connecting />;
  }
  return (
    <MbfWindow style={{ flex: '1 1 auto' }}>
      <MbfWindowHeader>
        <MbfWindowHeaderText>Logs</MbfWindowHeaderText>
        <MbfWindowHeaderText style={{ fontWeight: 'normal', fontSize: '12px', marginTop: '2px' }}>
          Filter: logger level "{logFilterLevel}" and search "{logFilterSearch}" Scroll: {autoScroll ? 'auto' : 'manual'}
        </MbfWindowHeaderText>
      </MbfWindowHeader>
      <MbfWindowContent style={{ flex: '1 1 auto', overflow: 'auto', margin: '0px', padding: '10px' }}>
        <WebSocketLogs />
      </MbfWindowContent>
    </MbfWindow>
  );
}

export default memo(HomeLogs);
