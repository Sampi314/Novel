import React, { useState, useMemo } from 'react';
import { getApiKey, setApiKey, callClaude, callClaudeText } from '../utils/claudeApi.js';
import { getNextEventId, saveEvent, deleteEvent } from '../utils/eventStorage.js';

const EVENT_TYPES = ['battle', 'founded', 'destroyed', 'lore', 'custom'];
const TYPE_LABELS = { battle: 'Chiến trận', founded: 'Thành lập', destroyed: 'Hủy diệt', lore: 'Truyền thuyết', custom: 'Tùy chọn' };

function buildSystemPrompt(data) {
  const factions = data.factions?.map(f => `- ${f.id}: ${f.name} (${f.han})`).join('\n') || '';
  const locations = data.locations?.slice(0, 15).map(l => `- ${l.id}: ${l.name}`).join('\n') || '';
  return `You are a historian for Thiên Hoang Đại Lục (天荒大陸), an original xianxia world.
CRITICAL: This world is ORIGINAL. Do NOT reference events from other novels.

Known factions:
${factions}

Key locations:
${locations}

Event types: battle, founded, destroyed, lore, custom

You MUST respond with ONLY valid JSON:
{
  "name": "Vietnamese event name",
  "han": "Chinese characters (2-4 chars)",
  "description": "2-3 paragraph description in Vietnamese — causes, key participants, outcome, aftermath"
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

export default function EventEditorModal({ isOpen, onClose, data, editItem, onSaved }) {
  const isEdit = !!editItem;
  const [step, setStep] = useState('input');
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [showApiKeySettings, setShowApiKeySettings] = useState(!getApiKey());
  const [form, setForm] = useState({ type: '', concept: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [regeneratingField, setRegeneratingField] = useState(null);
  const [factionSelect, setFactionSelect] = useState('');

  const locations = useMemo(() => data.locations || [], [data]);
  const factions = useMemo(() => data.factions || [], [data]);

  React.useEffect(() => {
    if (editItem && isOpen) {
      setResult({
        name: editItem.name || '', han: editItem.han || '',
        year: editItem.year ?? '', type: editItem.type || '',
        location_id: editItem.location_id || '',
        x: editItem.x ?? '', y: editItem.y ?? '',
        factions: editItem.factions ? (typeof editItem.factions === 'string' ? editItem.factions.split('|') : editItem.factions) : [],
        description: editItem.description || '',
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
        userMessage: `Create a historical event for Thiên Hoang Đại Lục:\nType: ${TYPE_LABELS[form.type] || form.type}\nConcept: ${form.concept}\n\nExisting events for context:\n${data.events?.slice(0, 10).map(e => `- ${e.name} (year ${e.year})`).join('\n') || 'none'}\n\nRespond with ONLY JSON.`,
        maxTokens: 4096,
      });
      setResult({
        ...r,
        year: '', type: form.type,
        location_id: '', x: '', y: '',
        factions: [],
      });
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('input');
    }
  };

  const handleManualInput = () => {
    setResult({
      name: '', han: '', year: '', type: form.type || '',
      location_id: '', x: '', y: '', factions: [], description: '',
    });
    setStep('review');
  };

  const handleDelete = async () => {
    if (!editItem) return;
    setStep('saving');
    setError(null);
    try {
      await deleteEvent(editItem.id);
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
      const evId = isEdit ? editItem.id : getNextEventId(data.events || []);
      await saveEvent({
        id: evId,
        year: result.year, type: result.type,
        name: result.name, han: result.han,
        location_id: result.location_id,
        x: result.x, y: result.y,
        factions: result.factions,
        description: result.description,
      });
      setStep('done');
      if (onSaved) onSaved(evId);
    } catch (err) {
      setError(err.message);
      setStep('review');
    }
  };

  const handleSaveApiKey = () => { setApiKey(apiKeyInput); setShowApiKeySettings(false); };

  const addFaction = () => {
    if (!factionSelect || result.factions?.includes(factionSelect)) return;
    setResult(r => ({ ...r, factions: [...(r.factions || []), factionSelect] }));
    setFactionSelect('');
  };

  const removeFaction = (idx) => {
    setResult(r => ({ ...r, factions: r.factions.filter((_, i) => i !== idx) }));
  };

  const handleLocationChange = (locId) => {
    const loc = locations.find(l => l.id === locId);
    setResult(r => ({
      ...r,
      location_id: locId,
      x: loc?.x ?? r.x,
      y: loc?.y ?? r.y,
    }));
  };

  const fieldLabels = {
    name: 'tên sự kiện (Vietnamese)',
    han: 'tên Hán tự (2-4 Chinese characters)',
    description: 'mô tả chi tiết (Vietnamese, 2-3 paragraphs — causes, participants, outcome)',
  };

  const handleRegenerateField = async (fieldKey) => {
    if (!getApiKey() || !result) return;
    setRegeneratingField(fieldKey);
    try {
      const context = `Event: ${result.name} (${result.han}), type: ${TYPE_LABELS[result.type] || result.type}, year: ${result.year}`;
      const prompt = `You are a historian for Thiên Hoang Đại Lục (天荒大陸), an original xianxia world. CRITICAL: This world is ORIGINAL.

${context}

Generate ONLY the ${fieldLabels[fieldKey] || fieldKey} for this event. Respond with ONLY the value, no labels, no quotes, no explanation.`;

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

  const factionMap = {};
  factions.forEach(f => { factionMap[f.id] = f; });
  const canGenerate = form.type && form.concept && getApiKey();
  const canSave = result?.name;

  return (
    <div style={ms.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`@keyframes breathe { 0%, 100% { opacity: 0.3; transform: scale(0.95); } 50% { opacity: 0.7; transform: scale(1.05); } }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <div style={ms.modal}>
        <div style={ms.header}>
          <div style={ms.headerWatermark}>事</div>
          <div style={ms.title}>{isEdit ? 'Chi Tiết Sự Kiện' : 'Tạo Sự Kiện'}</div>
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
            <>
              <div style={ms.fieldGroup}>
                <div style={ms.label}>Loại sự kiện</div>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={ms.select}>
                  <option value="">— Chọn —</option>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div style={ms.fieldGroup}>
                <div style={ms.label}>Ý tưởng</div>
                <textarea value={form.concept} onChange={e => setForm(f => ({ ...f, concept: e.target.value }))} placeholder="VD: Trận chiến đại hồng thủy giữa Hải Tộc và Long Tộc tại biển Vạn Lý..." style={ms.textarea} />
              </div>
            </>
          )}

          {step === 'generating' && (
            <div style={ms.generating}>
              <div style={ms.genChar}>事</div>
              <div style={ms.genText}>Đang tạo sự kiện...</div>
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

              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
                <div>
                  <div style={ms.label}>Năm</div>
                  <input type="number" value={result.year} onChange={e => setResult(r => ({ ...r, year: e.target.value }))} style={ms.input} placeholder="VD: -100000" />
                </div>
                <div>
                  <div style={ms.label}>Loại</div>
                  <select value={result.type} onChange={e => setResult(r => ({ ...r, type: e.target.value }))} style={ms.select}>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 16 }}>
                <div>
                  <div style={ms.label}>Địa điểm</div>
                  <select value={result.location_id} onChange={e => handleLocationChange(e.target.value)} style={ms.select}>
                    <option value="">— Chọn —</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={ms.label}>X</div>
                  <input type="number" value={result.x} onChange={e => setResult(r => ({ ...r, x: e.target.value }))} style={ms.input} />
                </div>
                <div>
                  <div style={ms.label}>Y</div>
                  <input type="number" value={result.y} onChange={e => setResult(r => ({ ...r, y: e.target.value }))} style={ms.input} />
                </div>
              </div>

              {/* Factions multi-select */}
              <div style={ms.fieldGroup}>
                <div style={ms.label}>Thế lực tham gia</div>
                <div style={{ marginBottom: 6 }}>
                  {(result.factions || []).map((fid, i) => (
                    <span key={i} style={ms.tag}>
                      {factionMap[fid]?.name || fid}
                      <button style={ms.tagRemove} onClick={() => removeFaction(i)}>&times;</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={factionSelect} onChange={e => setFactionSelect(e.target.value)} style={{ ...ms.select, flex: 1 }}>
                    <option value="">— Thêm thế lực —</option>
                    {factions.filter(f => !(result.factions || []).includes(f.id)).map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <button onClick={addFaction} style={{ ...ms.secondaryButton, color: 'var(--gold)', padding: '8px 16px' }}>+</button>
                </div>
              </div>

              <div style={ms.sectionCard}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gold)', marginBottom: 8, display: 'flex', alignItems: 'center' }}>
                  Mô tả <span style={{ fontSize: 11, color: 'var(--gold-dim)', fontFamily: 'var(--font-han)', marginLeft: 4 }}>述</span>
                  <RegenBtn field="description" />
                </div>
                <textarea value={result.description || ''} onChange={e => setResult(r => ({ ...r, description: e.target.value }))} placeholder="Mô tả sự kiện: nguyên nhân, diễn biến, hậu quả..." style={{ ...ms.textarea, minHeight: 120 }} />
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
                {confirmDelete ? 'Đã xóa sự kiện!' : isEdit ? 'Đã cập nhật!' : 'Đã tạo sự kiện!'}
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
              {isEdit ? 'Cập Nhật' : 'Lưu Sự Kiện'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
