import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import DeckGL from '@deck.gl/react';
import { LineLayer, ScatterplotLayer } from '@deck.gl/layers';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import RoadModal from '../components/RoadModal';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Props { cityId: string; cityName: string; onBack: () => void; }

const HAZARD_EMOJIS: Record<string, string> = {
  Flood: '🌊', Earthquake: '🏚️', Cyclone: '🌪️', Landslide: '⛰️', Heatwave: '🔥', Industrial: '🏭'
};

function rciColor(rci: number, failProb: number): [number,number,number,number] {
  if (failProb > 0.75) return [255, 59, 107, 255];
  if (rci < 30)        return [255, 107,  53, 245];
  if (rci < 60)        return [255, 217,  61, 230];
  return [0, 255, 157, 215];
}

const SVC_COLORS: Record<string,[number,number,number]> = {
  hospital: [255, 55, 55], fire_station: [255, 145, 0], police: [60, 130, 255],
};

export default function MapView({ cityId, cityName, onBack }: Props) {
  const [geoData, setGeoData]         = useState<any>(null);
  const [analysis, setAnalysis]       = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [loadMsg, setLoadMsg]         = useState('Initializing city data...');
  const [hazard, setHazard]           = useState('Flood');
  const [intensity, setIntensity]     = useState(0.5);
  const [budget, setBudget]           = useState(5000000);
  const [simHistory, setSimHistory]   = useState<any[]>([]);
  const [toast, setToast]             = useState<{msg: string; type: 'info'|'success'|'warning'|'error'}>({msg:'', type:'info'});
  const [simRunning, setSim]          = useState(false);
  const [optimizing, setOpt]          = useState(false);
  const [selectedRoad, setSelectedRoad] = useState<any>(null);
  const [emergencySvcs, setEmergencySvcs] = useState<any[]>([]);
  const [activeEventIdx, setActiveEventIdx] = useState<number | null>(null);
  const [showServices, setShowServices] = useState(true);
  const [dashOffset, setDashOffset]   = useState(0);
  const animFrameRef = useRef<number>(0);
  const toastRef = useRef<any>(null);

  const [viewState, setViewState] = useState({
    longitude: 77.2090, latitude: 28.6139, zoom: 12.5, pitch: 52, bearing: -12,
  });

  // ── Animate dotted road dash offset ───────────────────────────────────────
  useEffect(() => {
    let frame = 0;
    const animate = () => {
      setDashOffset(prev => (prev + 0.5) % 60);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  // ── Continuous Satellite Updation ─────────────────────────────────────────
  const [satUpdate, setSatUpdate] = useState(0);
  useEffect(() => {
    const int = setInterval(() => setSatUpdate(prev => prev + 1), 3500);
    return () => clearInterval(int);
  }, []);

  const showToast = useCallback((msg: string, type: 'info'|'success'|'warning'|'error' = 'info') => {
    setToast({ msg, type });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast({msg:'', type:'info'}), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setLoadMsg(`Loading ${cityName} network...`);
    try {
      const geo = await axios.get(`${API}/city`);
      setGeoData(geo.data);
      const ana = await axios.get(`${API}/city/analysis`);
      setAnalysis(ana.data);
      if (ana.data.sim_history?.length) setSimHistory(ana.data.sim_history.map((s: any, i: number) => ({
        t: `T${i+1}`, GCC: s.gcc, Reach: s.reach, hazard: s.hazard, intensity: s.intensity,
      })));
      try {
        const svc = await axios.get(`${API}/city/emergency-services`);
        setEmergencySvcs(svc.data);
      } catch { /* non-critical */ }
      if (geo.data.features?.length) {
        const f = geo.data.features[Math.floor(geo.data.features.length / 2)];
        const [lon, lat] = f.geometry.coordinates[0];
        setViewState(v => ({ ...v, longitude: lon, latitude: lat, zoom: 12.5, transitionDuration: 1800 } as any));
      }
    } catch { showToast('⚠ Could not reach backend. Is the API server running?', 'error'); }
    setLoading(false);
  }, [cityName, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleSimulate = async () => {
    if (!geoData) return;
    setSim(true);
    setLoadMsg(`Simulating ${HAZARD_EMOJIS[hazard] || '⚡'} ${hazard} at ${(intensity * 100).toFixed(0)}% intensity...`);
    try {
      const r = await axios.post(`${API}/city/disaster`, { hazard, intensity });
      await load();
      const gcc   = r.data?.giant_component_pct  ?? Math.round(100 - intensity * 50);
      const reach = r.data?.reachability_pct      ?? Math.round(100 - intensity * 60);
      setSimHistory(h => [...h, { t: `T${h.length+1}`, GCC: gcc, Reach: reach, hazard, intensity }]);
      showToast(`✓ ${hazard} simulated — network at ${gcc}% capacity`, gcc > 70 ? 'success' : gcc > 40 ? 'warning' : 'error');
    } catch { showToast('⚠ Simulation failed — check backend logs.', 'error'); }
    setSim(false);
  };

  const handleOptimize = async () => {
    if (!geoData) return;
    setOpt(true);
    try {
      const r = await axios.post(`${API}/city/optimize`, { budget, hazard });
      await load();
      showToast(`✓ ${r.data.investments?.length ?? r.data.repaired_roads_count ?? 0} roads repaired — resilience → ${r.data.new_resilience_score}/100`, 'success');
    } catch { showToast('⚠ Optimization failed.', 'error'); }
    setOpt(false);
  };

  const handleEventClick = (idx: number, event: any) => {
    setActiveEventIdx(prev => prev === idx ? null : idx);
    if (geoData?.features?.length) {
      const f = geoData.features[Math.floor(geoData.features.length / 2)];
      const [lon, lat] = f.geometry.coordinates[0];
      setViewState((v: any) => ({ ...v, longitude: lon, latitude: lat, zoom: 13.2, pitch: 65, bearing: 25, transitionDuration: 1300 }));
    }
    showToast(`🗺 ${event.hazard} impact at ${(event.intensity * 100).toFixed(0)}% — roads highlighted`, 'info');
  };

  const edges = geoData?.features ?? [];
  const failingCount = useMemo(() => edges.filter((f: any) => (f.properties?.failure_probability ?? 0) > 0.7).length, [edges]);
  const avgRci  = analysis?.average_rci   ?? 0;
  const avgCrit = analysis?.average_criticality ?? 0;

  const getEdgeColor = useCallback((f: any): [number,number,number,number] => {
    if (activeEventIdx !== null) {
      const fp = f.properties?.failure_probability ?? 0;
      if (fp > 0.7) return [255, 30, 80, 255];
      if (fp > 0.4) return [255, 160, 30, 230];
      return [60, 60, 80, 50];
    }
    return rciColor(f.properties?.rci ?? 70, f.properties?.failure_probability ?? 0);
  }, [activeEventIdx]);

  const rciHist = useMemo(() => [0, 20, 40, 60, 80].map(b => ({
    range: `${b}–${b+20}`,
    count: edges.filter((f: any) => { const r = f.properties?.rci ?? 0; return r >= b && r < b + 20; }).length,
  })), [edges]);
  const simChart = simHistory.length ? simHistory : [{ t: 'Pre', GCC: 100, Reach: 100 }];

  // ── Generate Potholes (Memoized solely on edges to avoid repeating on interval) ──
  const potholes = useMemo(() => {
    if (!edges.length) return [];
    const pts: any[] = [];
    edges.forEach((f: any) => {
      if ((f.properties?.failure_probability ?? 0) > 0.4) {
        const sc = f.geometry?.coordinates;
        if (sc && sc.length >= 2) {
          for (let i=0; i < 2; i++) {
            const t = Math.random();
            const src = sc[0], tgt = sc[sc.length-1];
            pts.push({
              pos: [
                src[0] + (tgt[0]-src[0])*t + (Math.random()-0.5)*0.0003, 
                src[1] + (tgt[1]-src[1])*t + (Math.random()-0.5)*0.0003
              ],
              size: 1.5
            });
          }
        }
      }
    });
    return pts;
  }, [edges]);

  // ── Memoized Heavy Base Road Layers (Prevents re-filtering 35,000+ roads at 60 FPS!) ──
  const baseRoadLayers = useMemo(() => {
    if (!edges.length) return [];
    const selectedId = selectedRoad?.properties?.id;
    const unselectedRoads = edges.filter((f: any) => f.properties?.id !== selectedId);
    const criticalRoads = edges.filter((f: any) => (f.properties?.failure_probability ?? 0) > 0.7);

    return [
      // Glow behind all roads
      new LineLayer({
        id: 'glow',
        data: edges,
        getSourcePosition: (f: any) => f.geometry.coordinates[0],
        getTargetPosition: (f: any) => f.geometry.coordinates[1],
        getColor: (f: any) => { const c = getEdgeColor(f); return [c[0], c[1], c[2], 18]; },
        getWidth: 14, widthUnits: 'pixels', pickable: false,
        updateTriggers: { getColor: [activeEventIdx] },
      }),
      // Main road lines
      new LineLayer({
        id: 'roads',
        data: unselectedRoads,
        getSourcePosition: (f: any) => f.geometry.coordinates[0],
        getTargetPosition: (f: any) => f.geometry.coordinates[1],
        getColor: (f: any) => getEdgeColor(f),
        getWidth: (f: any) => {
          const lanes = f.properties?.lanes ?? 2;
          return Math.max(2, lanes * 0.8);
        },
        widthUnits: 'pixels', pickable: true,
        autoHighlight: true, highlightColor: [255, 255, 255, 180],
        onClick: (info: any) => { if (info.object) setSelectedRoad(info.object); },
        updateTriggers: { getColor: [activeEventIdx] },
      }),
      // Critical failure nodes
      new ScatterplotLayer({
        id: 'critical-nodes',
        data: criticalRoads,
        getPosition: (f: any) => f.geometry.coordinates[0],
        getRadius: 5, radiusUnits: 'pixels',
        getFillColor: [255, 59, 107, 230],
        pickable: false,
      }),
      // Potholes
      new ScatterplotLayer({
        id: 'potholes',
        data: potholes,
        getPosition: (d: any) => d.pos,
        getRadius: (d: any) => d.size,
        radiusUnits: 'pixels',
        getFillColor: [25, 20, 15, 255],
        getLineColor: [0, 0, 0, 150],
        stroked: true,
        pickable: false,
      }),
    ];
  }, [edges, selectedRoad?.properties?.id, activeEventIdx, potholes, getEdgeColor]);

  // ── DeckGL Combined Layers (Fast lightweight updates for selected road flow) ──
  const layers = useMemo(() => {
    if (!edges.length) return [];
    const combined: any[] = [...baseRoadLayers];

    // ── DOTTED ANIMATED SELECTED ROAD ───────────────────────────────────────
    if (selectedRoad) {
      const sc = selectedRoad.geometry?.coordinates;
      if (sc && sc.length >= 2) {
        // Outer glow halo
        combined.push(new LineLayer({
          id: 'selected-halo',
          data: [selectedRoad],
          getSourcePosition: (f: any) => f.geometry.coordinates[0],
          getTargetPosition: (f: any) => f.geometry.coordinates[f.geometry.coordinates.length - 1],
          getColor: [255, 255, 255, 30],
          getWidth: 28, widthUnits: 'pixels', pickable: false,
        }));
        // White base pulse
        combined.push(new LineLayer({
          id: 'selected-base',
          data: [selectedRoad],
          getSourcePosition: (f: any) => f.geometry.coordinates[0],
          getTargetPosition: (f: any) => f.geometry.coordinates[f.geometry.coordinates.length - 1],
          getColor: [255, 255, 255, 90],
          getWidth: 10, widthUnits: 'pixels', pickable: false,
        }));
        // Animated dashed overlay (only calculates 40 short segments)
        const src = sc[0];
        const tgt = sc[sc.length - 1];
        const segments = 40;
        const dashData = Array.from({ length: segments }).map((_, i) => {
          const dashFrac = (i + (dashOffset / 60)) / segments;
          const gapFrac  = (i + (dashOffset / 60) + 0.6) / segments;
          const s = [src[0] + (tgt[0]-src[0]) * (dashFrac % 1), src[1] + (tgt[1]-src[1]) * (dashFrac % 1)];
          const t = [src[0] + (tgt[0]-src[0]) * Math.min(1, gapFrac % 1 + 0.001), src[1] + (tgt[1]-src[1]) * Math.min(1, gapFrac % 1 + 0.001)];
          return { src: s, tgt: t };
        });

        combined.push(new LineLayer({
          id: 'selected-flow',
          data: dashData,
          getSourcePosition: (d: any) => d.src,
          getTargetPosition: (d: any) => d.tgt,
          getColor: (_: any, { index }: any) => {
            const glow = Math.floor(155 + 100 * Math.sin(dashOffset * 0.2 + index));
            return [0, 255, 157, glow];
          },
          getWidth: 6, widthUnits: 'pixels', pickable: false,
          updateTriggers: { getColor: [dashOffset], getSourcePosition: [dashOffset] },
        }));

        combined.push(new ScatterplotLayer({
          id: 'selected-endpoints',
          data: [{ pos: sc[0] }, { pos: sc[sc.length-1] }],
          getPosition: (d: any) => d.pos,
          getRadius: 8, radiusUnits: 'pixels',
          getFillColor: [0, 212, 255, 255],
          getLineColor: [255, 255, 255, 255],
          stroked: true, getLineWidth: 2, lineWidthUnits: 'pixels',
          pickable: false,
        } as any));
      }
    }

    // Emergency services
    if (showServices && emergencySvcs.length) {
      combined.push(new ScatterplotLayer({
        id: 'emergency-svcs',
        data: emergencySvcs,
        getPosition: (d: any) => [d.lon, d.lat],
        getRadius: 12, radiusUnits: 'pixels',
        getFillColor: (d: any) => SVC_COLORS[d.type] ?? [255, 255, 255],
        getLineColor: [255, 255, 255, 220],
        lineWidthUnits: 'pixels', getLineWidth: 2,
        stroked: true, pickable: false,
      } as any) as any);
      combined.push(new ScatterplotLayer({
        id: 'emergency-glow',
        data: emergencySvcs,
        getPosition: (d: any) => [d.lon, d.lat],
        getRadius: 26, radiusUnits: 'pixels',
        getFillColor: (d: any) => { const c = SVC_COLORS[d.type] ?? [255,255,255]; return [...c, 25] as any; },
        pickable: false,
      } as any) as any);
    }

    return combined;
  }, [baseRoadLayers, edges.length, selectedRoad, dashOffset, showServices, emergencySvcs]);

  // ── Intensity color helper ─────────────────────────────────────────────────
  const intensityColor = intensity >= 0.7 ? '#ff3b6b' : intensity >= 0.35 ? '#ffd93d' : '#00ff9d';
  const intensityLabel = intensity >= 0.7 ? 'HIGH' : intensity >= 0.35 ? 'MEDIUM' : 'LOW';

  return (
    <div style={{ position: 'relative', zIndex: 2, width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#030810' }}>

      {/* ── TOP NAV BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', gap: 16, zIndex: 10, background: 'rgba(4, 8, 18, 0.92)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(0,212,255,0.18)', flexShrink: 0, boxShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
        <button
          onClick={onBack}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(160,200,230,0.8)', padding: '6px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.2s', fontFamily: 'Space Grotesk' }}
        >◀ Cities</button>
        <div style={{ width: 1, height: 30, background: 'rgba(0,212,255,0.2)' }} />
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 17, background: 'linear-gradient(90deg, #00d4ff, #00ff9d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>RESILIO CITY</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(160,200,230,0.7)' }}>·</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{cityName}</div>
        <div style={{ flex: 1 }} />

        <button
          className={`${showServices ? '' : ''}`}
          onClick={() => setShowServices(s => !s)}
          style={{ background: showServices ? 'rgba(255,59,107,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${showServices ? 'rgba(255,59,107,0.4)' : 'rgba(255,255,255,0.12)'}`, color: showServices ? '#ff3b6b' : 'rgba(160,200,230,0.7)', padding: '6px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.2s' }}
        >🚨 {showServices ? 'Hide' : 'Show'} Services</button>

        {[
          { l: 'Roads',    v: edges.length || '–',                c: '#00d4ff' },
          { l: 'Avg RCI',  v: avgRci ? avgRci.toFixed(1) + '%':'–', c: avgRci>65?'#00ff9d':avgRci>45?'#ffd93d':'#ff3b6b' },
          { l: 'Critical', v: failingCount || '–',                c: failingCount > 0 ? '#ff3b6b' : '#00ff9d' },
          { l: 'Crit Idx', v: avgCrit ? avgCrit.toFixed(2):'–',   c: '#ffd93d' },
        ].map(s => (
          <div key={s.l} style={{ textAlign: 'center', minWidth: 66, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '4px 10px' }}>
            <div style={{ fontSize: 9, color: 'rgba(160,200,230,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 1 }}>{s.l}</div>
            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Space Grotesk', color: s.c, lineHeight: 1 }}>{s.v}</div>
          </div>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#00ff9d', fontWeight: 700, background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.2)', padding: '5px 11px', borderRadius: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00ff9d', boxShadow: '0 0 6px #00ff9d', animation: 'pulseGlow 2s infinite' }} />
          LIVE SAT-LINK {satUpdate % 2 === 0 ? '📡' : '🛰️'}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ─ LEFT CONTROLS ─ */}
        <div style={{ width: 256, zIndex: 10, display: 'flex', flexDirection: 'column', background: 'rgba(4,8,18,0.85)', backdropFilter: 'blur(24px)', borderRight: '1px solid rgba(0,212,255,0.14)', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,212,255,0.3) transparent' }}>

          {/* ⚡ Hazard Engine */}
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#00d4ff', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚡</span> Hazard Engine
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'rgba(160,200,230,0.6)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Hazard Type</label>
              <select
                value={hazard}
                onChange={e => setHazard(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,212,255,0.25)',
                  color: '#dceeff', borderRadius: 10, padding: '8px 12px', fontSize: 13,
                  fontFamily: 'Space Grotesk', fontWeight: 600, cursor: 'pointer', outline: 'none',
                }}
              >
                {['Flood','Earthquake','Cyclone','Landslide','Heatwave','Industrial'].map(h => (
                  <option key={h} value={h}>{HAZARD_EMOJIS[h]} {h}</option>
                ))}
              </select>
            </div>

            {/* Intensity Slider — premium styled */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'rgba(160,200,230,0.6)', fontWeight: 600 }}>Intensity</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: intensityColor, boxShadow: `0 0 8px ${intensityColor}` }} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: intensityColor, fontFamily: 'Space Grotesk' }}>{(intensity*100).toFixed(0)}%</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: intensityColor, background: `${intensityColor}20`, border: `1px solid ${intensityColor}40`, borderRadius: 6, padding: '1px 6px' }}>{intensityLabel}</span>
                </div>
              </div>
              <div style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ position: 'absolute', width: '100%', height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 6, pointerEvents: 'none' }}>
                  <div style={{ width: `${intensity * 100}%`, height: '100%', background: `linear-gradient(90deg, #00ff9d, ${intensityColor})`, borderRadius: 6, transition: 'width 0.1s', boxShadow: `0 0 8px ${intensityColor}` }} />
                </div>
                <input
                  type="range" min="0" max="1" step="0.01" value={intensity}
                  onChange={e => setIntensity(parseFloat(e.target.value))}
                  style={{ width: '100%', margin: 0, opacity: 0, cursor: 'pointer', position: 'relative', zIndex: 5, height: 24 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(160,200,230,0.35)', marginTop: 4 }}>
                <span>Low Risk</span><span>Catastrophic</span>
              </div>
            </div>

            <button
              onClick={handleSimulate}
              disabled={simRunning || !geoData || loading}
              style={{
                width: '100%', padding: '11px 0',
                background: simRunning ? 'rgba(255,59,107,0.2)' : 'linear-gradient(135deg, rgba(255,59,107,0.9) 0%, rgba(180,20,60,0.9) 100%)',
                border: '1px solid rgba(255,59,107,0.5)', color: '#fff',
                borderRadius: 12, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14,
                cursor: simRunning ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                boxShadow: simRunning ? 'none' : '0 4px 16px rgba(255,59,107,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {simRunning ? <><div className="spinner" style={{ borderTopColor: '#ff3b6b', width:14, height:14 }} /> Simulating...</> : `${HAZARD_EMOJIS[hazard]} Run Simulation`}
            </button>
          </div>

          {/* 💰 Budget Optimizer */}
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#00ff9d', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>💰</span> Budget Optimizer
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: 'rgba(160,200,230,0.6)', fontWeight: 600 }}>Repair Budget</label>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#00ff9d', fontFamily: 'Space Grotesk' }}>₹{(budget/1e6).toFixed(1)} Cr</span>
              </div>
              <div style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ position: 'absolute', width: '100%', height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 6, pointerEvents: 'none' }}>
                  <div style={{ width: `${((budget - 1000000) / 49000000) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #00ff9d, #00d4ff)', borderRadius: 6, boxShadow: '0 0 8px #00ff9d' }} />
                </div>
                <input
                  type="range" min="1000000" max="50000000" step="1000000" value={budget}
                  onChange={e => setBudget(Number(e.target.value))}
                  style={{ width: '100%', margin: 0, opacity: 0, cursor: 'pointer', position: 'relative', zIndex: 5, height: 24 }}
                />
              </div>
            </div>
            <button
              onClick={handleOptimize}
              disabled={optimizing || !geoData || loading}
              style={{
                width: '100%', padding: '11px 0',
                background: optimizing ? 'rgba(0,255,157,0.1)' : 'linear-gradient(135deg, rgba(0,200,120,0.85) 0%, rgba(0,130,80,0.85) 100%)',
                border: '1px solid rgba(0,255,157,0.4)', color: '#fff',
                borderRadius: 12, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14,
                cursor: optimizing ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                boxShadow: optimizing ? 'none' : '0 4px 16px rgba(0,200,120,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {optimizing ? <><div className="spinner" style={{ borderTopColor: '#00ff9d', width:14, height:14 }} /> Optimizing...</> : '🧠 Optimize Network'}
            </button>
          </div>

          {/* Emergency legend */}
          {showServices && (
            <div style={{ padding: '14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#ff3b6b', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>🚨 Emergency Services</div>
              {[
                { type: 'hospital',     icon: '🏥', label: 'Hospital / Ambulance', col: '#ff3232' },
                { type: 'fire_station', icon: '🚒', label: 'Fire Station',          col: '#ff8c00' },
                { type: 'police',       icon: '🚔', label: 'Police Station',        col: '#3c78ff' },
              ].map(s => (
                <div key={s.type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.col, boxShadow: `0 0 8px ${s.col}`, flexShrink: 0 }} />
                  <span style={{ color: 'rgba(160,200,230,0.75)', flex: 1 }}>{s.icon} {s.label}</span>
                  <span style={{ color: 'rgba(160,200,230,0.5)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {emergencySvcs.filter(sv => sv.type === s.type).length}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Road Legend */}
          <div style={{ padding: '14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(160,200,230,0.7)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>🗺 Road Condition Legend</div>
            {[
              { col: '#00ff9d', label: 'Excellent (RCI > 80)' },
              { col: '#ffd93d', label: 'Moderate (RCI 50–80)' },
              { col: '#ff7b35', label: 'Poor (RCI < 50)' },
              { col: '#ff3b6b', label: 'Critical Failure Risk' },
              { col: '#00d4ff', label: '● Selected Road' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7, fontSize: 12 }}>
                <div style={{ width: 26, height: 4, background: l.col, borderRadius: 2, boxShadow: `0 0 6px ${l.col}50`, flexShrink: 0 }} />
                <span style={{ color: 'rgba(160,200,230,0.65)' }}>{l.label}</span>
              </div>
            ))}
            <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(160,200,230,0.45)', lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
              💡 Click any road for 3D Inspector<br/>⚡ Bottom-right button opens AI Panel
            </div>
          </div>

          {/* Event Log */}
          <div style={{ padding: '14px', flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(160,200,230,0.7)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>📋 Simulation Log</div>
            {simHistory.length === 0 ? (
              <div style={{ fontSize: 12, color: 'rgba(160,200,230,0.4)', lineHeight: 1.7, padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.08)' }}>
                No simulations yet.<br/>Choose a hazard and run!
              </div>
            ) : [...simHistory].reverse().map((s, i) => {
              const realIdx = simHistory.length - 1 - i;
              const isActive = activeEventIdx === realIdx;
              const col = s.GCC > 70 ? '#00ff9d' : s.GCC > 40 ? '#ffd93d' : '#ff3b6b';
              return (
                <div key={i} onClick={() => handleEventClick(realIdx, s)} style={{
                  background: isActive ? `${col}12` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? col + '50' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 10, padding: '10px 12px', marginBottom: 8, fontSize: 12,
                  cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: isActive ? `0 0 16px ${col}20` : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#ff3b6b', fontWeight: 700 }}>{HAZARD_EMOJIS[s.hazard] || '⚡'} {s.hazard}</span>
                    <span style={{ color: 'rgba(160,200,230,0.5)', fontSize: 11 }}>{s.t}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <span>GCC: <b style={{ color: '#00d4ff' }}>{s.GCC}%</b></span>
                    <span>Reach: <b style={{ color: '#00ff9d' }}>{s.Reach}%</b></span>
                  </div>
                  <div style={{ marginTop: 5 }}>
                    <div style={{ fontSize: 10, color: 'rgba(160,200,230,0.4)', marginBottom: 3 }}>
                      Intensity: {(s.intensity * 100).toFixed(0)}%
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
                      <div style={{ width: `${s.GCC}%`, height: '100%', background: col, borderRadius: 4 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─ MAP CENTER ─ */}
        <div style={{ flex: 1, position: 'relative', background: '#070c16' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,8,18,0.92)', backdropFilter: 'blur(14px)' }}>
              <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3, marginBottom: 20 }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#00d4ff', marginBottom: 6, fontFamily: 'Space Grotesk' }}>{loadMsg}</div>
              <div style={{ fontSize: 12, color: 'rgba(160,200,230,0.5)' }}>{cityName} — Loading road network...</div>
            </div>
          )}

          {activeEventIdx !== null && (
            <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 15, background: 'rgba(255,59,107,0.15)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,59,107,0.4)', borderRadius: 12, padding: '8px 20px', fontSize: 13, color: '#ff3b6b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>⚡</span>
              <span>{simHistory[activeEventIdx]?.hazard} Impact — Roads colored by failure probability</span>
              <button onClick={() => setActiveEventIdx(null)} style={{ background: 'none', border: 'none', color: 'rgba(160,200,230,0.5)', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
          )}

          <DeckGL
            viewState={viewState}
            onViewStateChange={({ viewState: vs }: any) => setViewState(vs)}
            controller={true}
            layers={layers}
            style={{ width: '100%', height: '100%' }}
            parameters={{ clearColor: [7/255, 12/255, 22/255, 1] } as any}
            getCursor={({ isDragging, isHovering }: any) => isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'}
          />

          {geoData && !selectedRoad && (
            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(4,8,18,0.88)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 10, padding: '9px 20px', fontSize: 12, color: 'rgba(160,200,230,0.7)', backdropFilter: 'blur(10px)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              🖱️ Click any road to open 3D Inspector · ⚡ AI Command Center → bottom right
            </div>
          )}
        </div>

        {/* ─ RIGHT ANALYTICS ─ */}
        <div style={{ width: 270, zIndex: 10, display: 'flex', flexDirection: 'column', background: 'rgba(4,8,18,0.85)', backdropFilter: 'blur(24px)', borderLeft: '1px solid rgba(0,212,255,0.14)', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,212,255,0.3) transparent' }}>

          <div style={{ padding: '14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#00d4ff', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>📊 RCI Distribution</div>
            <div style={{ height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rciHist} margin={{ top: 4, right: 0, bottom: 0, left: -28 }}>
                  <defs>
                    <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                  <XAxis dataKey="range" stroke="rgba(160,200,230,0.25)" tick={{ fontSize: 8 }} />
                  <YAxis stroke="rgba(160,200,230,0.25)" tick={{ fontSize: 8 }} />
                  <Tooltip contentStyle={{ background:'rgba(4,8,18,0.95)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:8, fontSize:11 }} labelStyle={{ color:'#00d4ff' }} itemStyle={{ color:'#ddd' }} />
                  <Area type="monotone" dataKey="count" stroke="#00d4ff" strokeWidth={2} fill="url(#ag)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ padding: '14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#00d4ff', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>📈 Sim Timeline</div>
            <div style={{ height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simChart} margin={{ top: 4, right: 0, bottom: 0, left: -28 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                  <XAxis dataKey="t" stroke="rgba(160,200,230,0.25)" tick={{ fontSize: 8 }} />
                  <YAxis domain={[0, 100]} stroke="rgba(160,200,230,0.25)" tick={{ fontSize: 8 }} />
                  <Tooltip contentStyle={{ background:'rgba(4,8,18,0.95)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:8, fontSize:11 }} labelStyle={{ color:'#00d4ff' }} itemStyle={{ color:'#ddd' }} />
                  <Line type="monotone" dataKey="GCC"   stroke="#00d4ff" strokeWidth={2.5} dot={{ fill:'#00d4ff', r:3 }} name="GCC %" />
                  <Line type="monotone" dataKey="Reach" stroke="#00ff9d" strokeWidth={2.5} dot={{ fill:'#00ff9d', r:3 }} name="Reach %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
              {[['#00d4ff','Giant Component'], ['#00ff9d','Reachability']].map(([c, l]) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:9, color:'rgba(160,200,230,0.5)' }}>
                  <div style={{ width:14, height:3, background: c, borderRadius:1 }} /><span>{l}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '14px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#00d4ff', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>🌐 Network Health</div>
            {[
              { l: 'Excellent', v: edges.filter((f: any) => (f.properties?.rci ?? 0) > 80).length, col: '#00ff9d' },
              { l: 'Moderate',  v: edges.filter((f: any) => { const r = f.properties?.rci ?? 0; return r >= 50 && r <= 80; }).length, col: '#ffd93d' },
              { l: 'Poor',      v: edges.filter((f: any) => (f.properties?.rci ?? 0) < 50).length, col: '#ff7b35' },
              { l: 'Critical',  v: failingCount, col: '#ff3b6b' },
            ].map(row => (
              <div key={row.l} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: 'rgba(160,200,230,0.65)' }}>{row.l} Roads</span>
                  <span style={{ fontWeight: 800, color: row.col, fontFamily: 'Space Grotesk' }}>{row.v}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: edges.length ? `${(row.v / edges.length) * 100}%` : '0%', height: '100%', background: row.col, boxShadow: `0 0 8px ${row.col}60`, borderRadius: 6, transition: 'width 1s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROAD MODAL ── */}
      {selectedRoad && (
        <RoadModal road={selectedRoad} cityId={cityId} onClose={() => setSelectedRoad(null)} />
      )}


      {/* ── TOAST ── */}
      {toast.msg && (() => {
        const toastColors: Record<string, string> = {
          info: '#00d4ff', success: '#00ff9d', warning: '#ffd93d', error: '#ff3b6b'
        };
        const col = toastColors[toast.type] || '#00d4ff';
        return (
          <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: 'rgba(4,8,18,0.95)', backdropFilter: 'blur(20px)', border: `1px solid ${col}40`, borderLeft: `4px solid ${col}`, borderRadius: 12, padding: '11px 24px', fontSize: 13, color: col, fontWeight: 700, zIndex: 500, boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${col}15`, whiteSpace: 'nowrap', maxWidth: '80vw' }}>
            {toast.msg}
          </div>
        );
      })()}

      {/* ── LOADING OVERLAY ── */}
      {(simRunning || optimizing) && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(4,8,18,0.96)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(0,212,255,0.2)', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="spinner" style={{ borderTopColor: simRunning ? '#ff3b6b' : '#00ff9d' }} />
          <span style={{ fontSize: 14, color: simRunning ? '#ff3b6b' : '#00ff9d', fontWeight: 700 }}>{loadMsg}</span>
        </div>
      )}

      <style>{`
        @keyframes pulseGlow { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
