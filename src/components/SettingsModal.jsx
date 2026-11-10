import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService.js';
import { catalogService } from '../services/catalogService.js';
import { remoteKeyManager, TV_KEYS } from '../services/remoteKeyManager.js';
import { spatialNav } from '../services/spatialNav.js';
import { Settings, X, Trash2, CheckCircle, Info, RefreshCw, Cloud, Plus, List } from 'lucide-react';

export function SettingsModal({ onClose, onRefreshData }) {
  const [settings, setSettings] = useState(storageService.getSettings());
  const [customUrl, setCustomUrl] = useState('');
  const [playlists, setPlaylists] = useState(storageService.getCustomPlaylists());
  const [statusMsg, setStatusMsg] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const isTizen = typeof window !== 'undefined' && Boolean(window.tizen);
  const hasAVPlay = typeof window !== 'undefined' && Boolean(window.webapis && window.webapis.avplay);

  useEffect(() => {
    spatialNav.pushScope('.tv-modal-content');
    setTimeout(() => spatialNav.focusFirst(), 80);

    const unsubscribe = remoteKeyManager.subscribe((action) => {
      switch (action.type) {
        case TV_KEYS.BACK:
          onClose();
          return true;
        case TV_KEYS.UP:
          spatialNav.move('UP');
          return true;
        case TV_KEYS.DOWN:
          spatialNav.move('DOWN');
          return true;
        case TV_KEYS.LEFT:
          spatialNav.move('LEFT');
          return true;
        case TV_KEYS.RIGHT:
          spatialNav.move('RIGHT');
          return true;
        case TV_KEYS.ENTER: {
          const focused = document.activeElement;
          if (focused && focused.getAttribute('data-nav') === 'true') {
            focused.click();
            return true;
          }
          break;
        }
        default:
          break;
      }
      return false;
    });

    return () => {
      spatialNav.popScope();
      unsubscribe();
    };
  }, [onClose]);

  const handleClearHistory = () => {
    try {
      localStorage.removeItem('freetv:recent');
      setStatusMsg('Recently watched history cleared.');
      if (onRefreshData) onRefreshData();
    } catch (e) {}
  };

  const handleSyncCloud = async () => {
    setIsSyncing(true);
    setStatusMsg('Connecting to IPTV cloud CDN...');
    try {
      const res = await catalogService.syncCloud({
        force: true,
        onProgress: (p) => setStatusMsg(p)
      });
      if (res.status === 'success') {
        setStatusMsg(`✔ Successfully synced ${res.count} channels from cloud!`);
        if (onRefreshData) onRefreshData();
      } else {
        setStatusMsg('Channel list is already up to date.');
      }
    } catch (err) {
      setStatusMsg('Failed to sync with cloud. Please check network.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearFavorites = () => {
    try {
      localStorage.removeItem('freetv:favorites');
      setStatusMsg('Favorites list reset.');
      if (onRefreshData) onRefreshData();
    } catch (e) {}
  };

  return (
    <div className="tv-modal-backdrop" onClick={onClose}>
      <div className="tv-modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Settings size={28} color="#38bdf8" />
            <h2 style={{ fontSize: '28px', color: '#ffffff' }}>TV_Abdul Settings</h2>
          </div>
          <button
            className="tv-header-btn"
            data-nav="true"
            data-nav-id="btn-close-settings"
            onClick={onClose}
          >
            <X size={18} />
            <span>Close (Back)</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.5)',
              padding: '20px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>App Version</span>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>TV_Abdul v2.0.0 (Native Tizen 7.0 - Next-Gen Entertainment)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Playback Engine</span>
              <span style={{ color: hasAVPlay ? '#10b981' : '#38bdf8', fontWeight: 600 }}>
                {hasAVPlay ? 'Samsung AVPlay (Native 4K & VLC Demuxer)' : 'HTML5 + mpegts.js / Hls.js'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Tizen OS Environment</span>
              <span style={{ color: isTizen ? '#10b981' : '#94a3b8', fontWeight: 600 }}>
                {isTizen ? 'Detected (Samsung Smart TV 65" QLED)' : 'Simulated / Browser Mode'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Multi-View Engine</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Enabled (65" Quad 2x2 & Dual 1x2)</span>
            </div>
          </div>

          {/* Custom M3U / Xtream Codes Section */}
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.4)',
              padding: '16px 20px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <List size={18} color="#38bdf8" />
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                Custom M3U8 Playlist Loader (قوائم التشغيل الخاصة)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="https://example.com/playlist.m3u8"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: '#ffffff',
                  fontSize: '15px'
                }}
              />
              <button
                className="tv-header-btn"
                data-nav="true"
                data-nav-id="btn-add-playlist"
                onClick={() => {
                  if (customUrl) {
                    const updated = storageService.addCustomPlaylist(customUrl);
                    setPlaylists(updated);
                    setCustomUrl('');
                    setStatusMsg('Custom playlist added successfully.');
                    if (onRefreshData) onRefreshData();
                  }
                }}
              >
                <Plus size={16} />
                <span>Add M3U</span>
              </button>
            </div>
            {playlists.length > 0 && (
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                Active Playlists: {playlists.join(', ')}
              </div>
            )}
          </div>

          {statusMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '16px' }}>
              <CheckCircle size={18} />
              <span>{statusMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
            <button
              className="tv-header-btn"
              style={{ background: 'rgba(14, 165, 233, 0.2)', borderColor: '#38bdf8', color: '#ffffff' }}
              data-nav="true"
              data-nav-id="btn-sync-cloud"
              onClick={handleSyncCloud}
              disabled={isSyncing}
            >
              <RefreshCw size={18} color="#38bdf8" className={isSyncing ? 'tv-spinner' : ''} />
              <span>{isSyncing ? 'Syncing...' : 'Update Channels from Cloud Now'}</span>
            </button>

            <button
              className="tv-header-btn"
              style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              data-nav="true"
              data-nav-id="btn-clear-history"
              onClick={handleClearHistory}
            >
              <Trash2 size={18} color="#ef4444" />
              <span>Clear History</span>
            </button>

            <button
              className="tv-header-btn"
              style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              data-nav="true"
              data-nav-id="btn-clear-favs"
              onClick={handleClearFavorites}
            >
              <Trash2 size={18} color="#ef4444" />
              <span>Reset Favorites</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
