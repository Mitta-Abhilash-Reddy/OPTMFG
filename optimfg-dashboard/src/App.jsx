import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, Radar, BarChart, Bar, Legend, ReferenceLine
} from "recharts";

// ─── API LAYER ────────────────────────────────────────────────────────────────
const API = "http://localhost:8000";

const api = {
  predict: (params) =>
    fetch(`${API}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params }),
    }).then((r) => r.json()),

  optimize: (payload) =>
    fetch(`${API}/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json()),

  getSignatures: () =>
    fetch(`${API}/golden-signatures`).then((r) => r.json()),

  updateSignature: (params, outcomes) =>
    fetch(`${API}/golden-signatures/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params, outcomes, source: "optimized" }),
    }).then((r) => r.json()),

  activateSignature: (id) =>
    fetch(`${API}/golden-signatures/${id}/activate`, {
      method: "PATCH",
    }).then((r) => r.json()),

  getDecisions: (action) =>
    fetch(`${API}/decisions${action ? `?action=${action}` : ""}`).then((r) =>
      r.json()
    ),

  logDecision: (payload) =>
    fetch(`${API}/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json()),
};

// ─── STATIC FALLBACK DATA (used for charts that need history) ─────────────────
const energyTrend = Array.from({ length: 30 }, (_, i) => ({
  batch: i + 1,
  energy: 150 + Math.sin(i * 0.4) * 12 + (Math.random() - 0.5) * 8,
  carbon: (150 + Math.sin(i * 0.4) * 12 + (Math.random() - 0.5) * 8) * 0.7,
  quality: 0.88 + Math.random() * 0.1,
}));

const anomalyData = Array.from({ length: 30 }, (_, i) => ({
  batch: i + 1,
  vibrationRMS: 0.8 + Math.sin(i * 0.3) * 0.2 + (Math.random() - 0.5) * 0.15 + (i > 24 ? 0.6 : 0),
  anomalyScore: Math.random() * 0.3 + (i > 24 ? 0.55 : 0.05),
  powerMean: 42 + Math.sin(i * 0.5) * 5 + (Math.random() - 0.5) * 3,
  healthScore: 0.95 - (i > 24 ? 0.25 : 0) + (Math.random() - 0.5) * 0.05,
}));

