import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Package, Wrench, CalendarCheck, CalendarX, CalendarClock,
  ArrowRightLeft, AlertTriangle, SearchX, CheckCheck, PlusCircle,
} from 'lucide-react';

import { API_BASE, WS_BASE } from '../lib/api';

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

const SEVERITY_BARS = {
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-accentYellow',
  danger: 'bg-danger',
};

export const timeAgo = (iso) => {
  if (!iso) return '';
  const seconds = Math.floor((Date.now() - new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const NotificationBell = ({ role = 'admin' }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications?role=${role}&limit=8`);
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // backend unreachable — leave state as-is
    }
  }, [role]);

  useEffect(() => {
    fetchNotifications();

    const ws = new WebSocket(`${WS_BASE}/ws/dashboard`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'notification' && data.notification) {
          const n = data.notification;
          if (n.recipient_role === role || n.recipient_role === 'all') {
            setNotifications((prev) => [n, ...prev].slice(0, 8));
            setUnreadCount((prev) => prev + 1);
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => ws.close();
  }, [role, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markAllRead = async () => {
    try {
      await fetch(`${API_BASE}/api/notifications/read-all`, { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className="relative p-2.5 border-2 border-ink bg-surface hover:bg-surfaceHover transition-colors shadow-bauhaus-sm"
      >
        <Bell size={18} className="text-ink" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 bg-danger border-2 border-ink rounded-full flex items-center justify-center text-[10px] font-black text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 md:right-auto md:left-0 top-full mt-2 md:top-auto md:bottom-full md:mt-0 md:mb-2 w-[320px] sm:w-[380px] bg-surface border-2 border-ink shadow-bauhaus-lg z-50"
          >
            <div className="flex items-center justify-between border-b-2 border-ink px-4 py-3">
              <h3 className="font-display font-black uppercase text-sm tracking-tight">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-primary hover:text-ink transition-colors"
                >
                  <CheckCheck size={14} /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[360px] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-muted text-sm p-6 text-center font-medium">No notifications yet.</p>
              ) : (
                notifications.map((n) => {
                  const Icon = TYPE_ICONS[n.type] || Bell;
                  return (
                    <div
                      key={n.id}
                      className={`flex gap-3 px-4 py-3 border-b border-ink/15 last:border-b-0 ${n.is_read ? 'opacity-60' : 'bg-surfaceHover/60'}`}
                    >
                      <div className={`w-1.5 flex-shrink-0 ${SEVERITY_BARS[n.severity] || 'bg-primary'} border border-ink`} aria-hidden="true"></div>
                      <Icon size={18} className="flex-shrink-0 mt-0.5 text-ink" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-ink truncate">{n.title}</p>
                          {!n.is_read && <span className="w-2 h-2 rounded-full bg-danger border border-ink flex-shrink-0" aria-label="Unread"></span>}
                        </div>
                        <p className="text-xs text-muted leading-relaxed line-clamp-2">{n.message}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {role === 'admin' && (
              <Link
                to="/activity"
                onClick={() => setOpen(false)}
                className="block text-center border-t-2 border-ink px-4 py-3 font-bold uppercase text-xs tracking-widest bg-primary text-white hover:bg-ink transition-colors"
              >
                View all activity
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
