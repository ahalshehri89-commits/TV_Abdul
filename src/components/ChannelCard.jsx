import React, { useState, useRef } from 'react';
import { Heart, Radio } from 'lucide-react';
import { storageService } from '../services/storageService.js';

export function ChannelCard({ channel, onPlay, isFavorite, onToggleFavorite }) {
  const [logoError, setLogoError] = useState(false);
  const longPressTimerRef = useRef(null);
  const isLongPressRef = useRef(false);

  const initials = (channel.name || 'TV')
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    onToggleFavorite(channel.id);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (!longPressTimerRef.current) {
        isLongPressRef.current = false;
        longPressTimerRef.current = setTimeout(() => {
          isLongPressRef.current = true;
          onToggleFavorite(channel.id);
        }, 550);
      }
    }
  };

  const handleKeyUp = (e) => {
    if (e.key === 'Enter') {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (!isLongPressRef.current) {
        onPlay(channel);
      }
      isLongPressRef.current = false;
    }
  };

  return (
    <div
      className={`tv-channel-card ${isFavorite ? 'tv-card-favorited' : ''}`}
      data-nav="true"
      data-nav-zone="grid"
      data-nav-id={`channel-${channel.id}`}
      tabIndex={0}
      onClick={() => onPlay(channel)}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <div className="tv-card-top">
        <span className="tv-channel-number">#{channel.number || '•'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            className="tv-card-fav-btn"
            title="Toggle Favorite (Press Info or hold OK)"
            onClick={handleFavoriteClick}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Heart
              size={18}
              color={isFavorite ? '#f43f5e' : 'rgba(255, 255, 255, 0.4)'}
              fill={isFavorite ? '#f43f5e' : 'none'}
              className="tv-fav-icon"
            />
          </button>
          <span className="tv-quality-badge">{channel.bestQuality || 'HD'}</span>
        </div>
      </div>

      <div className="tv-card-center">
        {!logoError && channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="tv-channel-logo"
            loading="lazy"
            onError={() => setLogoError(true)}
          />
        ) : (
          <div className="tv-logo-fallback">
            <span>{initials}</span>
          </div>
        )}
      </div>

      <div className="tv-card-bottom">
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <span className="tv-channel-name" title={channel.name}>
            {channel.name}
          </span>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>
            {channel.flag || '📺'} {channel.countryName || channel.country || ''}
          </span>
        </div>
      </div>
    </div>
  );
}
