import React, { useState, useMemo } from 'react';
import { PageHeader, OrnamentalCorner } from '../components/Ornaments';

const s = {
  page: {
    padding: '32px 40px',
    maxWidth: 1200,
    margin: '0 auto',
    fontFamily: "var(--font-body)",
    color: 'var(--text)',
    minHeight: '100vh',
    position: 'relative',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 20,
  },
  card: (color, active) => ({
    padding: '22px 26px',
    background: active ? 'var(--bg-card-active)' : 'var(--bg-card)',
    border: `1px solid ${active ? color : 'var(--border)'}`,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
    backdropFilter: 'blur(12px)',
    boxShadow: active ? `0 0 20px ${color}22` : 'none',
    position: 'relative',
  }),
  factionName: (color) => ({
    fontSize: 20,
    color: color,
    fontWeight: 700,
    fontFamily: "var(--font-display)",
  }),
  factionHan: {
    fontSize: 12,
    color: 'var(--text-dim)',
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
    marginTop: 8,
  },
  relSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTop: '1px solid var(--border-light)',
  },
  relTag: (type) => ({
    display: 'inline-block',
    padding: '2px 8px',
    margin: '3px 4px 3px 0',
    borderRadius: 10,
    fontSize: 11,
    background: type === 'ally' ? 'rgba(90,140,196,0.15)'
      : type === 'enemy' ? 'rgba(196,90,90,0.15)'
      : type === 'vassal' || type === 'suzerain' ? 'rgba(196,163,90,0.15)'
      : type === 'exploit' ? 'rgba(196,120,50,0.15)'
      : type === 'trade' ? 'rgba(90,196,140,0.15)'
      : type === 'complex' ? 'rgba(155,127,186,0.15)'
      : 'rgba(106,90,58,0.15)',
    color: type === 'ally' ? 'var(--accent-blue)'
      : type === 'enemy' ? 'var(--accent-red)'
      : type === 'vassal' || type === 'suzerain' ? 'var(--gold)'
      : type === 'exploit' ? 'var(--accent-orange)'
      : type === 'trade' ? 'var(--accent-green)'
      : type === 'complex' ? 'var(--accent-purple)'
      : 'var(--text-dim)',
    border: '1px solid currentColor',
  }),
  powerSection: {
    marginTop: 40,
    padding: '24px 28px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
  },
  subRaceSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTop: '1px solid var(--border-light)',
  },
  subRaceCard: {
    padding: '8px 12px',
    marginBottom: 6,
    background: 'var(--gold-glow)',
    borderRadius: 6,
    border: '1px solid var(--border-light)',
  },
};

const REL_LABELS = { ally: 'Đồng minh', enemy: 'Thù địch', vassal: 'Chư hầu', suzerain: 'Tông chủ', neutral: 'Trung lập', exploit: 'Lợi dụng', trade: 'Giao thương', complex: 'Phức tạp' };
const POP_LABELS = { 'hiếm': '★', 'ít': '★★', 'trung bình': '★★★', 'nhiều': '★★★★' };

export default function FactionsPage({ data, onNavigate }) {
  const [activeFaction, setActiveFaction] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const { factions = [], locations = [], powerSystem = {}, subRaces = [] } = data;

  const factionColors = {};
  factions.forEach(f => { factionColors[f.id] = f.color; });

  const getFactionName = (id) => factions.find(f => f.id === id)?.name || id;
  const getLocationName = (id) => locations.find(l => l.id === id)?.name || id;

  const subRacesByFaction = useMemo(() => {
    const map = {};
    subRaces.forEach(sr => {
      if (!map[sr.faction_id]) map[sr.faction_id] = [];
      map[sr.faction_id].push(sr);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.rank - b.rank));
    return map;
  }, [subRaces]);

  const filteredFactions = useMemo(() => {
    if (!searchQ) return factions;
    const q = searchQ.toLowerCase();
    return factions.filter(f => f.name?.toLowerCase().includes(q) || f.han?.includes(q) || f.description?.toLowerCase().includes(q));
  }, [factions, searchQ]);

  return (
    <div style={s.page}>
      <div className="page-watermark">族</div>
      <PageHeader title="Chủng Tộc" han="種族" subtitle={`Mười tộc của Cố Nguyên Giới · ${subRaces.length} nhánh nhỏ`} />
      <input
        className="search-input"
        style={{ width: 220, marginBottom: 20 }}
        placeholder="Tìm kiếm chủng tộc..."
        value={searchQ}
        onChange={e => setSearchQ(e.target.value)}
      />

      <div style={s.grid}>
        {filteredFactions.map((f, idx) => {
          const active = activeFaction === f.id;
          const subs = subRacesByFaction[f.id] || [];
          return (
            <div
              key={f.id}
              className={`card-reveal stagger-${Math.min(idx + 1, 12)}`}
              style={s.card(f.color, active)}
              onClick={() => setActiveFaction(active ? null : f.id)}
            >
              {active && <><OrnamentalCorner position="top-right" size={24} color={f.color} /><OrnamentalCorner position="bottom-right" size={24} color={f.color} /></>}
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={s.factionName(f.color)}>{f.name}</span>
                <span style={s.factionHan}>{f.han}</span>
              </div>
              <div style={s.desc}>{f.description}</div>
              <div style={s.meta}>
                Kinh đô: {getLocationName(f.capital)}
                {f.era_end && ` · Sụp đổ: Năm ${f.era_end.toLocaleString()}`}
                {subs.length > 0 && <span style={{ marginLeft: 8, color: f.color, opacity: 0.7 }}>{subs.length} nhánh</span>}
              </div>

              {active && f.relations && f.relations.length > 0 && (
                <div style={s.relSection}>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Quan hệ:</div>
                  {f.relations.map((rel, i) => (
                    <span key={i} style={s.relTag(rel.type)}>
                      {REL_LABELS[rel.type] || rel.type}: {getFactionName(rel.target)}
                    </span>
                  ))}
                </div>
              )}

              {active && subs.length > 0 && (
                <div style={s.subRaceSection}>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8, letterSpacing: 1 }}>Các nhánh nhỏ:</div>
                  {subs.map(sr => (
                    <div key={sr.id} style={s.subRaceCard}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ color: f.color, fontWeight: 600, fontSize: 14 }}>{sr.name}</span>
                        <span style={{ color: 'var(--text-dim)', fontSize: 11, fontFamily: "var(--font-han)" }}>{sr.han}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)' }}>
                          {POP_LABELS[sr.population] || ''} {sr.population}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{sr.description}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                        Môi trường: {sr.habitat} · Đặc trưng: {sr.trait}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Power Sources */}
      {powerSystem.sources && (
        <div style={s.powerSection} className="card-reveal">
          <div style={{ fontSize: 18, color: 'var(--gold)', fontWeight: 700, marginBottom: 14, fontFamily: "var(--font-display)" }}>
            Nguồn Sức Mạnh<span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8 }}>力量之源</span>
          </div>
          {Object.entries(powerSystem.sources).map(([race, info]) => {
            const fc = factions.find(f => f.name?.includes(race.split(' ')[0]));
            return (
              <div key={race} style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--gold-glow)', borderRadius: 6, border: '1px solid var(--border-light)' }}>
                <span style={{ color: fc?.color || 'var(--gold)', fontWeight: 600, fontSize: 14 }}>{race}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 8 }}>{info.source}</span>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{info.description}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
