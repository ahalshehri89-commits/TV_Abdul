import { describe, it, expect } from 'vitest';
import { buildPlayerUrl } from '../src/components/YouTubePlayerView.jsx';
import { lockupToItem, classifyTitle, parseClock, parseCount } from '../scripts/catalog/seed-without-key.js';

describe('hosted player address', () => {
  const base = 'https://host/yt.html';

  it('plays the named video even when the title also lists a playlist', () => {
    expect(buildPlayerUrl(base, { youtubeId: 'abc', youtubePlaylistId: 'PL1' })).toBe('https://host/yt.html?v=abc');
  });

  it('plays a playlist from the remembered episode and position', () => {
    expect(buildPlayerUrl(base, { youtubePlaylistId: 'PL1' }, { index: 4, position: 61.7 })).toBe(
      'https://host/yt.html?list=PL1&index=4&start=61'
    );
    expect(buildPlayerUrl(base, { youtubePlaylistId: 'PL1' })).toBe('https://host/yt.html?list=PL1');
  });

  it('resumes a single video', () => {
    expect(buildPlayerUrl(base, { youtubeId: 'abc' }, { position: 300 })).toBe('https://host/yt.html?v=abc&start=300');
  });
});

describe('keyless catalog seed', () => {
  const channel = { name: 'Maspero Zaman', videos: 'plays', playlists: 'drama' };
  const lockup = (id, title, badge) => ({
    contentId: id,
    contentImage: { a: [{ thumbnailBadgeViewModel: { text: badge } }], src: 'https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg' },
    metadata: { lockupMetadataViewModel: { title: { content: title } } }
  });

  it('parses durations and counts, including Arabic digits', () => {
    expect(parseClock('1:54:00')).toBe(6840);
    expect(parseClock('54:00')).toBe(3240);
    expect(parseClock('LIVE')).toBe(0);
    expect(parseCount('30 فيديو')).toBe(30);
    expect(parseCount('٣٠ فيديو')).toBe(30);
  });

  it('files a title on a shelf by its wording', () => {
    expect(classifyTitle('مسرحية العيال كبرت', 'drama')).toBe('plays');
    expect(classifyTitle('فيلم باب الحديد', 'plays')).toBe('cinema');
    expect(classifyTitle('مسلسل ليالي الحلمية', 'plays')).toBe('drama');
    expect(classifyTitle('سهرة خاصة', 'plays')).toBe('plays');
  });

  it('keeps full-length videos and series playlists', () => {
    expect(lockupToItem(lockup('BBBBBBBBBBB', 'مسرحية ريا وسكينة', '2:10:00'), channel, 'videos')).toMatchObject({
      id: 'yt-BBBBBBBBBBB',
      category: 'plays',
      duration: 7800,
      youtubeId: 'BBBBBBBBBBB'
    });
    expect(lockupToItem(lockup('PLxyz', 'مسلسل رأفت الهجان', '15 فيديو'), channel, 'playlists')).toMatchObject({
      id: 'ytl-PLxyz',
      category: 'drama',
      count: 15,
      poster: 'https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg'
    });
  });

  it('drops promos, clips, single episodes, short videos and tiny playlists', () => {
    expect(lockupToItem(lockup('BBBBBBBBBBB', 'برومو مسلسل جديد', '45:00'), channel, 'videos')).toBeNull();
    expect(lockupToItem(lockup('BBBBBBBBBBB', 'مسلسل الأيام الحلقة 3', '45:00'), channel, 'videos')).toBeNull();
    expect(lockupToItem(lockup('BBBBBBBBBBB', 'ضحك للركب 😂 #مسرح', '25:00'), channel, 'videos')).toBeNull();
    expect(lockupToItem(lockup('BBBBBBBBBBB', 'مسرحية قصيرة', '9:00'), channel, 'videos')).toBeNull();
    expect(lockupToItem(lockup('PLxyz', 'مسلسل قصير', '2 فيديو'), channel, 'playlists')).toBeNull();
  });

  it('keeps documentary episodes, which stand on their own', () => {
    const docs = { name: 'DW', videos: 'documentary', playlists: null };
    expect(lockupToItem(lockup('BBBBBBBBBBB', 'رحلة النيل | الحلقة الثانية', '42:00'), docs, 'videos')).not.toBeNull();
  });
});
