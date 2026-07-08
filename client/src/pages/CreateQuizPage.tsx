import React, { useState } from 'react';
import api from '../services/api';

interface Question {
  text: string;
  options: string[];
  correctOptionIndex: number;
  points: number;
  timeLimitSeconds: number;
}

interface Props { onNavigate: (page: string) => void; }

const emptyQ = (): Question => ({
  text: '', options: ['', '', '', ''], correctOptionIndex: 0, points: 10, timeLimitSeconds: 30,
});

export default function CreateQuizPage({ onNavigate }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([emptyQ()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateQ = (i: number, field: keyof Question, value: unknown) => {
    const next = [...questions];
    (next[i] as any)[field] = value;
    setQuestions(next);
  };

  const updateOption = (qi: number, oi: number, val: string) => {
    const next = [...questions];
    next[qi].options[oi] = val;
    setQuestions(next);
  };

  const addOption = (qi: number) => {
    const next = [...questions];
    if (next[qi].options.length < 6) next[qi].options.push('');
    setQuestions(next);
  };

  const removeOption = (qi: number, oi: number) => {
    const next = [...questions];
    next[qi].options.splice(oi, 1);
    if (next[qi].correctOptionIndex >= next[qi].options.length)
      next[qi].correctOptionIndex = 0;
    setQuestions(next);
  };

  const submit = async () => {
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) { setError(`Question ${i+1} text is empty`); return; }
      if (q.options.some(o => !o.trim())) { setError(`Question ${i+1} has empty option`); return; }
    }
    setSaving(true);
    try {
      await api.post('/quizzes', { title, description, questions });
      onNavigate('home');
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.inner}>
        <div style={styles.topBar}>
          <button style={styles.back} onClick={() => onNavigate('home')}>← Back</button>
          <h1 style={styles.heading}>Create New Quiz</h1>
        </div>

        <div style={styles.section}>
          <label style={styles.label}>Quiz Title *</label>
          <input style={styles.input} value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. JavaScript Fundamentals" />
          <label style={styles.label}>Description</label>
          <textarea style={{ ...styles.input, height: 70 }} value={description}
            onChange={e => setDescription(e.target.value)} placeholder="Optional description…" />
        </div>

        <h2 style={styles.subHeading}>Questions ({questions.length})</h2>

        {questions.map((q, qi) => (
          <div key={qi} style={styles.qCard}>
            <div style={styles.qHeader}>
              <span style={styles.qNum}>Q{qi + 1}</span>
              <div style={styles.qMeta}>
                <label style={styles.smallLabel}>Points</label>
                <input style={styles.smallInput} type="number" value={q.points} min={1}
                  onChange={e => updateQ(qi, 'points', Number(e.target.value))} />
                <label style={styles.smallLabel}>Seconds</label>
                <input style={styles.smallInput} type="number" value={q.timeLimitSeconds} min={5}
                  onChange={e => updateQ(qi, 'timeLimitSeconds', Number(e.target.value))} />
                {questions.length > 1 && (
                  <button style={styles.removeBtn}
                    onClick={() => setQuestions(questions.filter((_, i) => i !== qi))}>✕</button>
                )}
              </div>
            </div>

            <textarea style={{ ...styles.input, marginBottom: 14 }} value={q.text}
              onChange={e => updateQ(qi, 'text', e.target.value)}
              placeholder="Question text…" rows={2} />

            <div style={styles.optionsGrid}>
              {q.options.map((opt, oi) => (
                <div key={oi} style={styles.optRow}>
                  <input type="radio" checked={q.correctOptionIndex === oi}
                    onChange={() => updateQ(qi, 'correctOptionIndex', oi)} />
                  <input style={{ ...styles.input, flex: 1, marginBottom: 0 }} value={opt}
                    onChange={e => updateOption(qi, oi, e.target.value)}
                    placeholder={`Option ${oi + 1}`} />
                  {q.options.length > 2 && (
                    <button style={styles.removeOpt} onClick={() => removeOption(qi, oi)}>✕</button>
                  )}
                </div>
              ))}
            </div>
            {q.options.length < 6 && (
              <button style={styles.addOpt} onClick={() => addOption(qi)}>+ Add Option</button>
            )}
            <div style={styles.correctNote}>
              ✅ Correct: Option {q.correctOptionIndex + 1}
            </div>
          </div>
        ))}

        <button style={styles.addQ} onClick={() => setQuestions([...questions, emptyQ()])}>
          + Add Question
        </button>

        {error && <div style={styles.error}>{error}</div>}

        <button style={styles.save} onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : '💾 Save Quiz'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight:'100vh', background:'#0f0f1a', color:'#f1f5f9', paddingBottom:80 },
  inner: { maxWidth:760, margin:'0 auto', padding:'32px 24px' },
  topBar: { display:'flex', alignItems:'center', gap:16, marginBottom:28 },
  back: { background:'transparent', border:'1px solid rgba(255,255,255,0.15)',
    color:'#94a3b8', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 },
  heading: { fontSize:26, fontWeight:800, margin:0, letterSpacing:-1 },
  subHeading: { fontSize:18, fontWeight:700, margin:'28px 0 16px', color:'#a78bfa' },
  section: { display:'flex', flexDirection:'column', gap:10, marginBottom:8 },
  label: { fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:.5 },
  input: { padding:'11px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)',
    background:'rgba(255,255,255,0.05)', color:'#f1f5f9', fontSize:14,
    outline:'none', width:'100%', boxSizing:'border-box' as const, resize:'vertical' as const },
  qCard: { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
    borderRadius:14, padding:20, marginBottom:16 },
  qHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  qNum: { fontSize:18, fontWeight:800, color:'#a78bfa' },
  qMeta: { display:'flex', alignItems:'center', gap:8 },
  smallLabel: { fontSize:11, color:'#64748b' },
  smallInput: { width:60, padding:'6px 8px', borderRadius:6,
    border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)',
    color:'#f1f5f9', fontSize:13 },
  removeBtn: { background:'#7f1d1d', border:'none', color:'#fca5a5',
    borderRadius:6, padding:'6px 10px', cursor:'pointer', fontSize:12 },
  optionsGrid: { display:'flex', flexDirection:'column', gap:8, marginBottom:10 },
  optRow: { display:'flex', alignItems:'center', gap:10 },
  removeOpt: { background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', fontSize:16 },
  addOpt: { background:'transparent', border:'1px dashed rgba(255,255,255,0.2)',
    color:'#94a3b8', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12, marginBottom:10 },
  correctNote: { fontSize:12, color:'#86efac' },
  addQ: { width:'100%', padding:'14px 0', borderRadius:12,
    border:'2px dashed rgba(124,58,237,0.4)', background:'transparent',
    color:'#a78bfa', fontWeight:700, cursor:'pointer', fontSize:15, marginTop:4, marginBottom:20 },
  error: { color:'#f87171', fontSize:13, marginBottom:12, textAlign:'center' },
  save: { width:'100%', padding:'14px 0', borderRadius:12, border:'none',
    background:'#7c3aed', color:'#fff', fontWeight:800, cursor:'pointer', fontSize:16 },
};
