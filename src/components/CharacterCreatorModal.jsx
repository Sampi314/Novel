import React, { useState, useMemo } from 'react';
import { getApiKey, setApiKey, callClaude } from '../utils/claudeApi.js';
import { getNextCharacterId, saveCharacter } from '../utils/characterStorage.js';

function buildCharacterSystemPrompt() {
  return `You are a character designer for Cố Nguyên Giới (固元界), an original xianxia world.

CRITICAL: This world is completely ORIGINAL. Do NOT reference cultivation systems, names, or tropes from other novels.

The world has these factions:
- f01: Long Tộc (龍族) — Dragon race, ancient and powerful
- f02: Phượng Tộc (鳳族) — Phoenix race, noble and proud
- f03: Trùng Tộc (蟲族) — Insect race, hive-minded
- f04: Nhân Tộc (人族) — Human race, adaptable
- f05: Yêu Tộc (妖族) — Demon race, shapeshifters
- f06: Cự Nhân Tộc (巨人族) — Giant race
- f07: Vi Nhân Tộc (微人族) — Tiny folk
- f08: Thảo Mộc Tộc (草木族) — Plant race
- f09: Hải Tộc (海族) — Ocean race
- f10: Thạch Tộc (石族) — Stone race

Power levels: 1 (thấp) to 5 (tối cao)
Qi affinities: tối cao, cao, trung, thấp, âm, dương, hỗn hợp

You MUST respond with ONLY valid JSON matching this structure (no markdown, no explanation):
{
  "name": "Vietnamese name",
  "han": "Chinese characters (2-4 chars)",
  "role": "Role/title in Vietnamese",
  "qi_affinity": "one of the qi types",
  "power": 1-5,
  "backstory": "2-3 paragraph backstory in Vietnamese, rich with world lore connections",
  "abilities": "Description of abilities and fighting style in Vietnamese",
  "personality": "Personality traits and motivations in Vietnamese",
  "relationships": [
    {"targetId": "cXX", "type": "ally|rival|mentor|student|family|enemy", "description": "brief description"}
  ]
}`;
}

