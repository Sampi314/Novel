import React, { useState } from 'react';

const TABS = [
  { id: 'home',       vi: 'Trang Chủ',  han: '首頁', icon: '🏠' },
  { id: 'map',        vi: 'Bản Đồ',    han: '地圖', icon: '🗺' },
  { id: 'eras',       vi: 'Kỷ Nguyên',  han: '紀元', icon: '⏳' },
  { id: 'lore',       vi: 'Thế Giới',   han: '世界', icon: '📜' },
  { id: 'factions',   vi: 'Chủng Tộc',  han: '種族', icon: '⚔' },
  { id: 'characters', vi: 'Nhân Vật',   han: '人物', icon: '👤' },
  { id: 'locations',  vi: 'Địa Điểm',   han: '地點', icon: '📍' },
  { id: 'events',     vi: 'Sự Kiện',    han: '事件', icon: '⚡' },
  { id: 'arcs',       vi: 'Cốt Truyện', han: '故事', icon: '📖' },
  { id: 'bestiary',   vi: 'Linh Thú',   han: '靈獸', icon: '🐉' },
  { id: 'literature', vi: 'Văn Chương',  han: '文章', icon: '✍' },
];

export default function Sidebar({ activeTab, onTabChange, theme, onToggleTheme }) {
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(null);

  return (
    <div style={{
      width: expanded ? 210 : 58,
      minWidth: expanded ? 210 : 58,
      height: '100vh',
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s cubic-bezier(0.22, 1, 0.36, 1), min-width 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
      overflow: 'hidden',
      zIndex: 100,
      position: 'relative',
    }}>
      {/* Sidebar atmospheric glow */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 1,
        height: '100%',
        background: 'linear-gradient(180deg, transparent 0%, rgba(196,163,90,0.15) 30%, rgba(196,163,90,0.08) 70%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div
        style={{
          padding: expanded ? '20px 16px' : '20px 0',
          textAlign: 'center',
          borderBottom: '1px solid var(--border)',
          cursor: 'pointer',
          userSelect: 'none',
          minHeight: 68,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transition: 'padding 0.3s ease',
        }}
        onClick={() => onTabChange('home')}
      >
        {expanded ? (
          <>
            <div style={{
              fontFamily: "var(--font-display)",
              fontSize: 17,
              color: 'var(--gold)',
              fontWeight: 700,
              letterSpacing: 3,
              lineHeight: 1.3,
              textShadow: 'var(--shadow-gold)',
            }}>Cố Nguyên Giới</div>
            <div style={{
              fontFamily: "var(--font-han)",
              fontSize: 11,
              color: 'var(--text-dim)',
              letterSpacing: 5,
              marginTop: 4,
            }}>固 元 界</div>
          </>
        ) : (
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            color: 'var(--gold)',
            fontWeight: 700,
            textShadow: 'var(--shadow-gold)',
          }}>固</div>
        )}
        {/* Bottom decorative line */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: '20%',
          right: '20%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(196,163,90,0.2), transparent)',
        }} />
      </div>

      {/* Navigation */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '6px 0',
      }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const isHovered = hovered === tab.id;
          return (
            <div
              key={tab.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: expanded ? 12 : 0,
                padding: expanded ? '11px 16px' : '11px 0',
                justifyContent: expanded ? 'flex-start' : 'center',
                cursor: 'pointer',
                background: active
                  ? 'linear-gradient(90deg, var(--gold-glow) 0%, transparent 100%)'
                  : isHovered
                    ? 'linear-gradient(90deg, var(--gold-glow) 0%, transparent 100%)'
                    : 'transparent',
                borderLeft: active
                  ? '2px solid var(--gold)'
                  : '2px solid transparent',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
              onClick={() => onTabChange(tab.id)}
              onMouseEnter={() => setHovered(tab.id)}
              onMouseLeave={() => setHovered(null)}
              title={!expanded ? tab.vi : undefined}
            >
              {/* Active glow indicator */}
              {active && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '15%',
                  bottom: '15%',
                  width: 2,
                  background: 'var(--gold)',
                  boxShadow: '0 0 8px rgba(196,163,90,0.5), 0 0 16px rgba(196,163,90,0.2)',
                }} />
              )}
              <span style={{
                fontSize: 17,
                width: 26,
                textAlign: 'center',
                flexShrink: 0,
                filter: active ? 'none' : 'grayscale(30%)',
                opacity: active ? 1 : isHovered ? 0.9 : 0.65,
                transition: 'opacity 0.2s, filter 0.2s',
              }}>{tab.icon}</span>
              {expanded && (
                <div style={{ overflow: 'hidden' }}>
                  <div style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14.5,
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--gold-bright)' : isHovered ? 'var(--text)' : 'var(--text-body)',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.3,
                    letterSpacing: 0.3,
                    transition: 'color 0.2s',
                  }}>{tab.vi}</div>
                  <div style={{
                    fontSize: 10,
                    color: active ? 'var(--text-dim)' : 'var(--gold-dim)',
                    fontFamily: "var(--font-han)",
                    whiteSpace: 'nowrap',
                    letterSpacing: 1,
                    transition: 'color 0.2s',
                  }}>{tab.han}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom controls */}
      <div style={{ borderTop: '1px solid var(--border)', position: 'relative' }}>
        {/* Top decorative line */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '20%',
          right: '20%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(196,163,90,0.15), transparent)',
        }} />

        {/* Theme toggle */}
        {onToggleTheme && (
          <div
            style={{
              padding: expanded ? '10px 16px' : '10px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: expanded ? 'flex-start' : 'center',
              gap: 10,
              cursor: 'pointer',
              color: hovered === '_theme' ? 'var(--gold)' : 'var(--text-dim)',
              userSelect: 'none',
              transition: 'color 0.2s',
            }}
            onClick={onToggleTheme}
            onMouseEnter={() => setHovered('_theme')}
            onMouseLeave={() => setHovered(null)}
            title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
          >
            <span style={{
              fontSize: 16,
              width: 26,
              textAlign: 'center',
              flexShrink: 0,
              transition: 'transform 0.4s ease',
              transform: theme === 'dark' ? 'rotate(0deg)' : 'rotate(180deg)',
            }}>
              {theme === 'dark' ? '☀' : '☽'}
            </span>
            {expanded && (
              <span style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                whiteSpace: 'nowrap',
              }}>
                {theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
              </span>
            )}
          </div>
        )}

        {/* Collapse toggle */}
        <div
          style={{
            padding: '12px',
            textAlign: 'center',
            cursor: 'pointer',
            color: hovered === '_toggle' ? 'var(--gold)' : 'var(--text-dim)',
            fontSize: 13,
            userSelect: 'none',
            transition: 'color 0.2s',
          }}
          onClick={() => setExpanded(e => !e)}
          onMouseEnter={() => setHovered('_toggle')}
          onMouseLeave={() => setHovered(null)}
        >
          {expanded ? '◀' : '▶'}
        </div>
      </div>
    </div>
  );
}

export { TABS };
