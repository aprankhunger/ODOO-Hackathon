import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, ScrollText, Package, Wrench, CalendarCheck, CalendarX, CalendarClock,
  ArrowRightLeft, AlertTriangle, SearchX, CheckCheck, Check, PlusCircle, Search,
} from 'lucide-react';
import { timeAgo } from '../components/NotificationBell';

const API_BASE = 'http://localhost:8001';

const TYPE_ICONS = {
  asset_assigned: Package,
  asset_registered: PlusCircle,
  maintenance_approved: Wrench,
  maintenance_rejected: Wrench,
  booking_confirmed: CalendarCheck,
  booking_cancelled: CalendarX,
  booking_reminder: CalendarClock,
  transfer_approved: ArrowRightLeft,
  overdue_return: AlertTriangle,
  audit_discrepancy: SearchX,
};

const SEVERITY_STYLES = {
  info: { bar: 'bg-primary', chip: 'bg-primary text-white' },
  success: { bar: 'bg-success', chip: 'bg-success text-white' },
  warning: { bar: 'bg-accentYellow', chip: 'bg-accentYellow text-ink' },
  danger: { bar: 'bg-danger', chip: 'bg-danger text-white' },
};

const ROLE_BADGES = {
  admin: 'bg-primary text-white',
  manager: 'bg-success text-white',
  employee: 'bg-surfaceHover text-ink',
  technician: 'bg-accentYellow text-ink',
  system: 'bg-ink text-white',
};

const SEVERITY_FILTERS = ['all', 'info', 'success', 'warning', 'danger'];

