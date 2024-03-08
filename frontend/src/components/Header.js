// Header.js
import React from 'react';
import { Link } from 'react-router-dom';

/*
    <div className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '20px', margin: '0', padding: '20px', height: '40px' }}>
*/

function Header() {
  return (
    <div className="header">
      <img src="favicon.ico" alt="Matter Logo" style={{ height: '30px' }} />
      <h2>Matterbridge</h2>
      <nav>
        <Link to="/" className="nav-link">Home</Link>
        <Link to="/devices" className="nav-link">Devices</Link>
        <Link to="/settings" className="nav-link">Settings</Link>
        <Link to="/test" className="nav-link">Test</Link>
      </nav>
    </div>
  );
}

export default Header;
