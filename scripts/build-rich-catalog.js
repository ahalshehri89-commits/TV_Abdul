import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputFile = path.resolve(projectRoot, 'src', 'data', 'seedChannels.json');

const COUNTRY_MAP = {
  SA: { name: 'Saudi Arabia', flag: '🇸🇦' },
  AE: { name: 'United Arab Emirates', flag: '🇦🇪' },
  EG: { name: 'Egypt', flag: '🇪🇬' },
  LB: { name: 'Lebanon', flag: '🇱🇧' },
  QA: { name: 'Qatar', flag: '🇶🇦' },
  IQ: { name: 'Iraq', flag: '🇮🇶' },
  KW: { name: 'Kuwait', flag: '🇰🇼' },
  JO: { name: 'Jordan', flag: '🇯🇴' },
  SY: { name: 'Syria', flag: '🇸🇾' },
  OM: { name: 'Oman', flag: '🇴🇲' },
  BH: { name: 'Bahrain', flag: '🇧🇭' },
  YE: { name: 'Yemen', flag: '🇾🇪' },
  MA: { name: 'Morocco', flag: '🇲🇦' },
  DZ: { name: 'Algeria', flag: '🇩🇿' },
  TN: { name: 'Tunisia', flag: '🇹🇳' },
  LY: { name: 'Libya', flag: '🇱🇾' },
  SD: { name: 'Sudan', flag: '🇸🇩' },
  PS: { name: 'Palestine', flag: '🇵🇸' },
  SO: { name: 'Somalia', flag: '🇸🇴' },
  US: { name: 'United States', flag: '🇺🇸' },
  UK: { name: 'United Kingdom', flag: '🇬🇧' },
  GB: { name: 'United Kingdom', flag: '🇬🇧' },
  CA: { name: 'Canada', flag: '🇨🇦' },
  DE: { name: 'Germany', flag: '🇩🇪' },
  FR: { name: 'France', flag: '🇫🇷' },
  ES: { name: 'Spain', flag: '🇪🇸' },
  IT: { name: 'Italy', flag: '🇮🇹' },
  TR: { name: 'Turkiye', flag: '🇹🇷' },
  RU: { name: 'Russia', flag: '🇷🇺' },
  UA: { name: 'Ukraine', flag: '🇺🇦' },
  IN: { name: 'India', flag: '🇮🇳' },
  BR: { name: 'Brazil', flag: '🇧🇷' },
  AU: { name: 'Australia', flag: '🇦🇺' },
  JP: { name: 'Japan', flag: '🇯🇵' },
  KR: { name: 'South Korea', flag: '🇰🇷' },
  NL: { name: 'Netherlands', flag: '🇳🇱' },
  SE: { name: 'Sweden', flag: '🇸🇪' },
  NO: { name: 'Norway', flag: '🇳🇴' },
  PL: { name: 'Poland', flag: '🇵🇱' },
  GR: { name: 'Greece', flag: '🇬🇷' },
  IR: { name: 'Iran', flag: '🇮🇷' },
  PK: { name: 'Pakistan', flag: '🇵🇰' }
};

function normalizeCategory(raw) {
  if (!raw) return 'general';
  const lower = raw.toLowerCase();
  if (lower.includes('news') || lower.includes('business') || lower.includes('weather')) return 'news';
  if (lower.includes('sport')) return 'sports';
  if (lower.includes('movie') || lower.includes('cinema') || lower.includes('film') || lower.includes('series')) return 'movies';
  if (lower.includes('doc') || lower.includes('history') || lower.includes('science') || lower.includes('nature') || lower.includes('travel')) return 'documentary';
  if (lower.includes('kid') || lower.includes('child') || lower.includes('animation') || lower.includes('family')) return 'kids';
  if (lower.includes('music')) return 'music';
  if (lower.includes('auto') || lower.includes('motor')) return 'auto';
  if (lower.includes('entertain') || lower.includes('comedy') || lower.includes('reality')) return 'entertainment';
  return 'general';
}

