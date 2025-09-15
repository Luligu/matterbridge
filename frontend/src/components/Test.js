/* eslint-disable no-console */

// React
import React, { useContext, useEffect, useState, useRef } from 'react';

// @mui/material
import { Button } from '@mui/material';

// @mui/icons-material

// @rjsf

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { UiContext } from './UiProvider';
import { Connecting } from './Connecting';
import { debug } from '../App';
// const debug = true;

function Test() {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);
  // Ui context
  const { showSnackbarMessage, closeSnackbarMessage } = useContext(UiContext);

  // Local states
  const [_settings, setSettings] = useState(null);
  const [_plugins, setPlugins] = useState([]);
  const [_devices, setDevices] = useState([]);
  const [_clusters, setClusters] = useState([]);
  const [_cpu, setCpu] = useState(null);
  const [_memory, setMemory] = useState(null);
  const [_uptime, setUptime] = useState(null);
  const uniqueId = useRef(null);

  if(!uniqueId.current) {
    uniqueId.current = getUniqueId();
    if(debug) console.log('Test uniqueId:', uniqueId);
  }

  useEffect(() => {
    if(debug) console.log('Test useEffect WebSocketMessage mounting');
    const handleWebSocketMessage = (msg) => {
      /* Test page WebSocketMessage listener */
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'restart_required') {
          if(debug) console.log('Test received restart_required');
          showSnackbarMessage('Restart required', 0);
        }
        if (msg.method === 'refresh_required') {
          if(debug) console.log('Test received refresh_required');
          showSnackbarMessage('Refresh required', 0);
          sendMessage({ id: uniqueId.current, method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ id: uniqueId.current, method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ id: uniqueId.current, method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (msg.method === 'memory_update') {
          if(debug) console.log('Test received memory_update', msg);
          // showSnackbarMessage('Test received memory_update');
          setMemory(msg.params);
        }
        if (msg.method === 'cpu_update') {
          if(debug) console.log('Test received cpu_update', msg);
          // showSnackbarMessage('Test received cpu_update');
          setCpu(msg.params);
        }
        if (msg.method === 'uptime_update') {
          if(debug) console.log('Test received uptime_update', msg);
          // showSnackbarMessage('Test received uptime_update');
          setUptime(msg.params);
        }
        if (msg.method === '/api/settings' && msg.response) {
          if(debug) console.log('Test received /api/settings:', msg.response);
          showSnackbarMessage('Test received /api/settings');
          setSettings(msg.response);
        }
        if (msg.method === '/api/plugins' && msg.response) {
          if(debug) console.log(`Test received ${msg.response.length} plugins:`, msg.response);
          showSnackbarMessage('Test received /api/plugins');
          setPlugins(msg.response);
        }
        if (msg.method === '/api/devices' && msg.response) {
          if(debug) console.log(`Test received ${msg.response.length} devices:`, msg.response);
          showSnackbarMessage('Test received /api/devices');
          setDevices(msg.response);
          for(let device of msg.response) {
            if(debug) console.log('Test sending /api/clusters for device:', device.pluginName, device.name, device.endpoint);
            sendMessage({ method: "/api/clusters", src: "Frontend", dst: "Matterbridge", params: { plugin: device.pluginName, endpoint: device.endpoint } });
          }
        }
        if (msg.method === '/api/clusters') {
          if(debug) console.log(`Test received ${msg.response.length} clusters for device ${msg.deviceName} endpoint ${msg.endpoint}:`, msg);
          showSnackbarMessage('Test received /api/clusters');
          setClusters(msg.response);
        }
      } else {
        if(debug) console.log('Test received WebSocketMessage:', msg.method, msg.src, msg.dst, msg.response);
      }
    };

    addListener(handleWebSocketMessage);
    if(debug) console.log('Test useEffect WebSocketMessage mounted');

    return () => {
      if(debug) console.log('Test useEffect WebSocketMessage unmounting');
      removeListener(handleWebSocketMessage);
      if(debug) console.log('Test useEffect WebSocketMessage unmounted');
    };
  }, [addListener, removeListener, sendMessage, showSnackbarMessage]);
  
  useEffect(() => {
    if(debug) console.log('Test useEffect online mounting');
    if(online) {
      if(debug) console.log('Test useEffect online received online');
      sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
      showSnackbarMessage('Test permanent message removal', 0);
      showSnackbarMessage('Test useEffect online received online (info)', 30, 'info');
      showSnackbarMessage('Test useEffect online received online (warning)', 30, 'warning');
      showSnackbarMessage('Test useEffect online received online (error)', 30, 'error');
      showSnackbarMessage('Test useEffect online received online (success)', 30, 'success');
    }
    if(debug) console.log('Test useEffect online mounted');

    return () => {
      if(debug) console.log('Test useEffect online unmounted');
    };
  }, [online, sendMessage, showSnackbarMessage]);
  
  if(debug) console.log('Test rendering...');
  if (!online) {
    return ( <Connecting /> );
  }
  return (
    <div className="MbfPageDiv" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>

        {/* First row: Header */}
        {/*
        <Paper sx={{ flex: 1, p: 2 }} elevation={3}>
          <Typography variant="h4" align="center">
            Matterbridge Dashboard
          </Typography>
        </Paper>
        */}
        {/* Second row: Three Papers for Memory, CPU, RSS */}
        {/*
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Paper sx={{ flex: 1, p: 2 }} elevation={3}>
            <Typography variant="h6" align="center">
              Memory
            </Typography>
          </Paper>
          <Paper sx={{ flex: 1, p: 2 }} elevation={3}>
            <Typography variant="h6" align="center">
              CPU
            </Typography>
          </Paper>
          <Paper sx={{ flex: 1, p: 2 }} elevation={3}>
            <Typography variant="h6" align="center">
              RSS
            </Typography>
          </Paper>
        </Box>
        */}

        <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '256px', width: '256px', margin: '10px' }}/>
        <p>Welcome to the Test page of the Matterbridge frontend</p>

        <Button variant="contained" color="primary" onClick={() => {
          if(debug) console.log('Test button clicked');
          showSnackbarMessage('Test button clicked');
          closeSnackbarMessage('Refresh required');
          closeSnackbarMessage('Restart required');
          closeSnackbarMessage('Test permanent message removal');
        }}>Test</Button>  

      </div>  
    </div>
  );
}

