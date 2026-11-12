#!/usr/bin/env node
/**
 * TV_Abdul: build the on-demand catalog the TV downloads.
 *
 *   node scripts/catalog/build-catalog.js <output-dir> [previous-catalog.json]
 *
 * Sources: Internet Archive (no key needed) and the approved YouTube channels
 * (needs YOUTUBE_API_KEY). A source that fails or is not configured keeps its entries from
 * the previous catalog, so a bad day never empties the shelves.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildArchiveCatalog } from './archive.js';
import { buildYouTubeCatalog } from './youtube.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Merge fresh source results with the previous catalog. Exported for tests. */
export function mergeCatalog({ previous, archive, youtube, failedChannels = [] }) {
  const prev = Array.isArray(previous) ? previous : [];
  const isYouTube = (item) => Boolean(item.youtubeId || item.youtubePlaylistId);
  const failed = new Set(failedChannels);

  const archiveItems = archive && archive.length > 0 ? archive : prev.filter((item) => !isYouTube(item));
  let youtubeItems;
  if (!youtube) {
    youtubeItems = prev.filter(isYouTube);
  } else {
    // Channels that failed today keep yesterday's entries.
    youtubeItems = [...youtube, ...prev.filter((item) => isYouTube(item) && failed.has(item.channel))];
  }

  const seen = new Set();
  return [...youtubeItems, ...archiveItems].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

async function main() {
  const [, , outDir, previousPath] = process.argv;
  if (!outDir) {
    console.error('usage: build-catalog.js <output-dir> [previous-catalog.json]');
    process.exit(1);
  }
  let previous = [];
  if (previousPath && fs.existsSync(previousPath)) {
    try {
      previous = readJson(previousPath).items || [];
    } catch (e) {
      console.warn('previous catalog unreadable, starting fresh');
    }
  }

  const archive = await buildArchiveCatalog(readJson(path.join(here, 'archive-sources.json')));

  let youtube = null;
  let failedChannels = [];
  const key = process.env.YOUTUBE_API_KEY;
  if (key) {
    const result = await buildYouTubeCatalog(readJson(path.join(here, 'channels.json')), key);
    youtube = result.items;
    failedChannels = result.failedChannels;
  } else {
    console.log('[youtube] YOUTUBE_API_KEY not set: keeping previous YouTube entries');
  }

  const items = mergeCatalog({ previous, archive, youtube, failedChannels });
  if (items.length === 0) {
    console.error('catalog would be empty; not writing');
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const payload = { generatedAt: new Date().toISOString(), count: items.length, items };
  fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(payload));
  console.log(`catalog.json written: ${items.length} titles`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
