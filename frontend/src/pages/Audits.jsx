import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, X, AlertTriangle, Lock, FileWarning, ChevronLeft } from 'lucide-react';

const API = 'http://localhost:8001';

const RESULT_CHIP = {
  verified: 'bg-accentYellow text-ink',
  missing: 'bg-danger text-white',
  damaged: 'bg-ink text-white',
};

const inputClass =
  'w-full bg-surface border-2 border-ink px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:shadow-bauhaus-sm transition-shadow';
const labelClass = 'block text-[11px] font-bold uppercase tracking-widest text-ink mb-1';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('ia_token')}`,
});

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60" role="dialog" aria-modal="true">
    <div className={`bg-surface border-2 border-ink shadow-bauhaus-lg w-full ${wide ? 'max-w-lg' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
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

const Audits = ({ user }) => {
  const [cycles, setCycles] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Detail view
  const [active, setActive] = useState(null); // { cycle, assets, can_record, can_manage }
  const [report, setReport] = useState(null);
  const [noteTarget, setNoteTarget] = useState(null); // { asset, result }
  const [noteText, setNoteText] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', scope_department_id: '', start_date: '', end_date: '', auditor_ids: [] });
  const [createError, setCreateError] = useState('');

  const loadCycles = useCallback(async () => {
    setError('');
    try {
      const [cRes, dRes, uRes] = await Promise.all([
        fetch(`${API}/api/audit-cycles`, { headers: authHeaders() }),
        fetch(`${API}/api/departments`, { headers: authHeaders() }),
        fetch(`${API}/api/users/basic`, { headers: authHeaders() }),
      ]);
      if (!cRes.ok || !dRes.ok || !uRes.ok) throw new Error('Failed to load audit data');
      const [c, d, u] = await Promise.all([cRes.json(), dRes.json(), uRes.json()]);
      setCycles(c.cycles);
      setCanManage(c.can_manage);
      setDepartments(d.departments.filter((x) => x.status === 'active'));
      setEmployees(u.users);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { loadCycles(); }, [loadCycles]);

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

  // ---- Create cycle ----
  const toggleAuditor = (id) => {
    setCreateForm((f) => ({
      ...f,
      auditor_ids: f.auditor_ids.includes(id) ? f.auditor_ids.filter((x) => x !== id) : [...f.auditor_ids, id],
    }));
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setCreateError('');
    try {
      await send('/api/audit-cycles', 'POST', {
        name: createForm.name,
        scope_department_id: createForm.scope_department_id ? Number(createForm.scope_department_id) : null,
        start_date: createForm.start_date || null,
        end_date: createForm.end_date || null,
        auditor_ids: createForm.auditor_ids,
      });
      setToast('Audit cycle created.');
      setCreateOpen(false);
      setCreateForm({ name: '', scope_department_id: '', start_date: '', end_date: '', auditor_ids: [] });
      loadCycles();
    } catch (err) {
      setCreateError(err.message);
    }
  };

  // ---- Detail ----
  const openCycle = async (cycle) => {
    try {
      const data = await send(`/api/audit-cycles/${cycle.id}`, 'GET');
      setActive(data);
      setReport(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const refreshActive = async () => {
    if (!active) return;
    const data = await send(`/api/audit-cycles/${active.cycle.id}`, 'GET');
    setActive(data);
  };

  const mark = async (asset, result) => {
    if (result === 'verified') {
      try {
        await send(`/api/audit-cycles/${active.cycle.id}/record`, 'POST', { asset_item_id: asset.id, result, note: null });
        setToast(`${asset.asset_tag} marked verified.`);
        refreshActive();
      } catch (err) {
        setError(err.message);
      }
    } else {
      setNoteTarget({ asset, result });
      setNoteText('');
    }
  };

  const submitNote = async (e) => {
    e.preventDefault();
    try {
      await send(`/api/audit-cycles/${active.cycle.id}/record`, 'POST', {
        asset_item_id: noteTarget.asset.id,
        result: noteTarget.result,
        note: noteText || null,
      });
      setToast(`${noteTarget.asset.asset_tag} marked ${noteTarget.result}.`);
      setNoteTarget(null);
      refreshActive();
    } catch (err) {
      setError(err.message);
      setNoteTarget(null);
    }
  };

  const viewReport = async () => {
    try {
      const data = await send(`/api/audit-cycles/${active.cycle.id}/report`, 'GET');
      setReport(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const closeCycle = async () => {
    try {
      await send(`/api/audit-cycles/${active.cycle.id}/close`, 'POST', {});
      setToast('Audit cycle closed and locked. Asset statuses updated.');
      setConfirmClose(false);
      setActive(null);
      loadCycles();
    } catch (err) {
      setError(err.message);
      setConfirmClose(false);
    }
  };

  const markBtn = (color, label, onClick, active_) =>
    <button onClick={onClick} className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider border-2 border-ink transition-colors ${active_ ? color : 'bg-surface text-ink hover:bg-accentYellow'}`}>{label}</button>;

  // ============ Cycle detail view ============
  if (active) {
    const { cycle, assets, can_record, can_manage } = active;
    const done = cycle.counts.verified + cycle.counts.missing + cycle.counts.damaged;
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => { setActive(null); loadCycles(); }} aria-label="Back to cycles" className="btn-bauhaus bg-surface border-2 border-ink p-2 text-ink">
              <ChevronLeft size={16} />
            </button>
            <div>
              <h1 className="text-xl font-bold uppercase tracking-widest text-ink flex items-center gap-2">
                {cycle.name}
                {cycle.status === 'closed' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-ink text-white"><Lock size={10} /> Closed</span>}
              </h1>
              <p className="text-sm text-muted">
                {cycle.scope_department} · {fmtDate(cycle.start_date)} → {fmtDate(cycle.end_date)} · Auditors: {cycle.auditors.map((a) => a.name).join(', ') || '—'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={viewReport} className="btn-bauhaus bg-accentYellow text-ink px-3 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
              <FileWarning size={14} /> Discrepancy Report
            </button>
            {can_manage && cycle.status === 'open' && (
              <button onClick={() => setConfirmClose(true)} className="btn-bauhaus bg-danger text-white px-3 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                <Lock size={14} /> Close Cycle
              </button>
            )}
          </div>
        </div>

        {toast && <div className="border-2 border-ink bg-accentYellow px-4 py-2 text-sm font-bold text-ink shadow-bauhaus-sm">{toast}</div>}
        {error && (
          <div className="border-2 border-ink bg-danger px-4 py-2 text-sm font-bold text-white shadow-bauhaus-sm flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
            <button onClick={() => setError('')} className="ml-auto" aria-label="Dismiss error"><X size={16} /></button>
          </div>
        )}

        {/* Progress */}
        <div className="border-2 border-ink bg-surface shadow-bauhaus p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-ink">Progress: {done}/{cycle.total_assets} checked</span>
            <span className="text-[11px] text-muted">
              {cycle.counts.verified} verified · {cycle.counts.missing} missing · {cycle.counts.damaged} damaged
            </span>
          </div>
          <div className="flex h-3 border-2 border-ink overflow-hidden" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={cycle.total_assets}>
            <div className="bg-accentYellow" style={{ width: `${cycle.total_assets ? (cycle.counts.verified / cycle.total_assets) * 100 : 0}%` }} />
            <div className="bg-danger" style={{ width: `${cycle.total_assets ? (cycle.counts.missing / cycle.total_assets) * 100 : 0}%` }} />
            <div className="bg-ink" style={{ width: `${cycle.total_assets ? (cycle.counts.damaged / cycle.total_assets) * 100 : 0}%` }} />
          </div>
        </div>

        {/* Checklist */}
        <div className="border-2 border-ink bg-surface shadow-bauhaus overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-ink bg-ink text-white text-left">
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest">Tag</th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest">Asset</th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest hidden sm:table-cell">Held by</th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest">Result</th>
                {can_record && <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest">Mark</th>}
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-b border-ink/20">
                  <td className="px-3 py-2.5 font-mono font-bold text-ink">{a.asset_tag}</td>
                  <td className="px-3 py-2.5 font-bold text-ink">{a.name}</td>
                  <td className="px-3 py-2.5 hidden sm:table-cell text-muted">{a.held_by || '—'}</td>
                  <td className="px-3 py-2.5">
                    {a.audit_result ? (
                      <div>
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${RESULT_CHIP[a.audit_result]}`}>{a.audit_result}</span>
                        {a.audit_note && <p className="text-[11px] text-muted mt-1">{a.audit_note}</p>}
                      </div>
                    ) : (
                      <span className="text-muted text-[11px] uppercase tracking-wider">Unchecked</span>
                    )}
                  </td>
                  {can_record && (
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1.5">
                        {markBtn('bg-accentYellow text-ink', 'Verified', () => mark(a, 'verified'), a.audit_result === 'verified')}
                        {markBtn('bg-danger text-white', 'Missing', () => mark(a, 'missing'), a.audit_result === 'missing')}
                        {markBtn('bg-ink text-white', 'Damaged', () => mark(a, 'damaged'), a.audit_result === 'damaged')}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Note modal for missing/damaged */}
        {noteTarget && (
          <Modal title={`Mark ${noteTarget.asset.asset_tag} ${noteTarget.result}`} onClose={() => setNoteTarget(null)}>
            <form onSubmit={submitNote} className="flex flex-col gap-3">
              <div>
                <label htmlFor="audit-note" className={labelClass}>Note (what did you find?)</label>
                <textarea id="audit-note" rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} className={inputClass} placeholder="e.g. Not at assigned desk, last seen in Floor 2 storage" />
              </div>
              <button type="submit" className="btn-bauhaus bg-danger text-white px-4 py-2 text-xs font-bold uppercase tracking-wide">
                Mark {noteTarget.result}
              </button>
            </form>
          </Modal>
        )}

        {/* Discrepancy report */}
        {report && (
          <Modal title={`Discrepancy Report — ${report.cycle_name}`} onClose={() => setReport(null)} wide>
            {report.discrepancies.length === 0 ? (
              <p className="text-sm text-muted">No discrepancies flagged. All checked assets verified.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {report.discrepancies.map((d, idx) => (
                  <div key={idx} className="border-2 border-ink bg-background p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-ink">{d.asset_tag} — {d.asset_name}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${RESULT_CHIP[d.result]}`}>{d.result}</span>
                    </div>
                    {d.note && <p className="text-[11px] text-muted mt-1">Note: {d.note}</p>}
                    <p className="text-[11px] text-muted mt-1">Flagged by {d.auditor || 'unknown'}</p>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        )}

        {/* Close confirmation */}
        {confirmClose && (
          <Modal title="Close Audit Cycle" onClose={() => setConfirmClose(false)}>
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink leading-relaxed text-pretty">
                Closing locks this cycle permanently. Assets marked <strong>Missing</strong> will be set to <strong>Lost</strong>, and <strong>Damaged</strong> assets will be sent to <strong>Maintenance</strong>. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button onClick={closeCycle} className="btn-bauhaus bg-danger text-white px-4 py-2 text-xs font-bold uppercase tracking-wide flex-1">Close &amp; Lock</button>
                <button onClick={() => setConfirmClose(false)} className="btn-bauhaus bg-surface border-2 border-ink text-ink px-4 py-2 text-xs font-bold uppercase tracking-wide flex-1">Cancel</button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ============ Cycle list view ============
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-ink">Asset Audits</h1>
          <p className="text-sm text-muted">Structured verification cycles with discrepancy reports</p>
        </div>
        {canManage && (
          <button onClick={() => { setCreateOpen(true); setCreateError(''); }} className="btn-bauhaus bg-primary text-white px-4 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
            <ClipboardCheck size={15} /> New Audit Cycle
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

      <div className="grid gap-4 sm:grid-cols-2">
        {cycles.length === 0 && <p className="text-muted text-sm">No audit cycles yet.</p>}
        {cycles.map((c) => {
          const done = c.counts.verified + c.counts.missing + c.counts.damaged;
          return (
            <button
              key={c.id}
              onClick={() => openCycle(c)}
              className="text-left border-2 border-ink bg-surface shadow-bauhaus p-4 hover:shadow-bauhaus-lg transition-shadow"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold uppercase tracking-widest text-sm text-ink">{c.name}</h2>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.status === 'open' ? 'bg-accentYellow text-ink' : 'bg-ink text-white'}`}>
                  {c.status === 'closed' && <Lock size={10} />} {c.status}
                </span>
              </div>
              <p className="text-[11px] text-muted mt-1">{c.scope_department} · {fmtDate(c.start_date)} → {fmtDate(c.end_date)}</p>
              <p className="text-[11px] text-muted">Auditors: {c.auditors.map((a) => a.name).join(', ') || '—'}</p>
              <div className="mt-3 flex h-2.5 border-2 border-ink overflow-hidden">
                <div className="bg-accentYellow" style={{ width: `${c.total_assets ? (c.counts.verified / c.total_assets) * 100 : 0}%` }} />
                <div className="bg-danger" style={{ width: `${c.total_assets ? (c.counts.missing / c.total_assets) * 100 : 0}%` }} />
                <div className="bg-ink" style={{ width: `${c.total_assets ? (c.counts.damaged / c.total_assets) * 100 : 0}%` }} />
              </div>
              <p className="text-[11px] text-muted mt-1">{done}/{c.total_assets} checked · {c.counts.missing + c.counts.damaged} flagged</p>
            </button>
          );
        })}
      </div>

      {/* Create cycle modal */}
      {createOpen && (
        <Modal title="New Audit Cycle" onClose={() => setCreateOpen(false)} wide>
          <form onSubmit={submitCreate} className="flex flex-col gap-3">
            {createError && <div className="border-2 border-ink bg-danger px-3 py-2 text-xs font-bold text-white">{createError}</div>}
            <div>
              <label htmlFor="ac-name" className={labelClass}>Cycle name</label>
              <input id="ac-name" required value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="e.g. Q3 Physical Audit — Floor 3" />
            </div>
            <div>
              <label htmlFor="ac-dept" className={labelClass}>Scope (department)</label>
              <select id="ac-dept" value={createForm.scope_department_id} onChange={(e) => setCreateForm((f) => ({ ...f, scope_department_id: e.target.value }))} className={inputClass}>
                <option value="">All departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ac-start" className={labelClass}>Start date</label>
                <input id="ac-start" type="date" value={createForm.start_date} onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label htmlFor="ac-end" className={labelClass}>End date</label>
                <input id="ac-end" type="date" value={createForm.end_date} onChange={(e) => setCreateForm((f) => ({ ...f, end_date: e.target.value }))} className={inputClass} />
              </div>
            </div>
            <div>
              <span className={labelClass}>Assign auditors</span>
              <div className="border-2 border-ink bg-background max-h-40 overflow-y-auto p-2 flex flex-col gap-1">
                {employees.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer hover:bg-accentYellow/40 px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={createForm.auditor_ids.includes(u.id)}
                      onChange={() => toggleAuditor(u.id)}
                      className="h-4 w-4 border-2 border-ink"
                    />
                    {u.name}
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="btn-bauhaus bg-primary text-white px-4 py-2 text-xs font-bold uppercase tracking-wide">Create Cycle</button>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Audits;
