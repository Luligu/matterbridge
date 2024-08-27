import { CircularProgress, Box } from '@mui/material';

export default function Connecting() {
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
        <CircularProgress />
        <div style={{ marginTop: '20px' }}>Connecting to Matterbridge...</div>
      </Box>
    </div>
  );
}