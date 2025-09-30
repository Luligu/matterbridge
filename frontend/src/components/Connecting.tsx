// React
import { useContext } from 'react';

// @mui/material
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { MatterbridgeLogo } from './MatterbridgeLogo';

export function Connecting() {
  // Contexts
  const { retry } = useContext(WebSocketContext);

  const handleRefresh = () => {
    window.location.reload(); // Refresh the page
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      height: '100vh',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: '20px',
      color: 'var(--main-text-color)',
      backgroundColor: 'var(--main-bg-color)',
    }}>
        <MatterbridgeLogo style={{ height: '128px', width: '128px', margin: '10px', marginBottom: '20px' }} />
        {retry < 100 ? (
          <>
            <CircularProgress style={{ color: 'var(--primary-color)' }} />
            <div style={{ marginTop: '20px', color: 'var(--primary-color)', textAlign: 'center' }}>
              <span>Reconnecting to Matterbridge {"(attempt " + retry + ")"}...</span>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginTop: '20px', color: 'var(--primary-color)', textAlign: 'center' }}>
              <span>Unable to connect to Matterbridge after multiple attempts.</span><br />
              <span>Please check your network connection.</span><br />
            </div>
            <Button
              variant="contained"
              color="primary"
              onClick={handleRefresh}
              style={{ marginTop: '20px' }}
            >
              Refresh the Page
            </Button>
          </>
        )}      
    </div>
  );
}