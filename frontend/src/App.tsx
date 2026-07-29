import { useState, useEffect } from 'react';
import EntryPage from './pages/EntryPage';
import AuthPage from './pages/AuthPage';
import PetitionPage from './pages/PetitionPage';
import AdminDashboard from './pages/AdminDashboard';
import Landing from './pages/Landing';
import MapView from './pages/MapView';
import './index.css';

export type Page =
  | 'entry'
  | 'auth'
  | 'petition'
  | 'admin'
  | 'landing'
  | 'map';

interface AuthState {
  token: string;
  user: any;
  role: 'user' | 'admin';
}

export default function App() {
  const [page, setPage] = useState<Page>('entry');
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [activeCityId, setActiveCityId] = useState<string | null>(null);
  const [activeCityName, setActiveCityName] = useState<string>('');

  // Restore session on load
  useEffect(() => {
    const adminToken = localStorage.getItem('resilio_admin_token');
    const userToken = localStorage.getItem('resilio_token');
    const userStr = localStorage.getItem('resilio_user');

    if (adminToken) {
      setAuth({ token: adminToken, user: { username: 'Pardhiv', role: 'admin' }, role: 'admin' });
      // Don't auto-redirect to admin — stay on entry for clean UX
    } else if (userToken && userStr) {
      try {
        const user = JSON.parse(userStr);
        setAuth({ token: userToken, user, role: 'user' });
        // Don't auto-redirect — let them choose from entry
      } catch { /* ignore */ }
    }
  }, []);

  const handleAuthSuccess = (token: string, user: any, role: 'user' | 'admin') => {
    setAuth({ token, user, role });
    if (role === 'admin') {
      setPage('admin');
    } else {
      setPage('landing');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('resilio_token');
    localStorage.removeItem('resilio_user');
    localStorage.removeItem('resilio_admin_token');
    setAuth(null);
    setPage('entry');
  };

  const goToMap = (cityId: string, cityName: string) => {
    setActiveCityId(cityId);
    setActiveCityName(cityName);
    setPage('map');
  };

  // ─── Entry page: Visit Website → Auth → Landing, Petition → Petition form ──
  if (page === 'entry') {
    return (
      <>
        <div className="app-bg" />
        <div className="app-bg-reflection" />
        <div className="scanlines" />
        <EntryPage
          onVisitWebsite={() => {
            if (auth) {
              if (auth.role === 'admin') setPage('admin');
              else setPage('landing');
            } else {
              setPage('auth');
            }
          }}
          onFilePetition={() => setPage('petition')}
        />
      </>
    );
  }

  if (page === 'auth') {
    return (
      <>
        <div className="app-bg" />
        <div className="scanlines" />
        <AuthPage
          onSuccess={handleAuthSuccess}
          onBack={() => setPage('entry')}
        />
      </>
    );
  }

  if (page === 'petition') {
    return (
      <>
        <div className="app-bg" />
        <div className="scanlines" />
        <PetitionPage
          onBack={() => setPage('entry')}
          prefilledFromUser={auth?.role === 'user' ? auth.user : null}
        />
      </>
    );
  }

  if (page === 'admin' && auth?.role === 'admin') {
    return (
      <AdminDashboard
        token={auth.token}
        onLogout={handleLogout}
        onGoToCity={goToMap}
      />
    );
  }

  if (page === 'landing') {
    return (
      <>
        <div className="app-bg" />
        <div className="app-bg-reflection" />
        <div className="scanlines" />
        {/* User navbar */}
        {auth && (
          <div style={{
            position: 'fixed', top: 0, right: 0, zIndex: 999,
            padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(3,8,18,0.85)', backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(0,212,255,0.1)',
            borderLeft: '1px solid rgba(0,212,255,0.1)',
            borderBottomLeftRadius: 16
          }}>
            <span style={{ fontSize: 13, color: 'rgba(0,212,255,0.8)', fontFamily: 'Space Grotesk', fontWeight: 700 }}>
              👤 {auth.user?.name || auth.user?.email || 'User'}
            </span>
            <button
              onClick={() => setPage('petition')}
              style={{
                background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.4)',
                borderRadius: 8, padding: '6px 14px', color: '#ffa040',
                fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, cursor: 'pointer'
              }}
            >📋 File Petition</button>
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(255,59,107,0.08)', border: '1px solid rgba(255,59,107,0.3)',
                borderRadius: 8, padding: '6px 14px', color: '#ff6b8a',
                fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, cursor: 'pointer'
              }}
            >Logout</button>
          </div>
        )}
        <Landing onSelectCity={goToMap} />
      </>
    );
  }

  if (page === 'map' && activeCityId) {
    return (
      <>
        <div className="app-bg" />
        <div className="scanlines" />
        <MapView
          cityId={activeCityId}
          cityName={activeCityName}
          onBack={() => setPage('landing')}
        />
      </>
    );
  }

  // Fallback
  return (
    <>
      <div className="app-bg" />
      <div className="app-bg-reflection" />
      <div className="scanlines" />
      <EntryPage
        onVisitWebsite={() => setPage('auth')}
        onFilePetition={() => setPage('petition')}
      />
    </>
  );
}
