import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, ArrowRightLeft, History, X, Check, AlertTriangle, CornerDownLeft,
} from 'lucide-react';

const API = 'http://localhost:8001';

const STATUS_CHIP = {
  available: 'bg-accentYellow text-ink',
  allocated: 'bg-primary text-white',
  maintenance: 'bg-danger text-white',
  in_transfer: 'bg-ink text-white',
};

const TRANSFER_CHIP = {
  pending: 'bg-accentYellow text-ink',
  approved: 'bg-primary text-white',
  rejected: 'bg-danger text-white',
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

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60" role="dialog" aria-modal="true">
    <div className="bg-surface border-2 border-ink shadow-bauhaus-lg w-full max-w-md">
      <div className="flex items-center justify-between border-b-2 border-ink px-4 py-3">
        <h3 className="font-bold uppercase tracking-widest text-sm text-ink">{title}</h3>
        <button onClick={onClose} aria-label="Close" className="text-ink hover:text-danger transition-colors">
          <X size={18} />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  </div>
);

const Allocations = ({ user }) => {
  const [tab, setTab] = useState('assets'); // assets | transfers
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [canApprove, setCanApprove] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Modals
  const [allocTarget, setAllocTarget] = useState(null); // item being allocated
  const [allocForm, setAllocForm] = useState({ user_id: '', expected_return_date: '' });
  const [conflict, setConflict] = useState(null); // { message, held_by } from 409
  const [returnTarget, setReturnTarget] = useState(null); // item being returned
  const [returnNotes, setReturnNotes] = useState('');
  const [historyTarget, setHistoryTarget] = useState(null); // item whose history is open
  const [historyRows, setHistoryRows] = useState([]);
  const [transferForm, setTransferForm] = useState(null); // { item, to_user_id, note }

  const loadAll = useCallback(async () => {
    setError('');
    try {
      const [iRes, uRes, tRes] = await Promise.all([
        fetch(`${API}/api/asset-items`, { headers: authHeaders() }),
        fetch(`${API}/api/users/basic`, { headers: authHeaders() }),
        fetch(`${API}/api/transfers`, { headers: authHeaders() }),
      ]);
      if (!iRes.ok || !uRes.ok || !tRes.ok) throw new Error('Failed to load allocation data');
      const [i, u, t] = await Promise.all([iRes.json(), uRes.json(), tRes.json()]);
      setItems(i.items);
      setEmployees(u.users);
      setTransfers(t.transfers);
      setCanApprove(t.can_approve);
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
      const err = new Error(typeof detail === 'object' ? detail.message : detail || 'Request failed');
      err.detail = detail;
      throw err;
    }
    return data;
  };

  // ---- Allocation ----
  const openAllocate = (item) => {
    setConflict(null);
    setAllocForm({ user_id: '', expected_return_date: '' });
    setAllocTarget(item);
  };

  const submitAllocate = async (e) => {
    e.preventDefault();
    setConflict(null);
    try {
      await send(`/api/asset-items/${allocTarget.id}/allocate`, 'POST', {
        user_id: Number(allocForm.user_id),
        expected_return_date: allocForm.expected_return_date || null,
      });
      setToast('Asset allocated.');
      setAllocTarget(null);
      loadAll();
    } catch (err) {
      if (err.detail && err.detail.code === 'already_allocated') {
        setConflict(err.detail);
      } else {
        setError(err.message);
        setAllocTarget(null);
      }
    }
  };

  // ---- Return ----
  const submitReturn = async (e) => {
    e.preventDefault();
    try {
      await send(`/api/asset-items/${returnTarget.id}/return`, 'POST', { condition_notes: returnNotes || null });
      setToast('Asset returned — now available.');
      setReturnTarget(null);
      setReturnNotes('');
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  // ---- History ----
  const openHistory = async (item) => {
    setHistoryTarget(item);
    setHistoryRows([]);
    try {
      const data = await send(`/api/asset-items/${item.id}/history`, 'GET');
      setHistoryRows(data.history);
    } catch (err) {
      setError(err.message);
    }
  };

  // ---- Transfers ----
  const submitTransfer = async (e) => {
    e.preventDefault();
    try {
      await send('/api/transfers', 'POST', {
        asset_item_id: transferForm.item.id,
        to_user_id: Number(transferForm.to_user_id),
        note: transferForm.note || null,
      });
      setToast('Transfer requested — awaiting approval.');
      setTransferForm(null);
      setAllocTarget(null);
      setConflict(null);
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const resolveTransfer = async (id, action) => {
    try {
      await send(`/api/transfers/${id}/${action}`, 'POST');
      setToast(action === 'approve' ? 'Transfer approved — asset re-allocated.' : 'Transfer rejected.');
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const pendingCount = transfers.filter((t) => t.status === 'pending').length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-ink text-balance">
            Allocation &amp; Transfer
          </h1>
          <p className="text-sm text-muted mt-1">Who holds what — with explicit conflict rules.</p>
        </div>
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

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('assets')}
          className={`flex items-center gap-2 px-4 py-2 border-2 border-ink text-xs font-bold uppercase tracking-widest transition-colors ${tab === 'assets' ? 'bg-ink text-white' : 'bg-surface text-ink hover:bg-accentYellow'}`}
        >
          <Package size={15} /> Assets
        </button>
        <button
          onClick={() => setTab('transfers')}
          className={`flex items-center gap-2 px-4 py-2 border-2 border-ink text-xs font-bold uppercase tracking-widest transition-colors ${tab === 'transfers' ? 'bg-ink text-white' : 'bg-surface text-ink hover:bg-accentYellow'}`}
        >
          <ArrowRightLeft size={15} /> Transfers
          {pendingCount > 0 && (
            <span className="bg-danger text-white text-[10px] px-1.5 py-0.5 border border-ink">{pendingCount}</span>
          )}
        </button>
      </div>

      {tab === 'assets' && (
        <div className="border-2 border-ink bg-surface shadow-bauhaus overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b-2 border-ink text-left">
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest">Tag</th>
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest">Asset</th>
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest">Category</th>
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest">Status</th>
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest">Held By</th>
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest">Return By</th>
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={`border-b border-ink/20 ${item.is_overdue ? 'bg-danger/10' : ''}`}>
                  <td className="px-3 py-2.5 font-mono text-xs">{item.asset_tag}</td>
                  <td className="px-3 py-2.5 font-bold">{item.name}</td>
                  <td className="px-3 py-2.5 text-muted">{item.category || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border border-ink ${STATUS_CHIP[item.status] || 'bg-surface'}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                    {item.is_overdue && (
                      <span className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 text-[10px] font-bold uppercase bg-danger text-white border border-ink">
                        <AlertTriangle size={10} /> Overdue
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">{item.held_by || '—'}</td>
                  <td className={`px-3 py-2.5 ${item.is_overdue ? 'text-danger font-bold' : ''}`}>{fmtDate(item.expected_return_date)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {item.status === 'available' && !item.is_bookable && (
                        <button
                          onClick={() => openAllocate(item)}
                          className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest border-2 border-ink bg-primary text-white hover:bg-ink transition-colors"
                        >
                          Allocate
                        </button>
                      )}
                      {item.status === 'allocated' && (
                        <>
                          <button
                            onClick={() => { setReturnNotes(''); setReturnTarget(item); }}
                            className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest border-2 border-ink bg-surface text-ink hover:bg-accentYellow transition-colors"
                          >
                            Return
                          </button>
                          <button
                            onClick={() => setTransferForm({ item, to_user_id: '', note: '' })}
                            className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest border-2 border-ink bg-surface text-ink hover:bg-accentYellow transition-colors"
                          >
                            Transfer
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => openHistory(item)}
                        aria-label={`History for ${item.name}`}
                        className="p-1.5 border-2 border-ink bg-surface text-ink hover:bg-ink hover:text-white transition-colors"
                      >
                        <History size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'transfers' && (
        <div className="border-2 border-ink bg-surface shadow-bauhaus overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b-2 border-ink text-left">
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest">Asset</th>
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest">From</th>
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest">To</th>
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest">Requested By</th>
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest">Status</th>
                <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted">No transfer requests yet.</td></tr>
              )}
              {transfers.map((t) => (
                <tr key={t.id} className="border-b border-ink/20">
                  <td className="px-3 py-2.5">
                    <span className="font-bold">{t.asset_name}</span>
                    <span className="text-muted font-mono text-xs ml-1.5">{t.asset_tag}</span>
                  </td>
                  <td className="px-3 py-2.5">{t.from_user || '—'}</td>
                  <td className="px-3 py-2.5">{t.to_user || '—'}</td>
                  <td className="px-3 py-2.5 text-muted">{t.requested_by || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border border-ink ${TRANSFER_CHIP[t.status] || 'bg-surface'}`}>
                      {t.status}
                    </span>
                    {t.status !== 'pending' && t.approved_by && (
                      <span className="text-[11px] text-muted ml-1.5">by {t.approved_by}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {t.status === 'pending' && canApprove ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => resolveTransfer(t.id, 'approve')}
                          className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest border-2 border-ink bg-primary text-white hover:bg-ink transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => resolveTransfer(t.id, 'reject')}
                          className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest border-2 border-ink bg-surface text-ink hover:bg-danger hover:text-white transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="block text-right text-xs text-muted">{fmtDateTime(t.resolved_at || t.created_at)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Allocate modal */}
      {allocTarget && (
        <Modal title={`Allocate ${allocTarget.asset_tag}`} onClose={() => setAllocTarget(null)}>
          {conflict ? (
            <div className="space-y-4">
              <div className="border-2 border-ink bg-danger/10 p-3 flex gap-2">
                <AlertTriangle size={18} className="text-danger flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-ink">{conflict.message}</p>
                  <p className="text-xs text-muted mt-1">You can request a transfer instead — it will need Asset Manager or Department Head approval.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTransferForm({ item: { ...allocTarget, held_by: conflict.held_by }, to_user_id: allocForm.user_id, note: '' })}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-ink bg-primary text-white text-xs font-bold uppercase tracking-widest hover:bg-ink transition-colors"
                >
                  <ArrowRightLeft size={14} /> Request Transfer
                </button>
                <button
                  onClick={() => setAllocTarget(null)}
                  className="px-4 py-2 border-2 border-ink bg-surface text-ink text-xs font-bold uppercase tracking-widest hover:bg-accentYellow transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submitAllocate} className="space-y-4">
              <p className="text-sm font-bold text-ink">{allocTarget.name}</p>
              <div>
                <label htmlFor="alloc-user" className={labelClass}>Allocate To</label>
                <select
                  id="alloc-user"
                  required
                  value={allocForm.user_id}
                  onChange={(e) => setAllocForm({ ...allocForm, user_id: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="alloc-return" className={labelClass}>Expected Return Date (optional)</label>
                <input
                  id="alloc-return"
                  type="date"
                  value={allocForm.expected_return_date}
                  onChange={(e) => setAllocForm({ ...allocForm, expected_return_date: e.target.value })}
                  className={inputClass}
                />
              </div>
              <button type="submit" className="w-full px-4 py-2.5 border-2 border-ink bg-primary text-white text-xs font-bold uppercase tracking-widest hover:bg-ink transition-colors">
                Allocate Asset
              </button>
            </form>
          )}
        </Modal>
      )}

      {/* Return modal */}
      {returnTarget && (
        <Modal title={`Return ${returnTarget.asset_tag}`} onClose={() => setReturnTarget(null)}>
          <form onSubmit={submitReturn} className="space-y-4">
            <p className="text-sm text-ink">
              <span className="font-bold">{returnTarget.name}</span> — currently held by {returnTarget.held_by}.
            </p>
            <div>
              <label htmlFor="return-notes" className={labelClass}>Condition Check-in Notes</label>
              <textarea
                id="return-notes"
                rows={3}
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="e.g. Good condition, minor scratches on lid"
                className={inputClass}
              />
            </div>
            <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-ink bg-primary text-white text-xs font-bold uppercase tracking-widest hover:bg-ink transition-colors">
              <CornerDownLeft size={14} /> Mark Returned
            </button>
          </form>
        </Modal>
      )}

      {/* Transfer request modal */}
      {transferForm && (
        <Modal title={`Transfer ${transferForm.item.asset_tag}`} onClose={() => setTransferForm(null)}>
          <form onSubmit={submitTransfer} className="space-y-4">
            <p className="text-sm text-ink">
              <span className="font-bold">{transferForm.item.name}</span>
              {transferForm.item.held_by && <> — currently held by <span className="font-bold">{transferForm.item.held_by}</span></>}
            </p>
            <div>
              <label htmlFor="transfer-to" className={labelClass}>Transfer To</label>
              <select
                id="transfer-to"
                required
                value={transferForm.to_user_id}
                onChange={(e) => setTransferForm({ ...transferForm, to_user_id: e.target.value })}
                className={inputClass}
              >
                <option value="">Select employee…</option>
                {employees.filter((emp) => emp.id !== transferForm.item.held_by_id).map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="transfer-note" className={labelClass}>Note (optional)</label>
              <input
                id="transfer-note"
                type="text"
                value={transferForm.note}
                onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
                placeholder="Reason for transfer"
                className={inputClass}
              />
            </div>
            <p className="text-xs text-muted">Requires approval from an Asset Manager or Department Head. The asset stays with the current holder until approved.</p>
            <button type="submit" className="w-full px-4 py-2.5 border-2 border-ink bg-primary text-white text-xs font-bold uppercase tracking-widest hover:bg-ink transition-colors">
              Submit Transfer Request
            </button>
          </form>
        </Modal>
      )}

      {/* History drawer */}
      {historyTarget && (
        <Modal title={`History — ${historyTarget.asset_tag}`} onClose={() => setHistoryTarget(null)}>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {historyRows.length === 0 && <p className="text-sm text-muted">No allocation history for this asset yet.</p>}
            {historyRows.map((h) => (
              <div key={h.id} className="border-2 border-ink p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-ink">{h.user_name}</p>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border border-ink ${h.returned_at ? 'bg-surface text-ink' : 'bg-primary text-white'}`}>
                    {h.returned_at ? (h.released_by === 'transfer' ? 'Transferred' : 'Returned') : 'Holding'}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">
                  {fmtDateTime(h.allocated_at)} → {h.returned_at ? fmtDateTime(h.returned_at) : 'present'}
                </p>
                {h.condition_notes && (
                  <p className="text-xs text-ink mt-1.5 border-t border-ink/20 pt-1.5">Check-in: {h.condition_notes}</p>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Allocations;
