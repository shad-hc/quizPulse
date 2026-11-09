import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api, { getErrorMessage } from '../services/api';
import type { Quiz, QuizListResponse } from '../types/api';

interface Props {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export default function QuizListPage({ onNavigate }: Props) {
  const { user, logout } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canHost = user?.role === 'organizer' || user?.role === 'admin';

  const load = async () => {
    try {
      const data = await api.get<QuizListResponse>('/quizzes');
      setQuizzes(Array.isArray(data?.quizzes) ? data.quizzes : []);
      setError('');
    } catch (e) { setError(getErrorMessage(e, 'Failed to load quizzes')); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const startQuiz = async (id: string) => {
    try {
      await api.put(`/quizzes/${id}/start`);
      await load();
    } catch (e) { alert(getErrorMessage(e, 'Failed to start quiz')); }
  };

  const hostName = (q: Quiz) =>
    q.hostId && typeof q.hostId === 'object' ? q.hostId.name : 'Unknown';

  return (
    <div className="app">
      <header className="app-header">
        <span className="brand"><span className="brand-mark" />QuizPulse</span>
        <div className="header-actions">
          <span className="user-chip"><strong>{user?.name}</strong> · {user?.role}</span>
          {canHost && (
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('create')}>
              New quiz
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="page">
        <div className="page-head page-head--spread">
          <div>
            <h1 className="page-title">Quizzes</h1>
            <p className="page-subtitle">
              {canHost ? 'Create, host and review your live quizzes.' : 'Join a live quiz or review past results.'}
            </p>
          </div>
        </div>

        {loading && (
          <div className="state"><div className="spinner" />Loading quizzes…</div>
        )}
        {!loading && error && <div className="state state--error">{error}</div>}

        {!loading && !error && (
          <div className="quiz-grid">
            {quizzes.map(q => {
              const count = q.participantCount ?? 0;
              return (
                <article key={q._id} className="card quiz-card">
                  <div className="quiz-card__top">
                    <span className={`badge badge--${q.status}`}>{q.status}</span>
                    <span className="quiz-card__count num">
                      {count} participant{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <h2 className="quiz-card__title">{q.title}</h2>
                  {q.description && <p className="quiz-card__desc">{q.description}</p>}
                  <div className="quiz-card__host">Hosted by {hostName(q)}</div>
                  {(q.status === 'active' || q.status === 'ended' || (q.status === 'draft' && canHost)) && (
                    <div className="quiz-card__actions">
                      {q.status === 'active' && (
                        <button className="btn btn-primary btn-sm"
                          onClick={() => onNavigate('room', { quizId: q._id })}>
                          Join room
                        </button>
                      )}
                      {q.status === 'draft' && canHost && (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => startQuiz(q._id)}>
                            Start quiz
                          </button>
                          <button className="btn btn-secondary btn-sm"
                            onClick={() => onNavigate('room', { quizId: q._id })}>
                            Host room
                          </button>
                        </>
                      )}
                      {q.status === 'ended' && (
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => onNavigate('results', { quizId: q._id })}>
                          View results
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
            {quizzes.length === 0 && (
              <div className="state">
                <div className="state-title">No quizzes yet</div>
                {canHost ? 'Create your first quiz to get started.' : 'Ask an organizer to create one.'}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
