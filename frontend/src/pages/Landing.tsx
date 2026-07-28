import { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import bgRoad from '../assets/bg_road.jpg';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface CityCard {
  id: string; name: string; subtitle: string; emoji: string; theme: string;
  total_roads: number; avg_rci: number; critical_roads: number;
  population_covered: number; last_survey: string;
  pending_repairs: number; budget_utilized_pct: number;
}
interface Props { onSelectCity: (cityId: string, cityName: string) => void; }

function RciBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, boxShadow: `0 0 8px ${color}60`, borderRadius: 4, transition: 'width 1.2s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 34, textAlign: 'right', fontFamily: 'Space Grotesk' }}>{pct}%</span>
    </div>
  );
}
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);

    type Particle = { x: number; y: number; speed: number; opacity: number; size: number; color: string; };
    const colors = ['#00d4ff', '#00ff9d', '#bd93f9', '#ff79c6', '#ffd93d'];
    const particles: Particle[] = Array.from({ length: 80 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      speed: 0.2 + Math.random() * 0.6,
      opacity: 0.1 + Math.random() * 0.5,
      size: 1 + Math.random() * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    // Road grid dots (matrix-style)
    type GridDot = { x: number; y: number; lit: boolean; litTime: number; color: string };
    const gridDots: GridDot[] = [];
    const gapX = 60, gapY = 60;
    for (let gx = 0; gx < window.innerWidth; gx += gapX) {
      for (let gy = 0; gy < window.innerHeight; gy += gapY) {
        gridDots.push({ x: gx + Math.random() * 20 - 10, y: gy + Math.random() * 20 - 10, lit: Math.random() > 0.85, litTime: Math.random() * 3000, color: colors[Math.floor(Math.random() * colors.length)] });
      }
    }

    let frame = 0;
    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = performance.now();

      // Grid dots
      gridDots.forEach(dot => {
        if (now - dot.litTime > 3000) { dot.lit = Math.random() > 0.7; dot.litTime = now; if (dot.lit) dot.color = colors[Math.floor(Math.random() * colors.length)]; }
        if (dot.lit) {
          ctx.beginPath(); ctx.arc(dot.x, dot.y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = dot.color; ctx.globalAlpha = 0.25; ctx.fill();
          ctx.globalAlpha = 1;
        }
      });

      // Floating particles drifting upwards
      particles.forEach(p => {
        p.y -= p.speed;
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.globalAlpha = p.opacity * (0.5 + 0.5 * Math.sin(now / 1500 + p.x));
        ctx.fill(); ctx.globalAlpha = 1;
      });

      // Horizontal scan lines (moving)
      const lineY = (now / 6000 * canvas.height) % canvas.height;
      ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(canvas.width, lineY);
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.04)'; ctx.lineWidth = 1; ctx.stroke();

      frame = requestAnimationFrame(draw);
      animId = frame;
    };
    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

const DEFAULT_CITY_NETWORKS: CityCard[] = [
  { id: "techno_hyderabad", name: "Techno Hyderabad", theme: "#ce93d8", subtitle: "City of Pearls Grid", emoji: "🏙️", total_roads: 1046, avg_rci: 64.3, critical_roads: 30, population_covered: 4249485, last_survey: "2024-01-21", pending_repairs: 31, budget_utilized_pct: 42 },
  { id: "nova_delhi", name: "Nova Delhi", theme: "#4fc3f7", subtitle: "National Capital Grid", emoji: "🏛️", total_roads: 1045, avg_rci: 69.8, critical_roads: 30, population_covered: 1449378, last_survey: "2024-01-21", pending_repairs: 50, budget_utilized_pct: 41 },
  { id: "coastal_mumbai", name: "Coastal Mumbai", theme: "#f48fb1", subtitle: "Financial Capital Hub", emoji: "🌉", total_roads: 1000, avg_rci: 74.6, critical_roads: 21, population_covered: 2120306, last_survey: "2024-08-16", pending_repairs: 67, budget_utilized_pct: 84.7 },
  { id: "heritage_jaipur", name: "Heritage Jaipur", theme: "#ffb74d", subtitle: "Pink City Network", emoji: "🏰", total_roads: 1093, avg_rci: 74.5, critical_roads: 39, population_covered: 2546591, last_survey: "2024-04-27", pending_repairs: 67, budget_utilized_pct: 63 },
  { id: "cyber_bangalore", name: "Cyber Bangalore", theme: "#69f0ae", subtitle: "Silicon Valley of India", emoji: "💻", total_roads: 969, avg_rci: 60.4, critical_roads: 15, population_covered: 1521945, last_survey: "2024-06-12", pending_repairs: 16, budget_utilized_pct: 72.8 }
];

export default function Landing({ onSelectCity }: Props) {
  const [cities, setCities]             = useState<CityCard[]>(DEFAULT_CITY_NETWORKS);
  const [loading, setLoading]           = useState(false);
  const [loadingCity, setLoadingCity]   = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError]               = useState('');
  const [hoveredCity, setHoveredCity]   = useState<string | null>(null);

  useEffect(() => {
    axios.get(`${API}/cities`)
      .then(r => { if (Array.isArray(r.data) && r.data.length > 0) setCities(r.data); })
      .catch(() => { /* Maintain production fallback registry seamlessly without blocking UI */ });
  }, []);

  const handleSelect = async (city: CityCard) => {
    setLoadingCity(city.id);
    setLoadingStage('Loading city digital twin...');
    try {
      await axios.get(`${API}/cities/${city.id}/load`, { timeout: 4000 }).catch(() => null);
    } finally {
      onSelectCity(city.id, city.name);
    }
  };

  const rciColor = (rci: number) => rci >= 75 ? '#00ff9d' : rci >= 50 ? '#ffd93d' : '#ff3b6b';
  const healthBadge = (rci: number) => rci >= 75 ? ['GOOD', '#00ff9d'] : rci >= 50 ? ['FAIR', '#ffd93d'] : ['CRITICAL', '#ff3b6b'];

  const totalRoads   = cities.reduce((a, c) => a + c.total_roads, 0);
  const totalCrit    = cities.reduce((a, c) => a + c.critical_roads, 0);
  const totalPop     = cities.reduce((a, c) => a + c.population_covered, 0);
  const avgRci       = cities.length ? cities.reduce((a, c) => a + c.avg_rci, 0) / cities.length : 0;
  const loadingCityObj = cities.find(c => c.id === loadingCity);

  return (
    <div style={{
      position: 'relative', zIndex: 2, width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      backgroundImage: `url(${bgRoad})`,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>
      {/* Dark overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'linear-gradient(180deg, rgba(3,6,16,0.85) 0%, rgba(5,10,22,0.85) 40%, rgba(3,6,16,0.95) 100%)',
      }} />

      {/* ── CITY LOADING OVERLAY ── */}
      {loadingCity && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(2,5,14,0.96)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
          <div style={{ textAlign: 'center', position: 'relative' }}>
            {/* Rotating rings */}
            <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 24px' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${loadingCityObj?.theme ?? '#00d4ff'}30`, animation: 'spin 2s linear infinite' }} />
              <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', border: `2px solid ${loadingCityObj?.theme ?? '#00d4ff'}60`, animation: 'spin 1.5s linear infinite reverse' }} />
              <div style={{ position: 'absolute', inset: '50%', transform: 'translate(-50%,-50%)', fontSize: 48, lineHeight: 1 }}>{loadingCityObj?.emoji ?? '🏙️'}</div>
            </div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 28, color: loadingCityObj?.theme ?? '#00d4ff', marginBottom: 8, letterSpacing: 2 }}>
              {loadingCityObj?.name ?? 'Loading...'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(160,200,230,0.5)', marginBottom: 28, letterSpacing: 1 }}>{loadingCityObj?.subtitle}</div>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(0,212,255,0.8)', fontFamily: 'Space Grotesk', fontWeight: 700, marginBottom: 18, letterSpacing: 1 }}>{loadingStage}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {['Engine', 'Roads', 'Analysis', 'Render'].map(s => {
              const stages = ['engine', 'road', 'analys', 'render'];
              const active = loadingStage.toLowerCase().includes(stages[['Engine','Roads','Analysis','Render'].indexOf(s)]);
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: active ? (loadingCityObj?.theme ?? '#00d4ff') : 'rgba(160,200,230,0.2)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? (loadingCityObj?.theme ?? '#00d4ff') : 'rgba(160,200,230,0.15)', boxShadow: active ? `0 0 10px ${loadingCityObj?.theme ?? '#00d4ff'}` : 'none', transition: 'all 0.3s' }} />
                  {s}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CONTENT ── */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* ── HEADER ── */}
        <div style={{ padding: '20px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,212,255,0.1)', background: 'rgba(3,8,18,0.7)', backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,100,200,0.2))', border: '1px solid rgba(0,212,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 0 20px rgba(0,212,255,0.2)' }}>🏙️</div>
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, background: 'linear-gradient(90deg, #00d4ff 0%, #00ff9d 60%, #bd93f9 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: 2 }}>RESILIO CITY</div>
              <div style={{ fontSize: 10, color: 'rgba(0,212,255,0.5)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 2 }}>AI Infrastructure Resilience Platform</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#00ff9d', fontWeight: 700, background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.2)', padding: '6px 14px', borderRadius: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff9d', boxShadow: '0 0 8px #00ff9d', animation: 'pulse 2s infinite' }} />
              SYSTEM ONLINE
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['⚡', 'MCP Server', '#ffd93d'], ['🛰️', 'DeckGL', '#00d4ff'], ['🧠', 'AI Engine', '#bd93f9']].map(([ic, lb, col]) => (
                <div key={lb} style={{ fontSize: 11, color: col as string, background: `${col as string}10`, border: `1px solid ${col as string}30`, borderRadius: 8, padding: '4px 10px', fontWeight: 700 }}>{ic} {lb}</div>
              ))}
            </div>
          </div>
        </div>

        {/* ── GLOBAL STATS BAR ── */}
        <div style={{ padding: '16px 36px', display: 'flex', gap: 14, borderBottom: '1px solid rgba(0,212,255,0.08)' }}>
          {[
            { label: 'Total Roads Monitored', val: totalRoads.toLocaleString(), color: '#00d4ff', icon: '🛣️', sub: 'Across all networks' },
            { label: 'Avg Network RCI',       val: avgRci.toFixed(1) + '%',      color: rciColor(avgRci), icon: '📊', sub: avgRci >= 65 ? 'Healthy Network' : 'Needs Attention' },
            { label: 'Critical Alerts',       val: totalCrit,                    color: '#ff3b6b', icon: '🚨', sub: 'High-risk segments' },
            { label: 'Population Covered',    val: (totalPop / 1e6).toFixed(1) + 'M', color: '#bd93f9', icon: '👥', sub: 'Citizens monitored' },
            { label: 'Cities Monitored',      val: cities.length,                color: '#ffd93d', icon: '📍', sub: 'Live networks' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 18px', position: 'relative', overflow: 'hidden', transition: 'all 0.2s' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${s.color}60, transparent)` }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(160,200,230,0.45)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: 'Space Grotesk', lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: 'rgba(160,200,230,0.4)', marginTop: 4 }}>{s.sub}</div>
                </div>
                <div style={{ fontSize: 22, opacity: 0.7 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── TITLE ROW ── */}
        <div style={{ padding: '18px 36px 12px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(160,200,230,0.5)', textTransform: 'uppercase', letterSpacing: 2 }}>Select City Network</div>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(0,212,255,0.2), transparent)' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#00d4ff', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', padding: '4px 12px', borderRadius: 20 }}>
            {cities.length} Networks Available
          </div>
        </div>

        {/* ── CITY CARDS ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 36px 24px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, alignContent: 'start', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,212,255,0.3) transparent' }}>
          {loading ? (
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, color: 'rgba(160,200,230,0.5)', padding: 80 }}>
              <div className="spinner" /><span>Loading city networks...</span>
            </div>
          ) : error ? (
            <div style={{ gridColumn: '1/-1', padding: '50px', textAlign: 'center' }}>
              <div style={{ fontSize: 42, marginBottom: 14 }}>⚠️</div>
              <div style={{ fontWeight: 700, color: '#ff3b6b', marginBottom: 10, fontSize: 16 }}>{error}</div>
              <div style={{ fontSize: 12, color: 'rgba(160,200,230,0.5)' }}>Run: <code style={{ color: '#00d4ff', background: 'rgba(0,212,255,0.1)', padding: '2px 8px', borderRadius: 4 }}>npm start</code> in the backend-ts folder</div>
            </div>
          ) : cities.map(city => {
            const [healthText, healthColor] = healthBadge(city.avg_rci);
            const isLoading = loadingCity === city.id;
            const isHovered = hoveredCity === city.id;
            return (
              <div
                key={city.id}
                onClick={() => !loadingCity && handleSelect(city)}
                onMouseEnter={() => setHoveredCity(city.id)}
                onMouseLeave={() => setHoveredCity(null)}
                style={{
                  background: isLoading
                    ? `radial-gradient(ellipse at top, ${city.theme}15 0%, rgba(4,8,18,0.9) 70%)`
                    : isHovered
                    ? `radial-gradient(ellipse at top, ${city.theme}10 0%, rgba(255,255,255,0.04) 70%)`
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isLoading ? city.theme + '60' : isHovered ? city.theme + '40' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 18, padding: '20px', cursor: loadingCity ? 'default' : 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.34,1.2,0.64,1)',
                  transform: isLoading ? 'translateY(-6px) scale(1.02)' : isHovered ? 'translateY(-4px)' : 'translateY(0)',
                  boxShadow: isLoading ? `0 20px 60px ${city.theme}25, 0 0 0 1px ${city.theme}30` : isHovered ? `0 12px 40px rgba(0,0,0,0.5), 0 0 30px ${city.theme}15` : '0 4px 20px rgba(0,0,0,0.3)',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {/* Top accent line */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${city.theme}, transparent)`, opacity: isHovered || isLoading ? 1 : 0, transition: 'opacity 0.3s' }} />

                {/* Card header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 30, marginBottom: 8, filter: isHovered ? 'drop-shadow(0 0 8px rgba(255,255,255,0.5))' : 'none', transition: 'filter 0.3s' }}>{city.emoji}</div>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: city.theme, marginBottom: 4 }}>{city.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(160,200,230,0.45)' }}>{city.subtitle}</div>
                  </div>
                  <div style={{ background: `${healthColor as string}15`, border: `1px solid ${healthColor as string}40`, color: healthColor as string, borderRadius: 8, padding: '3px 10px', fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>{healthText}</div>
                </div>

                {/* RCI bar */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 10 }}>
                    <span style={{ color: 'rgba(160,200,230,0.5)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>Avg RCI Score</span>
                  </div>
                  <RciBar pct={city.avg_rci} color={rciColor(city.avg_rci)} />
                </div>

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 14 }}>
                  {[
                    { l: 'Roads',    v: city.total_roads.toLocaleString(), c: '#00d4ff' },
                    { l: 'Critical', v: city.critical_roads, c: city.critical_roads > 30 ? '#ff3b6b' : '#ffd93d' },
                    { l: 'Pending',  v: city.pending_repairs, c: 'rgba(160,200,230,0.7)' },
                    { l: 'Budget',   v: `${city.budget_utilized_pct}%`, c: '#00ff9d' },
                  ].map(item => (
                    <div key={item.l} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: 9, color: 'rgba(160,200,230,0.4)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>{item.l}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'Space Grotesk', color: item.c }}>{item.v}</div>
                    </div>
                  ))}
                </div>

                {/* Budget utilization */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${city.budget_utilized_pct}%`, height: '100%', background: `linear-gradient(90deg, ${city.theme}, ${city.theme}66)`, borderRadius: 4, boxShadow: `0 0 8px ${city.theme}60` }} />
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(160,200,230,0.35)', marginTop: 4 }}>Budget utilized: {city.budget_utilized_pct}%</div>
                </div>

                {/* Last survey */}
                <div style={{ fontSize: 10, color: 'rgba(160,200,230,0.3)', marginBottom: 14 }}>
                  Last Survey: <span style={{ color: 'rgba(160,200,230,0.6)', fontFamily: 'monospace' }}>{city.last_survey}</span>
                </div>

                {/* Enter button */}
                <button
                  onClick={e => { e.stopPropagation(); if (!loadingCity) handleSelect(city); }}
                  disabled={!!loadingCity}
                  style={{
                    width: '100%', padding: '11px 0',
                    background: isLoading ? `${city.theme}20` : `linear-gradient(135deg, ${city.theme}22 0%, ${city.theme}10 100%)`,
                    border: `1px solid ${city.theme}${isHovered || isLoading ? '80' : '40'}`,
                    color: city.theme, borderRadius: 11, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13,
                    cursor: loadingCity ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: isHovered && !loadingCity ? `0 0 20px ${city.theme}20` : 'none',
                  }}
                >
                  {isLoading
                    ? <><div className="spinner" style={{ borderTopColor: city.theme, width: 14, height: 14 }} /> Loading...</>
                    : `▶ Enter ${city.name}`
                  }
                </button>
              </div>
            );
          })}
        </div>

        {/* ── FOOTER ── */}
        <div style={{ padding: '12px 36px', borderTop: '1px solid rgba(0,212,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(3,8,18,0.7)', backdropFilter: 'blur(20px)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'rgba(160,200,230,0.35)', letterSpacing: 0.5 }}>
            RESILIO CITY v3.0 (GOATED) · AI-Powered Infrastructure Resilience & Disaster Planning
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
            {[['🟢', 'API Online', '#00ff9d'], ['📡', 'DeckGL Active', '#00d4ff'], ['⚡', 'MCP Ready', '#ffd93d'], ['🧠', 'AI Engine', '#bd93f9']].map(([ic, lb, col]) => (
              <span key={lb} style={{ color: col as string }}>{ic} {lb}</span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
