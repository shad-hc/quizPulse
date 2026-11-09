import React, { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../services/api';
import type { QuizResultsPayload, ResultEntry } from '../types/api';

interface Props {
  quizId: string;
  onNavigate: (page: string) => void;
}

const PODIUM_ORDER = [2, 1, 3]; // visual order for 1st, 2nd, 3rd

export default function ResultsPage({ quizId, onNavigate }: Props) {
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<QuizResultsPayload | undefined>(`/results/${quizId}`)
      .then(d => setResults(Array.isArray(d?.results) ? d.results : []))
      .catch(e => setError(getErrorMessage(e, 'Failed to load results')))
      .finally(() => setLoading(false));
  }, [quizId]);

  const maxScore = results[0]?.totalScore || 1;

  const getName = (r: ResultEntry) => {
    if (r.userId && typeof r.userId === 'object') return r.userId.name;
    if (typeof r.userId === 'string') return `User ${r.userId.slice(-4)}`;
    return 'Deleted user';
  };

  const accuracy = (r: ResultEntry) =>
    r.questionsAttempted > 0 ? Math.round((r.correctCount / r.questionsAttempted) * 100) : 0;

  return (
    <div className="app">
      <main className="page page--narrow">
        <div className="page-head">
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('home')}>← Back</button>
          <h1 className="page-title">Results</h1>
        </div>

        {loading && <div className="state"><div className="spinner" />Loading results…</div>}
        {!loading && error && <div className="state state--error">{error}</div>}

        {!loading && !error && results.length > 0 && (
          <>
            <div className="podium">
              {results.slice(0, 3).map((r, i) => (
                <div key={r._id ?? i}
                  className={`card podium-item${i === 0 ? ' is-first' : ''}`}
                  style={{ order: PODIUM_ORDER[i] }}>
                  <div className="podium-rank">{i + 1}</div>
                  <div className="podium-name">{getName(r)}</div>
                  <div className="podium-score num">{r.totalScore}<span className="muted" style={{ fontSize: 13, fontWeight: 400 }}> pts</span></div>
                  <div className="podium-acc">{accuracy(r)}% accuracy</div>
                </div>
              ))}
            </div>

            <h2 className="section-title" style={{ marginBottom: 12 }}>All participants</h2>
            <div className="card table-wrap" style={{ padding: '16px 8px 4px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="col-rank">#</th>
                    <th>Name</th>
                    <th className="col-bar" aria-hidden="true" />
                    <th className="col-num">Score</th>
                    <th className="col-num">Correct</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r._id ?? i}>
                      <td className="col-rank num">{i + 1}</td>
                      <td className="col-name">{getName(r)}</td>
                      <td className="col-bar">
                        <div className="bar">
                          <div className={`bar-fill${i < 3 ? ' is-top' : ''}`}
                            style={{ width: `${Math.max(0, (r.totalScore / maxScore) * 100)}%` }} />
                        </div>
                      </td>
                      <td className="col-num num" style={{ fontWeight: 600 }}>{r.totalScore}</td>
                      <td className="col-num num muted">{r.correctCount}/{r.questionsAttempted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && !error && results.length === 0 && (
          <div className="state">
            <div className="state-title">No results yet</div>
            No results have been recorded for this quiz.
          </div>
        )}
      </main>
    </div>
  );
}
