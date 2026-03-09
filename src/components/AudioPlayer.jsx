import React, { useRef, useState, useEffect } from 'react';

export default function AudioPlayer({ src }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => setPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
    };
  }, [src]);

  const toggle = () => {
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  };

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 12 }}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button onClick={toggle} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--gold)', background: 'var(--gold-glow)', color: 'var(--gold)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {playing ? '⏸' : '▶'}
      </button>
      <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 36 }}>{fmt(progress)}</span>
      <div onClick={seek} style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, cursor: 'pointer', position: 'relative' }}>
        <div style={{ width: `${duration ? (progress / duration) * 100 : 0}%`, height: '100%', background: 'var(--gold)', borderRadius: 3, transition: 'width 0.1s' }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 36 }}>{fmt(duration)}</span>
    </div>
  );
}
