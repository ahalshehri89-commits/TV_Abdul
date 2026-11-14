/**
 * TV_Abdul catalog: public-domain world cinema from Internet Archive.
 * Each title becomes a direct video link that the TV plays in its own player.
 */

const SEARCH_URL = 'https://archive.org/advancedsearch.php';
const MIN_FEATURE_SECONDS = 40 * 60;
const MAX_FILE_BYTES = 6 * 1024 ** 3;
// The archive's film collections include old exploitation titles; keep the shelf family-safe.
const EXCLUDED_TITLE = /\b(sex|sexy|nude|nudist|naked|burlesque|striptease|stripper|erotic|porn|marihuana|marijuana|reefer|cocaine|narcotic|lust|orgy|vice|prostitut\w*|harlot|sinful)\b/i;

/** Parse an Internet Archive "length" value: seconds ("5712.4") or a clock ("1:35:12"). */
export function parseLength(value) {
  if (value === undefined || value === null || value === '') return 0;
  const text = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text));
  const parts = text.split(':').map(Number);
  if (parts.some((n) => !isFinite(n))) return 0;
  return Math.round(parts.reduce((total, part) => total * 60 + part, 0));
}

/**
 * Choose the file a TV can play from an item's file list: an H.264 MP4, preferring the
 * highest resolution that is not unreasonably large. Returns null when there is none.
 */
export function pickVideoFile(files) {
  const candidates = (files || []).filter((file) => {
    const name = String(file.name || '').toLowerCase();
    const format = String(file.format || '').toLowerCase();
    if (!name.endsWith('.mp4')) return false;
    if (!(format.includes('h.264') || format.includes('mpeg4'))) return false;
    return Number(file.size || 0) > 0 && Number(file.size) <= MAX_FILE_BYTES;
  });
  if (candidates.length === 0) return null;
  const score = (file) => {
    const isH264 = String(file.format || '').toLowerCase().includes('h.264') ? 1 : 0;
    return isH264 * 1e15 + Number(file.height || 0) * 1e10 + Number(file.size || 0);
  };
  return candidates.sort((a, b) => score(b) - score(a))[0];
}

/** Build a catalog entry, or null when the item is not a playable feature-length film. */
export function toArchiveItem(doc, files) {
  const file = pickVideoFile(files);
  if (!file) return null;
  const duration = parseLength(file.length);
  if (duration < MIN_FEATURE_SECONDS) return null;
  const title = Array.isArray(doc.title) ? doc.title[0] : doc.title;
  if (!title || EXCLUDED_TITLE.test(String(title))) return null;
  const year = Number(Array.isArray(doc.year) ? doc.year[0] : doc.year) || undefined;
  return {
    id: `ia-${doc.identifier}`,
    category: 'classics',
    title: String(title).trim(),
    year,
    duration,
    channel: 'Internet Archive',
    poster: `https://archive.org/services/img/${doc.identifier}`,
    url: `https://archive.org/download/${doc.identifier}/${encodeURIComponent(file.name)}`
  };
}

async function getJson(url, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
}

async function search(source) {
  const params = new URLSearchParams();
  params.set('q', `${source.query} AND mediatype:(movies)`);
  ['identifier', 'title', 'year', 'downloads'].forEach((field) => params.append('fl[]', field));
  params.append('sort[]', 'downloads desc');
  params.set('rows', String(source.rows || 100));
  params.set('output', 'json');
  const data = await getJson(`${SEARCH_URL}?${params}`);
  return data.response.docs;
}

/**
 * @param {Array<{query: string, rows?: number}>} sources
 * @returns {Promise<Array>} catalog entries, most-downloaded first within each source
 */
export async function buildArchiveCatalog(sources, log = console.log) {
  const docs = new Map();
  for (const source of sources) {
    try {
      const found = await search(source);
      found.forEach((doc) => docs.has(doc.identifier) || docs.set(doc.identifier, doc));
      log(`[archive] ${source.query}: ${found.length} items`);
    } catch (error) {
      log(`[archive] ${source.query}: FAILED ${error.message}`);
    }
  }

  const items = [];
  const queue = [...docs.values()];
  const worker = async () => {
    while (queue.length > 0) {
      const doc = queue.shift();
      try {
        const data = await getJson(`https://archive.org/metadata/${doc.identifier}/files`);
        const item = toArchiveItem(doc, data.result);
        if (item) items.push({ ...item, downloads: Number(doc.downloads) || 0 });
      } catch (error) {
        log(`[archive] ${doc.identifier}: skipped (${error.message})`);
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));

  // One entry per title: uploads of the same film are common, keep the most downloaded.
  const byTitle = new Map();
  items
    .sort((a, b) => b.downloads - a.downloads)
    .forEach((item) => {
      const key = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${item.year || ''}`;
      if (!byTitle.has(key)) byTitle.set(key, item);
    });
  return [...byTitle.values()].map(({ downloads, ...item }) => item);
}
