// React
import { memo, useContext } from 'react';

// @mui/material
import Button from '@mui/material/Button';

// @mui/icons-material
import Refresh from '@mui/icons-material/Refresh';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import { MbfWindow } from './MbfWindow';
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
      <div className='MbfWindowHeader'>
        <p className='MbfWindowHeaderText'>Frontend Update</p>
      </div>
      <div className='MbfWindowBody' style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0 }}>The frontend has been updated. You are viewing an outdated web UI. Please refresh the page now.</h4>
        <div>
          <Button onClick={() => window.location.reload()} endIcon={<Refresh />} style={{ marginLeft: '10px', color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px' }}>
            Refresh
          </Button>
        </div>
      </div>
    </MbfWindow>
  );
}

export default memo(HomeBrowserRefresh);
