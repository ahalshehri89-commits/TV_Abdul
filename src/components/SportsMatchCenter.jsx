import React from 'react';
import { Trophy, Play, Radio, Clock, Shield, Volume2 } from 'lucide-react';
import { sportsService } from '../services/sportsService.js';

export function SportsMatchCenter({ onTuneChannel }) {
  const matches = sportsService.getMatches();
  const liveMatches = matches.filter((m) => m.status === 'live');
  const upcomingMatches = matches.filter((m) => m.status === 'upcoming');

  const handleTuneMatch = (match) => {
    onTuneChannel({
      id: match.id,
      number: 1,
      name: `${match.homeTeam.nameAr} ضد ${match.awayTeam.nameAr} (${match.broadcastChannelName})`,
      logo: match.homeTeam.logo,
      streams: [{ url: match.targetStreamUrl, quality: '1080p' }],
      country: 'SA',
      categories: ['sports']
    });
  };

  return (
    <div className="tv-sports-center">
      <div className="tv-sports-header">
        <div className="tv-sports-header-title">
          <Trophy size={28} color="#eab308" />
          <h2>مركز المباريات والرياضة المباشرة • Live Match Center</h2>
        </div>
        <div className="tv-sports-header-sub">
          جدول مباريات دوري روشن السعودي، دوري أبطال أوروبا والدوريات الكبرى مع البث المباشر الفوري
        </div>
      </div>

      {/* Live Matches Section */}
      {liveMatches.length > 0 && (
        <div className="tv-sports-section">
          <div className="tv-sports-section-title-wrap">
            <span className="tv-live-dot pulse" />
            <h3 className="tv-sports-section-title">مباريات جارية الآن • LIVE NOW</h3>
          </div>

          <div className="tv-sports-grid">
            {liveMatches.map((match) => (
              <div
                key={match.id}
                className="tv-match-card tv-match-card-live"
                tabIndex={0}
                data-nav="true"
                data-nav-zone="grid"
                data-nav-id={`match-${match.id}`}
                onClick={() => handleTuneMatch(match)}
              >
                <div className="tv-match-card-top">
                  <span className="tv-match-league">{match.leagueAr} • {match.round}</span>
                  <span className="tv-match-live-tag">
                    <Radio size={14} />
                    <span>مباشر {match.minute}</span>
                  </span>
                </div>

                <div className="tv-match-scoreboard">
                  {/* Home Team */}
                  <div className="tv-match-team">
                    <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="tv-match-logo" />
                    <span className="tv-match-team-name">{match.homeTeam.nameAr}</span>
                    <span className="tv-match-team-en">{match.homeTeam.name}</span>
                  </div>

                  {/* Score */}
                  <div className="tv-match-score-box">
                    <div className="tv-match-score">{match.score}</div>
                    <div className="tv-match-status-label">{match.minute}</div>
                  </div>

                  {/* Away Team */}
                  <div className="tv-match-team">
                    <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="tv-match-logo" />
                    <span className="tv-match-team-name">{match.awayTeam.nameAr}</span>
                    <span className="tv-match-team-en">{match.awayTeam.name}</span>
                  </div>
                </div>

                <div className="tv-match-card-footer">
                  <div className="tv-match-channel-info">
                    <Volume2 size={15} color="#38bdf8" />
                    <span>{match.commentary}</span>
                  </div>
                  <div className="tv-match-tune-btn">
                    <Play size={16} fill="#ffffff" />
                    <span>مشاهدة البث • {match.broadcastChannelName}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Fixtures Section */}
      <div className="tv-sports-section">
        <div className="tv-sports-section-title-wrap">
          <Clock size={20} color="#94a3b8" />
          <h3 className="tv-sports-section-title">المباريات القادمة • UPCOMING FIXTURES</h3>
        </div>

        <div className="tv-sports-grid">
          {upcomingMatches.map((match) => (
            <div
              key={match.id}
              className="tv-match-card"
              tabIndex={0}
              data-nav="true"
              data-nav-zone="grid"
              data-nav-id={`match-${match.id}`}
              onClick={() => handleTuneMatch(match)}
            >
              <div className="tv-match-card-top">
                <span className="tv-match-league">{match.leagueAr} • {match.round}</span>
                <span className="tv-match-time-tag">
                  <Clock size={13} />
                  <span>{match.time}</span>
                </span>
              </div>

              <div className="tv-match-scoreboard">
                <div className="tv-match-team">
                  <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="tv-match-logo" />
                  <span className="tv-match-team-name">{match.homeTeam.nameAr}</span>
                  <span className="tv-match-team-en">{match.homeTeam.name}</span>
                </div>

                <div className="tv-match-vs-box">
                  <span className="tv-match-vs">VS</span>
                  <span className="tv-match-kickoff">{match.time}</span>
                </div>

                <div className="tv-match-team">
                  <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="tv-match-logo" />
                  <span className="tv-match-team-name">{match.awayTeam.nameAr}</span>
                  <span className="tv-match-team-en">{match.awayTeam.name}</span>
                </div>
              </div>

              <div className="tv-match-card-footer">
                <div className="tv-match-channel-info">
                  <Shield size={14} color="#94a3b8" />
                  <span>{match.broadcastChannelName} ({match.commentary})</span>
                </div>
                <div className="tv-match-tune-btn tv-match-tune-upcoming">
                  <Play size={14} />
                  <span>انتقل للقناة الناقلة</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
