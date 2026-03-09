import React, { useMemo } from 'react';

export default function CharacterTimeline({ characters, eras, factions, locations }) {
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

  // Sort characters by era_start
  const sorted = useMemo(() => {
    return [...characters].sort((a, b) => a.era_start - b.era_start);
  }, [characters]);

  // Group into eras
  const eraGroups = useMemo(() => {
    const groups = [];
    eras.forEach(era => {
      const chars = sorted.filter(c => {
        const start = c.era_start;
        const end = c.era_end != null ? c.era_end : Infinity;
        return start <= (era.yearEnd || Infinity) && end >= (era.yearStart || -Infinity);
      });
      if (chars.length > 0) groups.push({ era, chars });
    });
    return groups;
  }, [sorted, eras]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Vertical line */}
      <div style={{
        position: 'absolute', left: 20, top: 0, bottom: 0, width: 2,
        background: 'linear-gradient(180deg, var(--gold), var(--border))',
      }} />

      {eraGroups.map((group, gi) => (
        <div key={group.era.name} style={{ marginBottom: 32, paddingLeft: 48 }}>
          {/* Era marker */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: -38, top: 4, width: 12, height: 12,
              borderRadius: '50%', background: 'var(--gold)', border: '2px solid var(--bg)',
            }} />
            <div style={{
              fontSize: 16, fontWeight: 700, color: 'var(--gold)', marginBottom: 12,
              borderBottom: '1px solid var(--border)', paddingBottom: 6,
            }}>
              {group.era.name}
              {group.era.han && <span style={{ fontSize: 12, fontFamily: 'var(--font-han)', color: 'var(--gold-dim)', marginLeft: 8 }}>{group.era.han}</span>}
            </div>
          </div>

          {/* Characters in this era */}
          {group.chars.map((c, ci) => {
            const color = factionMap[c.faction]?.color || 'var(--gold)';
            return (
              <div key={c.id} style={{ position: 'relative', marginBottom: 12 }}>
                {/* Dot on timeline */}
                <div style={{
                  position: 'absolute', left: -34, top: 8, width: 6, height: 6,
                  borderRadius: '50%', background: color,
                }} />

                <div style={{
                  padding: '10px 16px', background: 'var(--bg-card)',
                  border: '1px solid var(--border)', borderLeft: `3px solid ${color}`,
                  borderRadius: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color }}>{c.name}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-han)', color: 'var(--gold-dim)' }}>{c.han}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                      {c.era_start?.toLocaleString()} — {c.era_end ? c.era_end.toLocaleString() : 'nay'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                    {c.role} | {factionMap[c.faction]?.name || c.faction}
                  </div>
                  {/* Journey */}
                  {c.journey?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                      {c.journey.map((locId, i) => (
                        <span key={i}>
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 8,
                            background: 'var(--gold-glow)', border: '1px solid var(--border)',
                            color: 'var(--text-body)',
                          }}>{locationMap[locId]?.name || locId}</span>
                          {i < c.journey.length - 1 && <span style={{ color: 'var(--gold-dim)', fontSize: 9 }}> → </span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
