import React, { useState, useEffect, useCallback } from 'react';
import { Wrench, X, Camera, KeyRound, AlertTriangle } from 'lucide-react';

const API = 'http://localhost:8001';

const STATUS_CHIP = {
  pending: 'bg-accentYellow text-ink',
  approved: 'bg-primary text-white',
  rejected: 'bg-danger text-white',
  assigned: 'bg-ink text-white',
  in_progress: 'bg-primary text-white',
  resolved: 'bg-accentYellow text-ink',
};

const STATUS_LABEL = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  assigned: 'Technician Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

const PRIORITY_CHIP = {
  high: 'bg-danger text-white',
  medium: 'bg-accentYellow text-ink',
  low: 'bg-surface text-ink border-2 border-ink',
};

const PIPELINE = ['pending', 'approved', 'assigned', 'in_progress', 'resolved'];

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
    <div className={`bg-surface border-2 border-ink shadow-bauhaus-lg w-full ${wide ? 'max-w-lg' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
      <div className="flex items-center justify-between border-b-2 border-ink px-4 py-3 sticky top-0 bg-surface">
        <h3 className="font-bold uppercase tracking-widest text-sm text-ink">{title}</h3>
        <button onClick={onClose} aria-label="Close" className="text-ink hover:text-danger transition-colors">
          <X size={18} />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  </div>
);

const Pipeline = ({ status }) => {
  if (status === 'rejected') {
    return <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_CHIP.rejected}`}>Rejected</span>;
  }
  const idx = PIPELINE.indexOf(status);
  return (
    <div className="flex items-center gap-1" aria-label={`Status: ${STATUS_LABEL[status]}`}>
      {PIPELINE.map((step, i) => (
        <div
          key={step}
          title={STATUS_LABEL[step]}
          className={`h-2 w-6 border border-ink ${i <= idx ? 'bg-primary' : 'bg-surface'}`}
        />
      ))}
      <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-ink">{STATUS_LABEL[status]}</span>
    </div>
  );
};

