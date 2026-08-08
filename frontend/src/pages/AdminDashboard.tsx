import { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

interface Props {
  token: string;
  onLogout: () => void;
  onGoToCity: (cityId: string, cityName: string) => void;
}

interface Petition {
  id: string;
  user_name: string;
  user_email: string;
  user_phone: string;
  city_name: string;
  state: string;
  country: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  admin_comment?: string;
  created_at: string;
  resolved_at?: string;
  city_id?: string;
}

export default function AdminDashboard({ token, onLogout, onGoToCity }: Props) {
  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [actionPetition, setActionPetition] = useState<Petition | null>(null);
  const [actionType, setActionType] = useState<'accept' | 'reject' | null>(null);
  const [adminComment, setAdminComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [stats, setStats] = useState({ total: 0, pending: 0, accepted: 0, rejected: 0 });

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchPetitions = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/petitions`, authHeaders);
      if (data.success) {
        const all: Petition[] = data.petitions;
        setPetitions(all);
        setStats({
          total: all.length,
          pending: all.filter(p => p.status === 'pending').length,
          accepted: all.filter(p => p.status === 'accepted').length,
          rejected: all.filter(p => p.status === 'rejected').length,
        });
      }
    } catch (e) {
      console.error('Failed to load petitions');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchPetitions(); }, []);

  const handleAction = async () => {
    if (!actionPetition || !actionType) return;
    setActionLoading(true);
    setActionMsg('');
    try {
      const url = `${API}/petitions/${actionPetition.id}/${actionType}`;
      const { data } = await axios.post(url, { admin_comment: adminComment }, authHeaders);
      if (data.success) {
        setActionMsg(data.message);
        await fetchPetitions();
        setTimeout(() => { setActionPetition(null); setActionType(null); setAdminComment(''); setActionMsg(''); }, 2000);
      }
    } catch (e: any) {
      setActionMsg(e?.response?.data?.message || 'Action failed');
    } finally { setActionLoading(false); }
  };

  const filtered = petitions.filter(p => filter === 'all' || p.status === filter);

  const statusColor = (s: string) => s === 'accepted' ? '#00ff9d' : s === 'rejected' ? '#ff3b6b' : '#ffd700';
  const statusBg = (s: string) => s === 'accepted' ? 'rgba(0,255,157,0.1)' : s === 'rejected' ? 'rgba(255,59,107,0.1)' : 'rgba(255,215,0,0.1)';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
      background: 'linear-gradient(180deg, #020508 0%, #030812 100%)',
      fontFamily: 'Space Grotesk, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(2,5,12,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,140,0,0.2)',
        padding: '18px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontWeight: 900, fontSize: 22, background: 'linear-gradient(90deg, #ff8c00, #ffd700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: 2 }}>
            🏙️ RESILIO CITY
          </div>
          <div style={{ height: 24, width: 1, background: 'rgba(255,140,0,0.3)' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,200,100,0.8)', letterSpacing: 1 }}>🛡️ Admin Dashboard</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'rgba(200,160,80,0.6)' }}>Logged in as <span style={{ color: '#ffd700' }}>Pardhiv</span></div>
          <button onClick={onLogout} style={{
            background: 'rgba(255,59,107,0.1)', border: '1px solid rgba(255,59,107,0.3)',
            borderRadius: 10, padding: '8px 16px', color: '#ff6b8a',
            fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, cursor: 'pointer'
          }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: '32px 36px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total Petitions', val: stats.total, color: '#00d4ff', icon: '📋' },
            { label: 'Pending Review', val: stats.pending, color: '#ffd700', icon: '⏳' },
            { label: 'Accepted', val: stats.accepted, color: '#00ff9d', icon: '✅' },
            { label: 'Rejected', val: stats.rejected, color: '#ff3b6b', icon: '❌' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${s.color}25`,
              borderRadius: 16, padding: '20px 22px', position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${s.color}80, transparent)` }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(180,160,100,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>{s.label}</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: s.color }}>{s.val}</div>
                </div>
                <div style={{ fontSize: 28, opacity: 0.8 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['all', 'pending', 'accepted', 'rejected'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '8px 20px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: filter === f ? 'rgba(255,140,0,0.2)' : 'rgba(255,255,255,0.04)',
              color: filter === f ? '#ffd700' : 'rgba(180,150,80,0.5)',
              fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13,
              borderLeft: filter === f ? '2px solid #ff8c00' : '2px solid transparent',
              transition: 'all 0.2s', textTransform: 'capitalize'
            }}>
              {f === 'all' ? '📋' : f === 'pending' ? '⏳' : f === 'accepted' ? '✅' : '❌'} {f}
            </button>
          ))}
        </div>

        {/* Petitions list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(180,150,80,0.5)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            Loading petitions...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(180,150,80,0.4)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>No {filter !== 'all' ? filter : ''} petitions found</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Petitions filed by users will appear here</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filtered.map(p => (
              <div key={p.id} style={{
                background: 'rgba(10,16,30,0.8)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 18, overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                transition: 'border 0.2s'
              }}>
                {/* Status bar */}
                <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${statusColor(p.status)}, transparent)` }} />
                
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      {/* City name + status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                        <div style={{ fontWeight: 900, fontSize: 20, color: '#ffd700' }}>
                          🗺️ {p.city_name}
                        </div>
                        {p.state && <div style={{ fontSize: 13, color: 'rgba(180,150,80,0.6)' }}>{p.state}, {p.country}</div>}
                        <div style={{
                          background: statusBg(p.status), border: `1px solid ${statusColor(p.status)}50`,
                          borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 800,
                          color: statusColor(p.status), textTransform: 'uppercase', letterSpacing: 1
                        }}>
                          {p.status === 'pending' ? '⏳' : p.status === 'accepted' ? '✅' : '❌'} {p.status}
                        </div>
                      </div>

                      {/* User info */}
                      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: 'rgba(180,160,100,0.7)', marginBottom: 10 }}>
                        <span>👤 <strong style={{ color: '#ffa040' }}>{p.user_name}</strong></span>
                        <span>📧 {p.user_email}</span>
                        {p.user_phone && <span>📱 {p.user_phone}</span>}
                      </div>

                      {/* Reason */}
                      <div style={{ fontSize: 13, color: 'rgba(200,180,120,0.8)', background: 'rgba(255,140,0,0.05)', border: '1px solid rgba(255,140,0,0.1)', borderRadius: 8, padding: '10px 14px', marginBottom: 10, lineHeight: 1.5 }}>
                        <strong>Reason:</strong> {p.reason}
                      </div>

                      {p.admin_comment && (
                        <div style={{ fontSize: 12, color: 'rgba(180,200,180,0.7)', background: 'rgba(0,255,157,0.04)', border: '1px solid rgba(0,255,157,0.1)', borderRadius: 8, padding: '8px 12px' }}>
                          <strong>Admin Note:</strong> {p.admin_comment}
                        </div>
                      )}

                      <div style={{ fontSize: 11, color: 'rgba(150,130,80,0.4)', marginTop: 8 }}>
                        Submitted: {new Date(p.created_at).toLocaleString()}
                        {p.resolved_at && <> · Resolved: {new Date(p.resolved_at).toLocaleString()}</>}
                      </div>
                    </div>

                    {/* Action buttons */}
                    {p.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => { setActionPetition(p); setActionType('accept'); setAdminComment(''); }}
                          style={{
                            background: 'rgba(0,255,157,0.1)', border: '1px solid rgba(0,255,157,0.4)',
                            borderRadius: 10, padding: '10px 20px', color: '#00ff9d',
                            fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,157,0.2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,255,157,0.1)'}
                        >
                          ✅ Accept
                        </button>
                        <button
                          onClick={() => { setActionPetition(p); setActionType('reject'); setAdminComment(''); }}
                          style={{
                            background: 'rgba(255,59,107,0.1)', border: '1px solid rgba(255,59,107,0.4)',
                            borderRadius: 10, padding: '10px 20px', color: '#ff6b8a',
                            fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,59,107,0.2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,59,107,0.1)'}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    )}
                    {p.status === 'accepted' && p.city_id && (
                      <button
                        onClick={() => onGoToCity(p.city_id!, p.city_name)}
                        style={{
                          background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.4)',
                          borderRadius: 10, padding: '10px 20px', color: '#00d4ff',
                          fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, cursor: 'pointer'
                        }}
                      >
                        🗺️ View City
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {actionPetition && actionType && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: 'rgba(8,12,22,0.99)', border: `1px solid ${actionType === 'accept' ? 'rgba(0,255,157,0.4)' : 'rgba(255,59,107,0.4)'}`,
            borderRadius: 20, padding: '36px', maxWidth: 480, width: '100%',
            boxShadow: `0 0 60px ${actionType === 'accept' ? 'rgba(0,255,100,0.1)' : 'rgba(255,59,107,0.1)'}`
          }}>
            <div style={{ fontWeight: 900, fontSize: 22, color: actionType === 'accept' ? '#00ff9d' : '#ff6b8a', marginBottom: 8 }}>
              {actionType === 'accept' ? '✅ Accept Petition' : '❌ Reject Petition'}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(180,160,100,0.7)', marginBottom: 20 }}>
              {actionType === 'accept'
                ? `Accepting will add "${actionPetition.city_name}" to the platform and notify ${actionPetition.user_email}.`
                : `Rejecting will notify ${actionPetition.user_email} that this petition was not approved.`}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(180,150,80,0.7)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Admin Comment (Optional)
              </label>
              <textarea
                value={adminComment} onChange={e => setAdminComment(e.target.value)}
                rows={3} placeholder="Add a note to the user..."
                style={{
                  width: '100%', background: 'rgba(10,20,38,0.8)',
                  border: '1px solid rgba(255,140,0,0.25)', borderRadius: 10,
                  padding: '10px 14px', color: '#fff', fontFamily: 'Space Grotesk',
                  fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box'
                }}
              />
            </div>

            {actionMsg && (
              <div style={{ background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.2)', borderRadius: 10, padding: '10px 14px', color: '#00ff9d', fontSize: 13, marginBottom: 16 }}>
                ✅ {actionMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleAction}
                disabled={actionLoading}
                style={{
                  flex: 1, padding: '14px',
                  background: actionType === 'accept' ? 'rgba(0,255,157,0.15)' : 'rgba(255,59,107,0.15)',
                  border: `1px solid ${actionType === 'accept' ? 'rgba(0,255,157,0.5)' : 'rgba(255,59,107,0.5)'}`,
                  borderRadius: 12, color: actionType === 'accept' ? '#00ff9d' : '#ff6b8a',
                  fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15, cursor: actionLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {actionLoading ? '⏳ Processing...' : actionType === 'accept' ? '✅ Confirm Accept' : '❌ Confirm Reject'}
              </button>
              <button
                onClick={() => { setActionPetition(null); setActionType(null); setAdminComment(''); setActionMsg(''); }}
                style={{
                  padding: '14px 24px', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12,
                  color: 'rgba(200,200,200,0.7)', fontFamily: 'Space Grotesk', fontWeight: 700, cursor: 'pointer'
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
