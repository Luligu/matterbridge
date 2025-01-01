// React
import React, { useContext, useEffect, useState } from 'react';
import { useTable, useSortBy } from 'react-table';

// Frontend
import { WebSocketContext, se } from './WebSocketProvider';
import { Connecting } from './Connecting';

function DeviceTable({ data }) {
  const columns = React.useMemo(() => [
    {
      Header: 'Plugin name',
      accessor: 'pluginName',
    },
    {
      Header: 'Device type',
      accessor: 'type',
    },
    {
      Header: 'Endpoint',
      accessor: 'endpoint',
    },
    {
      Header: 'Name',
      accessor: 'name',
    },
    {
      Header: 'Serial number',
      accessor: 'serial',
    },
    {
      Header: 'Unique ID',
      accessor: 'uniqueId',
    },
    {
      Header: 'Cluster',
      accessor: 'cluster',
    },
  ], []);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({ columns, data }, useSortBy);

  return (
    <table {...getTableProps()}>
      <thead>
        {headerGroups.map(headerGroup => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map(column => (
              <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                {column.render('Header')}
                {/* Add a sort direction indicator */}
                <span>
                  {column.isSorted
                    ? column.isSortedDesc
                      ? ' 🔽'
                      : ' 🔼'
                    : '🔽🔼'}
                </span>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row, index) => {
          prepareRow(row);
          return (
            <tr key={index} className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'} {...row.getRowProps()}>
              {row.cells.map(cell => (
                <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Test() {
  const { online, sendMessage, logMessage, setLogFilters, addListener, removeListener } = useContext(WebSocketContext);
  const [settings, setSettings] = useState({});
  const [plugins, setPlugins] = useState([]);
  const [devices, setDevices] = useState([]);

  const data = React.useMemo(() => [
    {
      pluginName: 'Hello 1',
      name: 'World 1',
    },
    {
      pluginName: 'React 2',
      name: 'Table 2',
    },
    {
      pluginName: 'React 3',
      name: 'Table 3',
    },
    {
      pluginName: 'React 4',
      name: 'Table 4',
    },
  ], []);

  const handleWebSocketMessage = (msg) => {
    console.log('Test received WebSocket Message:', msg);
    if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
      if (msg.method === 'refresh_required') {
        console.log('Test received refresh_required');
        sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
        sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
        sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
      }
      if (msg.method === '/api/settings') {
        console.log('Test received settings:', msg.response);
        setSettings(msg.response);
      }
      if (msg.method === '/api/plugins') {
        console.log('Test received plugins:', msg.response);
        setPlugins(msg.response);
      }
      if (msg.method === '/api/devices') {
        console.log('Test received devices:', msg.response);
        setDevices(msg.response);
      }
    }
  };

  useEffect(() => {
    addListener(handleWebSocketMessage);
    console.log('Test added WebSocket listener');
    return () => {
      removeListener(handleWebSocketMessage);
      console.log('Test removed WebSocket listener');
    };
  }, [addListener, removeListener]);

  useEffect(() => {
    console.log('Test sending api requests');
    sendMessage({ id: 345678, method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
    sendMessage({ id: 345678, method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
    sendMessage({ id: 345678, method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
  }, [online, sendMessage]);
  
  if (!online) {
    return ( <Connecting /> );
  }
  return (
    <div className="MbfPageDiv">
      <div className="MbfWindowBodyColumn" style={{ margin: '0', padding: '0', gap: '0' }}>
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText">Registered devices</p>
        </div>
        <DeviceTable data={devices} />
      </div>
    </div>
  );
}

export default Test;