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
  card: (color, active) => ({
    marginBottom: 18,
    padding: '22px 26px',
    background: active ? 'var(--bg-card-active)' : 'var(--bg-card)',
    border: `1px solid ${active ? color : 'var(--border)'}`,
    borderLeft: `4px solid ${color}`,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    backdropFilter: 'blur(12px)',
    boxShadow: active ? `0 0 20px ${color}22` : 'none',
  }),
  arcName: (color) => ({
    fontSize: 20,
    color: color,
    fontWeight: 700,
  }),
  arcHan: {
    fontSize: 12,
    color: 'var(--gold-dim)',
    fontFamily: "var(--font-han)",
    marginLeft: 8,
  },
  desc: {
    fontSize: 13,
    lineHeight: 1.7,
    color: 'var(--text-body)',
    marginTop: 10,
  },
  meta: {
    fontSize: 12,
    color: 'var(--text-dim)',
    marginTop: 6,
  },
  section: {
    marginTop: 14,
    paddingTop: 10,
    borderTop: '1px solid var(--border-light)',
  },
  tag: (color) => ({
    display: 'inline-block',
    padding: '2px 10px',
    margin: '3px 4px 3px 0',
    borderRadius: 12,
    fontSize: 11,
    background: `${color || 'var(--gold)'}15`,
    border: `1px solid ${color || 'var(--gold)'}44`,
    color: color || 'var(--gold)',
  }),
  label: {
    fontSize: 12,
    color: 'var(--text-dim)',
    marginBottom: 6,
  },
};

export default function StoryArcsPage({ data, onNavigate }) {
  const [activeArc, setActiveArc] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const { storyArcs = [], events = [], characters = [], factions = [] } = data;

  const eventMap = useMemo(() => {
    const m = {};
    events.forEach(e => { m[e.id] = e; });
    return m;
  }, [events]);

  const charMap = useMemo(() => {
    const m = {};
    characters.forEach(c => { m[c.id] = c; });
    return m;
  }, [characters]);

  const factionMap = useMemo(() => {
    const m = {};
    factions.forEach(f => { m[f.id] = f; });
    return m;
  }, [factions]);

  return (
    <div style={s.page}>
      <div className="page-watermark">故</div>
      <PageHeader title="Cốt Truyện" han="故事" subtitle={`${storyArcs.length} tuyến truyện`} />
      <input
        className="search-input"
        style={{ width: 200, marginBottom: 20 }}
        placeholder="Tìm kiếm cốt truyện..."
        value={searchQ}
        onChange={e => setSearchQ(e.target.value)}
      />

      {(searchQ ? storyArcs.filter(a => { const q = searchQ.toLowerCase(); return a.name?.toLowerCase().includes(q) || a.han?.includes(q) || a.description?.toLowerCase().includes(q); }) : storyArcs).map((arc, i) => {
        const active = activeArc === arc.id;
        const color = arc.color || 'var(--gold)';
        return (
          <div
            key={arc.id}
            className={`card-interactive card-reveal stagger-${(i % 12) + 1}`}
            style={s.card(color, active)}
            onClick={() => setActiveArc(active ? null : arc.id)}
          >
            {active && <><OrnamentalCorner position="top-right" size={24} color={color} /><OrnamentalCorner position="bottom-right" size={24} color={color} /></>}
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={s.arcName(color)}>{arc.name}</span>
              <span style={s.arcHan}>{arc.han}</span>
            </div>
            <div style={s.desc}>{arc.description}</div>
            <div style={s.meta}>
              Năm {arc.era_start?.toLocaleString()}
              {arc.era_end ? ` — ${arc.era_end.toLocaleString()}` : ' — nay'}
            </div>

            {active && (
              <>
                {arc.events && arc.events.length > 0 && (
                  <div style={s.section}>
                    <div style={s.label}>Sự kiện liên quan:</div>
                    {arc.events.map(eid => {
                      const ev = eventMap[eid];
                      return ev ? (
                        <span key={eid} className="tag-link" style={s.tag('#ffd700')} onClick={(e) => { e.stopPropagation(); onNavigate && onNavigate('events'); }}>
                          {ev.name}
                          <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>({ev.year?.toLocaleString()})</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                {arc.characters && arc.characters.length > 0 && (
                  <div style={{ ...s.section, borderTop: 'none', paddingTop: 6 }}>
                    <div style={s.label}>Nhân vật chính:</div>
                    {arc.characters.map(cid => {
                      const ch = charMap[cid];
                      const charColor = factionMap[ch?.faction]?.color || 'var(--gold)';
                      return ch ? (
                        <span key={cid} className="tag-link" style={s.tag(charColor)} onClick={(e) => { e.stopPropagation(); onNavigate && onNavigate('characters'); }}>
                          {ch.name}
                          <span style={{ fontSize: 10, color: 'var(--gold-dim)', marginLeft: 4 }}>{ch.han}</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
