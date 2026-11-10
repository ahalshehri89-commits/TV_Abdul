import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Heart } from 'lucide-react';
import { Header } from './components/Header.jsx';
import { CategoryBar } from './components/CategoryBar.jsx';
import { ChannelGrid } from './components/ChannelGrid.jsx';
import { VideoPlayerView } from './components/VideoPlayerView.jsx';
import { SearchModal } from './components/SearchModal.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { CountryModal } from './components/CountryModal.jsx';
import { catalogService } from './services/catalogService.js';
import { storageService } from './services/storageService.js';
import { remoteKeyManager, TV_KEYS } from './services/remoteKeyManager.js';
import { spatialNav } from './services/spatialNav.js';

export function App() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeCountry, setActiveCountry] = useState('all');
  const [allChannels, setAllChannels] = useState([]);
  const [visibleLimit, setVisibleLimit] = useState(60);
  const [loading, setLoading] = useState(true);
  const [activeChannel, setActiveChannel] = useState(null);
  const [activeChannelIndex, setActiveChannelIndex] = useState(-1);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [favoritesSet, setFavoritesSet] = useState(new Set(storageService.getFavorites()));
  const [toastMsg, setToastMsg] = useState(null);

  const lastFocusedChannelIdRef = useRef(null);
  const toastTimerRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 2800);
  };

  // Load channels whenever category or country changes (Instant synchronous 0ms)
  const loadChannels = useCallback((catId, countryCode) => {
    try {
      const data = catalogService.getChannels({
        category: catId,
        country: countryCode,
        limit: null
      });
      const items = data.items || [];
      setAllChannels(items);
      setVisibleLimit(60);
    } catch (err) {
      console.warn('Failed to load channels:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels(activeCategory, activeCountry);
  }, [activeCategory, activeCountry, loadChannels]);

  // Subscribe to infinite scroll requests from spatial navigation engine
  useEffect(() => {
    const unsub = spatialNav.onLoadMore(() => {
      setVisibleLimit((prev) => {
        if (prev < allChannels.length) {
          return Math.min(prev + 60, allChannels.length);
        }
        return prev;
      });
    });
    return () => unsub();
  }, [allChannels.length]);

  // Initialize remote key manager and background cloud sync on startup
  useEffect(() => {
    remoteKeyManager.init();
    catalogService.startBackgroundSync();

    const unsubCatalog = catalogService.subscribe((event) => {
      if (event === 'catalogUpdated') {
        loadChannels(activeCategory, activeCountry);
        showToast('Channel list updated with latest streams 🌐');
      }
    });

    // Focus first focusable item on load
    const timer = setTimeout(() => {
      spatialNav.focusFirst();
    }, 400);

    return () => {
      clearTimeout(timer);
      unsubCatalog();
      remoteKeyManager.destroy();
    };
  }, [activeCategory, activeCountry, loadChannels]);

  // Global Remote Control Handler for Home Screen
  useEffect(() => {
    const handleRemoteAction = (action, event) => {
      // If player is active, VideoPlayerView handles its own keys
      if (activeChannel) return false;

      // If modal is active, modal handles its own keys
      if (isSearchOpen || isSettingsOpen || isCountryModalOpen) return false;

      switch (action.type) {
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
        case TV_KEYS.INFO:
        case TV_KEYS.FAVORITE: {
          const focused = document.activeElement;
          const navId = focused?.getAttribute('data-nav-id');
          if (navId && navId.startsWith('channel-')) {
            const chId = navId.replace('channel-', '');
            handleToggleFavorite(chId);
            return true;
          }
          break;
        }
        case TV_KEYS.BACK:
          if (activeCountry !== 'all') {
            setActiveCountry('all');
            return true;
          }
          if (activeCategory !== 'all') {
            setActiveCategory('all');
            return true;
          }
          // If already on All Channels, exit application if on Samsung Tizen
          if (window.tizen && window.tizen.application) {
            try {
              window.tizen.application.getCurrentApplication().exit();
              return true;
            } catch (e) {}
          }
          break;
        case TV_KEYS.SEARCH:
          setIsSearchOpen(true);
          return true;
        default:
          break;
      }
      return false;
    };

    const unsubscribe = remoteKeyManager.subscribe(handleRemoteAction);
    return () => unsubscribe();
  }, [activeChannel, isSearchOpen, isSettingsOpen, isCountryModalOpen, activeCategory, activeCountry]);

  const handlePlayChannel = async (channel) => {
    lastFocusedChannelIdRef.current = `channel-${channel.id}`;
    // Fetch full stream details if not yet fully loaded
    const fullChannel = await catalogService.getChannelDetails(channel.id);
    const resolved = fullChannel || channel;
    const index = allChannels.findIndex((c) => c.id === channel.id);
    setActiveChannelIndex(index);
    setActiveChannel(resolved);
    setIsSearchOpen(false);
  };

  const handleClosePlayer = () => {
    setActiveChannel(null);
    setActiveChannelIndex(-1);
    // Restore focus to last channel card after closing player
    setTimeout(() => {
      if (lastFocusedChannelIdRef.current) {
        spatialNav.focus(lastFocusedChannelIdRef.current);
      } else {
        spatialNav.focusFirst();
      }
    }, 200);
  };

  const handleNextChannel = async () => {
    if (allChannels.length === 0) return;
    const nextIndex = (activeChannelIndex + 1) % allChannels.length;
    const target = allChannels[nextIndex];
    if (target) {
      setActiveChannelIndex(nextIndex);
      if (nextIndex >= visibleLimit) {
        setVisibleLimit((prev) => Math.min(nextIndex + 60, allChannels.length));
      }
      const full = await catalogService.getChannelDetails(target.id);
      setActiveChannel(full || target);
    }
  };

  const handlePreviousChannel = async () => {
    if (allChannels.length === 0) return;
    const prevIndex = (activeChannelIndex - 1 + allChannels.length) % allChannels.length;
    const target = allChannels[prevIndex];
    if (target) {
      setActiveChannelIndex(prevIndex);
      const full = await catalogService.getChannelDetails(target.id);
      setActiveChannel(full || target);
    }
  };

  const handleToggleFavorite = (channelId) => {
    const updated = storageService.toggleFavorite(channelId);
    const isNowFav = updated.includes(channelId);
    setFavoritesSet(new Set(updated));
    const ch = allChannels.find((c) => String(c.id) === String(channelId));
    showToast(`${ch?.name || 'Channel'} ${isNowFav ? 'added to Favorites ❤️' : 'removed from Favorites'}`);
    if (activeCategory === 'favorites') {
      loadChannels('favorites', activeCountry);
    }
  };

  // If video player is active, render ONLY the video player to free the hardware video plane
  if (activeChannel) {
    return (
      <VideoPlayerView
        channel={activeChannel}
        onClose={handleClosePlayer}
        onNextChannel={handleNextChannel}
        onPreviousChannel={handlePreviousChannel}
        isFavorite={favoritesSet.has(activeChannel.id)}
        onToggleFavorite={handleToggleFavorite}
      />
    );
  }

  const visibleChannels = allChannels.slice(0, visibleLimit);

  return (
    <div className="tv-app-container">
      {/* Toast Notification for Favorites */}
      {toastMsg && (
        <div
          className="tv-player-toast"
          style={{
            position: 'fixed',
            top: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999
          }}
        >
          <Heart size={22} color="#f43f5e" fill="#f43f5e" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <Header
        activeCountry={activeCountry}
        totalChannels={allChannels.length}
        onOpenCountryModal={() => setIsCountryModalOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSelectCategory={(catId) => setActiveCategory(catId)}
      />

      {/* Category Pills Navigation */}
      <CategoryBar
        activeCategory={activeCategory}
        onSelectCategory={(catId) => setActiveCategory(catId)}
      />

      {/* Main Channel Grid */}
      <ChannelGrid
        channels={visibleChannels}
        totalCount={allChannels.length}
        loading={loading}
        category={activeCategory}
        favoritesSet={favoritesSet}
        onPlay={handlePlayChannel}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Country & Language Modal */}
      {isCountryModalOpen && (
        <CountryModal
          activeCountry={activeCountry}
          onSelectCountry={(countryCode) => {
            setActiveCountry(countryCode);
            setIsCountryModalOpen(false);
            setTimeout(() => spatialNav.focusFirst(), 150);
          }}
          onClose={() => {
            setIsCountryModalOpen(false);
            setTimeout(() => spatialNav.focusFirst(), 150);
          }}
        />
      )}

      {/* Search Modal */}
      {isSearchOpen && (
        <SearchModal
          onClose={() => {
            setIsSearchOpen(false);
            setTimeout(() => spatialNav.focusFirst(), 150);
          }}
          onPlayChannel={handlePlayChannel}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          onClose={() => {
            setIsSettingsOpen(false);
            setTimeout(() => spatialNav.focusFirst(), 150);
          }}
          onRefreshData={() => {
            setFavoritesSet(new Set(storageService.getFavorites()));
            loadChannels(activeCategory, activeCountry);
          }}
        />
      )}
    </div>
  );
}
