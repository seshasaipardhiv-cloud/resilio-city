import React from 'react';

interface EvidenceItem {
  property: string;
  value: string | number;
  source: string;
}

interface IntelligenceData {
  road_id: string;
  road_name: string;
  health_score: number;
  status: string;
  evidence: EvidenceItem[];
  reasoning: string;
  confidence: string;
  evidence_available: boolean;
}

interface Props {
  data: IntelligenceData;
  onClose: () => void;
}

export function InfrastructureIntelligencePanel({ data, onClose }: Props) {
  // Determine color based on health score
  let scoreColor = '#00ff9d'; // Excellent
  if (data.health_score <= 30) scoreColor = '#ff3b6b'; // Critical
  else if (data.health_score <= 50) scoreColor = '#ff7b35'; // Poor
  else if (data.health_score <= 70) scoreColor = '#ffd93d'; // Moderate

  return (
    <div style={{
      position: 'absolute',
      right: 320, // To the left of the right analytics panel
      top: 24,
      width: 340,
      background: 'rgba(5, 12, 24, 0.95)',
      backdropFilter: 'blur(20px)',
      border: `1px solid ${scoreColor}40`,
      borderTop: `4px solid ${scoreColor}`,
      borderRadius: 14,
      boxShadow: '0 12px 48px rgba(0,0,0,0.7), 0 0 24px rgba(0,212,255,0.08)',
      zIndex: 50,
      color: '#fff',
      fontFamily: 'Space Grotesk, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🧠</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#00d4ff', textTransform: 'uppercase', letterSpacing: 1.2 }}>
            GeoAI Intelligence
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
      </div>

      <div style={{ padding: '16px 18px', overflowY: 'auto', maxHeight: '70vh' }}>
        {/* Road Name & Score */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <div style={{ fontSize: 11, color: 'rgba(160,200,230,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Analyzed Corridor</div>
            <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3, color: '#fff' }}>{data.road_name}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: `1px solid ${scoreColor}30`, padding: '8px 12px', borderRadius: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{data.health_score}</span>
            <span style={{ fontSize: 10, color: scoreColor, textTransform: 'uppercase', fontWeight: 700, marginTop: 4 }}>{data.status}</span>
          </div>
        </div>

        {/* Missing SV Disclaimer */}
        <div style={{ background: 'rgba(255,217,61,0.08)', border: '1px solid rgba(255,217,61,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>📷</span>
          <div style={{ fontSize: 10.5, color: 'rgba(255,217,61,0.9)', lineHeight: 1.4 }}>
            <strong>Street View unavailable.</strong> No visual fabrication performed. Score is deterministically derived from verified structural telemetry only.
          </div>
        </div>

        {/* AI Reasoning */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#bd93f9', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚡</span> Automated Reasoning
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(200,220,240,0.85)', lineHeight: 1.6, background: 'rgba(189,147,249,0.08)', borderLeft: '3px solid #bd93f9', padding: '10px 12px', borderRadius: '0 8px 8px 0' }}>
            {data.reasoning}
          </div>
        </div>

        {/* Evidence Sources */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#00d4ff', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📊</span> Verified Evidence Sources
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.evidence.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{item.property}</span>
                  <span style={{ fontSize: 9, color: 'rgba(160,200,230,0.5)' }}>{item.source}</span>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#00d4ff' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'rgba(160,200,230,0.5)' }}>Confidence Level</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: data.confidence === 'High' ? '#00ff9d' : '#ffd93d', textTransform: 'uppercase' }}>{data.confidence}</span>
      </div>
    </div>
  );
}
