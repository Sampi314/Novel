import React, { useEffect, useRef, useMemo } from 'react';

// ── Linh Khí Particle Animation ──────────────────────
function LinhKhiParticles() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = canvas.offsetWidth * 2; canvas.height = canvas.offsetHeight * 2; ctx.scale(2, 2); };
    resize();
    window.addEventListener('resize', resize);

    const count = 80;
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -Math.random() * 0.35 - 0.08,
      r: Math.random() * 2.2 + 0.4,
      alpha: Math.random() * 0.5 + 0.08,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.015 + 0.004,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      const particles = particlesRef.current;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += p.pulseSpeed;
        const a = p.alpha * (0.4 + 0.6 * Math.sin(p.pulse));
        if (p.y < -10) { p.y = canvas.offsetHeight + 10; p.x = Math.random() * canvas.offsetWidth; }
        if (p.x < -10) p.x = canvas.offsetWidth + 10;
        if (p.x > canvas.offsetWidth + 10) p.x = -10;
        // Outer glow
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        grad.addColorStop(0, `rgba(232,201,106,${a * 0.6})`);
        grad.addColorStop(0.3, `rgba(196,163,90,${a * 0.25})`);
        grad.addColorStop(1, 'rgba(196,163,90,0)');
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,230,150,${a * 1.2})`;
        ctx.fill();
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }}
    />
  );
}

// ── Ornamental Corner SVG ──────────────────────
function OrnamentalCorner({ position = 'top-left', size = 40, color = '#c4a35a' }) {
  const transforms = {
    'top-left': '',
    'top-right': `scale(-1,1) translate(-${size},0)`,
    'bottom-left': `scale(1,-1) translate(0,-${size})`,
    'bottom-right': `scale(-1,-1) translate(-${size},-${size})`,
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ position: 'absolute', ...posMap(position, size), opacity: 0.35, pointerEvents: 'none' }}
    >
      <g transform={transforms[position]}>
        <path d={`M2,2 Q2,${size * 0.6} ${size * 0.3},${size * 0.3} Q${size * 0.6},2 2,2`}
          fill="none" stroke={color} strokeWidth="1.2" />
        <path d={`M6,6 L6,${size * 0.35} M6,6 L${size * 0.35},6`}
          fill="none" stroke={color} strokeWidth="0.8" />
        <circle cx="6" cy="6" r="1.5" fill={color} />
      </g>
    </svg>
  );
}

function posMap(pos, size) {
  switch (pos) {
    case 'top-left': return { top: 0, left: 0 };
    case 'top-right': return { top: 0, right: 0 };
    case 'bottom-left': return { bottom: 0, left: 0 };
    case 'bottom-right': return { bottom: 0, right: 0 };
  }
}

// ── Decorative Divider ──────────────────────
function GoldDivider({ width = 200 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '20px auto', width }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, var(--gold-glow))' }} />
      <div style={{ width: 5, height: 5, background: 'var(--gold)', transform: 'rotate(45deg)', opacity: 0.5 }} />
      <div style={{ width: 3, height: 3, background: 'var(--gold)', borderRadius: '50%', opacity: 0.3 }} />
      <div style={{ width: 5, height: 5, background: 'var(--gold)', transform: 'rotate(45deg)', opacity: 0.5 }} />
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(270deg, transparent, var(--gold-glow))' }} />
    </div>
  );
}

// ── Cloud Divider ──────────────────────
function CloudDivider({ width = '100%', color = '#c4a35a' }) {
  return (
    <svg viewBox="0 0 400 20" style={{ width, height: 20, display: 'block', margin: '16px auto', opacity: 0.25 }}>
      <path d="M0,10 Q50,0 100,10 Q150,20 200,10 Q250,0 300,10 Q350,20 400,10"
        fill="none" stroke={color} strokeWidth="1" />
      <circle cx="200" cy="10" r="3" fill={color} />
      <circle cx="100" cy="10" r="2" fill={color} />
      <circle cx="300" cy="10" r="2" fill={color} />
    </svg>
  );
}

const SHORTCUTS = [
  { id: 'map', icon: '🗺', vi: 'Bản Đồ', han: '地圖', desc: 'Khám phá bản đồ tương tác', color: '#c4a35a' },
  { id: 'eras', icon: '⏳', vi: 'Kỷ Nguyên', han: '紀元', desc: '7 thời đại lịch sử', color: '#d4c98a' },
  { id: 'lore', icon: '📜', vi: 'Thế Giới', han: '世界', desc: 'Sáng thế, linh khí, tu luyện', color: '#c4a35a' },
  { id: 'factions', icon: '⚔', vi: 'Chủng Tộc', han: '種族', desc: '10 tộc và quan hệ chính trị', color: '#9b7fba' },
  { id: 'characters', icon: '👤', vi: 'Nhân Vật', han: '人物', desc: 'Nhân vật và hành trình', color: '#5a8cc4' },
  { id: 'locations', icon: '📍', vi: 'Địa Điểm', han: '地點', desc: 'Thành phố, thánh địa, bí cảnh', color: '#5ac48a' },
  { id: 'events', icon: '⚡', vi: 'Sự Kiện', han: '事件', desc: 'Đại chiến và truyền thuyết', color: '#c45a5a' },
  { id: 'arcs', icon: '📖', vi: 'Cốt Truyện', han: '故事', desc: 'Các tuyến truyện chính', color: '#5ab8c4' },
  { id: 'bestiary', icon: '🐉', vi: 'Linh Thú', han: '靈獸', desc: 'Sinh vật linh của đại lục', color: '#8a7060' },
  { id: 'literature', icon: '✍', vi: 'Văn Chương', han: '文章', desc: 'Thơ, nhạc, văn', color: '#c4a35a' },
];

export default function HomePage({ data, onNavigate }) {
  const stats = useMemo(() => {
    if (!data) return [];
    return [
      { num: data.eras?.length || 0, label: 'Kỷ Nguyên', han: '紀元', color: '#d4c98a' },
      { num: data.locations?.length || 0, label: 'Địa Điểm', han: '地點', color: '#5ac48a' },
      { num: data.characters?.length || 0, label: 'Nhân Vật', han: '人物', color: '#5a8cc4' },
      { num: data.factions?.length || 0, label: 'Chủng Tộc', han: '種族', color: '#9b7fba' },
      { num: data.events?.length || 0, label: 'Sự Kiện', han: '事件', color: '#c45a5a' },
      { num: data.storyArcs?.length || 0, label: 'Cốt Truyện', han: '故事', color: '#5ab8c4' },
      { num: data.fauna?.length || 0, label: 'Linh Thú', han: '靈獸', color: '#8a7060' },
      { num: data.rivers?.length || 0, label: 'Sông Ngòi', han: '河流', color: '#5a8cc4' },
    ];
  }, [data]);

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      fontFamily: "var(--font-body)",
      color: 'var(--text)',
      overflow: 'hidden',
    }}>
      {/* ── Hero Section ── */}
      <div style={{
        position: 'relative',
        textAlign: 'center',
        padding: '100px 40px 70px',
        background: 'linear-gradient(180deg, rgba(12,16,32,0.95) 0%, rgba(8,12,20,0.98) 60%, rgba(5,8,15,1) 100%)',
        borderBottom: '1px solid var(--border)',
      }}>
        <LinhKhiParticles />
        <OrnamentalCorner position="top-left" size={70} />
        <OrnamentalCorner position="top-right" size={70} />
        <OrnamentalCorner position="bottom-left" size={50} />
        <OrnamentalCorner position="bottom-right" size={50} />

        {/* Title */}
        <div style={{
          fontSize: 52,
          color: 'var(--gold)',
          fontWeight: 700,
          letterSpacing: 8,
          fontFamily: "var(--font-display)",
          position: 'relative',
          zIndex: 1,
          textShadow: '0 0 60px var(--gold-glow-strong), 0 2px 4px rgba(0,0,0,0.5)',
          animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) both',
        }}>Thiên Hoang Đại Lục</div>

        {/* Han subtitle */}
        <div style={{
          fontSize: 22,
          color: 'var(--gold-dim)',
          fontFamily: "var(--font-han)",
          letterSpacing: 12,
          marginTop: 10,
          position: 'relative',
          zIndex: 1,
          animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both',
        }}>固 元 界</div>

        <GoldDivider width={240} />

        {/* Description */}
        <div style={{
          fontSize: 17,
          color: 'var(--text-muted)',
          maxWidth: 580,
          margin: '16px auto 0',
          lineHeight: 1.9,
          position: 'relative',
          zIndex: 1,
          fontStyle: 'italic',
          fontWeight: 400,
          animation: 'fadeIn 1s ease 0.4s both',
        }}>
          {data?.creation?.description || 'Thế giới cổ đại nơi mười tộc cùng tồn tại.'}
        </div>
      </div>

      <div style={{
        padding: '40px 40px 80px',
        maxWidth: 1100,
        margin: '0 auto',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* ── Stats Section ── */}
        <div style={{
          textAlign: 'center',
          marginBottom: 8,
          animation: 'fadeInUp 0.6s ease 0.3s both',
        }}>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            color: 'var(--gold)',
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}>
            Tổng Quan
          </div>
          <div style={{
            fontFamily: "var(--font-han)",
            fontSize: 11,
            color: 'var(--gold-dim)',
            letterSpacing: 4,
            marginTop: 4,
          }}>總 覽</div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 12,
          marginTop: 16,
          marginBottom: 48,
        }}>
          {stats.map((st, i) => (
            <div key={st.label} style={{
              padding: '20px 12px 16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              animation: `fadeInUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${0.4 + i * 0.06}s both`,
              transition: 'border-color 0.3s, box-shadow 0.3s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = st.color + '40';
              e.currentTarget.style.boxShadow = `0 0 20px ${st.color}10`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              {/* Top accent line */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: '20%',
                right: '20%',
                height: 1,
                background: `linear-gradient(90deg, transparent, ${st.color}30, transparent)`,
              }} />
              <div style={{
                fontFamily: "var(--font-display)",
                fontSize: 30,
                color: st.color,
                fontWeight: 700,
                lineHeight: 1,
              }}>{st.num}</div>
              <div style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginTop: 6,
                fontWeight: 500,
              }}>{st.label}</div>
              <div style={{
                fontFamily: "var(--font-han)",
                fontSize: 9,
                color: 'var(--gold-dim)',
                marginTop: 2,
                letterSpacing: 2,
              }}>{st.han}</div>
            </div>
          ))}
        </div>

        {/* ── Shortcuts Section ── */}
        <div style={{
          textAlign: 'center',
          marginBottom: 8,
          animation: 'fadeInUp 0.6s ease 0.7s both',
        }}>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            color: 'var(--gold)',
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}>
            Khám Phá
          </div>
          <div style={{
            fontFamily: "var(--font-han)",
            fontSize: 11,
            color: 'var(--gold-dim)',
            letterSpacing: 4,
            marginTop: 4,
          }}>探 索</div>
        </div>

        <GoldDivider width={160} />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 14,
          marginTop: 20,
        }}>
          {SHORTCUTS.map((sc, i) => (
            <div
              key={sc.id}
              className={`card-interactive card-reveal stagger-${(i % 12) + 1}`}
              style={{
                padding: '22px 20px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${sc.color}60`,
                borderRadius: 6,
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                animation: `fadeInUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${0.8 + i * 0.05}s both`,
              }}
              onClick={() => onNavigate(sc.id)}
            >
              <div style={{ fontSize: 22, marginBottom: 10, filter: 'saturate(0.8)' }}>{sc.icon}</div>
              <div style={{
                fontFamily: "var(--font-display)",
                fontSize: 14,
                color: 'var(--text)',
                fontWeight: 600,
                letterSpacing: 1,
              }}>{sc.vi}</div>
              <div style={{
                fontSize: 10,
                color: 'var(--gold-dim)',
                fontFamily: "var(--font-han)",
                marginTop: 3,
                letterSpacing: 2,
              }}>{sc.han}</div>
              <div style={{
                fontSize: 12.5,
                color: 'var(--text-dim)',
                marginTop: 8,
                lineHeight: 1.5,
                fontWeight: 400,
              }}>{sc.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { OrnamentalCorner, CloudDivider };
