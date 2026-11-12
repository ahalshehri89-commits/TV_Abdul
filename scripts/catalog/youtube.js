/**
 * TV_Abdul catalog: full-length videos and playlists from approved YouTube owner channels,
 * read through the official YouTube Data API (needs YOUTUBE_API_KEY).
 *
 * Per channel (see channels.json):
 *   "videos":    category for its long uploads, or null to skip them
 *   "playlists": category for its playlists (kept whole as series), or null to skip them
 */

const API = 'https://www.googleapis.com/youtube/v3';
export const MIN_VIDEO_SECONDS = 20 * 60;
const MAX_VIDEO_SECONDS = 6 * 60 * 60;
const MIN_PLAYLIST_ITEMS = 3;
const MAX_UPLOAD_PAGES = 60; // newest 3,000 uploads per channel
const MAX_PLAYLIST_PAGES = 10; // 500 playlists per channel

// Playlists and videos that are not programmes: promos, clips, songs, interviews.
export const NOT_A_PROGRAMME = /بث مباشر|برومو|بروموهات|إعلان|اعلان|تريلر|كواليس|تتر|أغنية|اغنية|أغاني|اغاني|كليب|لقاء|مقطع|مقاطع|مشهد|مشاهد|ملخص|قريبا|قريباً|شورت|promo|trailer|teaser|shorts?\b|clip|behind the scenes|\bsong\b|highlights?/i;
export const EPISODE = /الحلقة|حلقة|\bepisode\b|\bep\.?\s*\d/i;

/**
 * Shelf for a title, from the words in it; falls back to the channel's default shelf.
 * Archive channels mix plays, films and series, so the channel alone is not enough.
 */
export function classifyTitle(title, fallback) {
  if (/مسرحي/.test(title)) return 'plays';
  if (/وثائقي/.test(title)) return 'documentary';
  if (/مسلسل|مسلسلات|سلسلة/.test(title)) return 'drama';
  if (/فيلم|الفيلم|أفلام|افلام|\bmovie\b|\bfilm\b/i.test(title)) return 'cinema';
  return fallback;
}

/**
 * True for a single upload that should not be listed by itself: a promo or clip, or one
 * episode of a series (the series playlist carries it). Documentary episodes stand alone.
 */
export function isUnlistedVideoTitle(title, channel) {
  if (NOT_A_PROGRAMME.test(title)) return true;
  return channel.videos !== 'documentary' && (EPISODE.test(title) || title.includes('#'));
}

/** Parse an ISO-8601 duration such as "PT1H32M5S" into seconds. */
export function parseIsoDuration(value) {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value || '');
  if (!match) return 0;
  const [, d, h, m, s] = match.map((part) => Number(part) || 0);
  return d * 86400 + h * 3600 + m * 60 + s;
}

function bestThumbnail(thumbnails) {
  const t = thumbnails || {};
  return (t.high || t.medium || t.standard || t.default || {}).url || '';
}

/** Catalog entry for a video, or null if it is short, private, or cannot be embedded. */
export function toVideoItem(video, channel) {
  const duration = parseIsoDuration(video.contentDetails && video.contentDetails.duration);
  // Under 20 minutes is a clip; over 6 hours is a recorded live stream, not a programme.
  if (duration < MIN_VIDEO_SECONDS || duration > MAX_VIDEO_SECONDS) return null;
  const status = video.status || {};
  if (status.privacyStatus && status.privacyStatus !== 'public') return null;
  if (status.embeddable === false) return null;
  if (video.snippet && video.snippet.liveBroadcastContent && video.snippet.liveBroadcastContent !== 'none') return null;
  if (isUnlistedVideoTitle(video.snippet.title, channel)) return null;
  return {
    id: `yt-${video.id}`,
    category: classifyTitle(video.snippet.title, channel.videos),
    title: video.snippet.title,
    duration,
    channel: channel.name,
    poster: bestThumbnail(video.snippet.thumbnails),
    youtubeId: video.id
  };
}

/** Catalog entry for a playlist, or null if it is too small to be a series. */
export function toPlaylistItem(playlist, channel) {
  const count = (playlist.contentDetails && playlist.contentDetails.itemCount) || 0;
  if (count < MIN_PLAYLIST_ITEMS) return null;
  if (playlist.status && playlist.status.privacyStatus && playlist.status.privacyStatus !== 'public') return null;
  if (NOT_A_PROGRAMME.test(playlist.snippet.title)) return null;
  return {
    id: `ytl-${playlist.id}`,
    category: classifyTitle(playlist.snippet.title, channel.playlists),
    title: playlist.snippet.title,
    count,
    channel: channel.name,
    poster: bestThumbnail(playlist.snippet.thumbnails),
    youtubePlaylistId: playlist.id
  };
}

async function api(path, params, key) {
  const query = new URLSearchParams({ ...params, key });
  const response = await fetch(`${API}/${path}?${query}`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`YouTube API ${path} HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
  return response.json();
}

async function listPlaylists(channel, key) {
  const items = [];
  let pageToken;
  for (let page = 0; page < MAX_PLAYLIST_PAGES; page++) {
    const data = await api(
      'playlists',
      { part: 'snippet,contentDetails,status', channelId: channel.id, maxResults: '50', ...(pageToken ? { pageToken } : {}) },
      key
    );
    data.items.forEach((playlist) => {
      const item = toPlaylistItem(playlist, channel);
      if (item) items.push(item);
    });
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return items;
}

async function listLongVideos(channel, key) {
  const uploadsId = `UU${channel.id.slice(2)}`;
  const videoIds = [];
  let pageToken;
  for (let page = 0; page < MAX_UPLOAD_PAGES; page++) {
    const data = await api(
      'playlistItems',
      { part: 'contentDetails', playlistId: uploadsId, maxResults: '50', ...(pageToken ? { pageToken } : {}) },
      key
    );
    data.items.forEach((entry) => videoIds.push(entry.contentDetails.videoId));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  const items = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const data = await api(
      'videos',
      { part: 'snippet,contentDetails,status', id: videoIds.slice(i, i + 50).join(','), maxResults: '50' },
      key
    );
    data.items.forEach((video) => {
      const item = toVideoItem(video, channel);
      if (item) items.push(item);
    });
  }
  return items;
}

/**
 * @returns {Promise<{items: Array, failedChannels: string[]}>}
 */
export async function buildYouTubeCatalog(channels, key, log = console.log) {
  const items = [];
  const failedChannels = [];
  for (const channel of channels) {
    try {
      const playlists = channel.playlists ? await listPlaylists(channel, key) : [];
      const videos = channel.videos ? await listLongVideos(channel, key) : [];
      items.push(...playlists, ...videos);
      log(`[youtube] ${channel.name}: ${playlists.length} playlists, ${videos.length} long videos`);
    } catch (error) {
      failedChannels.push(channel.name);
      log(`[youtube] ${channel.name}: FAILED ${error.message}`);
    }
  }
  return { items, failedChannels };
}
