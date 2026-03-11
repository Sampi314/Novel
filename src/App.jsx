import React, { useState, useEffect, lazy, Suspense } from 'react';
import * as d3 from 'd3';
import Sidebar from './components/Sidebar';
import MobileDrawer from './components/MobileDrawer';
import FMGEmbed from './components/FMGEmbed';
import MapViewer from './map/MapViewer';
import StarParticles from './components/StarParticles';

const HomePage = lazy(() => import('./pages/HomePage'));
const ErasPage = lazy(() => import('./pages/ErasPage'));
const LorePage = lazy(() => import('./pages/LorePage'));
const FactionsPage = lazy(() => import('./pages/FactionsPage'));
const CharactersPage = lazy(() => import('./pages/CharactersPage'));
const LocationsPage = lazy(() => import('./pages/LocationsPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const StoryArcsPage = lazy(() => import('./pages/StoryArcsPage'));
const BestiaryPage = lazy(() => import('./pages/BestiaryPage'));
const LiteraturePage = lazy(() => import('./pages/LiteraturePage'));

const PAGE_LOADING = (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: '#4a3518', fontFamily: "'EB Garamond', serif", fontSize: 15,
    fontStyle: 'italic',
  }}>
    Đang tải...
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapZoomTarget, setMapZoomTarget] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [theme, setTheme] = useState(() => localStorage.getItem('cng-theme') || 'dark');
  const [language, setLanguage] = useState(() => localStorage.getItem('cng-language') || 'vi-zh');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cng-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    document.documentElement.classList.add('theme-transitioning');
    setTheme(t => t === 'dark' ? 'light' : 'dark');
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 600);
  };

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const navigateToMap = (x, y) => {
    setMapZoomTarget({ x, y, _t: Date.now() });
    setActiveTab('map');
  };

  const base = import.meta.env.BASE_URL;

  useEffect(() => {
    Promise.all([
      fetch(base + 'data/world.json').then(r => r.json()),
      fetch(base + 'data/locations.csv').then(r => r.text()),
      fetch(base + 'data/characters.csv').then(r => r.text()),
      fetch(base + 'data/events.csv').then(r => r.text()),
      fetch(base + 'data/trade_routes.csv').then(r => r.text()),
      fetch(base + 'data/story_arcs.csv').then(r => r.text()),
      fetch(base + 'data/sub_races.csv').then(r => r.text()),
    ]).then(([world, locCsv, charCsv, evCsv, trCsv, arcCsv, srCsv]) => {
      const locations = d3.csvParse(locCsv).map(l => ({
        ...l,
        x: +l.x, y: +l.y,
        era_founded: +l.era_founded || 0,
        era_destroyed: l.era_destroyed === '' || l.era_destroyed == null ? null : +l.era_destroyed,
        power: +l.power || 0,
        pop: +l.population || 0,
        desc: l.description || '',
      }));
      const characters = d3.csvParse(charCsv).map(c => ({
        ...c,
        power: +c.power || 0,
        era_start: +c.era_start || 0,
        era_end: c.era_end === '' || c.era_end == null ? null : +c.era_end,
        journey: c.journey ? c.journey.split('|') : [],
      }));
      const events = d3.csvParse(evCsv).map(row => ({ ...row, year: +row.year, x: +row.x, y: +row.y }));
      const tradeRoutes = d3.csvParse(trCsv).map(r => ({
        ...r,
        era_start: +r.era_start,
        era_end: r.era_end === '' || r.era_end == null ? null : +r.era_end,
        pts: r.waypoints ? r.waypoints.split('|').map(w => w.split(':').map(Number)) : [],
      }));
      const storyArcs = d3.csvParse(arcCsv).map(a => ({
        ...a,
        era_start: +a.era_start || 0,
        era_end: a.era_end === '' || a.era_end == null ? null : +a.era_end,
        events: a.events ? a.events.split('|') : [],
        characters: a.characters ? a.characters.split('|') : [],
      }));
      const subRaces = d3.csvParse(srCsv).map(sr => ({
        ...sr,
        rank: +sr.rank || 0,
      }));

      setData({
        worldData: world,
        locations,
        characters,
        events,
        tradeRoutes,
        storyArcs,
        subRaces,
        factions: world.factions || [],
        fauna: world.fauna || [],
        divineSites: world.divineSites || [],
        eras: world.eras || [],
        territories: world.territories || [],
        leyLines: world.leyLines || [],
        rivers: world.rivers || [],
        creation: world.creation || {},
        linhKhi: world.linhKhi || {},
        powerSystem: world.powerSystem || {},
        raceOrigins: world.raceOrigins || {},
        novelStyle: world.novelStyle || {},
      });
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load world data:', err);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', color: 'var(--gold)', position: 'relative', overflow: 'hidden',
      }}>
        <StarParticles theme={theme} />
        <div style={{ textAlign: 'center', animation: 'fadeIn 1.5s ease both', zIndex: 2 }}>
          {/* Orbital ring */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
            <div className="orbital-loader" style={{ margin: '0 auto' }} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "var(--font-han)",
              fontSize: 28,
              color: 'var(--gold)',
              textShadow: '0 0 30px rgba(196,163,90,0.4)',
            }}>固</div>
          </div>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 8,
            marginBottom: 8,
            textShadow: '0 0 40px rgba(196,163,90,0.3)',
            animation: 'fadeInUp 1s ease 0.3s both',
          }}>Cố Nguyên Giới</div>
          <div style={{
            fontFamily: "var(--font-han)",
            fontSize: 13,
            color: 'var(--text-dim)',
            letterSpacing: 6,
            marginBottom: 20,
            animation: 'fadeInUp 1s ease 0.5s both',
          }}>固 元 界</div>
          <div style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: 'var(--text-dim)',
            fontStyle: 'italic',
            animation: 'fadeInUp 1s ease 0.7s both',
          }}>Đang tải dữ liệu...</div>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    if (!data) return null;
    switch (activeTab) {
      case 'home':       return <HomePage data={data} onNavigate={setActiveTab} />;
      case 'eras':       return <ErasPage data={data} onNavigate={setActiveTab} />;
      case 'lore':       return <LorePage data={data} />;
      case 'factions':   return <FactionsPage data={data} onNavigate={setActiveTab} />;
      case 'characters': return <CharactersPage data={data} onNavigate={setActiveTab} onMapNavigate={navigateToMap} />;
      case 'locations':  return <LocationsPage data={data} onNavigate={setActiveTab} onMapNavigate={navigateToMap} />;
      case 'events':     return <EventsPage data={data} onNavigate={setActiveTab} onMapNavigate={navigateToMap} />;
      case 'arcs':       return <StoryArcsPage data={data} onNavigate={setActiveTab} />;
      case 'bestiary':   return <BestiaryPage data={data} />;
      case 'literature': return <LiteraturePage data={data} onNavigate={setActiveTab} />;
      default:           return null;
    }
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <StarParticles theme={theme} />
      {!isMobile && <Sidebar activeTab={activeTab} onTabChange={setActiveTab} theme={theme} onToggleTheme={toggleTheme} />}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 2 }}>
        {/* Map stays mounted, hidden via display */}
        <div style={{ width: '100%', height: '100%', display: activeTab === 'map' ? 'block' : 'none' }}>
          <MapViewer data={data} theme={theme} language={language} onLanguageChange={setLanguage} mapZoomTarget={mapZoomTarget} isVisible={activeTab === 'map'} />
        </div>
        {/* Other pages mount/unmount with slide-up transition */}
        {activeTab !== 'map' && (
          <div key={activeTab} className="page-transition" style={{ width: '100%', height: '100%', overflow: 'auto' }}>
            <Suspense fallback={PAGE_LOADING}>
              {renderPage()}
            </Suspense>
          </div>
        )}
      </div>
      {isMobile && <MobileDrawer activeTab={activeTab} onTabChange={setActiveTab} theme={theme} onToggleTheme={toggleTheme} />}
    </div>
  );
}
