import React from 'react';

// ── Chinese Cloud/Scroll Corner Ornament ──────────────────
export function OrnamentalCorner({ position = 'top-left', size = 40, color = '#c4a35a' }) {
  const posStyles = {
    'top-left': { top: 0, left: 0 },
    'top-right': { top: 0, right: 0 },
    'bottom-left': { bottom: 0, left: 0 },
    'bottom-right': { bottom: 0, right: 0 },
  };
  const transforms = {
    'top-left': '',
    'top-right': `scale(-1,1) translate(-${size},0)`,
    'bottom-left': `scale(1,-1) translate(0,-${size})`,
    'bottom-right': `scale(-1,-1) translate(-${size},-${size})`,
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ position: 'absolute', ...posStyles[position], opacity: 0.35, pointerEvents: 'none' }}
    >
      <g transform={transforms[position]}>
        {/* Cloud scroll curve */}
        <path d={`M2,2 Q2,${size*0.6} ${size*0.3},${size*0.3} Q${size*0.6},2 2,2`}
          fill="none" stroke={color} strokeWidth="1.5" />
        {/* Inner corner lines */}
        <path d={`M6,6 L6,${size*0.35} M6,6 L${size*0.35},6`}
          fill="none" stroke={color} strokeWidth="1" />
        {/* Center dot */}
        <circle cx="6" cy="6" r="2" fill={color} />
        {/* Small cloud curl */}
        <path d={`M${size*0.15},${size*0.5} Q${size*0.25},${size*0.45} ${size*0.3},${size*0.5}`}
          fill="none" stroke={color} strokeWidth="0.8" opacity="0.6" />
      </g>
    </svg>
  );
}

// ── Cloud Wave Divider ──────────────────────
export function CloudDivider({ width = '100%', color = '#c4a35a', style = {} }) {
  return (
    <svg viewBox="0 0 400 20" style={{ width, height: 20, display: 'block', margin: '16px auto', opacity: 0.3, ...style }}>
      <path d="M0,10 Q50,0 100,10 Q150,20 200,10 Q250,0 300,10 Q350,20 400,10"
        fill="none" stroke={color} strokeWidth="1" />
      <circle cx="200" cy="10" r="3" fill={color} />
      <circle cx="100" cy="10" r="2" fill={color} />
      <circle cx="300" cy="10" r="2" fill={color} />
    </svg>
  );
}

// ── Section Divider (horizontal line with center ornament) ──────────────────────
export function SectionDivider({ color = '#c4a35a', style = {} }) {
  return (
    <svg viewBox="0 0 300 12" style={{ width: '100%', maxWidth: 300, height: 12, display: 'block', margin: '20px auto 16px', opacity: 0.25, ...style }}>
      <line x1="0" y1="6" x2="120" y2="6" stroke={color} strokeWidth="1" />
      <line x1="180" y1="6" x2="300" y2="6" stroke={color} strokeWidth="1" />
      <path d="M130,6 L140,2 L150,6 L140,10 Z" fill={color} />
      <circle cx="150" cy="6" r="3" fill="none" stroke={color} strokeWidth="1" />
      <path d="M150,6 L160,2 L170,6 L160,10 Z" fill={color} />
    </svg>
  );
}

// ── Page Header with ornamental styling ──────────────────────
export function PageHeader({ title, han, subtitle, children }) {
  return (
    <div style={{
      position: 'relative',
      marginBottom: 28,
      paddingBottom: 16,
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: 26,
        color: 'var(--gold)',
        fontWeight: 700,
        letterSpacing: 3,
        fontFamily: "var(--font-display)",
        textShadow: '0 0 30px var(--gold-glow)',
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 12,
        color: 'var(--gold-dim)',
        fontFamily: "var(--font-han)",
        marginTop: 6,
        letterSpacing: 3,
      }}>
        {han}{subtitle && ` · ${subtitle}`}
      </div>
      {children}
      <CloudDivider style={{ margin: '12px auto 0' }} />
    </div>
  );
}

// ── Ornamental Card wrapper ──────────────────────
export function OrnamentalCard({ children, style = {}, corners = true, cornerSize = 30 }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      {corners && (
        <>
          <OrnamentalCorner position="top-left" size={cornerSize} />
          <OrnamentalCorner position="top-right" size={cornerSize} />
          <OrnamentalCorner position="bottom-left" size={cornerSize} />
          <OrnamentalCorner position="bottom-right" size={cornerSize} />
        </>
      )}
      {children}
    </div>
  );
}
