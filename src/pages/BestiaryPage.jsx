import React, { useState, useMemo } from 'react';
import { PageHeader } from '../components/Ornaments';
import BestiaryEditorModal from '../components/BestiaryEditorModal';

const BIOME_LABELS = {
  mountain: 'Sơn Lĩnh', tundra: 'Băng Nguyên', lake: 'Hồ Trạch', forest: 'Sơn Lâm',
  desert: 'Sa Mạc', ocean: 'Đại Dương',
};
const BIOME_COLORS = {
  mountain: '#8a7060', tundra: '#88bbdd', lake: '#5a8cc4', forest: '#5ac48a',
  desert: '#c4a35a', ocean: '#5ab8c4',
};
const ICON_MAP = {
  dragon: '\u{1F409}', phoenix: '\u{1F426}', turtle: '\u{1F422}', beast: '\u{1F43B}',
  tiger: '\u{1F405}', whale: '\u{1F40B}', eagle: '\u{1F985}', spirit: '\u{2728}',
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
  filters: { display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 18,
  },
  card: (color) => ({
    padding: '20px 24px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderTop: `3px solid ${color}`,
    borderRadius: 8,
    backdropFilter: 'blur(12px)',
  }),
  icon: {
    fontSize: 32,
    marginBottom: 8,
  },
  name: (color) => ({
    fontSize: 18,
    color: color,
    fontWeight: 700,
  }),
  han: {
    fontSize: 12,
    color: 'var(--gold-dim)',
    fontFamily: "var(--font-han)",
    marginLeft: 8,
  },
  biomeTag: (color) => ({
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
  },
};

export default function BestiaryPage({ data }) {
  const [biomeFilter, setBiomeFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const { fauna = [] } = data;

  const biomes = useMemo(() => [...new Set(fauna.map(f => f.biome).filter(Boolean))], [fauna]);

  const filtered = useMemo(() => {
    let result = fauna;
    if (biomeFilter !== 'all') result = result.filter(f => f.biome === biomeFilter);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      result = result.filter(f => f.name?.toLowerCase().includes(q) || f.han?.includes(q) || f.description?.toLowerCase().includes(q));
    }
    return result;
  }, [fauna, biomeFilter, searchQ]);

  return (
    <div style={s.page}>
      <div className="page-watermark">獸</div>
      <PageHeader title="Linh Thú" han="靈獸" subtitle={`${fauna.length} linh thú`} />

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
          + Tạo Linh Thú
        </button>
      </div>

      <div style={s.filters}>
        <input
          className="search-input"
          style={{ width: 160 }}
          placeholder="Tìm kiếm..."
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
        <span className={`filter-pill${biomeFilter === 'all' ? ' active' : ''}`} onClick={() => setBiomeFilter('all')}>Tất cả</span>
        {biomes.map(b => (
          <span
            key={b}
            className={`filter-pill${biomeFilter === b ? ' active' : ''}`}
            style={biomeFilter === b ? { borderColor: BIOME_COLORS[b], color: BIOME_COLORS[b], background: `${BIOME_COLORS[b]}22` } : undefined}
            onClick={() => setBiomeFilter(b)}
          >
            {BIOME_LABELS[b] || b}
          </span>
        ))}
      </div>

      <div style={s.grid}>
        {filtered.map((f, i) => {
          const color = BIOME_COLORS[f.biome] || '#c4a35a';
          return (
            <div key={f.id} className={`card-interactive card-reveal stagger-${(i % 12) + 1}`} style={{ ...s.card(color), cursor: 'pointer' }} onClick={() => { setEditItem(f); setShowEditor(true); }}>
              <div style={s.icon}>{ICON_MAP[f.icon] || '?'}</div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={s.name(color)}>{f.name}</span>
                <span style={s.han}>{f.han}</span>
              </div>
              <div>
                <span style={s.biomeTag(color)}>{BIOME_LABELS[f.biome] || f.biome}</span>
              </div>
              <div style={s.desc}>{f.description}</div>
              <div style={s.meta}>
                Xuất hiện: Năm {f.era_start?.toLocaleString()}
                {f.era_end ? ` — ${f.era_end.toLocaleString()}` : ' — nay'}
              </div>
            </div>
          );
        })}
      </div>

      <BestiaryEditorModal
        isOpen={showEditor}
        onClose={() => { setShowEditor(false); setEditItem(null); }}
        data={data}
        editItem={editItem}
        onSaved={() => { setShowEditor(false); setEditItem(null); window.location.reload(); }}
      />
    </div>
  );
}
