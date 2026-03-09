import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/Ornaments';

const CATEGORIES = [
  { id: 'tho', vi: 'Thơ', han: '詩', desc: 'Thơ ca của Cố Nguyên Giới' },
  { id: 'nhac', vi: 'Nhạc', han: '樂', desc: 'Ca khúc và nhạc phẩm' },
  { id: 'van', vi: 'Văn', han: '文', desc: 'Văn xuôi và truyện ngắn' },
];

const s = {
  page: {
    padding: '32px 40px',
    maxWidth: 1100,
    margin: '0 auto',
    fontFamily: "var(--font-body)",
    color: 'var(--text)',
    minHeight: '100vh',
    position: 'relative',
  },
  tabs: {
    display: 'flex',
    gap: 8,
    marginBottom: 28,
  },
  tab: (active) => ({
    padding: '10px 20px',
    borderRadius: 8,
    border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
    background: active ? 'var(--gold-glow)' : 'var(--bg-input)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'center',
  }),
  tabVi: (active) => ({
    fontSize: 15,
    color: active ? 'var(--gold)' : 'var(--text-dim)',
    fontWeight: active ? 700 : 400,
  }),
  tabHan: {
    fontSize: 11,
    color: 'var(--gold-dim)',
    fontFamily: "var(--font-han)",
    marginTop: 2,
  },
  itemList: {
    display: 'grid',
    gap: 14,
  },
  item: (active) => ({
    padding: '18px 24px',
    background: active ? 'var(--bg-card-active)' : 'var(--bg-card)',
    border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
    borderRadius: 8,
    cursor: 'pointer',
    backdropFilter: 'blur(12px)',
    transition: 'border-color 0.2s',
  }),
  itemTitle: {
    fontSize: 16,
    color: 'var(--gold)',
    fontWeight: 600,
  },
  itemDesc: {
    fontSize: 12,
    color: 'var(--text-dim)',
    marginTop: 4,
  },
  content: {
    marginTop: 14,
    padding: '16px 20px',
    background: 'var(--gold-glow)',
    borderRadius: 6,
    border: '1px solid var(--border-light)',
    whiteSpace: 'pre-wrap',
    fontSize: 14,
    lineHeight: 1.8,
    color: 'var(--text-body)',
    fontFamily: "var(--font-body)",
  },
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    color: 'var(--gold-dim)',
    fontSize: 14,
  },
};

export default function LiteraturePage({ data }) {
  const [activeCategory, setActiveCategory] = useState('tho');
  const [index, setIndex] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [content, setContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    fetch('/data/literature-index.json')
      .then(r => r.json())
      .then(setIndex)
      .catch(() => setIndex({}));
  }, []);

  const items = index?.[activeCategory] || [];

  const loadContent = (item) => {
    if (activeItem === item.id) {
      setActiveItem(null);
      return;
    }
    setActiveItem(item.id);
    if (item.file) {
      setLoadingContent(true);
      fetch(item.file)
        .then(r => r.text())
        .then(text => { setContent(text); setLoadingContent(false); })
        .catch(() => { setContent('Không thể tải nội dung.'); setLoadingContent(false); });
    } else {
      setContent(item.content || 'Nội dung đang được bổ sung...');
    }
  };

  return (
    <div style={s.page}>
      <div className="page-watermark">文</div>
      <PageHeader title="Văn Chương" han="文章" subtitle="Thơ, nhạc, và văn của Cố Nguyên Giới" />

      <div style={s.tabs}>
        {CATEGORIES.map(cat => (
          <div
            key={cat.id}
            style={s.tab(activeCategory === cat.id)}
            onClick={() => { setActiveCategory(cat.id); setActiveItem(null); }}
          >
            <div style={s.tabVi(activeCategory === cat.id)}>{cat.vi}</div>
            <div style={s.tabHan}>{cat.han}</div>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <div style={s.empty}>
          Chưa có tác phẩm nào trong mục này.
          <div style={{ marginTop: 8, fontSize: 12 }}>
            Thêm file .md vào thư mục public/data/ và cập nhật literature-index.json
          </div>
        </div>
      ) : (
        <div style={s.itemList}>
          {items.map((item, i) => (
            <div key={item.id} className={`card-interactive card-reveal stagger-${(i % 12) + 1}`} style={s.item(activeItem === item.id)} onClick={() => loadContent(item)}>
              <div style={s.itemTitle}>{item.title}</div>
              {item.description && <div style={s.itemDesc}>{item.description}</div>}
              {activeItem === item.id && (
                <div style={s.content}>
                  {loadingContent ? 'Đang tải...' : content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
