// React
import React from 'react';
import ReactDOM from 'react-dom/client';

// Frontend app
import App from './App';

// Global styles
import './main.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
