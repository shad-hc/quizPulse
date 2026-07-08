import React, { useEffect, useState } from 'react';
import api from '../services/api';

interface ResultEntry {
  userId: { _id: string; name: string; email: string } | string;
  totalScore: number;
  correctCount: number;
  questionsAttempted: number;
}

interface Props {
  quizId: string;
  onNavigate: (page: string) => void;
}

export default function ResultsPage({ quizId, onNavigate }: Props) {
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ results: ResultEntry[] }>(`/results/${quizId}`)
      .then(d => setResults(d.results))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [quizId]);

  const medals = ['🥇', '🥈', '🥉'];
  const maxScore = results[0]?.totalScore || 1;

  const getName = (r: ResultEntry) =>
    typeof r.userId === 'object' ? r.userId.name : `User ${String(r.userId).slice(-4)}`;

  return (
    <div style={styles.wrap}>
      <div style={styles.inner}>
        <div style={styles.topBar}>
          <button style={styles.back} onClick={() => onNavigate('home')}>← Back</button>
          <h1 style={styles.title}>Quiz Results</h1>
        </div>

        {loading && <div style={styles.loading}>Loading results…</div>}
        {error && <div style={styles.error}>{error}</div>}

        {results.length > 0 && (
          <>
            <div style={styles.podium}>
              {results.slice(0, 3).map((r, i) => (
                <div key={i} style={{ ...styles.podiumCard, order: i === 0 ? 2 : i === 1 ? 1 : 3 }}>
                  <div style={styles.podiumMedal}>{medals[i]}</div>
                  <div style={styles.podiumName}>{getName(r)}</div>
                  <div style={styles.podiumScore}>{r.totalScore} pts</div>
                  <div style={styles.podiumAcc}>
                    {r.questionsAttempted > 0
                      ? Math.round((r.correctCount / r.questionsAttempted) * 100)
                      : 0}% accuracy
                  </div>
                </div>
              ))}
            </div>

            <h2 style={styles.tableTitle}>All Participants</h2>
            <div style={styles.table}>
              {results.map((r, i) => (
                <div key={i} style={styles.tableRow}>
                  <span style={styles.tableRank}>{medals[i] || `#${i+1}`}</span>
                  <span style={styles.tableName}>{getName(r)}</span>
                  <div style={styles.barWrap}>
                    <div style={{
                      ...styles.barFill,
                      width: `${(r.totalScore / maxScore) * 100}%`,
                      background: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#cd7f32' : '#7c3aed',
                    }} />
                  </div>
                  <span style={styles.tableScore}>{r.totalScore}</span>
                  <span style={styles.tableAcc}>
                    {r.correctCount}/{r.questionsAttempted}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && results.length === 0 && (
          <div style={styles.empty}>No results recorded yet for this quiz.</div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight:'100vh', background:'#0f0f1a', color:'#f1f5f9' },
  inner: { maxWidth:760, margin:'0 auto', padding:'32px 24px' },
  topBar: { display:'flex', alignItems:'center', gap:16, marginBottom:32 },
  back: { background:'transparent', border:'1px solid rgba(255,255,255,0.15)',
    color:'#94a3b8', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 },
  title: { fontSize:26, fontWeight:800, margin:0, letterSpacing:-1 },
  loading: { textAlign:'center', color:'#64748b', padding:40 },
  error: { color:'#f87171', textAlign:'center' },
  podium: { display:'flex', justifyContent:'center', gap:16, marginBottom:40, alignItems:'flex-end' },
  podiumCard: { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
    borderRadius:14, padding:'20px 24px', textAlign:'center', minWidth:140 },
  podiumMedal: { fontSize:36, marginBottom:8 },
  podiumName: { fontWeight:700, fontSize:15, marginBottom:4 },
  podiumScore: { fontSize:22, fontWeight:800, color:'#a78bfa', marginBottom:4 },
  podiumAcc: { fontSize:12, color:'#64748b' },
  tableTitle: { fontSize:16, fontWeight:700, color:'#94a3b8', marginBottom:14,
    textTransform:'uppercase', letterSpacing:.5 },
  table: { display:'flex', flexDirection:'column', gap:8 },
  tableRow: { display:'flex', alignItems:'center', gap:12, padding:'10px 16px',
    background:'rgba(255,255,255,0.03)', borderRadius:10,
    border:'1px solid rgba(255,255,255,0.06)' },
  tableRank: { width:32, textAlign:'center', fontSize:16 },
  tableName: { width:140, fontSize:14, fontWeight:600, overflow:'hidden',
    textOverflow:'ellipsis', whiteSpace:'nowrap' },
  barWrap: { flex:1, height:8, borderRadius:4, background:'rgba(255,255,255,0.08)', overflow:'hidden' },
  barFill: { height:'100%', borderRadius:4, transition:'width .5s ease' },
  tableScore: { width:60, textAlign:'right', fontWeight:700, color:'#a78bfa' },
  tableAcc: { width:50, textAlign:'right', fontSize:12, color:'#64748b' },
  empty: { textAlign:'center', color:'#475569', padding:60 },
};
