import { useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Props {
  onBack: () => void;
  prefilledFromUser?: { name: string; email: string; phone: string } | null;
}

export default function PetitionPage({ onBack, prefilledFromUser }: Props) {
  const [name, setName] = useState(prefilledFromUser?.name || '');
  const [email, setEmail] = useState(prefilledFromUser?.email || '');
  const [phone, setPhone] = useState(prefilledFromUser?.phone || '');
  const [cityName, setCityName] = useState('');
  const [stateName, setStateName] = useState('');
  const [country, setCountry] = useState('India');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [petitionId, setPetitionId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await axios.post(`${API}/petitions`, {
        user_name: name, user_email: email, user_phone: phone,
        city_name: cityName, state: stateName, country, reason
      });
      if (data.success) {
        setPetitionId(data.petition_id);
        setSubmitted(true);
      } else {
        setError(data.message || 'Failed to submit petition');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Server error. Please try again.');
    } finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(10,20,38,0.8)',
    border: '1px solid rgba(255,140,0,0.25)',
    borderRadius: 10, padding: '12px 16px',
    color: '#fff', fontFamily: 'Space Grotesk', fontSize: 14,
    outline: 'none', transition: 'border 0.2s', boxSizing: 'border-box'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'rgba(200,170,100,0.7)', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 6
  };

  if (submitted) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'radial-gradient(ellipse at center, rgba(20,10,2,0.99) 0%, rgba(2,3,8,0.99) 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Space Grotesk, sans-serif', padding: 20
      }}>
        <div style={{
          maxWidth: 500, width: '100%', textAlign: 'center',
          background: 'rgba(8,12,22,0.95)', border: '1px solid rgba(0,255,157,0.3)',
          borderRadius: 24, padding: '48px 40px',
          boxShadow: '0 0 60px rgba(0,255,100,0.1)'
        }}>
          <div style={{ fontSize: 72, marginBottom: 24 }}>✅</div>
          <div style={{ fontWeight: 900, fontSize: 26, color: '#00ff9d', marginBottom: 12 }}>Petition Submitted!</div>
          <div style={{ fontSize: 15, color: 'rgba(180,220,180,0.8)', lineHeight: 1.6, marginBottom: 24 }}>
            Your petition for <strong style={{ color: '#ffd700' }}>{cityName}</strong> has been submitted successfully.
            Our admin team will review it and notify you at <strong style={{ color: '#ffa040' }}>{email}</strong>.
          </div>
          <div style={{ fontSize: 12, color: 'rgba(150,180,150,0.5)', marginBottom: 32, background: 'rgba(0,255,157,0.05)', border: '1px solid rgba(0,255,157,0.1)', borderRadius: 8, padding: '8px 14px' }}>
            Petition ID: <span style={{ color: '#00ff9d', fontFamily: 'monospace' }}>{petitionId}</span>
          </div>
          <button onClick={onBack} style={{
            background: 'linear-gradient(135deg, rgba(255,140,0,0.3), rgba(255,80,0,0.2))',
            border: '1px solid rgba(255,140,0,0.5)',
            borderRadius: 12, padding: '14px 32px', color: '#fff',
            fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15,
            cursor: 'pointer', letterSpacing: 1
          }}>
            ← Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'radial-gradient(ellipse at center, rgba(20,10,2,0.99) 0%, rgba(2,3,8,0.99) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Space Grotesk, sans-serif', padding: 20,
      overflowY: 'auto'
    }}>
      {/* Grid bg */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, opacity: 0.05,
        backgroundImage: 'linear-gradient(rgba(255,140,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,140,0,0.5) 1px, transparent 1px)',
        backgroundSize: '60px 60px', pointerEvents: 'none'
      }} />

      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 560,
        background: 'rgba(8,12,22,0.97)',
        border: '1px solid rgba(255,140,0,0.2)',
        borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 0 80px rgba(255,100,0,0.08), 0 40px 80px rgba(0,0,0,0.6)',
        margin: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '28px 32px 20px',
          borderBottom: '1px solid rgba(255,140,0,0.1)',
          background: 'linear-gradient(135deg, rgba(255,140,0,0.05), rgba(255,50,0,0.02))'
        }}>
          <button onClick={onBack} style={{
            background: 'none', border: 'none', color: 'rgba(200,160,80,0.7)',
            cursor: 'pointer', fontSize: 13, fontFamily: 'Space Grotesk',
            marginBottom: 16, padding: 0, display: 'flex', alignItems: 'center', gap: 6
          }}>← Back to Home</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 36 }}>📋</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 22, color: '#ffd700' }}>File a Petition</div>
              <div style={{ fontSize: 12, color: 'rgba(180,140,80,0.6)', letterSpacing: 1, marginTop: 2 }}>
                Request your city / village / town to be added to Resilio City
              </div>
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div style={{ padding: '16px 32px', background: 'rgba(255,140,0,0.04)', borderBottom: '1px solid rgba(255,140,0,0.08)' }}>
          <div style={{ fontSize: 12, color: 'rgba(200,170,100,0.7)', lineHeight: 1.6 }}>
            📬 Once submitted, your petition will be reviewed by our admin team. If accepted, your city will be added to the National Digital Twin Platform with full road network detection, disaster intelligence, and infrastructure monitoring. You will be notified by email.
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 32px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {error && (
            <div style={{ background: 'rgba(255,59,107,0.1)', border: '1px solid rgba(255,59,107,0.35)', borderRadius: 10, padding: '10px 14px', color: '#ff6b8a', fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          {/* Personal details section */}
          <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,140,0,0.8)', textTransform: 'uppercase', letterSpacing: 2, paddingBottom: 8, borderBottom: '1px solid rgba(255,140,0,0.1)' }}>
            👤 Your Details
          </div>

          <div>
            <label style={labelStyle}>Full Name *</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)}
              placeholder="Your full name" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'rgba(255,140,0,0.6)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,140,0,0.25)'}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Email Address *</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(255,140,0,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,140,0,0.25)'}
              />
            </div>
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+91 XXXXX XXXXX" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(255,140,0,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,140,0,0.25)'}
              />
            </div>
          </div>

          {/* Location section */}
          <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,140,0,0.8)', textTransform: 'uppercase', letterSpacing: 2, paddingBottom: 8, borderBottom: '1px solid rgba(255,140,0,0.1)', marginTop: 4 }}>
            🗺️ Location Details
          </div>

          <div>
            <label style={labelStyle}>City / Village / Town Name *</label>
            <input type="text" required value={cityName} onChange={e => setCityName(e.target.value)}
              placeholder="e.g. Warangal, Shimla, Aizawl..." style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'rgba(255,140,0,0.6)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,140,0,0.25)'}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>State</label>
              <input type="text" value={stateName} onChange={e => setStateName(e.target.value)}
                placeholder="e.g. Telangana" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(255,140,0,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,140,0,0.25)'}
              />
            </div>
            <div>
              <label style={labelStyle}>Country</label>
              <input type="text" value={country} onChange={e => setCountry(e.target.value)}
                placeholder="India" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(255,140,0,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,140,0,0.25)'}
              />
            </div>
          </div>

          {/* Reason section */}
          <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,140,0,0.8)', textTransform: 'uppercase', letterSpacing: 2, paddingBottom: 8, borderBottom: '1px solid rgba(255,140,0,0.1)', marginTop: 4 }}>
            💬 Reason for Request
          </div>

          <div>
            <label style={labelStyle}>Why should this location be added? *</label>
            <textarea
              required value={reason} onChange={e => setReason(e.target.value)}
              rows={4}
              placeholder="Describe the infrastructure needs, disaster risks, population density, or strategic importance of this location..."
              style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,140,0,0.6)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,140,0,0.25)'}
            />
            <div style={{ fontSize: 11, color: 'rgba(150,120,60,0.5)', marginTop: 4 }}>
              {reason.length}/500 characters — be specific about needs
            </div>
          </div>

          <button type="submit" disabled={loading} style={{
            padding: '16px',
            background: loading ? 'rgba(100,80,40,0.3)' : 'linear-gradient(135deg, rgba(255,140,0,0.3), rgba(255,80,0,0.2))',
            border: '1px solid rgba(255,140,0,0.6)',
            borderRadius: 12, color: '#fff',
            fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16,
            cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.25s',
            letterSpacing: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
          }}>
            {loading ? (
              <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />Submitting Petition...</>
            ) : (
              <>📋 SUBMIT PETITION</>
            )}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(150,120,60,0.5)', margin: 0, lineHeight: 1.6 }}>
            By submitting, you agree that all provided details are accurate. Email notifications will be sent to {email || 'your email'}.
          </p>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
