import { describe, it, expect, afterEach } from 'vitest';
import {
  classifyFile,
  filterVisible,
  findSubtitlesFor,
  formatFileSize,
  naturalCompare,
  sortEntries,
  fileBrowserService
} from '../src/services/fileBrowserService.js';

const file = (name, extra = {}) => ({ name, path: `usb/${name}`, uri: `file:///usb/${name}`, isDirectory: false, size: 10, kind: classifyFile(name), ...extra });
const folder = (name) => ({ name, path: `usb/${name}`, uri: `file:///usb/${name}`, isDirectory: true, size: 0, kind: 'folder' });

describe('fileBrowserService helpers', () => {
  it('classifies files by extension, ignoring case', () => {
    expect(classifyFile('Film.MKV')).toBe('video');
    expect(classifyFile('clip.mp4')).toBe('video');
    expect(classifyFile('old.avi')).toBe('video');
    expect(classifyFile('photo.JPG')).toBe('image');
    expect(classifyFile('Film.srt')).toBe('subtitle');
    expect(classifyFile('notes.txt')).toBe('other');
    expect(classifyFile('noextension')).toBe('other');
  });

  it('sorts folders first and numbers naturally', () => {
    const sorted = sortEntries([file('Episode 10.mkv'), file('Episode 2.mkv'), folder('Zeta'), folder('alpha')]);
    expect(sorted.map((e) => e.name)).toEqual(['alpha', 'Zeta', 'Episode 2.mkv', 'Episode 10.mkv']);
    expect(naturalCompare('a2', 'a10')).toBeLessThan(0);
  });

  it('shows only folders, videos and images, and hides system entries', () => {
    const visible = filterVisible([
      folder('Movies'),
      folder('System Volume Information'),
      folder('.Trashes'),
      file('a.mkv'),
      file('a.srt'),
      file('pic.png'),
      file('readme.txt'),
      file('._a.mkv')
    ]);
    expect(visible.map((e) => e.name)).toEqual(['Movies', 'a.mkv', 'pic.png']);
  });

  it('matches subtitles to a video and prefers Arabic', () => {
    const siblings = [file('Film.en.srt'), file('Film.srt'), file('Film.ar.srt'), file('Film 2.srt'), file('Other.srt'), file('Film.mkv')];
    expect(findSubtitlesFor('Film.mkv', siblings).map((s) => s.name)).toEqual(['Film.ar.srt', 'Film.en.srt', 'Film.srt']);
    expect(findSubtitlesFor('Nothing.mkv', siblings)).toEqual([]);
  });

  it('formats file sizes', () => {
    expect(formatFileSize(0)).toBe('');
    expect(formatFileSize(900)).toBe('900 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(3.2 * 1024 ** 3)).toBe('3.2 GB');
  });
});

describe('fileBrowserService on the TV filesystem API', () => {
  afterEach(() => {
    delete global.window;
  });

  const makeFile = (name, isDirectory, children = [], bytes = []) => ({
    name,
    fullPath: `removable_sda1/${name}`,
    isDirectory,
    fileSize: bytes.length || 1234,
    toURI: () => `file:///opt/media/USBDriveA1/${name}`,
    listFiles: (ok) => ok(children),
    openStream: (mode, ok) => ok({ readBytes: (n) => bytes.slice(0, n), close: () => {} })
  });

  it('reports unavailable off the TV and lists no drives', async () => {
    expect(fileBrowserService.isAvailable()).toBe(false);
    expect(await fileBrowserService.listDrives()).toEqual([]);
    await expect(fileBrowserService.listAll('x')).rejects.toThrow();
  });

  it('lists only mounted removable drives', async () => {
    global.window = {
      tizen: {
        filesystem: {
          listStorages: (ok) =>
            ok([
              { label: 'internal0', type: 'INTERNAL', state: 'MOUNTED' },
              { label: 'removable_sda1', type: 'EXTERNAL', state: 'MOUNTED' },
              { label: 'removable_sdb1', type: 'EXTERNAL', state: 'REMOVED' }
            ])
        }
      }
    };
    expect(await fileBrowserService.listDrives()).toEqual([{ label: 'removable_sda1', name: 'USB 1' }]);
  });

  it('lists a folder and reads a subtitle file', async () => {
    const sub = makeFile('Film.srt', false, [], [72, 105]);
    const root = makeFile('', true, [makeFile('Film.mkv', false), makeFile('Shows', true), sub]);
    global.window = {
      tizen: { filesystem: { resolve: (path, ok) => ok(path.endsWith('Film.srt') ? sub : root) } }
    };
    const entries = await fileBrowserService.listAll('removable_sda1');
    expect(entries.map((e) => [e.name, e.kind])).toEqual([
      ['Shows', 'folder'],
      ['Film.mkv', 'video'],
      ['Film.srt', 'subtitle']
    ]);
    expect(entries[1].uri).toBe('file:///opt/media/USBDriveA1/Film.mkv');
    const bytes = await fileBrowserService.readBytes('removable_sda1/Film.srt');
    expect(Array.from(bytes)).toEqual([72, 105]);
  });

  it('turns a filesystem error into a rejected promise', async () => {
    global.window = { tizen: { filesystem: { resolve: (path, ok, fail) => fail({ message: 'NotFoundError' }) } } };
    await expect(fileBrowserService.listAll('gone')).rejects.toThrow('NotFoundError');
  });
});
