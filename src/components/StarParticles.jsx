import React, { useRef, useEffect } from 'react';

export default function StarParticles({ theme }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const isDark = theme === 'dark';
    const starCount = Math.floor((w * h) / 8000);

    // Generate stars
    const stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.2 + 0.3,
      alpha: Math.random() * 0.5 + 0.1,
      speed: Math.random() * 0.0003 + 0.0001,
      phase: Math.random() * Math.PI * 2,
    }));

    // Shooting stars
    const shootingStars = [];
    let lastShoot = 0;

    // Ley line energy particles (slow drifting)
    const particles = Array.from({ length: 12 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      r: Math.random() * 30 + 15,
      hue: Math.random() > 0.5 ? 42 : 210, // gold or blue
      alpha: Math.random() * 0.03 + 0.01,
    }));

    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);

      if (!isDark) {
        // Light theme: subtle golden dust
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -50) p.x = w + 50;
          if (p.x > w + 50) p.x = -50;
          if (p.y < -50) p.y = h + 50;
          if (p.y > h + 50) p.y = -50;

          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          grad.addColorStop(0, `hsla(${p.hue}, 60%, 40%, ${p.alpha * 0.5})`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        });
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      // Draw stars
      stars.forEach(s => {
        const twinkle = Math.sin(t * s.speed + s.phase);
        const a = s.alpha * (0.6 + 0.4 * twinkle);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(196, 173, 120, ${a})`;
        ctx.fill();
      });

      // Draw ley line particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -50) p.x = w + 50;
        if (p.x > w + 50) p.x = -50;
        if (p.y < -50) p.y = h + 50;
        if (p.y > h + 50) p.y = -50;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        grad.addColorStop(0, `hsla(${p.hue}, 60%, 60%, ${p.alpha})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      });

      // Shooting stars (rare)
      if (t - lastShoot > 8000 + Math.random() * 15000) {
        lastShoot = t;
        shootingStars.push({
          x: Math.random() * w * 0.8,
          y: Math.random() * h * 0.3,
          vx: 3 + Math.random() * 4,
          vy: 1 + Math.random() * 2,
          life: 1,
          decay: 0.015 + Math.random() * 0.01,
          len: 40 + Math.random() * 30,
        });
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.life -= ss.decay;
        if (ss.life <= 0) { shootingStars.splice(i, 1); continue; }

        const grad = ctx.createLinearGradient(
          ss.x, ss.y,
          ss.x - ss.vx * ss.len / ss.vx, ss.y - ss.vy * ss.len / ss.vy
        );
        grad.addColorStop(0, `rgba(232, 201, 106, ${ss.life * 0.8})`);
        grad.addColorStop(1, 'transparent');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(ss.x - ss.vx * (ss.len / 4), ss.y - ss.vy * (ss.len / 4));
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    const onResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
