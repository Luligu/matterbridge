// App.js
import './App.css';
import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Home from './components/Home';
import Devices from './components/Devices';
import Settings from './components/Settings';
import Test from './components/Test';

/*
      <div style={{backgroundColor: 'lightgray'}} >
      <div className="main-background" style={{ flex: 1, flexBasis: 'auto', flexDirection: 'column', height: 'calc(100vh - 40px)', width: 'calc(100vw - 40px)', gap: '20px' , margin: '0', padding: '20px' }}>
*/
// Create a context for the authentication state
const AuthContext = createContext();

// Create a provider component for the authentication state
function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);

  const logIn = async password => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
  
      if (response.ok) {
        const { valid } = await response.json();
  
        if (valid) {
          setLoggedIn(true);
        } else {
          alert('Incorrect password.');
        }
      } else {
        console.error('Failed to log in:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to log in:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ loggedIn, logIn }}>
      {children}
    </AuthContext.Provider>
  );
}

// Create a component for the login form
function LoginForm() {
  const [password, setPassword] = useState('');
  const { loggedIn, logIn } = useContext(AuthContext);

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
    maxWidth: '300px',
    margin: '0 auto',
    padding: '20px',
    border: '1px solid #ccc',
    borderRadius: '10px',
    boxShadow: '2px 2px 5px rgba(0,0,0,0.3)',
    backgroundColor: '#5f8c9e',
  };

  const inputStyle = {
    margin: '10px 0',
    padding: '3px 3px',
    fontSize: '14px',
  };

  if (loggedIn) {
    return (
      <Router>
        <div className="main-background" style={{ display: 'flex', flex: 1, flexBasis: 'auto', flexDirection: 'column', height: 'calc(100vh - 40px)', width: 'calc(100vw - 40px)', gap: '20px' , margin: '0', padding: '20px' }}>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/test" element={<Test />} />
          </Routes>
        </div>
      </Router>
    );
  } else {
    return (
      <div style={containerStyle}>
        <form onSubmit={handleSubmit} style={formStyle}>
          <h3>Welcome to Matterbridge</h3>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
            placeholder="password"
          />
          <button type="submit">Log in</button>
        </form>
      </div>
    );
  }
}

function App() {
  const [noPassword, setNoPassword] = useState(false);

  useEffect(() => {
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '' }),
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('Network response was not ok');
      }
    })
    .then(data => {
      if (data.valid === true) {
        setNoPassword(true);
      }
    })
    .catch(error => console.error('Failed with no password', error));
  }, []);

  if (noPassword) return (
    <Router>
      <div className="main-background" style={{ display: 'flex', flex: 1, flexBasis: 'auto', flexDirection: 'column', height: 'calc(100vh - 40px)', width: 'calc(100vw - 40px)', gap: '20px' , margin: '0', padding: '20px' }}>
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/test" element={<Test />} />
        </Routes>
      </div>
    </Router>
    );
  else return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
  /*
  return (
    <Router>
      <div className="main-background" style={{ display: 'flex', flex: 1, flexBasis: 'auto', flexDirection: 'column', height: 'calc(100vh - 40px)', width: 'calc(100vw - 40px)', gap: '20px' , margin: '0', padding: '20px' }}>
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/test" element={<Test />} />
        </Routes>
      </div>
    </Router>
  );
  */
}

export default App;
