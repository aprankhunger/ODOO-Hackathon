import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PackageCheck, PackageOpen, Wrench, CalendarClock, ArrowLeftRight,
  Undo2, AlertTriangle, Plus, CalendarPlus, Hammer, X,
} from 'lucide-react';

const API = 'http://localhost:8001';

const KPI_CONFIG = [
  { key: 'assets_available', label: 'Assets Available', icon: PackageCheck, accent: 'bg-primary text-white' },
  { key: 'assets_allocated', label: 'Assets Allocated', icon: PackageOpen, accent: 'bg-accentYellow text-ink' },
  { key: 'maintenance_today', label: 'Maintenance Today', icon: Wrench, accent: 'bg-danger text-white' },
  { key: 'active_bookings', label: 'Active Bookings', icon: CalendarClock, accent: 'bg-primary text-white' },
  { key: 'pending_transfers', label: 'Pending Transfers', icon: ArrowLeftRight, accent: 'bg-accentYellow text-ink' },
  { key: 'upcoming_returns', label: 'Upcoming Returns', icon: Undo2, accent: 'bg-danger text-white' },
];

const ROLE_LABELS = {
  admin: 'Admin',
  department_head: 'Department Head',
  asset_manager: 'Asset Manager',
  employee: 'Employee',
};

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('ia_token');
    fetch(`${API}/api/dashboard/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load dashboard');
        return res.json();
      })
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const quickAction = (label) => {
    setToast(`${label} — this workflow is coming in an upcoming screen.`);
  };

  const formatReturnDate = (iso) => {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-black uppercase tracking-tight text-ink">
            Operations Dashboard
          </h1>
          <p className="text-muted text-sm mt-1">
            Welcome back, <span className="font-bold text-ink">{user?.name || 'User'}</span>
            {user?.role && (
              <span className="ml-2 inline-block border-2 border-ink bg-accentYellow text-ink px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
                {ROLE_LABELS[user.role] || user.role}
              </span>
            )}
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => quickAction('Register Asset')} className="btn-bauhaus bg-primary text-white px-3 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
            <Plus size={15} /> Register Asset
          </button>
          <button onClick={() => navigate('/bookings')} className="btn-bauhaus bg-accentYellow text-ink px-3 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
            <CalendarPlus size={15} /> Book Resource
          </button>
          <button onClick={() => quickAction('Raise Maintenance Request')} className="btn-bauhaus bg-danger text-white px-3 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
            <Hammer size={15} /> Maintenance
          </button>
        </div>
      </header>

      {toast && (
        <div className="border-2 border-ink bg-accentYellow text-ink px-4 py-3 text-sm font-medium flex items-center justify-between gap-3" role="status">
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="border-2 border-ink bg-danger text-white px-4 py-3 text-sm font-medium" role="alert">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <section aria-label="Key performance indicators" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {KPI_CONFIG.map(({ key, label, icon: Icon, accent }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-surface border-2 border-ink shadow-bauhaus p-4 flex flex-col gap-3"
          >
            <div className={`w-9 h-9 border-2 border-ink flex items-center justify-center ${accent}`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-3xl font-display font-black text-ink leading-none">
                {summary ? summary.kpis[key] : '—'}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted mt-1.5 text-pretty">{label}</p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Returns panels */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4" aria-label="Asset returns">
        {/* Overdue */}
        <div className="bg-surface border-2 border-ink shadow-bauhaus">
          <div className="border-b-2 border-ink bg-danger text-white px-4 py-3 flex items-center gap-2">
            <AlertTriangle size={16} />
            <h2 className="font-display font-black uppercase tracking-wide text-sm">
              Overdue Returns {summary ? `(${summary.overdue_returns.length})` : ''}
            </h2>
          </div>
          <ul className="divide-y-2 divide-ink">
            {summary && summary.overdue_returns.length === 0 && (
              <li className="px-4 py-6 text-sm text-muted text-center">No overdue returns. All clear.</li>
            )}
            {summary && summary.overdue_returns.map((item) => (
              <li key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-ink text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted font-mono">{item.asset_tag} · {item.assigned_to || 'Unassigned'}</p>
                </div>
                <span className="border-2 border-ink bg-danger text-white px-2 py-1 text-xs font-bold uppercase whitespace-nowrap">
                  {Math.abs(item.days_delta)}d overdue
                </span>
              </li>
            ))}
            {!summary && !error && (
              <li className="px-4 py-6 text-sm text-muted text-center">Loading…</li>
            )}
          </ul>
        </div>

        {/* Upcoming */}
        <div className="bg-surface border-2 border-ink shadow-bauhaus">
          <div className="border-b-2 border-ink bg-primary text-white px-4 py-3 flex items-center gap-2">
            <Undo2 size={16} />
            <h2 className="font-display font-black uppercase tracking-wide text-sm">
              Upcoming Returns (7 days) {summary ? `(${summary.upcoming_returns.length})` : ''}
            </h2>
          </div>
          <ul className="divide-y-2 divide-ink">
            {summary && summary.upcoming_returns.length === 0 && (
              <li className="px-4 py-6 text-sm text-muted text-center">No returns due this week.</li>
            )}
            {summary && summary.upcoming_returns.map((item) => (
              <li key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-ink text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted font-mono">{item.asset_tag} · {item.assigned_to || 'Unassigned'}</p>
                </div>
                <span className="border-2 border-ink bg-accentYellow text-ink px-2 py-1 text-xs font-bold uppercase whitespace-nowrap">
                  {formatReturnDate(item.expected_return_date)}
                </span>
              </li>
            ))}
            {!summary && !error && (
              <li className="px-4 py-6 text-sm text-muted text-center">Loading…</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
