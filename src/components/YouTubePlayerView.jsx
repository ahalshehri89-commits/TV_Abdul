import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Pause, Play } from 'lucide-react';
import { remoteKeyManager, TV_KEYS } from '../services/remoteKeyManager.js';
import { storageService } from '../services/storageService.js';
import { youtubeLauncherService } from '../services/youtubeLauncherService.js';
import { YT_WRAPPER_URL } from '../config.js';
import { formatTime } from './FilePlayerView.jsx';

const PAGE_TIMEOUT_MS = 8000; // the hosted player page must answer within this time
const START_TIMEOUT_MS = 12000; // once ready, playback must begin within this time
const OSD_HIDE_MS = 5000;
const SEEK_COMMIT_MS = 400;
const SEEK_STEPS = [10, 10, 30, 30, 60];
const PLAYLIST_PROGRESS_KEY = 'freetv:yt_playlist_progress';

// YouTube player states
const YT_PLAYING = 1;
const YT_PAUSED = 2;
const YT_BUFFERING = 3;

// Embedded-player errors after which the title cannot play in the app at all.
const FATAL_ERRORS = {
  2: 'invalid video',
  5: 'player error',
  100: 'video not found or private',
  101: 'owner does not allow embedded playback',
  150: 'owner does not allow embedded playback',
  153: 'embedded player rejected this app'
};

function readPlaylistProgress(listId) {
  try {
    const map = JSON.parse(localStorage.getItem(PLAYLIST_PROGRESS_KEY) || '{}');
    return map[listId] || null;
  } catch (e) {
    return null;
  }
}

function writePlaylistProgress(listId, progress) {
  try {
    const map = JSON.parse(localStorage.getItem(PLAYLIST_PROGRESS_KEY) || '{}');
    map[listId] = progress;
    localStorage.setItem(PLAYLIST_PROGRESS_KEY, JSON.stringify(map));
  } catch (e) {}
}

/**
 * Build the hosted player address for a title, including where to resume.
 */
export function buildPlayerUrl(base, { youtubeId, youtubePlaylistId }, resume = {}) {
  const params = [];
  if (youtubePlaylistId) {
    params.push(`list=${encodeURIComponent(youtubePlaylistId)}`);
    if (resume.index > 0) params.push(`index=${resume.index}`);
  } else if (youtubeId) {
    params.push(`v=${encodeURIComponent(youtubeId)}`);
  }
  if (resume.position > 0) params.push(`start=${Math.floor(resume.position)}`);
  return `${base}?${params.join('&')}`;
}

/**
 * Plays a YouTube video or playlist inside the app, and hands off to the TV's YouTube app
 * when in-app playback is not possible (automatically) or not wanted (Red key).
 *
 * item: { id, title, youtubeId?, youtubePlaylistId? }
 */
