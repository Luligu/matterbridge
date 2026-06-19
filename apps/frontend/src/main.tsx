// Global styles
// oxlint-disable-next-line import/no-unassigned-import
import './main.css';

// React
import React from 'react';
import ReactDOM from 'react-dom/client';

// Frontend app
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
