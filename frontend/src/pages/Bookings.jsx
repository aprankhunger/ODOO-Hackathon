import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, X, Check, AlertTriangle,
} from 'lucide-react';

const API = 'http://localhost:8001';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8:00 - 20:00
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_CHIP = {
  upcoming: 'bg-primary text-white',
  ongoing: 'bg-accentYellow text-ink',
  completed: 'bg-surface text-ink',
  cancelled: 'bg-danger text-white',
};

const inputClass =
  'w-full bg-surface border-2 border-ink px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:shadow-bauhaus-sm transition-shadow';
const labelClass = 'block text-[11px] font-bold uppercase tracking-widest text-ink mb-1';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('ia_token')}`,
});

// Monday of the week containing `d` (local time)
const weekStartOf = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7; // Mon=0
  date.setDate(date.getDate() - day);
  return date;
};

const toLocalISO = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
};

const fmtTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const fmtDateTime = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const Bookings = ({ user }) => {
  const [resources, setResources] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const [bookings, setBookings] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Booking form: { date, start, end, rescheduleId? }
  const [form, setForm] = useState(null);
  const [conflictMsg, setConflictMsg] = useState('');

  const loadResources = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/resources`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load resources');
      const data = await res.json();
      setResources(data.resources);
      if (data.resources.length > 0) {
        setSelectedId((prev) => prev || data.resources[0].id);
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadBookings = useCallback(async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(
        `${API}/api/resources/${selectedId}/bookings?week_start=${toLocalISO(weekStart)}`,
        { headers: authHeaders() },
      );
      if (!res.ok) throw new Error('Failed to load bookings');
      const data = await res.json();
      setBookings(data.bookings);
    } catch (err) {
      setError(err.message);
    }
  }, [selectedId, weekStart]);

  const loadMyBookings = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/my-bookings`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load your bookings');
      const data = await res.json();
      setMyBookings(data.bookings);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { loadResources(); loadMyBookings(); }, [loadResources, loadMyBookings]);
  useEffect(() => { loadBookings(); }, [loadBookings]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const send = async (path, method, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data.detail;
      const err = new Error(typeof detail === 'object' ? detail.message : detail || 'Request failed');
      err.detail = detail;
      throw err;
    }
    return data;
  };

  const openNewBooking = (date, hour) => {
    setConflictMsg('');
    const d = date || new Date();
    const pad = (n) => String(n).padStart(2, '0');
    setForm({
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      start: hour != null ? `${pad(hour)}:00` : '09:00',
      end: hour != null ? `${pad(hour + 1)}:00` : '10:00',
      rescheduleId: null,
    });
  };

  const openReschedule = (b) => {
    setConflictMsg('');
    const start = new Date(b.start_time);
    const end = new Date(b.end_time);
    const pad = (n) => String(n).padStart(2, '0');
    setSelectedId(b.asset_item_id);
    setForm({
      date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      start: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      end: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
      rescheduleId: b.id,
    });
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    setConflictMsg('');
    const body = {
      asset_item_id: selectedId,
      start_time: `${form.date}T${form.start}:00`,
      end_time: `${form.date}T${form.end}:00`,
    };
    try {
      if (form.rescheduleId) {
        await send(`/api/bookings/${form.rescheduleId}`, 'PUT', body);
        setToast('Booking rescheduled.');
      } else {
        await send('/api/bookings', 'POST', body);
        setToast('Booking confirmed.');
      }
      setForm(null);
      loadBookings();
      loadMyBookings();
    } catch (err) {
      if (err.detail && err.detail.code === 'overlap') {
        setConflictMsg(err.detail.message);
      } else {
        setConflictMsg(err.message);
      }
    }
  };

  const cancelBooking = async (id) => {
    try {
      await send(`/api/bookings/${id}/cancel`, 'POST');
      setToast('Booking cancelled.');
      loadBookings();
      loadMyBookings();
    } catch (err) {
      setError(err.message);
    }
  };

  const shiftWeek = (delta) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
  };

  const selectedResource = resources.find((r) => r.id === selectedId);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Bookings placed on the grid: for each day column, blocks positioned by hour
  const bookingsForDay = (day) => {
    const dayStart = new Date(day);
    const dayEnd = new Date(day);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return bookings.filter((b) => {
      const s = new Date(b.start_time);
      return s >= dayStart && s < dayEnd;
    });
  };

  const now = new Date();

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-ink text-balance">
            Resource Booking
          </h1>
          <p className="text-sm text-muted mt-1">Time-slot booking of shared resources — no overlaps.</p>
        </div>
        <button
          onClick={() => openNewBooking()}
          className="flex items-center gap-2 px-4 py-2 border-2 border-ink bg-primary text-white text-xs font-bold uppercase tracking-widest hover:bg-ink transition-colors w-fit"
        >
          <Plus size={15} /> New Booking
        </button>
      </header>

      {toast && (
        <div className="border-2 border-ink bg-accentYellow text-ink px-4 py-2 text-sm font-bold flex items-center gap-2" role="status">
          <Check size={16} /> {toast}
        </div>
      )}
      {error && (
        <div className="border-2 border-ink bg-danger text-white px-4 py-2 text-sm font-bold flex items-center justify-between gap-2" role="alert">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button>
        </div>
      )}

      {/* Resource picker + week nav */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {resources.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`px-3 py-1.5 border-2 border-ink text-xs font-bold uppercase tracking-widest transition-colors ${r.id === selectedId ? 'bg-ink text-white' : 'bg-surface text-ink hover:bg-accentYellow'}`}
            >
              {r.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-1)} aria-label="Previous week" className="p-1.5 border-2 border-ink bg-surface text-ink hover:bg-accentYellow transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-bold uppercase tracking-widest text-ink whitespace-nowrap">
            {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
          <button onClick={() => shiftWeek(1)} aria-label="Next week" className="p-1.5 border-2 border-ink bg-surface text-ink hover:bg-accentYellow transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Week calendar grid */}
      <div className="border-2 border-ink bg-surface shadow-bauhaus overflow-x-auto">
        <div className="min-w-[840px]">
          {/* Header row */}
          <div className="grid border-b-2 border-ink" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
            <div className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-muted border-r border-ink/20" />
            {days.map((d, i) => {
              const isToday = d.toDateString() === now.toDateString();
              return (
                <div key={i} className={`px-2 py-2 text-center border-r border-ink/20 last:border-r-0 ${isToday ? 'bg-accentYellow' : ''}`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink">{DAY_LABELS[i]}</p>
                  <p className="text-sm font-black text-ink">{d.getDate()}</p>
                </div>
              );
            })}
          </div>
          {/* Hour rows */}
          {HOURS.map((hour) => (
            <div key={hour} className="grid border-b border-ink/20 last:border-b-0" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
              <div className="px-2 py-1 text-[10px] font-mono text-muted border-r border-ink/20 flex items-start">
                {String(hour).padStart(2, '0')}:00
              </div>
              {days.map((d, i) => {
                const cellBookings = bookingsForDay(d).filter((b) => {
                  const s = new Date(b.start_time);
                  return s.getHours() === hour;
                });
                return (
                  <button
                    key={i}
                    onClick={() => cellBookings.length === 0 && openNewBooking(d, hour)}
                    className={`relative min-h-[38px] border-r border-ink/20 last:border-r-0 text-left px-1 py-0.5 transition-colors ${cellBookings.length === 0 ? 'hover:bg-accentYellow/40 cursor-pointer' : 'cursor-default'}`}
                    aria-label={cellBookings.length === 0 ? `Book ${selectedResource?.name || 'resource'} ${DAY_LABELS[i]} ${hour}:00` : undefined}
                  >
                    {cellBookings.map((b) => (
                      <span
                        key={b.id}
                        className={`block w-full px-1.5 py-1 text-[10px] font-bold border border-ink leading-tight ${b.user_id === user?.id ? 'bg-primary text-white' : 'bg-ink text-white'}`}
                      >
                        {fmtTime(b.start_time)}–{fmtTime(b.end_time)}
                        <span className="block font-normal truncate">{b.user_name}</span>
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* My bookings */}
      <section className="border-2 border-ink bg-surface shadow-bauhaus">
        <div className="flex items-center gap-2 border-b-2 border-ink px-4 py-3">
          <CalendarDays size={16} className="text-ink" />
          <h2 className="font-bold uppercase tracking-widest text-sm text-ink">My Bookings</h2>
        </div>
        {myBookings.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">You have no bookings yet.</p>
        ) : (
          <ul className="divide-y divide-ink/20">
            {myBookings.map((b) => (
              <li key={b.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink">{b.resource_name} <span className="font-mono text-xs text-muted">{b.asset_tag}</span></p>
                  <p className="text-xs text-muted">{fmtDateTime(b.start_time)} → {fmtTime(b.end_time)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border border-ink ${STATUS_CHIP[b.status]}`}>
                    {b.status}
                  </span>
                  {b.status === 'upcoming' && (
                    <>
                      <button
                        onClick={() => openReschedule(b)}
                        className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest border-2 border-ink bg-surface text-ink hover:bg-accentYellow transition-colors"
                      >
                        Reschedule
                      </button>
                      <button
                        onClick={() => cancelBooking(b.id)}
                        className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest border-2 border-ink bg-surface text-ink hover:bg-danger hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Booking form modal */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60" role="dialog" aria-modal="true">
          <div className="bg-surface border-2 border-ink shadow-bauhaus-lg w-full max-w-md">
            <div className="flex items-center justify-between border-b-2 border-ink px-4 py-3">
              <h3 className="font-bold uppercase tracking-widest text-sm text-ink">
                {form.rescheduleId ? 'Reschedule Booking' : `Book ${selectedResource?.name || 'Resource'}`}
              </h3>
              <button onClick={() => setForm(null)} aria-label="Close" className="text-ink hover:text-danger transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitBooking} className="p-4 space-y-4">
              {conflictMsg && (
                <div className="border-2 border-ink bg-danger/10 p-3 flex gap-2" role="alert">
                  <AlertTriangle size={18} className="text-danger flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-ink">{conflictMsg}</p>
                </div>
              )}
              {!form.rescheduleId && (
                <div>
                  <label htmlFor="bk-resource" className={labelClass}>Resource</label>
                  <select id="bk-resource" value={selectedId || ''} onChange={(e) => setSelectedId(Number(e.target.value))} className={inputClass}>
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="bk-date" className={labelClass}>Date</label>
                <input id="bk-date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="bk-start" className={labelClass}>Start</label>
                  <input id="bk-start" type="time" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={inputClass} />
                </div>
                <div className="flex-1">
                  <label htmlFor="bk-end" className={labelClass}>End</label>
                  <input id="bk-end" type="time" required value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className={inputClass} />
                </div>
              </div>
              <button type="submit" className="w-full px-4 py-2.5 border-2 border-ink bg-primary text-white text-xs font-bold uppercase tracking-widest hover:bg-ink transition-colors">
                {form.rescheduleId ? 'Save New Time' : 'Confirm Booking'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookings;
