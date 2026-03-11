// src/map/MapViewer.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { WorldCRS, worldToLatLng, WORLD_BOUNDS } from './utils/crs.js';
import { createTerrainTileLayer } from './TerrainTileLayer.js';
import { createLocationLayer } from './layers/LocationLayer.js';
import { createProceduralRiverLayer } from './layers/ProceduralRiverLayer.js';
import { createTerritoryLayer } from './layers/TerritoryLayer.js';
import LanguageToggle from './LanguageToggle.jsx';

export default function MapViewer({
  data,
  theme,
  language,
  onLanguageChange,
  isVisible,
  mapZoomTarget,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const workerRef = useRef(null);
  const terrainLayerRef = useRef(null);
  const locationLayerRef = useRef(null);
  const riverLayerRef = useRef(null);
  const territoryLayerRef = useRef(null);
  const [currentT, setCurrentT] = useState(0);
  const [workerReady, setWorkerReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState('');

  // D8 river data from worker (per keyframe)
  const riverDataRef = useRef(null);
  // Terrain-computed border paths from worker
  const computedBordersRef = useRef(null);

  // Initialize map + worker on mount
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Create Leaflet map
    const map = L.map(containerRef.current, {
      crs: WorldCRS,
      minZoom: 0,
      maxZoom: 8,
      maxBounds: WORLD_BOUNDS.pad(0.1),
      maxBoundsViscosity: 1.0,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      attributionControl: false,
    });

    map.fitBounds(WORLD_BOUNDS);
    mapRef.current = map;

    // Create Web Worker
    const worker = new Worker(
      new URL('./workers/tileWorker.js', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    // Use addEventListener to avoid overwriting TerrainTileLayer's handler
    const onWorkerMsg = (e) => {
      if (e.data.type === 'init-complete') {
        // Store D8 river data from worker
        if (e.data.riverData) {
          riverDataRef.current = e.data.riverData;
        }
        setWorkerReady(true);
        setLoading(false);

        // Request terrain-following borders
        const territories = data?.territories;
        if (territories && territories.length > 0) {
          worker.postMessage({ type: 'compute-borders', territories, T: 0 });
        }
      }
      if (e.data.type === 'init-progress') {
        setLoadProgress(`Keyframe ${e.data.done}/${e.data.total}`);
      }
      if (e.data.type === 'borders') {
        computedBordersRef.current = e.data.borders;
        // Trigger re-render of territory layer
        setWorkerReady(prev => !prev); // toggle to trigger useEffect
        setTimeout(() => setWorkerReady(true), 0);
      }
    };
    worker.addEventListener('message', onWorkerMsg);

    // Initialize worker with era data
    const eras = data?.eras || [];
    worker.postMessage({
      type: 'init',
      eras,
      worldSeed: 'co-nguyen-gioi-v2',
    });

    // Create terrain tile layer
    const terrainLayer = createTerrainTileLayer(worker);
    terrainLayer.addTo(map);
    terrainLayerRef.current = terrainLayer;

    return () => {
      worker.removeEventListener('message', onWorkerMsg);
      map.remove();
      worker.terminate();
      mapRef.current = null;
      workerRef.current = null;
    };
  }, []);

  // Re-fit bounds when map becomes visible (container goes from 0x0 to real size)
  useEffect(() => {
    if (isVisible && mapRef.current) {
      mapRef.current.invalidateSize();
      mapRef.current.fitBounds(WORLD_BOUNDS);
    }
  }, [isVisible]);

  // Update terrain when T changes
  useEffect(() => {
    if (terrainLayerRef.current) {
      terrainLayerRef.current.setT(currentT);
    }
  }, [currentT]);

  // Update terrain theme
  useEffect(() => {
    if (terrainLayerRef.current) {
      terrainLayerRef.current.setTheme(theme);
    }
  }, [theme]);

  // Handle mapZoomTarget (fly-to from other tabs)
  useEffect(() => {
    if (mapZoomTarget && mapRef.current) {
      const latlng = worldToLatLng(mapZoomTarget.x, mapZoomTarget.y);
      mapRef.current.flyTo(latlng, 5, { duration: 1 });
    }
  }, [mapZoomTarget]);

  // Helper: get rivers for current T from the nearest keyframe
  const getRiversForT = useCallback((T) => {
    const rd = riverDataRef.current;
    if (!rd || rd.length === 0) return null;

    // Find nearest keyframe
    let best = rd[0];
    let bestDist = Math.abs(T - best.T);
    for (const kf of rd) {
      const d = Math.abs(T - kf.T);
      if (d < bestDist) { bestDist = d; best = kf; }
    }
    return best.rivers;
  }, []);

  // Update overlay layers when data/T/theme changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;

    // Location pins
    if (locationLayerRef.current) {
      map.removeLayer(locationLayerRef.current);
    }
    const locLayer = createLocationLayer(data.locations, language, currentT, data.eras);
    locLayer.addTo(map);
    locationLayerRef.current = locLayer;

    // Rivers are now rendered directly in terrain tiles via flowAccum
    // Vector overlay disabled — tile renderer handles river rendering
    if (riverLayerRef.current) {
      map.removeLayer(riverLayerRef.current);
      riverLayerRef.current = null;
    }

    // Territories (with terrain-following borders when available)
    if (territoryLayerRef.current) {
      map.removeLayer(territoryLayerRef.current);
    }
    if (data.territories) {
      const terLayer = createTerritoryLayer(
        data.territories, theme, currentT, data.eras,
        computedBordersRef.current
      );
      terLayer.addTo(map);
      territoryLayerRef.current = terLayer;
    }
  }, [data, language, currentT, theme, workerReady]);

  // Era slider handler
  const handleSliderChange = useCallback((e) => {
    setCurrentT(Number(e.target.value));
  }, []);

  // Get current era label
  const eras = data?.eras || [];
  const currentEra = eras.find((era, i) => {
    const thisYear = era.year != null ? era.year : 0;
    const nextYear = i < eras.length - 1
      ? (eras[i + 1].year != null ? eras[i + 1].year : 1000000)
      : 1000000;
    return currentT >= thisYear && currentT < nextYear;
  }) || eras[eras.length - 1];

  const eraLabel = currentEra
    ? language === 'zh'
      ? currentEra.han || currentEra.name
      : currentEra.name
    : '';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      display: isVisible ? 'flex' : 'none',
      flexDirection: 'column',
      background: theme === 'dark' ? '#05080f' : '#f5f0e8',
    }}>
      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: theme === 'dark' ? 'rgba(5,8,15,0.9)' : 'rgba(245,240,232,0.9)',
          zIndex: 1000,
          color: theme === 'dark' ? '#c4a35a' : '#5a4a2a',
          fontFamily: 'var(--font-display)',
          fontSize: '1.2rem',
          gap: 8,
        }}>
          <div>Generating world terrain...</div>
          {loadProgress && (
            <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>{loadProgress}</div>
          )}
        </div>
      )}

      {/* Map container */}
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 0 }}
      />

      {/* Language toggle */}
      <LanguageToggle
        language={language}
        onLanguageChange={onLanguageChange}
        theme={theme}
      />

      {/* Era timeline slider */}
      <div style={{
        padding: '8px 16px',
        background: theme === 'dark' ? 'rgba(5,8,15,0.85)' : 'rgba(245,240,232,0.85)',
        backdropFilter: 'blur(8px)',
        borderTop: `1px solid ${theme === 'dark' ? 'rgba(196,163,90,0.2)' : 'rgba(90,74,42,0.2)'}`,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
          fontFamily: 'var(--font-body)',
          fontSize: '0.85rem',
          color: theme === 'dark' ? '#c4a35a' : '#5a4a2a',
        }}>
          <span>{eraLabel}</span>
          <span>T = {currentT.toLocaleString()}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1000000}
          step={1000}
          value={currentT}
          onChange={handleSliderChange}
          style={{ width: '100%', cursor: 'pointer' }}
        />
      </div>
    </div>
  );
}
