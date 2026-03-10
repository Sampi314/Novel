import React, { useState, useMemo } from 'react';
import { getApiKey, setApiKey, callClaude, callClaudeText } from '../utils/claudeApi.js';
import { getNextStoryArcId, saveStoryArc, deleteStoryArc } from '../utils/storyArcStorage.js';

function buildSystemPrompt(data) {
  const chars = data.characters?.slice(0, 15).map(c => `- ${c.id}: ${c.name} (${c.han}) — ${c.role}`).join('\n') || '';
  const events = data.events?.slice(0, 15).map(e => `- ${e.id}: ${e.name} (year ${e.year})`).join('\n') || '';
  return `You are a storyteller for Cố Nguyên Giới (固元界), an original xianxia world.
CRITICAL: This world is ORIGINAL. Do NOT reference stories from other novels.

Key characters:
${chars}

Key events:
${events}

You MUST respond with ONLY valid JSON:
{
  "name": "Vietnamese story arc name",
  "han": "Chinese characters (2-4 chars)",
  "description": "3-4 paragraph narrative description in Vietnamese — premise, key conflicts, thematic significance"
}`;
}

const ms = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(5,8,15,0.85)',
    backdropFilter: 'blur(12px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    width: '95vw', maxWidth: 800, maxHeight: '90vh',
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
    width: '100%', minHeight: 100, padding: '10px 14px', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 14,
    lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
  },
  fieldGroup: { marginBottom: 18 },
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
  manualButton: {
    padding: '12px 28px', background: 'var(--bg-input)',
    border: '1px solid var(--gold-dim)', borderRadius: 6,
    color: 'var(--gold)', fontFamily: 'var(--font-body)', fontSize: 15,
    fontWeight: 600, cursor: 'pointer', letterSpacing: 1,
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
  generating: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: 200, gap: 20,
  },
  genChar: {
    fontSize: 80, fontFamily: 'var(--font-han)', color: 'var(--gold)',
    animation: 'breathe 2s ease-in-out infinite',
  },
  genText: { color: 'var(--gold)', fontSize: 16, fontStyle: 'italic' },
  sectionCard: {
    position: 'relative', marginBottom: 20, padding: '16px 20px',
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
  },
  tag: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', margin: '3px 4px 3px 0',
    borderRadius: 10, fontSize: 12,
    background: 'var(--gold-glow)', border: '1px solid var(--border)',
    color: 'var(--text-body)',
  },
  tagRemove: {
    background: 'none', border: 'none', color: 'var(--text-dim)',
    cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1,
  },
};

