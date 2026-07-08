import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logo}>⚡ QuizPulse</div>
        <div style={styles.tabs}>
          {(['login','signup'] as const).map(m => (
            <button key={m} style={{...styles.tab, ...(mode===m ? styles.tabActive : {})}}
              onClick={() => setMode(m)}>
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>
        <form onSubmit={handle} style={styles.form}>
          {mode === 'signup' && (
            <input style={styles.input} placeholder="Full Name" value={form.name}
              onChange={e => setForm({...form, name: e.target.value})} required />
          )}
          <input style={styles.input} type="email" placeholder="Email" value={form.email}
            onChange={e => setForm({...form, email: e.target.value})} required />
          <input style={styles.input} type="password" placeholder="Password" value={form.password}
            onChange={e => setForm({...form, password: e.target.value})} required />
          {mode === 'signup' && (
            <select style={styles.input} value={form.role}
              onChange={e => setForm({...form, role: e.target.value})}>
              <option value="user">Participant</option>
              <option value="organizer">Organizer (host quizzes)</option>
              <option value="admin">Admin</option>
            </select>
          )}
          {error && <div style={styles.error}>{error}</div>}
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
    background:'linear-gradient(135deg,#0f0f1a 0%,#1a1a2e 50%,#16213e 100%)' },
  card: { background:'rgba(255,255,255,0.05)', backdropFilter:'blur(20px)',
    border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:40,
    width:380, boxShadow:'0 25px 50px rgba(0,0,0,0.5)' },
  logo: { textAlign:'center', fontSize:28, fontWeight:800, color:'#a78bfa',
    marginBottom:28, letterSpacing:-1 },
  tabs: { display:'flex', marginBottom:24, borderRadius:10, overflow:'hidden',
    border:'1px solid rgba(255,255,255,0.1)' },
  tab: { flex:1, padding:'10px 0', background:'transparent', border:'none',
    color:'#94a3b8', cursor:'pointer', fontSize:14, fontWeight:600, transition:'all .2s' },
  tabActive: { background:'#7c3aed', color:'#fff' },
  form: { display:'flex', flexDirection:'column', gap:14 },
  input: { padding:'12px 16px', borderRadius:10, border:'1px solid rgba(255,255,255,0.15)',
    background:'rgba(255,255,255,0.05)', color:'#f1f5f9', fontSize:14, outline:'none' },
  error: { color:'#f87171', fontSize:13, textAlign:'center' },
  btn: { padding:'13px 0', borderRadius:10, border:'none', background:'#7c3aed',
    color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', transition:'opacity .2s' },
};
