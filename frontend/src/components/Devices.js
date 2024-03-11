// Devices.js
import React, { useEffect, useState } from 'react';

function Devices() {
  const [devices, setDevices] = useState([]);
  const [sortColumn, setSortColumn] = useState(undefined);
  const [sortDirection, setSortDirection] = useState(undefined); // true for ascending, false for descending
  const [selectedRow, setSelectedRow] = useState(-1); // -1 no selection, 0 or greater for selected row
  const [selectedPluginName, setSelectedPluginName] = useState('none'); // -1 no selection, 0 or greater for selected row
  const [selectedDeviceEndpoint, setSelectedDeviceEndpoint] = useState('none'); // -1 no selection, 0 or greater for selected row
  const [clusters, setClusters] = useState([]);

  useEffect(() => {
    // Fetch Devices
    fetch('/api/devices')
      .then(response => response.json())
      .then(data => setDevices(data))
      .catch(error => console.error('Error fetching devices:', error));

  }, []);

  useEffect(() => {
    // Fetch Devices
    fetch(`/api/devices_clusters/${selectedPluginName}/${selectedDeviceEndpoint}`)
      .then(response => response.json())
      .then(data => setClusters(data))
      .catch(error => console.error('Error fetching devices_clusters:', error));

  }, [selectedDeviceEndpoint, selectedPluginName]);
  
  const handleSort = (column) => {
    if (sortColumn === column) {
      if(sortDirection===undefined) setSortDirection(true);
      if(sortDirection===true) setSortDirection(false);
      if(sortDirection===false) setSortColumn(undefined);
      if(sortDirection===false) setSortDirection(undefined);
      //setSortDirection(!sortDirection);
    } else {
      setSortColumn(column);
      setSortDirection(true);
    }
  };

  const handleSelect = (row) => {
    if (selectedRow === row) {
      setSelectedRow(-1);
      setSelectedPluginName('none');
      setSelectedDeviceEndpoint('none');
    } else {
      setSelectedRow(row);
      setSelectedPluginName(sortedDevices[row].pluginName);
      setSelectedDeviceEndpoint(sortedDevices[row].endpoint);
    }
    console.log('Selected row:', row);
    console.log('Selected plugin:', sortedDevices[row].pluginName);
    console.log('Selected endpoint:', sortedDevices[row].endpoint);
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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px - 40px)', width: 'calc(100vw - 40px)', gap: '20px', margin: '0px', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto', maxHeight: 'calc(50vh - 60px)', width: '100%', gap: '5px', overflow: 'auto', paddingBottom: '10px', paddingRight: '10px' }}>
        <table>
          <thead>
            <tr>
              <th className="table-header" colSpan="7">Registered devices</th>
            </tr>
            <tr>
            <th className="table-header" onClick={() => handleSort('pluginName')}>Plugin name {sortColumn === 'pluginName' ? (sortDirection ? ' 🔼' : ' 🔽') : ' 🔼🔽'}</th>
            <th className="table-header" onClick={() => handleSort('type')}>Device type {sortColumn === 'type' ? (sortDirection ? ' 🔼' : ' 🔽') : ' 🔼🔽'}</th>
            <th className="table-header" onClick={() => handleSort('endpoint')}>Endpoint {sortColumn === 'endpoint' ? (sortDirection ? ' 🔼' : ' 🔽') : ' 🔼🔽'}</th>
            <th className="table-header" onClick={() => handleSort('name')}>Name {sortColumn === 'name' ? (sortDirection ? ' 🔼' : ' 🔽') : ' 🔼🔽'}</th>
            <th className="table-header" onClick={() => handleSort('serial')}>Serial number {sortColumn === 'serial' ? (sortDirection ? ' 🔼' : ' 🔽') : ' 🔼🔽'}</th>
            <th className="table-header" onClick={() => handleSort('uniqueId')}>Unique ID {sortColumn === 'uniqueId' ? (sortDirection ? ' 🔼' : ' 🔽') : ' 🔼🔽'}</th>
            <th className="table-header" onClick={() => handleSort('cluster')}>Cluster {sortColumn === 'cluster' ? (sortDirection ? ' 🔼' : ' 🔽') : ' 🔼🔽'}</th>
            </tr>
          </thead>
          <tbody>
            {sortedDevices.map((device, index) => (
              <tr key={index} onClick={() => handleSelect(index)} className={selectedRow === index ? 'table-content-selected' : index % 2 === 0 ? 'table-content-even' : 'table-content-odd'}>
                <td className="table-content">{device.pluginName}</td>
                <td className="table-content">{device.type}</td>
                <td className="table-content">{device.endpoint}</td>
                <td className="table-content">{device.name}</td>
                <td className="table-content">{device.serial}</td>
                <td className="table-content">{device.uniqueId}</td>
                <td className="table-content">{device.cluster}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', width: '100%', gap: '5px', overflow: 'auto', paddingBottom: '10px', paddingRight: '10px' }}>
        <table>
          <thead>
            <tr>
              <th className="table-header" colSpan="2">{selectedRow>=0?'Cluster servers of '+sortedDevices[selectedRow].name:'(select a device)'}</th>
              <th className="table-header" colSpan="3">Attributes</th>
            </tr>
            <tr>
              <th className="table-header">Name</th>
              <th className="table-header">Id</th>
              <th className="table-header">Name</th>
              <th className="table-header">Id</th>
              <th className="table-header">Value</th>
            </tr>
          </thead>
          <tbody>
            {clusters.map((cluster, index) => (
              <tr key={index} className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'}>
                <td className="table-content">{cluster.clusterName}</td>
                <td className="table-content">{cluster.clusterId}</td>
                <td className="table-content">{cluster.attributeName}</td>
                <td className="table-content">{cluster.attributeId}</td>
                <td className="table-content">{cluster.attributeValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Devices;