export function YouTubePlayerView({ item, onClose }) {
  const [phase, setPhase] = useState('loading'); // 'loading' | 'playing' | 'handoff'
  const [handoffReason, setHandoffReason] = useState('');
  const [tick, setTick] = useState({ state: -1, time: 0, duration: 0, title: '', index: -1, count: 0, quality: '' });
  const [showOsd, setShowOsd] = useState(true);
  const [pendingSeek, setPendingSeek] = useState(null);

  const frameRef = useRef(null);
  const tickRef = useRef(tick);
  const phaseRef = useRef('loading');
  const startedRef = useRef(false);
  const timersRef = useRef({});
  const pendingSeekRef = useRef(null);
  const seekStreakRef = useRef({ count: 0, at: 0 });
  const closedRef = useRef(false);

  const isPlaylist = Boolean(item.youtubePlaylistId);
  const resumeKey = `yt:${item.youtubeId || ''}`;

  const playerUrl = useRef(
    buildPlayerUrl(
      YT_WRAPPER_URL,
      item,
      isPlaylist
        ? readPlaylistProgress(item.youtubePlaylistId) || {}
        : { position: storageService.getResumePosition(resumeKey) }
    )
  ).current;

  const send = useCallback((cmd, value) => {
    try {
      frameRef.current.contentWindow.postMessage(JSON.stringify({ target: 'tvabdul-yt', cmd, value }), '*');
    } catch (e) {}
  }, []);

  const triggerOsd = useCallback(() => {
    setShowOsd(true);
    clearTimeout(timersRef.current.osd);
    timersRef.current.osd = setTimeout(() => setShowOsd(false), OSD_HIDE_MS);
  }, []);

  const saveProgress = useCallback(() => {
    const last = tickRef.current;
    if (!startedRef.current) return;
    if (isPlaylist) {
      writePlaylistProgress(item.youtubePlaylistId, { index: Math.max(0, last.index), position: Math.floor(last.time) });
    } else {
      storageService.saveResumePosition(resumeKey, last.time, last.duration);
    }
  }, [isPlaylist, item.youtubePlaylistId, resumeKey]);

  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    saveProgress();
    onClose();
  }, [onClose, saveProgress]);

  const handOff = useCallback(
    (reason) => {
      if (phaseRef.current === 'handoff') return;
      phaseRef.current = 'handoff';
      console.log('[youtube] handing off to the YouTube app:', reason);
      saveProgress();
      setHandoffReason(reason);
      setPhase('handoff');
      clearTimeout(timersRef.current.page);
      clearTimeout(timersRef.current.start);
      const current = tickRef.current;
      youtubeLauncherService.openInYouTubeApp({
        videoId: current.videoId || item.youtubeId,
        playlistId: item.youtubePlaylistId
      });
      timersRef.current.close = setTimeout(close, 2500);
    },
    [close, item.youtubeId, item.youtubePlaylistId, saveProgress]
  );

  // Messages from the hosted player page
  useEffect(() => {
    const onMessage = (event) => {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      let message;
      try {
        message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch (e) {
        return;
      }
      if (!message || message.source !== 'tvabdul-yt' || phaseRef.current === 'handoff') return;

      if (message.type === 'ready') {
        console.log('[youtube] player page ready');
        clearTimeout(timersRef.current.page);
        timersRef.current.start = setTimeout(() => handOff('playback did not start'), START_TIMEOUT_MS);
      } else if (message.type === 'error') {
        console.warn('[youtube] player error', message.code);
        if (FATAL_ERRORS[message.code] || !startedRef.current) {
          handOff(FATAL_ERRORS[message.code] || `player error ${message.code}`);
        }
      } else if (message.type === 'tick') {
        const previous = tickRef.current;
        tickRef.current = message;
        if (!startedRef.current && (message.state === YT_PLAYING || message.time > 0.5)) {
          startedRef.current = true;
          phaseRef.current = 'playing';
          clearTimeout(timersRef.current.start);
          setPhase('playing');
          console.log('[youtube] playback started', message.quality, message.title);
        }
        if (previous.state !== message.state) {
          console.log('[youtube] state', message.state, 'quality', message.quality, 't', Math.floor(message.time));
        }
        if (pendingSeekRef.current === null) setTick(message);
      }
    };
    window.addEventListener('message', onMessage);
    timersRef.current.page = setTimeout(() => handOff('player page did not load'), PAGE_TIMEOUT_MS);

    // The frame must never keep keyboard focus, or the remote stops reaching the app.
    const focusKeeper = setInterval(() => {
      if (document.activeElement === frameRef.current) {
        frameRef.current.blur();
        window.focus();
      }
    }, 800);
    const progressSaver = setInterval(saveProgress, 15000);
    triggerOsd();

    const timers = timersRef.current;
    return () => {
      window.removeEventListener('message', onMessage);
      clearInterval(focusKeeper);
      clearInterval(progressSaver);
      Object.values(timers).forEach(clearTimeout);
    };
  }, [handOff, saveProgress, triggerOsd]);

  const nudgeSeek = useCallback(
    (direction, fixedStep) => {
      const now = Date.now();
      const streak = seekStreakRef.current;
      streak.count = now - streak.at < 700 ? streak.count + 1 : 0;
      streak.at = now;
      const step = fixedStep || SEEK_STEPS[Math.min(streak.count, SEEK_STEPS.length - 1)];
      const last = tickRef.current;
      const base = pendingSeekRef.current !== null ? pendingSeekRef.current : last.time;
      const limit = last.duration > 0 ? Math.max(0, last.duration - 2) : Infinity;
      const target = Math.min(limit, Math.max(0, base + direction * step));
      pendingSeekRef.current = target;
      setPendingSeek(target);
      triggerOsd();
      clearTimeout(timersRef.current.seek);
      timersRef.current.seek = setTimeout(() => {
        send('seek', pendingSeekRef.current);
        pendingSeekRef.current = null;
        setPendingSeek(null);
      }, SEEK_COMMIT_MS);
    },
    [send, triggerOsd]
  );

  useEffect(() => {
    const handleRemoteAction = (action) => {
      if (phaseRef.current === 'handoff') {
        if (action.type === TV_KEYS.BACK) close();
        return true;
      }
      switch (action.type) {
        case TV_KEYS.BACK:
        case TV_KEYS.STOP:
          close();
          return true;
        case TV_KEYS.ENTER:
        case TV_KEYS.PLAY_PAUSE:
          send(tickRef.current.state === YT_PLAYING || tickRef.current.state === YT_BUFFERING ? 'pause' : 'play');
          triggerOsd();
          return true;
        case TV_KEYS.PLAY:
          send('play');
          triggerOsd();
          return true;
        case TV_KEYS.PAUSE:
          send('pause');
          triggerOsd();
          return true;
        case TV_KEYS.RIGHT:
          nudgeSeek(1);
          return true;
        case TV_KEYS.LEFT:
          nudgeSeek(-1);
          return true;
        case TV_KEYS.FAST_FORWARD:
          nudgeSeek(1, 60);
          return true;
        case TV_KEYS.REWIND:
          nudgeSeek(-1, 60);
          return true;
        case TV_KEYS.CH_UP:
          if (isPlaylist) send('next');
          triggerOsd();
          return true;
        case TV_KEYS.CH_DOWN:
          if (isPlaylist) send('prev');
          triggerOsd();
          return true;
        case TV_KEYS.FAVORITE:
          if (action.color === 'red') {
            handOff('opened by you');
            return true;
          }
          triggerOsd();
          return true;
        case TV_KEYS.UP:
        case TV_KEYS.DOWN:
        case TV_KEYS.INFO:
          triggerOsd();
          return true;
        default:
          return false;
      }
    };
    return remoteKeyManager.subscribe(handleRemoteAction);
  }, [close, handOff, isPlaylist, nudgeSeek, send, triggerOsd]);

  const shownTime = pendingSeek !== null ? pendingSeek : tick.time;
  const progress = tick.duration > 0 ? Math.min(100, (shownTime / tick.duration) * 100) : 0;
  const isPaused = tick.state === YT_PAUSED;
  const osdVisible = phase === 'playing' && (showOsd || isPaused || pendingSeek !== null);

  return (
    <div className="tv-player-view tv-youtube-view">
      <iframe
        ref={frameRef}
        className="tv-youtube-frame"
        src={playerUrl}
        title={item.title}
        tabIndex={-1}
        allow="autoplay; encrypted-media"
      />

      {phase === 'loading' && (
        <div className="tv-player-buffering">
          <div className="tv-spinner" />
          <span style={{ fontSize: '20px', fontWeight: 600, color: '#f8fafc' }}>{item.title}</span>
        </div>
      )}

      {phase === 'handoff' && (
        <div className="tv-youtube-handoff">
          <ExternalLink size={56} color="#ef4444" />
          <h2>Opening in the YouTube app…</h2>
          <p>{handoffReason === 'opened by you' ? item.title : `In-app playback isn't available: ${handoffReason}.`}</p>
        </div>
      )}

      <div className={`tv-file-osd ${osdVisible ? '' : 'hidden'}`}>
        <div className="tv-file-osd-title">
          {isPaused ? <Pause size={26} /> : <Play size={26} />}
          <span>{tick.title || item.title}</span>
          {isPlaylist && tick.count > 0 && (
            <span className="tv-youtube-episode">
              {tick.index + 1} / {tick.count}
            </span>
          )}
        </div>
        <div className="tv-file-progress">
          <div className="tv-file-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="tv-file-osd-row">
          <span className="tv-file-time">
            {formatTime(shownTime)} {tick.duration > 0 ? `/ ${formatTime(tick.duration)}` : ''}
          </span>
          <div className="tv-osd-hints" style={{ margin: 0 }}>
            <span>
              <span className="tv-remote-key">OK</span> Play / Pause
            </span>
            <span>
              <span className="tv-remote-key">◄ / ►</span> Seek
            </span>
            {isPlaylist && (
              <span>
                <span className="tv-remote-key">CH ▲ / ▼</span> Next / Previous
              </span>
            )}
            <span>
              <span className="tv-remote-key tv-remote-key-red">RED</span> Open in YouTube
            </span>
            <span>
              <span className="tv-remote-key">BACK</span> Exit
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
