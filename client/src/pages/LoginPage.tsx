import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../services/api';

interface Props { onNavigate: (page: string) => void; }

export default function LoginPage({ onNavigate }: Props) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'user' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await signup(form.email, form.name, form.password, form.role);
      onNavigate('home');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="auth-brand">
          <span className="brand"><span className="brand-mark" />QuizPulse</span>
        </div>
        <p className="auth-tagline">
          {mode === 'login' ? 'Welcome back. Sign in to continue.' : 'Create an account to get started.'}
        </p>

        <div className="segmented" role="tablist">
          {(['login', 'signup'] as const).map(m => (
            <button key={m} type="button" role="tab" aria-selected={mode === m}
              className={`segmented-btn${mode === m ? ' is-active' : ''}`}
              onClick={() => { setMode(m); setError(''); }}>
              {m === 'login' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        <form onSubmit={handle} className="stack">
          {mode === 'signup' && (
            <div className="field">
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" className="input" placeholder="Jane Doe" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" placeholder="you@example.com"
              value={form.email} autoComplete="email"
              onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">Password</label>
            <input id="password" className="input" type="password" placeholder="••••••••"
              value={form.password}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>
          {mode === 'signup' && (
            <div className="field">
              <label className="label" htmlFor="role">Role</label>
              <select id="role" className="input" value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="user">Participant</option>
                <option value="organizer">Organizer (host quizzes)</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
