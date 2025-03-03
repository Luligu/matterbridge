/* eslint-disable no-console */

import './App.css';

// React
import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';

// @mui
import { ThemeProvider } from '@mui/material';
import { SnackbarProvider } from 'notistack';

// Frontend
import Header from './components/Header';
import Home from './components/Home';
import Devices from './components/Devices';
import Settings from './components/Settings';
import Test from './components/Test';
import Logs from './components/Logs';
import { WebSocketProvider } from './components/WebSocketProvider';
import { UiProvider } from './components/UiProvider';
import { createMuiTheme, getCssVariable } from './components/muiTheme';

export const debug = false;

// Create a context for the authentication state
const AuthContext = createContext();

// Create a provider component for the authentication state
function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const logIn = async password => {
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
        } else {
          if(password!=='')
            setErrorMessage('Incorrect password!');
        }
      } else {
        console.error('Failed to log in:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to log in:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ loggedIn, logIn, errorMessage }}>
      {children}
    </AuthContext.Provider>
  );
}

// Create a component for the login form
function LoginForm() {
  const [password, setPassword] = useState('');
  const { loggedIn, logIn, errorMessage  } = useContext(AuthContext);
  const [primaryColor, setPrimaryColor] = useState('#1976d2'); // Default blue

  const handleSubmit = event => {
    event.preventDefault();
    logIn(password);
  };

  const containerStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh', 
    backgroundColor: 'var(--main-bg-color)',
  };

  const formStyle = {
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

  const inputStyle = {
    margin: '10px 0',
    padding: '3px 3px',
    fontSize: '14px',
    width: '230px',
    border: '1px solid var(--main-label-color)',
    color: 'var(--div-text-color)',
    backgroundColor: 'var(--div-bg-color)',
  };
  
  // Set the frontned theme in document.body
  useEffect(() => {
    if(debug) console.log('Setting frontend theme');
    const savedTheme = localStorage.getItem('frontendTheme');
    if(debug)  console.log('Saved theme:', savedTheme);
    if (savedTheme) {
      document.body.setAttribute("frontend-theme", savedTheme); // Set the saved theme
    } else {
      document.body.setAttribute("frontend-theme", "dark"); // Set the default theme to dark
    }
    const primaryColorFromCSS = getCssVariable('--primary-color', '#1976d2');
    if(debug)  console.log('Primary color from CSS:', primaryColorFromCSS);
    setPrimaryColor(primaryColorFromCSS);
  }, []);

  const baseName = window.location.href.includes("/matterbridge/") ? "/matterbridge" :
  window.location.href.includes("/api/hassio_ingress/") ? window.location.pathname :
  "/";
  console.log(`Loading App.js: href="${window.location.href}" pathname="${window.location.pathname}" baseName="${baseName}"`);
  // console.log(`Ingress check: window.location.href=${window.location.href} baseName=${baseName}`);
  // Ingress check: window.location.href=http://homeassistant.local:8123/api/hassio_ingress/nD0C1__RqgwrZT_UdHObtcPNN7fCFxCjlmPQfCzVKI8/ baseName=/api/hassio_ingress/nD0C1__RqgwrZT_UdHObtcPNN7fCFxCjlmPQfCzVKI8/

  const theme = createMuiTheme(primaryColor);

  logIn(''); // Auto login if no password is required

  if (loggedIn) {
    return (
      <ThemeProvider theme={theme}>
        <SnackbarProvider maxSnack={10} preventDuplicate anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <UiProvider>
            <WebSocketProvider>
              <Router basename={baseName}>
                <div className="MbfScreen">
                  <Header />
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/devices" element={<Devices />} />
                    <Route path="/log" element={<Logs />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/test" element={<Test />} />
                    <Route path="*" element={<Navigate to="/" />} /> 
                  </Routes>
                </div>
              </Router>
            </WebSocketProvider>
          </UiProvider>
        </SnackbarProvider>
      </ThemeProvider>
    );
  } else {
    return (
      <div style={containerStyle}>
        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
            <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '64px', width: '64px' }} />
            <h3 style={{color: 'var(--div-text-color)' }}>Welcome to Matterbridge</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="password"
              autocomplete="current-password"
            />
            <button type="submit" style={{ color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', borderColor: 'var(--div-bg-color)' }}>Log in</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 0, height: '30px' }}>
            {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
          </div>
        </form>
      </div>
    );
  }
}

function App() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}

export default App;

/*
How the frontend was created
npx create-react-app matterbridge-frontend
cd matterbridge-frontend
npm install react-router-dom 

Success! Created frontend at C:\Users\lligu\OneDrive\GitHub\matterbridge\frontend
Inside that directory, you can run several commands:

  npm start
    Starts the development server.

  npm run build
    Bundles the app into static files for production.

  npm test
    Starts the test runner.

  npm run eject
    Removes this tool and copies build dependencies, configuration files
    and scripts into the app directory. If you do this, you can’t go back!

We suggest that you begin by typing:

  cd frontend
  npm start

Happy hacking!
PS C:\Users\lligu\OneDrive\GitHub\matterbridge> cd frontend
PS C:\Users\lligu\OneDrive\GitHub\matterbridge\frontend> npm run build

> frontend@0.1.0 build
> react-scripts build

Creating an optimized production build...
One of your dependencies, babel-preset-react-app, is importing the
"@babel/plugin-proposal-private-property-in-object" package without
declaring it in its dependencies. This is currently working because
"@babel/plugin-proposal-private-property-in-object" is already in your
node_modules folder for unrelated reasons, but it may break at any time.

babel-preset-react-app is part of the create-react-app project, which
is not maintianed anymore. It is thus unlikely that this bug will
ever be fixed. Add "@babel/plugin-proposal-private-property-in-object" to
your devDependencies to work around this error. This will make this message
go away.

Compiled successfully.

File sizes after gzip:

  46.65 kB  build\static\js\main.9b7ec296.js
  1.77 kB   build\static\js\453.8ab44547.chunk.js
  513 B     build\static\css\main.f855e6bc.css

The project was built assuming it is hosted at /.
You can control this with the homepage field in your package.json.

The build folder is ready to be deployed.
You may serve it with a static server:

  npm install -g serve
  serve -s build

Find out more about deployment here:

  https://cra.link/deployment

PS C:\Users\lligu\OneDrive\GitHub\matterbridge\frontend> 

npm install @mui/material @emotion/react @emotion/styled @mui/icons-material
npm install @rjsf/core @rjsf/utils @rjsf/validator-ajv8 @rjsf/mui
*/
