#!/usr/bin/env node
/**
 * TV_Abdul: build the compact programme guide the TV downloads.
 *
 *   node scripts/epg/build-epg.js <output-dir>
 *
 * Downloads the public XMLTV feeds listed in feeds.json, keeps the next 36 hours for
 * channels that match the app's channel list by name, and writes epg.json.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { parseXmltv, buildGuide } from './xmltv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const WINDOW_HOURS = 36;
// The feeds cover the Arab region; channels from these countries match by name without restriction.
const REGION = new Set(['SA', 'AE', 'EG', 'LB', 'QA', 'KW', 'OM', 'BH', 'JO', 'IQ', 'SY', 'PS', 'YE', 'MA', 'DZ', 'TN', 'SD', 'LY']);

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;
  return (isGzip ? zlib.gunzipSync(buffer) : buffer).toString('utf8');
}

async function main() {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error('usage: build-epg.js <output-dir>');
    process.exit(1);
  }
  const feeds = JSON.parse(fs.readFileSync(path.join(here, 'feeds.json'), 'utf8'));
  const appChannels = [
    ...JSON.parse(fs.readFileSync(path.join(root, 'src/data/seedChannels.json'), 'utf8')),
    ...JSON.parse(fs.readFileSync(path.join(root, 'src/data/fastChannels.json'), 'utf8'))
  ].map((channel) => ({ id: channel.id, name: channel.name, regional: REGION.has(channel.country) }));

  const parsed = [];
  for (const url of feeds) {
    try {
      const feed = parseXmltv(await download(url));
      parsed.push(feed);
      console.log(`[epg] ${url}: ${feed.channels.size} channels, ${feed.programmes.length} programmes`);
    } catch (error) {
      console.log(`[epg] ${url}: FAILED ${error.message}`);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const guide = buildGuide(parsed, appChannels, now - 3 * 3600, now + WINDOW_HOURS * 3600);
  const channelCount = Object.keys(guide).length;
  if (channelCount === 0) {
    console.error('[epg] no channels matched; keeping the previously published guide');
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'epg.json'), JSON.stringify({ generatedAt: new Date().toISOString(), channels: guide }));
  console.log(`[epg] epg.json written: ${channelCount} channels`);
  console.log(`[epg] matched: ${Object.keys(guide).sort().join(', ')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