// ─── STYLES ───────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:#080c10; --surface:#0d1117; --surface2:#111820; --surface3:#161e28;
    --border:#1e2d3d; --border2:#243447;
    --accent:#00d4ff; --accent2:#00ff9d; --accent3:#ff6b35; --accent4:#ffd700;
    --muted:#4a6070; --text:#c8d8e8; --text2:#7a9ab0;
    --danger:#ff4545; --success:#00ff9d; --warn:#ffd700;
  }
  body, #root { background:var(--bg); color:var(--text); font-family:'Barlow',sans-serif; overflow-x:hidden; width:100%; height:100%; }
  .mono { font-family:'Share Tech Mono',monospace; }
  .app { display:flex; height:100vh; width:100vw; overflow:hidden; }
  .sidebar { width:220px; min-width:220px; background:var(--surface); border-right:1px solid var(--border); display:flex; flex-direction:column; }
  .logo { padding:24px 20px 20px; border-bottom:1px solid var(--border); }
  .logo-name { font-size:22px; font-weight:700; letter-spacing:2px; color:var(--accent); font-family:'Share Tech Mono',monospace; }
  .logo-sub { font-size:10px; color:var(--muted); letter-spacing:3px; margin-top:3px; text-transform:uppercase; }
  .logo-dot { color:var(--accent2); }
  .nav { flex:1; padding:16px 0; }
  .nav-item { display:flex; align-items:center; gap:12px; padding:11px 20px; cursor:pointer; font-size:13px; font-weight:500; color:var(--text2); border-left:2px solid transparent; transition:all 0.15s; }
  .nav-item:hover { color:var(--text); background:var(--surface2); }
  .nav-item.active { color:var(--accent); border-left-color:var(--accent); background:rgba(0,212,255,0.05); }
  .sidebar-footer { padding:16px 20px; border-top:1px solid var(--border); font-size:11px; color:var(--muted); }
  .status-dot { width:6px; height:6px; border-radius:50%; background:var(--accent2); display:inline-block; margin-right:6px; box-shadow:0 0 6px var(--accent2); }
  .main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
  .topbar { height:56px; background:var(--surface); border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; padding:0 28px; flex-shrink:0; }
  .topbar-title { font-size:15px; font-weight:600; color:var(--text); }
  .topbar-meta { font-size:11px; color:var(--muted); font-family:'Share Tech Mono',monospace; }
  .badge { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:2px; font-size:11px; font-weight:600; letter-spacing:0.5px; font-family:'Share Tech Mono',monospace; }
  .badge-live { background:rgba(0,255,157,0.1); color:var(--accent2); border:1px solid rgba(0,255,157,0.2); }
  .content { flex:1; overflow-y:auto; padding:24px 28px; }
  .content::-webkit-scrollbar { width:4px; }
  .content::-webkit-scrollbar-thumb { background:var(--border2); border-radius:2px; }
  .card { background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:20px; }
  .card-title { font-size:11px; font-weight:600; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-bottom:16px; display:flex; align-items:center; gap:8px; }
  .card-title::before { content:''; display:block; width:3px; height:12px; background:var(--accent); border-radius:1px; }
  .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:20px; }
  .kpi-card { background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:18px 20px; position:relative; overflow:hidden; }
  .kpi-card::after { content:''; position:absolute; top:0; left:0; right:0; height:2px; }
  .kpi-card.energy::after { background:var(--accent); }
  .kpi-card.carbon::after { background:var(--accent2); }
  .kpi-card.quality::after { background:var(--accent4); }
  .kpi-card.reliability::after { background:var(--accent3); }
  .kpi-label { font-size:10px; letter-spacing:2px; color:var(--muted); text-transform:uppercase; margin-bottom:8px; }
  .kpi-value { font-size:28px; font-weight:700; font-family:'Share Tech Mono',monospace; }
  .kpi-value.energy { color:var(--accent); }
  .kpi-value.carbon { color:var(--accent2); }
  .kpi-value.quality { color:var(--accent4); }
  .kpi-value.reliability { color:var(--accent3); }
  .kpi-unit { font-size:12px; font-weight:400; color:var(--muted); margin-left:4px; }
  .kpi-delta { font-size:11px; margin-top:6px; font-family:'Share Tech Mono',monospace; }
  .kpi-delta.pos { color:var(--accent2); }
  .kpi-delta.neg { color:var(--danger); }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
  .grid-2-1 { display:grid; grid-template-columns:2fr 1fr; gap:14px; }
  .mb { margin-bottom:14px; }
  .table { width:100%; border-collapse:collapse; font-size:12px; }
  .table th { text-align:left; padding:8px 12px; font-size:10px; letter-spacing:1.5px; color:var(--muted); text-transform:uppercase; border-bottom:1px solid var(--border); font-weight:600; }
  .table td { padding:10px 12px; border-bottom:1px solid rgba(30,45,61,0.5); color:var(--text2); }
  .table tr:last-child td { border-bottom:none; }
  .table tr:hover td { background:rgba(0,212,255,0.02); color:var(--text); }
  .tag { display:inline-block; padding:2px 8px; border-radius:2px; font-size:10px; font-weight:600; letter-spacing:0.5px; font-family:'Share Tech Mono',monospace; }
  .tag-accepted { background:rgba(0,255,157,0.1); color:var(--accent2); border:1px solid rgba(0,255,157,0.2); }
  .tag-rejected { background:rgba(255,69,69,0.1); color:var(--danger); border:1px solid rgba(255,69,69,0.2); }
  .tag-modified { background:rgba(255,215,0,0.1); color:var(--accent4); border:1px solid rgba(255,215,0,0.2); }
  .tag-optimized { background:rgba(0,212,255,0.1); color:var(--accent); border:1px solid rgba(0,212,255,0.2); }
  .tag-historical { background:rgba(74,96,112,0.2); color:var(--muted); border:1px solid var(--border); }
  .tag-active { background:rgba(0,255,157,0.1); color:var(--accent2); border:1px solid rgba(0,255,157,0.3); }
  .btn { padding:7px 16px; border-radius:3px; font-size:12px; font-weight:600; cursor:pointer; border:none; letter-spacing:0.5px; transition:all 0.15s; font-family:'Barlow',sans-serif; }
  .btn:disabled { opacity:0.4; cursor:not-allowed; }
  .btn-primary { background:var(--accent); color:#000; }
  .btn-primary:hover:not(:disabled) { background:#33ddff; }
  .btn-success { background:transparent; color:var(--accent2); border:1px solid var(--accent2); }
  .btn-success:hover:not(:disabled) { background:rgba(0,255,157,0.1); }
  .btn-danger { background:transparent; color:var(--danger); border:1px solid var(--danger); }
  .btn-danger:hover:not(:disabled) { background:rgba(255,69,69,0.1); }
  .btn-muted { background:transparent; color:var(--muted); border:1px solid var(--border); }
  .btn-muted:hover:not(:disabled) { color:var(--text); border-color:var(--border2); }
  .sig-card { border:1px solid var(--border); border-radius:4px; padding:16px; background:var(--surface3); margin-bottom:10px; transition:border-color 0.15s; }
  .sig-card.active-sig { border-color:rgba(0,212,255,0.4); background:rgba(0,212,255,0.03); }
  .sig-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
  .sig-version { font-family:'Share Tech Mono',monospace; font-size:16px; font-weight:700; color:var(--accent); }
  .sig-params { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:12px; }
  .param-item { background:var(--surface); padding:8px 10px; border-radius:3px; border:1px solid var(--border); }
  .param-name { font-size:9px; letter-spacing:1px; color:var(--muted); text-transform:uppercase; margin-bottom:3px; }
  .param-val { font-size:14px; font-weight:600; font-family:'Share Tech Mono',monospace; color:var(--text); }
  .sig-metrics { display:flex; gap:16px; }
  .sig-metric { font-size:11px; }
  .sig-metric-label { color:var(--muted); }
  .sig-metric-val { font-family:'Share Tech Mono',monospace; margin-left:5px; }
  .gauge-bar { height:4px; background:var(--border); border-radius:2px; margin-top:4px; overflow:hidden; }
  .gauge-fill { height:100%; border-radius:2px; transition:width 0.8s ease; }
  .alert { padding:10px 14px; border-radius:3px; font-size:12px; display:flex; align-items:center; gap:10px; margin-bottom:8px; }
  .alert-warn { background:rgba(255,215,0,0.05); border:1px solid rgba(255,215,0,0.2); color:var(--accent4); }
  .alert-danger { background:rgba(255,69,69,0.05); border:1px solid rgba(255,69,69,0.2); color:var(--danger); }
  .alert-success { background:rgba(0,255,157,0.05); border:1px solid rgba(0,255,157,0.2); color:var(--accent2); }
  .custom-tooltip { background:var(--surface); border:1px solid var(--border2); padding:10px 14px; border-radius:4px; font-size:11px; font-family:'Share Tech Mono',monospace; color:var(--text); }
  .custom-tooltip .ct-label { color:var(--muted); margin-bottom:4px; font-size:10px; }
  .health-ring { width:80px; height:80px; border-radius:50%; border:3px solid var(--border); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .health-val { font-size:16px; font-weight:700; font-family:'Share Tech Mono',monospace; }
  .health-good { border-color:var(--accent2); color:var(--accent2); }
  .health-warn { border-color:var(--accent4); color:var(--accent4); }
  .health-bad { border-color:var(--danger); color:var(--danger); }
  .flex { display:flex; }
  .flex-between { display:flex; justify-content:space-between; align-items:center; }
  .flex-center { display:flex; align-items:center; gap:12px; }
  .gap-sm { gap:8px; }
  .gap { gap:12px; }
  .mt { margin-top:12px; }
  .text-muted { color:var(--muted); font-size:11px; }
  .w100 { width:100%; }
  .spinner { display:inline-block; width:14px; height:14px; border:2px solid var(--border); border-top-color:var(--accent); border-radius:50%; animation:spin 0.7s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
  .pulse { animation:pulse 2s infinite; }
  .scanlines { pointer-events:none; position:fixed; inset:0; z-index:1000; opacity:0.015; background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.8) 2px,rgba(0,0,0,0.8) 4px); }
  .input-row { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
  .input-group label { display:block; font-size:10px; letter-spacing:1px; color:var(--muted); text-transform:uppercase; margin-bottom:4px; }
  .input-group input { width:100%; background:var(--surface); border:1px solid var(--border); color:var(--text); padding:7px 10px; border-radius:3px; font-size:12px; font-family:'Share Tech Mono',monospace; outline:none; }
  .input-group input:focus { border-color:var(--accent); }
  .table-wrap { overflow-x:auto; }
  .empty-state { text-align:center; padding:40px; color:var(--muted); font-size:13px; }
`;

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
const Spinner = () => <span className="spinner" />;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="ct-label">Batch {label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontSize: 12 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(3) : p.value}
        </div>
      ))}
    </div>
  );
};

const ParetoTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="custom-tooltip">
      <div className="ct-label">Solution #{d.solution_id}</div>
      <div>Energy: <span style={{ color: "#00d4ff" }}>{d.energy_batch?.toFixed(1)} kWh</span></div>
      <div>Quality: <span style={{ color: "#ffd700" }}>{d.quality_score?.toFixed(3)}</span></div>
      <div>Carbon: <span style={{ color: "#00ff9d" }}>{d.carbon_batch?.toFixed(1)} kg</span></div>
    </div>
  );
};

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
function OverviewView() {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState({
    granulation_time: 18, binder_amount: 12.5, drying_temp: 178,
    drying_time: 45, compression_force: 12, machine_speed: 116,
    lubricant_conc: 0.8, moisture_content: 6.4,
  });

  const runPredict = async () => {
    setLoading(true);
    try {
      const result = await api.predict(params);
      setPrediction(result);
    } catch (e) {
      alert("Prediction failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const radarData = prediction ? [
    { metric: "Quality",     current: prediction.quality_score * 100,   golden: 96 },
    { metric: "Energy Eff.", current: Math.max(0, 100 - prediction.energy_batch / 2), golden: 91 },
    { metric: "Reliability", current: prediction.reliability_idx * 100,  golden: 94 },
    { metric: "Carbon Eff.", current: Math.max(0, 100 - prediction.carbon_batch / 1.5), golden: 89 },
    { metric: "Dissolution", current: prediction.dissolution_rate,        golden: 95 },
  ] : [];

  return (
    <div>
      {/* Parameter Inputs */}
      <div className="card mb">
        <div className="card-title">Simulate Batch Parameters</div>
        <div className="input-row">
          {Object.entries(params).map(([key, val]) => (
            <div className="input-group" key={key}>
              <label>{key.replace(/_/g, " ")}</label>
              <input type="number" value={val} step="0.1"
                onChange={e => setParams(p => ({ ...p, [key]: parseFloat(e.target.value) }))} />
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={runPredict} disabled={loading}>
          {loading ? <><Spinner /> Predicting...</> : "▶ RUN PREDICTION"}
        </button>
      </div>

      {/* KPI Cards */}
      {prediction && (
        <>
          <div className="kpi-grid">
            {[
              { cls: "energy",      label: "Energy / Batch",  value: prediction.energy_batch.toFixed(1),          unit: "kWh" },
              { cls: "carbon",      label: "CO₂ / Batch",     value: prediction.carbon_batch.toFixed(1),          unit: "kg"  },
              { cls: "quality",     label: "Quality Score",   value: (prediction.quality_score * 100).toFixed(1), unit: "%"   },
              { cls: "reliability", label: "Reliability",     value: (prediction.reliability_idx * 100).toFixed(1), unit: "%"  },
            ].map(k => (
              <div className={`kpi-card ${k.cls}`} key={k.cls}>
                <div className="kpi-label">{k.label}</div>
                <div className={`kpi-value ${k.cls}`}>{k.value}<span className="kpi-unit">{k.unit}</span></div>
              </div>
            ))}
          </div>

          <div className="grid-2 mb">
            <div className="card">
              <div className="card-title">Quality Sub-Metrics</div>
              <table className="table">
                <tbody>
                  {[
                    { label: "Hardness",         val: `${prediction.hardness} N`,   color: "#00d4ff" },
                    { label: "Friability",        val: `${prediction.friability}%`,  color: "#ff6b35" },
                    { label: "Dissolution Rate",  val: `${prediction.dissolution_rate}%`, color: "#ffd700" },
                  ].map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: "var(--muted)" }}>{r.label}</td>
                      <td style={{ color: r.color, fontFamily: "Share Tech Mono" }}>{r.val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <div className="card-title">Current vs Golden Signature</div>
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1e2d3d" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#4a6070", fontSize: 10 }} />
                  <Radar name="Current" dataKey="current" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.15} strokeWidth={1.5} />
                  <Radar name="Golden"  dataKey="golden"  stroke="#ffd700" fill="#ffd700" fillOpacity={0.1}  strokeWidth={1.5} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#7a9ab0" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Historical Trend */}
      <div className="card">
        <div className="card-title">Energy & Carbon Trend (Simulated History)</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={energyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
            <XAxis dataKey="batch" tick={{ fill: "#4a6070", fontSize: 10 }} />
            <YAxis tick={{ fill: "#4a6070", fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="energy" stroke="#00d4ff" strokeWidth={1.5} dot={false} name="Energy (kWh)" />
            <Line type="monotone" dataKey="carbon" stroke="#00ff9d" strokeWidth={1.5} dot={false} name="Carbon (kg)" />
            <ReferenceLine y={150} stroke="#ff4545" strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── OPTIMIZATION ─────────────────────────────────────────────────────────────
function OptimizationView() {
  const [mode, setMode]         = useState("balanced");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast]       = useState(null);
  const [config, setConfig]     = useState({ quality_min: 0.90, energy_max: 160, pop_size: 80, n_gen: 60 });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const runOptimize = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await api.optimize({ mode, ...config });
      setResult(data);
      setSelected(data.recommended);
      showToast(`Found ${data.n_solutions} Pareto-optimal solutions`);
    } catch (e) {
      showToast("Optimization failed: " + e.message, "danger");
    } finally {
      setLoading(false);
    }
  };

  const promoteToGolden = async (sol) => {
    try {
      const params = {
        granulation_time: sol.granulation_time, binder_amount: sol.binder_amount,
        drying_temp: sol.drying_temp, drying_time: sol.drying_time,
        compression_force: sol.compression_force, machine_speed: sol.machine_speed,
        lubricant_conc: sol.lubricant_conc, moisture_content: sol.moisture_content,
      };
      const outcomes = {
        energy_batch: sol.energy_batch, carbon_batch: sol.carbon_batch,
        quality_score: sol.quality_score, reliability_idx: sol.reliability_idx,
        hardness: 0, friability: 0, dissolution_rate: 0,
      };
      const res = await api.updateSignature(params, outcomes);
      showToast(res.added ? `Promoted to Golden Signature ${res.version}` : "Already dominated by existing signature");
    } catch (e) {
      showToast("Promotion failed", "danger");
    }
  };

  return (
    <div>
      {toast && (
        <div className={`alert alert-${toast.type} mb`}>
          <span>{toast.type === "success" ? "✓" : "⚠"}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Config */}
      <div className="card mb">
        <div className="card-title">Optimization Configuration</div>
        <div className="flex-center gap mb">
          {["balanced", "energy_saver", "quality_max"].map(m => (
            <button key={m} className={`btn ${mode === m ? "btn-primary" : "btn-muted"}`}
              onClick={() => setMode(m)} style={{ fontSize: 11 }}>
              {m.replace("_", " ").toUpperCase()}
            </button>
          ))}
        </div>
        <div className="input-row">
          {[
            { key: "quality_min", label: "Min Quality",  step: 0.01 },
            { key: "energy_max",  label: "Max Energy",   step: 1    },
            { key: "pop_size",    label: "Population",   step: 10   },
            { key: "n_gen",       label: "Generations",  step: 10   },
          ].map(f => (
            <div className="input-group" key={f.key}>
              <label>{f.label}</label>
              <input type="number" value={config[f.key]} step={f.step}
                onChange={e => setConfig(c => ({ ...c, [f.key]: parseFloat(e.target.value) }))} />
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={runOptimize} disabled={loading}>
          {loading ? <><Spinner /> Running NSGA-II...</> : "▶ RUN OPTIMIZATION"}
        </button>
        {loading && <span style={{ marginLeft: 12, fontSize: 11, color: "var(--muted)" }}>
          This may take 15–30 seconds...
        </span>}
      </div>

      {result && (
        <>
          <div className="grid-2-1 mb">
            <div className="card">
              <div className="card-title">Pareto Front — Energy vs Quality</div>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
                  <XAxis dataKey="energy_batch" name="Energy" tick={{ fill: "#4a6070", fontSize: 10 }}
                    label={{ value: "Energy (kWh/batch)", fill: "#4a6070", fontSize: 10, position: "insideBottom", offset: -2 }} />
                  <YAxis dataKey="quality_score" name="Quality" tick={{ fill: "#4a6070", fontSize: 10 }}
                    domain={[0.85, 1.0]} label={{ value: "Quality Score", fill: "#4a6070", fontSize: 10, angle: -90, position: "insideLeft" }} />
                  <Tooltip content={<ParetoTooltip />} />
                  <Scatter data={result.pareto_solutions} fill="#ff6b35" stroke="#ff8c5a"
                    onClick={(d) => setSelected(d)} cursor="pointer" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="card-title">Recommended Solution</div>
              {selected && (
                <>
                  {[
                    { label: "Energy",      val: `${selected.energy_batch?.toFixed(1)} kWh`, color: "#00d4ff" },
                    { label: "Carbon",      val: `${selected.carbon_batch?.toFixed(1)} kg`,  color: "#00ff9d" },
                    { label: "Quality",     val: selected.quality_score?.toFixed(4),          color: "#ffd700" },
                    { label: "Reliability", val: selected.reliability_idx?.toFixed(4),        color: "#ff6b35" },
                  ].map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                      <span style={{ color: "var(--muted)" }}>{m.label}</span>
                      <span style={{ color: m.color, fontFamily: "Share Tech Mono" }}>{m.val}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                    <button className="btn btn-success w100" onClick={() => promoteToGolden(selected)}>★ PROMOTE TO GOLDEN</button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Solutions Table */}
          <div className="card">
            <div className="card-title">All Pareto Solutions ({result.n_solutions})</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th><th>Energy</th><th>Carbon</th><th>Quality</th>
                    <th>Dry Temp</th><th>Speed</th><th>Moisture</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {result.pareto_solutions.slice(0, 10).map((s, i) => (
                    <tr key={i} style={{ cursor: "pointer" }} onClick={() => setSelected(s)}>
                      <td className="mono" style={{ color: "#00d4ff" }}>SOL-{String(s.solution_id).padStart(3, "0")}</td>
                      <td className="mono">{s.energy_batch?.toFixed(1)}</td>
                      <td className="mono">{s.carbon_batch?.toFixed(1)}</td>
                      <td className="mono" style={{ color: "#ffd700" }}>{s.quality_score?.toFixed(4)}</td>
                      <td className="mono">{s.drying_temp?.toFixed(1)} °C</td>
                      <td className="mono">{s.machine_speed?.toFixed(1)} rpm</td>
                      <td className="mono">{s.moisture_content?.toFixed(2)}%</td>
                      <td>
                        <button className="btn btn-muted" style={{ fontSize: 10, padding: "3px 8px" }}
                          onClick={e => { e.stopPropagation(); promoteToGolden(s); }}>
                          PROMOTE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="card">
          <div className="empty-state">
            Configure parameters above and click RUN OPTIMIZATION to generate Pareto-optimal solutions.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GOLDEN SIGNATURES ────────────────────────────────────────────────────────
function GoldenSignatureView() {
  const [sigs, setSigs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]   = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getSignatures();
      setSigs(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast("Failed to load signatures", "danger");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activate = async (id) => {
    try {
      await api.activateSignature(id);
      showToast("Signature activated!");
      load();
    } catch (e) {
      showToast("Failed to activate", "danger");
    }
  };

  const barData = sigs.map(s => ({
    name: s.version,
    energy: s.energy_batch,
    carbon: s.carbon_batch,
    quality: (s.quality_score * 100).toFixed(1),
  }));

  return (
    <div>
      {toast && (
        <div className={`alert alert-${toast.type} mb`}>
          <span>{toast.type === "success" ? "✓" : "⚠"}</span><span>{toast.msg}</span>
        </div>
      )}

      <div className="flex-between mb">
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {sigs.length} signature{sigs.length !== 1 ? "s" : ""} stored
        </span>
        <button className="btn btn-muted" onClick={load} style={{ fontSize: 11 }}>
          ↻ REFRESH
        </button>
      </div>

      {loading ? (
        <div className="card"><div className="empty-state"><Spinner /> Loading signatures...</div></div>
      ) : sigs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            No golden signatures yet. Run the Optimization engine and promote a solution to create one.
          </div>
        </div>
      ) : (
        sigs.map(sig => (
          <div key={sig.id} className={`sig-card ${sig.is_active ? "active-sig" : ""}`}>
            <div className="sig-header">
              <div className="flex-center gap">
                <span className="sig-version">{sig.version}</span>
                <span className={`tag ${sig.is_active ? "tag-active" : "tag-historical"}`}>
                  {sig.is_active ? "● ACTIVE" : "ARCHIVED"}
                </span>
                <span className={`tag ${sig.source === "optimized" ? "tag-optimized" : "tag-historical"}`}>
                  {sig.source?.toUpperCase()}
                </span>
              </div>
              <div className="flex-center gap">
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  {new Date(sig.created_at).toLocaleDateString()}
                </span>
                {!sig.is_active && (
                  <button className="btn btn-muted" style={{ fontSize: 10, padding: "3px 8px" }}
                    onClick={() => activate(sig.id)}>
                    SET ACTIVE
                  </button>
                )}
              </div>
            </div>

            <div className="sig-params">
              {[
                { name: "Gran. Time",  val: `${sig.granulation_time} min` },
                { name: "Dry Temp",    val: `${sig.drying_temp} °C`       },
                { name: "Mach. Speed", val: `${sig.machine_speed} rpm`    },
                { name: "Moisture",    val: `${sig.moisture_content}%`    },
                { name: "Binder",      val: `${sig.binder_amount}%`       },
                { name: "Dry Time",    val: `${sig.drying_time} min`      },
                { name: "Comp. Force", val: `${sig.compression_force} kN` },
                { name: "Lubricant",   val: `${sig.lubricant_conc}%`      },
              ].map((p, i) => (
                <div className="param-item" key={i}>
                  <div className="param-name">{p.name}</div>
                  <div className="param-val">{p.val}</div>
                </div>
              ))}
            </div>

            <div className="sig-metrics">
              {[
                { label: "Energy",      val: `${sig.energy_batch} kWh`,          color: "#00d4ff" },
                { label: "Carbon",      val: `${sig.carbon_batch} kg`,            color: "#00ff9d" },
                { label: "Quality",     val: sig.quality_score?.toFixed(4),       color: "#ffd700" },
                { label: "Reliability", val: sig.reliability_idx?.toFixed(4),     color: "#ff6b35" },
              ].map((m, i) => (
                <div className="sig-metric" key={i}>
                  <span className="sig-metric-label">{m.label}:</span>
                  <span className="sig-metric-val" style={{ color: m.color }}>{m.val}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {barData.length > 1 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-title">Signature Performance Comparison</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
              <XAxis dataKey="name" tick={{ fill: "#4a6070", fontSize: 11 }} />
              <YAxis tick={{ fill: "#4a6070", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1e2d3d", fontSize: 11 }} />
              <Bar dataKey="energy" fill="#00d4ff" fillOpacity={0.7} name="Energy (kWh)" />
              <Bar dataKey="carbon" fill="#00ff9d" fillOpacity={0.7} name="Carbon (kg)"  />
              <Legend wrapperStyle={{ fontSize: 11, color: "#7a9ab0" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── DECISIONS ────────────────────────────────────────────────────────────────
function DecisionsView() {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("all");
  const [toast, setToast]         = useState(null);
  const [form, setForm] = useState({
    batch_id: "", action: "accepted", operator_id: "", comment: "",
    energy: 130, quality: 0.95,
    params: { granulation_time:18, binder_amount:12.5, drying_temp:178, drying_time:45,
              compression_force:12, machine_speed:116, lubricant_conc:0.8, moisture_content:6.4 }
  });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDecisions(filter === "all" ? null : filter);
      setDecisions(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast("Failed to load decisions", "danger");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const submitDecision = async () => {
    if (!form.batch_id || !form.operator_id) {
      showToast("Batch ID and Operator ID are required", "danger");
      return;
    }
    try {
      await api.logDecision({ ...form, weights: { energy: 1, quality: 1, carbon: 1 } });
      showToast("Decision logged successfully!");
      setForm(f => ({ ...f, batch_id: "", comment: "" }));
      load();
    } catch (e) {
      showToast("Failed to log decision", "danger");
    }
  };

  const counts = {
    accepted: decisions.filter(d => d.action === "accepted").length,
    rejected: decisions.filter(d => d.action === "rejected").length,
    modified: decisions.filter(d => d.action === "modified").length,
  };

  return (
    <div>
      {toast && (
        <div className={`alert alert-${toast.type} mb`}>
          <span>{toast.type === "success" ? "✓" : "⚠"}</span><span>{toast.msg}</span>
        </div>
      )}

      {/* Log new decision */}
      <div className="card mb">
        <div className="card-title">Log Operator Decision</div>
        <div className="input-row">
          {[
            { key: "batch_id",    label: "Batch ID",     type: "text"   },
            { key: "operator_id", label: "Operator ID",  type: "text"   },
            { key: "energy",      label: "Energy (kWh)", type: "number" },
            { key: "quality",     label: "Quality Score",type: "number" },
          ].map(f => (
            <div className="input-group" key={f.key}>
              <label>{f.label}</label>
              <input type={f.type} value={form[f.key]} step="0.01"
                onChange={e => setForm(p => ({ ...p, [f.key]: f.type === "number" ? parseFloat(e.target.value) : e.target.value }))} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          {["accepted", "rejected", "modified"].map(a => (
            <button key={a} className={`btn ${form.action === a ? "btn-primary" : "btn-muted"}`}
              style={{ fontSize: 11 }} onClick={() => setForm(f => ({ ...f, action: a }))}>
              {a.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="input-group" style={{ marginBottom: 10 }}>
          <label>Comment</label>
          <input type="text" value={form.comment} placeholder="Optional comment..."
            onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
            style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "7px 10px", borderRadius: 3, fontSize: 12, fontFamily: "Share Tech Mono", outline: "none" }} />
        </div>
        <button className="btn btn-primary" onClick={submitDecision}>✓ LOG DECISION</button>
      </div>

      {/* Stats */}
      <div className="grid-3 mb">
        {[
          { label: "Accepted", count: counts.accepted, color: "#00ff9d" },
          { label: "Rejected", count: counts.rejected, color: "#ff4545" },
          { label: "Modified", count: counts.modified, color: "#ffd700" },
        ].map((s, i) => (
          <div className="card" key={i}>
            <div className="kpi-label">{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "Share Tech Mono", color: s.color }}>{s.count}</div>
          </div>
        ))}
      </div>

      {/* Filter + Table */}
      <div className="card">
        <div className="flex-between mb">
          <div className="flex-center gap">
            {["all", "accepted", "rejected", "modified"].map(f => (
              <button key={f} className={`btn ${filter === f ? "btn-primary" : "btn-muted"}`}
                style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => setFilter(f)}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="btn btn-muted" style={{ fontSize: 11 }} onClick={load}>↻ REFRESH</button>
        </div>

        {loading ? (
          <div className="empty-state"><Spinner /> Loading...</div>
        ) : decisions.length === 0 ? (
          <div className="empty-state">No decisions logged yet. Use the form above to log one.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Batch</th><th>Action</th><th>Energy</th>
                  <th>Quality</th><th>Operator</th><th>Comment</th><th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map(d => (
                  <tr key={d.id}>
                    <td className="mono" style={{ color: "#00d4ff" }}>{d.batch_id}</td>
                    <td><span className={`tag tag-${d.action}`}>{d.action.toUpperCase()}</span></td>
                    <td className="mono">{d.energy}</td>
                    <td className="mono" style={{ color: "#ffd700" }}>{d.quality}</td>
                    <td>{d.operator_id}</td>
                    <td style={{ color: "#4a6070", fontStyle: "italic", fontSize: 11 }}>{d.comment}</td>
                    <td className="mono" style={{ fontSize: 10, color: "#4a6070" }}>
                      {new Date(d.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ASSET HEALTH ─────────────────────────────────────────────────────────────
function AssetHealthView() {
  const latest     = anomalyData[anomalyData.length - 1];
  const health     = latest.healthScore;
  const healthCls  = health > 0.85 ? "health-good" : health > 0.65 ? "health-warn" : "health-bad";
  const isAlert    = latest.anomalyScore > 0.5;

  return (
    <div>
      {isAlert && (
        <div className="alert alert-danger mb">
          <span>⚠</span>
          <span>Anomaly detected in last 5 batches. Vibration RMS elevated above threshold. Recommend inspection of Machine Line 2.</span>
        </div>
      )}

      <div className="grid-3 mb">
        <div className="card flex-center gap">
          <div className={`health-ring ${healthCls}`}>
            <span className="health-val">{(health * 100).toFixed(0)}%</span>
          </div>
          <div>
            <div className="kpi-label">Machine Health</div>
            <div style={{ fontSize: 13, color: health > 0.85 ? "#00ff9d" : "#ffd700" }}>
              {health > 0.85 ? "NOMINAL" : "DEGRADED"}
            </div>
            <div className="text-muted mt">Line 2 · Batch #30</div>
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">Vibration RMS</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "Share Tech Mono", color: "#ff6b35" }}>
            {latest.vibrationRMS.toFixed(2)}<span className="kpi-unit">mm/s</span>
          </div>
          <div className="gauge-bar mt">
            <div className="gauge-fill" style={{ width: `${Math.min(100, latest.vibrationRMS * 60)}%`, background: "#ff6b35" }} />
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">Anomaly Score</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "Share Tech Mono", color: isAlert ? "#ff4545" : "#00ff9d" }}>
            {latest.anomalyScore.toFixed(3)}
          </div>
          <div className="text-muted mt">Isolation Forest · {isAlert ? "⚠ ALERT" : "✓ Normal"}</div>
        </div>
      </div>

      <div className="card mb">
        <div className="card-title">Vibration RMS & Anomaly Score — Last 30 Batches</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={anomalyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
            <XAxis dataKey="batch" tick={{ fill: "#4a6070", fontSize: 10 }} />
            <YAxis tick={{ fill: "#4a6070", fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="vibrationRMS"  stroke="#ff6b35" strokeWidth={1.5} dot={false} name="Vibration RMS" />
            <Line type="monotone" dataKey="anomalyScore"  stroke="#ff4545" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Anomaly Score" />
            <ReferenceLine y={1.2} stroke="#ffd700" strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="card-title">Power Consumption Pattern</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={anomalyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
            <XAxis dataKey="batch" tick={{ fill: "#4a6070", fontSize: 10 }} />
            <YAxis tick={{ fill: "#4a6070", fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="powerMean"   stroke="#00d4ff" strokeWidth={1.5} dot={false} name="Power Mean (kW)" />
            <Line type="monotone" dataKey="healthScore" stroke="#00ff9d" strokeWidth={1.5} dot={false} name="Health Score" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
const VIEWS = [
  { id: "overview",     icon: "◈", label: "Overview"         },
  { id: "optimization", icon: "⊕", label: "Optimization"     },
  { id: "golden",       icon: "◆", label: "Golden Signatures"},
  { id: "decisions",    icon: "⊞", label: "Decisions"        },
  { id: "health",       icon: "⊗", label: "Asset Health"     },
];

const VIEW_COMPONENTS = {
  overview: OverviewView, optimization: OptimizationView,
  golden: GoldenSignatureView, decisions: DecisionsView, health: AssetHealthView,
};

const VIEW_TITLES = {
  overview: "Production Overview",
  optimization: "Multi-Objective Optimization Engine",
  golden: "Golden Signature Management",
  decisions: "Human-in-the-Loop Decisions",
  health: "Energy Pattern & Asset Health",
};

export default function App() {
  const [view, setView] = useState("overview");
  const [time, setTime] = useState(new Date());
  const [apiOk, setApiOk] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch(`${API}/health`)
      .then(r => r.ok ? setApiOk(true) : setApiOk(false))
      .catch(() => setApiOk(false));
  }, []);

  const ActiveView = VIEW_COMPONENTS[view];

  return (
    <>
      <style>{css}</style>
      <div className="scanlines" />
      <div className="app">
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-name">Opti<span className="logo-dot">MFG</span></div>
            <div className="logo-sub">Manufacturing Intelligence</div>
          </div>
          <nav className="nav">
            {VIEWS.map(v => (
              <div key={v.id} className={`nav-item ${view === v.id ? "active" : ""}`}
                onClick={() => setView(v.id)}>
                <span>{v.icon}</span>{v.label}
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div>
              <span className="status-dot" style={{ background: apiOk ? "var(--accent2)" : apiOk === false ? "var(--danger)" : "var(--muted)" }} />
              {apiOk === null ? "Connecting..." : apiOk ? "API Connected" : "API Offline"}
            </div>
            <div style={{ marginTop: 4 }}>ML Models: <span style={{ color: "#ffd700" }}>Mock (ready to swap)</span></div>
            <div style={{ marginTop: 4, fontSize: 10 }}>v0.1.0 · Hackathon Build</div>
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            <div className="topbar-title">{VIEW_TITLES[view]}</div>
            <div className="flex-center gap">
              <span className="badge badge-live"><span className="pulse">●</span> LIVE</span>
              <span className="topbar-meta">{time.toLocaleTimeString()}</span>
            </div>
          </div>
          <div className="content">
            <ActiveView />
          </div>
        </div>
      </div>
    </>
  );
}