function buildCharacterUserMessage(form, data) {
  const factionObj = data.factions?.find(f => f.id === form.faction);
  const eraObj = data.eras?.find(e => e.name === form.era);
  const locObj = data.locations?.find(l => l.id === form.location_id);

  return `Create a character for Cố Nguyên Giới:

Concept: ${form.concept}
Faction: ${factionObj?.name || form.faction} (${factionObj?.han || ''})
Era active: ${form.era}${eraObj?.description ? ` — ${eraObj.description}` : ''}
Location: ${locObj?.name || form.location_id || 'unspecified'}

Existing characters they may relate to:
${data.characters?.map(c => `- ${c.id}: ${c.name} (${c.han}) — ${c.role}, ${c.faction}`).join('\n') || 'none'}

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
    position: 'relative', marginBottom: 20, padding: '16px 20px',
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
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
  portraitArea: {
    width: 120, height: 120, borderRadius: 8,
    border: '2px dashed var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', overflow: 'hidden', flexShrink: 0,
    background: 'var(--bg-input)',
  },
};

export default function CharacterCreatorModal({ isOpen, onClose, data, onCharacterSaved }) {
  const [step, setStep] = useState('input');
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [showApiKeySettings, setShowApiKeySettings] = useState(!getApiKey());
  const [form, setForm] = useState({
    faction: '', era: '', location_id: '', concept: '',
  });
  const [result, setResult] = useState(null);
  const [portrait, setPortrait] = useState(null);
  const [error, setError] = useState(null);

  const eras = useMemo(() => data?.eras || [], [data]);
  const factions = useMemo(() => data?.factions || [], [data]);
  const locations = useMemo(() => data?.locations || [], [data]);

  const handleGenerate = async () => {
    setStep('generating');
    setError(null);
    try {
      const systemPrompt = buildCharacterSystemPrompt();
      const userMessage = buildCharacterUserMessage(form, data);
      const r = await callClaude({ systemPrompt, userMessage, maxTokens: 8192 });
      setResult(r);
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('input');
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setStep('saving');
    setError(null);
    try {
      const newId = getNextCharacterId(data.characters || []);
      await saveCharacter({
        id: newId,
        name: result.name,
        han: result.han,
        faction: form.faction,
        role: result.role,
        qi_affinity: result.qi_affinity,
        power: result.power || 3,
        era_start: eras.find(e => e.name === form.era)?.yearStart || 0,
        era_end: null,
        location_id: form.location_id,
        journey: form.location_id ? [form.location_id] : [],
        backstory: result.backstory,
        abilities: result.abilities,
        personality: result.personality,
      });

      // Save portrait if uploaded
      if (portrait) {
        const { uploadAudio } = await import('../utils/devFileWriter.js');
        await uploadAudio(`public/data/characters/${newId}.png`, portrait);
      }

      setStep('done');
      if (onCharacterSaved) onCharacterSaved(newId);
    } catch (err) {
      setError(err.message);
      setStep('review');
    }
  };

  const handlePortraitUpload = (e) => {
    const file = e.target.files[0];
    if (file) setPortrait(file);
  };

  const handleSaveApiKey = () => {
    setApiKey(apiKeyInput);
    setShowApiKeySettings(false);
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
        <div style={ms.header}>
          <div style={ms.headerWatermark}>人</div>
          <div style={ms.title}>Tạo Nhân Vật</div>
          <button style={ms.close} onClick={onClose}>&times;</button>
        </div>

        <div style={ms.body}>
          {error && <div style={ms.error}>{error}</div>}

          {showApiKeySettings && (
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
              {!showApiKeySettings && getApiKey() && (
                <div style={{ textAlign: 'right', marginBottom: 12 }}>
                  <button onClick={() => setShowApiKeySettings(true)} style={{ ...ms.secondaryButton, fontSize: 11, padding: '4px 10px' }}>API Key ✓</button>
                </div>
              )}

              <div style={ms.fieldGroup}>
                <div style={ms.label}>Thế lực</div>
                <select value={form.faction} onChange={e => setForm(f => ({ ...f, faction: e.target.value }))} style={ms.select}>
                  <option value="">— Chọn thế lực —</option>
                  {factions.map(f => <option key={f.id} value={f.id}>{f.name}{f.han ? ` (${f.han})` : ''}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
                <div style={ms.fieldGroup}>
                  <div style={ms.label}>Kỷ Nguyên hoạt động</div>
                  <select value={form.era} onChange={e => setForm(f => ({ ...f, era: e.target.value }))} style={ms.select}>
                    <option value="">— Chọn —</option>
                    {eras.map(era => <option key={era.name} value={era.name}>{era.name}</option>)}
                  </select>
                </div>
                <div style={ms.fieldGroup}>
                  <div style={ms.label}>Vị trí ban đầu</div>
                  <select value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))} style={ms.select}>
                    <option value="">— Chọn —</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={ms.fieldGroup}>
                <div style={ms.label}>Ý tưởng nhân vật</div>
                <textarea value={form.concept} onChange={e => setForm(f => ({ ...f, concept: e.target.value }))} placeholder="Mô tả ngắn gọn nhân vật (VD: Một kiếm sĩ mù dòng Long Tộc, ẩn cư nơi núi Thiên Phong...)" style={ms.textarea} />
              </div>

              {/* Portrait upload */}
              <div style={ms.fieldGroup}>
                <div style={ms.label}>Chân dung (tùy chọn)</div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <label style={ms.portraitArea}>
                    {portrait ? (
                      <img src={URL.createObjectURL(portrait)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 28, color: 'var(--gold-dim)' }}>+</span>
                    )}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePortraitUpload} />
                  </label>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    Tải lên hình ảnh chân dung.<br />
                    Hỗ trợ: PNG, JPG, WebP
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 'generating' && (
            <div style={ms.generating}>
              <div style={ms.genChar}>人</div>
              <div style={ms.genText}>Đang tạo nhân vật...</div>
              <button onClick={() => setStep('input')} style={ms.secondaryButton}>Hủy</button>
            </div>
          )}

          {step === 'review' && result && (
            <>
              <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-dim)' }}>
                Chỉnh sửa thông tin trước khi lưu.
              </div>

              {/* Name & Han */}
              <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                {portrait && (
                  <div style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                    <img src={URL.createObjectURL(portrait)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '2fr 1fr' }}>
                    <div>
                      <div style={ms.label}>Tên</div>
                      <input value={result.name} onChange={e => setResult(r => ({ ...r, name: e.target.value }))} style={ms.input} />
                    </div>
                    <div>
                      <div style={ms.label}>Hán tự</div>
                      <input value={result.han} onChange={e => setResult(r => ({ ...r, han: e.target.value }))} style={ms.input} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr 1fr', marginTop: 10 }}>
                    <div>
                      <div style={ms.label}>Vai trò</div>
                      <input value={result.role} onChange={e => setResult(r => ({ ...r, role: e.target.value }))} style={ms.input} />
                    </div>
                    <div>
                      <div style={ms.label}>Khí chất</div>
                      <input value={result.qi_affinity} onChange={e => setResult(r => ({ ...r, qi_affinity: e.target.value }))} style={ms.input} />
                    </div>
                    <div>
                      <div style={ms.label}>Sức mạnh (1-5)</div>
                      <input type="number" min={1} max={5} value={result.power} onChange={e => setResult(r => ({ ...r, power: +e.target.value }))} style={ms.input} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable sections */}
              {[
                { key: 'backstory', label: 'Tiểu sử', han: '傳' },
                { key: 'abilities', label: 'Năng lực', han: '能' },
                { key: 'personality', label: 'Tính cách', han: '性' },
              ].map(sec => (
                <div key={sec.key} style={ms.sectionCard}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gold)', marginBottom: 8 }}>
                    {sec.label} <span style={{ fontSize: 11, color: 'var(--gold-dim)', fontFamily: 'var(--font-han)' }}>{sec.han}</span>
                  </div>
                  <textarea
                    value={result[sec.key] || ''}
                    onChange={e => setResult(r => ({ ...r, [sec.key]: e.target.value }))}
                    style={{ ...ms.textarea, minHeight: 100 }}
                  />
                </div>
              ))}

              {/* Relationships preview */}
              {result.relationships?.length > 0 && (
                <div style={ms.sectionCard}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gold)', marginBottom: 8 }}>
                    Mối quan hệ <span style={{ fontSize: 11, color: 'var(--gold-dim)', fontFamily: 'var(--font-han)' }}>關</span>
                  </div>
                  {result.relationships.map((rel, i) => {
                    const target = data.characters?.find(c => c.id === rel.targetId);
                    return (
                      <div key={i} style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>
                        <span style={{ color: 'var(--gold-dim)' }}>{rel.type}</span>
                        {' → '}
                        <span style={{ color: 'var(--gold)' }}>{target?.name || rel.targetId}</span>
                        {rel.description && <span style={{ color: 'var(--text-dim)' }}> — {rel.description}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
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
              <div style={{ fontSize: 18, color: 'var(--gold)', fontWeight: 600 }}>Đã tạo nhân vật thành công!</div>
              <div style={{ fontSize: 16, color: 'var(--text)' }}>{result?.name} ({result?.han})</div>
              <button onClick={onClose} style={ms.goldButton}>Đóng</button>
            </div>
          )}
        </div>

        {step === 'input' && (
          <div style={ms.footer}>
            <button onClick={onClose} style={ms.secondaryButton}>Hủy</button>
            <button
              onClick={handleGenerate}
              disabled={!form.faction || !form.era || !form.concept || !getApiKey()}
              style={{ ...ms.goldButton, opacity: (!form.faction || !form.era || !form.concept || !getApiKey()) ? 0.4 : 1 }}
            >
              Tạo bằng AI
            </button>
          </div>
        )}

        {step === 'review' && (
          <div style={ms.footer}>
            <button onClick={() => setStep('input')} style={ms.secondaryButton}>← Quay lại</button>
            <button onClick={handleSave} style={ms.goldButton}>Lưu Nhân Vật</button>
          </div>
        )}
      </div>
    </div>
  );
}
