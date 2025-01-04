// @mui
import { CircularProgress, Box } from '@mui/material';

export function Connecting() {
  return (
    <div className="main-background" style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      color: '#333',
      fontSize: '20px',
      flexDirection: 'column'
    }}>
     <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
        <CircularProgress style={{ color: 'var(--primary-color)' }}/>
        <div style={{ marginTop: '20px', color: 'var(--primary-color)' }}>Connecting to Matterbridge...</div>
      </Box>
    </div>
  );
}