import React, { useState } from 'react';
import { Calendar, Clock, Play, X, Tv } from 'lucide-react';
import { epgService } from '../services/epgService.js';

export function EPGModal({ channels = [], onClose, onTuneChannel }) {
  const [selectedChannelIndex, setSelectedChannelIndex] = useState(0);
  const activeChannels = channels.slice(0, 30);
  const selectedChannel = activeChannels[selectedChannelIndex] || activeChannels[0];

  const now = new Date();
  const schedule = selectedChannel ? epgService.getChannelSchedule(selectedChannel.id, now) : [];
  const nowPlaying = selectedChannel ? epgService.getNowPlaying(selectedChannel.id, now) : null;

  return (
    <div className="tv-modal-backdrop" onClick={onClose}>
      <div className="tv-epg-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tv-epg-header">
          <div className="tv-epg-header-title">
            <Calendar size={24} color="#38bdf8" />
            <h2>دليل البرامج الإلكتروني (EPG Guide)</h2>
          </div>
          <div className="tv-epg-header-time">
            <Clock size={16} />
            <span>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <button
            className="tv-modal-close-btn"
            data-nav="true"
            data-nav-zone="modal"
            data-nav-id="btn-close-epg"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* EPG Body */}
        <div className="tv-epg-body">
          {/* Left Column: Channels List */}
          <div className="tv-epg-channels-col">
            <div className="tv-epg-col-title">القنوات • Channels</div>
            <div className="tv-epg-channels-list">
              {activeChannels.map((ch, idx) => {
                const isSelected = idx === selectedChannelIndex;
                const info = epgService.getNowPlaying(ch.id, now);
                return (
                  <button
                    key={ch.id}
                    className={`tv-epg-channel-row ${isSelected ? 'selected' : ''}`}
                    data-nav="true"
                    data-nav-zone="modal"
                    data-nav-id={`epg-ch-${ch.id}`}
                    onClick={() => setSelectedChannelIndex(idx)}
                  >
                    <div className="tv-epg-channel-meta">
                      {ch.logo ? (
                        <img src={ch.logo} alt="" className="tv-epg-channel-logo" />
                      ) : (
                        <Tv size={18} />
                      )}
                      <span className="tv-epg-channel-name">{ch.name}</span>
                    </div>
                    {info?.current && (
                      <span className="tv-epg-now-badge">
                        الآن: {info.current.title.split('•')[0]} ({info.progressPercent}%)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Timeline Schedule for Selected Channel */}
          <div className="tv-epg-schedule-col">
            {selectedChannel && (
              <>
                <div className="tv-epg-selected-header">
                  <div className="tv-epg-selected-info">
                    <h3>{selectedChannel.name}</h3>
                    {nowPlaying?.current && (
                      <div className="tv-epg-now-playing-banner">
                        <span className="tv-live-dot" />
                        <strong>يعرض الآن: </strong>
                        <span>{nowPlaying.current.title}</span>
                        <div className="tv-epg-progress-bar-wrap">
                          <div
                            className="tv-epg-progress-bar-fill"
                            style={{ width: `${nowPlaying.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    className="tv-btn-primary"
                    data-nav="true"
                    data-nav-zone="modal"
                    data-nav-id="btn-epg-tune"
                    onClick={() => onTuneChannel(selectedChannel)}
                  >
                    <Play size={18} fill="#ffffff" />
                    <span>مشاهدة القناة</span>
                  </button>
                </div>

                {/* Schedule Items */}
                <div className="tv-epg-programs-list">
                  {schedule.map((prog) => {
                    const isNow =
                      now.getTime() >= prog.startTime.getTime() &&
                      now.getTime() < prog.endTime.getTime();
                    return (
                      <div
                        key={prog.id}
                        className={`tv-epg-program-card ${isNow ? 'now-playing' : ''}`}
                      >
                        <div className="tv-epg-program-time">
                          <span>{prog.startTimeStr} - {prog.endTimeStr}</span>
                          <span className="tv-epg-prog-dur">{prog.durationMinutes} دقيقة</span>
                        </div>
                        <div className="tv-epg-program-details">
                          <h4>{prog.title}</h4>
                          <p>{prog.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
