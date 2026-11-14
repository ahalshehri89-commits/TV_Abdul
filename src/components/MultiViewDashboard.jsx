import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Maximize2, Minimize2, Grid, Columns, X, Tv } from 'lucide-react';
import Hls from 'hls.js';
import { multiViewService, MULTIVIEW_MODES } from '../services/multiViewService.js';
import { remoteKeyManager, TV_KEYS } from '../services/remoteKeyManager.js';

export function MultiViewDashboard({ channels = [], onClose, onExpandChannel }) {
  const [state, setState] = useState(multiViewService.getState());
  const [fullscreenSlot, setFullscreenSlot] = useState(null); // null or slot index
  const videoRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const hlsInstances = useRef([null, null, null, null]);

  // Sync state
  useEffect(() => {
    const unsub = multiViewService.subscribe((s) => setState(s));
    // Pick 4 initial high-quality sports / news channels if slots are empty
    if (!state.slots[0].channel && channels.length >= 4) {
      multiViewService.setInitialChannels(channels.slice(0, 4));
    }
    return () => unsub();
  }, [channels]);

  // Setup HLS video streams for each slot
  useEffect(() => {
    state.slots.forEach((slot, idx) => {
      const vid = videoRefs[idx].current;
      const ch = slot.channel;
      if (!vid || !ch) return;

      const streamUrl = ch.streams?.[0]?.url;
      if (!streamUrl) return;

      // Clean previous HLS instance if any
      if (hlsInstances.current[idx]) {
        hlsInstances.current[idx].destroy();
        hlsInstances.current[idx] = null;
      }

      if (Hls.isSupported() && (streamUrl.includes('.m3u8') || streamUrl.includes('/hls'))) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(streamUrl);
        hls.attachMedia(vid);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          vid.play().catch(() => {});
        });
        hlsInstances.current[idx] = hls;
      } else {
        vid.src = streamUrl;
        vid.play().catch(() => {});
      }
    });

    return () => {
      hlsInstances.current.forEach((hls) => hls?.destroy());
      hlsInstances.current = [null, null, null, null];
    };
  }, [state.slots]);

  // Handle Remote Control D-Pad & Actions
  useEffect(() => {
    const handleRemote = (action) => {
      if (fullscreenSlot !== null) {
        if (action === TV_KEYS.BACK) {
          setFullscreenSlot(null);
          return true;
        }
        return false;
      }

      switch (action) {
        case TV_KEYS.UP:
          multiViewService.navigate('UP');
          return true;
        case TV_KEYS.DOWN:
          multiViewService.navigate('DOWN');
          return true;
        case TV_KEYS.LEFT:
          multiViewService.navigate('LEFT');
          return true;
        case TV_KEYS.RIGHT:
          multiViewService.navigate('RIGHT');
          return true;
        case TV_KEYS.ENTER:
          // Expand focused slot to fullscreen
          setFullscreenSlot(state.focusedSlotIndex);
          return true;
        case TV_KEYS.BACK:
          onClose();
          return true;
        default:
          break;
      }
      return false;
    };

    const unsub = remoteKeyManager.subscribe(handleRemote);
    return () => unsub();
  }, [fullscreenSlot, state.focusedSlotIndex, onClose]);

  const activeSlots =
    state.mode === MULTIVIEW_MODES.DUAL ? state.slots.slice(0, 2) : state.slots;

  return (
    <div className="tv-multiview-overlay">
      {/* Top Multi-View Status Bar */}
      <div className="tv-multiview-bar">
        <div className="tv-multiview-title">
          <Grid size={24} color="#38bdf8" />
          <span>65" MULTI-VIEW DASHBOARD • العرض المتعدد</span>
          <span className="tv-multiview-badge">
            {state.mode === MULTIVIEW_MODES.QUAD ? '4 STREAMS (QUAD)' : '2 STREAMS (DUAL)'}
          </span>
        </div>

        <div className="tv-multiview-hints">
          <span>◄ / ► / ▲ / ▼ تبديل الصوت والصورة</span>
          <span>•</span>
          <span>[OK] تكبير للشاشة الكاملة</span>
          <span>•</span>
          <span>[Back] رجوع</span>
        </div>

        <div className="tv-multiview-actions">
          <button
            className="tv-multiview-mode-btn"
            onClick={() =>
              multiViewService.setMode(
                state.mode === MULTIVIEW_MODES.QUAD ? MULTIVIEW_MODES.DUAL : MULTIVIEW_MODES.QUAD
              )
            }
          >
            {state.mode === MULTIVIEW_MODES.QUAD ? <Columns size={18} /> : <Grid size={18} />}
            <span>{state.mode === MULTIVIEW_MODES.QUAD ? 'Dual (1x2)' : 'Quad (2x2)'}</span>
          </button>
          <button className="tv-multiview-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Video Screens Layout */}
      <div
        className={`tv-multiview-grid ${
          fullscreenSlot !== null
            ? 'tv-multiview-fullscreen'
            : state.mode === MULTIVIEW_MODES.DUAL
            ? 'tv-multiview-dual'
            : 'tv-multiview-quad'
        }`}
      >
        {activeSlots.map((slot, idx) => {
          const isFocused = state.focusedSlotIndex === idx;
          const isHiddenByFullscreen = fullscreenSlot !== null && fullscreenSlot !== idx;
          if (isHiddenByFullscreen) return null;

          return (
            <div
              key={slot.id}
              className={`tv-multiview-slot ${isFocused ? 'tv-slot-focused' : ''} ${
                fullscreenSlot === idx ? 'tv-slot-fullscreen' : ''
              }`}
              onClick={() => {
                if (isFocused) {
                  setFullscreenSlot(idx);
                } else {
                  multiViewService.setAudioFocus(idx);
                }
              }}
            >
              <video
                ref={videoRefs[idx]}
                className="tv-multiview-video"
                muted={slot.isMuted}
                playsInline
                autoPlay
              />

              {/* Slot Overlay Info */}
              <div className="tv-slot-header">
                <div className="tv-slot-channel-badge">
                  {slot.channel?.logo ? (
                    <img src={slot.channel.logo} alt="" className="tv-slot-logo" />
                  ) : (
                    <Tv size={16} />
                  )}
                  <span>{slot.channel?.name || `Feed #${idx + 1}`}</span>
                </div>

                <div className="tv-slot-audio-badge">
                  {!slot.isMuted ? (
                    <span className="tv-audio-active">
                      <Volume2 size={16} color="#38bdf8" />
                      <span>صوت نشط (Audio Active)</span>
                    </span>
                  ) : (
                    <span className="tv-audio-muted">
                      <VolumeX size={16} color="#64748b" />
                    </span>
                  )}
                </div>
              </div>

              {isFocused && (
                <div className="tv-slot-focus-glow">
                  <span className="tv-slot-hint">اضغط OK للتكبير الكامل</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
