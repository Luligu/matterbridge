// @mui/icons-material
import CancelIcon from '@mui/icons-material/Cancel';
import Favorite from '@mui/icons-material/Favorite';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import StarIcon from '@mui/icons-material/Star';
// @mui/material
import Button from '@mui/material/Button';
// React
import { memo, useContext } from 'react';

import { debug } from '../appState';
import { Connecting } from './Connecting';
import { MbfWindow, MbfWindowContent, MbfWindowHeader, MbfWindowHeaderText } from './MbfWindow';
import { WebSocketContext } from './WebSocketProvider';

interface HomeShowChangelogProps {
  version: string;
  changelog: string;
}

function HomeShowChangelog({ version, changelog }: HomeShowChangelogProps): React.JSX.Element {
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
      <MbfWindowContent style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0 }}>Matterbridge has been updated to version {version}.</h4>
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
          <Button
            onClick={() => window.open(changelog, '_blank')}
            endIcon={<HistoryOutlinedIcon />}
            style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px' }}
          >
            Changelog
          </Button>
          <Button
            onClick={() => window.location.reload()}
            endIcon={<CancelIcon />}
            style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px' }}
          >
            Close
          </Button>
        </div>
      </MbfWindowContent>
    </MbfWindow>
  );
}

export default memo(HomeShowChangelog);
