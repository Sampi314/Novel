import React, { useState, useMemo } from 'react';
import { PageHeader, OrnamentalCorner } from '../components/Ornaments';

const s = {
  page: {
    padding: '32px 40px',
    maxWidth: 1100,
    margin: '0 auto',
    fontFamily: "var(--font-body)",
    color: 'var(--text)',
    minHeight: '100vh',
    position: 'relative',
  },
  timeline: {
    position: 'relative',
    paddingLeft: 40,
  },
  line: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    width: 2,
    background: 'linear-gradient(180deg, var(--gold) 0%, var(--border) 100%)',
  },
  card: (accent, active) => ({
    position: 'relative',
    marginBottom: 20,
    padding: '20px 24px',
    background: active ? 'var(--bg-card-active)' : 'var(--bg-card)',
    border: `1px solid ${active ? accent : 'var(--border)'}`,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
    backdropFilter: 'blur(12px)',
  }),
  dot: (accent) => ({
    position: 'absolute',
    left: -32,
    top: 24,
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: accent,
    border: '2px solid var(--bg)',
    boxShadow: `0 0 8px ${accent}44`,
  }),
  eraName: (accent) => ({
    fontSize: 20,
    color: accent,
    fontWeight: 700,
  }),
  eraHan: {
    fontSize: 12,
    color: 'var(--gold-dim)',
    fontFamily: "var(--font-han)",
    marginLeft: 8,
  },
  year: {
    fontSize: 12,
    color: 'var(--text-dim)',
    marginTop: 4,
  },
  desc: {
    fontSize: 14,
    lineHeight: 1.7,
    marginTop: 10,
    color: 'var(--text-body)',
  },
  eventsSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTop: '1px solid var(--border-light)',
  },
  eventTag: {
    display: 'inline-block',
    padding: '3px 10px',
    margin: '3px 4px 3px 0',
    borderRadius: 12,
    fontSize: 11,
    background: 'var(--gold-glow)',
    border: '1px solid var(--border)',
    color: 'var(--gold)',
  },
};

function formatYear(y) {
  if (y < 0) return `${Math.abs(y).toLocaleString()} năm trước`;
  return `Năm ${y.toLocaleString()}`;
}

export default function ErasPage({ data, onNavigate }) {
  const [activeEra, setActiveEra] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const { eras = [], events = [] } = data;

  const getEraEvents = (era, nextEra) => {
    const start = era.year;
    const end = nextEra ? nextEra.year : Infinity;
    return events.filter(e => e.year >= start && e.year < end);
  };

  const filteredEras = useMemo(() => {
    if (!searchQ) return eras;
    const q = searchQ.toLowerCase();
    return eras.filter(e => e.name?.toLowerCase().includes(q) || e.han?.includes(q) || e.description?.toLowerCase().includes(q));
  }, [eras, searchQ]);

  return (
    <div style={s.page}>
      <div className="page-watermark">{'\u7D00'}</div>
      <PageHeader title="Kỷ Nguyên" han="紀元" subtitle="Các thời đại của Thiên Hoang Đại Lục" />

      <input className="search-input" style={{ width: 200, marginBottom: 20 }} placeholder="Tìm kiếm kỷ nguyên..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />

      <div style={s.timeline}>
        <div style={s.line} />
        {filteredEras.map((era, i) => {
          const active = activeEra === era.name;
          const eraEvents = getEraEvents(era, eras[i + 1]);
          return (
            <div
              key={era.name}
              className={`card-interactive card-reveal stagger-${(i % 12) + 1}`}
              style={s.card(era.accent, active)}
              onClick={() => setActiveEra(active ? null : era.name)}
            >
              <div style={s.dot(era.accent)} />
              {active && <><OrnamentalCorner position="top-right" size={24} color={era.accent} /><OrnamentalCorner position="bottom-right" size={24} color={era.accent} /></>}
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={s.eraName(era.accent)}>{era.name}</span>
                <span style={s.eraHan}>{era.han}</span>
              </div>
              <div style={s.year}>{formatYear(era.year)}</div>
              <div style={s.desc}>{era.description}</div>
              {active && eraEvents.length > 0 && (
                <div style={s.eventsSection}>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>
                    Sự kiện trong kỷ nguyên:
                  </div>
                  {eraEvents.map(ev => (
                    <span key={ev.id} className="tag-link" style={s.eventTag} onClick={(e) => { e.stopPropagation(); onNavigate && onNavigate('events'); }}>
                      {ev.name}
                      <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>{formatYear(ev.year)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
