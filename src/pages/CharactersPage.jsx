import React, { useState, useMemo } from 'react';
import { PageHeader } from '../components/Ornaments';

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
  filters: {
    display: 'flex',
    gap: 10,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 18,
  },
  card: (color) => ({
    padding: '20px 24px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderLeft: `3px solid ${color}`,
    borderRadius: 8,
    backdropFilter: 'blur(12px)',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }),
  charName: (color) => ({
    fontSize: 18,
    color: color,
    fontWeight: 700,
  }),
  charHan: {
    fontSize: 12,
    color: 'var(--gold-dim)',
    fontFamily: "var(--font-han)",
    marginLeft: 8,
  },
  meta: {
    fontSize: 12,
    color: 'var(--text-dim)',
    marginTop: 6,
    lineHeight: 1.6,
  },
  journeySection: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: '1px solid var(--border-light)',
  },
  journeyStep: {
    display: 'inline-block',
    padding: '2px 8px',
    margin: '2px 4px 2px 0',
    borderRadius: 10,
    fontSize: 11,
    background: 'var(--gold-glow)',
    border: '1px solid var(--border)',
    color: 'var(--text-body)',
  },
  powerBar: (level, color) => ({
    display: 'inline-block',
    width: 60,
    height: 4,
    borderRadius: 2,
    background: 'var(--border)',
    position: 'relative',
    verticalAlign: 'middle',
    marginLeft: 6,
    overflow: 'hidden',
  }),
  powerFill: (level, color) => ({
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: `${(level / 5) * 100}%`,
    background: color,
    borderRadius: 2,
  }),
};

export default function CharactersPage({ data, onNavigate, onMapNavigate }) {
  const [filter, setFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const { characters = [], factions = [], locations = [] } = data;

  const factionMap = useMemo(() => {
    const m = {};
    factions.forEach(f => { m[f.id] = f; });
    return m;
  }, [factions]);

  const locationMap = useMemo(() => {
    const m = {};
    locations.forEach(l => { m[l.id] = l; });
    return m;
  }, [locations]);

  const factionIds = useMemo(() => [...new Set(characters.map(c => c.faction).filter(Boolean))], [characters]);

  const filtered = useMemo(() => {
    let result = characters;
    if (filter !== 'all') result = result.filter(c => c.faction === filter);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      result = result.filter(c => c.name?.toLowerCase().includes(q) || c.han?.includes(q) || c.role?.toLowerCase().includes(q));
    }
    return result;
  }, [characters, filter, searchQ]);

  const getColor = (factionId) => factionMap[factionId]?.color || 'var(--gold)';
  const getLocName = (id) => locationMap[id]?.name || id;

  return (
    <div style={s.page}>
      <div className="page-watermark">{'\u4EBA'}</div>
      <PageHeader title="Nhân Vật" han="人物" subtitle={`${characters.length} nhân vật`} />

      <div style={s.filters}>
        <input
          className="search-input"
          style={{ width: 160 }}
          placeholder="Tìm kiếm..."
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
        <span
          className={`filter-pill${filter === 'all' ? ' active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Tất cả
        </span>
        {factionIds.map(fid => (
          <span
            key={fid}
            className={`filter-pill${filter === fid ? ' active' : ''}`}
            style={filter === fid ? {
              borderColor: getColor(fid),
              color: getColor(fid),
              background: `${getColor(fid)}22`,
            } : undefined}
            onClick={() => setFilter(fid)}
          >
            {factionMap[fid]?.name || fid}
          </span>
        ))}
      </div>

      <div style={s.grid}>
        {filtered.map((c, i) => {
          const color = getColor(c.faction);
          return (
            <div key={c.id} className={`card-interactive card-reveal stagger-${(i % 12) + 1}`} style={s.card(color)}>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={s.charName(color)}>{c.name}</span>
                <span style={s.charHan}>{c.han}</span>
              </div>
              <div style={s.meta}>
                <div>
                  Vai trò: {c.role}
                  <span style={{ marginLeft: 12 }}>
                    Sức mạnh:
                    <span style={s.powerBar(c.power, color)}>
                      <span style={s.powerFill(c.power, color)} />
                    </span>
                  </span>
                </div>
                <div>Thế lực: <span className="cross-link" onClick={(e) => { e.stopPropagation(); onNavigate && onNavigate('factions'); }}>{factionMap[c.faction]?.name || c.faction}</span></div>
                <div>
                  Hoạt động: Năm {c.era_start?.toLocaleString()}
                  {c.era_end ? ` \u2014 ${c.era_end.toLocaleString()}` : ' \u2014 nay'}
                  {onMapNavigate && c.location_id && locationMap[c.location_id]?.x != null && (
                    <span
                      className="map-btn"
                      style={{ marginLeft: 6 }}
                      onClick={(e) => { e.stopPropagation(); const loc = locationMap[c.location_id]; onMapNavigate(loc.x, loc.y); }}
                    >
                      Xem trên Bản Đồ
                    </span>
                  )}
                </div>
              </div>

              {c.journey && c.journey.length > 0 && (
                <div style={s.journeySection}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Hành trình:</div>
                  {c.journey.map((locId, i) => (
                    <span key={i}>
                      <span style={s.journeyStep}>{getLocName(locId)}</span>
                      {i < c.journey.length - 1 && <span style={{ color: 'var(--gold-dim)', fontSize: 10 }}> \u2192 </span>}
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