const formatTimestamp = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const ActivityLog = () => {
  const [tab, setTab] = useState('notifications');

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [severityFilter, setSeverityFilter] = useState('all');

  // Audit log state
  const [logs, setLogs] = useState([]);
  const [actionTypes, setActionTypes] = useState([]);
  const [actionFilter, setActionFilter] = useState('');
  const [actorSearch, setActorSearch] = useState('');

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications?limit=50`);
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // backend unreachable
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      if (actorSearch) params.set('actor', actorSearch);
      const res = await fetch(`${API_BASE}/api/audit-logs?${params.toString()}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setActionTypes(data.action_types || []);
    } catch {
      // backend unreachable
    }
  }, [actionFilter, actorSearch]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Live updates via WebSocket
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8001/ws/dashboard');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'notification' && data.notification) {
          setNotifications((prev) => [data.notification, ...prev]);
          setUnreadCount((prev) => prev + 1);
          fetchLogs();
        }
      } catch {
        // ignore
      }
    };
    return () => ws.close();
  }, [fetchLogs]);

  const markRead = async (id) => {
    try {
      await fetch(`${API_BASE}/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API_BASE}/api/notifications/read-all`, { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const visibleNotifications = severityFilter === 'all'
    ? notifications
    : notifications.filter((n) => n.severity === severityFilter);

  const tabClass = (active) =>
    `flex items-center gap-2 px-4 py-2.5 border-2 border-ink font-bold uppercase text-xs md:text-sm tracking-wide transition-all ${
      active ? 'bg-primary text-white shadow-bauhaus-sm' : 'bg-surface text-ink hover:bg-surfaceHover'
    }`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-2">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-4 h-4 bg-accentYellow border-2 border-ink" aria-hidden="true"></div>
            <h2 className="text-3xl font-display font-black uppercase tracking-tight text-balance">Activity & Notifications</h2>
          </div>
          <p className="text-muted text-sm font-medium">Every action across the fleet — who did what, and when.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-3">
        <button onClick={() => setTab('notifications')} className={tabClass(tab === 'notifications')}>
          <Bell size={16} />
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="min-w-[20px] h-5 px-1 bg-danger border border-ink rounded-full flex items-center justify-center text-[10px] font-black text-white">
              {unreadCount}
            </span>
          )}
        </button>
        <button onClick={() => setTab('audit')} className={tabClass(tab === 'audit')}>
          <ScrollText size={16} />
          <span>Audit Log</span>
        </button>
      </div>

      {tab === 'notifications' ? (
        <div className="glass-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-ink pb-4 mb-4">
            {/* Severity filter chips */}
            <div className="flex flex-wrap gap-2">
              {SEVERITY_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={`px-3 py-1.5 border-2 border-ink text-xs font-bold uppercase tracking-wide transition-all ${
                    severityFilter === s
                      ? (s === 'all' ? 'bg-ink text-white' : SEVERITY_STYLES[s].chip) + ' shadow-bauhaus-sm'
                      : 'bg-surface text-ink hover:bg-surfaceHover'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary hover:text-ink transition-colors flex-shrink-0"
              >
                <CheckCheck size={15} /> Mark all read
              </button>
            )}
          </div>

          {visibleNotifications.length === 0 ? (
            <p className="text-muted text-sm py-10 text-center font-medium">No notifications match this filter.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {visibleNotifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                const sev = SEVERITY_STYLES[n.severity] || SEVERITY_STYLES.info;
                return (
                  <li
                    key={n.id}
                    className={`flex gap-0 border-2 border-ink overflow-hidden ${n.is_read ? 'bg-surface opacity-70' : 'bg-surfaceHover'}`}
                  >
                    <div className={`w-2 flex-shrink-0 ${sev.bar}`} aria-hidden="true"></div>
                    <div className="flex gap-3 p-4 flex-1 min-w-0 items-start">
                      <div className="p-2 border-2 border-ink bg-surface flex-shrink-0">
                        <Icon size={18} className="text-ink" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-sm text-ink">{n.title}</p>
                          <span className={`px-2 py-0.5 border border-ink text-[10px] font-bold uppercase tracking-widest ${sev.chip}`}>{n.severity}</span>
                          {!n.is_read && <span className="w-2 h-2 rounded-full bg-danger border border-ink" aria-label="Unread"></span>}
                        </div>
                        <p className="text-sm text-muted leading-relaxed mt-1">{n.message}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted mt-2">{timeAgo(n.created_at)} — {formatTimestamp(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <button
                          onClick={() => markRead(n.id)}
                          aria-label={`Mark "${n.title}" as read`}
                          className="p-2 border-2 border-ink bg-surface hover:bg-success hover:text-white transition-colors flex-shrink-0"
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="glass-card p-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 border-b-2 border-ink pb-4 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="text"
                value={actorSearch}
                onChange={(e) => setActorSearch(e.target.value)}
                placeholder="Search actor..."
                aria-label="Search by actor"
                className="w-full pl-9 pr-3 py-2 border-2 border-ink bg-surface text-sm font-medium focus:outline-none focus:bg-surfaceHover"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              aria-label="Filter by action type"
              className="px-3 py-2 border-2 border-ink bg-surface text-sm font-bold uppercase tracking-wide focus:outline-none cursor-pointer"
            >
              <option value="">All actions</option>
              {actionTypes.map((a) => (
                <option key={a} value={a}>{a.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </div>

          {logs.length === 0 ? (
            <p className="text-muted text-sm py-10 text-center font-medium">No audit entries match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-ink text-left">
                    <th className="py-3 pr-4 text-xs font-bold uppercase tracking-widest text-muted">Timestamp</th>
                    <th className="py-3 pr-4 text-xs font-bold uppercase tracking-widest text-muted">Actor</th>
                    <th className="py-3 pr-4 text-xs font-bold uppercase tracking-widest text-muted">Action</th>
                    <th className="py-3 pr-4 text-xs font-bold uppercase tracking-widest text-muted">Target</th>
                    <th className="py-3 text-xs font-bold uppercase tracking-widest text-muted">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-ink/15 last:border-b-0 align-top hover:bg-surfaceHover/50">
                      <td className="py-3 pr-4 whitespace-nowrap font-medium text-muted">{formatTimestamp(log.created_at)}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{log.actor}</span>
                          <span className={`px-1.5 py-0.5 border border-ink text-[9px] font-bold uppercase tracking-widest ${ROLE_BADGES[log.actor_role] || ROLE_BADGES.system}`}>
                            {log.actor_role}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span className="px-2 py-1 border-2 border-ink bg-surfaceHover text-[10px] font-bold uppercase tracking-wide">
                          {log.action.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap font-mono font-bold text-xs">{log.target || '—'}</td>
                      <td className="py-3 text-muted leading-relaxed min-w-[200px]">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default ActivityLog;
