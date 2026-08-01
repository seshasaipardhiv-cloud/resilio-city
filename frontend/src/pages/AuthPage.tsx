import { useState } from 'react';
import axios from 'axios';
import bgAuth from '../assets/bg_road.jpg';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Props {
  onSuccess: (token: string, user: any, role: 'user' | 'admin') => void;
  onBack: () => void;
}

type Tab = 'login' | 'register' | 'admin';

export default function AuthPage({ onSuccess, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPassConf, setRegPassConf] = useState('');

  // Admin fields
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/login`, { email: loginEmail, password: loginPass });
      if (data.success) {
        setSuccess('Login successful! Redirecting...');
        localStorage.setItem('resilio_token', data.token);
        localStorage.setItem('resilio_user', JSON.stringify(data.user));
        setTimeout(() => onSuccess(data.token, data.user, 'user'), 800);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Server error. Make sure backend is running.');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (regPass !== regPassConf) { setError('Passwords do not match'); return; }
    if (regPass.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/register`, { name: regName, email: regEmail, phone: regPhone, password: regPass });
      if (data.success) {
        setSuccess('Account created! Redirecting...');
        localStorage.setItem('resilio_token', data.token);
        const userPayload = { name: regName, email: regEmail, phone: regPhone };
        localStorage.setItem('resilio_user', JSON.stringify(userPayload));
        setTimeout(() => onSuccess(data.token, userPayload, 'user'), 800);
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Server error');
    } finally { setLoading(false); }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/admin/login`, { username: adminUser, password: adminPass });
      if (data.success) {
        setSuccess('Admin access granted!');
        localStorage.setItem('resilio_admin_token', data.token);
        setTimeout(() => onSuccess(data.token, { username: adminUser, role: 'admin' }, 'admin'), 600);
      } else {
        setError('Invalid admin credentials');
      }
    } catch (e: any) {
      setError('Invalid admin credentials');
    } finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(10,20,38,0.8)',
    border: '1px solid rgba(251,133,0,0.25)',
    borderRadius: 10, padding: '12px 16px',
    color: '#fff', fontFamily: 'Outfit, Space Grotesk', fontSize: 14,
    outline: 'none', transition: 'border 0.2s',
    boxSizing: 'border-box'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'rgba(255,200,150,0.7)', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 6
  };

  const btnStyle: React.CSSProperties = {
    width: '100%', padding: '14px',
    background: 'linear-gradient(135deg, rgba(251,133,0,0.3), rgba(33,158,188,0.2))',
    border: '1px solid rgba(251,133,0,0.6)',
    borderRadius: 12, color: '#fff',
    fontFamily: 'Outfit, Space Grotesk', fontWeight: 800, fontSize: 15,
    cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.25s',
    letterSpacing: 1, opacity: loading ? 0.7 : 1
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'login', label: 'Login', icon: '🔑' },
    { id: 'register', label: 'Register', icon: '✨' },
    { id: 'admin', label: 'Admin', icon: '🛡️' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      backgroundImage: `url(${bgAuth})`, backgroundSize: 'cover', backgroundPosition: 'center',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Outfit, Space Grotesk, sans-serif', padding: 20
    }}>
      {/* Dark overlay for readability */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 0 }} />
      

      {/* Card */}
      <div className="animate-pop glass-panel" style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 460,
        borderRadius: 24,
        overflow: 'hidden', backdropFilter: 'blur(20px)', background: 'rgba(10,15,25,0.65)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 30px 60px -15px rgba(0,0,0,0.8)'
      }}>
        {/* Header */}
        <div style={{
          padding: '28px 32px 20px',
          borderBottom: '1px solid rgba(251,133,0,0.1)',
          background: 'linear-gradient(135deg, rgba(251,133,0,0.06), rgba(33,158,188,0.03))'
        }}>
          <button onClick={onBack} style={{
            background: 'none', border: 'none', color: 'rgba(255,200,150,0.7)',
            cursor: 'pointer', fontSize: 13, fontFamily: 'Outfit, Space Grotesk',
            marginBottom: 16, padding: 0, display: 'flex', alignItems: 'center', gap: 6
          }}>← Back</button>
          <div style={{ fontWeight: 900, fontSize: 28, background: 'linear-gradient(90deg, #fb8500, #8ecae6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🏙️ RESILIO CITY
          </div>
          <div style={{ fontSize: 12, color: 'rgba(180,220,255,0.6)', letterSpacing: 2, marginTop: 4, textTransform: 'uppercase' }}>
            National Digital Twin Platform
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(251,133,0,0.1)' }}>
          {tabs.map(t => (
            <button
              key={t.id} onClick={() => { setTab(t.id); setError(''); setSuccess(''); }}
              style={{
                flex: 1, padding: '14px 8px', border: 'none', cursor: 'pointer',
                background: tab === t.id ? 'rgba(251,133,0,0.12)' : 'transparent',
                borderBottom: `2px solid ${tab === t.id ? '#fb8500' : 'transparent'}`,
                color: tab === t.id ? '#8ecae6' : 'rgba(180,220,255,0.5)',
                fontFamily: 'Outfit, Space Grotesk', fontWeight: 700, fontSize: 13,
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Form body */}
        <div style={{ padding: '28px 32px 32px' }}>
          {/* Error / Success */}
          {error && (
            <div style={{ background: 'rgba(255,59,107,0.1)', border: '1px solid rgba(255,59,107,0.35)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, color: '#ff6b8a', fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div style={{ background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, color: '#00ff9d', fontSize: 13 }}>
              ✅ {success}
            </div>
          )}

          {/* LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  placeholder="your@email.com" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(251,133,0,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(251,133,0,0.25)'}
                />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input type="password" required value={loginPass} onChange={e => setLoginPass(e.target.value)}
                  placeholder="••••••••" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(251,133,0,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(251,133,0,0.25)'}
                />
              </div>
              <button type="submit" disabled={loading} style={btnStyle}>
                {loading ? '⏳ Signing in...' : '→ SIGN IN'}
              </button>
              <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(180,220,255,0.5)', margin: 0 }}>
                Don't have an account?{' '}
                <span onClick={() => setTab('register')} style={{ color: '#ffb703', cursor: 'pointer', fontWeight: 700 }}>Register here</span>
              </p>
            </form>
          )}

          {/* REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input type="text" required value={regName} onChange={e => setRegName(e.target.value)}
                  placeholder="Your full name" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(251,133,0,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(251,133,0,0.25)'}
                />
              </div>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)}
                  placeholder="your@email.com" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(251,133,0,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(251,133,0,0.25)'}
                />
              </div>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(251,133,0,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(251,133,0,0.25)'}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input type="password" required value={regPass} onChange={e => setRegPass(e.target.value)}
                    placeholder="Min 6 chars" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'rgba(251,133,0,0.6)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(251,133,0,0.25)'}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Confirm</label>
                  <input type="password" required value={regPassConf} onChange={e => setRegPassConf(e.target.value)}
                    placeholder="Repeat" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'rgba(251,133,0,0.6)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(251,133,0,0.25)'}
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} style={btnStyle}>
                {loading ? '⏳ Creating account...' : '✨ CREATE ACCOUNT'}
              </button>
              <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(180,220,255,0.5)', margin: 0 }}>
                Already have an account?{' '}
                <span onClick={() => setTab('login')} style={{ color: '#ffb703', cursor: 'pointer', fontWeight: 700 }}>Sign in</span>
              </p>
            </form>
          )}

          {/* ADMIN */}
          {tab === 'admin' && (
            <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{
                background: 'rgba(251,133,0,0.06)', border: '1px solid rgba(251,133,0,0.2)',
                borderRadius: 10, padding: '12px 16px', fontSize: 12, color: 'rgba(255,200,150,0.7)'
              }}>
                🛡️ Administrative access is restricted. Unauthorized access attempts are logged.
              </div>
              <div>
                <label style={labelStyle}>Admin Username</label>
                <input type="text" required value={adminUser} onChange={e => setAdminUser(e.target.value)}
                  placeholder="Enter admin username" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(251,133,0,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(251,133,0,0.25)'}
                />
              </div>
              <div>
                <label style={labelStyle}>Admin Password</label>
                <input type="password" required value={adminPass} onChange={e => setAdminPass(e.target.value)}
                  placeholder="••••••••••" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(251,133,0,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(251,133,0,0.25)'}
                />
              </div>
              <button type="submit" disabled={loading} style={{ ...btnStyle, background: 'linear-gradient(135deg, rgba(33,158,188,0.3), rgba(200,0,0,0.2))', borderColor: 'rgba(33,158,188,0.6)' }}>
                {loading ? '⏳ Authenticating...' : '🛡️ ADMIN ACCESS'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
