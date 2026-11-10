import React, { useState, useEffect } from 'react';
import { Radio, Moon } from 'lucide-react';
import { remoteKeyManager } from '../services/remoteKeyManager.js';

export function AudioOnlyOverlay({ channel, onWake }) {
  const [timeStr, setTimeStr] = useState('');
  const [pos, setPos] = useState({ top: 45, left: 45 }); // drifting position to prevent burn-in

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const clockInterval = setInterval(update, 1000);

    // Drift screensaver position every 30 seconds
    const driftInterval = setInterval(() => {
      const randomTop = 30 + Math.floor(Math.random() * 40);
      const randomLeft = 20 + Math.floor(Math.random() * 50);
      setPos({ top: randomTop, left: randomLeft });
    }, 30000);

    // Any remote key wakes up screen
    const handleRemote = () => {
      onWake();
      return true;
    };
    const unsub = remoteKeyManager.subscribe(handleRemote);

    return () => {
      clearInterval(clockInterval);
      clearInterval(driftInterval);
      unsub();
    };
  }, [onWake]);

  return (
    <div className="tv-audio-only-overlay" onClick={onWake}>
      <div
        className="tv-audio-only-badge"
        style={{ top: `${pos.top}%`, left: `${pos.left}%` }}
      >
        <div className="tv-audio-only-icon-row">
          <Moon size={28} color="#38bdf8" />
          <Radio size={24} color="#38bdf8" />
        </div>
        <div className="tv-audio-only-title">
          {channel?.name || 'البث الصوتي المباشر'}
        </div>
        <div className="tv-audio-only-clock">{timeStr}</div>
        <div className="tv-audio-only-hint">
          <span>وضع توفير الطاقة (الشاشة مطفأة)</span>
          <span>اضغط أي زر في الريموت للعودة</span>
        </div>
      </div>
    </div>
  );
}
