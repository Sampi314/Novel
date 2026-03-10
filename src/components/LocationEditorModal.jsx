import React, { useState, useMemo } from 'react';
import { getApiKey, setApiKey, callClaude, callClaudeText } from '../utils/claudeApi.js';
import { getNextLocationId, saveLocation, deleteLocation } from '../utils/locationStorage.js';

const TYPES = ['capital', 'sacred', 'city', 'secret_realm', 'port', 'resource', 'ruin', 'dungeon'];
const TYPE_LABELS = {
  capital: 'Kinh đô', sacred: 'Thánh địa', city: 'Thành phố', secret_realm: 'Bí cảnh',
  port: 'Hải cảng', resource: 'Tài nguyên', ruin: 'Phế tích', dungeon: 'Tà địa',
};
const QI_LEVELS = ['tối cao', 'cao', 'trung', 'thấp', 'âm', 'dương'];

function buildSystemPrompt(data) {
  const factions = data.factions?.map(f => `- ${f.name} (${f.han})`).join('\n') || '';
  return `You are a location designer for Cố Nguyên Giới (固元界), an original xianxia world.
CRITICAL: This world is ORIGINAL. Do NOT reference locations from other novels.

Known factions:
${factions}

Location types: capital, sacred, city, secret_realm, port, resource, ruin, dungeon
Qi levels: tối cao, cao, trung, thấp, âm, dương

You MUST respond with ONLY valid JSON:
{
  "name": "Vietnamese name",
  "han": "Chinese characters (2-4 chars)",
  "description": "2-3 paragraph description in Vietnamese — geography, history, significance, inhabitants"
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
};

export default function LocationEditorModal({ isOpen, onClose, data, editItem, onSaved }) {
  const isEdit = !!editItem;
  const [step, setStep] = useState('input');
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [showApiKeySettings, setShowApiKeySettings] = useState(!getApiKey());
  const [form, setForm] = useState({ type: '', race: '', concept: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [regeneratingField, setRegeneratingField] = useState(null);

  const races = useMemo(() => {
    const set = new Set((data.locations || []).map(l => l.race).filter(Boolean));
    return [...set];
  }, [data]);

  React.useEffect(() => {
    if (editItem && isOpen) {
      setResult({
        name: editItem.name || '', han: editItem.han || '',
        type: editItem.type || '', race: editItem.race || '',
        qi: editItem.qi || '', power: editItem.power || '',
        x: editItem.x ?? '', y: editItem.y ?? '',
        era_founded: editItem.era_founded ?? '', era_destroyed: editItem.era_destroyed ?? '',
        population: editItem.population || editItem.pop || '',
        description: editItem.desc || editItem.description || '',
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
        userMessage: `Create a location for Cố Nguyên Giới:\nType: ${TYPE_LABELS[form.type] || form.type}\nRace: ${form.race || 'any'}\nConcept: ${form.concept}\n\nRespond with ONLY JSON.`,
        maxTokens: 4096,
      });
      setResult({
        ...r,
        type: form.type,
        race: form.race,
        qi: '', power: '', x: '', y: '',
        era_founded: '', era_destroyed: '', population: '',
      });
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('input');
    }
  };

  const handleManualInput = () => {
    setResult({
      name: '', han: '', type: form.type || '', race: form.race || '',
      qi: '', power: '', x: '', y: '',
      era_founded: '', era_destroyed: '', population: '', description: '',
    });
    setStep('review');
  };

  const handleDelete = async () => {
    if (!editItem) return;
    setStep('saving');
    setError(null);
    try {
      await deleteLocation(editItem.id);
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
      const locId = isEdit ? editItem.id : getNextLocationId(data.locations || []);
      await saveLocation({
        id: locId,
        name: result.name, han: result.han, type: result.type,
        x: result.x, y: result.y,
        era_founded: result.era_founded, era_destroyed: result.era_destroyed,
        race: result.race, qi: result.qi, power: result.power,
        population: result.population, description: result.description,
      });
      setStep('done');
      if (onSaved) onSaved(locId);
    } catch (err) {
      setError(err.message);
      setStep('review');
    }
  };

  const handleSaveApiKey = () => { setApiKey(apiKeyInput); setShowApiKeySettings(false); };

  const fieldLabels = {
    name: 'tên địa điểm (Vietnamese)',
    han: 'tên Hán tự (2-4 Chinese characters)',
    description: 'mô tả chi tiết (Vietnamese, 2-3 paragraphs — geography, history, significance)',
  };

  const handleRegenerateField = async (fieldKey) => {
    if (!getApiKey() || !result) return;
    setRegeneratingField(fieldKey);
    try {
      const context = `Location: ${result.name} (${result.han}), type: ${TYPE_LABELS[result.type] || result.type}, race: ${result.race}, qi: ${result.qi}`;
      const prompt = `You are a location designer for Cố Nguyên Giới (固元界), an original xianxia world. CRITICAL: This world is ORIGINAL.

${context}

Generate ONLY the ${fieldLabels[fieldKey] || fieldKey} for this location. Respond with ONLY the value, no labels, no quotes, no explanation.`;

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

  const canGenerate = form.type && form.concept && getApiKey();
  const canSave = result?.name;

  return (
    <div style={ms.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`@keyframes breathe { 0%, 100% { opacity: 0.3; transform: scale(0.95); } 50% { opacity: 0.7; transform: scale(1.05); } }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <div style={ms.modal}>
        <div style={ms.header}>
          <div style={ms.headerWatermark}>地</div>
          <div style={ms.title}>{isEdit ? 'Chi Tiết Địa Điểm' : 'Tạo Địa Điểm'}</div>
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
              <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
                <div style={ms.fieldGroup}>
                  <div style={ms.label}>Loại địa điểm</div>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={ms.select}>
                    <option value="">— Chọn —</option>
                    {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div style={ms.fieldGroup}>
                  <div style={ms.label}>Chủng tộc</div>
                  <select value={form.race} onChange={e => setForm(f => ({ ...f, race: e.target.value }))} style={ms.select}>
                    <option value="">— Chọn —</option>
                    {races.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div style={ms.fieldGroup}>
                <div style={ms.label}>Ý tưởng</div>
                <textarea value={form.concept} onChange={e => setForm(f => ({ ...f, concept: e.target.value }))} placeholder="VD: Một kinh đô trên đỉnh núi của Long Tộc, bao quanh bởi mây và sương..." style={ms.textarea} />
              </div>
            </>
          )}

          {step === 'generating' && (
            <div style={ms.generating}>
              <div style={ms.genChar}>地</div>
              <div style={ms.genText}>Đang tạo địa điểm...</div>
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
                  <div style={ms.label}>Loại</div>
                  <select value={result.type} onChange={e => setResult(r => ({ ...r, type: e.target.value }))} style={ms.select}>
                    <option value="">— Chọn —</option>
                    {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <div style={ms.label}>Chủng tộc</div>
                  <select value={result.race} onChange={e => setResult(r => ({ ...r, race: e.target.value }))} style={ms.select}>
                    <option value="">— Chọn —</option>
                    {races.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <div style={ms.label}>Linh khí</div>
                  <select value={result.qi} onChange={e => setResult(r => ({ ...r, qi: e.target.value }))} style={ms.select}>
                    <option value="">— Chọn —</option>
                    {QI_LEVELS.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 16 }}>
                <div>
                  <div style={ms.label}>Sức mạnh (1-10)</div>
                  <input type="number" min={1} max={10} value={result.power} onChange={e => setResult(r => ({ ...r, power: e.target.value }))} style={ms.input} />
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

              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 16 }}>
                <div>
                  <div style={ms.label}>Năm thành lập</div>
                  <input type="number" value={result.era_founded} onChange={e => setResult(r => ({ ...r, era_founded: e.target.value }))} style={ms.input} />
                </div>
                <div>
                  <div style={ms.label}>Năm hủy diệt</div>
                  <input type="number" value={result.era_destroyed} onChange={e => setResult(r => ({ ...r, era_destroyed: e.target.value }))} style={ms.input} />
                </div>
                <div>
                  <div style={ms.label}>Dân số</div>
                  <input type="number" value={result.population} onChange={e => setResult(r => ({ ...r, population: e.target.value }))} style={ms.input} />
                </div>
              </div>

              <div style={ms.sectionCard}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gold)', marginBottom: 8, display: 'flex', alignItems: 'center' }}>
                  Mô tả <span style={{ fontSize: 11, color: 'var(--gold-dim)', fontFamily: 'var(--font-han)', marginLeft: 4 }}>述</span>
                  <RegenBtn field="description" />
                </div>
                <textarea value={result.description || ''} onChange={e => setResult(r => ({ ...r, description: e.target.value }))} placeholder="Mô tả địa điểm: lịch sử, địa hình, cư dân, linh khí..." style={{ ...ms.textarea, minHeight: 120 }} />
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
                {confirmDelete ? 'Đã xóa địa điểm!' : isEdit ? 'Đã cập nhật!' : 'Đã tạo địa điểm!'}
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
              {isEdit ? 'Cập Nhật' : 'Lưu Địa Điểm'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
