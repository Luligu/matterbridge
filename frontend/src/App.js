// App.js
import './App.css';
import React from 'react';
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

function App() {
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
}

export default App;
