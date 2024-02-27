// Home.js
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode.react';

function Home() {
  const [qrCode, setQrCode] = useState('');
  const [systemInfo, setSystemInfo] = useState({});
  const [plugins, setPlugins] = useState([]);

  useEffect(() => {
    // Fetch QR Code
    fetch('/api/qr-code')
      .then(response => response.json())
      .then(data => { setQrCode(data.qrPairingCode); console.log('QR code:', data.qrPairingCode) })
      .catch(error => console.error('Error fetching QR code:', error));

    // Fetch System Info
    fetch('/api/system-info')
      .then(response => response.json())
      .then(data => { setSystemInfo(data); console.log('QR code:', data) })
      .catch(error => console.error('Error fetching system info:', error));

    // Fetch Plugins
    fetch('/api/plugins')
      .then(response => response.json())
      .then(data => setPlugins(data))
      .catch(error => console.error('Error fetching plugins:', error));

  }, []);
/*
*/

  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '310px', margin: 20 }}>
        {qrCode && <QRDiv qrText={qrCode} qrWidth={256} topText="QRCode" bottomText="Scan me to pair matterbridge" />}
        <table>
          <thead>
            <tr>
              <th colSpan="2" className="table-header">System Information</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(systemInfo).map(([key, value]) => (
              <tr key={key}>
                <td style={{ fontSize: '12px' }}>{key}</td>
                <td style={{ fontSize: '12px' }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ flex: 2, width: '310px', margin: 20  }}>
        <table>
          <thead>
            <tr>
              <th className="table-header">Name</th>
              <th className="table-header">Description</th>
              <th className="table-header">Version</th>
              <th className="table-header">Author</th>
              <th className="table-header">Type</th>
            </tr>
          </thead>
          <tbody>
            {plugins.map((plugin, index) => (
              <tr key={index}>
                <td>{plugin.name}</td>
                <td>{plugin.description}</td>
                <td>{plugin.version}</td>
                <td>{plugin.author}</td>
                <td>{plugin.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );}

  
  // This function takes four parameters: qrText, qrWidth, topText, and bottomText
  // It returns a div element with a rectangle, a QR code, and two texts
  function QRDiv({ qrText, qrWidth, topText, bottomText }) {
    // Define the style for the div element
    const divStyle = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxShadow: '5px 5px 10px #888',
      marginBottom: '40px',
      border: '1px solid #ddd',
      backgroundColor: 'lightgray'
    };
  
    // Define the style for the text element
    const textStyle = {
      fontWeight: 'bold',
      color: 'white'
    };
  
    // Define the style for the header element
    const headerStyle = {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '30px',
      backgroundColor: '#4CAF50',
      color: 'white',
      border: '1px solid #ddd'
    };

    // Define the style for the header element
    const footerStyle = {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '30px',
      color: 'black',
    };
  
    // Return the JSX code for the div element
    return (
      <div style={divStyle}>
        <div style={headerStyle}>
          <p style={textStyle}>{topText}</p>
        </div>
        <QRCode value={qrText} size={qrWidth} bgColor={divStyle.backgroundColor} style={{ marginTop: '20px', marginBottom: '0px' }}/>
        <div style={footerStyle}>
          <p>{bottomText}</p>
        </div>
      </div>
    );
  }
  
  
export default Home;
