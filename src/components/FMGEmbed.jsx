import React, { useRef, useEffect } from 'react';

export default function FMGEmbed({ theme, mapZoomTarget, onNavigate }) {
  const iframeRef = useRef(null);

  // Sync theme to FMG
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'themeChange', theme },
        '*'
      );
    }
  }, [theme]);

  // Handle zoom-to-location requests from content pages
  useEffect(() => {
    if (mapZoomTarget && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'flyTo', x: mapZoomTarget.x, y: mapZoomTarget.y, zoom: mapZoomTarget.zoom || 4 },
        '*'
      );
    }
  }, [mapZoomTarget]);

  // Listen for messages from FMG iframe
  useEffect(() => {
    const handleMessage = (event) => {
      const { type, ...data } = event.data || {};
      if (type === 'fmgReady') {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'themeChange', theme },
          '*'
        );
      }
      if (type === 'navigate' && data.tab && onNavigate) {
        onNavigate(data.tab);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [theme, onNavigate]);

  const isDev = import.meta.env.DEV;
  const fmgSrc = isDev ? 'http://localhost:5174' : (import.meta.env.BASE_URL + 'fmg/index.html');

  return (
    <iframe
      ref={iframeRef}
      src={fmgSrc}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
      }}
      title="Thiên Hoang Đại Lục Map"
      allow="fullscreen"
    />
  );
}
