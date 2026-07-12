import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Download, AlertTriangle, TrendingUp, Wrench, Building2, Flame, ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell,
} from 'recharts';

const API = 'http://localhost:8001';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('ia_token')}`,
});

// Bauhaus palette (matches tailwind tokens)
const C = {
  primary: '#1d4ed8',
  yellow: '#f5c518',
  danger: '#dc2626',
  ink: '#111111',
  muted: '#6b7280',
  surface: '#ffffff',
};

const ATTENTION_META = {
  overdue_return: { label: 'Overdue Return', chip: 'bg-danger text-white' },
  lost: { label: 'Lost', chip: 'bg-ink text-white' },
  under_maintenance: { label: 'Under Maintenance', chip: 'bg-accentYellow text-ink' },
  nearing_retirement: { label: 'Nearing Retirement', chip: 'bg-primary text-white' },
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HEAT_HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 - 20:00

// --- CSV helpers -----------------------------------------------------------

const toCsv = (headers, rows) => {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
};

const downloadCsv = (filename, csv) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const buildSections = (data) => ({
  utilization: {
    filename: 'utilization.csv',
    headers: ['Asset Tag', 'Name', 'Type', 'Utilization %', 'Usage', 'Status'],
    rows: data.utilization.all.map((u) => [u.asset_tag, u.name, u.is_bookable ? 'Bookable' : 'Allocatable', u.utilization_pct, u.measure, u.status]),
  },
  maintenance: {
    filename: 'maintenance-frequency.csv',
    headers: ['Asset Tag', 'Name', 'Requests'],
    rows: data.maintenance.by_asset.map((m) => [m.asset_tag, m.name, m.requests]),
  },
  attention: {
    filename: 'attention-list.csv',
    headers: ['Asset Tag', 'Name', 'Flag', 'Detail'],
    rows: data.attention.map((a) => [a.asset_tag, a.name, ATTENTION_META[a.type]?.label || a.type, a.detail]),
  },
  departments: {
    filename: 'department-summary.csv',
    headers: ['Department', 'Total', 'Allocated', 'Available', 'Maintenance', 'Lost', 'Open Maintenance'],
    rows: data.department_summary.map((d) => [d.department, d.total, d.allocated, d.available, d.maintenance, d.lost, d.open_maintenance]),
  },
  heatmap: {
    filename: 'booking-heatmap.csv',
    headers: ['Day', ...HEAT_HOURS.map((h) => `${h}:00`)],
    rows: DAY_LABELS.map((day, di) => [day, ...HEAT_HOURS.map((h) => data.booking_heatmap[di][h])]),
  },
});

// --- Small building blocks --------------------------------------------------

const SectionCard = ({ icon: Icon, title, subtitle, onExport, children, accent = 'bg-primary' }) => (
  <section className="bg-surface border-2 border-ink shadow-bauhaus">
    <div className="flex items-center justify-between border-b-2 border-ink px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className={`${accent} text-white p-1.5 border-2 border-ink`} aria-hidden="true">
          <Icon size={15} />
        </span>
        <div>
          <h2 className="font-bold uppercase tracking-widest text-sm text-ink">{title}</h2>
          {subtitle && <p className="text-[11px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {onExport && (
        <button
          onClick={onExport}
          className="btn-bauhaus bg-surface text-ink border-2 border-ink px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5"
        >
          <Download size={13} /> CSV
        </button>
      )}
    </div>
    <div className="p-4">{children}</div>
  </section>
);

const Kpi = ({ label, value, sub, accent = 'bg-primary text-white' }) => (
  <div className="bg-surface border-2 border-ink shadow-bauhaus px-4 py-3 flex-1 min-w-[150px]">
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted">{label}</p>
    <p className="text-2xl font-bold text-ink mt-1">{value}</p>
    {sub && <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-bold uppercase ${accent}`}>{sub}</span>}
  </div>
);

const heatColor = (count, max) => {
  if (!count) return { backgroundColor: '#f3f4f6', color: '#9ca3af' };
  const t = Math.min(count / Math.max(max, 1), 1);
  if (t < 0.34) return { backgroundColor: '#bfdbfe', color: C.ink };
  if (t < 0.67) return { backgroundColor: '#3b82f6', color: '#fff' };
  return { backgroundColor: C.primary, color: '#fff' };
};

