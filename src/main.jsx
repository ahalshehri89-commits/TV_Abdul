import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.jsx';
import './index.css';
import { startDebugBridge, isDebugBuild } from './services/debugBridge.js';
import { runDiagnostics } from './services/diagnostics.js';

startDebugBridge();
if (isDebugBuild) {
  setTimeout(runDiagnostics, 3000);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
