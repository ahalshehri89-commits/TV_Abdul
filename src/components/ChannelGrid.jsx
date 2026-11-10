import React from 'react';
import { ChannelCard } from './ChannelCard.jsx';
import { Tv, HeartOff } from 'lucide-react';

export function ChannelGrid({
  channels,
  totalCount = channels.length,
  loading,
  onPlay,
  favoritesSet,
  onToggleFavorite,
  category
}) {
  if (loading && channels.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px'
        }}
      >
        <div className="tv-spinner" />
        <span style={{ color: '#94a3b8', fontSize: '20px' }}>Loading channels...</span>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          color: '#94a3b8'
        }}
      >
        {category === 'favorites' ? (
          <>
            <HeartOff size={64} color="#64748b" />
            <h3 style={{ fontSize: '24px', color: '#f8fafc' }}>No Favorite Channels Yet</h3>
            <p style={{ fontSize: '16px' }}>
              Browse any category and press Enter or Info on a channel to add it to your favorites.
            </p>
          </>
        ) : (
          <>
            <Tv size={64} color="#64748b" />
            <h3 style={{ fontSize: '24px', color: '#f8fafc' }}>No Channels Found</h3>
            <p style={{ fontSize: '16px' }}>Try selecting another category or clearing search filters.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="tv-grid-scroll-area">
      <div className="tv-channel-grid">
        {channels.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            onPlay={onPlay}
            isFavorite={favoritesSet.has(channel.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
      {totalCount > channels.length && (
        <div style={{ textAlign: 'center', padding: '24px 0 16px', color: '#94a3b8', fontSize: '16px' }}>
          Showing {channels.length} of {totalCount} channels • Navigate down to load more
        </div>
      )}
    </div>
  );
}