// --- Page --------------------------------------------------------------------

const Reports = ({ user }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const isManager = ['admin', 'department_head', 'asset_manager'].includes(user?.role);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(`${API}/api/reports`, { headers: authHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || 'Failed to load reports');
      setData(body);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (isManager) load();
  }, [isManager, load]);

  if (!isManager) {
    return (
      <div className="max-w-xl mx-auto mt-16 bg-surface border-2 border-ink shadow-bauhaus p-6 text-center">
        <ShieldAlert size={28} className="mx-auto text-danger" aria-hidden="true" />
        <h1 className="font-bold uppercase tracking-widest text-ink mt-3">Managers Only</h1>
        <p className="text-sm text-muted mt-2">
          Reports &amp; Analytics are available to Asset Managers, Department Heads, and Admins.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-16 bg-surface border-2 border-ink shadow-bauhaus p-6 text-center">
        <AlertTriangle size={28} className="mx-auto text-danger" aria-hidden="true" />
        <p className="text-sm text-ink mt-3">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-muted mt-16 text-sm uppercase tracking-widest">Loading reports…</p>;
  }

  const sections = buildSections(data);
  const exportSection = (key) => downloadCsv(sections[key].filename, toCsv(sections[key].headers, sections[key].rows));
  const exportAll = () => {
    const combined = Object.entries(sections)
      .map(([key, s]) => `# ${key.toUpperCase()}\n${toCsv(s.headers, s.rows)}`)
      .join('\n\n');
    downloadCsv('intelliasset-report.csv', combined);
  };

  const topUtil = data.utilization.all.filter((u) => u.utilization_pct > 0).slice(0, 8);
  const maxHeat = Math.max(...data.booking_heatmap.flat(), 1);
  const deptChart = data.department_summary.filter((d) => d.department !== 'Unassigned');

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-ink text-white p-2 border-2 border-ink" aria-hidden="true">
            <BarChart3 size={18} />
          </span>
          <div>
            <h1 className="text-xl font-bold uppercase tracking-widest text-ink">Reports &amp; Analytics</h1>
            <p className="text-xs text-muted">
              Generated {new Date(data.generated_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · 90-day window
            </p>
          </div>
        </div>
        <button
          onClick={exportAll}
          className="btn-bauhaus bg-ink text-white px-3 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5"
        >
          <Download size={15} /> Export All
        </button>
      </div>

      {/* KPI strip */}
      <div className="flex flex-wrap gap-4">
        <Kpi label="Total Assets" value={data.kpis.total_assets} />
        <Kpi label="Avg Utilization" value={`${data.kpis.avg_utilization_pct}%`} sub="90 days" accent="bg-primary text-white" />
        <Kpi label="Open Maintenance" value={data.kpis.open_maintenance} sub={data.kpis.open_maintenance > 0 ? 'Action needed' : 'All clear'} accent={data.kpis.open_maintenance > 0 ? 'bg-danger text-white' : 'bg-accentYellow text-ink'} />
        <Kpi label="Bookings This Week" value={data.kpis.bookings_this_week} sub="Upcoming + ongoing" accent="bg-accentYellow text-ink" />
      </div>

      {/* Utilization */}
      <SectionCard
        icon={TrendingUp}
        title="Asset Utilization"
        subtitle="Most-used vs. idle assets over the last 90 days"
        onExport={() => exportSection('utilization')}
      >
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1 min-w-0">
            {topUtil.length === 0 ? (
              <p className="text-sm text-muted">No utilization recorded in this window.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(topUtil.length * 42, 120)}>
                <BarChart data={topUtil} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <YAxis type="category" dataKey="asset_tag" width={72} tick={{ fontSize: 11, fontWeight: 700 }} />
                  <Tooltip
                    formatter={(v) => [`${v}%`, 'Utilization']}
                    labelFormatter={(tag) => {
                      const row = topUtil.find((u) => u.asset_tag === tag);
                      return row ? `${row.name} — ${row.measure}` : tag;
                    }}
                  />
                  <Bar dataKey="utilization_pct" radius={0}>
                    {topUtil.map((u) => (
                      <Cell key={u.asset_tag} fill={u.is_bookable ? C.yellow : C.primary} stroke={C.ink} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex gap-4 mt-2 text-[11px] font-bold uppercase tracking-wide text-muted">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 inline-block border border-ink" style={{ backgroundColor: C.primary }} /> Allocatable</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 inline-block border border-ink" style={{ backgroundColor: C.yellow }} /> Bookable</span>
            </div>
          </div>
          <div className="lg:w-72 flex-shrink-0">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink border-b-2 border-ink pb-1.5">
              Idle Assets ({data.utilization.idle.length})
            </h3>
            <ul className="mt-2 flex flex-col gap-1.5 max-h-56 overflow-y-auto">
              {data.utilization.idle.length === 0 && <li className="text-sm text-muted">None — everything is in use.</li>}
              {data.utilization.idle.map((u) => (
                <li key={u.asset_tag} className="flex items-center justify-between text-sm">
                  <span className="text-ink font-medium truncate">{u.name}</span>
                  <span className="text-[10px] font-bold uppercase bg-ink text-white px-1.5 py-0.5 ml-2 flex-shrink-0">{u.asset_tag}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>

      {/* Maintenance frequency */}
      <SectionCard
        icon={Wrench}
        title="Maintenance Frequency"
        subtitle={`${data.maintenance.total_requests} total request(s)${data.maintenance.avg_resolution_hours != null ? ` · avg resolution ${data.maintenance.avg_resolution_hours} hrs` : ''}`}
        onExport={() => exportSection('maintenance')}
        accent="bg-danger"
      >
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink mb-2">By Category</h3>
            {data.maintenance.by_category.length === 0 ? (
              <p className="text-sm text-muted">No maintenance requests yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(data.maintenance.by_category.length * 46, 100)}>
                <BarChart data={data.maintenance.by_category} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="category" width={110} tick={{ fontSize: 11, fontWeight: 700 }} />
                  <Tooltip formatter={(v) => [v, 'Requests']} />
                  <Bar dataKey="requests" fill={C.danger} stroke={C.ink} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink mb-2">Top Problem Assets</h3>
            {data.maintenance.by_asset.length === 0 ? (
              <p className="text-sm text-muted">No repeat offenders.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-ink text-left text-[11px] font-bold uppercase tracking-widest text-muted">
                    <th className="py-1.5 pr-2">Asset</th>
                    <th className="py-1.5 pr-2">Tag</th>
                    <th className="py-1.5 text-right">Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {data.maintenance.by_asset.map((m) => (
                    <tr key={m.asset_tag} className="border-b border-ink/10">
                      <td className="py-1.5 pr-2 text-ink font-medium">{m.name}</td>
                      <td className="py-1.5 pr-2 text-muted">{m.asset_tag}</td>
                      <td className="py-1.5 text-right">
                        <span className={`inline-block px-2 py-0.5 text-[11px] font-bold ${m.requests >= 3 ? 'bg-danger text-white' : 'bg-accentYellow text-ink'}`}>
                          {m.requests}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Attention list */}
      <SectionCard
        icon={AlertTriangle}
        title="Needs Attention"
        subtitle="Overdue returns, maintenance, retirement candidates, and lost assets"
        onExport={() => exportSection('attention')}
        accent="bg-ink"
      >
        {data.attention.length === 0 ? (
          <p className="text-sm text-muted">Nothing needs attention right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b-2 border-ink text-left text-[11px] font-bold uppercase tracking-widest text-muted">
                  <th className="py-1.5 pr-3">Asset</th>
                  <th className="py-1.5 pr-3">Tag</th>
                  <th className="py-1.5 pr-3">Flag</th>
                  <th className="py-1.5">Detail</th>
                </tr>
              </thead>
              <tbody>
                {data.attention.map((a, i) => {
                  const meta = ATTENTION_META[a.type] || { label: a.type, chip: 'bg-muted text-white' };
                  return (
                    <tr key={`${a.asset_tag}-${a.type}-${i}`} className="border-b border-ink/10">
                      <td className="py-2 pr-3 text-ink font-medium">{a.name}</td>
                      <td className="py-2 pr-3 text-muted">{a.asset_tag}</td>
                      <td className="py-2 pr-3">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.chip}`}>{meta.label}</span>
                      </td>
                      <td className="py-2 text-muted">{a.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Department summary */}
      <SectionCard
        icon={Building2}
        title="Department Summary"
        subtitle="Allocation and health per department"
        onExport={() => exportSection('departments')}
      >
        <div className="flex flex-col gap-5">
          {deptChart.length > 0 && (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={deptChart} margin={{ right: 16 }}>
                <XAxis dataKey="department" tick={{ fontSize: 11, fontWeight: 700 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }} />
                <Bar dataKey="allocated" name="Allocated" stackId="a" fill={C.primary} stroke={C.ink} />
                <Bar dataKey="available" name="Available" stackId="a" fill={C.yellow} stroke={C.ink} />
                <Bar dataKey="maintenance" name="Maintenance" stackId="a" fill={C.danger} stroke={C.ink} />
                <Bar dataKey="lost" name="Lost" stackId="a" fill={C.ink} stroke={C.ink} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b-2 border-ink text-left text-[11px] font-bold uppercase tracking-widest text-muted">
                  <th className="py-1.5 pr-3">Department</th>
                  <th className="py-1.5 pr-3 text-right">Total</th>
                  <th className="py-1.5 pr-3 text-right">Allocated</th>
                  <th className="py-1.5 pr-3 text-right">Available</th>
                  <th className="py-1.5 pr-3 text-right">Maintenance</th>
                  <th className="py-1.5 pr-3 text-right">Lost</th>
                  <th className="py-1.5 text-right">Open Repairs</th>
                </tr>
              </thead>
              <tbody>
                {data.department_summary.map((d) => (
                  <tr key={d.department} className="border-b border-ink/10">
                    <td className="py-1.5 pr-3 text-ink font-medium">{d.department}</td>
                    <td className="py-1.5 pr-3 text-right font-bold text-ink">{d.total}</td>
                    <td className="py-1.5 pr-3 text-right">{d.allocated}</td>
                    <td className="py-1.5 pr-3 text-right">{d.available}</td>
                    <td className="py-1.5 pr-3 text-right">{d.maintenance}</td>
                    <td className="py-1.5 pr-3 text-right">{d.lost}</td>
                    <td className="py-1.5 text-right">{d.open_maintenance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      {/* Booking heatmap */}
      <SectionCard
        icon={Flame}
        title="Booking Heatmap"
        subtitle="Peak usage windows — bookings per hour (last 60 days + upcoming)"
        onExport={() => exportSection('heatmap')}
        accent="bg-accentYellow"
      >
        <div className="overflow-x-auto">
          <div
            className="grid gap-[3px] min-w-[640px]"
            style={{ gridTemplateColumns: `56px repeat(${HEAT_HOURS.length}, minmax(30px, 1fr))` }}
            role="table"
            aria-label="Booking heatmap by day and hour"
          >
            <div />
            {HEAT_HOURS.map((h) => (
              <div key={h} className="text-center text-[10px] font-bold text-muted" role="columnheader">
                {h}
              </div>
            ))}
            {DAY_LABELS.map((day, di) => (
              <React.Fragment key={day}>
                <div className="text-[11px] font-bold uppercase tracking-wide text-ink flex items-center" role="rowheader">
                  {day}
                </div>
                {HEAT_HOURS.map((h) => {
                  const count = data.booking_heatmap[di][h];
                  return (
                    <div
                      key={`${day}-${h}`}
                      className="h-7 border border-ink/20 flex items-center justify-center text-[10px] font-bold"
                      style={heatColor(count, maxHeat)}
                      title={`${day} ${h}:00–${h + 1}:00 — ${count} booking(s)`}
                      role="cell"
                    >
                      {count > 0 ? count : ''}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 text-[11px] font-bold uppercase tracking-wide text-muted">
          <span>Low</span>
          <span className="w-4 h-4 inline-block border border-ink/30" style={{ backgroundColor: '#f3f4f6' }} />
          <span className="w-4 h-4 inline-block border border-ink/30" style={{ backgroundColor: '#bfdbfe' }} />
          <span className="w-4 h-4 inline-block border border-ink/30" style={{ backgroundColor: '#3b82f6' }} />
          <span className="w-4 h-4 inline-block border border-ink/30" style={{ backgroundColor: C.primary }} />
          <span>High</span>
        </div>
      </SectionCard>
    </div>
  );
};

export default Reports;
