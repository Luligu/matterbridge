/* eslint-disable no-console */
// App.js
import './App.css';
import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Home from './components/Home';
import Devices from './components/Devices';
import Settings from './components/Settings';
import Test from './components/Test';
import Logs from './components/Logs';
// import useWebSocket from './components/WebSocketUse';
import { WebSocketProvider } from './components/WebSocketContext';
import { OnlineProvider } from './components/OnlineContext';

export function sendCommandToMatterbridge(command, param, body) {
  const sanitizedParam = param.replace(/\\/g, '*');
  // console.log('sendCommandToMatterbridge:', command, param, sanitizedParam);
  // Send a POST request to the Matterbridge API
  fetch(`./api/command/${command}/${sanitizedParam}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .then(json => {
    // console.log('Command sent successfully:', json);
  })
  .catch(error => {
    console.error('Error sending command:', error);
  });
}

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
  // Settings
  const [wssHost, setWssHost] = useState(null);
  const [ssl, setSsl] = useState(false);
  
  useEffect(() => {
    const fetchApiSettings = async () => {
      try {
        const response = await fetch('./api/settings');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        // console.log('From app.js /api/settings:', data);
        setWssHost(data.wssHost);
        setSsl(data.ssl);
      } catch (error) {
        console.error('From app.js error fetching /api/settings:', error);
      }
    };

    fetchApiSettings();  
  }, []);
  
  const handleSubmit = event => {
    event.preventDefault();
    logIn(password);
  };

  const containerStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh', 
    backgroundColor: '#c4c2c2',
  };

  const formStyle = {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '400px',
    margin: '0 auto',
    padding: '20px',
    gap: '20px',
    border: '1px solid #ccc',
    borderRadius: '10px',
    boxShadow: '2px 2px 5px rgba(0,0,0,0.3)',
    backgroundColor: '#5f8c9e',
  };

  const inputStyle = {
    margin: '10px 0',
    padding: '3px 3px',
    fontSize: '14px',
    width: '230px',
  };

  const baseName = window.location.href.includes("/api/hassio_ingress/") ? window.location.pathname : "/";
  console.log(`Ingress check: window.location.href=${window.location.href} baseName=${baseName}`);
  // Ingress check: window.location.href=http://homeassistant.local:8123/api/hassio_ingress/nD0C1__RqgwrZT_UdHObtcPNN7fCFxCjlmPQfCzVKI8/ baseName=/api/hassio_ingress/nD0C1__RqgwrZT_UdHObtcPNN7fCFxCjlmPQfCzVKI8/

  if (loggedIn) {
    return (
      <WebSocketProvider wssHost={wssHost} ssl={ssl}>
        <OnlineProvider>
          <Router basename={baseName}>
            <div className="MbfScreen">
              <Header />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/devices" element={<Devices />} />
                <Route path="/log" element={<Logs />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/test" element={<Test />} />
                <Route path="*" element={<Navigate to="/" />} /> {/* Fallback to the home page for Ingress*/}
              </Routes>
            </div>
          </Router>
        </OnlineProvider>
      </WebSocketProvider>
    );
  } else {
    return (
      <div style={containerStyle}>
        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
            <img src="matterbridge 64x64.png" alt="Matterbridge Logo" style={{ height: '64px', width: '64px' }} />
            <h3>Welcome to Matterbridge</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="password"
            />
            <button type="submit">Log in</button>
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
  // Login
  const [noPassword, setNoPassword] = useState(false);

  // Settings
  const [wssHost, setWssHost] = useState(null);
  const [ssl, setSsl] = useState(false);

  const fetchApiLogin = async () => {
    try {
      const response = await fetch('./api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: '' }),
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      // console.log('From app.js /api/login:', data);
      if (data.valid === true) {
        setNoPassword(true);
      }
    } catch (error) {
      console.error('From app.js error fetching /api/login', error);
    }
  };

  useEffect(() => {
    const fetchLogin = async () => {
      try {
        await fetchApiLogin();
      } catch (error) {
        console.error('Error fetching API login:', error);
      }
    };
    fetchLogin();
  }, []);

  const fetchApiSettings = async () => {
    try {
      const response = await fetch('./api/settings');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      // console.log('From app.js /api/settings:', data);
      setWssHost(data.wssHost);
      setSsl(data.ssl);
    } catch (error) {
      console.error('From app.js error fetching /api/settings:', error);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        await fetchApiSettings();
      } catch (error) {
        console.error('Error fetching API settings:', error);
      }
    };
    fetchSettings();
  }, []);

  const baseName = window.location.href.includes("/api/hassio_ingress/") ? window.location.pathname : "/";
  console.log(`Ingress check: window.location.href=${window.location.href} baseName=${baseName}`);
  // Ingress check: window.location.href=http://homeassistant.local:8123/api/hassio_ingress/nD0C1__RqgwrZT_UdHObtcPNN7fCFxCjlmPQfCzVKI8/ baseName=/api/hassio_ingress/nD0C1__RqgwrZT_UdHObtcPNN7fCFxCjlmPQfCzVKI8/
  
  if (noPassword) {
    return (
      <WebSocketProvider wssHost={wssHost} ssl={ssl}>
        <OnlineProvider>
          <Router basename={baseName}>
            <div className="MbfScreen">
              <Header />
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/devices" element={<Devices />} />
                  <Route path="/log" element={<Logs />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/test" element={<Test />} />
                  <Route path="*" element={<Navigate to="/" />} /> {/* Fallback to the home page for Ingress*/}
                </Routes>
            </div>
          </Router>
        </OnlineProvider>
      </WebSocketProvider>
    );
  }
  else {
    return (
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );
  }
}

export default App;

/*
How frontend was created
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
