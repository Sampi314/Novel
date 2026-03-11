import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { TileManager } from './TileManager.js';
import { drawRivers } from './layers/RiverLayer.js';
import { drawRoads } from './layers/RoadLayer.js';
import { generateRoadNetwork } from './generators/RoadGenerator.js';

const WORLD_SIZE = 10000;
const MIN_ZOOM = 0;
const MAX_ZOOM = 8;

export default function MapViewer({ data, theme, mapZoomTarget, isVisible }) {
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
  const drawRef = useRef(null);
  const dataRef = useRef(null);
  dataRef.current = data;

  const [currentEra, setCurrentEra] = useState(0);
  const [locationTooltip, setLocationTooltip] = useState(null);

  const eras = data?.eras || [];

  // Generate road network once from locations (deterministic, cached)
  const generatedRoads = useMemo(() => {
    if (!data?.locations || data.locations.length < 2) return [];
    return generateRoadNetwork(data.locations);
  }, [data?.locations]);

  // Current era year for filtering era-dependent features
  const currentEraYear = eras[currentEra]?.year ?? null;

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

    // Disable image smoothing for crisp tile rendering
    ctx.imageSmoothingEnabled = false;

    // Clear with background color
    const bgColor = theme === 'light' ? '#f4ede0' : '#05080f';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw tiles
    const redrawCallback = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => drawRef.current?.());
    };
    tm.drawTiles(ctx, vp, zoom, currentEra, theme, redrawCallback);

    // Terrain-only layers: rivers (includes ponds/lakes from terrain tiles)
    if (data?.rivers) {
      drawRivers(ctx, vp, data.rivers, zoom);
    }

    // Roads and trade routes (drawn on top of rivers)
    drawRoads(ctx, vp, generatedRoads, data?.tradeRoutes, zoom, theme, currentEraYear);
  }, [currentEra, theme, data, eras, generatedRoads, currentEraYear]);

  // Keep a stable ref to the latest draw function
  drawRef.current = draw;

  // ---------------------------------------------------------------------------
  // Resize & visibility handler (runs once, uses drawRef for latest draw)
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

      drawRef.current?.();
    };

    // ResizeObserver for size changes
    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(canvas.parentElement);

    // IntersectionObserver to detect when the map becomes visible
    // (display:none → block on an ancestor). This reliably fires across
    // all browsers even when the ResizeObserver misses ancestor display changes.
    const visibilityObs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        handleResize();
      }
    });
    visibilityObs.observe(canvas);

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      resizeObs.disconnect();
      visibilityObs.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []); // stable — no deps, uses drawRef

  // ---------------------------------------------------------------------------
  // Mouse/wheel + touch gesture handlers
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // --- Helper: zoom toward a specific screen point ---
    function zoomTowardPoint(screenX, screenY, newZoom) {
      const rect = canvas.getBoundingClientRect();
      const vp = viewportRef.current;

      // Point in world coordinates before zoom
      const worldX = vp.x + screenX / vp.scale;
      const worldY = vp.y + screenY / vp.scale;

      zoomRef.current = newZoom;

      const newWorldWidth = WORLD_SIZE / Math.pow(2, newZoom);
      const aspectRatio = rect.height / rect.width;
      const newWorldHeight = newWorldWidth * aspectRatio;

      // Keep the point fixed on screen
      const ratioX = screenX / rect.width;
      const ratioY = screenY / rect.height;
      vp.x = worldX - ratioX * newWorldWidth;
      vp.y = worldY - ratioY * newWorldHeight;
      vp.width = newWorldWidth;
      vp.height = newWorldHeight;

      vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, vp.x));
      vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, vp.y));
      vp.scale = rect.width / vp.width;

      drawRef.current?.();
    }

    // ===================== MOUSE HANDLERS =====================

    const handleWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const oldZoom = zoomRef.current;
      const delta = e.deltaY > 0 ? -1 : 1;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom + delta));
      if (newZoom === oldZoom) return;
      zoomTowardPoint(e.clientX - rect.left, e.clientY - rect.top, newZoom);
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
      vp.x -= dx / vp.scale;
      vp.y -= dy / vp.scale;
      vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, vp.x));
      vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, vp.y));
      drawRef.current?.();
    };

    const handleMouseUp = () => {
      draggingRef.current = false;
      canvas.style.cursor = 'grab';
    };

    // ===================== TOUCH STATE =====================

    // Pinch state
    let pinchStartDist = 0;
    let pinchStartZoom = 0;
    let pinchStartMidScreenX = 0;
    let pinchStartMidScreenY = 0;
    let pinchStartMidWorldX = 0;
    let pinchStartMidWorldY = 0;

    // Momentum state
    let velocityX = 0;
    let velocityY = 0;
    let momentumRaf = null;
    const FRICTION = 0.93;
    const MIN_VELOCITY = 0.3;
    const touchHistory = []; // { x, y, time } circular buffer

    // Double-tap detection
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    const DOUBLE_TAP_DELAY = 300;
    const DOUBLE_TAP_DIST = 30;

    // Long-press detection
    let longPressTimer = null;
    let longPressTriggered = false;
    const LONG_PRESS_DELAY = 500;
    const LONG_PRESS_MOVE_THRESHOLD = 10;
    let longPressStartX = 0;
    let longPressStartY = 0;

    function cancelMomentum() {
      if (momentumRaf) {
        cancelAnimationFrame(momentumRaf);
        momentumRaf = null;
      }
      velocityX = 0;
      velocityY = 0;
    }

    function cancelLongPress() {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    function startMomentum() {
      // Compute velocity from touch history
      if (touchHistory.length < 2) return;
      const recent = touchHistory[touchHistory.length - 1];
      const older = touchHistory[Math.max(0, touchHistory.length - 3)];
      const dt = (recent.time - older.time) || 1;
      velocityX = (recent.x - older.x) / dt * 16; // normalize to ~60fps
      velocityY = (recent.y - older.y) / dt * 16;

      if (Math.abs(velocityX) < MIN_VELOCITY && Math.abs(velocityY) < MIN_VELOCITY) return;

      function tick() {
        velocityX *= FRICTION;
        velocityY *= FRICTION;
        if (Math.abs(velocityX) < MIN_VELOCITY && Math.abs(velocityY) < MIN_VELOCITY) {
          momentumRaf = null;
          return;
        }
        const vp = viewportRef.current;
        vp.x -= velocityX / vp.scale;
        vp.y -= velocityY / vp.scale;
        vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, vp.x));
        vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, vp.y));
        drawRef.current?.();
        momentumRaf = requestAnimationFrame(tick);
      }
      momentumRaf = requestAnimationFrame(tick);
    }

    function findNearestLocation(screenX, screenY) {
      const d = dataRef.current;
      if (!d?.locations) return null;
      const vp = viewportRef.current;
      const worldX = vp.x + screenX / vp.scale;
      const worldY = vp.y + screenY / vp.scale;
      const maxWorldDist = 60 / vp.scale; // 60px in screen space

      let best = null;
      let bestDist = maxWorldDist;
      for (const loc of d.locations) {
        const dx = loc.x - worldX;
        const dy = loc.y - worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = loc;
        }
      }
      return best;
    }

    // ===================== TOUCH HANDLERS =====================

    const handleTouchStart = (e) => {
      cancelMomentum();
      setLocationTooltip(null);

      if (e.touches.length === 1) {
        const t = e.touches[0];
        draggingRef.current = true;
        lastMouseRef.current = { x: t.clientX, y: t.clientY };
        touchHistory.length = 0;
        touchHistory.push({ x: t.clientX, y: t.clientY, time: Date.now() });

        // Long-press detection
        longPressTriggered = false;
        longPressStartX = t.clientX;
        longPressStartY = t.clientY;
        cancelLongPress();
        longPressTimer = setTimeout(() => {
          longPressTriggered = true;
          draggingRef.current = false;
          const rect = canvas.getBoundingClientRect();
          const loc = findNearestLocation(t.clientX - rect.left, t.clientY - rect.top);
          if (loc) {
            try { navigator.vibrate?.(10); } catch (_) {}
            setLocationTooltip({
              screenX: t.clientX - rect.left,
              screenY: t.clientY - rect.top,
              name: loc.name,
              han: loc.han,
              type: loc.type,
            });
          }
        }, LONG_PRESS_DELAY);
      } else if (e.touches.length === 2) {
        draggingRef.current = false;
        cancelLongPress();

        const t0 = e.touches[0], t1 = e.touches[1];
        const dx = t0.clientX - t1.clientX;
        const dy = t0.clientY - t1.clientY;
        pinchStartDist = Math.sqrt(dx * dx + dy * dy);
        pinchStartZoom = zoomRef.current;

        // Midpoint in screen space
        const rect = canvas.getBoundingClientRect();
        pinchStartMidScreenX = (t0.clientX + t1.clientX) / 2 - rect.left;
        pinchStartMidScreenY = (t0.clientY + t1.clientY) / 2 - rect.top;

        // Midpoint in world space
        const vp = viewportRef.current;
        pinchStartMidWorldX = vp.x + pinchStartMidScreenX / vp.scale;
        pinchStartMidWorldY = vp.y + pinchStartMidScreenY / vp.scale;
      }
    };

    const handleTouchMove = (e) => {
      e.preventDefault();

      if (e.touches.length === 1 && draggingRef.current) {
        const t = e.touches[0];

        // Cancel long-press if finger moved
        const lpDx = t.clientX - longPressStartX;
        const lpDy = t.clientY - longPressStartY;
        if (Math.sqrt(lpDx * lpDx + lpDy * lpDy) > LONG_PRESS_MOVE_THRESHOLD) {
          cancelLongPress();
        }

        const dx = t.clientX - lastMouseRef.current.x;
        const dy = t.clientY - lastMouseRef.current.y;
        lastMouseRef.current = { x: t.clientX, y: t.clientY };

        // Track velocity
        touchHistory.push({ x: t.clientX, y: t.clientY, time: Date.now() });
        if (touchHistory.length > 5) touchHistory.shift();

        const vp = viewportRef.current;
        vp.x -= dx / vp.scale;
        vp.y -= dy / vp.scale;
        vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, vp.x));
        vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, vp.y));
        drawRef.current?.();
      } else if (e.touches.length === 2) {
        cancelLongPress();
        const t0 = e.touches[0], t1 = e.touches[1];
        const dx = t0.clientX - t1.clientX;
        const dy = t0.clientY - t1.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Continuous zoom (not snapped to integers)
        const rawZoom = pinchStartZoom + Math.log2(dist / pinchStartDist);
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(rawZoom)));

        if (newZoom !== zoomRef.current) {
          // Zoom toward the pinch midpoint (fixed in world space)
          const rect = canvas.getBoundingClientRect();
          const midScreenX = (t0.clientX + t1.clientX) / 2 - rect.left;
          const midScreenY = (t0.clientY + t1.clientY) / 2 - rect.top;

          zoomRef.current = newZoom;
          const newWorldWidth = WORLD_SIZE / Math.pow(2, newZoom);
          const vp = viewportRef.current;
          vp.width = newWorldWidth;
          vp.height = (rect.height / rect.width) * newWorldWidth;

          // Keep pinch midpoint world position under midpoint screen position
          const ratioX = midScreenX / rect.width;
          const ratioY = midScreenY / rect.height;
          vp.x = pinchStartMidWorldX - ratioX * vp.width;
          vp.y = pinchStartMidWorldY - ratioY * vp.height;

          vp.x = Math.max(0, Math.min(WORLD_SIZE - vp.width, vp.x));
          vp.y = Math.max(0, Math.min(WORLD_SIZE - vp.height, vp.y));
          vp.scale = rect.width / newWorldWidth;
          drawRef.current?.();
        }
      }
    };

    const handleTouchEnd = (e) => {
      cancelLongPress();

      if (e.touches.length === 0 && draggingRef.current) {
        draggingRef.current = false;

        // Double-tap detection (only if not a long press)
        if (!longPressTriggered && e.changedTouches.length === 1) {
          const t = e.changedTouches[0];
          const now = Date.now();
          const tapDx = t.clientX - lastTapX;
          const tapDy = t.clientY - lastTapY;
          const tapDist = Math.sqrt(tapDx * tapDx + tapDy * tapDy);

          if (now - lastTapTime < DOUBLE_TAP_DELAY && tapDist < DOUBLE_TAP_DIST) {
            // Double-tap: zoom in, or zoom out if at max
            const rect = canvas.getBoundingClientRect();
            const screenX = t.clientX - rect.left;
            const screenY = t.clientY - rect.top;
            const oldZoom = zoomRef.current;
            const newZoom = oldZoom >= MAX_ZOOM ? MIN_ZOOM : Math.min(MAX_ZOOM, oldZoom + 2);
            zoomTowardPoint(screenX, screenY, newZoom);
            lastTapTime = 0; // reset to avoid triple-tap
            return;
          }

          lastTapTime = now;
          lastTapX = t.clientX;
          lastTapY = t.clientY;

          // Start momentum scrolling
          startMomentum();
        }
      } else if (e.touches.length === 0) {
        draggingRef.current = false;
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      cancelMomentum();
      cancelLongPress();
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []); // stable — no deps, uses drawRef + dataRef

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

    drawRef.current?.();
  }, [mapZoomTarget]);

  // ---------------------------------------------------------------------------
  // Redraw when becoming visible, or on era/theme/data change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isVisible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ensure canvas is properly sized when becoming visible
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';

      const vp = viewportRef.current;
      vp.height = vp.width * (rect.height / rect.width);
      vp.scale = rect.width / vp.width;
    }

    drawRef.current?.();
  }, [isVisible, currentEra, theme, data]);

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

    drawRef.current?.();
  }, []);

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

    drawRef.current?.();
  }, []);

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
          touchAction: 'none',
        }}
      />

      {/* Long-press location tooltip */}
      {locationTooltip && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(locationTooltip.screenX, (canvasRef.current?.parentElement?.offsetWidth || 300) - 180),
            top: Math.max(8, locationTooltip.screenY - 70),
            background: panelBg,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${borderColor}`,
            borderRadius: 8,
            padding: '8px 12px',
            zIndex: 20,
            pointerEvents: 'none',
            maxWidth: 180,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--gold)',
            lineHeight: 1.3,
          }}>{locationTooltip.name}</div>
          <div style={{
            fontFamily: 'var(--font-han)',
            fontSize: 11,
            color: 'var(--text-dim)',
            letterSpacing: 1,
          }}>{locationTooltip.han}</div>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            color: 'var(--text-dim)',
            marginTop: 2,
            fontStyle: 'italic',
          }}>{locationTooltip.type}</div>
        </div>
      )}

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
