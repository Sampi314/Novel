import React from 'react';
import { PageHeader, OrnamentalCorner, SectionDivider } from '../components/Ornaments';

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
  section: {
    marginBottom: 28,
    padding: '24px 28px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    backdropFilter: 'blur(12px)',
  },
  sectionTitle: {
    fontSize: 20,
    color: 'var(--gold)',
    fontWeight: 700,
    marginBottom: 12,
  },
  sectionHan: {
    fontSize: 12,
    color: 'var(--gold-dim)',
    fontFamily: "var(--font-han)",
    marginLeft: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 1.8,
    color: 'var(--text-body)',
  },
  subSection: {
    marginTop: 16,
    padding: '14px 18px',
    background: 'var(--gold-glow)',
    border: '1px solid var(--border-light)',
    borderRadius: 6,
  },
  subTitle: {
    fontSize: 15,
    color: 'var(--text)',
    fontWeight: 600,
    marginBottom: 6,
  },
  sourceCard: {
    display: 'inline-block',
    margin: '6px 8px 6px 0',
    padding: '10px 16px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    verticalAlign: 'top',
    maxWidth: 280,
  },
  sourceName: (color) => ({
    fontSize: 14,
    color: color || 'var(--gold)',
    fontWeight: 600,
  }),
  sourceDesc: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 4,
    lineHeight: 1.5,
  },
};

export default function LorePage({ data }) {
  const { creation = {}, linhKhi = {}, powerSystem = {}, raceOrigins = {}, novelStyle = {} } = data;
  const factionColors = { 'Long Tộc': 'var(--gold)', 'Nhân Tộc': 'var(--accent-blue)', 'Yêu Tộc': 'var(--accent-purple)', 'Hải Tộc': 'var(--accent-cyan)', 'Vi Tộc': 'var(--accent-green)' };

  return (
    <div style={s.page}>
      <div className="page-watermark">{'\u4E16'}</div>
      <PageHeader title="Thế Giới" han="世界" subtitle="Lịch sử và quy luật của Cố Nguyên Giới" />

      {/* Creation */}
      <div className="card-reveal stagger-1" style={{ ...s.section, position: 'relative', overflow: 'hidden' }}>
        <OrnamentalCorner position="top-left" size={30} />
        <OrnamentalCorner position="top-right" size={30} />
        <div style={s.sectionTitle}>
          Sáng Thế<span style={s.sectionHan}>創世</span>
        </div>
        <div style={s.text}>{creation.description}</div>
        {creation.beliefs && (
          <div style={s.subSection}>
            <div style={s.subTitle}>Thần thoại các tộc</div>
            <div style={s.text}>{creation.beliefs}</div>
          </div>
        )}
      </div>

      {/* Linh Khi */}
      <div className="card-reveal stagger-2" style={s.section}>
        <div style={s.sectionTitle}>
          Linh Khí<span style={s.sectionHan}>{linhKhi.han || '靈氣'}</span>
        </div>
        <div style={s.text}>{linhKhi.description}</div>
      </div>

      {/* Power System */}
      <div className="card-reveal stagger-3" style={s.section}>
        <div style={s.sectionTitle}>
          Hệ Thống Sức Mạnh<span style={s.sectionHan}>力量體系</span>
        </div>
        <div style={s.text}>{powerSystem.description}</div>

        {powerSystem.sources && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>Nguồn sức mạnh các tộc:</div>
            {Object.entries(powerSystem.sources).map(([race, info]) => (
              <div key={race} style={s.sourceCard} className="card-interactive">
                <div style={s.sourceName(factionColors[race])}>{race}</div>
                <div style={{ fontSize: 12, color: 'var(--gold)', marginTop: 2 }}>{info.source}</div>
                <div style={s.sourceDesc}>{info.description}</div>
              </div>
            ))}
          </div>
        )}

        {powerSystem.crossLearning && (
          <div style={s.subSection}>
            <div style={s.subTitle}>Học hỏi xuyên tộc</div>
            <div style={s.text}>{powerSystem.crossLearning.description}</div>
            {powerSystem.crossLearning.timeline && (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8, fontStyle: 'italic' }}>
                {powerSystem.crossLearning.timeline}
              </div>
            )}
          </div>
        )}

        {powerSystem.cultivationRealms && (
          <div style={s.subSection}>
            <div style={s.subTitle}>Cảnh giới tu luyện</div>
            <div style={s.text}>{powerSystem.cultivationRealms.description}</div>
          </div>
        )}

        {powerSystem.phamNhan && (
          <div style={s.subSection}>
            <div style={s.subTitle}>Phàm nhân</div>
            <div style={s.text}>{powerSystem.phamNhan.description}</div>
          </div>
        )}
      </div>

      <SectionDivider />

      {/* Race Origins */}
      <div className="card-reveal stagger-4" style={s.section}>
        <div style={s.sectionTitle}>
          Nguồn Gốc Các Tộc<span style={s.sectionHan}>種族起源</span>
        </div>
        <div style={s.text}>{raceOrigins.description}</div>
      </div>

      {/* Novel Style */}
      <div className="card-reveal stagger-5" style={s.section}>
        <div style={s.sectionTitle}>
          Phong Cách<span style={s.sectionHan}>風格</span>
        </div>
        <div style={s.text}>{novelStyle.description}</div>
      </div>
    </div>
  );
}