export default function StoryArcEditorModal({ isOpen, onClose, data, editItem, onSaved }) {
  const isEdit = !!editItem;
  const [step, setStep] = useState('input');
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [showApiKeySettings, setShowApiKeySettings] = useState(!getApiKey());
  const [form, setForm] = useState({ concept: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [regeneratingField, setRegeneratingField] = useState(null);
  const [charSelect, setCharSelect] = useState('');
  const [eventSelect, setEventSelect] = useState('');

  const characters = useMemo(() => data.characters || [], [data]);
  const events = useMemo(() => data.events || [], [data]);

  React.useEffect(() => {
    if (editItem && isOpen) {
      setResult({
        name: editItem.name || '', han: editItem.han || '',
        description: editItem.description || '',
        events: editItem.events || [],
        characters: editItem.characters || [],
        era_start: editItem.era_start ?? '',
        era_end: editItem.era_end ?? '',
        color: editItem.color || '#c4a35a',
      });
      setStep('review');
      setConfirmDelete(false);
    } else if (!editItem && isOpen) {
      setStep('input');
      setResult(null);
      setConfirmDelete(false);
    }
  }, [editItem, isOpen]);

  const handleGenerate = async () => {
    setStep('generating');
    setError(null);
    try {
      const r = await callClaude({
        systemPrompt: buildSystemPrompt(data),
        userMessage: `Create a story arc for Cố Nguyên Giới:\nConcept: ${form.concept}\n\nRespond with ONLY JSON.`,
        maxTokens: 4096,
      });
      setResult({
        ...r,
        events: [], characters: [],
        era_start: '', era_end: '', color: '#c4a35a',
      });
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('input');
    }
  };

  const handleManualInput = () => {
    setResult({
      name: '', han: '', description: '',
      events: [], characters: [],
      era_start: '', era_end: '', color: '#c4a35a',
    });
    setStep('review');
  };

  const handleDelete = async () => {
    if (!editItem) return;
    setStep('saving');
    setError(null);
    try {
      await deleteStoryArc(editItem.id);
      setStep('done');
      if (onSaved) onSaved(null, true);
    } catch (err) {
      setError(err.message);
      setStep('review');
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setStep('saving');
    setError(null);
    try {
      const arcId = isEdit ? editItem.id : getNextStoryArcId(data.storyArcs || []);
      await saveStoryArc({
        id: arcId,
        name: result.name, han: result.han,
        description: result.description,
        events: result.events,
        characters: result.characters,
        era_start: result.era_start,
        era_end: result.era_end,
        color: result.color,
      });
      setStep('done');
      if (onSaved) onSaved(arcId);
    } catch (err) {
      setError(err.message);
      setStep('review');
    }
  };

  const handleSaveApiKey = () => { setApiKey(apiKeyInput); setShowApiKeySettings(false); };

  const addCharacter = () => {
    if (!charSelect || result.characters?.includes(charSelect)) return;
    setResult(r => ({ ...r, characters: [...(r.characters || []), charSelect] }));
    setCharSelect('');
  };
  const removeCharacter = (idx) => setResult(r => ({ ...r, characters: r.characters.filter((_, i) => i !== idx) }));

  const addEvent = () => {
    if (!eventSelect || result.events?.includes(eventSelect)) return;
    setResult(r => ({ ...r, events: [...(r.events || []), eventSelect] }));
    setEventSelect('');
  };
  const removeEvent = (idx) => setResult(r => ({ ...r, events: r.events.filter((_, i) => i !== idx) }));

  const charMap = useMemo(() => { const m = {}; characters.forEach(c => { m[c.id] = c; }); return m; }, [characters]);
  const eventMap = useMemo(() => { const m = {}; events.forEach(e => { m[e.id] = e; }); return m; }, [events]);

  const fieldLabels = {
    name: 'tên cốt truyện (Vietnamese)',
    han: 'tên Hán tự (2-4 Chinese characters)',
    description: 'mô tả tuyến truyện chi tiết (Vietnamese, 3-4 paragraphs — premise, conflicts, themes)',
  };

  const handleRegenerateField = async (fieldKey) => {
    if (!getApiKey() || !result) return;
    setRegeneratingField(fieldKey);
    try {
      const charNames = (result.characters || []).map(id => charMap[id]?.name || id).join(', ');
      const evNames = (result.events || []).map(id => eventMap[id]?.name || id).join(', ');
      const context = `Story Arc: ${result.name} (${result.han})\nCharacters: ${charNames || 'none'}\nEvents: ${evNames || 'none'}`;
      const prompt = `You are a storyteller for Cố Nguyên Giới (固元界), an original xianxia world. CRITICAL: This world is ORIGINAL.

${context}

Generate ONLY the ${fieldLabels[fieldKey] || fieldKey}. Respond with ONLY the value, no labels, no quotes, no explanation.`;

      const text = await callClaudeText({ systemPrompt: prompt, userMessage: `Generate ${fieldKey}`, maxTokens: 2048 });
      setResult(r => r ? { ...r, [fieldKey]: text.trim() } : r);
    } catch (err) {
      setError(err.message);
    }
    setRegeneratingField(null);
  };

  const RegenBtn = ({ field }) => {
    const isLoading = regeneratingField === field;
    const hasKey = !!getApiKey();
    return (
      <button
        onClick={(e) => { e.preventDefault(); if (!hasKey) { setShowApiKeySettings(true); return; } handleRegenerateField(field); }}
        disabled={isLoading || !!regeneratingField}
        style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 4,
          color: isLoading ? 'var(--gold)' : 'var(--text-dim)', cursor: isLoading ? 'wait' : 'pointer',
          fontSize: 11, padding: '2px 8px', marginLeft: 6, fontFamily: 'var(--font-body)',
          opacity: regeneratingField && !isLoading ? 0.3 : 1, transition: 'all 0.2s',
        }}
      >
        {isLoading ? '...' : 'AI'}
      </button>
    );
  };

  if (!isOpen) return null;

  const canGenerate = form.concept && getApiKey();
  const canSave = result?.name;

  return (
    <div style={ms.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`@keyframes breathe { 0%, 100% { opacity: 0.3; transform: scale(0.95); } 50% { opacity: 0.7; transform: scale(1.05); } }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <div style={ms.modal}>
        <div style={ms.header}>
          <div style={ms.headerWatermark}>故</div>
          <div style={ms.title}>{isEdit ? 'Chi Tiết Cốt Truyện' : 'Tạo Cốt Truyện'}</div>
          <button style={ms.close} onClick={onClose}>&times;</button>
        </div>

        <div style={ms.body}>
          {error && <div style={ms.error}>{error}</div>}

          {showApiKeySettings && (step === 'input' || step === 'review') && (
            <div style={{ ...ms.fieldGroup, padding: 16, background: 'var(--gold-glow)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={ms.label}>Anthropic API Key</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder="sk-ant-..." style={{ ...ms.input, flex: 1 }} />
                <button onClick={handleSaveApiKey} style={{ ...ms.secondaryButton, color: 'var(--gold)' }}>Lưu</button>
              </div>
            </div>
          )}

          {step === 'input' && (
            <div style={ms.fieldGroup}>
              <div style={ms.label}>Ý tưởng cốt truyện</div>
              <textarea value={form.concept} onChange={e => setForm(f => ({ ...f, concept: e.target.value }))} placeholder="VD: Cuộc chiến truyền kiếp giữa Long Tộc và Phượng Tộc, bắt đầu từ một hiểu lầm ngàn năm..." style={{ ...ms.textarea, minHeight: 120 }} />
            </div>
          )}

          {step === 'generating' && (
            <div style={ms.generating}>
              <div style={ms.genChar}>故</div>
              <div style={ms.genText}>Đang tạo cốt truyện...</div>
            </div>
          )}

          {step === 'review' && result && (
            <>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '2fr 1fr', marginBottom: 16 }}>
                <div>
                  <div style={ms.label}>Tên <RegenBtn field="name" /></div>
                  <input value={result.name} onChange={e => setResult(r => ({ ...r, name: e.target.value }))} style={ms.input} />
                </div>
                <div>
                  <div style={ms.label}>Hán tự <RegenBtn field="han" /></div>
                  <input value={result.han} onChange={e => setResult(r => ({ ...r, han: e.target.value }))} style={ms.input} />
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 16 }}>
                <div>
                  <div style={ms.label}>Năm bắt đầu</div>
                  <input type="number" value={result.era_start} onChange={e => setResult(r => ({ ...r, era_start: e.target.value }))} style={ms.input} />
                </div>
                <div>
                  <div style={ms.label}>Năm kết thúc</div>
                  <input type="number" value={result.era_end ?? ''} onChange={e => setResult(r => ({ ...r, era_end: e.target.value }))} style={ms.input} />
                </div>
                <div>
                  <div style={ms.label}>Màu</div>
                  <input type="color" value={result.color || '#c4a35a'} onChange={e => setResult(r => ({ ...r, color: e.target.value }))} style={{ ...ms.input, padding: 4, height: 42 }} />
                </div>
              </div>

              {/* Characters multi-select */}
              <div style={ms.fieldGroup}>
                <div style={ms.label}>Nhân vật chính</div>
                <div style={{ marginBottom: 6 }}>
                  {(result.characters || []).map((cid, i) => (
                    <span key={i} style={ms.tag}>
                      {charMap[cid]?.name || cid}
                      <button style={ms.tagRemove} onClick={() => removeCharacter(i)}>&times;</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={charSelect} onChange={e => setCharSelect(e.target.value)} style={{ ...ms.select, flex: 1 }}>
                    <option value="">— Thêm nhân vật —</option>
                    {characters.filter(c => !(result.characters || []).includes(c.id)).map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.han})</option>
                    ))}
                  </select>
                  <button onClick={addCharacter} style={{ ...ms.secondaryButton, color: 'var(--gold)', padding: '8px 16px' }}>+</button>
                </div>
              </div>

              {/* Events multi-select */}
              <div style={ms.fieldGroup}>
                <div style={ms.label}>Sự kiện liên quan</div>
                <div style={{ marginBottom: 6 }}>
                  {(result.events || []).map((eid, i) => (
                    <span key={i} style={ms.tag}>
                      {eventMap[eid]?.name || eid}
                      <button style={ms.tagRemove} onClick={() => removeEvent(i)}>&times;</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={eventSelect} onChange={e => setEventSelect(e.target.value)} style={{ ...ms.select, flex: 1 }}>
                    <option value="">— Thêm sự kiện —</option>
                    {events.filter(e => !(result.events || []).includes(e.id)).map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.year})</option>
                    ))}
                  </select>
                  <button onClick={addEvent} style={{ ...ms.secondaryButton, color: 'var(--gold)', padding: '8px 16px' }}>+</button>
                </div>
              </div>

              <div style={ms.sectionCard}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gold)', marginBottom: 8, display: 'flex', alignItems: 'center' }}>
                  Mô tả <span style={{ fontSize: 11, color: 'var(--gold-dim)', fontFamily: 'var(--font-han)', marginLeft: 4 }}>述</span>
                  <RegenBtn field="description" />
                </div>
                <textarea value={result.description || ''} onChange={e => setResult(r => ({ ...r, description: e.target.value }))} placeholder="Mô tả cốt truyện: tiền đề, xung đột, chủ đề, ý nghĩa..." style={{ ...ms.textarea, minHeight: 140 }} />
              </div>
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
              <div style={{ fontSize: 18, color: 'var(--gold)', fontWeight: 600 }}>
                {confirmDelete ? 'Đã xóa cốt truyện!' : isEdit ? 'Đã cập nhật!' : 'Đã tạo cốt truyện!'}
              </div>
              <button onClick={onClose} style={ms.goldButton}>Đóng</button>
            </div>
          )}
        </div>

        {step === 'input' && (
          <div style={ms.footer}>
            <button onClick={onClose} style={ms.secondaryButton}>Hủy</button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleManualInput} style={ms.manualButton}>Tự nhập</button>
              <button onClick={handleGenerate} disabled={!canGenerate} style={{ ...ms.goldButton, opacity: canGenerate ? 1 : 0.4 }}>Tạo bằng AI</button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div style={ms.footer}>
            <div style={{ display: 'flex', gap: 8 }}>
              {!isEdit && <button onClick={() => setStep('input')} style={ms.secondaryButton}>← Quay lại</button>}
              {isEdit && !confirmDelete && (
                <button onClick={() => setConfirmDelete(true)} style={{ ...ms.secondaryButton, color: '#e88', borderColor: 'rgba(200,50,50,0.3)' }}>Xóa</button>
              )}
              {isEdit && confirmDelete && (
                <>
                  <button onClick={handleDelete} style={{ ...ms.secondaryButton, color: '#fff', background: 'rgba(200,50,50,0.8)', borderColor: 'rgba(200,50,50,0.5)' }}>Xác nhận xóa</button>
                  <button onClick={() => setConfirmDelete(false)} style={ms.secondaryButton}>Hủy</button>
                </>
              )}
            </div>
            <button onClick={handleSave} disabled={!canSave} style={{ ...ms.goldButton, opacity: canSave ? 1 : 0.4 }}>
              {isEdit ? 'Cập Nhật' : 'Lưu Cốt Truyện'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
