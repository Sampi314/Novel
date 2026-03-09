import React, { useState, useMemo } from 'react';
import { getApiKey, setApiKey, callClaude, callClaudeText } from '../utils/claudeApi.js';
import { getNextLiteratureId, saveLiterature } from '../utils/literatureStorage.js';

const TYPES = [
  { id: 'tho', vi: 'Thơ', han: '詩' },
  { id: 'nhac', vi: 'Nhạc', han: '樂' },
  { id: 'van', vi: 'Văn', han: '文' },
];

const BASE_SECTIONS = [
  { key: 'original', vi: 'Nguyên Văn', han: '原', desc: 'Classical Chinese original' },
  { key: 'hanViet', vi: 'Hán Việt Âm', han: '漢', desc: 'Sino-Vietnamese reading' },
  { key: 'translation', vi: 'Trực Dịch', han: '直', desc: 'Literal Vietnamese translation' },
];

const STYLE_PROMPT_SECTION = { key: 'stylePrompt', vi: 'Style Prompt', han: '🎹', desc: 'Suno AI generation prompt' };
const ANALYSIS_SECTION = { key: 'analysis', vi: 'Phân Tích', han: '析', desc: 'Analysis & lore connections' };

function getSectionLabels(type) {
  if (type === 'nhac') return [...BASE_SECTIONS, STYLE_PROMPT_SECTION, ANALYSIS_SECTION];
  return [...BASE_SECTIONS, ANALYSIS_SECTION];
}

function buildLiteratureSystemPrompt(type) {
  const base = `You are a master writer for Cố Nguyên Giới (固元界), an original xianxia world.

CRITICAL: This world is completely ORIGINAL. Do NOT use cultivation systems, names, or tropes from other novels.

You MUST respond with ONLY valid JSON matching this structure (no markdown, no explanation):
{
  "original": "Classical Chinese text (文言文). For poetry: proper tonal and rhyme rules. For songs: structured with sections. For prose: narrative.",
  "hanViet": "Precise Hán Việt phonetic reading, character by character, preserving Chinese character order. Full Vietnamese diacritics.",
  "translation": "Stanza-by-stanza (or section-by-section) literal Vietnamese translation. Use bold (**) for stanza labels.",
  "analysis": "Poetic form & rhyme scheme, historical context, line-by-line analysis, allusions, metaphors, deeper meaning, lore connections with entity IDs."
}`;

  if (type === 'tho') {
    return base + `\n\nYou are "Thi Tiên" — the poet. Poetry types: 绝句 (quatrain), 律诗 (regulated verse), 词 (ci), 童谣 (nursery rhyme), 碑铭 (inscription), 谶语 (prophecy), 道歌 (cultivation verse), 战诗 (war poetry).
Era style: Thái Sơ=primal, Hỗn Độn=rough/powerful, Linh Nguyên=classical/glorious, Vạn Tộc=refined/diverse, Chiến Loạn=rebellious, Hiện Đại=complex/reflective.`;
  }
  if (type === 'nhac') {
    return base.replace(
      '"analysis": "',
      '"stylePrompt": "Suno AI prompt. Format: Style: [genre]. Instruments: [list]. Mood: [mood]. Tempo: [BPM]. Vocals: [description]. Tags: [comma-separated tags]",\n  "analysis": "'
    ) + `\n\nYou are "Nhạc Sư" — the musician. Write songs in MODERN SONG STRUCTURE:

REQUIRED STRUCTURE for "original" (Chinese lyrics):
- Use section markers: [Verse 1] [Chorus] [Verse 2] [Chorus] [Bridge] [Outro]
- This is flexible — you can add [Intro], [Pre-Chorus], [Verse 3], etc. as the song needs
- Priority: meaningful lyrics with good melodic flow. The song must have emotional weight.
- 5-7 characters per line works well for Chinese singing
- ALL Chinese lyrics go in "original", ALL Hán Việt in "hanViet", ALL translation in "translation"

For "stylePrompt": Write a complete Suno AI generation prompt. Be SPECIFIC:
- Style: Chinese ancient style / xianxia orchestral / guzheng ballad / etc.
- Instruments: guzheng, erhu, bamboo flute, pipa, drums, etc.
- Mood: melancholic, epic, ethereal, etc.
- Tempo: exact BPM
- Vocals: male/female, register, singing style
- Tags: comma-separated genre tags

Era sound: Thái Sơ=drums/chanting, Hỗn Độn=tribal/wild, Linh Nguyên=grand orchestra, Vạn Tộc=guzheng/flute/erhu, Chiến Loạn=ancient-meets-new, Hiện Đại=fusion.`;
  }
  return base + `\n\nYou are "Mặc Khách" — the prose writer. Write narrative prose in classical Chinese style. The "original" field should contain the Chinese text, "hanViet" the reading, "translation" the Vietnamese version, and "analysis" should cover narrative technique, character development, thematic connections, and lore links.`;
}

