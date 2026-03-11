// src/map/LanguageToggle.jsx

const LANGS = [
  { value: 'vi-zh', label: 'Vi + Zh' },
  { value: 'vi', label: 'Tieng Viet' },
  { value: 'zh', label: '中文' },
];

export default function LanguageToggle({ language, onLanguageChange, theme }) {
  return (
    <div style={{
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 1000,
      display: 'flex',
      gap: 2,
      borderRadius: 6,
      overflow: 'hidden',
      border: `1px solid ${theme === 'dark' ? 'rgba(196,163,90,0.3)' : 'rgba(90,74,42,0.3)'}`,
    }}>
      {LANGS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => {
            onLanguageChange(value);
            localStorage.setItem('cng-language', value);
          }}
          style={{
            padding: '6px 10px',
            fontSize: '0.75rem',
            fontFamily: value === 'zh' ? 'var(--font-han)' : 'var(--font-body)',
            border: 'none',
            cursor: 'pointer',
            background: language === value
              ? (theme === 'dark' ? 'rgba(196,163,90,0.3)' : 'rgba(90,74,42,0.2)')
              : (theme === 'dark' ? 'rgba(5,8,15,0.8)' : 'rgba(245,240,232,0.8)'),
            color: language === value
              ? (theme === 'dark' ? '#c4a35a' : '#5a4a2a')
              : (theme === 'dark' ? '#888' : '#999'),
            backdropFilter: 'blur(8px)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
