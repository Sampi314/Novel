import React, { useState, useMemo } from 'react';
import { PageHeader } from '../components/Ornaments';

const TYPE_COLORS = { battle: '#ff4444', founded: '#44ff88', destroyed: '#ff8844', lore: '#ffd700', custom: '#88aaff' };
const TYPE_LABELS = { battle: 'Chiến trận', founded: 'Thành lập', destroyed: 'Hủy diệt', lore: 'Truyền thuyết', custom: 'Tùy chọn' };

const s = {
  page: {
    padding: '32px 40px',
    maxWidth: 900,
    margin: '0 auto',
    fontFamily: "var(--font-body)",
    color: 'var(--text)',
    minHeight: '100vh',
    position: 'relative',
  },
  eraGroup: {
    marginBottom: 32,
  },
  eraLabel: (accent) => ({
    fontSize: 16,
    color: accent,
    fontWeight: 700,
    marginBottom: 14,
    paddingBottom: 6,
    borderBottom: `1px solid ${accent}44`,
  }),
  timeline: {
    position: 'relative',
    paddingLeft: 36,
  },
  line: {
    position: 'absolute',
    left: 14,
    top: 0,
    bottom: 0,
    width: 2,
    background: 'var(--border)',
  },
  card: (typeColor) => ({
    position: 'relative',
    marginBottom: 14,
    padding: '16px 20px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderLeft: `3px solid ${typeColor}`,
    borderRadius: 6,
    backdropFilter: 'blur(12px)',
  }),
  dot: (typeColor) => ({
    position: 'absolute',
    left: -30,
    top: 20,
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: typeColor,
    border: '2px solid var(--bg)',
  }),
  eventName: {
    fontSize: 15,
    color: 'var(--text)',
    fontWeight: 600,
  },
  eventHan: {
    fontSize: 11,
    color: 'var(--gold-dim)',
    fontFamily: "var(--font-han)",
    marginLeft: 6,
  },
  typeTag: (color) => ({
    display: 'inline-block',
    padding: '1px 8px',
    borderRadius: 8,
    fontSize: 10,
    background: `${color}22`,
    color: color,
    marginLeft: 8,
  }),
  year: {
    fontSize: 11,
    color: 'var(--text-dim)',
    marginTop: 3,
  },
  desc: {
    fontSize: 12,
    lineHeight: 1.6,
    color: 'var(--text-muted)',
    marginTop: 6,
  },
  factionTags: {
    marginTop: 6,
  },
  factionTag: {
    display: 'inline-block',
    padding: '1px 7px',
    margin: '2px 3px 2px 0',
    borderRadius: 8,
    fontSize: 10,
    background: 'var(--gold-glow)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-body)',
  },
};

/* mapBtnStyle replaced by .map-btn CSS class */

export default function EventsPage({ data, onNavigate, onMapNavigate }) {
  const [searchQ, setSearchQ] = useState('');
  const { events = [], eras = [], factions = [] } = data;

  const factionMap = useMemo(() => {
    const m = {};
    factions.forEach(f => { m[f.id] = f; });
    return m;
  }, [factions]);

  const sortedEvents = useMemo(() => {
    let evts = [...events].sort((a, b) => a.year - b.year);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      evts = evts.filter(e => e.name?.toLowerCase().includes(q) || e.han?.includes(q) || e.description?.toLowerCase().includes(q));
    }
    return evts;
  }, [events, searchQ]);

  const grouped = useMemo(() => {
    const groups = [];
    for (let i = 0; i < eras.length; i++) {
      const era = eras[i];
      const nextYear = eras[i + 1]?.year ?? Infinity;
      const eraEvents = sortedEvents.filter(e => e.year >= era.year && e.year < nextYear);
      if (eraEvents.length > 0) {
        groups.push({ era, events: eraEvents });
      }
    }
    return groups;
  }, [sortedEvents, eras]);

  return (
    <div style={s.page}>
      <div className="page-watermark">事</div>
      <PageHeader title="Sự Kiện" han="事件" subtitle={`${events.length} sự kiện lịch sử`} />
      <input
        className="search-input"
        style={{ width: 200, marginBottom: 20 }}
        placeholder="Tìm kiếm sự kiện..."
        value={searchQ}
        onChange={e => setSearchQ(e.target.value)}
      />

      {grouped.map(({ era, events: eraEvents }) => (
        <div key={era.name} style={s.eraGroup}>
          <div style={s.eraLabel(era.accent)}>
            {era.name}
            <span style={{ fontSize: 11, color: 'var(--gold-dim)', marginLeft: 8 }}>{era.han}</span>
          </div>
          <div style={s.timeline}>
            <div style={s.line} />
            {eraEvents.map(ev => {
              const typeColor = TYPE_COLORS[ev.type] || '#c4a35a';
              const evFactions = ev.factions ? ev.factions.split('|') : [];
              return (
                <div key={ev.id} className="card-interactive card-reveal" style={s.card(typeColor)}>
                  <div style={s.dot(typeColor)} />
                  <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={s.eventName}>{ev.name}</span>
                    <span style={s.eventHan}>{ev.han}</span>
                    <span style={s.typeTag(typeColor)}>{TYPE_LABELS[ev.type] || ev.type}</span>
                  </div>
                  <div style={s.year}>
                    Năm {ev.year.toLocaleString()}
                    {onMapNavigate && ev.x != null && ev.y != null && ev.x > 0 && (
                      <span
                        className="map-btn"
                        style={{ marginLeft: 6 }}
                        onClick={(e) => { e.stopPropagation(); onMapNavigate(ev.x, ev.y); }}
                      >
                        Xem trên Bản Đồ
                      </span>
                    )}
                  </div>
                  <div style={s.desc}>{ev.description}</div>
                  {evFactions.length > 0 && (
                    <div style={s.factionTags}>
                      {evFactions.map(fid => (
                        <span key={fid} className="tag-link" style={{ ...s.factionTag, color: factionMap[fid]?.color || 'var(--text-body)' }} onClick={(e) => { e.stopPropagation(); onNavigate && onNavigate('factions'); }}>
                          {factionMap[fid]?.name || fid}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
