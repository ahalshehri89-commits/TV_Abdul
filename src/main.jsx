import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.jsx';
import './index.css';
import { startDebugBridge, isDebugBuild } from './services/debugBridge.js';
import { runDiagnostics, probeYouTubeEmbed, probeYouTubeBatch } from './services/diagnostics.js';
import { YT_WRAPPER_URL } from './config.js';

startDebugBridge();
if (isDebugBuild) {
  setTimeout(runDiagnostics, 3000);
  const probeId = import.meta.env.VITE_DEBUG_YT_PROBE;
  if (probeId) setTimeout(() => probeYouTubeEmbed(probeId), 6000);
  const batch = import.meta.env.VITE_DEBUG_YT_BATCH;
  if (batch) setTimeout(() => probeYouTubeBatch(YT_WRAPPER_URL, batch.split(',')), 6000);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
