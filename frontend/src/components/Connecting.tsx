// React
import { useContext } from 'react';

// @mui/material
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

// Frontend
import { WebSocketContext } from './WebSocketProvider';

export function Connecting() {
  // Contexts
  const { retry } = useContext(WebSocketContext);

  const handleRefresh = () => {
    window.location.reload(); // Refresh the page
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: '20px',
      flexDirection: 'column',
      color: 'var(--main-text-color)',
      height: '100vh',
      backgroundColor: 'var(--main-bg-color)',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
        {retry < 100 ? (
          <>
            <CircularProgress style={{ color: 'var(--primary-color)' }} />
            <div style={{ marginTop: '20px', color: 'var(--primary-color)' }}>
              Reconnecting to Matterbridge {"(attempt " + retry + ")"}...
            </div>
          </>
        ) : (
          <div style={{ marginTop: '20px', color: 'var(--primary-color)', textAlign: 'center' }}>
            Unable to connect to Matterbridge after multiple attempts.<br />
            Please check your network connection.<br /> 
            <Button
              variant="contained"
              color="primary"
              onClick={handleRefresh}
              style={{ marginTop: '20px' }}
            >
              Refresh the Page
            </Button>
          </div>
        )}      
      </Box>
    </div>
  );
}