function buildLiteratureUserMessage(form, data) {
  const eraObj = data.eras?.find(e => e.name === form.era);
  const charNames = form.relatedCharacters.map(id => {
    const c = data.characters?.find(ch => ch.id === id);
    return c ? `${c.name} (${c.han || ''}) — ${c.role || ''}` : id;
  }).join(', ');
  const eventNames = form.relatedEvents.map(id => {
    const e = data.events?.find(ev => ev.id === id);
    return e ? `${e.name} (${e.han || ''})` : id;
  }).join(', ');
  const locationNames = form.relatedLocations.map(id => {
    const l = data.locations?.find(loc => loc.id === id);
    return l ? `${l.name} (${l.han || ''})` : id;
  }).join(', ');

  return `Create a ${form.type === 'tho' ? 'poem' : form.type === 'nhac' ? 'song' : 'prose piece'} for Cố Nguyên Giới:

Title: ${form.title}
Era: ${form.era}${eraObj?.description ? ` — ${eraObj.description}` : ''}
Related Characters: ${charNames || 'none'}
Related Events: ${eventNames || 'none'}
Related Locations: ${locationNames || 'none'}

Concept: ${form.concept}

World factions: ${data.factions?.map(f => `${f.name} (${f.han || ''})`).join(', ') || 'N/A'}

Respond with ONLY the JSON object. No markdown fences, no explanation.`;
}

const ms = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(5,8,15,0.85)',
    backdropFilter: 'blur(12px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    width: '95vw', maxWidth: 900, maxHeight: '90vh',
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, overflowY: 'auto', position: 'relative',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  },
  header: {
    padding: '24px 28px 16px', borderBottom: '1px solid var(--border)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    position: 'relative',
  },
  headerWatermark: {
    position: 'absolute', top: -10, right: 24,
    fontSize: 96, fontFamily: 'var(--font-han)',
    color: 'var(--gold)', opacity: 0.04, pointerEvents: 'none',
  },
  title: { fontSize: 22, color: 'var(--gold)', fontWeight: 700 },
  close: {
    width: 32, height: 32, borderRadius: '50%',
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: '20px 28px 28px' },
  label: { fontSize: 13, color: 'var(--gold-dim)', marginBottom: 6, display: 'block' },
  input: {
    width: '100%', padding: '10px 14px', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
  },
  select: {
    width: '100%', padding: '10px 14px', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
  },
  textarea: {
    width: '100%', minHeight: 80, padding: '10px 14px', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 14,
    lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
  },
  fieldGroup: { marginBottom: 18 },
  typeTabs: { display: 'flex', gap: 8, marginBottom: 20 },
  typeTab: (active) => ({
    flex: 1, padding: '12px 8px', textAlign: 'center',
    borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
    border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
    background: active ? 'var(--gold-glow)' : 'var(--bg-input)',
  }),
  typeTabVi: (active) => ({
    fontSize: 15, color: active ? 'var(--gold)' : 'var(--text-dim)',
    fontWeight: active ? 700 : 400,
  }),
  typeTabHan: { fontSize: 20, color: 'var(--gold-dim)', fontFamily: 'var(--font-han)', marginTop: 2 },
  multiSelect: {
    maxHeight: 120, overflowY: 'auto', padding: 8,
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 6, display: 'flex', flexWrap: 'wrap', gap: 6,
  },
  chip: (selected) => ({
    padding: '4px 10px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
    border: `1px solid ${selected ? 'var(--gold)' : 'var(--border)'}`,
    background: selected ? 'var(--gold-glow)' : 'transparent',
    color: selected ? 'var(--gold)' : 'var(--text-dim)',
    transition: 'all 0.1s',
  }),
  goldButton: {
    padding: '12px 28px',
    background: 'linear-gradient(135deg, var(--gold-dim), var(--gold))',
    color: 'var(--bg)', border: 'none', borderRadius: 6,
    fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600,
    cursor: 'pointer', letterSpacing: 1,
  },
  secondaryButton: {
    padding: '10px 20px', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text-dim)', fontFamily: 'var(--font-body)', fontSize: 14,
    cursor: 'pointer',
  },
  footer: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 28px', borderTop: '1px solid var(--border)',
  },
  error: {
    padding: '10px 16px', background: 'rgba(200,50,50,0.15)',
    border: '1px solid rgba(200,50,50,0.3)', borderRadius: 6,
    color: '#e88', fontSize: 13, marginBottom: 16,
  },
  sectionCard: {
    position: 'relative', marginBottom: 24, padding: '20px 24px',
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
  },
  sectionWatermark: {
    position: 'absolute', top: 8, right: 16, fontSize: 64,
    fontFamily: 'var(--font-han)', color: 'var(--gold)', opacity: 0.06,
    pointerEvents: 'none',
  },
  generating: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: 300, gap: 20,
  },
  genChar: {
    fontSize: 80, fontFamily: 'var(--font-han)', color: 'var(--gold)',
    animation: 'breathe 2s ease-in-out infinite',
  },
  genText: { color: 'var(--gold)', fontSize: 16, fontStyle: 'italic' },
};

