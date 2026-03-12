import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../components/Ornaments';
import LiteratureCreatorModal from '../components/LiteratureCreatorModal';
import AudioPlayer from '../components/AudioPlayer';
import { uploadAudio } from '../utils/devFileWriter.js';
import { writeFile } from '../utils/devFileWriter.js';

const CATEGORIES = [
  { id: 'tho', vi: 'Thơ', han: '詩', desc: 'Thơ ca của Thiên Hoang Đại Lục' },
  { id: 'nhac', vi: 'Nhạc', han: '樂', desc: 'Ca khúc và nhạc phẩm' },
  { id: 'van', vi: 'Văn', han: '文', desc: 'Văn xuôi và truyện ngắn' },
];

function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/```([\s\S]*?)```/g, '<pre style="background:var(--bg-input);padding:16px;border-radius:6px;overflow-x:auto;font-family:var(--font-han);font-size:14px;line-height:1.8;color:var(--text)">$1</pre>')
    .replace(/^### (.+)$/gm, '<h4 style="color:var(--gold);margin:16px 0 8px;font-size:14px">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="color:var(--gold);margin:20px 0 10px;font-size:16px;border-bottom:1px solid var(--border);padding-bottom:6px">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="color:var(--gold);font-size:20px;margin-bottom:12px">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--gold)">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:16px 0" />')
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px;margin-bottom:4px">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin:8px 0">')
    .replace(/\n/g, '<br/>');
  return '<p style="margin:8px 0">' + html + '</p>';
}

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
  eraHeader: {
    fontSize: 14,
    color: 'var(--gold)',
    fontWeight: 600,
    marginBottom: 10,
    borderBottom: '1px solid var(--border)',
    paddingBottom: 6,
  },
  chip: {
    fontSize: 10,
    padding: '2px 6px',
    background: 'var(--gold-glow)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--gold-dim)',
  },
  tagChip: {
    fontSize: 10,
    padding: '2px 6px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-dim)',
  },
  chipLink: {
    fontSize: 10,
    padding: '2px 6px',
    background: 'var(--gold-glow)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--gold-dim)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  searchRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    padding: '8px 14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    outline: 'none',
  },
  filterSelect: {
    padding: '8px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    outline: 'none',
    minWidth: 140,
  },
};

const base = import.meta.env.BASE_URL;

