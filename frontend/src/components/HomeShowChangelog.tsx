// React
import { memo, useContext } from 'react';

// @mui/material
import Button from '@mui/material/Button';

// @mui/icons-material
import AnnouncementOutlinedIcon from '@mui/icons-material/AnnouncementOutlined';
import CancelIcon from '@mui/icons-material/Cancel';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import { MbfWindow } from './MbfWindow';
import { debug } from '../App';
// const debug = true;

interface HomeShowChangelogProps {
  changelog: string;
}

function HomeShowChangelog({ changelog }: HomeShowChangelogProps): React.JSX.Element {
  // Contexts
  const { online } = useContext(WebSocketContext);

  if(debug) console.log('HomeShowChangelog rendering...');
  if (!online) {
    return ( <Connecting /> );
  }
  return (
    <MbfWindow>
      <div className="MbfWindowHeader">
        <p className="MbfWindowHeaderText">Matterbridge Update</p>
      </div>
      <div className="MbfWindowBody" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0 }}>Matterbridge has been updated.</h4>
        <div>
          <Button onClick={() => window.open(changelog, '_blank')} endIcon={<AnnouncementOutlinedIcon />} style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px' }}>Changelog</Button>
          <Button onClick={() => window.location.reload()} endIcon={<CancelIcon />} style={{ marginLeft: '10px', color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px' }}>Close</Button>
        </div>
      </div>
    </MbfWindow>
  );
}

export default memo(HomeShowChangelog);