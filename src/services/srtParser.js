/**
 * TV_Abdul: SubRip (.srt) subtitle parsing.
 * Decodes subtitle bytes (UTF-8, UTF-16 or the Windows-1256 Arabic code page) and
 * turns them into time-ordered cues.
 */

function tryDecode(bytes, encoding, fatal) {
  try {
    return new TextDecoder(encoding, { fatal }).decode(bytes);
  } catch (e) {
    return null;
  }
}

/**
 * Decode raw subtitle file bytes into text.
 * Arabic subtitles are frequently saved as Windows-1256 rather than UTF-8, so a file that
 * is not valid UTF-8 is read as Windows-1256.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function decodeSubtitleBytes(bytes) {
  if (!bytes || bytes.length === 0) return '';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return tryDecode(bytes, 'utf-16le', false) || '';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return tryDecode(bytes, 'utf-16be', false) || '';
  const utf8 = tryDecode(bytes, 'utf-8', true);
  if (utf8 !== null) return utf8.replace(/^﻿/, '');
  return tryDecode(bytes, 'windows-1256', false) || tryDecode(bytes, 'iso-8859-1', false) || '';
}

function parseTimestamp(value) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!match) return null;
  const [, h, m, s, ms] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000;
}

/**
 * Parse SubRip text into cues sorted by start time.
 * @param {string} text
 * @returns {Array<{start: number, end: number, text: string}>} times in seconds
 */
export function parseSrt(text) {
  if (!text) return [];
  const cues = [];
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n{2,}/);

  blocks.forEach((block) => {
    const lines = block.split('\n').filter((line) => line.trim() !== '');
    const timeLineIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeLineIndex === -1) return;

    const [startRaw, endRaw] = lines[timeLineIndex].split('-->');
    const start = parseTimestamp(startRaw);
    // The end timestamp may be followed by position settings ("X1:... Y1:...").
    const end = parseTimestamp((endRaw || '').trim().split(/\s+/)[0] || '');
    if (start === null || end === null) return;

    const body = lines
      .slice(timeLineIndex + 1)
      .join('\n')
      .replace(/\{\\[^}]*\}/g, '')
      .replace(/<\/?[^>]+>/g, '')
      .trim();
    if (body) cues.push({ start, end, text: body });
  });

  return cues.sort((a, b) => a.start - b.start);
}

/**
 * Find the cue that should be on screen at the given time, or null.
 * @param {Array<{start: number, end: number, text: string}>} cues sorted by start
 * @param {number} time seconds
 */
export function findCue(cues, time) {
  if (!cues || cues.length === 0) return null;
  let low = 0;
  let high = cues.length - 1;
  let candidate = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].start <= time) {
      candidate = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (candidate === -1) return null;
  const cue = cues[candidate];
  return time < cue.end ? cue : null;
}
