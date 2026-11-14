import React, { useEffect, useState } from 'react';
import { remoteKeyManager, TV_KEYS } from '../services/remoteKeyManager.js';
import { uiLock } from '../services/uiLock.js';

/**
 * Fullscreen picture viewer. Left/Right moves through the folder's images, Back closes.
 * images: [{ name, uri }]
 */
export function ImageViewer({ images, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const release = uiLock.acquire();
    const unsubscribe = remoteKeyManager.subscribe((action) => {
      switch (action.type) {
        case TV_KEYS.RIGHT:
        case TV_KEYS.CH_UP:
          setFailed(false);
          setIndex((i) => (i + 1) % images.length);
          return true;
        case TV_KEYS.LEFT:
        case TV_KEYS.CH_DOWN:
          setFailed(false);
          setIndex((i) => (i - 1 + images.length) % images.length);
          return true;
        case TV_KEYS.BACK:
        case TV_KEYS.ENTER:
          onClose(index);
          return true;
        default:
          return true;
      }
    });
    return () => {
      unsubscribe();
      release();
    };
  }, [images.length, index, onClose]);

  const image = images[index];
  return (
    <div className="tv-image-viewer">
      {failed ? (
        <div className="tv-image-viewer-error">This picture can't be displayed.</div>
      ) : (
        <img key={image.uri} src={image.uri} alt={image.name} onError={() => setFailed(true)} />
      )}
      <div className="tv-image-viewer-caption">
        <span>{image.name}</span>
        <span>
          {index + 1} / {images.length}
        </span>
      </div>
    </div>
  );
}