export default function LiteratureCreatorModal({ isOpen, onClose, data, onLiteratureSaved }) {
  const [step, setStep] = useState('input');
  const [mode, setMode] = useState('single'); // 'single' | 'series' | 'queue'
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [showApiKeySettings, setShowApiKeySettings] = useState(!getApiKey());
  const [form, setForm] = useState({
    type: 'tho', title: '', era: '', relatedCharacters: [], relatedEvents: [], relatedLocations: [], concept: '',
  });
  const [sections, setSections] = useState({ original: '', hanViet: '', translation: '', stylePrompt: '', analysis: '' });
  const [error, setError] = useState(null);
  const [regeneratingSection, setRegeneratingSection] = useState(null);
  // Series mode
  const [seriesForm, setSeriesForm] = useState({ type: 'tho', era: '', theme: '', count: 3 });
  const [seriesResults, setSeriesResults] = useState([]);
  const [seriesProgress, setSeriesProgress] = useState({ current: 0, total: 0, saving: false });
  // Queue mode
  const [queue, setQueue] = useState([]);
  const [queueResults, setQueueResults] = useState([]);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0, saving: false });

  const eras = useMemo(() => data?.eras || [], [data]);
  const characters = useMemo(() => data?.characters || [], [data]);
  const events = useMemo(() => data?.events || [], [data]);
  const locations = useMemo(() => data?.locations || [], [data]);

  const toggleArrayItem = (field, id) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter(x => x !== id) : [...prev[field], id],
    }));
  };

  const handleGenerate = async () => {
    setStep('generating');
    setError(null);
    try {
      const systemPrompt = buildLiteratureSystemPrompt(form.type);
      const userMessage = buildLiteratureUserMessage(form, data);
      const result = await callClaude({ systemPrompt, userMessage, maxTokens: 8192 });
      setSections({
        original: result.original || '',
        hanViet: result.hanViet || '',
        translation: result.translation || '',
        stylePrompt: result.stylePrompt || '',
        analysis: result.analysis || '',
      });
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('input');
    }
  };

  const handleRegenerateSection = async (sectionKey) => {
    setRegeneratingSection(sectionKey);
    try {
      const sectionLabel = getSectionLabels(form.type).find(s => s.key === sectionKey);
      const systemPrompt = buildLiteratureSystemPrompt(form.type);
      const userMessage = `I have an existing ${form.type === 'tho' ? 'poem' : form.type === 'nhac' ? 'song' : 'prose piece'} for Cố Nguyên Giới.

Title: ${form.title}
Era: ${form.era}
Concept: ${form.concept}

Current content of all sections:
原文: ${sections.original}
漢越音: ${sections.hanViet}
直譯: ${sections.translation}
${form.type === 'nhac' ? `🎹 Style: ${sections.stylePrompt}\n` : ''}析義: ${sections.analysis}

Please REGENERATE ONLY the "${sectionLabel.vi}" (${sectionLabel.han}) section. Keep the same style and tone but create a new version. Return ONLY the new text for this section, no JSON, no markdown fences, no labels.`;

      const newText = await callClaudeText({ systemPrompt, userMessage, maxTokens: 4096 });
      setSections(prev => ({ ...prev, [sectionKey]: newText.trim() }));
    } catch (err) {
      setError(err.message);
    } finally {
      setRegeneratingSection(null);
    }
  };

  const handleSave = async () => {
    setStep('saving');
    setError(null);
    try {
      const indexRes = await fetch('/data/literature-index.json');
      const currentIndex = await indexRes.json();
      const newId = getNextLiteratureId(form.type, currentIndex);

      await saveLiterature({
        id: newId,
        type: form.type,
        title: form.title,
        description: form.concept.substring(0, 80),
        era: form.era,
        relatedCharacters: form.relatedCharacters,
        relatedEvents: form.relatedEvents,
        relatedLocations: form.relatedLocations,
        tags: [],
        sections,
      });

      setStep('done');
      if (onLiteratureSaved) onLiteratureSaved(newId);
    } catch (err) {
      setError(err.message);
      setStep('review');
    }
  };

  const handleSaveApiKey = () => {
    setApiKey(apiKeyInput);
    setShowApiKeySettings(false);
  };

  // --- Series Mode ---
  const handleSeriesGenerate = async () => {
    setStep('generating');
    setError(null);
    setSeriesResults([]);
    const total = seriesForm.count;
    setSeriesProgress({ current: 0, total, saving: false });
    const results = [];
    try {
      for (let i = 0; i < total; i++) {
        setSeriesProgress(p => ({ ...p, current: i + 1 }));
        const systemPrompt = buildLiteratureSystemPrompt(seriesForm.type);
        const userMessage = `Create ${seriesForm.type === 'tho' ? 'a poem' : seriesForm.type === 'nhac' ? 'a song' : 'a prose piece'} for Cố Nguyên Giới.

This is piece ${i + 1} of ${total} in a themed series.
Era: ${seriesForm.era}
Theme: ${seriesForm.theme}
Variation: Create something DIFFERENT from previous pieces — vary the mood, perspective, subject, or poetic form.
${i > 0 ? `Previous titles in this series: ${results.map(r => r.title).join(', ')}` : ''}

World factions: ${data.factions?.map(f => `${f.name} (${f.han || ''})`).join(', ') || 'N/A'}
Characters: ${data.characters?.slice(0, 10).map(c => `${c.name} (${c.han || ''})`).join(', ') || 'N/A'}

Also include a "title" field in your JSON for this piece's title.
Respond with ONLY the JSON object. No markdown fences.`;

        const result = await callClaude({ systemPrompt, userMessage, maxTokens: 8192 });
        results.push({ ...result, type: seriesForm.type, era: seriesForm.era });
      }
      setSeriesResults(results);
      setStep('series-review');
    } catch (err) {
      setError(err.message);
      setSeriesResults(results);
      if (results.length > 0) setStep('series-review');
      else setStep('input');
    }
  };

  const handleSeriesSaveAll = async () => {
    setSeriesProgress(p => ({ ...p, saving: true, current: 0 }));
    try {
      for (let i = 0; i < seriesResults.length; i++) {
        setSeriesProgress(p => ({ ...p, current: i + 1 }));
        const r = seriesResults[i];
        const indexRes = await fetch('/data/literature-index.json');
        const currentIndex = await indexRes.json();
        const newId = getNextLiteratureId(r.type, currentIndex);
        await saveLiterature({
          id: newId, type: r.type,
          title: r.title || `${seriesForm.theme} #${i + 1}`,
          description: seriesForm.theme,
          era: r.era,
          relatedCharacters: [], relatedEvents: [], relatedLocations: [],
          tags: ['series'],
          sections: { original: r.original || '', hanViet: r.hanViet || '', translation: r.translation || '', stylePrompt: r.stylePrompt || '', analysis: r.analysis || '' },
        });
      }
      setStep('done');
      if (onLiteratureSaved) onLiteratureSaved();
    } catch (err) {
      setError(err.message);
      setSeriesProgress(p => ({ ...p, saving: false }));
    }
  };

  // --- Queue Mode ---
  const addToQueue = () => {
    if (!form.title || !form.era || !form.concept) return;
    setQueue(prev => [...prev, { ...form, _key: Date.now() }]);
    setForm(f => ({ ...f, title: '', concept: '' }));
  };

  const removeFromQueue = (key) => {
    setQueue(prev => prev.filter(q => q._key !== key));
  };

  const handleQueueGenerate = async () => {
    setStep('generating');
    setError(null);
    setQueueResults([]);
    const total = queue.length;
    setQueueProgress({ current: 0, total, saving: false });
    const results = [];
    try {
      for (let i = 0; i < total; i++) {
        setQueueProgress(p => ({ ...p, current: i + 1 }));
        const item = queue[i];
        const systemPrompt = buildLiteratureSystemPrompt(item.type);
        const userMessage = buildLiteratureUserMessage(item, data);
        const result = await callClaude({ systemPrompt, userMessage, maxTokens: 8192 });
        results.push({ ...result, ...item, _sections: { original: result.original || '', hanViet: result.hanViet || '', translation: result.translation || '', stylePrompt: result.stylePrompt || '', analysis: result.analysis || '' } });
      }
      setQueueResults(results);
      setStep('queue-review');
    } catch (err) {
      setError(err.message);
      setQueueResults(results);
      if (results.length > 0) setStep('queue-review');
      else setStep('input');
    }
  };

  const handleQueueSaveAll = async () => {
    setQueueProgress(p => ({ ...p, saving: true, current: 0 }));
    try {
      for (let i = 0; i < queueResults.length; i++) {
        setQueueProgress(p => ({ ...p, current: i + 1 }));
        const r = queueResults[i];
        const indexRes = await fetch('/data/literature-index.json');
        const currentIndex = await indexRes.json();
        const newId = getNextLiteratureId(r.type, currentIndex);
        await saveLiterature({
          id: newId, type: r.type,
          title: r.title,
          description: r.concept?.substring(0, 80) || '',
          era: r.era,
          relatedCharacters: r.relatedCharacters || [],
          relatedEvents: r.relatedEvents || [],
          relatedLocations: r.relatedLocations || [],
          tags: [],
          sections: r._sections,
        });
      }
      setStep('done');
      if (onLiteratureSaved) onLiteratureSaved();
    } catch (err) {
      setError(err.message);
      setQueueProgress(p => ({ ...p, saving: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <div style={ms.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.3; transform: scale(0.95); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
      <div style={ms.modal}>
        {/* Header */}
        <div style={ms.header}>
          <div style={ms.headerWatermark}>文</div>
          <div style={ms.title}>Tạo Tác Phẩm</div>
          <button style={ms.close} onClick={onClose}>&times;</button>
        </div>

        <div style={ms.body}>
          {error && <div style={ms.error}>{error}</div>}

          {/* API Key Settings */}
          {showApiKeySettings && (
            <div style={{ ...ms.fieldGroup, padding: 16, background: 'var(--gold-glow)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={ms.label}>Anthropic API Key</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder="sk-ant-..."
                  style={{ ...ms.input, flex: 1 }}
                />
                <button onClick={handleSaveApiKey} style={{ ...ms.secondaryButton, color: 'var(--gold)' }}>Lưu</button>
              </div>
            </div>
          )}

          {step === 'input' && (
            <>
              {!showApiKeySettings && getApiKey() && (
                <div style={{ textAlign: 'right', marginBottom: 12 }}>
                  <button onClick={() => setShowApiKeySettings(true)} style={{ ...ms.secondaryButton, fontSize: 11, padding: '4px 10px' }}>
                    API Key ✓
                  </button>
                </div>
              )}

              {/* Type tabs */}
              <div style={ms.typeTabs}>
                {TYPES.map(t => (
                  <div key={t.id} style={ms.typeTab(form.type === t.id)} onClick={() => setForm(f => ({ ...f, type: t.id }))}>
                    <div style={ms.typeTabVi(form.type === t.id)}>{t.vi}</div>
                    <div style={ms.typeTabHan}>{t.han}</div>
                  </div>
                ))}
              </div>

              {/* Title */}
              <div style={ms.fieldGroup}>
                <div style={ms.label}>Tiêu đề</div>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Tên tác phẩm..." style={ms.input} />
              </div>

              {/* Era */}
              <div style={ms.fieldGroup}>
                <div style={ms.label}>Kỷ Nguyên</div>
                <select value={form.era} onChange={e => setForm(f => ({ ...f, era: e.target.value }))} style={ms.select}>
                  <option value="">— Chọn kỷ nguyên —</option>
                  {eras.map(era => <option key={era.name} value={era.name}>{era.name}{era.han ? ` (${era.han})` : ''}</option>)}
                </select>
              </div>

              {/* Related Characters */}
              <div style={ms.fieldGroup}>
                <div style={ms.label}>Nhân vật liên quan</div>
                <div style={ms.multiSelect}>
                  {characters.map(c => (
                    <span key={c.id} style={ms.chip(form.relatedCharacters.includes(c.id))} onClick={() => toggleArrayItem('relatedCharacters', c.id)}>
                      {c.name}
                    </span>
                  ))}
                  {characters.length === 0 && <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Không có dữ liệu</span>}
                </div>
              </div>

              {/* Related Events */}
              <div style={ms.fieldGroup}>
                <div style={ms.label}>Sự kiện liên quan</div>
                <div style={ms.multiSelect}>
                  {events.map(ev => (
                    <span key={ev.id} style={ms.chip(form.relatedEvents.includes(ev.id))} onClick={() => toggleArrayItem('relatedEvents', ev.id)}>
                      {ev.name}
                    </span>
                  ))}
                  {events.length === 0 && <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Không có dữ liệu</span>}
                </div>
              </div>

              {/* Related Locations */}
              <div style={ms.fieldGroup}>
                <div style={ms.label}>Địa điểm liên quan</div>
                <div style={ms.multiSelect}>
                  {locations.map(loc => (
                    <span key={loc.id} style={ms.chip(form.relatedLocations.includes(loc.id))} onClick={() => toggleArrayItem('relatedLocations', loc.id)}>
                      {loc.name}
                    </span>
                  ))}
                  {locations.length === 0 && <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Không có dữ liệu</span>}
                </div>
              </div>

              {/* Concept */}
              <div style={ms.fieldGroup}>
                <div style={ms.label}>Ý tưởng / Khái niệm</div>
                <textarea value={form.concept} onChange={e => setForm(f => ({ ...f, concept: e.target.value }))} placeholder="Mô tả ngắn gọn ý tưởng (1-3 câu)..." style={ms.textarea} />
              </div>
            </>
          )}

          {step === 'generating' && (
            <div style={ms.generating}>
              <div style={ms.genChar}>文</div>
              <div style={ms.genText}>Đang sáng tác...</div>
              <button onClick={() => setStep('input')} style={ms.secondaryButton}>Hủy</button>
            </div>
          )}

          {step === 'review' && (
            <>
              <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-dim)' }}>
                Chỉnh sửa nội dung hoặc tạo lại từng phần trước khi lưu.
              </div>
              {getSectionLabels(form.type).map(sec => (
                <div key={sec.key} style={ms.sectionCard}>
                  <div style={ms.sectionWatermark}>{sec.han}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--gold)' }}>{sec.vi}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8 }}>{sec.han}</span>
                    </div>
                    <button
                      onClick={() => handleRegenerateSection(sec.key)}
                      disabled={regeneratingSection === sec.key}
                      style={{ padding: '4px 12px', fontSize: 12, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--gold-dim)', cursor: 'pointer', opacity: regeneratingSection === sec.key ? 0.5 : 1 }}
                    >
                      {regeneratingSection === sec.key ? 'Đang tạo lại...' : '↻ Tạo lại'}
                    </button>
                  </div>
                  <textarea
                    value={sections[sec.key]}
                    onChange={e => setSections(prev => ({ ...prev, [sec.key]: e.target.value }))}
                    style={{ ...ms.textarea, minHeight: 150, lineHeight: 1.8, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </>
          )}

          {step === 'saving' && (
            <div style={ms.generating}>
              <div style={{ fontSize: 40, animation: 'spin-slow 2s linear infinite', color: 'var(--gold)' }}>⟳</div>
              <div style={ms.genText}>Đang lưu...</div>
            </div>
          )}

          {step === 'done' && (
            <div style={{ ...ms.generating, gap: 12 }}>
              <div style={{ fontSize: 48, color: 'var(--gold)' }}>✓</div>
              <div style={{ fontSize: 18, color: 'var(--gold)', fontWeight: 600 }}>Đã tạo tác phẩm thành công!</div>
              <div style={{ fontSize: 16, color: 'var(--text)' }}>{form.title}</div>
              <button onClick={onClose} style={ms.goldButton}>Đóng</button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'input' && (
          <div style={ms.footer}>
            <button onClick={onClose} style={ms.secondaryButton}>Hủy</button>
            <button
              onClick={handleGenerate}
              disabled={!form.title || !form.era || !form.concept || !getApiKey()}
              style={{ ...ms.goldButton, opacity: (!form.title || !form.era || !form.concept || !getApiKey()) ? 0.4 : 1 }}
            >
              Tạo bằng AI
            </button>
          </div>
        )}

        {step === 'review' && (
          <div style={ms.footer}>
            <button onClick={() => setStep('input')} style={ms.secondaryButton}>← Quay lại</button>
            <button onClick={handleSave} style={ms.goldButton}>Lưu Tác Phẩm</button>
          </div>
        )}
      </div>
    </div>
  );
}
