import { useState, useEffect, useRef } from 'react';
import bgSunsetCar from '../assets/bg_sunset_car.jpg';

interface Props {
  onVisitWebsite: () => void;
  onFilePetition: () => void;
}

export default function EntryPage({ onVisitWebsite, onFilePetition }: Props) {
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);

    // Ember particles floating upward
    const embers: Array<{ x: number; y: number; vx: number; vy: number; size: number; opacity: number; hue: number }> = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: window.innerHeight + Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -(0.5 + Math.random() * 1.5),
      size: 1 + Math.random() * 2.5,
      opacity: 0.3 + Math.random() * 0.7,
      hue: 20 + Math.random() * 40, // warm orange/amber
    }));

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      embers.forEach(e => {
        e.x += e.vx;
        e.y += e.vy;
        if (e.y < -10) { e.y = canvas.height + 10; e.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${e.hue}, 90%, 65%, ${e.opacity})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      backgroundImage: `url(${bgSunsetCar})`,
      backgroundSize: 'cover', backgroundPosition: 'center center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', fontFamily: "'Outfit', 'Space Grotesk', sans-serif"
    }}>
      {/* Balanced vignette gradient to make text readable while preserving the sunset artwork */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(180deg, rgba(4, 6, 16, 0.45) 0%, rgba(4, 6, 16, 0.15) 35%, rgba(4, 6, 16, 0.25) 70%, rgba(2, 3, 8, 0.8) 100%)',
      }} />

      {/* Ember canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }} />

      {/* Horizontal glow line at car level */}
      <div style={{
        position: 'absolute', bottom: '28%', left: 0, right: 0, height: 1, zIndex: 3,
        background: 'linear-gradient(90deg, transparent, rgba(255,140,0,0.3), rgba(255,80,0,0.4), rgba(255,140,0,0.3), transparent)',
        filter: 'blur(3px)',
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        
        {/* Top badge */}
        <div style={{
          opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(-20px)',
          transition: 'all 0.8s ease',
          background: 'rgba(255,120,0,0.1)', border: '1px solid rgba(255,120,0,0.3)',
          borderRadius: 30, padding: '6px 20px', fontSize: 11, fontWeight: 700,
          color: 'rgba(255,180,80,0.9)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 24
        }}>
          🚗 India's National Urban Digital Twin Platform
        </div>

        {/* Main Logo */}
        <div style={{
          opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(-30px)',
          transition: 'all 0.9s ease 0.1s',
          textAlign: 'center', marginBottom: 12
        }}>
          <div style={{
            fontWeight: 900, fontSize: 'clamp(52px, 8vw, 90px)',
            background: 'linear-gradient(135deg, #ff8c00 0%, #ffd700 30%, #fff5d0 50%, #ffd700 70%, #ff6400 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: 4, lineHeight: 1, textShadow: 'none',
            filter: 'drop-shadow(0 0 40px rgba(255,140,0,0.5))',
          }}>
            RESILIO CITY
          </div>
        </div>

        {/* Tagline */}
        <div style={{
          opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.9s ease 0.2s',
          fontSize: 'clamp(12px, 1.5vw, 16px)', color: 'rgba(200,170,120,0.85)',
          letterSpacing: 5, textTransform: 'uppercase', marginBottom: 60, fontWeight: 500
        }}>
          AI · Infrastructure Intelligence · Disaster Resilience
        </div>

        {/* Divider */}
        <div style={{
          opacity: mounted ? 1 : 0, transition: 'all 1s ease 0.3s',
          width: 280, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,140,0,0.6), transparent)',
          marginBottom: 48
        }} />

        {/* Buttons */}
        <div style={{
          opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.9s ease 0.4s',
          display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center'
        }}>
          {/* Visit Website Button */}
          <button
            onClick={onVisitWebsite}
            className="entry-btn-primary"
            style={{
              position: 'relative', overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(255,140,0,0.2), rgba(255,80,0,0.1))',
              border: '1px solid rgba(255,140,0,0.6)',
              borderRadius: 16, padding: '18px 44px',
              color: '#fff', fontFamily: 'Space Grotesk', fontWeight: 800,
              fontSize: 16, cursor: 'pointer', letterSpacing: 1,
              backdropFilter: 'blur(10px)',
              boxShadow: '0 0 30px rgba(255,140,0,0.2), inset 0 1px 0 rgba(255,200,100,0.2)',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              display: 'flex', alignItems: 'center', gap: 12
            }}
            onMouseEnter={e => {
              const t = e.currentTarget;
              t.style.transform = 'translateY(-4px) scale(1.03)';
              t.style.boxShadow = '0 12px 40px rgba(255,140,0,0.4), inset 0 1px 0 rgba(255,200,100,0.3)';
              t.style.borderColor = 'rgba(255,140,0,0.9)';
            }}
            onMouseLeave={e => {
              const t = e.currentTarget;
              t.style.transform = 'translateY(0) scale(1)';
              t.style.boxShadow = '0 0 30px rgba(255,140,0,0.2), inset 0 1px 0 rgba(255,200,100,0.2)';
              t.style.borderColor = 'rgba(255,140,0,0.6)';
            }}
          >
            <span style={{ fontSize: 22 }}>🏙️</span>
            <div>
              <div>VISIT WEBSITE</div>
              <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.7, marginTop: 2 }}>Explore city digital twins</div>
            </div>
          </button>

          {/* File Petition Button */}
          <button
            onClick={onFilePetition}
            className="entry-btn-secondary"
            style={{
              position: 'relative', overflow: 'hidden',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 16, padding: '18px 44px',
              color: 'rgba(220,200,170,0.9)', fontFamily: 'Space Grotesk', fontWeight: 800,
              fontSize: 16, cursor: 'pointer', letterSpacing: 1,
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              display: 'flex', alignItems: 'center', gap: 12
            }}
            onMouseEnter={e => {
              const t = e.currentTarget;
              t.style.transform = 'translateY(-4px) scale(1.03)';
              t.style.background = 'rgba(255,255,255,0.08)';
              t.style.borderColor = 'rgba(255,255,255,0.5)';
              t.style.boxShadow = '0 12px 40px rgba(0,0,0,0.5)';
            }}
            onMouseLeave={e => {
              const t = e.currentTarget;
              t.style.transform = 'translateY(0) scale(1)';
              t.style.background = 'rgba(255,255,255,0.04)';
              t.style.borderColor = 'rgba(255,255,255,0.25)';
              t.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)';
            }}
          >
            <span style={{ fontSize: 22 }}>📋</span>
            <div>
              <div>FILE A PETITION</div>
              <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.6, marginTop: 2 }}>Request your city to be added</div>
            </div>
          </button>
        </div>

        {/* Bottom stats */}
        <div style={{
          opacity: mounted ? 1 : 0, transition: 'all 1s ease 0.6s',
          display: 'flex', gap: 36, marginTop: 56, flexWrap: 'wrap', justifyContent: 'center'
        }}>
          {[
            { val: '50+', label: 'Cities Monitored' },
            { val: 'LIVE', label: 'OSM Data' },
            { val: 'AI', label: 'Powered Engine' },
            { val: '∞', label: 'Scalable' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'rgba(255,200,100,0.9)', lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'rgba(180,150,100,0.7)', marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom vignette */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, zIndex: 4,
        background: 'linear-gradient(0deg, rgba(2,3,8,0.9) 0%, transparent 100%)',
        pointerEvents: 'none'
      }} />
    </div>
  );
}