export default Test;

/*

import * as React from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';

const columns = [
  { id: 'name', label: 'Name', minWidth: 170 },
  { id: 'code', label: 'ISO\u00a0Code', minWidth: 100 },
  {
    id: 'population',
    label: 'Population',
    minWidth: 170,
    align: 'right',
    format: (value) => value.toLocaleString('en-US'),
  },
  {
    id: 'size',
    label: 'Size\u00a0(km\u00b2)',
    minWidth: 170,
    align: 'right',
    format: (value) => value.toLocaleString('en-US'),
  },
  {
    id: 'density',
    label: 'Density',
    minWidth: 170,
    align: 'right',
    hidden: true,
    format: (value) => value.toFixed(2),
  },
];

function createData(name, code, population, size) {
  const density = population / size;
  return { name, code, population, size, density };
}

const rows = [
  createData('India', 'IN', 1324171354, 3287263),
  createData('China', 'CN', 1403500365, 9596961),
  createData('Italy', 'IT', 60483973, 301340),
  createData('United States', 'US', 327167434, 9833520),
  createData('Canada', 'CA', 37602103, 9984670),
  createData('Australia', 'AU', 25475400, 7692024),
  createData('Germany', 'DE', 83019200, 357578),
  createData('Ireland', 'IE', 4857000, 70273),
  createData('Mexico', 'MX', 126577691, 1972550),
  createData('Japan', 'JP', 126317000, 377973),
  createData('France', 'FR', 67022000, 640679),
  createData('United Kingdom', 'GB', 67545757, 242495),
  createData('Russia', 'RU', 146793744, 17098246),
  createData('Nigeria', 'NG', 200962417, 923768),
  createData('Brazil', 'BR', 210147125, 8515767),
];

export default function StickyHeadTable() {
  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      <TableContainer sx={{ maxHeight: 440 }}>
        <Table stickyHeader aria-label="sticky table">
          <TableHead>
            <TableRow>
              {columns.map((column) => {
                if (column.hidden) return;
                return (
                  <TableCell
                    key={column.id}
                    align={column.align}
                    style={{ minWidth: column.minWidth }}
                  >
                    {column.label}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              return (
                <TableRow hover role="checkbox" tabIndex={-1} key={row.code}>
                  {columns.map((column) => {
                    if(column.hidden) return;
                    const value = row[column.id];
                    return (
                      <TableCell key={column.id} align={column.align}>
                        {column.format && typeof value === 'number'
                          ? column.format(value)
                          : value}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

*/