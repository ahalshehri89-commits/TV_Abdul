import React, { useEffect, useState } from 'react';
import { Trophy, Radio, Clock, CheckCircle, Tv, MapPin, AlertTriangle } from 'lucide-react';
import { sportsService, groupMatches, formatKickoff } from '../services/sportsService.js';

const LIVE_SPORTS_CHANNELS = [
  {
    id: 'live-ch-bahrain-1',
    name: 'Bahrain Sports 1 HD',
    nameAr: 'البحرين الرياضية 1',
    flag: '🇧🇭',
    url: 'https://5c7b683162943.streamlock.net/live/ngrp:sportsone_all/playlist.m3u8'
  },
  {
    id: 'live-ch-oman-sports',
    name: 'Oman Sports HD',
    nameAr: 'عُمان الرياضية',
    flag: '🇴🇲',
    url: 'https://partneta.cdn.mgmlcdn.com/omsport/smil:omsport.stream.smil/chunklist.m3u8'
  },
  {
    id: 'live-ch-jordan-sport',
    name: 'Jordan Sport HD',
    nameAr: 'الأردن الرياضية',
    flag: '🇯🇴',
    url: 'https://jrtv-live.ercdn.net/jordansporthd/jordansporthd.m3u8'
  },
  {
    id: 'live-ch-bahrain-2',
    name: 'Bahrain Sports 2 HD',
    nameAr: 'البحرين الرياضية 2',
    flag: '🇧🇭',
    url: 'https://5c7b683162943.streamlock.net/live/ngrp:bahrainsportstwo_all/playlist.m3u8'
  },
  {
    id: 'live-ch-ktv-sport',
    name: 'KTV Sport Plus HD',
    nameAr: 'كويت سبورت بلس',
    flag: '🇰🇼',
    url: 'https://kwtsplta.cdn.mangomolo.com/spl/smil:spl.stream.smil/chunklist.m3u8'
  },
  {
    id: 'live-ch-iraqia-sport',
    name: 'Al Iraqia Sport HD',
    nameAr: 'العراقية الرياضية',
    flag: '🇮🇶',
    url: 'https://imn-live.esite-lab.com/hls/iraqia-sports-1.m3u8'
  },
  {
    id: 'live-ch-redbull-tv',
    name: 'Red Bull TV Sports',
    nameAr: 'ريد بول للرياضات العالمية',
    flag: '🔴',
    url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8'
  }
];

