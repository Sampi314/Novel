import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TileManager } from './TileManager.js';
import { drawRivers } from './layers/RiverLayer.js';

const WORLD_SIZE = 10000;
const MIN_ZOOM = 0;
const MAX_ZOOM = 8;

export default function MapViewer({ data, theme, mapZoomTarget }) {
  const canvasRef = useRef(null);
  const tileManagerRef = useRef(null);
  const viewportRef = useRef({
    x: 0,
    y: 0,
    width: WORLD_SIZE,
    height: WORLD_SIZE,
    scale: 1,
  });
  const zoomRef = useRef(0);
  const draggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);

  const [currentEra, setCurrentEra] = useState(0);

  const eras = data?.eras || [];

  // ---------------------------------------------------------------------------
  // Initialize TileManager
  // ---------------------------------------------------------------------------
  useEffect(() => {
    tileManagerRef.current = new TileManager();
    return () => {
      tileManagerRef.current?.destroy();
      tileManagerRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // draw() — main render loop
  // ---------------------------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const tm = tileManagerRef.current;
    if (!canvas || !tm) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const vp = viewportRef.current;
    const zoom = zoomRef.current;

    // Scale context for HiDPI
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear with background color
    const bgColor = theme === 'light' ? '#f4ede0' : '#05080f';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw tiles
    const redrawCallback = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => draw());
    };
    tm.drawTiles(ctx, vp, zoom, currentEra, theme, redrawCallback);

    // Terrain-only layers: rivers (includes ponds/lakes from terrain tiles)
    if (data?.rivers) {
      drawRivers(ctx, vp, data.rivers, zoom);
    }
  }, [currentEra, theme, data, eras]);

  // ---------------------------------------------------------------------------
  // Resize handler
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      // Skip when hidden (display:none → 0x0)
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';

      // Update viewport dimensions to match screen aspect ratio
      const vp = viewportRef.current;
      vp.height = vp.width * (rect.height / rect.width);
      vp.scale = rect.width / vp.width;

      draw();
    };

    // ResizeObserver fires when element transitions from display:none to visible
    const observer = new ResizeObserver(handleResize);
    observer.observe(canvas.parentElement);

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [draw]);

  // ---------------------------------------------------------------------------
  // Mouse/wheel handlers
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();

      const vp = viewportRef.current;
      const rect = canvas.getBoundingClientRect();

      // Mouse position in screen pixels relative to canvas
      const mouseScreenX = e.clientX - rect.left;
      const mouseScreenY = e.clientY - rect.top;

      // Mouse position in world coordinates
      const mouseWorldX = vp.x + mouseScreenX / vp.scale;
      const mouseWorldY = vp.y + mouseScreenY / vp.scale;

      // Adjust zoom
      const oldZoom = zoomRef.current;
      const delta = e.deltaY > 0 ? -1 : 1;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom + delta));

      if (newZoom === oldZoom) return;
      zoomRef.current = newZoom;

      // Calculate new world dimensions
      const newWorldWidth = WORLD_SIZE / Math.pow(2, newZoom);
      const aspectRatio = rect.height / rect.width;
      const newWorldHeight = newWorldWidth * aspectRatio;

      // Keep mouse position fixed in world coords (zoom toward cursor)
      const mouseRatioX = mouseScreenX / rect.width;
      const mouseRatioY = mouseScreenY / rect.height;
      vp.x = mouseWorldX - mouseRatioX * newWorldWidth;
      vp.y = mouseWorldY - mouseRatioY * newWorldHeight;
      vp.width = newWorldWidth;
      vp.height = newWorldHeight;

      // Clamp viewport to world bounds
      vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, vp.x));
      vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, vp.y));
      vp.scale = rect.width / vp.width;

      draw();
    };

    const handleMouseDown = (e) => {
      if (e.button !== 0) return;
      draggingRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e) => {
      if (!draggingRef.current) return;

      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      const vp = viewportRef.current;

      // Convert screen pixel delta to world units
      const worldDx = dx / vp.scale;
      const worldDy = dy / vp.scale;

      vp.x -= worldDx;
      vp.y -= worldDy;

      // Clamp
      vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, vp.x));
      vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, vp.y));

      draw();
    };

    const handleMouseUp = () => {
      draggingRef.current = false;
      canvas.style.cursor = 'grab';
    };

    // Touch support
    let touchStartDist = 0;
    let touchStartZoom = 0;

    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        draggingRef.current = true;
        lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        draggingRef.current = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.sqrt(dx * dx + dy * dy);
        touchStartZoom = zoomRef.current;
      }
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && draggingRef.current) {
        const dx = e.touches[0].clientX - lastMouseRef.current.x;
        const dy = e.touches[0].clientY - lastMouseRef.current.y;
        lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        const vp = viewportRef.current;
        vp.x -= dx / vp.scale;
        vp.y -= dy / vp.scale;
        vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, vp.x));
        vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, vp.y));
        draw();
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const zoomDelta = Math.log2(dist / touchStartDist);
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(touchStartZoom + zoomDelta)));
        if (newZoom !== zoomRef.current) {
          zoomRef.current = newZoom;
          const rect = canvas.getBoundingClientRect();
          const vp = viewportRef.current;
          const centerX = vp.x + vp.width / 2;
          const centerY = vp.y + vp.height / 2;
          const newWorldWidth = WORLD_SIZE / Math.pow(2, newZoom);
          vp.width = newWorldWidth;
          vp.height = (rect.height / rect.width) * newWorldWidth;
          vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, centerX - vp.width / 2));
          vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, centerY - vp.height / 2));
          vp.scale = rect.width / newWorldWidth;
          draw();
        }
      }
    };

    const handleTouchEnd = () => { draggingRef.current = false; };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [draw]);

  // ---------------------------------------------------------------------------
  // mapZoomTarget — fly-to a specific location
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapZoomTarget) return;

    const targetZoom = 4;
    zoomRef.current = targetZoom;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();

    const newWorldWidth = WORLD_SIZE / Math.pow(2, targetZoom);
    const aspectRatio = rect.height / rect.width;
    const newWorldHeight = newWorldWidth * aspectRatio;

    const vp = viewportRef.current;
    vp.width = newWorldWidth;
    vp.height = newWorldHeight;
    vp.x = mapZoomTarget.x - newWorldWidth / 2;
    vp.y = mapZoomTarget.y - newWorldHeight / 2;

    // Clamp
    vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, vp.x));
    vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, vp.y));
    vp.scale = rect.width / vp.width;

    draw();
  }, [mapZoomTarget, draw]);

  // ---------------------------------------------------------------------------
  // Redraw on era change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    draw();
  }, [currentEra, draw]);

  // ---------------------------------------------------------------------------
  // Zoom button handlers
  // ---------------------------------------------------------------------------
  const handleZoomIn = useCallback(() => {
    const oldZoom = zoomRef.current;
    const newZoom = Math.min(MAX_ZOOM, oldZoom + 1);
    if (newZoom === oldZoom) return;
    zoomRef.current = newZoom;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();

    const vp = viewportRef.current;
    // Zoom toward center
    const centerWorldX = vp.x + vp.width / 2;
    const centerWorldY = vp.y + vp.height / 2;

    const newWorldWidth = WORLD_SIZE / Math.pow(2, newZoom);
    const aspectRatio = rect.height / rect.width;
    const newWorldHeight = newWorldWidth * aspectRatio;

    vp.x = centerWorldX - newWorldWidth / 2;
    vp.y = centerWorldY - newWorldHeight / 2;
    vp.width = newWorldWidth;
    vp.height = newWorldHeight;

    vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, vp.x));
    vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, vp.y));
    vp.scale = rect.width / vp.width;

    draw();
  }, [draw]);

  const handleZoomOut = useCallback(() => {
    const oldZoom = zoomRef.current;
    const newZoom = Math.max(MIN_ZOOM, oldZoom - 1);
    if (newZoom === oldZoom) return;
    zoomRef.current = newZoom;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();

    const vp = viewportRef.current;
    const centerWorldX = vp.x + vp.width / 2;
    const centerWorldY = vp.y + vp.height / 2;

    const newWorldWidth = WORLD_SIZE / Math.pow(2, newZoom);
    const aspectRatio = rect.height / rect.width;
    const newWorldHeight = newWorldWidth * aspectRatio;

    vp.x = centerWorldX - newWorldWidth / 2;
    vp.y = centerWorldY - newWorldHeight / 2;
    vp.width = newWorldWidth;
    vp.height = newWorldHeight;

    vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, vp.x));
    vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, vp.y));
    vp.scale = rect.width / vp.width;

    draw();
  }, [draw]);

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  const panelBg = 'var(--bg-panel)';
  const borderColor = 'var(--border)';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      background: 'var(--bg)',
    }}>
      {/* Main canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'grab',
          display: 'block',
        }}
      />

      {/* Era Slider — positioned absolute bottom center */}
      {eras.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 4,
          padding: '6px 10px',
          background: panelBg,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${borderColor}`,
          borderRadius: 10,
          boxShadow: 'var(--shadow-card)',
          zIndex: 10,
          maxWidth: 'calc(100% - 32px)',
          overflowX: 'auto',
        }}>
          {eras.map((era, i) => {
            const isActive = i === currentEra;
            return (
              <button
                key={i}
                onClick={() => setCurrentEra(i)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  background: isActive ? (era.accent || 'var(--gold)') : 'transparent',
                  color: isActive ? '#05080f' : 'var(--text-dim)',
                }}
                title={era.han || era.name}
              >
                {era.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Zoom Controls — positioned absolute top right */}
      <div style={{
        position: 'absolute',
        top: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        zIndex: 10,
      }}>
        <button
          onClick={handleZoomIn}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: panelBg,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${borderColor}`,
            borderRadius: '8px 8px 2px 2px',
            color: 'var(--gold)',
            fontSize: 20,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            lineHeight: 1,
          }}
          title="Phóng to"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: panelBg,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${borderColor}`,
            borderRadius: '2px 2px 8px 8px',
            color: 'var(--gold)',
            fontSize: 20,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            lineHeight: 1,
          }}
          title="Thu nhỏ"
        >
          −
        </button>
      </div>
    </div>
  );
}