const Maintenance = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [items, setItems] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [form, setForm] = useState({ asset_item_id: '', description: '', priority: 'medium', photo: null });
  const [photoName, setPhotoName] = useState('');
  const [raiseError, setRaiseError] = useState('');

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveNote, setResolveNote] = useState('');
  const [photoView, setPhotoView] = useState(null); // { id, photo }
  const [codeView, setCodeView] = useState(null); // request with technician_code

  const loadAll = useCallback(async () => {
    setError('');
    try {
      const [mRes, iRes] = await Promise.all([
        fetch(`${API}/api/maintenance`, { headers: authHeaders() }),
        fetch(`${API}/api/asset-items`, { headers: authHeaders() }),
      ]);
      if (!mRes.ok || !iRes.ok) throw new Error('Failed to load maintenance data');
      const [m, i] = await Promise.all([mRes.json(), iRes.json()]);
      setRequests(m.requests);
      setCanManage(m.can_manage);
      setItems(i.items.filter((x) => !x.is_bookable));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

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

  // ---- Raise request ----
  const onPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      setRaiseError('Photo must be under 1.5 MB');
      return;
    }
    setRaiseError('');
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, photo: reader.result }));
      setPhotoName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const submitRaise = async (e) => {
    e.preventDefault();
    setRaiseError('');
    try {
      await send('/api/maintenance', 'POST', {
        asset_item_id: Number(form.asset_item_id),
        description: form.description,
        priority: form.priority,
        photo: form.photo,
      });
      setToast('Maintenance request raised.');
      setRaiseOpen(false);
      setForm({ asset_item_id: '', description: '', priority: 'medium', photo: null });
      setPhotoName('');
      loadAll();
    } catch (err) {
      setRaiseError(err.message);
    }
  };

  // ---- Manager actions ----
  const doAction = async (path, successMsg) => {
    try {
      await send(path, 'POST', {});
      setToast(successMsg);
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const submitReject = async (e) => {
    e.preventDefault();
    try {
      await send(`/api/maintenance/${rejectTarget.id}/reject`, 'POST', { note: rejectNote });
      setToast('Request rejected.');
      setRejectTarget(null);
      setRejectNote('');
      loadAll();
    } catch (err) {
      setError(err.message);
      setRejectTarget(null);
    }
  };

  const submitResolve = async (e) => {
    e.preventDefault();
    try {
      await send(`/api/maintenance/${resolveTarget.id}/resolve`, 'POST', { note: resolveNote || null });
      setToast('Request resolved. Asset back in service.');
      setResolveTarget(null);
      setResolveNote('');
      loadAll();
    } catch (err) {
      setError(err.message);
      setResolveTarget(null);
    }
  };

  const assignTech = async (req) => {
    try {
      const data = await send(`/api/maintenance/${req.id}/assign`, 'POST', {});
      setCodeView(data.request);
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const viewPhoto = async (req) => {
    try {
      const data = await send(`/api/maintenance/${req.id}/photo`, 'GET');
      setPhotoView({ id: req.id, photo: data.photo });
    } catch (err) {
      setError(err.message);
    }
  };

  const btn = (color) =>
    `btn-bauhaus ${color} px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-ink">Maintenance</h1>
          <p className="text-sm text-muted">Repairs routed through approval before work starts</p>
        </div>
        <button onClick={() => { setRaiseOpen(true); setRaiseError(''); }} className="btn-bauhaus bg-primary text-white px-4 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
          <Wrench size={15} /> Raise Request
        </button>
      </div>

      {toast && <div className="border-2 border-ink bg-accentYellow px-4 py-2 text-sm font-bold text-ink shadow-bauhaus-sm">{toast}</div>}
      {error && (
        <div className="border-2 border-ink bg-danger px-4 py-2 text-sm font-bold text-white shadow-bauhaus-sm flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
          <button onClick={() => setError('')} className="ml-auto" aria-label="Dismiss error"><X size={16} /></button>
        </div>
      )}

      <div className="border-2 border-ink bg-surface shadow-bauhaus overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink bg-ink text-white text-left">
              <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest">Ticket</th>
              <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest">Asset</th>
              <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest hidden md:table-cell">Issue</th>
              <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest">Priority</th>
              <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest">Workflow</th>
              <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted">No maintenance requests yet.</td></tr>
            )}
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-ink/20 align-top">
                <td className="px-3 py-2.5">
                  <span className="font-mono font-bold text-ink">MR-{r.id}</span>
                  <div className="text-[11px] text-muted">{fmtDateTime(r.created_at)}</div>
                  <div className="text-[11px] text-muted">by {r.requested_by}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-bold text-ink">{r.asset_name}</div>
                  <div className="font-mono text-[11px] text-muted">{r.asset_tag}</div>
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell max-w-[260px]">
                  <p className="text-ink text-[13px] leading-relaxed">{r.description}</p>
                  {r.decision_note && <p className="text-[11px] text-muted mt-1">Manager note: {r.decision_note}</p>}
                  {r.resolution_note && <p className="text-[11px] text-muted mt-1">Resolution: {r.resolution_note}</p>}
                  {r.has_photo && (
                    <button onClick={() => viewPhoto(r)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary underline">
                      <Camera size={12} /> View photo
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PRIORITY_CHIP[r.priority]}`}>{r.priority}</span>
                </td>
                <td className="px-3 py-2.5"><Pipeline status={r.status} /></td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {canManage && r.status === 'pending' && (
                      <>
                        <button onClick={() => doAction(`/api/maintenance/${r.id}/approve`, 'Request approved. Asset is Under Maintenance.')} className={btn('bg-primary text-white')}>Approve</button>
                        <button onClick={() => { setRejectTarget(r); setRejectNote(''); }} className={btn('bg-danger text-white')}>Reject</button>
                      </>
                    )}
                    {canManage && r.status === 'approved' && (
                      <button onClick={() => assignTech(r)} className={btn('bg-ink text-white')}>Assign Technician</button>
                    )}
                    {canManage && r.status === 'assigned' && (
                      <>
                        <button onClick={() => doAction(`/api/maintenance/${r.id}/start`, 'Marked in progress.')} className={btn('bg-primary text-white')}>Start Work</button>
                        <button onClick={() => setCodeView(r)} className={btn('bg-accentYellow text-ink')}>Code</button>
                      </>
                    )}
                    {canManage && r.status === 'in_progress' && (
                      <button onClick={() => { setResolveTarget(r); setResolveNote(''); }} className={btn('bg-accentYellow text-ink')}>Resolve</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Raise request modal */}
      {raiseOpen && (
        <Modal title="Raise Maintenance Request" onClose={() => setRaiseOpen(false)} wide>
          <form onSubmit={submitRaise} className="flex flex-col gap-3">
            {raiseError && <div className="border-2 border-ink bg-danger px-3 py-2 text-xs font-bold text-white">{raiseError}</div>}
            <div>
              <label htmlFor="mr-asset" className={labelClass}>Asset</label>
              <select id="mr-asset" required value={form.asset_item_id} onChange={(e) => setForm((f) => ({ ...f, asset_item_id: e.target.value }))} className={inputClass}>
                <option value="">Select asset…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.asset_tag} — {i.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mr-desc" className={labelClass}>Describe the issue</label>
              <textarea id="mr-desc" required rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputClass} placeholder="What's wrong with this asset?" />
            </div>
            <div>
              <label htmlFor="mr-priority" className={labelClass}>Priority</label>
              <select id="mr-priority" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className={inputClass}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label htmlFor="mr-photo" className={labelClass}>Photo (optional, max 1.5 MB)</label>
              <input id="mr-photo" type="file" accept="image/*" onChange={onPhotoChange} className="text-xs text-ink" />
              {form.photo && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={form.photo || "/placeholder.svg"} alt="Attached issue preview" className="h-16 w-16 object-cover border-2 border-ink" />
                  <span className="text-[11px] text-muted">{photoName}</span>
                  <button type="button" onClick={() => { setForm((f) => ({ ...f, photo: null })); setPhotoName(''); }} aria-label="Remove photo" className="text-danger"><X size={14} /></button>
                </div>
              )}
            </div>
            <button type="submit" className="btn-bauhaus bg-primary text-white px-4 py-2 text-xs font-bold uppercase tracking-wide">Submit Request</button>
          </form>
        </Modal>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <Modal title={`Reject MR-${rejectTarget.id}`} onClose={() => setRejectTarget(null)}>
          <form onSubmit={submitReject} className="flex flex-col gap-3">
            <div>
              <label htmlFor="mr-reject-note" className={labelClass}>Rejection note (required)</label>
              <textarea id="mr-reject-note" required rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} className={inputClass} placeholder="Why is this request being rejected?" />
            </div>
            <button type="submit" className="btn-bauhaus bg-danger text-white px-4 py-2 text-xs font-bold uppercase tracking-wide">Reject Request</button>
          </form>
        </Modal>
      )}

      {/* Resolve modal */}
      {resolveTarget && (
        <Modal title={`Resolve MR-${resolveTarget.id}`} onClose={() => setResolveTarget(null)}>
          <form onSubmit={submitResolve} className="flex flex-col gap-3">
            <p className="text-sm text-ink">Marking this resolved returns <strong>{resolveTarget.asset_name}</strong> to service.</p>
            <div>
              <label htmlFor="mr-resolve-note" className={labelClass}>Resolution note (optional)</label>
              <textarea id="mr-resolve-note" rows={3} value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} className={inputClass} placeholder="What was done to fix it?" />
            </div>
            <button type="submit" className="btn-bauhaus bg-accentYellow text-ink px-4 py-2 text-xs font-bold uppercase tracking-wide">Mark Resolved</button>
          </form>
        </Modal>
      )}

      {/* Photo viewer */}
      {photoView && (
        <Modal title={`Photo — MR-${photoView.id}`} onClose={() => setPhotoView(null)} wide>
          <img src={photoView.photo || "/placeholder.svg"} alt={`Issue photo for maintenance request MR-${photoView.id}`} className="w-full border-2 border-ink" />
        </Modal>
      )}

      {/* TECH code viewer */}
      {codeView && (
        <Modal title={`Technician Assigned — MR-${codeView.id}`} onClose={() => setCodeView(null)}>
          <div className="flex flex-col items-center gap-3 py-2">
            <KeyRound size={28} className="text-primary" />
            <p className="text-sm text-ink text-center text-pretty">Share this access code with the technician. They can sign in from the login screen using Technician Access.</p>
            <div className="border-2 border-ink bg-accentYellow px-6 py-3 font-mono text-2xl font-bold tracking-widest text-ink shadow-bauhaus-sm">
              {codeView.technician_code}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Maintenance;
