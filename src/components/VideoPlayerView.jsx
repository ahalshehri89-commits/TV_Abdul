import React, { useState, useEffect, useRef } from 'react';
import { playerController } from '../services/player/PlayerFactory.js';
import { remoteKeyManager, TV_KEYS } from '../services/remoteKeyManager.js';
import { AlertCircle, RotateCcw, ArrowLeft, Heart, Layers } from 'lucide-react';

export function VideoPlayerView({
  channel,
  onClose,
  onNextChannel,
  onPreviousChannel,
  isFavorite,
  onToggleFavorite
}) {
  const [showOsd, setShowOsd] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [failoverInfo, setFailoverInfo] = useState(null);
  const [streamInfo, setStreamInfo] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [timeStr, setTimeStr] = useState('');

  const videoRef = useRef(null);
  const osdTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  // AVPlay hardware engine flag (Direct check against window.webapis for 100% accuracy)
  const isAVPlay = typeof window !== 'undefined' && Boolean(window.webapis && window.webapis.avplay);

  // Manage html & body class for transparency so TV hardware video plane shines through
  useEffect(() => {
    document.documentElement.classList.add('tv-in-player');
    document.body.classList.add('tv-in-player');
    return () => {
      document.documentElement.classList.remove('tv-in-player');
      document.body.classList.remove('tv-in-player');
    };
  }, []);

  // Clock in OSD
  useEffect(() => {
    const updateTime = () => {
      setTimeStr(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 3000);
  };

  // Show OSD and reset auto-hide timer
  const triggerOsd = () => {
    setShowOsd(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => {
      setShowOsd(false);
    }, 5500);
  };

  // Attach video element and subscribe to player controller
  useEffect(() => {
    if (videoRef.current && !isAVPlay) {
      playerController.attachVideoElement(videoRef.current);
    }

    const unsubscribe = playerController.subscribe((event, payload) => {
      switch (event) {
        case 'channelStarted':
          setErrorMessage(null);
          setFailoverInfo(null);
          setIsBuffering(true);
          setStreamInfo({
            index: payload.streamIndex,
            total: payload.totalStreams,
            stream: payload.stream
          });
          triggerOsd();
          break;
        case 'buffering':
          setIsBuffering(payload.isBuffering);
          break;
        case 'stateChange':
          if (payload.state === 'PLAYING') {
            setIsBuffering(false);
            setErrorMessage(null);
          }
          break;
        case 'failover':
          setFailoverInfo(
            `Source ${payload.failedIndex + 1} unavailable. Switching to source ${payload.nextIndex + 1}/${payload.totalStreams}...`
          );
          setIsBuffering(true);
          triggerOsd();
          break;
        case 'allStreamsFailed':
          setIsBuffering(false);
          setErrorMessage(
            payload.error || 'All live stream sources for this channel are currently unreachable.'
          );
          setShowOsd(true);
          break;
        case 'error':
          setIsBuffering(false);
          setErrorMessage(payload.error || 'Playback error occurred.');
          setShowOsd(true);
          break;
        default:
          break;
      }
    });

    // Start playback
    if (channel) {
      playerController.playChannel(channel);
    }

    return () => {
      unsubscribe();
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      playerController.stop();
    };
  }, [channel, isAVPlay]);

  // Handle remote control keys in player mode
  useEffect(() => {
    const handleRemoteAction = (action) => {
      switch (action.type) {
        case TV_KEYS.BACK:
          onClose();
          return true;

        case TV_KEYS.CH_UP:
          onNextChannel();
          triggerOsd();
          return true;

        case TV_KEYS.CH_DOWN:
          onPreviousChannel();
          triggerOsd();
          return true;

        case TV_KEYS.UP:
          onNextChannel();
          triggerOsd();
          return true;

        case TV_KEYS.DOWN:
          onPreviousChannel();
          triggerOsd();
          return true;

        case TV_KEYS.LEFT: {
          const total = channel?.streams?.length || 1;
          const curr = streamInfo?.index ?? 0;
          const prev = (curr - 1 + total) % total;
          const targetStream = channel?.streams?.[prev];
          showToast(`Switching to Source ${prev + 1} of ${total} (${targetStream?.quality || 'HD'})...`);
          playerController.playPreviousStream();
          triggerOsd();
          return true;
        }

        case TV_KEYS.RIGHT: {
          const total = channel?.streams?.length || 1;
          const curr = streamInfo?.index ?? 0;
          const next = (curr + 1) % total;
          const targetStream = channel?.streams?.[next];
          showToast(`Switching to Source ${next + 1} of ${total} (${targetStream?.quality || 'HD'})...`);
          playerController.playNextStream();
          triggerOsd();
          return true;
        }

        case TV_KEYS.PLAY_PAUSE:
          if (playerController.getState() === 'PLAYING') {
            playerController.pause();
          } else {
            playerController.play();
          }
          triggerOsd();
          return true;

        case TV_KEYS.FAVORITE:
        case TV_KEYS.INFO: {
          onToggleFavorite(channel.id);
          const nextFav = !isFavorite;
          showToast(`${channel.name} ${nextFav ? 'added to Favorites ❤️' : 'removed from Favorites'}`);
          triggerOsd();
          return true;
        }

        case TV_KEYS.ENTER:
          if (!showOsd) {
            triggerOsd();
          } else {
            onToggleFavorite(channel.id);
            const nextFav = !isFavorite;
            showToast(`${channel.name} ${nextFav ? 'added to Favorites ❤️' : 'removed from Favorites'}`);
            triggerOsd();
          }
          return true;

        default:
          break;
      }
      return false;
    };

    const unsubscribeKeys = remoteKeyManager.subscribe(handleRemoteAction);
    return () => unsubscribeKeys();
  }, [onClose, onNextChannel, onPreviousChannel, channel, streamInfo]);

  return (
    <div className="tv-player-view" onClick={triggerOsd}>
      {/* Native Samsung Tizen AVPlay object element */}
      {isAVPlay ? (
        <object
          id="av-player"
          type="application/avplayer"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '1920px',
            height: '1080px',
            zIndex: 0,
            pointerEvents: 'none'
          }}
        />
      ) : (
        /* HTML5 video element: ONLY rendered for browser/simulators */
        <video
          ref={videoRef}
          className="tv-player-video"
          playsInline
          autoPlay
        />
      )}

      {/* Toast Notification (Source switch / Channel notification) */}
      {toastMsg && (
        <div className="tv-player-toast">
          <Layers size={22} color="#38bdf8" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Buffering Indicator */}
      {isBuffering && !errorMessage && (
        <div className="tv-player-buffering">
          <div className="tv-spinner" />
          <span style={{ fontSize: '20px', fontWeight: 600, color: '#f8fafc' }}>
            {failoverInfo || `Connecting to ${channel ? channel.name : 'Stream'}...`}
          </span>
        </div>
      )}

      {/* Error & Failover Modal */}
      {errorMessage && (
        <div className="tv-player-error">
          <AlertCircle size={64} color="#ef4444" />
          <h2 style={{ fontSize: '28px', color: '#ffffff' }}>Stream Unavailable</h2>
          <p style={{ fontSize: '18px', color: '#94a3b8' }}>{errorMessage}</p>
          <div className="tv-error-actions">
            <button
              className="tv-header-btn"
              data-nav="true"
              data-nav-id="btn-retry"
              onClick={() => playerController.retryCurrent()}
              autoFocus
            >
              <RotateCcw size={18} />
              <span>Retry Stream</span>
            </button>
            <button
              className="tv-header-btn"
              data-nav="true"
              data-nav-id="btn-back"
              onClick={onClose}
            >
              <ArrowLeft size={18} />
              <span>Return to Channels</span>
            </button>
          </div>
        </div>
      )}

      {/* On-Screen Display (OSD) Overlay */}
      <div className={`tv-player-osd ${showOsd ? '' : 'hidden'}`}>
        <div className="tv-osd-top">
          <div className="tv-osd-channel-meta">
            {channel?.logo && (
              <img src={channel.logo} alt={channel.name} className="tv-osd-logo" />
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span className="tv-osd-channel-number">#{channel?.number || '1'}</span>
                <span className="tv-osd-channel-name">{channel?.name}</span>
                <button
                  className="tv-osd-fav-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(channel.id);
                    const nextFav = !isFavorite;
                    showToast(`${channel.name} ${nextFav ? 'added to Favorites ❤️' : 'removed from Favorites'}`);
                    triggerOsd();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: isFavorite ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255, 255, 255, 0.12)',
                    border: isFavorite ? '2px solid #f43f5e' : '1px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: '20px',
                    padding: '6px 14px',
                    color: isFavorite ? '#f43f5e' : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: 600
                  }}
                >
                  <Heart size={18} color="#f43f5e" fill={isFavorite ? '#f43f5e' : 'none'} />
                  <span>{isFavorite ? 'Favorited' : 'Add to Favorites'}</span>
                </button>
              </div>
              <span className="tv-osd-channel-country">
                {channel?.flag} {channel?.countryName || channel?.country} • {channel?.categories?.join(', ')}
              </span>
            </div>
          </div>
          <span className="tv-clock" style={{ fontSize: '28px', color: '#ffffff' }}>
            {timeStr}
          </span>
        </div>

        <div className="tv-osd-bottom">
          {/* Multi-Source Selector HUD */}
          {channel?.streams && channel.streams.length > 1 && (
            <div className="tv-osd-sources-hud">
              <span style={{ fontSize: '15px', color: '#94a3b8', fontWeight: 600 }}>
                Available Sources ({channel.streams.length}):
              </span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {channel.streams.map((s, idx) => {
                  const isActive = (streamInfo?.index ?? 0) === idx;
                  return (
                    <div
                      key={idx}
                      className={`tv-source-pill ${isActive ? 'tv-source-pill-active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        showToast(`Switching to Source ${idx + 1} (${s.quality || 'HD'})...`);
                        playerController.playStreamIndex(idx);
                        triggerOsd();
                      }}
                    >
                      {isActive && <span className="tv-source-dot" />}
                      <span>Source {idx + 1}: {s.quality || 'HD'}</span>
                    </div>
                  );
                })}
              </div>
              <span style={{ fontSize: '13px', color: '#38bdf8', marginLeft: '6px' }}>
                (Use ◄ / ► on remote to switch source)
              </span>
            </div>
          )}

          <div className="tv-osd-info-pills" style={{ marginTop: '12px' }}>
            <span className="tv-osd-pill">LIVE</span>
            <span className="tv-osd-pill" style={{ color: '#38bdf8' }}>
              {streamInfo?.stream?.quality || channel?.bestQuality || 'HD'}
            </span>
            {streamInfo && streamInfo.total > 1 && (
              <span className="tv-osd-pill" style={{ color: '#10b981' }}>
                Source {streamInfo.index + 1} of {streamInfo.total} Active
              </span>
            )}
          </div>

          <div className="tv-osd-hints">
            <span>
              <span className="tv-remote-key">OK / INFO</span> {isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
            </span>
            <span>
              <span className="tv-remote-key">▲ / ▼</span> Change Channel
            </span>
            <span>
              <span className="tv-remote-key">◄ / ►</span> Switch Source (1 of {channel?.streams?.length || 1})
            </span>
            <span>
              <span className="tv-remote-key">BACK</span> Return to Guide
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