export function SportsMatchCenter({ onTuneChannel }) {
  const [state, setState] = useState({ status: 'loading', matches: [], error: null, stale: false, fetchedAt: 0 });

  useEffect(() => {
    let cancelled = false;
    const refresh = (force) =>
      sportsService.load({ force }).then((result) => {
        if (!cancelled) setState({ status: 'ready', ...result });
      });
    refresh(false);
    // Scores move during matches; refresh every few minutes while the screen is open.
    const timer = setInterval(() => refresh(true), 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const handleTuneSportsChannel = (ch) => {
    onTuneChannel({
      id: ch.id,
      number: 1,
      name: `${ch.nameAr} (${ch.name})`,
      logo: null,
      streams: [{ url: ch.url, quality: '1080p Full HD' }],
      youtubeId: ch.youtubeId,
      country: 'SA',
      categories: ['sports']
    });
  };

  const getTeamLogoFallback = (name) =>
    `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="%231e293b" stroke="%2338bdf8" stroke-width="2"/><text x="32" y="38" font-family="sans-serif" font-size="14" font-weight="bold" fill="%2338bdf8" text-anchor="middle">${encodeURIComponent((name || 'FC').slice(0, 3))}</text></svg>`;

  const { live, upcoming, results } = groupMatches(state.matches);

  const renderTeam = (team) => (
    <div className="tv-match-team">
      <img
        src={team.badge || getTeamLogoFallback(team.name)}
        alt={team.name}
        className="tv-match-logo"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = getTeamLogoFallback(team.name);
        }}
      />
      <span className="tv-match-team-name">{team.name}</span>
    </div>
  );

  // Match cards are information only. They are focusable so the remote can scroll through them.
  const renderMatch = (match) => {
    const isLive = match.status === 'live';
    const inProgress = match.status === 'in_progress';
    return (
      <div
        key={match.id}
        className={`tv-match-card ${isLive || inProgress ? 'tv-match-card-live' : ''}`}
        tabIndex={0}
        data-nav="true"
        data-nav-zone="grid"
        data-nav-id={`match-${match.id}`}
      >
        <div className="tv-match-card-top">
          <span className="tv-match-league">
            {match.leagueAr} • {match.league}
            {match.round ? ` • Round ${match.round}` : ''}
          </span>
          {isLive && (
            <span className="tv-match-live-tag">
              <Radio size={14} />
              <span>LIVE</span>
            </span>
          )}
          {inProgress && (
            <span className="tv-match-live-tag">
              <Radio size={14} />
              <span>Under way</span>
            </span>
          )}
          {match.status === 'upcoming' && (
            <span className="tv-match-time-tag">
              <Clock size={13} />
              <span>{formatKickoff(match.kickoff)}</span>
            </span>
          )}
          {match.status === 'finished' && (
            <span className="tv-match-time-tag">
              <CheckCircle size={13} />
              <span>Full time • {formatKickoff(match.kickoff)}</span>
            </span>
          )}
        </div>

        <div className="tv-match-scoreboard">
          {renderTeam(match.home)}
          {match.score ? (
            <div className="tv-match-score-box">
              <div className="tv-match-score">{match.score}</div>
            </div>
          ) : (
            <div className="tv-match-vs-box">
              <span className="tv-match-vs">VS</span>
              <span className="tv-match-kickoff">
                {inProgress ? 'Score not reported yet' : formatKickoff(match.kickoff)}
              </span>
            </div>
          )}
          {renderTeam(match.away)}
        </div>

        {match.venue && (
          <div className="tv-match-card-footer">
            <div className="tv-match-channel-info">
              <MapPin size={14} color="#94a3b8" />
              <span>{match.venue}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSection = (title, icon, matches) =>
    matches.length > 0 && (
      <div className="tv-sports-section">
        <div className="tv-sports-section-title-wrap">
          {icon}
          <h3 className="tv-sports-section-title">{title}</h3>
        </div>
        <div className="tv-sports-grid">{matches.map(renderMatch)}</div>
      </div>
    );

  return (
    <div className="tv-sports-center">
      <div className="tv-sports-header">
        <div className="tv-sports-header-title">
          <Trophy size={28} color="#eab308" />
          <h2>مركز المباريات • Match Centre</h2>
        </div>
        <div className="tv-sports-header-sub">
          Fixtures and results for the Saudi Pro League, Premier League, Champions League and La Liga.
          Matches are listed for information; scores can arrive a few minutes late.
        </div>
      </div>

      {/* 24/7 Live Sports Dedicated Channels Bar */}
      <div className="tv-sports-channels-section">
        <div className="tv-sports-channels-header">
          <Tv size={20} color="#38bdf8" />
          <span>القنوات الرياضية المفتوحة (Free 24/7 sports channels):</span>
        </div>
        <div className="tv-sports-channels-bar" role="tablist">
          {LIVE_SPORTS_CHANNELS.map((ch) => (
            <button
              key={ch.id}
              className="tv-sports-channel-pill"
              data-nav="true"
              data-nav-zone="categories"
              data-nav-id={`pill-${ch.id}`}
              onClick={() => handleTuneSportsChannel(ch)}
            >
              <span className="tv-sports-pill-flag">{ch.flag}</span>
              <span className="tv-sports-pill-name">{ch.nameAr}</span>
              <span className="tv-sports-pill-badge">مباشر HD</span>
            </button>
          ))}
        </div>
      </div>

      {state.error && (
        <div className="tv-sports-notice">
          <AlertTriangle size={18} color="#f59e0b" />
          <span>
            {state.error}
            {state.stale && state.fetchedAt ? ` Showing fixtures saved ${formatKickoff(state.fetchedAt)}.` : ''}
          </span>
        </div>
      )}

      {state.status === 'loading' && (
        <div className="tv-files-empty" style={{ minHeight: '300px' }}>
          <div className="tv-spinner" />
        </div>
      )}

      {state.status === 'ready' && state.matches.length === 0 && (
        <div className="tv-files-empty" style={{ minHeight: '300px' }}>
          <Trophy size={64} color="#475569" />
          <h3>No fixtures available right now</h3>
        </div>
      )}

      {renderSection('مباريات جارية • Under way', <span className="tv-live-dot pulse" />, live)}
      {renderSection('المباريات القادمة • Upcoming', <Clock size={20} color="#94a3b8" />, upcoming)}
      {renderSection('آخر النتائج • Latest results', <CheckCircle size={20} color="#94a3b8" />, results)}
    </div>
  );
}
