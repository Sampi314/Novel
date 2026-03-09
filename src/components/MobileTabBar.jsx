import React from 'react';

const TABS = [
  { id: 'home',       icon: '\u{1F3E0}' },
  { id: 'map',        icon: '\u{1F5FA}' },
  { id: 'eras',       icon: '\u231B' },
  { id: 'lore',       icon: '\u{1F4DC}' },
  { id: 'factions',   icon: '\u2694' },
  { id: 'characters', icon: '\u{1F464}' },
  { id: 'locations',  icon: '\u{1F4CD}' },
  { id: 'events',     icon: '\u26A1' },
  { id: 'arcs',       icon: '\u{1F4D6}' },
  { id: 'bestiary',   icon: '\u{1F409}' },
  { id: 'literature', icon: '\u270D' },
];

const s = {
  bar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 52,
    background: 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 100%)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 200,
    padding: '0 4px',
  },
  tab: (active) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 4px',
    cursor: 'pointer',
    borderTop: active ? '2px solid var(--gold)' : '2px solid transparent',
    marginTop: -1,
    minWidth: 28,
    transition: 'border-color 0.15s',
  }),
  icon: (active) => ({
    fontSize: 18,
    opacity: active ? 1 : 0.5,
    filter: active ? 'none' : 'grayscale(0.5)',
    transition: 'opacity 0.15s',
  }),
  dot: {
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: 'var(--gold)',
    marginTop: 3,
  },
};

export default function MobileTabBar({ activeTab, onTabChange }) {
  return (
    <div style={s.bar}>
      {TABS.map(tab => {
        const active = activeTab === tab.id;
        return (
          <div key={tab.id} style={s.tab(active)} onClick={() => onTabChange(tab.id)}>
            <span style={s.icon(active)}>{tab.icon}</span>
            {active && <div style={s.dot} />}
          </div>
        );
      })}
    </div>
  );
}
