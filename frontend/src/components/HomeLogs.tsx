// React
import { memo, useContext, useEffect } from 'react';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import WebSocketLogs from './WebSocketLogs';
import { Connecting } from './Connecting';
import { debug } from '../App';
import { MbfWindow, MbfWindowContent, MbfWindowHeader, MbfWindowHeaderText } from './MbfWindow';
// const debug = true;

function HomeLogs(): React.JSX.Element {
  // Contexts
  const { logFilterLevel, logFilterSearch, logAutoScroll, online } = useContext(WebSocketContext);

  useEffect(() => {
    if (debug) console.log(`HomeLogs logFilterLevel: ${logFilterLevel}, logFilterSearch: ${logFilterSearch}, logAutoScroll: ${logAutoScroll}`);
  }, [logFilterLevel, logFilterSearch, logAutoScroll]);

  if (debug) console.log('HomeLogs rendering...');
  if (!online) {
    return <Connecting />;
  }
  return (
    <MbfWindow style={{ flex: '1 1 auto' }}>
      <MbfWindowHeader>
        <MbfWindowHeaderText>Logs</MbfWindowHeaderText>
        <MbfWindowHeaderText style={{ fontWeight: 'normal', fontSize: '12px', marginTop: '2px' }}>
          Filter: logger level "{logFilterLevel}" and search "{logFilterSearch}" Scroll: {logAutoScroll ? 'auto' : 'manual'}
        </MbfWindowHeaderText>
      </MbfWindowHeader>
      <MbfWindowContent style={{ flex: '1 1 auto', overflow: 'auto', margin: '0px', padding: '10px', alignItems: 'start' }}>
        <WebSocketLogs />
      </MbfWindowContent>
    </MbfWindow>
  );
}

export default memo(HomeLogs);
