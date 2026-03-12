import React, { useState, useMemo } from 'react';
import { getApiKey, setApiKey, callClaude, callClaudeText } from '../utils/claudeApi.js';
import { getNextCharacterId, saveCharacter, deleteCharacter } from '../utils/characterStorage.js';

function buildCharacterSystemPrompt() {
  return `You are a character designer for Thiên Hoang Đại Lục (天荒大陸), an original xianxia world.

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
  "appearance": "Physical description in Vietnamese (height, build, distinguishing features, clothing style)",
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

  return `Create a character for Thiên Hoang Đại Lục:

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
  journeyTag: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', margin: '3px 4px 3px 0',
    borderRadius: 10, fontSize: 12,
    background: 'var(--gold-glow)', border: '1px solid var(--border)',
    color: 'var(--text-body)',
  },
  journeyRemove: {
    background: 'none', border: 'none', color: 'var(--text-dim)',
    cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1,
  },
};

export default function CharacterCreatorModal({ isOpen, onClose, data, onCharacterSaved, editCharacter }) {
  const isEdit = !!editCharacter;
  const [step, setStep] = useState('input');
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [showApiKeySettings, setShowApiKeySettings] = useState(!getApiKey());
  const [form, setForm] = useState({
    faction: '', era: '', location_id: '', concept: '',
  });
  const [result, setResult] = useState(null);
  const [portrait, setPortrait] = useState(null);
  const [error, setError] = useState(null);
  const [journeySelect, setJourneySelect] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bioLoaded, setBioLoaded] = useState(false);
  const [regeneratingField, setRegeneratingField] = useState(null);

  // When editCharacter changes, populate and jump to review
  React.useEffect(() => {
    if (editCharacter && isOpen) {
      const c = editCharacter;
      setResult({
        name: c.name || '',
        han: c.han || '',
        role: c.role || '',
        qi_affinity: c.qi_affinity || '',
        power: c.power || 3,
        faction: c.faction || '',
        era_start: c.era_start || 0,
        era_end: c.era_end ?? '',
        location_id: c.location_id || '',
        journey: c.journey || [],
        appearance: '', backstory: '', abilities: '', personality: '',
        relationships: [],
      });
      setStep('review');
      setConfirmDelete(false);
      setBioLoaded(false);

      // Fetch bio markdown if it exists
      const base = import.meta.env.BASE_URL;
      fetch(`${base}data/characters/${c.id}.md`)
        .then(r => r.ok ? r.text() : '')
        .then(md => {
          if (!md) { setBioLoaded(true); return; }
          // Parse sections from markdown
          const sections = {};
          const sectionMap = {
            '## Ngoại hình': 'appearance',
            '## Tiểu sử': 'backstory',
            '## Năng lực': 'abilities',
            '## Tính cách': 'personality',
          };
          let currentKey = null;
          for (const line of md.split('\n')) {
            if (sectionMap[line.trim()]) {
              currentKey = sectionMap[line.trim()];
              sections[currentKey] = '';
            } else if (line.startsWith('## ') || line.startsWith('---')) {
              currentKey = null;
            } else if (currentKey) {
              sections[currentKey] = (sections[currentKey] + '\n' + line).trim();
            }
          }
          setResult(r => r ? { ...r, ...sections } : r);
          setBioLoaded(true);
        })
        .catch(() => setBioLoaded(true));
    } else if (!editCharacter && isOpen) {
      setStep('input');
      setResult(null);
      setConfirmDelete(false);
      setBioLoaded(false);
    }
  }, [editCharacter, isOpen]);

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

      const eraObj = eras.find(e => e.name === form.era);
      setResult({
        ...r,
        faction: form.faction,
        era_start: eraObj?.year ?? 0,
        era_end: '',
        location_id: form.location_id,
        journey: form.location_id ? [form.location_id] : [],
        appearance: r.appearance || '',
      });
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('input');
    }
  };

  const handleManualInput = () => {
    const eraObj = eras.find(e => e.name === form.era);
    setResult({
      name: '', han: '', role: '', qi_affinity: '', power: 3,
      faction: form.faction || '',
      era_start: eraObj?.year ?? '',
      era_end: '',
      location_id: form.location_id || '',
      journey: form.location_id ? [form.location_id] : [],
      appearance: '', backstory: '', abilities: '', personality: '',
      relationships: [],
    });
    setStep('review');
  };

  const handleDelete = async () => {
    if (!editCharacter) return;
    setStep('saving');
    setError(null);
    try {
      await deleteCharacter(editCharacter.id);
      setStep('done');
      if (onCharacterSaved) onCharacterSaved(null, true);
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
      const charId = isEdit ? editCharacter.id : getNextCharacterId(data.characters || []);
      await saveCharacter({
        id: charId,
        name: result.name,
        han: result.han,
        faction: result.faction,
        role: result.role,
        qi_affinity: result.qi_affinity,
        power: result.power || 3,
        era_start: result.era_start || 0,
        era_end: result.era_end || null,
        location_id: result.location_id || '',
        journey: result.journey || [],
        appearance: result.appearance || '',
        backstory: result.backstory,
        abilities: result.abilities,
        personality: result.personality,
      });

      if (portrait) {
        const { uploadAudio } = await import('../utils/devFileWriter.js');
        await uploadAudio(`public/data/characters/${charId}.png`, portrait);
      }

      setStep('done');
      if (onCharacterSaved) onCharacterSaved(charId);
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

  const fieldLabels = {
    name: 'tên nhân vật (Vietnamese)',
    han: 'tên Hán tự (2-4 Chinese characters)',
    role: 'vai trò / danh hiệu (Vietnamese)',
    qi_affinity: 'khí chất (one of: tối cao, cao, trung, thấp, âm, dương, hỗn hợp)',
    appearance: 'ngoại hình chi tiết (Vietnamese, 2-3 sentences)',
    backstory: 'tiểu sử chi tiết (Vietnamese, 2-3 paragraphs)',
    abilities: 'năng lực và chiêu thức (Vietnamese, 2-3 sentences)',
    personality: 'tính cách và động lực (Vietnamese, 2-3 sentences)',
  };

  const handleRegenerateField = async (fieldKey) => {
    if (!getApiKey() || !result) return;
    setRegeneratingField(fieldKey);
    try {
      const factionObj = factions.find(f => f.id === result.faction);
      const context = `Character: ${result.name} (${result.han}), role: ${result.role}, faction: ${factionObj?.name || result.faction}, qi: ${result.qi_affinity}, power: ${result.power}/5`;
      const existing = Object.entries(result)
        .filter(([k, v]) => v && ['appearance', 'backstory', 'abilities', 'personality'].includes(k) && k !== fieldKey)
        .map(([k, v]) => `${k}: ${String(v).substring(0, 200)}`)
        .join('\n');

      const prompt = `You are a character designer for Thiên Hoang Đại Lục (天荒大陸), an original xianxia world. CRITICAL: This world is ORIGINAL — no references to other novels.

${context}
${existing ? `\nExisting info:\n${existing}` : ''}

Generate ONLY the ${fieldLabels[fieldKey] || fieldKey} for this character. Respond with ONLY the value, no labels, no quotes, no explanation.`;

      const text = await callClaudeText({ systemPrompt: prompt, userMessage: `Generate ${fieldKey}`, maxTokens: 2048 });
      setResult(r => r ? { ...r, [fieldKey]: text.trim() } : r);
    } catch (err) {
      setError(err.message);
    }
    setRegeneratingField(null);
  };

  const addJourneyLocation = () => {
    if (!journeySelect || result.journey?.includes(journeySelect)) return;
    setResult(r => ({ ...r, journey: [...(r.journey || []), journeySelect] }));
    setJourneySelect('');
  };

  const removeJourneyLocation = (index) => {
    setResult(r => ({ ...r, journey: r.journey.filter((_, i) => i !== index) }));
  };

  const RegenBtn = ({ field }) => {
    const isLoading = regeneratingField === field;
    const hasKey = !!getApiKey();
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          if (!hasKey) { setShowApiKeySettings(true); setError('Cần API key để dùng AI'); return; }
          handleRegenerateField(field);
        }}
        disabled={isLoading || !!regeneratingField}
        title={hasKey ? 'Tạo lại bằng AI' : 'Cần API key'}
        style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 4,
          color: isLoading ? 'var(--gold)' : 'var(--text-dim)', cursor: isLoading ? 'wait' : 'pointer',
          fontSize: 11, padding: '2px 8px', marginLeft: 6, fontFamily: 'var(--font-body)',
          opacity: regeneratingField && !isLoading ? 0.3 : 1,
          transition: 'all 0.2s',
        }}
      >
        {isLoading ? '...' : 'AI'}
      </button>
    );
  };

  if (!isOpen) return null;

  const locationMap = {};
  locations.forEach(l => { locationMap[l.id] = l; });

  const canGenerate = form.faction && form.era && form.concept && getApiKey();
  const canSave = result?.name;

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
          <div style={ms.title}>{isEdit ? 'Chi Tiết Nhân Vật' : 'Tạo Nhân Vật'}</div>
          <button style={ms.close} onClick={onClose}>&times;</button>
        </div>

        <div style={ms.body}>
          {error && <div style={ms.error}>{error}</div>}

          {showApiKeySettings && (step === 'input' || step === 'review') && (
            <div style={{ ...ms.fieldGroup, padding: 16, background: 'var(--gold-glow)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={ms.label}>Anthropic API Key <span style={{ color: 'var(--text-dim)' }}>(chỉ cần cho AI)</span></div>
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
                <div style={ms.label}>Ý tưởng nhân vật <span style={{ color: 'var(--text-dim)' }}>(bắt buộc cho AI, tùy chọn cho tự nhập)</span></div>
                <textarea value={form.concept} onChange={e => setForm(f => ({ ...f, concept: e.target.value }))} placeholder="Mô tả ngắn gọn nhân vật (VD: Một kiếm sĩ mù dòng Long Tộc, ẩn cư nơi núi Thiên Phong...)" style={ms.textarea} />
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

              {/* Identity + Portrait */}
              <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                <label style={ms.portraitArea}>
                  {portrait ? (
                    <img src={URL.createObjectURL(portrait)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 28, color: 'var(--gold-dim)' }}>+</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Chân dung</div>
                    </div>
                  )}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePortraitUpload} />
                </label>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '2fr 1fr' }}>
                    <div>
                      <div style={ms.label}>Tên <RegenBtn field="name" /></div>
                      <input value={result.name} onChange={e => setResult(r => ({ ...r, name: e.target.value }))} style={ms.input} placeholder="Tên nhân vật" />
                    </div>
                    <div>
                      <div style={ms.label}>Hán tự <RegenBtn field="han" /></div>
                      <input value={result.han} onChange={e => setResult(r => ({ ...r, han: e.target.value }))} style={ms.input} placeholder="漢字" />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={ms.label}>Vai trò / Danh hiệu <RegenBtn field="role" /></div>
                    <input value={result.role} onChange={e => setResult(r => ({ ...r, role: e.target.value }))} style={ms.input} placeholder="VD: Tộc Trưởng, Kiếm Sĩ, Trưởng Lão..." />
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 16 }}>
                <div>
                  <div style={ms.label}>Thế lực</div>
                  <select value={result.faction} onChange={e => setResult(r => ({ ...r, faction: e.target.value }))} style={ms.select}>
                    <option value="">— Chọn —</option>
                    {factions.map(f => <option key={f.id} value={f.id}>{f.name}{f.han ? ` (${f.han})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <div style={ms.label}>Khí chất <RegenBtn field="qi_affinity" /></div>
                  <select value={result.qi_affinity} onChange={e => setResult(r => ({ ...r, qi_affinity: e.target.value }))} style={ms.select}>
                    <option value="">— Chọn —</option>
                    {['tối cao', 'cao', 'trung', 'thấp', 'âm', 'dương', 'hỗn hợp'].map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={ms.label}>Sức mạnh (1-5)</div>
                  <input type="number" min={1} max={5} value={result.power} onChange={e => setResult(r => ({ ...r, power: +e.target.value }))} style={ms.input} />
                </div>
              </div>

              {/* Timeline row */}
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 16 }}>
                <div>
                  <div style={ms.label}>Năm bắt đầu</div>
                  <input type="number" value={result.era_start} onChange={e => setResult(r => ({ ...r, era_start: e.target.value }))} style={ms.input} placeholder="VD: 80000" />
                </div>
                <div>
                  <div style={ms.label}>Năm kết thúc <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>(trống = còn sống)</span></div>
                  <input type="number" value={result.era_end} onChange={e => setResult(r => ({ ...r, era_end: e.target.value }))} style={ms.input} placeholder="Trống nếu còn sống" />
                </div>
                <div>
                  <div style={ms.label}>Vị trí ban đầu</div>
                  <select value={result.location_id} onChange={e => setResult(r => ({ ...r, location_id: e.target.value }))} style={ms.select}>
                    <option value="">— Chọn —</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Journey */}
              <div style={ms.fieldGroup}>
                <div style={ms.label}>Hành trình</div>
                <div style={{ marginBottom: 6 }}>
                  {(result.journey || []).map((locId, i) => (
                    <span key={i} style={ms.journeyTag}>
                      {locationMap[locId]?.name || locId}
                      <button style={ms.journeyRemove} onClick={() => removeJourneyLocation(i)}>&times;</button>
                    </span>
                  ))}
                  {(!result.journey || result.journey.length === 0) && (
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>Chưa có điểm nào</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={journeySelect} onChange={e => setJourneySelect(e.target.value)} style={{ ...ms.select, flex: 1 }}>
                    <option value="">— Thêm địa điểm —</option>
                    {locations.filter(l => !(result.journey || []).includes(l.id)).map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <button onClick={addJourneyLocation} style={{ ...ms.secondaryButton, color: 'var(--gold)', padding: '8px 16px' }}>+</button>
                </div>
              </div>

              {/* Editable text sections */}
              {[
                { key: 'appearance', label: 'Ngoại hình', han: '貌', placeholder: 'Mô tả ngoại hình, trang phục, đặc điểm nhận dạng...' },
                { key: 'backstory', label: 'Tiểu sử', han: '傳', placeholder: 'Câu chuyện quá khứ, nguồn gốc, những sự kiện quan trọng...' },
                { key: 'abilities', label: 'Năng lực', han: '能', placeholder: 'Chiêu thức, vũ khí, phong cách chiến đấu, khả năng đặc biệt...' },
                { key: 'personality', label: 'Tính cách', han: '性', placeholder: 'Đặc điểm tính cách, động lực, sở thích, điểm yếu...' },
              ].map(sec => (
                <div key={sec.key} style={ms.sectionCard}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gold)', marginBottom: 8, display: 'flex', alignItems: 'center' }}>
                    {sec.label} <span style={{ fontSize: 11, color: 'var(--gold-dim)', fontFamily: 'var(--font-han)', marginLeft: 4 }}>{sec.han}</span>
                    <RegenBtn field={sec.key} />
                  </div>
                  <textarea
                    value={result[sec.key] || ''}
                    onChange={e => setResult(r => ({ ...r, [sec.key]: e.target.value }))}
                    placeholder={sec.placeholder}
                    style={{ ...ms.textarea, minHeight: 100 }}
                  />
                </div>
              ))}

              {/* Relationships */}
              <div style={ms.sectionCard}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gold)', marginBottom: 8 }}>
                  Mối quan hệ <span style={{ fontSize: 11, color: 'var(--gold-dim)', fontFamily: 'var(--font-han)' }}>關</span>
                </div>
                {(result.relationships || []).map((rel, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <select
                      value={rel.targetId}
                      onChange={e => {
                        const updated = [...result.relationships];
                        updated[i] = { ...updated[i], targetId: e.target.value };
                        setResult(r => ({ ...r, relationships: updated }));
                      }}
                      style={{ ...ms.select, flex: 2 }}
                    >
                      <option value="">— Nhân vật —</option>
                      {data.characters?.map(c => <option key={c.id} value={c.id}>{c.name} ({c.han})</option>)}
                    </select>
                    <select
                      value={rel.type}
                      onChange={e => {
                        const updated = [...result.relationships];
                        updated[i] = { ...updated[i], type: e.target.value };
                        setResult(r => ({ ...r, relationships: updated }));
                      }}
                      style={{ ...ms.select, flex: 1 }}
                    >
                      {['ally', 'rival', 'mentor', 'student', 'family', 'enemy'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <input
                      value={rel.description || ''}
                      onChange={e => {
                        const updated = [...result.relationships];
                        updated[i] = { ...updated[i], description: e.target.value };
                        setResult(r => ({ ...r, relationships: updated }));
                      }}
                      placeholder="Mô tả ngắn"
                      style={{ ...ms.input, flex: 2 }}
                    />
                    <button
                      onClick={() => setResult(r => ({ ...r, relationships: r.relationships.filter((_, j) => j !== i) }))}
                      style={{ ...ms.journeyRemove, fontSize: 18, color: '#e88' }}
                    >&times;</button>
                  </div>
                ))}
                <button
                  onClick={() => setResult(r => ({
                    ...r,
                    relationships: [...(r.relationships || []), { targetId: '', type: 'ally', description: '' }],
                  }))}
                  style={{ ...ms.secondaryButton, fontSize: 12, padding: '6px 14px', color: 'var(--gold)' }}
                >
                  + Thêm mối quan hệ
                </button>
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
                {confirmDelete ? 'Đã xóa nhân vật!' : isEdit ? 'Đã cập nhật nhân vật!' : 'Đã tạo nhân vật thành công!'}
              </div>
              {!confirmDelete && <div style={{ fontSize: 16, color: 'var(--text)' }}>{result?.name} ({result?.han})</div>}
              <button onClick={onClose} style={ms.goldButton}>Đóng</button>
            </div>
          )}
        </div>

        {step === 'input' && (
          <div style={ms.footer}>
            <button onClick={onClose} style={ms.secondaryButton}>Hủy</button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleManualInput} style={ms.manualButton}>
                Tự nhập
              </button>
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                style={{ ...ms.goldButton, opacity: canGenerate ? 1 : 0.4 }}
              >
                Tạo bằng AI
              </button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div style={ms.footer}>
            <div style={{ display: 'flex', gap: 8 }}>
              {!isEdit && <button onClick={() => setStep('input')} style={ms.secondaryButton}>← Quay lại</button>}
              {isEdit && !confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{ ...ms.secondaryButton, color: '#e88', borderColor: 'rgba(200,50,50,0.3)' }}
                >
                  Xóa
                </button>
              )}
              {isEdit && confirmDelete && (
                <>
                  <button
                    onClick={handleDelete}
                    style={{ ...ms.secondaryButton, color: '#fff', background: 'rgba(200,50,50,0.8)', borderColor: 'rgba(200,50,50,0.5)' }}
                  >
                    Xác nhận xóa
                  </button>
                  <button onClick={() => setConfirmDelete(false)} style={ms.secondaryButton}>Hủy</button>
                </>
              )}
            </div>
            <button onClick={handleSave} disabled={!canSave} style={{ ...ms.goldButton, opacity: canSave ? 1 : 0.4 }}>
              {isEdit ? 'Cập Nhật' : 'Lưu Nhân Vật'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
