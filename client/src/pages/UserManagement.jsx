import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Badge, Button, DataTable, Field, PageTitle, Select } from '../components/UI';

const emptyForm = { fullName: '', email: '', role: 'OFFICER', departmentId: '', studentId: '', phone: '', password: '', confirmPassword: '' };
function message(error) { return error.response?.data?.error || error.message || 'The request could not be completed.'; }

export default function UserManagement() {
  const { user } = useAuth();
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const [rows, setRows] = useState([]), [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ q: '', role: '', departmentId: '', active: '' });
  const [form, setForm] = useState(emptyForm), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  async function load() {
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      const { data } = await api.get(`/users?${params}`); setRows(data);
    } catch (e) { setError(message(e)); }
  }
  useEffect(() => { api.get('/departments').then(r => setDepartments(r.data)).catch(e => setError(message(e))); }, []);
  useEffect(() => { load(); }, [filters.q, filters.role, filters.departmentId, filters.active]);
  async function create(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await api.post('/users', form);
      setForm(emptyForm); setNotice(data.emailSent ? 'Account created and setup email sent.' : 'Account created. Setup email could not be sent; share the temporary password securely.'); await load();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function toggleActive(row) {
    try { await api.patch(`/users/${row.id}`, { active: !row.active }); await load(); }
    catch (e) { setError(message(e)); }
  }
  async function editUser(row) {
    const fullName = window.prompt('Full name', row.fullName); if (fullName === null) return;
    const phone = window.prompt('Phone (optional)', row.phone || ''); if (phone === null) return;
    try { await api.patch(`/users/${row.id}`, { fullName, phone }); await load(); }
    catch (e) { setError(message(e)); }
  }
  async function resetPassword(row) {
    const password = window.prompt('Enter a new temporary password (at least 10 characters).'); if (!password) return;
    const confirmPassword = window.prompt('Confirm the new temporary password.'); if (!confirmPassword) return;
    try { await api.patch(`/users/${row.id}/password`, { password, confirmPassword }); setNotice(`Password reset for ${row.email}.`); }
    catch (e) { setError(message(e)); }
  }
  const columns = useMemo(() => [
    { key: 'fullName', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role' },
    { key: 'department', label: 'Department', render: row => row.department?.name || '—' },
    { key: 'active', label: 'State', render: row => <Badge value={row.active ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', label: 'Actions', render: row => <div className="table-actions"><button className="text-link" onClick={() => editUser(row)}>Edit</button><button className="text-link" onClick={() => toggleActive(row)}>{row.active ? 'Deactivate' : 'Activate'}</button><button className="text-link" onClick={() => resetPassword(row)}>Reset password</button></div> }
  ], []);
  return <>
    <PageTitle title="User management" subtitle={isSuperAdmin ? 'Create and manage college accounts.' : 'Manage accounts within your department.'} />
    {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert" role="status">{notice}</div>}
    <form className="panel compact-form" onSubmit={create}>
      <h2>Create account</h2><div className="form-two">
        <Field label="Full name" required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
        <Field label="Email" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <Select label="Role" required value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{(isSuperAdmin ? ['OFFICER', 'DEPARTMENT_ADMIN', 'STUDENT'] : ['OFFICER', 'STUDENT']).map(role => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}</Select>
        {form.role !== 'STUDENT' && <Select label="Department" required value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })}><option value="">Select department</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>}
        {form.role === 'STUDENT' && <Field label="Student ID" required value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} />}
        <Field label="Phone (optional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <Field label="Temporary password" type="password" minLength="10" autoComplete="new-password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <Field label="Confirm temporary password" type="password" minLength="10" autoComplete="new-password" required value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} />
      </div><Button disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
    </form>
    <section className="panel"><div className="panel-head"><div><h2>College accounts</h2><p>{rows.length} account{rows.length === 1 ? '' : 's'}</p></div></div>
      <div className="form-two user-filters"><Field label="Search name, email or student ID" value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} />
        <Select label="Role" value={filters.role} onChange={e => setFilters({ ...filters, role: e.target.value })}><option value="">All roles</option>{['STUDENT', 'OFFICER', 'DEPARTMENT_ADMIN', ...(isSuperAdmin ? ['SUPER_ADMIN'] : [])].map(role => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}</Select>
        {isSuperAdmin && <Select label="Department" value={filters.departmentId} onChange={e => setFilters({ ...filters, departmentId: e.target.value })}><option value="">All departments</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>}
        <Select label="Account status" value={filters.active} onChange={e => setFilters({ ...filters, active: e.target.value })}><option value="">All accounts</option><option value="true">Active</option><option value="false">Inactive</option></Select>
      </div><DataTable rows={rows} columns={columns} empty="No accounts match these filters" />
    </section>
  </>;
}
