import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Tags, Users, Plus, Pencil, X, Check,
} from 'lucide-react';

const API = 'http://localhost:8001';

const ROLE_LABELS = {
  admin: 'Admin',
  department_head: 'Department Head',
  asset_manager: 'Asset Manager',
  employee: 'Employee',
};

const ROLE_BADGE = {
  admin: 'bg-ink text-white',
  department_head: 'bg-primary text-white',
  asset_manager: 'bg-accentYellow text-ink',
  employee: 'bg-surface text-ink',
};

const inputClass =
  'w-full bg-surface border-2 border-ink px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:shadow-bauhaus-sm transition-shadow';
const labelClass = 'block text-[11px] font-bold uppercase tracking-widest text-ink mb-1';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('ia_token')}`,
});

const Organization = () => {
  const [tab, setTab] = useState('departments'); // departments | categories | directory
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Department form state
  const [deptForm, setDeptForm] = useState(null); // { id?, name, head_user_id, parent_id, status }
  // Category form state
  const [catForm, setCatForm] = useState(null); // { id?, name, description, custom_fields: [], status }
  const [fieldInput, setFieldInput] = useState('');

  const loadAll = useCallback(async () => {
    setError('');
    try {
      const [dRes, cRes, uRes] = await Promise.all([
        fetch(`${API}/api/departments`, { headers: authHeaders() }),
        fetch(`${API}/api/categories`, { headers: authHeaders() }),
        fetch(`${API}/api/users`, { headers: authHeaders() }),
      ]);
      if (!dRes.ok || !cRes.ok || !uRes.ok) throw new Error('Failed to load organization data');
      const [d, c, u] = await Promise.all([dRes.json(), cRes.json(), uRes.json()]);
      setDepartments(d.departments);
      setCategories(c.categories);
      setUsers(u.users);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const send = async (path, method, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: authHeaders(), body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Request failed');
    return data;
  };

  // ---- Departments ----
  const saveDepartment = async (e) => {
    e.preventDefault();
    try {
      const body = {
        name: deptForm.name,
        head_user_id: deptForm.head_user_id ? Number(deptForm.head_user_id) : null,
        parent_id: deptForm.parent_id ? Number(deptForm.parent_id) : null,
        status: deptForm.status,
      };
      if (deptForm.id) {
        await send(`/api/departments/${deptForm.id}`, 'PUT', body);
        setToast('Department updated.');
      } else {
        await send('/api/departments', 'POST', body);
        setToast('Department created.');
      }
      setDeptForm(null);
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  // ---- Categories ----
  const saveCategory = async (e) => {
    e.preventDefault();
    try {
      const body = {
        name: catForm.name,
        description: catForm.description || null,
        custom_fields: catForm.custom_fields,
        status: catForm.status,
      };
      if (catForm.id) {
        await send(`/api/categories/${catForm.id}`, 'PUT', body);
        setToast('Category updated.');
      } else {
        await send('/api/categories', 'POST', body);
        setToast('Category created.');
      }
      setCatForm(null);
      setFieldInput('');
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const addCustomField = () => {
    const v = fieldInput.trim();
    if (!v || catForm.custom_fields.includes(v)) return;
    setCatForm({ ...catForm, custom_fields: [...catForm.custom_fields, v] });
    setFieldInput('');
  };

  // ---- Directory ----
  const updateUser = async (userId, patch) => {
    setError('');
    try {
      await send(`/api/users/${userId}`, 'PUT', patch);
      setToast('Employee updated.');
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const tabs = [
    { id: 'departments', label: 'Departments', icon: Building2 },
    { id: 'categories', label: 'Asset Categories', icon: Tags },
    { id: 'directory', label: 'Employee Directory', icon: Users },
  ];

  const statusBadge = (status) => (
    <span className={`border-2 border-ink px-2 py-0.5 text-[11px] font-bold uppercase ${status === 'active' ? 'bg-accentYellow text-ink' : 'bg-surface text-muted'}`}>
      {status}
    </span>
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-display font-black uppercase tracking-tight text-ink">
          Organization Setup
        </h1>
        <p className="text-muted text-sm mt-1">Master data for departments, categories, and roles. Admin only.</p>
      </header>

      {/* Tabs */}
      <div className="flex border-2 border-ink w-fit max-w-full overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }, i) => (
          <button
            key={id}
            onClick={() => { setTab(id); setError(''); }}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wide flex items-center gap-2 whitespace-nowrap transition-colors ${i > 0 ? 'border-l-2 border-ink' : ''} ${tab === id ? 'bg-primary text-white' : 'bg-surface text-ink hover:bg-surfaceHover'}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {toast && (
        <div className="border-2 border-ink bg-accentYellow text-ink px-4 py-3 text-sm font-medium flex items-center justify-between gap-3" role="status">
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      {error && (
        <div className="border-2 border-ink bg-danger text-white px-4 py-3 text-sm font-medium" role="alert">
          {error}
        </div>
      )}

      {/* ================= Departments tab ================= */}
      {tab === 'departments' && (
        <section className="flex flex-col gap-4">
          <div className="flex justify-end">
            <button
              onClick={() => setDeptForm({ name: '', head_user_id: '', parent_id: '', status: 'active' })}
              className="btn-bauhaus bg-primary text-white px-3 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5"
            >
              <Plus size={15} /> New Department
            </button>
          </div>

          {deptForm && (
            <form onSubmit={saveDepartment} className="bg-surface border-2 border-ink shadow-bauhaus p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div>
                <label htmlFor="dept-name" className={labelClass}>Name</label>
                <input id="dept-name" required value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} className={inputClass} placeholder="e.g. Engineering" />
              </div>
              <div>
                <label htmlFor="dept-head" className={labelClass}>Department Head</label>
                <select id="dept-head" value={deptForm.head_user_id || ''} onChange={(e) => setDeptForm({ ...deptForm, head_user_id: e.target.value })} className={inputClass}>
                  <option value="">— None —</option>
                  {users.filter((u) => u.role !== 'admin').map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="dept-parent" className={labelClass}>Parent Department</label>
                <select id="dept-parent" value={deptForm.parent_id || ''} onChange={(e) => setDeptForm({ ...deptForm, parent_id: e.target.value })} className={inputClass}>
                  <option value="">— None —</option>
                  {departments.filter((d) => d.id !== deptForm.id).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="dept-status" className={labelClass}>Status</label>
                <select id="dept-status" value={deptForm.status} onChange={(e) => setDeptForm({ ...deptForm, status: e.target.value })} className={inputClass}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
                <button type="submit" className="btn-bauhaus bg-primary text-white px-4 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                  <Check size={15} /> {deptForm.id ? 'Save Changes' : 'Create'}
                </button>
                <button type="button" onClick={() => setDeptForm(null)} className="btn-bauhaus bg-surface text-ink px-4 py-2 text-xs font-bold uppercase tracking-wide">
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="bg-surface border-2 border-ink shadow-bauhaus overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b-2 border-ink bg-bg text-left">
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Department</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Head</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Parent</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-ink">
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 font-bold text-ink">{d.name}</td>
                    <td className="px-4 py-3 text-muted">{d.head_name || '—'}</td>
                    <td className="px-4 py-3 text-muted">{d.parent_name || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(d.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDeptForm({ id: d.id, name: d.name, head_user_id: d.head_user_id || '', parent_id: d.parent_id || '', status: d.status })}
                        className="border-2 border-ink bg-surface p-1.5 hover:bg-accentYellow transition-colors"
                        aria-label={`Edit ${d.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {departments.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">No departments yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ================= Categories tab ================= */}
      {tab === 'categories' && (
        <section className="flex flex-col gap-4">
          <div className="flex justify-end">
            <button
              onClick={() => setCatForm({ name: '', description: '', custom_fields: [], status: 'active' })}
              className="btn-bauhaus bg-primary text-white px-3 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5"
            >
              <Plus size={15} /> New Category
            </button>
          </div>

          {catForm && (
            <form onSubmit={saveCategory} className="bg-surface border-2 border-ink shadow-bauhaus p-4 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="cat-name" className={labelClass}>Name</label>
                  <input id="cat-name" required value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} className={inputClass} placeholder="e.g. Electronics" />
                </div>
                <div>
                  <label htmlFor="cat-desc" className={labelClass}>Description</label>
                  <input id="cat-desc" value={catForm.description || ''} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} className={inputClass} placeholder="Optional" />
                </div>
                <div>
                  <label htmlFor="cat-status" className={labelClass}>Status</label>
                  <select id="cat-status" value={catForm.status} onChange={(e) => setCatForm({ ...catForm, status: e.target.value })} className={inputClass}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="cat-field" className={labelClass}>Custom Fields</label>
                <div className="flex gap-2">
                  <input
                    id="cat-field"
                    value={fieldInput}
                    onChange={(e) => setFieldInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                        e.preventDefault();
                        addCustomField();
                      }
                    }}
                    className={inputClass}
                    placeholder="e.g. Warranty Period — press Enter to add"
                  />
                  <button type="button" onClick={addCustomField} className="btn-bauhaus bg-accentYellow text-ink px-3 text-xs font-bold uppercase whitespace-nowrap">
                    Add
                  </button>
                </div>
                {catForm.custom_fields.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {catForm.custom_fields.map((f) => (
                      <span key={f} className="border-2 border-ink bg-bg px-2 py-1 text-xs font-bold flex items-center gap-1.5">
                        {f}
                        <button
                          type="button"
                          onClick={() => setCatForm({ ...catForm, custom_fields: catForm.custom_fields.filter((x) => x !== f) })}
                          aria-label={`Remove ${f}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-bauhaus bg-primary text-white px-4 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                  <Check size={15} /> {catForm.id ? 'Save Changes' : 'Create'}
                </button>
                <button type="button" onClick={() => { setCatForm(null); setFieldInput(''); }} className="btn-bauhaus bg-surface text-ink px-4 py-2 text-xs font-bold uppercase tracking-wide">
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="bg-surface border-2 border-ink shadow-bauhaus overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b-2 border-ink bg-bg text-left">
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Category</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Description</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Custom Fields</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-ink">
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-bold text-ink">{c.name}</td>
                    <td className="px-4 py-3 text-muted">{c.description || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(c.custom_fields || []).map((f) => (
                          <span key={f} className="border border-ink bg-bg px-1.5 py-0.5 text-[11px] font-medium">{f}</span>
                        ))}
                        {(c.custom_fields || []).length === 0 && <span className="text-muted">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">{statusBadge(c.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setCatForm({ id: c.id, name: c.name, description: c.description || '', custom_fields: c.custom_fields || [], status: c.status })}
                        className="border-2 border-ink bg-surface p-1.5 hover:bg-accentYellow transition-colors"
                        aria-label={`Edit ${c.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">No categories yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ================= Employee Directory tab ================= */}
      {tab === 'directory' && (
        <section className="flex flex-col gap-4">
          <p className="text-xs text-muted border-2 border-ink bg-bg px-3 py-2 w-fit">
            This is the only place roles are assigned. New signups always start as Employee.
          </p>
          <div className="bg-surface border-2 border-ink shadow-bauhaus overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b-2 border-ink bg-bg text-left">
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Name</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Email</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Department</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Role</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-ink">
                {users.map((u) => {
                  const isAdminRow = u.role === 'admin';
                  return (
                    <tr key={u.id}>
                      <td className="px-4 py-3 font-bold text-ink whitespace-nowrap">{u.name}</td>
                      <td className="px-4 py-3 text-muted">{u.email}</td>
                      <td className="px-4 py-3">
                        {isAdminRow ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <select
                            value={u.department_id || ''}
                            onChange={(e) => updateUser(u.id, { department_id: e.target.value ? Number(e.target.value) : 0 })}
                            className="bg-surface border-2 border-ink px-2 py-1 text-xs font-medium text-ink focus:outline-none"
                            aria-label={`Department for ${u.name}`}
                          >
                            <option value="">— None —</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isAdminRow ? (
                          <span className={`border-2 border-ink px-2 py-0.5 text-[11px] font-bold uppercase ${ROLE_BADGE.admin}`}>Admin</span>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => updateUser(u.id, { role: e.target.value })}
                            className={`border-2 border-ink px-2 py-1 text-xs font-bold uppercase focus:outline-none ${ROLE_BADGE[u.role] || 'bg-surface text-ink'}`}
                            aria-label={`Role for ${u.name}`}
                          >
                            <option value="employee">Employee</option>
                            <option value="department_head">Department Head</option>
                            <option value="asset_manager">Asset Manager</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isAdminRow ? (
                          statusBadge(u.status)
                        ) : (
                          <button
                            onClick={() => updateUser(u.id, { status: u.status === 'active' ? 'inactive' : 'active' })}
                            className={`border-2 border-ink px-2 py-0.5 text-[11px] font-bold uppercase transition-colors ${u.status === 'active' ? 'bg-accentYellow text-ink hover:bg-danger hover:text-white' : 'bg-surface text-muted hover:bg-accentYellow hover:text-ink'}`}
                            aria-label={`Toggle status for ${u.name}`}
                          >
                            {u.status}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default Organization;
