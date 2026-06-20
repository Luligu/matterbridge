// Global styles
// oxlint-disable-next-line import/no-unassigned-import
import './main.css';

// React
import React from 'react';
import ReactDOM from 'react-dom/client';

// Frontend app
import App from './App';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