export default function LiteraturePage({ data, onNavigate }) {
  const [activeCategory, setActiveCategory] = useState('tho');
  const [index, setIndex] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [content, setContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEra, setFilterEra] = useState('');

  useEffect(() => {
    fetch(base + 'data/literature-index.json')
      .then(r => r.json())
      .then(setIndex)
      .catch(() => setIndex({}));
  }, []);

  const items = index?.[activeCategory] || [];

  const allEras = useMemo(() => {
    const set = new Set();
    items.forEach(item => set.add(item.era || 'Khác'));
    return [...set];
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (filterEra) result = result.filter(item => (item.era || 'Khác') === filterEra);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.tags?.some(t => t.toLowerCase().includes(q)) ||
        item.relatedCharacters?.some(id => {
          const c = data?.characters?.find(ch => ch.id === id);
          return c?.name?.toLowerCase().includes(q);
        }) ||
        item.relatedEvents?.some(id => {
          const ev = data?.events?.find(e => e.id === id);
          return ev?.name?.toLowerCase().includes(q);
        })
      );
    }
    return result;
  }, [items, filterEra, searchQuery, data]);

  const groupedByEra = useMemo(() => {
    const groups = {};
    filteredItems.forEach(item => {
      const era = item.era || 'Khác';
      if (!groups[era]) groups[era] = [];
      groups[era].push(item);
    });
    return groups;
  }, [filteredItems]);

  const loadContent = (item) => {
    if (activeItem === item.id) {
      setActiveItem(null);
      return;
    }
    setActiveItem(item.id);
    if (item.file) {
      setLoadingContent(true);
      fetch(base + item.file.replace(/^\//, ''))
        .then(r => r.text())
        .then(text => {
          const stripped = text.replace(/^---[\s\S]*?---\s*/, '');
          setContent(stripped);
          setLoadingContent(false);
        })
        .catch(() => { setContent('Không thể tải nội dung.'); setLoadingContent(false); });
    } else {
      setContent(item.content || 'Nội dung đang được bổ sung...');
    }
  };

  const handleAudioUpload = async (item, file) => {
    try {
      const ext = file.name.split('.').pop();
      const audioPath = item.file.replace('.md', '.' + ext);
      await uploadAudio('public' + audioPath, file);
      const idxRes = await fetch(base + 'data/literature-index.json');
      const idx = await idxRes.json();
      const entry = idx.nhac?.find(n => n.id === item.id);
      if (entry) {
        entry.audioFile = audioPath;
        await writeFile('public/data/literature-index.json', JSON.stringify(idx, null, 2) + '\n');
        fetch(base + 'data/literature-index.json').then(r => r.json()).then(setIndex);
      }
    } catch (err) {
      console.error('Audio upload failed:', err);
    }
  };

  const renderItemCard = (item, i) => (
    <div key={item.id} className={`card-interactive card-reveal stagger-${(i % 12) + 1}`} style={s.item(activeItem === item.id)} onClick={() => loadContent(item)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={s.itemTitle}>{item.title}</div>
        <button
          onClick={(e) => { e.stopPropagation(); setEditItem({ ...item, _type: activeCategory }); setShowCreator(true); }}
          style={{
            padding: '4px 12px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--gold-dim)', fontFamily: 'var(--font-body)',
          }}
        >
          Sửa
        </button>
      </div>
      {item.description && <div style={s.itemDesc}>{item.description}</div>}

      {/* Metadata chips — clickable cross-references */}
      {(item.relatedCharacters?.length > 0 || item.relatedEvents?.length > 0 || item.relatedLocations?.length > 0 || item.tags?.length > 0) && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
          {item.relatedCharacters?.map(id => {
            const c = data?.characters?.find(ch => ch.id === id);
            return <span key={`c-${id}`} style={s.chipLink} onClick={e => { e.stopPropagation(); onNavigate?.('characters'); }}>{c?.name || id}</span>;
          })}
          {item.relatedEvents?.map(id => {
            const ev = data?.events?.find(e => e.id === id);
            return <span key={`e-${id}`} style={s.chipLink} onClick={e => { e.stopPropagation(); onNavigate?.('events'); }}>{ev?.name || id}</span>;
          })}
          {item.relatedLocations?.map(id => {
            const loc = data?.locations?.find(l => l.id === id);
            return <span key={`l-${id}`} style={s.chipLink} onClick={e => { e.stopPropagation(); onNavigate?.('locations'); }}>{loc?.name || id}</span>;
          })}
          {item.tags?.map(tag => (
            <span key={tag} style={s.tagChip}>{tag}</span>
          ))}
        </div>
      )}

      {/* Expanded content */}
      {activeItem === item.id && (
        <div style={s.content} onClick={e => e.stopPropagation()}>
          {loadingContent ? 'Đang tải...' : (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          )}

          {/* Audio player for songs */}
          {activeCategory === 'nhac' && item.audioFile && (
            <AudioPlayer src={base + (item.audioFile || '').replace(/^\//, '')} />
          )}

          {/* Audio upload for songs without audio */}
          {activeCategory === 'nhac' && !item.audioFile && (
            <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--bg-input)', border: '1px dashed var(--border)', borderRadius: 8, textAlign: 'center' }}>
              <label style={{ cursor: 'pointer', color: 'var(--gold-dim)', fontSize: 13 }}>
                🎵 Tải lên bản nhạc (.mp3, .wav, .m4a)
                <input
                  type="file"
                  accept=".mp3,.wav,.m4a"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files[0];
                    if (file) handleAudioUpload(item, file);
                  }}
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={s.page}>
      <div className="page-watermark">文</div>
      <PageHeader title="Văn Chương" han="文章" subtitle="Thơ, nhạc, và văn của Thiên Hoang Đại Lục" />

      {/* Create button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          onClick={() => { setEditItem(null); setShowCreator(true); }}
          style={{
            padding: '10px 24px',
            background: 'linear-gradient(135deg, var(--gold-dim), var(--gold))',
            color: 'var(--bg)',
            border: 'none',
            borderRadius: 6,
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: 1,
            transition: 'box-shadow 0.3s',
          }}
          onMouseEnter={e => e.target.style.boxShadow = 'var(--shadow-gold-strong)'}
          onMouseLeave={e => e.target.style.boxShadow = 'none'}
        >
          + Tạo Tác Phẩm
        </button>
      </div>

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

      {/* Search & Filter */}
      {items.length > 0 && (
        <div style={s.searchRow}>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm tác phẩm..."
            style={s.searchInput}
          />
          <select value={filterEra} onChange={e => setFilterEra(e.target.value)} style={s.filterSelect}>
            <option value="">Tất cả kỷ nguyên</option>
            {allEras.map(era => <option key={era} value={era}>{era}</option>)}
          </select>
          {(searchQuery || filterEra) && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {filteredItems.length}/{items.length}
            </span>
          )}
        </div>
      )}

      {Object.keys(groupedByEra).length === 0 ? (
        <div style={s.empty}>
          Chưa có tác phẩm nào trong mục này.
          <div style={{ marginTop: 8, fontSize: 12 }}>
            Nhấn "Tạo Tác Phẩm" để bắt đầu sáng tác với AI
          </div>
        </div>
      ) : (
        Object.entries(groupedByEra).map(([era, eraItems]) => (
          <div key={era} style={{ marginBottom: 28 }}>
            <div style={s.eraHeader}>{era}</div>
            <div style={s.itemList}>
              {eraItems.map((item, i) => renderItemCard(item, i))}
            </div>
          </div>
        ))
      )}

      <LiteratureCreatorModal
        isOpen={showCreator}
        onClose={() => { setShowCreator(false); setEditItem(null); }}
        data={data}
        editItem={editItem}
        onLiteratureSaved={() => {
          setShowCreator(false);
          setEditItem(null);
          fetch(base + 'data/literature-index.json')
            .then(r => r.json())
            .then(setIndex)
            .catch(() => {});
        }}
      />
    </div>
  );
}
