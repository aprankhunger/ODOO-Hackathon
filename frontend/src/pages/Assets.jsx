import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, X, AlertTriangle } from 'lucide-react';

import { API_BASE as API } from '../lib/api';

const STATUS_CHIP = {
  available: 'bg-accentYellow text-ink',
  allocated: 'bg-primary text-white',
  maintenance: 'bg-danger text-white',
  in_transfer: 'bg-ink text-white',
  lost: 'bg-ink text-white',
};

const inputClass =
  'w-full bg-surface border-2 border-ink px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:shadow-bauhaus-sm transition-shadow';
const labelClass = 'block text-[11px] font-bold uppercase tracking-widest text-ink mb-1';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('ia_token')}`,
});

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60" role="dialog" aria-modal="true">
    <div className={`bg-surface border-2 border-ink shadow-bauhaus-lg w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
      <div className="flex items-center justify-between border-b-2 border-ink px-4 py-3 sticky top-0 bg-surface z-10">
        <h3 className="font-bold uppercase tracking-widest text-sm text-ink">{title}</h3>
        <button onClick={onClose} aria-label="Close" className="text-ink hover:text-danger transition-colors">
          <X size={18} />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  </div>
);

const MANAGER_ROLES = ['admin', 'department_head', 'asset_manager'];

