import { useState } from 'react';
import api from '../services/api';
import { Button, Field } from './UI';

export default function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function submit(e) {
    e.preventDefault(); setError(''); setNotice('');
    try { const { data } = await api.patch('/users/me/password', form); setNotice(data.message); setForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }
    catch (e) { setError(e.response?.data?.error || 'Password could not be changed.'); }
  }
  return <form className="panel profile-panel" onSubmit={submit}><h2>Change password</h2>{error && <div className="alert error">{error}</div>}{notice && <div className="alert">{notice}</div>}<Field label="Current password" type="password" required autoComplete="current-password" value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} /><Field label="New password (10+ characters)" type="password" minLength="10" required autoComplete="new-password" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} /><Field label="Confirm new password" type="password" minLength="10" required autoComplete="new-password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} /><Button>Change password</Button></form>;
}
