import React, { useState } from 'react';
import api, { getErrorMessage } from '../services/api';
import type { NewQuestion } from '../types/api';

type Question = NewQuestion;

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

  const updateQ = <K extends keyof Question>(i: number, field: K, value: Question[K]) => {
    const next = [...questions];
    next[i] = { ...next[i], [field]: value };
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
    } catch (e) { setError(getErrorMessage(e, 'Failed to save quiz')); }
    finally { setSaving(false); }
  };

  return (
    <div className="app">
      <main className="page page--narrow">
        <div className="page-head">
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('home')}>← Back</button>
          <h1 className="page-title">New quiz</h1>
        </div>

        <div className="stack">
          <div className="field">
            <label className="label" htmlFor="quiz-title">Title</label>
            <input id="quiz-title" className="input" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. JavaScript Fundamentals" />
          </div>
          <div className="field">
            <label className="label" htmlFor="quiz-desc">
              Description <span className="label-hint">· optional</span>
            </label>
            <textarea id="quiz-desc" className="input" value={description}
              onChange={e => setDescription(e.target.value)} placeholder="What is this quiz about?" />
          </div>
        </div>

        <div className="section-head">
          <h2 className="section-title">Questions</h2>
          <span className="muted num" style={{ fontSize: 13 }}>{questions.length} total</span>
        </div>

        {questions.map((q, qi) => (
          <div key={qi} className="card q-card">
            <div className="q-head">
              <span className="q-num">QUESTION {qi + 1}</span>
              <div className="q-meta">
                <label className="label" htmlFor={`pts-${qi}`}>Points</label>
                <input id={`pts-${qi}`} className="input input-sm" type="number" value={q.points} min={1}
                  onChange={e => updateQ(qi, 'points', Number(e.target.value))} />
                <label className="label" htmlFor={`sec-${qi}`}>Seconds</label>
                <input id={`sec-${qi}`} className="input input-sm" type="number" value={q.timeLimitSeconds} min={5}
                  onChange={e => updateQ(qi, 'timeLimitSeconds', Number(e.target.value))} />
                {questions.length > 1 && (
                  <button className="btn btn-icon" title="Remove question" aria-label={`Remove question ${qi + 1}`}
                    onClick={() => setQuestions(questions.filter((_, i) => i !== qi))}>✕</button>
                )}
              </div>
            </div>

            <textarea className="input" value={q.text}
              onChange={e => updateQ(qi, 'text', e.target.value)}
              placeholder="Type your question…" rows={2} />

            <div className="option-list">
              {q.options.map((opt, oi) => (
                <div key={oi} className="option-row">
                  <input type="radio" name={`correct-${qi}`} checked={q.correctOptionIndex === oi}
                    aria-label={`Mark option ${oi + 1} as correct`}
                    onChange={() => updateQ(qi, 'correctOptionIndex', oi)} />
                  <input className="input" value={opt}
                    onChange={e => updateOption(qi, oi, e.target.value)}
                    placeholder={`Option ${oi + 1}`} />
                  {q.options.length > 2 && (
                    <button className="btn btn-icon" aria-label={`Remove option ${oi + 1}`}
                      onClick={() => removeOption(qi, oi)}>✕</button>
                  )}
                </div>
              ))}
            </div>
            {q.options.length < 6 && (
              <button className="btn btn-dashed btn-sm" onClick={() => addOption(qi)}>+ Add option</button>
            )}
            <div className="correct-note">Correct answer: Option {q.correctOptionIndex + 1}</div>
          </div>
        ))}

        <button className="btn btn-dashed btn-block btn-lg" style={{ marginBottom: 32 }}
          onClick={() => setQuestions([...questions, emptyQ()])}>
          + Add question
        </button>

        <hr className="divider" style={{ marginTop: 0 }} />

        {error && <div className="form-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

        <button className="btn btn-primary btn-lg btn-block" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : 'Save quiz'}
        </button>
      </main>
    </div>
  );
}
