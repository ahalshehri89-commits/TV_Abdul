#!/usr/bin/env node
/**
 * TV_Abdul: one-off catalog seed that needs no API key.
 *
 *   node scripts/catalog/seed-without-key.js <catalog.json>
 *
 * Reads the public playlists and videos pages of the approved owner channels
 * (channels.json) and merges the result into an existing catalog.json. It exists so the
 * Arabic shelves are not empty before a YOUTUBE_API_KEY is configured. It depends on
 * YouTube's page layout and can break without notice; the daily job uses the official API
 * (youtube.js) and replaces these entries channel by channel once a key is set.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MIN_VIDEO_SECONDS, NOT_A_PROGRAMME, classifyTitle, isUnlistedVideoTitle } from './youtube.js';

export { classifyTitle };

const here = path.dirname(fileURLToPath(import.meta.url));
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept-Language': 'ar,en;q=0.8',
  Cookie: 'CONSENT=YES+1; SOCS=CAI'
};
const MAX_PAGES = { playlists: 12, videos: 60 };
const MIN_PLAYLIST_ITEMS = 3;

/** "1:54:00" or "54:00" -> seconds */
export function parseClock(text) {
  const parts = String(text || '').trim().split(':').map(Number);
  if (parts.length < 2 || parts.some((n) => !isFinite(n))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** First run of digits in a badge such as "30 فيديو" -> 30 (Arabic-Indic digits included). */
export function parseCount(text) {
  const western = String(text || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const match = western.replace(/[,،.]/g, '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function collect(node, out) {
  if (Array.isArray(node)) {
    node.forEach((child) => collect(child, out));
  } else if (node && typeof node === 'object') {
    if (node.lockupViewModel) out.lockups.push(node.lockupViewModel);
    // Only a list's own "load more" marker counts; sort chips and section markers carry tokens too.
    const more = node.continuationItemRenderer;
    const token = more && more.continuationEndpoint && more.continuationEndpoint.continuationCommand && more.continuationEndpoint.continuationCommand.token;
    if (token) out.tokens.push(token);
    Object.values(node).forEach((child) => collect(child, out));
  }
}

function badgeTexts(lockup) {
  const texts = [];
  const walk = (node) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      if (node.thumbnailBadgeViewModel && node.thumbnailBadgeViewModel.text) texts.push(node.thumbnailBadgeViewModel.text);
      Object.values(node).forEach(walk);
    }
  };
  walk(lockup.contentImage);
  return texts;
}

/** Turn one page item into a catalog entry, or null when it should not be listed. */
export function lockupToItem(lockup, channel, tab) {
  const id = lockup.contentId;
  const title = lockup.metadata && lockup.metadata.lockupMetadataViewModel && lockup.metadata.lockupMetadataViewModel.title
    ? lockup.metadata.lockupMetadataViewModel.title.content
    : '';
  if (!id || !title || NOT_A_PROGRAMME.test(title)) return null;
  const badges = badgeTexts(lockup);

  if (tab === 'playlists') {
    if (!/^(PL|OLAK|UU|FL)/.test(id)) return null;
    const count = parseCount(badges[0]);
    if (count < MIN_PLAYLIST_ITEMS) return null;
    const firstVideo = (JSON.stringify(lockup.contentImage).match(/\/vi\/([\w-]{11})\//) || [])[1];
    return {
      id: `ytl-${id}`,
      category: classifyTitle(title, channel.playlists),
      title: title.trim(),
      count,
      channel: channel.name,
      poster: firstVideo ? `https://i.ytimg.com/vi/${firstVideo}/hqdefault.jpg` : '',
      youtubePlaylistId: id
    };
  }

  const duration = badges.map(parseClock).find((seconds) => seconds > 0) || 0;
  if (duration < MIN_VIDEO_SECONDS || !/^[\w-]{11}$/.test(id)) return null;
  if (isUnlistedVideoTitle(title, channel)) return null;
  return {
    id: `yt-${id}`,
    category: classifyTitle(title, channel.videos),
    title: title.trim(),
    duration,
    channel: channel.name,
    poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    youtubeId: id
  };
}

async function readTab(channel, tab) {
  const response = await fetch(`https://www.youtube.com/channel/${channel.id}/${tab}`, { headers: HEADERS, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  const dataMatch = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!dataMatch) throw new Error('page data not found');
  const apiKey = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
  const clientVersion = (html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/) || [])[1];

  const items = new Map();
  let page = { lockups: [], tokens: [] };
  collect(JSON.parse(dataMatch[1]), page);
  const seenTokens = new Set();

  for (let pageNumber = 0; pageNumber < MAX_PAGES[tab]; pageNumber++) {
    page.lockups.forEach((lockup) => {
      const item = lockupToItem(lockup, channel, tab);
      if (item && !items.has(item.id)) items.set(item.id, item);
    });
    // The item list's marker comes before any enclosing section's marker.
    const token = page.tokens.find((t) => !seenTokens.has(t));
    if (!token || !apiKey || page.lockups.length === 0) break;
    seenTokens.add(token);
    const next = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${apiKey}&prettyPrint=false`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion, hl: 'ar' } }, continuation: token }),
      signal: AbortSignal.timeout(30000)
    });
    if (!next.ok) break;
    page = { lockups: [], tokens: [] };
    collect(await next.json(), page);
  }
  return [...items.values()];
}

async function main() {
  const catalogPath = process.argv[2];
  if (!catalogPath || !fs.existsSync(catalogPath)) {
    console.error('usage: seed-without-key.js <existing catalog.json>');
    process.exit(1);
  }
  const channels = JSON.parse(fs.readFileSync(path.join(here, 'channels.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const seeded = [];
  const seededChannels = new Set();

  for (const channel of channels) {
    const found = [];
    for (const tab of ['playlists', 'videos']) {
      if (!channel[tab]) continue;
      try {
        const items = await readTab(channel, tab);
        found.push(...items);
        console.log(`[seed] ${channel.name} ${tab}: ${items.length}`);
      } catch (error) {
        console.log(`[seed] ${channel.name} ${tab}: FAILED ${error.message}`);
      }
    }
    if (found.length > 0) {
      seeded.push(...found);
      seededChannels.add(channel.name);
    }
  }

  // Replace the YouTube entries of channels that were read; keep everything else.
  const kept = catalog.items.filter((item) => !seededChannels.has(item.channel));
  const seen = new Set();
  const items = [...seeded, ...kept].filter((item) => (seen.has(item.id) ? false : seen.add(item.id)));
  fs.writeFileSync(catalogPath, JSON.stringify({ generatedAt: new Date().toISOString(), count: items.length, items }));
  console.log(`[seed] catalog now has ${items.length} titles (${seeded.length} from owner channels)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
