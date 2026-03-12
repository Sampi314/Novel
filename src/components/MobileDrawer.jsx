import React, { useState, useEffect, useRef } from 'react';
import { TABS } from './Sidebar';

/**
 * MobileDrawer — hamburger button + slide-out navigation drawer.
 * Replaces MobileTabBar on screens ≤ 640px.
 *
 * Features:
 *   - 44×44px hamburger button (top-left, frosted glass)
 *   - 280px slide-out drawer from left
 *   - Backdrop overlay to dismiss
 *   - Swipe-from-left-edge to open, swipe-left on drawer to close
 */
export default function MobileDrawer({ activeTab, onTabChange, theme, onToggleTheme }) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef(null);
  const swipeRef = useRef({ startX: 0, startY: 0, tracking: false });

  // Close drawer on tab change
  const handleTab = (id) => {
    onTabChange(id);
    setOpen(false);
  };

  // Swipe-from-edge to open (within 20px of left edge)
  useEffect(() => {
    const onTouchStart = (e) => {
      const t = e.touches[0];
      if (!open && t.clientX < 20) {
        swipeRef.current = { startX: t.clientX, startY: t.clientY, tracking: true };
      } else if (open) {
        swipeRef.current = { startX: t.clientX, startY: t.clientY, tracking: true };
      }
    };

    const onTouchMove = (e) => {
      if (!swipeRef.current.tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - swipeRef.current.startX;
      const dy = Math.abs(t.clientY - swipeRef.current.startY);
      // Only horizontal swipes
      if (dy > Math.abs(dx)) {
        swipeRef.current.tracking = false;
        return;
      }
      if (!open && dx > 50) {
        setOpen(true);
        swipeRef.current.tracking = false;
      } else if (open && dx < -50) {
        setOpen(false);
        swipeRef.current.tracking = false;
      }
    };

    const onTouchEnd = () => {
      swipeRef.current.tracking = false;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [open]);

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Menu"
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          width: 44,
          height: 44,
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: open ? 0 : 5,
          background: 'var(--bg-panel)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          cursor: 'pointer',
          padding: 0,
          boxShadow: 'var(--shadow-card)',
          transition: 'gap 0.2s ease',
        }}
      >
        {/* Animated hamburger → X */}
        <span style={{
          display: 'block',
          width: 18,
          height: 2,
          background: 'var(--gold)',
          borderRadius: 1,
          transition: 'transform 0.25s ease',
          transform: open ? 'translateY(3.5px) rotate(45deg)' : 'none',
        }} />
        <span style={{
          display: 'block',
          width: 18,
          height: 2,
          background: 'var(--gold)',
          borderRadius: 1,
          transition: 'opacity 0.15s ease',
          opacity: open ? 0 : 1,
        }} />
        <span style={{
          display: 'block',
          width: 18,
          height: 2,
          background: 'var(--gold)',
          borderRadius: 1,
          transition: 'transform 0.25s ease',
          transform: open ? 'translateY(-3.5px) rotate(-45deg)' : 'none',
        }} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 249,
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 280,
          height: '100%',
          background: 'var(--sidebar-bg)',
          backdropFilter: 'blur(20px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
          borderRight: '1px solid var(--border)',
          zIndex: 250,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px 20px 16px',
          textAlign: 'center',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            color: 'var(--gold)',
            fontWeight: 700,
            letterSpacing: 3,
            textShadow: 'var(--shadow-gold)',
          }}>Thiên Hoang Đại Lục</div>
          <div style={{
            fontFamily: 'var(--font-han)',
            fontSize: 11,
            color: 'var(--text-dim)',
            letterSpacing: 5,
            marginTop: 4,
          }}>固 元 界</div>
        </div>

        {/* Navigation items */}
        <div style={{ flex: 1, padding: '8px 0' }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => handleTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '13px 20px',
                  cursor: 'pointer',
                  minHeight: 44,
                  background: active
                    ? 'linear-gradient(90deg, var(--gold-glow) 0%, transparent 100%)'
                    : 'transparent',
                  borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent',
                  transition: 'background 0.2s ease',
                }}
              >
                <span style={{
                  fontSize: 18,
                  width: 28,
                  textAlign: 'center',
                  flexShrink: 0,
                  opacity: active ? 1 : 0.6,
                  filter: active ? 'none' : 'grayscale(30%)',
                }}>{tab.icon}</span>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--gold-bright)' : 'var(--text-body)',
                    lineHeight: 1.3,
                  }}>{tab.vi}</div>
                  <div style={{
                    fontSize: 10,
                    color: active ? 'var(--text-dim)' : 'var(--gold-dim)',
                    fontFamily: 'var(--font-han)',
                    letterSpacing: 1,
                  }}>{tab.han}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Theme toggle at bottom */}
        {onToggleTheme && (
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: '12px 20px',
          }}>
            <div
              onClick={onToggleTheme}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                color: 'var(--text-dim)',
                minHeight: 44,
              }}
            >
              <span style={{
                fontSize: 16,
                width: 28,
                textAlign: 'center',
                transition: 'transform 0.4s ease',
                transform: theme === 'dark' ? 'rotate(0deg)' : 'rotate(180deg)',
              }}>
                {theme === 'dark' ? '☀' : '☽'}
              </span>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
              }}>
                {theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
