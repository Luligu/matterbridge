// React
import { memo, useContext } from 'react';

// @mui/material
import Button from '@mui/material/Button';

// @mui/icons-material
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import CancelIcon from '@mui/icons-material/Cancel';
import StarIcon from '@mui/icons-material/Star';
import Favorite from '@mui/icons-material/Favorite';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import { MbfWindow, MbfWindowContent, MbfWindowHeader, MbfWindowHeaderText } from './MbfWindow';
import { debug } from '../App';
// const debug = true;

interface HomeShowChangelogProps {
  changelog: string;
}

function HomeShowChangelog({ changelog }: HomeShowChangelogProps): React.JSX.Element {
  // Contexts
  const { online } = useContext(WebSocketContext);

  if (debug) console.log('HomeShowChangelog rendering...');
  if (!online) {
    return <Connecting />;
  }
  return (
    <MbfWindow>
      <MbfWindowHeader>
        <MbfWindowHeaderText>Matterbridge Update</MbfWindowHeaderText>
      </MbfWindowHeader>
      <MbfWindowContent style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0 }}>Matterbridge has been updated.</h4>
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '10px' }}>
          <Button
            onClick={() => window.open('https://github.com/Luligu/matterbridge', '_blank')}
            endIcon={<StarIcon style={{ color: '#FFD700' }} />}
            style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px' }}
          >
            Star
          </Button>
          <Button
            onClick={() => window.open('https://www.buymeacoffee.com/luligugithub', '_blank')}
            endIcon={<Favorite style={{ color: '#b6409c' }} />}
            style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px' }}
          >
            Sponsor
          </Button>
          <Button onClick={() => window.open(changelog, '_blank')} endIcon={<HistoryOutlinedIcon />} style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px' }}>
            Changelog
          </Button>
          <Button onClick={() => window.location.reload()} endIcon={<CancelIcon />} style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px' }}>
            Close
          </Button>
        </div>
      </MbfWindowContent>
    </MbfWindow>
  );
}

export default memo(HomeShowChangelog);
