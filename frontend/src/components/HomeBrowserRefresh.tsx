// React
import { memo, useContext } from 'react';

// @mui/material
import Button from '@mui/material/Button';

// @mui/icons-material
import Refresh from '@mui/icons-material/Refresh';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import { MbfWindow, MbfWindowContent, MbfWindowHeader, MbfWindowHeaderText } from './MbfWindow';
import { debug } from '../App';
// const debug = true;

function HomeBrowserRefresh(): React.JSX.Element {
  // Contexts
  const { online } = useContext(WebSocketContext);

  if (debug) console.log('HomeBrowserRefresh rendering...');
  if (!online) {
    return <Connecting />;
  }
  return (
    <MbfWindow>
      <MbfWindowHeader>
        <MbfWindowHeaderText>Frontend Update</MbfWindowHeaderText>
      </MbfWindowHeader>
      <MbfWindowContent style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0 }}>The frontend has been updated. You are viewing an outdated web UI. Please refresh the page now.</h4>
        <div>
          <Button onClick={() => window.location.reload()} endIcon={<Refresh />} style={{ marginLeft: '10px', color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px' }}>
            Refresh
          </Button>
        </div>
      </MbfWindowContent>
    </MbfWindow>
  );
}

export default memo(HomeBrowserRefresh);
