/**
 * TV_Abdul programme guide: XMLTV parsing and channel matching.
 */

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

export function decodeXml(text) {
  return String(text || '')
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m])
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

/** Parse an XMLTV time such as "20261112183000 +0300" into epoch seconds (NaN if invalid). */
export function parseXmltvTime(value) {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/.exec(String(value || '').trim());
  if (!match) return NaN;
  const [, y, mo, d, h, mi, s = '00', zone = '+0000'] = match;
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  const sign = zone[0] === '-' ? -1 : 1;
  const offsetMinutes = sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(3, 5)));
  return Math.floor(utc / 1000) - offsetMinutes * 60;
}

/**
 * Reduce a channel name to a comparable key: lower case, no quality or region tags,
 * no punctuation. "Al Arabiya HD" and "AlArabiya" give the same key.
 */
export function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\((?:[^)]*)\)|\[(?:[^\]]*)\]/g, ' ')
    .replace(/\b(uhd|fhd|hd|sd|4k|hevc|h265|1080p|720p|576p|480p|tv channel|channel)\b/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

/**
 * Parse XMLTV text.
 * @returns {{channels: Map<string, string[]>, programmes: Array<{channel, start, stop, title}>}}
 */
export function parseXmltv(xml) {
  const channels = new Map();
  const channelPattern = /<channel\s+id="([^"]*)"[^>]*>([\s\S]*?)<\/channel>/g;
  let match;
  while ((match = channelPattern.exec(xml))) {
    const names = [];
    const namePattern = /<display-name[^>]*>([\s\S]*?)<\/display-name>/g;
    let nameMatch;
    while ((nameMatch = namePattern.exec(match[2]))) names.push(decodeXml(nameMatch[1]).trim());
    channels.set(decodeXml(match[1]), names);
  }

  const programmes = [];
  const programmePattern = /<programme\s+([^>]*)>([\s\S]*?)<\/programme>/g;
  while ((match = programmePattern.exec(xml))) {
    const attrs = match[1];
    const start = parseXmltvTime((/start="([^"]*)"/.exec(attrs) || [])[1]);
    const stop = parseXmltvTime((/stop="([^"]*)"/.exec(attrs) || [])[1]);
    const channel = decodeXml((/channel="([^"]*)"/.exec(attrs) || [])[1]);
    const title = decodeXml((/<title[^>]*>([\s\S]*?)<\/title>/.exec(match[2]) || [])[1]).trim();
    if (!channel || !title || !isFinite(start) || !isFinite(stop) || stop <= start) continue;
    programmes.push({ channel, start, stop, title });
  }
  return { channels, programmes };
}

/**
 * Match guide channels to the app's channels by name.
 * A guide channel is only used when its normalised name equals an app channel's name or id stem;
 * near-misses are left out rather than risk showing another channel's schedule.
 * @param {Map<string, string[]>} guideChannels guide id -> display names
 * @param {Array<{id: string, name: string, regional?: boolean}>} appChannels (regional: from the feeds' own region)
 * @returns {Map<string, string>} guide id -> app channel id
 */
export function matchChannels(guideChannels, appChannels) {
  const byKey = new Map();
  const ambiguous = new Set();
  const register = (key, id) => {
    if (!key || key.length < 3) return;
    if (byKey.has(key) && byKey.get(key) !== id) ambiguous.add(key);
    else byKey.set(key, id);
  };
  // Regional channels are registered first so they win a shared name; channels from elsewhere
  // need a longer name to match, because short names ("CTV", "TRT") collide across countries.
  const ordered = [...appChannels].sort((a, b) => Number(Boolean(b.regional)) - Number(Boolean(a.regional)));
  ordered.forEach((channel) => {
    [normalizeName(channel.name), normalizeName(String(channel.id).split('.')[0])].forEach((key) => {
      if (!channel.regional && (key.length < 5 || byKey.has(key))) return;
      register(key, channel.id);
    });
  });

  const result = new Map();
  guideChannels.forEach((names, guideId) => {
    const keys = [...names.map(normalizeName), normalizeName(String(guideId).split('.')[0])];
    for (const key of keys) {
      if (byKey.has(key) && !ambiguous.has(key)) {
        result.set(guideId, byKey.get(key));
        break;
      }
    }
  });
  return result;
}

/**
 * Build the compact guide: app channel id -> [[start, stop, title], ...] within the window.
 */
export function buildGuide(parsedFeeds, appChannels, windowStart, windowEnd) {
  const guide = {};
  parsedFeeds.forEach(({ channels, programmes }) => {
    const mapping = matchChannels(channels, appChannels);
    programmes.forEach((programme) => {
      const appId = mapping.get(programme.channel);
      if (!appId || programme.stop <= windowStart || programme.start >= windowEnd) return;
      (guide[appId] = guide[appId] || []).push([programme.start, programme.stop, programme.title.slice(0, 120)]);
    });
  });
  Object.keys(guide).forEach((id) => {
    const seen = new Set();
    guide[id] = guide[id]
      .sort((a, b) => a[0] - b[0])
      .filter((row) => (seen.has(row[0]) ? false : seen.add(row[0])));
  });
  return guide;
}