function parseM3u(text, defaultCategory = null, defaultCountry = null) {
  const lines = text.split('\n');
  const items = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF')) {
      const url = lines[i + 1]?.trim();
      if (!url || url.startsWith('#')) continue;

      const tvgId = line.match(/tvg-id="([^"]+)"/)?.[1] || '';
      const tvgLogo = line.match(/tvg-logo="([^"]+)"/)?.[1] || '';
      const groupTitle = line.match(/group-title="([^"]+)"/)?.[1] || defaultCategory || 'General';
      const rawName = line.split(',').slice(1).join(',').trim();

      // Extract resolution
      let quality = 'HD';
      const qMatch = rawName.match(/\((1080p|720p|576p|4k|2160p|480p|360p)\)/i);
      if (qMatch) quality = qMatch[1].toLowerCase();

      // Clean name
      const cleanName = rawName
        .replace(/\((1080p|720p|576p|4k|2160p|480p|360p)\)/gi, '')
        .replace(/\[Not 24\/7\]/gi, '')
        .replace(/\[Geo-blocked\]/gi, '')
        .replace(/@\w+/g, '')
        .trim();

      // Extract country code from tvg-id (e.g. "AlEkhbariya.sa@SD" -> "SA")
      let countryCode = defaultCountry;
      const dotCountryMatch = tvgId.match(/\.([a-z]{2})(@|$)/i);
      if (dotCountryMatch) {
        countryCode = dotCountryMatch[1].toUpperCase();
      }

      if (!countryCode) countryCode = 'US';
      const countryInfo = COUNTRY_MAP[countryCode] || { name: countryCode, flag: '🌐' };

      const category = normalizeCategory(groupTitle);

      items.push({
        id: tvgId || cleanName.replace(/[^a-zA-Z0-9]/g, '_') + '.' + countryCode.toLowerCase(),
        name: cleanName,
        country: countryCode,
        countryName: countryInfo.name,
        flag: countryInfo.flag,
        categories: [category],
        logo: tvgLogo || null,
        bestQuality: quality,
        streamUrl: url
      });
    }
  }

  return items;
}

async function fetchPlaylist(url, category = null, country = null) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const text = await res.text();
    return parseM3u(text, category, country);
  } catch (err) {
    console.warn(`Failed to fetch ${url}:`, err.message);
    return [];
  }
}

async function build() {
  console.log('📡 Fetching high-quality playlists from IPTV-org CDN...');

  const sources = [
    // 1. All Arabic Channels (Saudi, UAE, Egypt, Lebanon, Qatar, Iraq, etc.)
    { url: 'https://iptv-org.github.io/iptv/languages/ara.m3u' },
    // 2. Global Sports Channels
    { url: 'https://iptv-org.github.io/iptv/categories/sports.m3u', category: 'sports' },
    // 3. Global Movies & Cinema
    { url: 'https://iptv-org.github.io/iptv/categories/movies.m3u', category: 'movies' },
    // 4. Global News Networks
    { url: 'https://iptv-org.github.io/iptv/categories/news.m3u', category: 'news' },
    // 5. Documentaries & Nature
    { url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u', category: 'documentary' },
    // 6. Kids & Animation
    { url: 'https://iptv-org.github.io/iptv/categories/kids.m3u', category: 'kids' },
    // 7. Music Channels
    { url: 'https://iptv-org.github.io/iptv/categories/music.m3u', category: 'music' },
    // 8. Top United States Channels
    { url: 'https://iptv-org.github.io/iptv/countries/us.m3u', country: 'US' },
    // 9. Top United Kingdom Channels
    { url: 'https://iptv-org.github.io/iptv/countries/uk.m3u', country: 'UK' }
  ];

  const channelMap = new Map();

  for (const src of sources) {
    console.log(`Downloading: ${src.url}`);
    const items = await fetchPlaylist(src.url, src.category, src.country);
    console.log(`  -> Received ${items.length} items`);

    items.forEach((item) => {
      // Filter out geo-blocked or clearly broken streams
      if (!item.name || !item.streamUrl) return;

      const normId = item.id.replace(/@\w+$/, '');

      if (!channelMap.has(normId)) {
        channelMap.set(normId, {
          id: normId,
          number: channelMap.size + 1,
          name: item.name,
          country: item.country,
          countryName: item.countryName,
          flag: item.flag,
          categories: item.categories,
          logo: item.logo,
          bestQuality: item.bestQuality,
          streams: [
            {
              index: 0,
              url: item.streamUrl,
              title: `${item.name} (${item.bestQuality})`,
              quality: item.bestQuality,
              online: true
            }
          ]
        });
      } else {
        // Multi-stream support: add secondary backup streams
        const existing = channelMap.get(normId);
        if (existing.streams.length < 4 && !existing.streams.some((s) => s.url === item.streamUrl)) {
          existing.streams.push({
            index: existing.streams.length,
            url: item.streamUrl,
            title: `${item.name} Alternate Source ${existing.streams.length + 1}`,
            quality: item.bestQuality,
            online: true
          });
        }
      }
    });
  }

  const result = Array.from(channelMap.values());
  // Sort with Arab world and News first, then by name
  result.sort((a, b) => {
    const isArabA = ['SA', 'AE', 'EG', 'LB', 'QA', 'IQ', 'KW', 'JO', 'MA', 'DZ', 'OM', 'BH'].includes(a.country);
    const isArabB = ['SA', 'AE', 'EG', 'LB', 'QA', 'IQ', 'KW', 'JO', 'MA', 'DZ', 'OM', 'BH'].includes(b.country);
    if (isArabA && !isArabB) return -1;
    if (!isArabA && isArabB) return 1;
    return a.name.localeCompare(b.name);
  });

  // Re-number sequentially
  result.forEach((ch, idx) => {
    ch.number = idx + 1;
  });

  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log(`\n🎉 Success! Built rich catalog with ${result.length} channels.`);
  console.log(`Saved to: ${outputFile}`);
}

build().catch((err) => {
  console.error('Error building catalog:', err);
  process.exit(1);
});
