// React
import { memo, useContext, useState } from 'react';

import { debug } from '../appState';
import { MbfLsk } from '../utils/localStorage';
import { Connecting } from './Connecting';
import { MbfWindow, MbfWindowContent, MbfWindowHeader, MbfWindowHeaderText } from './MbfWindow';
import WebSocketLogs from './WebSocketLogs';
import { WebSocketContext } from './WebSocketProvider';

function HomeLogs(): React.JSX.Element {
  // States
  const [logFilterLevel, _setLogFilterLevel] = useState(localStorage.getItem(MbfLsk.logFilterLevel) ?? 'info');
  const [logFilterSearch, _setLogFilterSearch] = useState(localStorage.getItem(MbfLsk.logFilterSearch) ?? '*');

  // Contexts
  const { online, logAutoScroll } = useContext(WebSocketContext);

  if (debug) console.log('HomeLogs rendering...');
  if (!online) {
    return <Connecting />;
  }
  return (
    <MbfWindow style={{ flex: '1 1 auto' }}>
      <MbfWindowHeader>
        <MbfWindowHeaderText>Logs</MbfWindowHeaderText>
        <MbfWindowHeaderText style={{ fontWeight: 'normal', fontSize: '12px', marginTop: '2px' }}>
          Filter: logger level "{logFilterLevel}" and search "{logFilterSearch === '' ? '*' : logFilterSearch}" Scroll: {logAutoScroll.current ? 'auto' : 'manual'}
        </MbfWindowHeaderText>
      </MbfWindowHeader>
      <MbfWindowContent style={{ flex: '1 1 auto', overflow: 'auto', margin: '0px', padding: '10px', alignItems: 'start' }}>
        <WebSocketLogs />
      </MbfWindowContent>
    </MbfWindow>
  );
}

export default memo(HomeLogs);
