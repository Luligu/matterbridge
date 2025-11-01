// React
import React, { useState } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router';

// @mui
import { ThemeProvider } from '@mui/material';
import { SnackbarProvider } from 'notistack';

// Frontend routes
import Home from './components/Home';
import Devices from './components/Devices';
import Logs from './components/Logs';
import Settings from './components/Settings';
import Test from './components/Test';

// Frontend components
import { WebSocketProvider } from './components/WebSocketProvider';
import { UiProvider } from './components/UiProvider';
import { createMuiTheme, getCssVariable } from './components/muiTheme';
import { MbfScreen } from './components/MbfScreen';

// App styles
import './App.css';

// Global debug flag
export let debug = false;
export const toggleDebug = () => {
  debug = !debug;
};
export const enableWindows = false;
export const enableMobile = false;
export let wssPassword: string | undefined = undefined;
export const setWssPassword = (password: string) => {
  wssPassword = password;
};
export let ingress = false;

export function LoginForm({ setLoggedIn }: { setLoggedIn: (value: boolean) => void }): React.JSX.Element {
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: 'var(--main-bg-color)',
  };
  const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '400px',
    margin: '0 auto',
    padding: '20px',
    gap: '20px',
    border: '1px solid var(--div-border-color)',
    borderRadius: 'var(--div-border-radius)',
    boxShadow: '2px 2px 5px var(--div-shadow-color)',
    color: 'var(--div-text-color)',
    backgroundColor: 'var(--div-bg-color)',
  };
  const inputStyle: React.CSSProperties = {
    margin: '10px 0',
    padding: '3px 3px',
    fontSize: '14px',
    width: '230px',
    border: '1px solid var(--main-label-color)',
    color: 'var(--div-text-color)',
    backgroundColor: 'var(--div-bg-color)',
  };

  const logIn = async (password: string) => {
    try {
      const response = await fetch('./api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        const { valid } = await response.json();
        if (valid) {
          setLoggedIn(true);
          if (password !== '') wssPassword = password;
        } else {
          if (password !== '') setErrorMessage('Incorrect password!');
        }
      } else {
        console.error('Failed to log in:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to log in:', error);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    logIn(password);
  };

  logIn(''); // Auto login if no password is required

  return (
    <div style={containerStyle}>
      <form onSubmit={handleSubmit} style={formStyle}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
          <img src='matterbridge.svg' alt='Matterbridge Logo' style={{ height: '64px', width: '64px' }} />
          <h3 style={{ color: 'var(--div-text-color)' }}>Welcome to Matterbridge</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
          <input type='text' name='username' autoComplete='username' style={{ display: 'none' }} tabIndex={-1} />
          <input type='password' value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder='password' autoComplete='current-password' />
          <button type='submit' style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', borderColor: 'var(--div-bg-color)' }}>
            Log in
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 0, height: '30px' }}>{errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}</div>
      </form>
    </div>
  );
}

function App(): React.JSX.Element {
  const [loggedIn, setLoggedIn] = useState(false);

  // Set the theme based on saved preference or default to dark
  const savedTheme = localStorage.getItem('frontendTheme') || 'dark';
  if (debug) console.log(`Setting frontend theme "%s"`, savedTheme);
  document.body.setAttribute('frontend-theme', savedTheme);
  const primaryColor = getCssVariable('--primary-color', '#1976d2');
  if (debug) console.log(`Primary color from CSS "%s"`, primaryColor);
  const theme = createMuiTheme(primaryColor);

  /*
    Normal:
    href="https://lucalaptop7/"
    pathname="/" 
    baseName="/"

    Ingress:
    href="https://homeassistant.local:8123/api/hassio_ingress/nUosAre79uLWGKNg-8fzaf1jh9JOlvVY1ExsRhG2RBA/"
    pathname="/api/hassio_ingress/nUosAre79uLWGKNg-8fzaf1jh9JOlvVY1ExsRhG2RBA/" 
    baseName="/api/hassio_ingress/nUosAre79uLWGKNg-8fzaf1jh9JOlvVY1ExsRhG2RBA/"
  */
  // Check if running in Home Assistant Ingress
  ingress = window.location.href.includes('/api/hassio_ingress/');
  // Set the base name for the BrowserRouter
  const baseName = window.location.pathname.includes('/matterbridge/') ? '/matterbridge' : window.location.href.includes('/api/hassio_ingress/') ? window.location.pathname : '/';
  if (debug) {
    console.log(`Loading App...`);
    console.log(`- with href = "${window.location.href}"`);
    console.log(`- pathname = "${window.location.pathname}"`);
    console.log(`- baseName = "${baseName}"`);
  }

  if (loggedIn) {
    return (
      <ThemeProvider theme={theme}>
        <SnackbarProvider dense maxSnack={10} preventDuplicate anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <UiProvider>
            <WebSocketProvider>
              <BrowserRouter basename={baseName}>
                <MbfScreen>
                  <Routes>
                    <Route path='/' element={<Home />} />
                    <Route path='/devices' element={<Devices />} />
                    <Route path='/log' element={<Logs />} />
                    <Route path='/settings' element={<Settings />} />
                    <Route path='/test' element={<Test />} />
                    <Route path='*' element={<Navigate to='/' />} />
                  </Routes>
                </MbfScreen>
              </BrowserRouter>
            </WebSocketProvider>
          </UiProvider>
        </SnackbarProvider>
      </ThemeProvider>
    );
  } else {
    return <LoginForm setLoggedIn={setLoggedIn} />;
  }
}

export default App;
