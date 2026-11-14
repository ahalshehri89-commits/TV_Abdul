#!/usr/bin/env node
/**
 * TV_Abdul development aid: one-way log collector.
 *
 * Retail Samsung TVs do not reliably expose the web inspector. A debug build of the app
 * (built with VITE_DEBUG_HOST=<this-mac-ip>) POSTs its console output here. The server only
 * appends what it receives to a file; it never sends anything back to the TV.
 *
 *   node scripts/dev/tv-log-server.js <output-file>
 */
import http from 'http';
import fs from 'fs';

const PORT = 9333;
const outFile = process.argv[2] || 'tv-debug.log';

http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method !== 'POST' || req.url !== '/log') {
      res.end();
      return;
    }
    let body = '';
    req.on('data', (chunk) => {
      if (body.length < 20000) body += chunk;
    });
    req.on('end', () => {
      fs.appendFileSync(outFile, `${new Date().toISOString().slice(11, 19)} ${body}\n`);
      res.end('ok');
    });
  })
  .listen(PORT, '0.0.0.0', () => console.log(`TV log collector on :${PORT} -> ${outFile}`));
