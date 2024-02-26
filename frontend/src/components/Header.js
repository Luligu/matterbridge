// Header.js
import React from 'react';
import { Link } from 'react-router-dom';

function Header() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '20px', marginLeft: 20 }}>
      <img src="matter.png" alt="Matter Logo" style={{ height: '30px' }} />
      <h2>Matterbridge</h2>
      <nav>
        <Link to="/" className="nav-link">Home</Link> | 
        <Link to="/devices" className="nav-link">Devices</Link> | 
        <Link to="/settings" className="nav-link">Settings</Link>
      </nav>
    </div>
  );
}

export default Header;
