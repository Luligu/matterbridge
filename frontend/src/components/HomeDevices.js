/* eslint-disable no-console */
// React
import React, { useContext, useEffect, useState } from 'react';
import { useTable, useSortBy } from 'react-table';

// @mui/material
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

// @mui/icons-material
import SettingsIcon from '@mui/icons-material/Settings';

// @mdi/js
import Icon from '@mdi/react';
import { mdiSortAscending, mdiSortDescending } from '@mdi/js';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
// import { debug } from '../App';
const debug = true;

const devicesColumns = [
  {
    Header: 'Plugin',
    accessor: 'pluginName',
  },
  {
    Header: 'Name',
    accessor: 'name',
  },
  {
    Header: 'Serial',
    accessor: 'serial',
  },
  {
    Header: 'Url',
    accessor: 'configUrl',
  },
  {
    Header: 'Config',
    accessor: 'configButton',
    noSort: true,
    Cell: ({ row }) => (
      row.original.configUrl ? (
      <IconButton
        onClick={() => window.open(row.original.configUrl, '_blank')}
        aria-label="Open config url"
        sx={{ margin: 0, padding: 0 }}
      >
        <SettingsIcon fontSize="small"/>
      </IconButton>
      ) : null
    ),
  },
];

export function HomeDevicesTable({ data, columnVisibility }) {
  // Filter columns based on visibility
  const visibleColumns = React.useMemo(
    () => devicesColumns.filter(column => columnVisibility[column.accessor]),
    [columnVisibility]
  );
  
  // React-Table
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({ columns: visibleColumns, data }, useSortBy);

  return (
    <table {...getTableProps()} style={{ border: 'none', borderCollapse: 'collapse' }}>
      <thead style={{ border: 'none', borderCollapse: 'collapse' }}>
        {headerGroups.map(headerGroup => (
          <tr {...headerGroup.getHeaderGroupProps()} style={{ border: 'none', borderCollapse: 'collapse' }}>
            {headerGroup.headers.map(column => (
              <th {...column.getHeaderProps(column.noSort ? undefined : column.getSortByToggleProps())} style={{ border: 'none', borderCollapse: 'collapse', cursor: column.noSort ? 'default' : 'pointer', }}>
                {column.render('Header')}
                {/* Add a sort direction indicator */}
                {!column.noSort && (
                  <span style={{ margin: '0px', marginLeft: '5px', padding: '0px' }}>
                    {column.isSorted
                      ? column.isSortedDesc
                        ? <Icon path={mdiSortDescending} size='15px'/>
                        : <Icon path={mdiSortAscending} size='15px'/>
                    : null}
                  </span>
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()} style={{ border: 'none', borderCollapse: 'collapse' }}>
        {rows.map((row, index) => {
          prepareRow(row);
          return (
            <tr 
              key={index} 
              className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'} 
              {...row.getRowProps()} style={{ border: 'none', borderCollapse: 'collapse' }}
            >
              {row.cells.map(cell => (
                <td {...cell.getCellProps()} style={{ border: 'none', borderCollapse: 'collapse' }}>{cell.render('Cell')}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function HomeDevices() {
  const { online, sendMessage, addListener, removeListener } = useContext(WebSocketContext);
  const [devices, setDevices] = useState([]);
  const [dialogDevicesOpen, setDialogDevicesOpen] = useState(false);
  const [devicesColumnVisibility, setDevicesColumnVisibility] = useState({
    pluginName: true,
    name: true,
    serial: true,
    configUrl: false,
    configButton: true,
  });

  // WebSocket message handler effect
  useEffect(() => {
    const handleWebSocketMessage = (msg) => {
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'refresh_required') {
          if(debug) console.log('HomeDevices received refresh_required');
          sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (msg.method === '/api/devices') {
          if(debug) console.log(`HomeDevices received ${msg.response.length} devices:`, msg.response);
          setDevices(msg.response);
        }
      }
    };

    addListener(handleWebSocketMessage);
    if(debug) console.log('HomeDevices added WebSocket listener');

    return () => {
      removeListener(handleWebSocketMessage);
      if(debug) console.log('HomeDevices removed WebSocket listener');
    };
  }, [addListener, removeListener, sendMessage]);
  
  // Send API requests when online
  useEffect(() => {
    if (online) {
      if(debug) console.log('Devices sending api requests');
      // sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
      // sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
    }
  }, [online, sendMessage]);

  const handleDialogDevicesToggle = () => {
    setDialogDevicesOpen(!dialogDevicesOpen);
  };

  const handleDevicesColumnVisibilityChange = (accessor) => {
    setDevicesColumnVisibility((prev) => {
      const newVisibility = {
        ...prev,
        [accessor]: !prev[accessor],
      };
      localStorage.setItem('homeDevicesColumnVisibility', JSON.stringify(newVisibility));
      return newVisibility;
    });
  };

  useEffect(() => {
    const storedVisibility = localStorage.getItem('homeDevicesColumnVisibility');
    if (storedVisibility) {
      setDevicesColumnVisibility(JSON.parse(storedVisibility));
    }
  }, []);

  if(debug) console.log('HomeDevices rendering...');
  if (!online) {
    return ( <Connecting /> );
  }
  return (
      <div className="MbfWindowDiv" style={{ margin: '0', padding: '0', gap: '0', width: '100%', flex: '1 1 auto', overflow: 'hidden' }}>

        {/* HomeDevices Configure Columns Dialog */}
        <Dialog open={dialogDevicesOpen} onClose={handleDialogDevicesToggle}>
          <DialogTitle>Configure Devices Columns</DialogTitle>
          <DialogContent>
            <FormGroup>
              {devicesColumns.map((column) => (
                <FormControlLabel
                  key={column.accessor}
                  control={
                    <Checkbox
                      disabled={['name', 'serial', 'configButton'].includes(column.accessor)}
                      checked={devicesColumnVisibility[column.accessor]}
                      onChange={() => handleDevicesColumnVisibilityChange(column.accessor)}
                    />
                  }
                  label={column.Header}
                />
              ))}
            </FormGroup>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogDevicesToggle}>Close</Button>
          </DialogActions>
        </Dialog>

        <div className="MbfWindowHeader">
          <div className="MbfWindowHeaderText" style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
            <p style={{margin: '0px', padding: '0px'}}>Devices</p>
            <IconButton onClick={handleDialogDevicesToggle} aria-label="Configure Columns" style={{margin: '0px', padding: '0px', width: '19px', height: '19px'}}>
              <Tooltip title="Configure columns">
                <SettingsIcon style={{ color: 'var(--header-text-color)', fontSize: '19px' }}/>
              </Tooltip>
            </IconButton>
          </div>
        </div>
        <div className="MbfWindowBodyColumn" style={{margin: '0px', padding: '0px', gap: '0', overflow: 'auto'}} >
          <HomeDevicesTable data={devices} columnVisibility={devicesColumnVisibility}/>
        </div>
      </div>

  );
}
