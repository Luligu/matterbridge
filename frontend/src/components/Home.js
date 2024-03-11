// Home.js
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode.react';
import { StatusIndicator } from './StatusIndicator';

function Home() {
  const [qrCode, setQrCode] = useState('');
  const [systemInfo, setSystemInfo] = useState({});
  const [plugins, setPlugins] = useState([]);
  const columns = React.useMemo( () => [
      {
        Header: 'Name',
        accessor: 'name',
      },
      {
        Header: 'Description',
        accessor: 'description',
      },
      {
        Header: 'Version',
        accessor: 'version',
      },
      {
        Header: 'Author',
        accessor: 'author',
      },
      {
        Header: 'Type',
        accessor: 'type',
      },
      {
        Header: 'Devices',
        accessor: 'devices',
      },
      {
        Header: 'Status',
        accessor: 'status',
        Cell: ({ value }) => <StatusIndicator status={value} />,
      },
    ],
    []
  );

  /*
  useEffect(() => {
    const interval = setInterval(() => {

      // Fetch Plugins
      fetch('/api/plugins')
        .then(response => response.json())
        .then(data => { setPlugins(data); console.log('/api/plugins:', data)})
        .catch(error => console.error('Error fetching plugins:', error));
  
      // Clear interval on component unmount
      return () => clearInterval(interval);
    }, 2000);
  }, []); 
  */
 
  useEffect(() => {
    // Fetch QR Code
    fetch('/api/qr-code')
      .then(response => response.json())
      .then(data => { setQrCode(data.qrPairingCode); console.log('/api/qr-code:', data.qrPairingCode) })
      .catch(error => console.error('Error fetching QR code:', error));

    // Fetch System Info
    fetch('/api/system-info')
      .then(response => response.json())
      .then(data => { setSystemInfo(data); console.log('/api/system-info:', data) })
      .catch(error => console.error('Error fetching system info:', error));

    // Fetch Plugins
    fetch('/api/plugins')
      .then(response => response.json())
      .then(data => { setPlugins(data); console.log('/api/plugins:', data)})
      .catch(error => console.error('Error fetching plugins:', error));

  }, []); // The empty array causes this effect to run only once

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: 'calc(100vh - 80px - 40px)', width: 'calc(100vw - 40px)', gap: '20px', margin: '0', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: '0 1 auto'/*, width: '310px'*/, gap: '20px' }}>
        {qrCode && <QRDiv qrText={qrCode} qrWidth={256} topText="QRCode" bottomText="Scan me to pair matterbridge" />}
        <table>
          <thead>
            <tr>
              <th colSpan="2" className="table-header">System Information</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(systemInfo).map(([key, value], index) => (
              <tr key={key} className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'}>
                <td className="table-content">{key}</td>
                <td className="table-content">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto' }}>
        <table>
          <thead>
            <tr>
              <th className="table-header" colSpan="7">Registered plugins</th>
            </tr>
            <tr>
              {columns.map((column, index) => (
                <th className="table-header" key={index}>{column.Header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plugins.map((plugin, index) => (
              <tr key={index} className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'}>
                <td className="table-content">{plugin.name}</td>
                <td className="table-content">{plugin.description}</td>
                <td className="table-content">{plugin.version}</td>
                <td className="table-content">{plugin.author}</td>
                <td className="table-content">{plugin.type}</td>
                <td className="table-content">{plugin.registeredDevices}</td>
                <td className="table-content">
                  <div style={{ display: 'flex', flexDirection: 'row', flex: '1 1 auto', gap: '5px' }}>
                    <StatusIndicator status={plugin.enabled}/>
                    {plugin.loaded && plugin.started && plugin.paired && plugin.connected ? 
                      <>
                        <StatusIndicator status={true} enabledText = 'Running'/>
                      </> : 
                      <>
                        <StatusIndicator status={plugin.loaded} enabledText='Loaded'/>
                        <StatusIndicator status={plugin.started} enabledText='Started'/>
                        <StatusIndicator status={plugin.paired} enabledText='Paired'/>
                        <StatusIndicator status={plugin.connected} enabledText='Connected'/>
                      </>}
                  </div> 
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );}

  //data.push({ name: plugin.name, description: plugin.description, version: plugin.version, author: plugin.author, type: plugin.type, devices: count, status: plugin.enabled! });
  
  // This function takes four parameters: qrText, qrWidth, topText, and bottomText
  // It returns a div element with a rectangle, a QR code, and two texts
  function QRDiv({ qrText, qrWidth, topText, bottomText }) {
    // Define the style for the div element
    const divStyle = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxShadow: '5px 5px 10px #888',
      border: '1px solid #ddd',
      backgroundColor: '#9e9e9e'
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
      <div className="main-background" style={divStyle}>
        <div style={headerStyle}>
          <p style={textStyle}>{topText}</p>
        </div>
        <QRCode value={qrText} size={qrWidth} bgColor={divStyle.backgroundColor} style={{ marginTop: '20px', marginBottom: '20px' }}/>
        <div style={footerStyle}>
          <p>{bottomText}</p>
        </div>
      </div>
    );
  }

export default Home;
