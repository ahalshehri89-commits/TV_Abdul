import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Film, Folder, HardDrive, Image as ImageIcon, Usb } from 'lucide-react';
import { fileBrowserService, filterVisible, findSubtitlesFor, formatFileSize } from '../services/fileBrowserService.js';
import { storageService } from '../services/storageService.js';
import { spatialNav } from '../services/spatialNav.js';
import { ImageViewer } from './ImageViewer.jsx';

const PAGE_SIZE = 100;

// The whole home screen unmounts while a video plays, so the open folder and the focused
// card are remembered here and restored when the browser comes back.
const memory = { stack: [], focusId: null };

export function resumeKeyForFile(entry) {
  return `file:${entry.name}|${entry.size}`;
}

/**
 * "My Files": browse USB drives connected to the TV and open videos and pictures.
 *
 * onPlayFile(item) is called with a FilePlayerView item.
 * backHandlerRef.current is set to a function that handles BACK and returns true when it
 * consumed the key (went up a folder) and false when the browser is already at its root.
 */
export function MyFilesView({ onPlayFile, backHandlerRef }) {
  const [stack, setStack] = useState(memory.stack);
  const [drives, setDrives] = useState([]);
  const [entries, setEntries] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [errorText, setErrorText] = useState('');
  const [viewer, setViewer] = useState(null); // null | { images, startIndex }
  const loadIdRef = useRef(0);

  const available = fileBrowserService.isAvailable();
  const current = stack[stack.length - 1] || null;

  const load = useCallback(async (targetStack) => {
    const loadId = ++loadIdRef.current;
    setStatus('loading');
    setLimit(PAGE_SIZE);
    try {
      const found = await fileBrowserService.listDrives();
      if (loadId !== loadIdRef.current) return;
      setDrives(found);

      let effective = targetStack;
      // A remembered folder on a drive that has been unplugged falls back to the root.
      if (effective.length > 0 && !found.some((d) => d.label === effective[0].path)) effective = [];
      // With a single drive there is nothing to choose, so open it directly.
      if (effective.length === 0 && found.length === 1) {
        effective = [{ path: found[0].label, name: found[0].name }];
      }
      if (effective !== targetStack) {
        memory.stack = effective;
        setStack(effective);
      }

      if (effective.length === 0) {
        setEntries([]);
        setAllEntries([]);
      } else {
        const all = await fileBrowserService.listAll(effective[effective.length - 1].path);
        if (loadId !== loadIdRef.current) return;
        setAllEntries(all);
        setEntries(filterVisible(all));
      }
      setStatus('ready');
    } catch (e) {
      if (loadId !== loadIdRef.current) return;
      console.warn('[files] load failed:', e && e.message);
      setErrorText((e && e.message) || 'Cannot read this folder.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load(memory.stack);
    return fileBrowserService.watchDrives(() => load(memory.stack));
  }, [load]);

  // Put the highlight back where it was (or on the first card) once a listing is shown.
  useEffect(() => {
    if (status !== 'ready' || viewer) return;
    const timer = setTimeout(() => {
      if (memory.focusId && spatialNav.focus(memory.focusId)) return;
      const first = document.querySelector('.tv-files-grid [data-nav-zone="grid"]');
      if (first) spatialNav.focus(first);
    }, 60);
    return () => clearTimeout(timer);
  }, [status, stack, viewer]);

  useEffect(() => {
    return spatialNav.onLoadMore(() => setLimit((prev) => (prev < entries.length ? prev + PAGE_SIZE : prev)));
  }, [entries.length]);

  const navigate = useCallback(
    (nextStack, focusId = null) => {
      memory.stack = nextStack;
      memory.focusId = focusId;
      setStack(nextStack);
      load(nextStack);
    },
    [load]
  );

  useEffect(() => {
    if (!backHandlerRef) return undefined;
    backHandlerRef.current = () => {
      const canChooseDrive = drives.length > 1;
      if (stack.length > 1 || (stack.length === 1 && canChooseDrive)) {
        const leaving = stack[stack.length - 1];
        navigate(stack.slice(0, -1), leaving.cardId || null);
        return true;
      }
      memory.focusId = null;
      return false;
    };
    return () => {
      backHandlerRef.current = null;
    };
  }, [backHandlerRef, stack, drives.length, navigate]);

  const openEntry = (entry, cardId) => {
    memory.focusId = cardId;
    if (entry.isDirectory) {
      navigate([...stack, { path: entry.path, name: entry.name, cardId }]);
    } else if (entry.kind === 'video') {
      onPlayFile({
        id: entry.path,
        name: entry.name,
        url: entry.uri,
        resumeKey: resumeKeyForFile(entry),
        subtitles: findSubtitlesFor(entry.name, allEntries).map((sub) => ({ name: sub.name, path: sub.path }))
      });
    } else if (entry.kind === 'image') {
      const images = entries.filter((e) => e.kind === 'image');
      setViewer({ images, startIndex: images.indexOf(entry) });
    }
  };

  const resumeMap = storageService.getResumeMap();
  const shown = entries.slice(0, limit);

  let body;
  if (!available) {
    body = (
      <div className="tv-files-empty">
        <Usb size={72} color="#475569" />
        <h3>My Files works on the TV</h3>
        <p>Plug a USB drive into the TV to browse your videos and pictures here.</p>
      </div>
    );
  } else if (status === 'loading') {
    body = (
      <div className="tv-files-empty">
        <div className="tv-spinner" />
      </div>
    );
  } else if (status === 'error') {
    body = (
      <div className="tv-files-empty">
        <Usb size={72} color="#ef4444" />
        <h3>This folder can't be opened</h3>
        <p>{errorText}</p>
      </div>
    );
  } else if (drives.length === 0) {
    body = (
      <div className="tv-files-empty">
        <Usb size={72} color="#475569" />
        <h3>No USB drive connected</h3>
        <p>Plug a drive into the TV's USB port. It appears here automatically.</p>
        <p className="tv-files-hint">The TV reads exFAT, FAT32 and NTFS drives.</p>
      </div>
    );
  } else if (stack.length === 0) {
    body = (
      <div className="tv-files-grid">
        {drives.map((drive, idx) => (
          <div
            key={drive.label}
            className="tv-file-card"
            tabIndex={0}
            data-nav="true"
            data-nav-zone="grid"
            data-nav-id={`drive-${idx}`}
            onClick={() => navigate([{ path: drive.label, name: drive.name, cardId: `drive-${idx}` }])}
          >
            <HardDrive size={56} color="#38bdf8" />
            <div className="tv-file-card-name">{drive.name}</div>
          </div>
        ))}
      </div>
    );
  } else if (entries.length === 0) {
    body = (
      <div className="tv-files-empty">
        <Folder size={72} color="#475569" />
        <h3>No videos or pictures in this folder</h3>
      </div>
    );
  } else {
    body = (
      <div className="tv-files-grid">
        {shown.map((entry, idx) => {
          const cardId = `file-${stack.length}-${idx}`;
          const resume = entry.kind === 'video' ? resumeMap[resumeKeyForFile(entry)] : null;
          const percent = resume && resume.duration > 0 ? Math.min(100, (resume.position / resume.duration) * 100) : 0;
          return (
            <div
              key={entry.path}
              className={`tv-file-card tv-file-card-${entry.kind}`}
              tabIndex={0}
              data-nav="true"
              data-nav-zone="grid"
              data-nav-id={cardId}
              onClick={() => openEntry(entry, cardId)}
            >
              {entry.isDirectory ? (
                <Folder size={56} color="#eab308" />
              ) : entry.kind === 'video' ? (
                <Film size={56} color="#38bdf8" />
              ) : (
                <ImageIcon size={56} color="#a78bfa" />
              )}
              <div className="tv-file-card-name">{entry.name}</div>
              {!entry.isDirectory && <div className="tv-file-card-meta">{formatFileSize(entry.size)}</div>}
              {percent > 0 && (
                <div className="tv-file-card-progress">
                  <div style={{ width: `${percent}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="tv-files-view">
      <div className="tv-files-header">
        <Usb size={24} color="#38bdf8" />
        <span className="tv-files-crumb">My Files</span>
        {stack.map((level) => (
          <React.Fragment key={level.path}>
            <span className="tv-files-crumb-sep">›</span>
            <span className="tv-files-crumb">{level.name}</span>
          </React.Fragment>
        ))}
        {status === 'ready' && current && <span className="tv-files-count">{entries.length} items</span>}
      </div>
      {body}
      {viewer && (
        <ImageViewer
          images={viewer.images}
          startIndex={viewer.startIndex}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
