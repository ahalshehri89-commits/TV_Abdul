import { describe, it, expect } from 'vitest';
import { decodeSubtitleBytes, parseSrt, findCue } from '../src/services/srtParser.js';

const SAMPLE = `1
00:00:01,000 --> 00:00:03,500
<i>Hello</i> there

2
00:00:05,000 --> 00:00:07,250 X1:10 Y1:20
{\\an8}مرحبا بالعالم
second line

3
00:01:00,5 --> 00:01:02,000
Late cue
`;

describe('srtParser', () => {
  it('parses cues, strips markup and keeps multi-line text', () => {
    const cues = parseSrt(SAMPLE);
    expect(cues).toHaveLength(3);
    expect(cues[0]).toEqual({ start: 1, end: 3.5, text: 'Hello there' });
    expect(cues[1].text).toBe('مرحبا بالعالم\nsecond line');
    expect(cues[1].end).toBe(7.25);
    expect(cues[2].start).toBe(60.5);
  });

  it('handles Windows line endings and missing index lines', () => {
    const cues = parseSrt('00:00:02,000 --> 00:00:04,000\r\nNo index\r\n\r\n2\r\n00:00:06,000 --> 00:00:08,000\r\nSecond\r\n');
    expect(cues.map((c) => c.text)).toEqual(['No index', 'Second']);
  });

  it('returns no cues for empty or malformed input', () => {
    expect(parseSrt('')).toEqual([]);
    expect(parseSrt('just some text\nwithout timing')).toEqual([]);
  });

  it('finds the cue on screen at a given time', () => {
    const cues = parseSrt(SAMPLE);
    expect(findCue(cues, 0.5)).toBeNull();
    expect(findCue(cues, 1)).toBe(cues[0]);
    expect(findCue(cues, 3.49)).toBe(cues[0]);
    expect(findCue(cues, 3.5)).toBeNull();
    expect(findCue(cues, 6)).toBe(cues[1]);
    expect(findCue(cues, 500)).toBeNull();
    expect(findCue([], 1)).toBeNull();
  });

  it('decodes UTF-8 with and without a byte-order mark', () => {
    const text = 'مرحبا';
    const utf8 = new TextEncoder().encode(text);
    expect(decodeSubtitleBytes(utf8)).toBe(text);
    expect(decodeSubtitleBytes(Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8]))).toBe(text);
  });

  it('falls back to Windows-1256 for Arabic files that are not UTF-8', () => {
    // "مرحبا" in Windows-1256
    const bytes = Uint8Array.from([0xe3, 0xd1, 0xcd, 0xc8, 0xc7]);
    expect(decodeSubtitleBytes(bytes)).toBe('مرحبا');
  });

  it('decodes UTF-16 little-endian', () => {
    const bytes = Uint8Array.from([0xff, 0xfe, 0x48, 0x00, 0x69, 0x00]);
    expect(decodeSubtitleBytes(bytes)).toBe('Hi');
  });
});
