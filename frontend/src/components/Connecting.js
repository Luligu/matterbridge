// React
import { useContext } from 'react';

// @mui
import { CircularProgress, Box } from '@mui/material';

// Frontend
import { WebSocketContext } from './WebSocketProvider';

export function Connecting() {
  // Contexts
  const { retry } = useContext(WebSocketContext);

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
        <CircularProgress style={{ color: 'var(--primary-color)' }}/>
        <div style={{ marginTop: '20px', color: 'var(--primary-color)' }}>Reconnecting to Matterbridge {"(retry "+retry}...</div>
      </Box>
    </div>
  );
}