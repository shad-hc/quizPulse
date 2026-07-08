import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface Quiz {
  _id: string;
  title: string;
  description: string;
  status: 'draft' | 'active' | 'ended';
  participantCount: number;
  hostId: { name: string; email: string } | string;
  createdAt: string;
}

interface Props {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#64748b',
  active: '#22c55e',
  ended: '#ef4444',
};

export default function QuizListPage({ onNavigate }: Props) {
  const { user, logout } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.get<{ quizzes: Quiz[] }>('/quizzes');
      setQuizzes(data.quizzes);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const startQuiz = async (id: string) => {
    try {
      await api.put(`/quizzes/${id}/start`);
      await load();
    } catch (e: any) { alert(e.message); }
  };

  const hostName = (q: Quiz) =>
    typeof q.hostId === 'object' ? q.hostId.name : 'Unknown';

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <div style={styles.logo}>⚡ QuizPulse</div>
        <div style={styles.headerRight}>
          <span style={styles.userBadge}>{user?.name} · {user?.role}</span>
          {(user?.role === 'organizer' || user?.role === 'admin') && (
            <button style={styles.createBtn} onClick={() => onNavigate('create')}>
              + Create Quiz
            </button>
          )}
          <button style={styles.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </header>

      <main style={styles.main}>
        <h1 style={styles.title}>Live Quizzes</h1>
        {loading && <div style={styles.loading}>Loading quizzes…</div>}
        {error && <div style={styles.error}>{error}</div>}
        <div style={styles.grid}>
          {quizzes.map(q => (
            <div key={q._id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={{ ...styles.badge, background: STATUS_COLORS[q.status] }}>
                  {q.status === 'active' && '🟢 '}{q.status.toUpperCase()}
                </span>
                <span style={styles.participants}>
                  👥 {q.participantCount}
                </span>
              </div>
              <h2 style={styles.quizTitle}>{q.title}</h2>
              {q.description && <p style={styles.desc}>{q.description}</p>}
              <div style={styles.meta}>by {hostName(q)}</div>
              <div style={styles.actions}>
                {q.status === 'active' && (
                  <button style={styles.joinBtn}
                    onClick={() => onNavigate('room', { quizId: q._id })}>
                    🎮 Join Room
                  </button>
                )}
                {q.status === 'draft' && (user?.role === 'organizer' || user?.role === 'admin') && (
                  <>
                    <button style={styles.startBtn} onClick={() => startQuiz(q._id)}>
                      ▶ Start Quiz
                    </button>
                    <button style={styles.hostBtn}
                      onClick={() => onNavigate('room', { quizId: q._id })}>
                      🎙 Host Room
                    </button>
                  </>
                )}
                {q.status === 'ended' && (
                  <button style={styles.resultsBtn}
                    onClick={() => onNavigate('results', { quizId: q._id })}>
                    📊 View Results
                  </button>
                )}
              </div>
            </div>
          ))}
          {!loading && quizzes.length === 0 && (
            <div style={styles.empty}>No quizzes yet. {
              (user?.role === 'organizer' || user?.role === 'admin') ?
              'Create one above!' : 'Ask an organizer to create one.'
            }</div>
          )}
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight:'100vh', background:'#0f0f1a', color:'#f1f5f9' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'16px 32px', borderBottom:'1px solid rgba(255,255,255,0.08)',
    background:'rgba(255,255,255,0.03)', backdropFilter:'blur(10px)', position:'sticky', top:0, zIndex:10 },
  logo: { fontSize:22, fontWeight:800, color:'#a78bfa', letterSpacing:-1 },
  headerRight: { display:'flex', alignItems:'center', gap:12 },
  userBadge: { fontSize:13, color:'#94a3b8', background:'rgba(255,255,255,0.06)',
    padding:'6px 12px', borderRadius:20 },
  createBtn: { padding:'8px 18px', borderRadius:8, border:'none', background:'#7c3aed',
    color:'#fff', fontWeight:700, cursor:'pointer', fontSize:13 },
  logoutBtn: { padding:'8px 16px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)',
    background:'transparent', color:'#94a3b8', cursor:'pointer', fontSize:13 },
  main: { maxWidth:1100, margin:'0 auto', padding:'32px 24px' },
  title: { fontSize:32, fontWeight:800, marginBottom:28, color:'#f1f5f9', letterSpacing:-1 },
  loading: { textAlign:'center', color:'#64748b', padding:40 },
  error: { color:'#f87171', textAlign:'center', marginBottom:20 },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:20 },
  card: { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
    borderRadius:16, padding:24, transition:'border-color .2s, transform .2s' },
  cardHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  badge: { fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:20, color:'#fff' },
  participants: { fontSize:13, color:'#64748b' },
  quizTitle: { fontSize:18, fontWeight:700, margin:'0 0 8px', color:'#f1f5f9' },
  desc: { fontSize:13, color:'#94a3b8', margin:'0 0 12px', lineHeight:1.5 },
  meta: { fontSize:12, color:'#475569', marginBottom:16 },
  actions: { display:'flex', gap:8, flexWrap:'wrap' },
  joinBtn: { padding:'8px 16px', borderRadius:8, border:'none', background:'#16a34a',
    color:'#fff', fontWeight:700, cursor:'pointer', fontSize:13 },
  startBtn: { padding:'8px 16px', borderRadius:8, border:'none', background:'#7c3aed',
    color:'#fff', fontWeight:700, cursor:'pointer', fontSize:13 },
  hostBtn: { padding:'8px 16px', borderRadius:8, border:'none', background:'#0369a1',
    color:'#fff', fontWeight:700, cursor:'pointer', fontSize:13 },
  resultsBtn: { padding:'8px 16px', borderRadius:8, border:'none', background:'#1e293b',
    color:'#94a3b8', fontWeight:700, cursor:'pointer', fontSize:13,
    },
  empty: { gridColumn:'1/-1', textAlign:'center', color:'#475569', padding:60, fontSize:16 },
};
