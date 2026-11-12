import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Clock, Play, Tv } from 'lucide-react';
import { epgService } from '../services/epgService.js';
import { catalogService } from '../services/catalogService.js';
import { remoteKeyManager, TV_KEYS } from '../services/remoteKeyManager.js';
import { uiLock } from '../services/uiLock.js';

/**
 * Programme guide. Lists only the channels that have real schedule data;
 * Up/Down chooses a channel, OK tunes to it, Back closes.
 */
export function EPGModal({ onClose, onTuneChannel }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState('loading');
  const [, setVersion] = useState(0);
  const listRef = useRef(null);
  const stateRef = useRef({ channels: [], index: 0 });

  useEffect(() => {
    const unsubscribe = epgService.subscribe(() => setVersion((v) => v + 1));
    epgService.load().then(() => setStatus('ready'));
    return unsubscribe;
  }, []);

  const now = new Date();
  const channels = catalogService
    .getChannels({ category: 'all', country: 'all' })
    .items.filter((ch) => epgService.hasGuide(ch.id, now));
  const index = Math.min(selectedIndex, Math.max(0, channels.length - 1));
  const selectedChannel = channels[index] || null;
  stateRef.current = { channels, index };

  useEffect(() => {
    const release = uiLock.acquire();
    const unsubscribe = remoteKeyManager.subscribe((action) => {
      const { channels: list, index: current } = stateRef.current;
      switch (action.type) {
        case TV_KEYS.DOWN:
          if (list.length > 0) setSelectedIndex((current + 1) % list.length);
          return true;
        case TV_KEYS.UP:
          if (list.length > 0) setSelectedIndex((current - 1 + list.length) % list.length);
          return true;
        case TV_KEYS.CH_DOWN:
          if (list.length > 0) setSelectedIndex(Math.min(list.length - 1, current + 8));
          return true;
        case TV_KEYS.CH_UP:
          if (list.length > 0) setSelectedIndex(Math.max(0, current - 8));
          return true;
        case TV_KEYS.ENTER:
          if (list[current]) onTuneChannel(list[current]);
          return true;
        case TV_KEYS.BACK:
          onClose();
          return true;
        default:
          return true;
      }
    });
    return () => {
      unsubscribe();
      release();
    };
  }, [onClose, onTuneChannel]);

  // Keep the chosen channel row in view
  useEffect(() => {
    const row = listRef.current && listRef.current.querySelector('.tv-epg-channel-row.selected');
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
  }, [index, channels.length]);

  const schedule = selectedChannel ? epgService.getChannelSchedule(selectedChannel.id, now) : [];
  const nowPlaying = selectedChannel ? epgService.getNowPlaying(selectedChannel.id, now) : null;

  return (
    <div className="tv-modal-backdrop" onClick={onClose}>
      <div className="tv-epg-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="tv-epg-header">
          <div className="tv-epg-header-title">
            <Calendar size={24} color="#38bdf8" />
            <h2>دليل البرامج • Programme Guide</h2>
          </div>
          <div className="tv-epg-header-time">
            <Clock size={16} />
            <span>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="tv-osd-hints" style={{ margin: 0 }}>
            <span>
              <span className="tv-remote-key">▲ / ▼</span> Channel
            </span>
            <span>
              <span className="tv-remote-key">OK</span> Watch
            </span>
            <span>
              <span className="tv-remote-key">BACK</span> Close
            </span>
          </div>
        </div>

        {channels.length === 0 ? (
          <div className="tv-files-empty" style={{ minHeight: '520px' }}>
            {status === 'loading' ? (
              <div className="tv-spinner" />
            ) : (
              <>
                <Calendar size={64} color="#475569" />
                <h3>No programme guide available</h3>
                <p>The guide is downloaded once a day and covers only channels that publish a schedule.</p>
              </>
            )}
          </div>
        ) : (
          <div className="tv-epg-body">
            <div className="tv-epg-channels-col">
              <div className="tv-epg-col-title">القنوات • {channels.length} channels with a guide</div>
              <div className="tv-epg-channels-list" ref={listRef}>
                {channels.map((ch, idx) => {
                  const info = epgService.getNowPlaying(ch.id, now);
                  return (
                    <div key={ch.id} className={`tv-epg-channel-row ${idx === index ? 'selected' : ''}`}>
                      <div className="tv-epg-channel-meta">
                        {ch.logo ? <img src={ch.logo} alt="" className="tv-epg-channel-logo" /> : <Tv size={18} />}
                        <span className="tv-epg-channel-name">{ch.name}</span>
                      </div>
                      {info && <span className="tv-epg-now-badge">{info.current.title}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="tv-epg-schedule-col">
              {selectedChannel && (
                <>
                  <div className="tv-epg-selected-header">
                    <div className="tv-epg-selected-info">
                      <h3>{selectedChannel.name}</h3>
                      {nowPlaying && (
                        <div className="tv-epg-now-playing-banner">
                          <span className="tv-live-dot" />
                          <strong>يعرض الآن: </strong>
                          <span>{nowPlaying.current.title}</span>
                          <div className="tv-epg-progress-bar-wrap">
                            <div className="tv-epg-progress-bar-fill" style={{ width: `${nowPlaying.progressPercent}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="tv-btn-primary" style={{ pointerEvents: 'none' }}>
                      <Play size={18} fill="#ffffff" />
                      <span>OK • مشاهدة القناة</span>
                    </div>
                  </div>

                  <div className="tv-epg-programs-list">
                    {schedule.slice(0, 12).map((prog) => {
                      const isNow = nowPlaying && nowPlaying.current.id === prog.id;
                      return (
                        <div key={prog.id} className={`tv-epg-program-card ${isNow ? 'now-playing' : ''}`}>
                          <div className="tv-epg-program-time">
                            <span>
                              {prog.startTimeStr} - {prog.endTimeStr}
                            </span>
                            <span className="tv-epg-prog-dur">{prog.durationMinutes} دقيقة</span>
                          </div>
                          <div className="tv-epg-program-details">
                            <h4>{prog.title}</h4>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
