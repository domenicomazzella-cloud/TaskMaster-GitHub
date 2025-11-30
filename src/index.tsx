import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Assicurati che index.css esista in src/
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);