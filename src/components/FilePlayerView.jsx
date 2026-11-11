import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, ArrowLeft, Pause, Play, Subtitles, Volume2 } from 'lucide-react';
import { playerController } from '../services/player/PlayerFactory.js';
import { remoteKeyManager, TV_KEYS } from '../services/remoteKeyManager.js';
import { storageService } from '../services/storageService.js';
import { fileBrowserService } from '../services/fileBrowserService.js';
import { decodeSubtitleBytes, parseSrt, findCue } from '../services/srtParser.js';

const OSD_HIDE_MS = 5000;
const SEEK_COMMIT_MS = 400;
const SEEK_STEPS = [10, 10, 30, 30, 60];
const RESUME_SAVE_INTERVAL = 10;

export function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/**
 * Fullscreen player for seekable media: local files and direct on-demand video.
 *
 * item: { id, name, url, resumeKey, subtitles?: [{ name, path }] }
 */
export function FilePlayerView({ item, onClose }) {
  const [showOsd, setShowOsd] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pendingSeek, setPendingSeek] = useState(null);
  const [subtitleText, setSubtitleText] = useState('');
  const [menu, setMenu] = useState(null); // null | { options: [...], index }
  const [subtitleChoice, setSubtitleChoice] = useState('off');
  const [audioChoice, setAudioChoice] = useState(null);

  const videoRef = useRef(null);
  const osdTimerRef = useRef(null);
  const seekTimerRef = useRef(null);
  const seekStreakRef = useRef({ count: 0, at: 0 });
  const pendingSeekRef = useRef(null);
  const cuesRef = useRef([]);
  const subtitleModeRef = useRef('off'); // 'off' | 'sidecar' | 'embedded'
  const embeddedTimerRef = useRef(null);
  const lastSavedRef = useRef(0);
  const timeRef = useRef(0);
  const durationRef = useRef(0);
  const closedRef = useRef(false);

  const isAVPlay = typeof window !== 'undefined' && Boolean(window.webapis && window.webapis.avplay);

  const triggerOsd = useCallback(() => {
    setShowOsd(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => setShowOsd(false), OSD_HIDE_MS);
  }, []);

  const saveResume = useCallback(() => {
    if (item.resumeKey && timeRef.current > 0) {
      storageService.saveResumePosition(item.resumeKey, timeRef.current, durationRef.current);
    }
  }, [item.resumeKey]);

  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    saveResume();
    onClose();
  }, [onClose, saveResume]);

  // The hardware video plane sits behind the page, so the page must be transparent.
  useEffect(() => {
    document.documentElement.classList.add('tv-in-player');
    document.body.classList.add('tv-in-player');
    return () => {
      document.documentElement.classList.remove('tv-in-player');
      document.body.classList.remove('tv-in-player');
    };
  }, []);

  const loadSidecar = useCallback(async (subtitle) => {
    try {
      const bytes = await fileBrowserService.readBytes(subtitle.path);
      cuesRef.current = parseSrt(decodeSubtitleBytes(bytes));
      subtitleModeRef.current = 'sidecar';
      playerController.setEmbeddedSubtitlesEnabled(false);
      setSubtitleChoice(`sidecar:${subtitle.path}`);
      console.log(`[player] loaded ${cuesRef.current.length} subtitle cues from ${subtitle.name}`);
    } catch (e) {
      console.warn('[player] subtitle load failed:', e && e.message);
      cuesRef.current = [];
      subtitleModeRef.current = 'off';
      setSubtitleChoice('off');
    }
    setSubtitleText('');
  }, []);

  // Start playback and follow player events.
  useEffect(() => {
    closedRef.current = false;
    cuesRef.current = [];
    subtitleModeRef.current = 'off';
    setSubtitleChoice('off');
    setAudioChoice(null);
    setSubtitleText('');
    setErrorMessage(null);
    setIsBuffering(true);
    setCurrentTime(0);
    setDuration(0);
    timeRef.current = 0;
    durationRef.current = 0;

    if (videoRef.current && !isAVPlay) {
      playerController.attachVideoElement(videoRef.current);
    }

    const unsubscribe = playerController.subscribe((event, payload) => {
      switch (event) {
        case 'buffering':
          setIsBuffering(payload.isBuffering);
          break;
        case 'stateChange':
          if (payload.state === 'PLAYING') {
            setIsBuffering(false);
            setIsPaused(false);
            const total = playerController.getDuration();
            if (total > 0) {
              durationRef.current = total;
              setDuration(total);
            }
          } else if (payload.state === 'PAUSED') {
            setIsPaused(true);
          }
          break;
        case 'timeupdate': {
          const time = payload.currentTime || 0;
          timeRef.current = time;
          if (pendingSeekRef.current === null) setCurrentTime(time);
          if (!durationRef.current) {
            const total = playerController.getDuration();
            if (total > 0) {
              durationRef.current = total;
              setDuration(total);
            }
          }
          if (subtitleModeRef.current === 'sidecar') {
            const cue = findCue(cuesRef.current, time);
            setSubtitleText(cue ? cue.text : '');
          }
          if (Math.abs(time - lastSavedRef.current) >= RESUME_SAVE_INTERVAL) {
            lastSavedRef.current = time;
            if (item.resumeKey) storageService.saveResumePosition(item.resumeKey, time, durationRef.current);
          }
          break;
        }
        case 'subtitle':
          if (subtitleModeRef.current === 'embedded') {
            setSubtitleText(payload.text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+>/g, ''));
            if (embeddedTimerRef.current) clearTimeout(embeddedTimerRef.current);
            embeddedTimerRef.current = setTimeout(() => setSubtitleText(''), payload.durationMs || 4000);
          }
          break;
        case 'completed':
          if (item.resumeKey) storageService.clearResumePosition(item.resumeKey);
          timeRef.current = 0;
          close();
          break;
        case 'allStreamsFailed':
        case 'error':
          setIsBuffering(false);
          setErrorMessage(payload.error || 'Playback error.');
          break;
        default:
          break;
      }
    });

    const startPosition = storageService.getResumePosition(item.resumeKey);
    lastSavedRef.current = startPosition;
    playerController.playFile(item, { startPosition });
    if (item.subtitles && item.subtitles.length > 0) {
      loadSidecar(item.subtitles[0]);
    }
    triggerOsd();

    return () => {
      unsubscribe();
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
      if (seekTimerRef.current) clearTimeout(seekTimerRef.current);
      if (embeddedTimerRef.current) clearTimeout(embeddedTimerRef.current);
      saveResume();
      playerController.stop();
    };
  }, [item, isAVPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePause = useCallback(() => {
    if (playerController.getState() === 'PAUSED') {
      playerController.play();
    } else {
      playerController.pause();
    }
    triggerOsd();
  }, [triggerOsd]);

  // Repeated presses move a pending target; the real seek happens once the presses stop.
  const nudgeSeek = useCallback(
    (direction, fixedStep) => {
      const now = Date.now();
      const streak = seekStreakRef.current;
      streak.count = now - streak.at < 700 ? streak.count + 1 : 0;
      streak.at = now;
      const step = fixedStep || SEEK_STEPS[Math.min(streak.count, SEEK_STEPS.length - 1)];

      const base = pendingSeekRef.current !== null ? pendingSeekRef.current : timeRef.current;
      const limit = durationRef.current > 0 ? Math.max(0, durationRef.current - 2) : Infinity;
      const target = Math.min(limit, Math.max(0, base + direction * step));
      pendingSeekRef.current = target;
      setPendingSeek(target);
      setCurrentTime(target);
      triggerOsd();

      if (seekTimerRef.current) clearTimeout(seekTimerRef.current);
      seekTimerRef.current = setTimeout(async () => {
        const finalTarget = pendingSeekRef.current;
        setIsBuffering(true);
        await playerController.seekTo(finalTarget);
        timeRef.current = finalTarget;
        pendingSeekRef.current = null;
        setPendingSeek(null);
        setIsBuffering(false);
        setSubtitleText('');
      }, SEEK_COMMIT_MS);
    },
    [triggerOsd]
  );

  const openMenu = useCallback(() => {
    const tracks = playerController.getTracks();
    const options = [{ id: 'sub:off', group: 'Subtitles', label: 'Off' }];
    (item.subtitles || []).forEach((sub) => {
      options.push({ id: `sidecar:${sub.path}`, group: 'Subtitles', label: sub.name, subtitle: sub });
    });
    tracks.text.forEach((track) => {
      options.push({ id: `embedded:${track.index}`, group: 'Subtitles', label: `Built-in ${track.label}`, trackIndex: track.index });
    });
    if (tracks.audio.length > 1) {
      tracks.audio.forEach((track) => {
        options.push({ id: `audio:${track.index}`, group: 'Audio', label: `Track ${track.label}`, trackIndex: track.index });
      });
    }
    setMenu({ options, index: 0 });
    setShowOsd(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
  }, [item.subtitles]);

  const applyMenuOption = useCallback(
    (option) => {
      if (option.id === 'sub:off') {
        subtitleModeRef.current = 'off';
        cuesRef.current = [];
        playerController.setEmbeddedSubtitlesEnabled(false);
        setSubtitleChoice('off');
        setSubtitleText('');
      } else if (option.id.startsWith('sidecar:')) {
        loadSidecar(option.subtitle);
      } else if (option.id.startsWith('embedded:')) {
        subtitleModeRef.current = 'embedded';
        cuesRef.current = [];
        playerController.setEmbeddedSubtitlesEnabled(true);
        playerController.selectTrack('text', option.trackIndex);
        setSubtitleChoice(option.id);
        setSubtitleText('');
      } else if (option.id.startsWith('audio:')) {
        playerController.selectTrack('audio', option.trackIndex);
        setAudioChoice(option.id);
      }
      setMenu(null);
      triggerOsd();
    },
    [loadSidecar, triggerOsd]
  );

  useEffect(() => {
    const handleRemoteAction = (action) => {
      if (errorMessage) {
        if (action.type === TV_KEYS.BACK || action.type === TV_KEYS.ENTER) close();
        return true;
      }

      if (menu) {
        switch (action.type) {
          case TV_KEYS.UP:
            setMenu((m) => ({ ...m, index: (m.index - 1 + m.options.length) % m.options.length }));
            return true;
          case TV_KEYS.DOWN:
            setMenu((m) => ({ ...m, index: (m.index + 1) % m.options.length }));
            return true;
          case TV_KEYS.ENTER:
            applyMenuOption(menu.options[menu.index]);
            return true;
          case TV_KEYS.BACK:
            setMenu(null);
            triggerOsd();
            return true;
          default:
            return true;
        }
      }

      switch (action.type) {
        case TV_KEYS.BACK:
        case TV_KEYS.STOP:
          close();
          return true;
        case TV_KEYS.ENTER:
        case TV_KEYS.PLAY_PAUSE:
          togglePause();
          return true;
        case TV_KEYS.PLAY:
          playerController.play();
          triggerOsd();
          return true;
        case TV_KEYS.PAUSE:
          playerController.pause();
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
        case TV_KEYS.UP:
          openMenu();
          return true;
        case TV_KEYS.DOWN:
        case TV_KEYS.INFO:
          triggerOsd();
          return true;
        default:
          return false;
      }
    };

    return remoteKeyManager.subscribe(handleRemoteAction);
  }, [menu, errorMessage, close, togglePause, nudgeSeek, openMenu, applyMenuOption, triggerOsd]);

  const shownTime = pendingSeek !== null ? pendingSeek : currentTime;
  const progress = duration > 0 ? Math.min(100, (shownTime / duration) * 100) : 0;
  const osdVisible = showOsd || isPaused || pendingSeek !== null || Boolean(menu);

  return (
    <div className="tv-player-view">
      {isAVPlay ? (
        <object
          id="av-player"
          type="application/avplayer"
          style={{ position: 'fixed', top: 0, left: 0, width: '1920px', height: '1080px', zIndex: 0, pointerEvents: 'none' }}
        />
      ) : (
        <video ref={videoRef} className="tv-player-video" playsInline autoPlay />
      )}

      {subtitleText && !errorMessage && <div className="tv-file-subtitle">{subtitleText}</div>}

      {isBuffering && !errorMessage && (
        <div className="tv-player-buffering">
          <div className="tv-spinner" />
        </div>
      )}

      {errorMessage && (
        <div className="tv-player-error">
          <AlertCircle size={64} color="#ef4444" />
          <h2 style={{ fontSize: '28px', color: '#ffffff' }}>This video can't be played</h2>
          <p style={{ fontSize: '18px', color: '#94a3b8' }}>
            The TV doesn't support this file's format, or the file can't be read.
          </p>
          <p style={{ fontSize: '14px', color: '#64748b' }}>{String(errorMessage)}</p>
          <div className="tv-error-actions">
            <button className="tv-header-btn" data-nav="true" data-nav-id="btn-back" onClick={close} autoFocus>
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
          </div>
        </div>
      )}

      {menu && (
        <div className="tv-file-menu">
          {menu.options.map((option, idx) => {
            const isChosen = option.id === subtitleChoice || option.id === audioChoice || (option.id === 'sub:off' && subtitleChoice === 'off');
            const showGroup = idx === 0 || menu.options[idx - 1].group !== option.group;
            return (
              <React.Fragment key={option.id}>
                {showGroup && (
                  <div className="tv-file-menu-group">
                    {option.group === 'Audio' ? <Volume2 size={18} /> : <Subtitles size={18} />}
                    <span>{option.group}</span>
                  </div>
                )}
                <div className={`tv-file-menu-item ${idx === menu.index ? 'focused' : ''}`}>
                  <span className="tv-file-menu-check">{isChosen ? '●' : ''}</span>
                  <span>{option.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      <div className={`tv-file-osd ${osdVisible && !errorMessage ? '' : 'hidden'}`}>
        <div className="tv-file-osd-title">
          {isPaused ? <Pause size={26} /> : <Play size={26} />}
          <span>{item.name}</span>
        </div>
        <div className="tv-file-progress">
          <div className="tv-file-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="tv-file-osd-row">
          <span className="tv-file-time">
            {formatTime(shownTime)} {duration > 0 ? `/ ${formatTime(duration)}` : ''}
          </span>
          <div className="tv-osd-hints" style={{ margin: 0 }}>
            <span>
              <span className="tv-remote-key">OK</span> Play / Pause
            </span>
            <span>
              <span className="tv-remote-key">◄ / ►</span> Seek
            </span>
            <span>
              <span className="tv-remote-key">▲</span> Subtitles &amp; Audio
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
