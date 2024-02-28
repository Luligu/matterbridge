// Devices.js
import React, { useEffect, useState } from 'react';

function Devices() {
  const [devices, setDevices] = useState([]);
  const [sortColumn, setSortColumn] = useState('pluginName');
  const [sortDirection, setSortDirection] = useState(true); // true for ascending, false for descending

  useEffect(() => {
    // Fetch Devices
    fetch('/api/devices')
      .then(response => response.json())
      .then(data => setDevices(data))
      .catch(error => console.error('Error fetching devices:', error));

  }, []);
  
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(!sortDirection);
    } else {
      setSortColumn(column);
      setSortDirection(true);
    }
  };

  const sortedDevices = [...devices].sort((a, b) => {
    if (a[sortColumn] < b[sortColumn]) {
      return sortDirection ? -1 : 1;
    }
    if (a[sortColumn] > b[sortColumn]) {
      return sortDirection ? 1 : -1;
    }
    return 0;
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px - 40px)', width: 'calc(100vw - 40px)', gap: '20px', margin: '0', padding: '20px' }}>
        <table>
          <thead>
            <tr>
            <th className="table-header" onClick={() => handleSort('pluginName')}>
              Plugin name {sortColumn === 'pluginName' ? (sortDirection ? ' 🔼' : ' 🔽') : ''}
            </th>
            <th className="table-header" onClick={() => handleSort('type')}>
              Type {sortColumn === 'type' ? (sortDirection ? ' 🔼' : ' 🔽') : ''}
            </th>
            <th className="table-header" onClick={() => handleSort('endpoint')}>
              Endpoint {sortColumn === 'endpoint' ? (sortDirection ? ' 🔼' : ' 🔽') : ''}
            </th>
            <th className="table-header" onClick={() => handleSort('name')}>
              Name {sortColumn === 'name' ? (sortDirection ? ' 🔼' : ' 🔽') : ''}
            </th>
            <th className="table-header" onClick={() => handleSort('cluster')}>
              Cluster {sortColumn === 'cluster' ? (sortDirection ? ' 🔼' : ' 🔽') : ''}
            </th>
            </tr>
          </thead>
          <tbody>
            {sortedDevices.map((device, index) => (
              <tr key={index}>
                <td>{device.pluginName}</td>
                <td>{device.type}</td>
                <td>{device.endpoint}</td>
                <td>{device.name}</td>
                <td>{device.cluster}</td>
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  );
}

export default Devices;
