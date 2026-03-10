import React, { useState, useMemo } from 'react';
import { PageHeader } from '../components/Ornaments';
import LocationEditorModal from '../components/LocationEditorModal';

const TYPE_LABELS = {
  capital: 'Kinh đô', sacred: 'Thánh địa', city: 'Thành phố', secret_realm: 'Bí cảnh',
  port: 'Hải cảng', resource: 'Tài nguyên', ruin: 'Phế tích', dungeon: 'Tà địa',
};
const TYPE_COLORS = {
  capital: '#ffd700', sacred: '#ffaa00', city: '#c4a35a', secret_realm: '#9b7fba',
  port: '#5ab8c4', resource: '#5ac48a', ruin: '#8a7060', dungeon: '#c45a5a',
};

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
  filters: { display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  card: (color) => ({
    padding: '18px 22px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderTop: `3px solid ${color}`,
    borderRadius: 8,
    backdropFilter: 'blur(12px)',
  }),
  locName: (color) => ({
    fontSize: 16,
    color: color,
    fontWeight: 700,
  }),
  locHan: {
    fontSize: 11,
    color: 'var(--gold-dim)',
    fontFamily: "var(--font-han)",
    marginLeft: 6,
  },
  typeTag: (color) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 10,
    background: `${color}22`,
    color: color,
    border: `1px solid ${color}44`,
    marginTop: 6,
  }),
  desc: {
    fontSize: 12,
    lineHeight: 1.6,
    color: 'var(--text-muted)',
    marginTop: 8,
  },
  meta: {
    fontSize: 11,
    color: 'var(--text-dim)',
    marginTop: 6,
    lineHeight: 1.5,
  },
};

export default function LocationsPage({ data, onNavigate, onMapNavigate }) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [raceFilter, setRaceFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const { locations = [] } = data;

  const types = useMemo(() => [...new Set(locations.map(l => l.type).filter(Boolean))], [locations]);
  const races = useMemo(() => [...new Set(locations.map(l => l.race).filter(Boolean))], [locations]);

  const filtered = useMemo(() => {
    return locations.filter(l => {
      if (typeFilter !== 'all' && l.type !== typeFilter) return false;
      if (raceFilter !== 'all' && l.race !== raceFilter) return false;
      if (searchQ) {
        const q = searchQ.toLowerCase();
        return (l.name?.toLowerCase().includes(q) || l.han?.includes(q) || l.desc?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [locations, typeFilter, raceFilter, searchQ]);

  return (
    <div style={s.page}>
      <div className="page-watermark">{'\u5730'}</div>
      <PageHeader title="Địa Điểm" han="地點" subtitle={`${locations.length} địa điểm`} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          onClick={() => { setEditItem(null); setShowEditor(true); }}
          style={{
            padding: '10px 24px',
            background: 'linear-gradient(135deg, var(--gold-dim), var(--gold))',
            color: 'var(--bg)', border: 'none', borderRadius: 6,
            fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', letterSpacing: 1, transition: 'box-shadow 0.3s',
          }}
          onMouseEnter={e => e.target.style.boxShadow = 'var(--shadow-gold-strong)'}
          onMouseLeave={e => e.target.style.boxShadow = 'none'}
        >
          + Tạo Địa Điểm
        </button>
      </div>

      <div style={s.filters}>
        <input
          className="search-input"
          style={{ width: 180, marginRight: 8 }}
          placeholder="Tìm kiếm..."
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
        <span className={`filter-pill${typeFilter === 'all' ? ' active' : ''}`} onClick={() => setTypeFilter('all')}>Tất cả</span>
        {types.map(t => (
          <span
            key={t}
            className={`filter-pill${typeFilter === t ? ' active' : ''}`}
            style={typeFilter === t ? { borderColor: TYPE_COLORS[t], color: TYPE_COLORS[t], background: `${TYPE_COLORS[t]}22` } : undefined}
            onClick={() => setTypeFilter(t)}
          >
            {TYPE_LABELS[t] || t}
          </span>
        ))}
        <span style={{ color: 'var(--border)', margin: '0 4px' }}>|</span>
        <span className={`filter-pill${raceFilter === 'all' ? ' active' : ''}`} onClick={() => setRaceFilter('all')}>Mọi tộc</span>
        {races.map(r => (
          <span key={r} className={`filter-pill${raceFilter === r ? ' active' : ''}`} onClick={() => setRaceFilter(r)}>
            {r}
          </span>
        ))}
      </div>

      <div style={s.grid}>
        {filtered.map((loc, i) => {
          const color = TYPE_COLORS[loc.type] || '#c4a35a';
          return (
            <div key={loc.id} className={`card-interactive card-reveal stagger-${(i % 12) + 1}`} style={{ ...s.card(color), cursor: 'pointer' }} onClick={() => { setEditItem(loc); setShowEditor(true); }}>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={s.locName(color)}>{loc.name}</span>
                <span style={s.locHan}>{loc.han}</span>
              </div>
              <div>
                <span style={s.typeTag(color)}>{TYPE_LABELS[loc.type] || loc.type}</span>
              </div>
              <div style={s.desc}>{loc.desc || loc.description}</div>
              <div style={s.meta}>
                {loc.race && <span>Tộc: {loc.race}</span>}
                {loc.qi && <span style={{ marginLeft: 10 }}>Linh khí: {loc.qi}</span>}
                {loc.pop > 0 && <span style={{ marginLeft: 10 }}>Dân số: {loc.pop.toLocaleString()}</span>}
                {onMapNavigate && loc.x != null && loc.y != null && (
                  <span
                    className="map-btn"
                    style={{ marginLeft: 6 }}
                    onClick={(e) => { e.stopPropagation(); onMapNavigate(loc.x, loc.y); }}
                  >
                    Xem trên Bản Đồ
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <LocationEditorModal
        isOpen={showEditor}
        onClose={() => { setShowEditor(false); setEditItem(null); }}
        data={data}
        editItem={editItem}
        onSaved={() => { setShowEditor(false); setEditItem(null); window.location.reload(); }}
      />
    </div>
  );
}
