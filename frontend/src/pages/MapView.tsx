import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import DeckGL from '@deck.gl/react';
import { LineLayer, ScatterplotLayer } from '@deck.gl/layers';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import RoadModal from '../components/RoadModal';

const API = 'http://localhost:8000';

interface Props {
  cityId: string;
  cityName: string;
  onBack: () => void;
}

function rciColor(rci: number, failProb: number): [number, number, number, number] {
  if (failProb > 0.75) return [255, 59, 107, 240];
  if (rci < 30)        return [255, 107, 53, 230];
  if (rci < 60)        return [255, 217, 61, 220];
  return [0, 255, 157, 210];
}

export default function MapView({ cityId, cityName, onBack }: Props) {
  const [geoData, setGeoData]       = useState<any>(null);
  const [analysis, setAnalysis]     = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [loadMsg, setLoadMsg]       = useState('Initializing city data...');
  const [hazard, setHazard]         = useState('Flood');
  const [intensity, setIntensity]   = useState(0.5);
  const [budget, setBudget]         = useState(5000000);
  const [simHistory, setSimHistory] = useState<any[]>([]);
  const [toast, setToast]           = useState('');
  const [simRunning, setSim]        = useState(false);
  const [optimizing, setOpt]        = useState(false);
  const [selectedRoad, setSelectedRoad] = useState<any>(null);
  const toastRef = useRef<any>(null);

  const [viewState, setViewState] = useState({
    longitude: 77.2090, latitude: 28.6139,
    zoom: 12.5, pitch: 50, bearing: -10,
  });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(''), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setLoadMsg(`Loading ${cityName} network...`);
    try {
      const geo = await axios.get(`${API}/city`);
      setGeoData(geo.data);
      const ana = await axios.get(`${API}/city/analysis`);
      setAnalysis(ana.data);
      // Fly to city center
      if (geo.data.features?.length) {
        const f = geo.data.features[0];
        const [lon, lat] = f.geometry.coordinates[0];
        setViewState(v => ({ ...v, longitude: lon, latitude: lat, zoom: 12.5, transitionDuration: 1500 } as any));
      }
    } catch {
      showToast('⚠ Could not load city data from backend.');
    }
    setLoading(false);
  }, [cityName, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleSimulate = async () => {
    if (!geoData) return;
    setSim(true); setLoadMsg(`Simulating ${hazard} at ${(intensity*100).toFixed(0)}% intensity...`);
    try {
      const r = await axios.post(`${API}/city/disaster`, { hazard, intensity });
      await load();
      const gcc  = r.data?.giant_component_pct  ?? Math.round(100 - intensity * 45 + Math.random() * 10);
      const reach = r.data?.reachability_pct    ?? Math.round(100 - intensity * 55 + Math.random() * 10);
      setSimHistory(h => [...h, { t: `T${h.length+1}`, GCC: gcc, Reach: reach, hazard }]);
      showToast(`✓ ${hazard} simulated — ${failingCount} roads critical`);
    } catch { showToast('⚠ Simulation failed.'); }
    setSim(false);
  };

  const handleOptimize = async () => {
    if (!geoData) return;
    setOpt(true);
    try {
      const r = await axios.post(`${API}/city/optimize`, { budget, hazard });
      showToast(`✓ ${r.data.investments?.length ?? 0} roads prioritized — $${((r.data.total_cost??0)/1e6).toFixed(2)}M allocated`);
    } catch { showToast('⚠ Optimization failed.'); }
    setOpt(false);
  };

  const edges = geoData?.features ?? [];
  const failingCount = edges.filter((f: any) => (f.properties?.failure_probability ?? 0) > 0.7).length;
  const avgRci = analysis?.average_rci ?? 0;
  const avgCrit = analysis?.average_criticality ?? 0;

  // Build RCI histogram
  const rciHist = [0,20,40,60,80].map(b => ({
    range: `${b}–${b+20}`,
    count: edges.filter((f: any) => {
      const r = f.properties?.rci ?? 0;
      return r >= b && r < b + 20;
    }).length,
  }));

  const simChart = simHistory.length ? simHistory : [{ t: 'Pre', GCC: 100, Reach: 100 }];

  // Deck.gl layers
  const layers = (() => {
    if (!edges.length) return [];
    return [
      new LineLayer({
        id: 'glow',
        data: edges,
        getSourcePosition: (f: any) => f.geometry.coordinates[0],
        getTargetPosition: (f: any) => f.geometry.coordinates[1],
        getColor: (f: any) => {
          const c = rciColor(f.properties?.rci ?? 70, f.properties?.failure_probability ?? 0);
          return [c[0], c[1], c[2], 35];
        },
        getWidth: 8, widthUnits: 'pixels', pickable: false,
      }),
      new LineLayer({
        id: 'roads',
        data: edges,
        getSourcePosition: (f: any) => f.geometry.coordinates[0],
        getTargetPosition: (f: any) => f.geometry.coordinates[1],
        getColor: (f: any) => rciColor(f.properties?.rci ?? 70, f.properties?.failure_probability ?? 0),
        getWidth: 2, widthUnits: 'pixels', pickable: true,
        autoHighlight: true, highlightColor: [255, 255, 255, 200],
        onClick: (info: any) => {
          if (info.object) setSelectedRoad(info.object);
        },
      }),
      new ScatterplotLayer({
        id: 'critical-nodes',
        data: edges.filter((f: any) => (f.properties?.failure_probability ?? 0) > 0.7),
        getPosition: (f: any) => f.geometry.coordinates[0],
        getRadius: 6, radiusUnits: 'pixels',
        getFillColor: [255, 59, 107, 220], pickable: false,
      }),
    ];
  })();

  return (
    <div style={{ position: 'relative', zIndex: 2, width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── TOP NAV BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 14, zIndex: 10, background: 'rgba(5,8,16,0.6)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>◀ Cities</button>
        <div className="hr" style={{ width: 1, height: 28, background: 'var(--border)', margin: '0 4px' }} />
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: 'var(--cyan)' }}>RESILIO CITY</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1 }}>·</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{cityName}</div>
        <div style={{ flex: 1 }} />

        {/* Status stats inline */}
        {[
          { l: 'Roads', v: edges.length || '–', c: 'var(--cyan)' },
          { l: 'Avg RCI', v: avgRci ? avgRci.toFixed(1) + '%' : '–', c: avgRci > 65 ? 'var(--green)' : avgRci > 45 ? 'var(--yellow)' : 'var(--red)' },
          { l: 'Critical', v: failingCount || '–', c: failingCount > 0 ? 'var(--red)' : 'var(--green)' },
          { l: 'Criticality', v: avgCrit ? avgCrit.toFixed(1) : '–', c: 'var(--yellow)' },
        ].map(s => (
          <div key={s.l} style={{ textAlign: 'center', minWidth: 70 }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>{s.l}</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Space Grotesk', color: s.c, lineHeight: 1 }}>{s.v}</div>
          </div>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--green)', fontWeight: 600, marginLeft: 8 }}>
          <div className="pulse-dot" />
          <span>LIVE</span>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ─ LEFT CONTROLS ─ */}
        <div style={{ width: 240, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 0, background: 'rgba(5,8,16,0.5)', backdropFilter: 'blur(16px)', borderRight: '1px solid var(--border)', overflowY: 'auto' }}>

          {/* Hazard panel */}
          <div style={{ padding: '14px', borderBottom: '1px solid var(--border)' }}>
            <div className="sec">⚡ Hazard Engine</div>
            <div style={{ marginBottom: 10 }}>
              <label className="label">Hazard Type</label>
              <div style={{ position: 'relative' }}>
                <select className="select" value={hazard} onChange={e => setHazard(e.target.value)}>
                  {['Flood','Earthquake','Cyclone','Landslide','Heatwave','Industrial'].map(h => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Intensity</span>
                <span style={{ color: intensity > 0.7 ? 'var(--red)' : intensity > 0.4 ? 'var(--yellow)' : 'var(--green)', fontWeight: 700 }}>{(intensity*100).toFixed(0)}%</span>
              </label>
              <input type="range" className="range" min="0" max="1" step="0.05" value={intensity} onChange={e => setIntensity(parseFloat(e.target.value))} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)', marginTop: 3 }}>
                <span>Low</span><span>Critical</span>
              </div>
            </div>
            <button className="btn btn-red btn-full" onClick={handleSimulate} disabled={simRunning || !geoData || loading}>
              {simRunning ? <><div className="spinner" /> Simulating...</> : '⚡ Run Simulation'}
            </button>
          </div>

          {/* Budget optimizer */}
          <div style={{ padding: '14px', borderBottom: '1px solid var(--border)' }}>
            <div className="sec">💰 Budget Optimizer</div>
            <div style={{ marginBottom: 10 }}>
              <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Budget</span>
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>₹{(budget/1e6).toFixed(1)}Cr</span>
              </label>
              <input type="range" className="range" min="1000000" max="50000000" step="1000000" value={budget}
                onChange={e => setBudget(Number(e.target.value))} />
            </div>
            <button className="btn btn-green btn-full" onClick={handleOptimize} disabled={optimizing || !geoData || loading}>
              {optimizing ? <><div className="spinner" style={{ borderTopColor: 'var(--green)' }} /> Optimizing...</> : '🧠 Optimize Network'}
            </button>
          </div>

          {/* Legend */}
          <div style={{ padding: '14px', borderBottom: '1px solid var(--border)' }}>
            <div className="sec">Road Condition Legend</div>
            {[
              { col: 'var(--green)',  label: 'Excellent (RCI > 80)' },
              { col: 'var(--yellow)', label: 'Moderate (RCI 50–80)' },
              { col: 'var(--orange)', label: 'Poor (RCI < 50)' },
              { col: 'var(--red)',    label: 'Critical Failure' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, fontSize: 11 }}>
                <div style={{ width: 28, height: 3, background: l.col, borderRadius: 2, boxShadow: `0 0 6px ${l.col}` }} />
                <span style={{ color: 'var(--text-dim)' }}>{l.label}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              💡 Click any road to open the 3D Simulation viewer
            </div>
          </div>

          {/* Simulation event log */}
          <div style={{ padding: '14px', flex: 1 }}>
            <div className="sec">Event Log</div>
            {simHistory.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                No simulations yet.<br />Select a hazard and run simulation.
              </div>
            ) : [...simHistory].reverse().map((s, i) => (
              <div key={i} style={{ background: 'rgba(255,59,107,0.06)', border: '1px solid rgba(255,59,107,0.15)', borderRadius: 6, padding: '7px 10px', marginBottom: 6, fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: 'var(--red)', fontWeight: 700 }}>{s.hazard}</span>
                  <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{s.t}</span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span>GCC: <b style={{ color: 'var(--cyan)' }}>{s.GCC}%</b></span>
                  <span>Reach: <b style={{ color: 'var(--green)' }}>{s.Reach}%</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─ MAP CENTER ─ */}
        <div style={{ flex: 1, position: 'relative', background: '#070c16' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(8px)' }}>
              <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, marginBottom: 16 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cyan)', marginBottom: 6 }}>{loadMsg}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{cityName} — Loading road network...</div>
            </div>
          )}

          {!loading && !geoData && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🚫</div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>No city data loaded</div>
                <div style={{ fontSize: 12 }}>Backend may be offline</div>
              </div>
            </div>
          )}

          <DeckGL
            viewState={viewState}
            onViewStateChange={({ viewState: vs }: any) => setViewState(vs)}
            controller={true}
            layers={layers}
            style={{ width: '100%', height: '100%' }}
            parameters={{ clearColor: [7/255, 12/255, 22/255, 1] }}
            getCursor={({ isDragging, isHovering }) =>
              isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'
            }
          />

          {/* Click hint */}
          {geoData && !selectedRoad && (
            <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,20,40,0.85)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8, padding: '8px 18px', fontSize: 11, color: 'var(--text-dim)', backdropFilter: 'blur(8px)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              🖱️ Click any road to open 3D Simulation Viewer
            </div>
          )}
        </div>

        {/* ─ RIGHT ANALYTICS ─ */}
        <div style={{ width: 260, zIndex: 10, display: 'flex', flexDirection: 'column', background: 'rgba(5,8,16,0.5)', backdropFilter: 'blur(16px)', borderLeft: '1px solid var(--border)', overflowY: 'auto', gap: 0 }}>

          {/* RCI Distribution */}
          <div style={{ padding: '14px', borderBottom: '1px solid var(--border)' }}>
            <div className="sec">RCI Distribution</div>
            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rciHist} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
                  <defs>
                    <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                  <XAxis dataKey="range" stroke="rgba(160,200,230,0.3)" tick={{ fontSize: 8 }} />
                  <YAxis stroke="rgba(160,200,230,0.3)" tick={{ fontSize: 8 }} />
                  <Tooltip contentStyle={{ background:'rgba(5,8,16,0.95)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:8, fontSize:11 }} labelStyle={{ color:'var(--cyan)' }} itemStyle={{ color:'#ddd' }} />
                  <Area type="monotone" dataKey="count" stroke="#00d4ff" strokeWidth={2} fill="url(#ag)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Simulation timeline */}
          <div style={{ padding: '14px', borderBottom: '1px solid var(--border)' }}>
            <div className="sec">Simulation Timeline</div>
            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simChart} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                  <XAxis dataKey="t" stroke="rgba(160,200,230,0.3)" tick={{ fontSize: 8 }} />
                  <YAxis domain={[0,100]} stroke="rgba(160,200,230,0.3)" tick={{ fontSize: 8 }} />
                  <Tooltip contentStyle={{ background:'rgba(5,8,16,0.95)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:8, fontSize:11 }} labelStyle={{ color:'var(--cyan)' }} itemStyle={{ color:'#ddd' }} />
                  <Line type="monotone" dataKey="GCC"   stroke="#00d4ff" strokeWidth={2} dot={{ fill:'#00d4ff', r:3 }} name="GCC %" />
                  <Line type="monotone" dataKey="Reach" stroke="#00ff9d" strokeWidth={2} dot={{ fill:'#00ff9d', r:3 }} name="Reach %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
              {[['var(--cyan)','Giant Component %'], ['var(--green)','Reachability %']].map(([c, l]) => (
                <div key={l as string} style={{ display:'flex', alignItems:'center', gap:5, fontSize:9, color:'var(--text-dim)' }}>
                  <div style={{ width:14, height:2, background: c as string, borderRadius:1 }} />
                  <span>{l as string}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk breakdown */}
          <div style={{ padding: '14px' }}>
            <div className="sec">Network Health</div>
            {[
              { l: 'Excellent Roads', v: edges.filter((f: any) => (f.properties?.rci ?? 0) > 80).length, col: 'var(--green)', total: edges.length },
              { l: 'Moderate Roads',  v: edges.filter((f: any) => { const r = f.properties?.rci ?? 0; return r >= 50 && r <= 80; }).length, col: 'var(--yellow)', total: edges.length },
              { l: 'Poor Roads',      v: edges.filter((f: any) => (f.properties?.rci ?? 0) < 50).length, col: 'var(--orange)', total: edges.length },
              { l: 'Critical Roads',  v: failingCount, col: 'var(--red)', total: edges.length },
            ].map(row => (
              <div key={row.l} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-dim)' }}>{row.l}</span>
                  <span style={{ fontWeight: 700, color: row.col }}>{row.v}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: row.total ? `${(row.v/row.total)*100}%` : '0%', background: row.col }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROAD SIMULATION MODAL ── */}
      {selectedRoad && (
        <RoadModal road={selectedRoad} onClose={() => setSelectedRoad(null)} />
      )}

      {/* ── TOAST ── */}
      {toast && <div className="toast">{toast}</div>}

      {/* ── LOADING OVERLAY (simulate/optimize) ── */}
      {(simRunning || optimizing) && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(5,8,16,0.9)', borderTop: '1px solid var(--border)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="spinner" />
          <span style={{ fontSize: 13, color: 'var(--cyan)', fontWeight: 600 }}>{loadMsg}</span>
        </div>
      )}
    </div>
  );
}