const Assets = ({ user }) => {
  const location = useLocation();
  const canRegister = MANAGER_ROLES.includes(user?.role);

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [q, setQ] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [registerOpen, setRegisterOpen] = useState(false);
  const [regForm, setRegForm] = useState({ asset_tag: '', name: '', category_id: '', department_id: '', is_bookable: false, custom: {} });
  const [regError, setRegError] = useState('');

  const [detail, setDetail] = useState(null); // { item, allocation_history, maintenance_history, audit_history }
  const [detailTab, setDetailTab] = useState('info');

  const loadAll = useCallback(async () => {
    setError('');
    try {
      const [iRes, cRes, dRes] = await Promise.all([
        fetch(`${API}/api/asset-items`, { headers: authHeaders() }),
        fetch(`${API}/api/categories`, { headers: authHeaders() }),
        fetch(`${API}/api/departments`, { headers: authHeaders() }),
      ]);
      if (!iRes.ok || !cRes.ok || !dRes.ok) throw new Error('Failed to load asset directory');
      const [i, c, d] = await Promise.all([iRes.json(), cRes.json(), dRes.json()]);
      setItems(i.items);
      setCategories(c.categories.filter((x) => x.status === 'active'));
      setDepartments(d.departments.filter((x) => x.status === 'active'));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Dashboard quick action: /assets?register=1
  useEffect(() => {
    if (new URLSearchParams(location.search).get('register') === '1' && canRegister) {
      openRegister();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, canRegister]);

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
      throw new Error(typeof detail === 'object' ? detail.message : detail || 'Request failed');
    }
    return data;
  };

  // ---- Register ----
  const openRegister = async () => {
    setRegError('');
    let nextTag = '';
    try {
      const data = await send('/api/asset-items/next-tag', 'GET');
      nextTag = data.next_tag;
    } catch { /* keep blank */ }
    setRegForm({ asset_tag: nextTag, name: '', category_id: '', department_id: '', is_bookable: false, custom: {} });
    setRegisterOpen(true);
  };

  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(regForm.category_id)),
    [categories, regForm.category_id]
  );

  const submitRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    try {
      await send('/api/asset-items', 'POST', {
        asset_tag: regForm.asset_tag,
        name: regForm.name,
        category_id: regForm.category_id ? Number(regForm.category_id) : null,
        department_id: regForm.department_id ? Number(regForm.department_id) : null,
        is_bookable: regForm.is_bookable,
        custom_field_values: regForm.custom,
      });
      setToast('Asset registered.');
      setRegisterOpen(false);
      loadAll();
    } catch (err) {
      setRegError(err.message);
    }
  };

  // ---- Detail ----
  const openDetail = async (item) => {
    try {
      const data = await send(`/api/asset-items/${item.id}/detail`, 'GET');
      setDetail(data);
      setDetailTab('info');
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => {
      if (term && !`${i.asset_tag} ${i.name} ${i.held_by || ''}`.toLowerCase().includes(term)) return false;
      if (filterCat && i.category !== filterCat) return false;
      if (filterStatus && i.status !== filterStatus) return false;
      return true;
    });
  }, [items, q, filterCat, filterStatus]);

  const tabBtn = (key, label) => (
    <button
      onClick={() => setDetailTab(key)}
      className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest border-2 border-ink transition-colors ${detailTab === key ? 'bg-ink text-white' : 'bg-surface text-ink hover:bg-accentYellow'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-ink">Assets</h1>
          <p className="text-sm text-muted">Register and browse the asset directory</p>
        </div>
        {canRegister && (
          <button onClick={openRegister} className="btn-bauhaus bg-primary text-white px-4 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
            <Plus size={15} /> Register Asset
          </button>
        )}
      </div>

      {toast && <div className="border-2 border-ink bg-accentYellow px-4 py-2 text-sm font-bold text-ink shadow-bauhaus-sm">{toast}</div>}
      {error && (
        <div className="border-2 border-ink bg-danger px-4 py-2 text-sm font-bold text-white shadow-bauhaus-sm flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
          <button onClick={() => setError('')} className="ml-auto" aria-label="Dismiss error"><X size={16} /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tag, name, or holder…"
            aria-label="Search assets"
            className={`${inputClass} pl-9`}
          />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} aria-label="Filter by category" className={`${inputClass} w-auto`}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filter by status" className={`${inputClass} w-auto`}>
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="allocated">Allocated</option>
          <option value="maintenance">Maintenance</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      {/* Directory */}
      <div className="border-2 border-ink bg-surface shadow-bauhaus overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink bg-ink text-white text-left">
              <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest">Tag</th>
              <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest">Name</th>
              <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest hidden md:table-cell">Category</th>
              <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest hidden lg:table-cell">Department</th>
              <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest">Status</th>
              <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest hidden sm:table-cell">Held by</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted">No assets match your filters.</td></tr>
            )}
            {filtered.map((i) => (
              <tr
                key={i.id}
                onClick={() => openDetail(i)}
                className="border-b border-ink/20 cursor-pointer hover:bg-accentYellow/30 transition-colors"
                title={`Open details for ${i.name}`}
              >
                <td className="px-3 py-2.5 font-mono font-bold text-ink">{i.asset_tag}</td>
                <td className="px-3 py-2.5 font-bold text-ink">{i.name}</td>
                <td className="px-3 py-2.5 hidden md:table-cell text-muted">{i.category || '—'}</td>
                <td className="px-3 py-2.5 hidden lg:table-cell text-muted">{i.department || '—'}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_CHIP[i.status] || 'bg-surface border-2 border-ink text-ink'}`}>
                    {i.status.replace('_', ' ')}
                  </span>
                  {i.is_overdue && <span className="ml-1 inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-danger text-white">Overdue</span>}
                </td>
                <td className="px-3 py-2.5 hidden sm:table-cell text-ink">{i.held_by || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Register modal */}
      {registerOpen && (
        <Modal title="Register Asset" onClose={() => setRegisterOpen(false)}>
          <form onSubmit={submitRegister} className="flex flex-col gap-3">
            {regError && <div className="border-2 border-ink bg-danger px-3 py-2 text-xs font-bold text-white">{regError}</div>}
            <div>
              <label htmlFor="reg-tag" className={labelClass}>Asset tag</label>
              <input id="reg-tag" required value={regForm.asset_tag} onChange={(e) => setRegForm((f) => ({ ...f, asset_tag: e.target.value }))} className={inputClass} placeholder="AF-0000" />
            </div>
            <div>
              <label htmlFor="reg-name" className={labelClass}>Name</label>
              <input id="reg-name" required value={regForm.name} onChange={(e) => setRegForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} placeholder='e.g. MacBook Pro 16"' />
            </div>
            <div>
              <label htmlFor="reg-cat" className={labelClass}>Category</label>
              <select id="reg-cat" value={regForm.category_id} onChange={(e) => setRegForm((f) => ({ ...f, category_id: e.target.value, custom: {} }))} className={inputClass}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {selectedCategory?.custom_fields?.length > 0 && (
              <div className="border-2 border-ink bg-background p-3 flex flex-col gap-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-ink">{selectedCategory.name} fields</p>
                {selectedCategory.custom_fields.map((field) => (
                  <div key={field}>
                    <label htmlFor={`cf-${field}`} className={labelClass}>{field}</label>
                    <input
                      id={`cf-${field}`}
                      value={regForm.custom[field] || ''}
                      onChange={(e) => setRegForm((f) => ({ ...f, custom: { ...f.custom, [field]: e.target.value } }))}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            )}
            <div>
              <label htmlFor="reg-dept" className={labelClass}>Department</label>
              <select id="reg-dept" value={regForm.department_id} onChange={(e) => setRegForm((f) => ({ ...f, department_id: e.target.value }))} className={inputClass}>
                <option value="">No department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={regForm.is_bookable} onChange={(e) => setRegForm((f) => ({ ...f, is_bookable: e.target.checked }))} className="h-4 w-4 border-2 border-ink" />
              Bookable shared resource (room, projector…)
            </label>
            <button type="submit" className="btn-bauhaus bg-primary text-white px-4 py-2 text-xs font-bold uppercase tracking-wide">Register</button>
          </form>
        </Modal>
      )}

      {/* Detail drawer */}
      {detail && (
        <Modal title={`${detail.item.asset_tag} — ${detail.item.name}`} onClose={() => setDetail(null)} wide>
          <div className="flex flex-wrap gap-2 mb-4">
            {tabBtn('info', 'Info')}
            {tabBtn('alloc', `Allocation (${detail.allocation_history.length})`)}
            {tabBtn('maint', `Maintenance (${detail.maintenance_history.length})`)}
            {tabBtn('audit', `Audits (${detail.audit_history.length})`)}
          </div>

          {detailTab === 'info' && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className={labelClass}>Status</dt><dd><span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_CHIP[detail.item.status] || ''}`}>{detail.item.status.replace('_', ' ')}</span></dd></div>
              <div><dt className={labelClass}>Held by</dt><dd className="text-ink">{detail.item.held_by || '—'}</dd></div>
              <div><dt className={labelClass}>Category</dt><dd className="text-ink">{detail.item.category || '—'}</dd></div>
              <div><dt className={labelClass}>Department</dt><dd className="text-ink">{detail.item.department || '—'}</dd></div>
              <div><dt className={labelClass}>Bookable</dt><dd className="text-ink">{detail.item.is_bookable ? 'Yes' : 'No'}</dd></div>
              <div><dt className={labelClass}>Expected return</dt><dd className="text-ink">{detail.item.expected_return_date ? fmtDateTime(detail.item.expected_return_date) : '—'}</dd></div>
              {Object.entries(detail.item.custom_field_values || {}).map(([k, v]) => (
                <div key={k}><dt className={labelClass}>{k}</dt><dd className="text-ink">{v || '—'}</dd></div>
              ))}
            </dl>
          )}

          {detailTab === 'alloc' && (
            <div className="flex flex-col gap-2">
              {detail.allocation_history.length === 0 && <p className="text-muted text-sm">No allocation history.</p>}
              {detail.allocation_history.map((h, idx) => (
                <div key={idx} className="border-2 border-ink bg-background p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink">{h.user_name}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${h.returned_at ? 'bg-surface border-2 border-ink text-ink' : 'bg-primary text-white'}`}>
                      {h.returned_at ? (h.released_by === 'transfer' ? 'Transferred' : 'Returned') : 'Holding'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-1">{fmtDateTime(h.allocated_at)} → {h.returned_at ? fmtDateTime(h.returned_at) : 'present'}</p>
                  {h.condition_notes && <p className="text-[11px] text-muted mt-1">Condition: {h.condition_notes}</p>}
                </div>
              ))}
            </div>
          )}

          {detailTab === 'maint' && (
            <div className="flex flex-col gap-2">
              {detail.maintenance_history.length === 0 && <p className="text-muted text-sm">No maintenance history.</p>}
              {detail.maintenance_history.map((m) => (
                <div key={m.id} className="border-2 border-ink bg-background p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-ink">MR-{m.id}</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-ink text-white">{m.status.replace('_', ' ')}</span>
                  </div>
                  <p className="text-ink text-[13px] mt-1 leading-relaxed">{m.description}</p>
                  <p className="text-[11px] text-muted mt-1">{fmtDateTime(m.created_at)} · {m.priority} priority · by {m.requested_by}</p>
                  {m.resolution_note && <p className="text-[11px] text-muted mt-1">Resolution: {m.resolution_note}</p>}
                </div>
              ))}
            </div>
          )}

          {detailTab === 'audit' && (
            <div className="flex flex-col gap-2">
              {detail.audit_history.length === 0 && <p className="text-muted text-sm">No audit records.</p>}
              {detail.audit_history.map((a, idx) => (
                <div key={idx} className="border-2 border-ink bg-background p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink">{a.cycle_name}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${a.result === 'verified' ? 'bg-accentYellow text-ink' : 'bg-danger text-white'}`}>{a.result}</span>
                  </div>
                  <p className="text-[11px] text-muted mt-1">{fmtDateTime(a.created_at)}{a.auditor ? ` · by ${a.auditor}` : ''}</p>
                  {a.note && <p className="text-[11px] text-muted mt-1">Note: {a.note}</p>}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default Assets;
