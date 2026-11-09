import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import type { LeaderboardEntry } from '../types/api';


interface Question {
  _id: string;
  text: string;
  options: string[];
  timeLimitSeconds: number;
  points: number;
}

interface AnswerResult {
  correct: boolean;
  points: number;
  correctOptionIndex: number;
  late: boolean;
  timeTakenMs: number;
}

interface Props {
  quizId: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

type RoomPhase =
  | 'lobby'
  | 'question'
  | 'answer_reveal'
  | 'leaderboard'
  | 'ended';

export default function QuizRoomPage({ quizId, onNavigate }: Props) {
  const { user, token } = useAuth();
  const isHost = user?.role === 'organizer' || user?.role === 'admin';

 
  const [phase, setPhase] = useState<RoomPhase>('lobby');
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [totalQ, setTotalQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [finalLeaderboard, setFinalLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [statusMsg, setStatusMsg] = useState('Waiting for the host to start…');
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  
  const handleMessage = useCallback((msg: Record<string, unknown>) => {
    const type = msg.type as string;

    switch (type) {
      case 'room_joined': {
        const lb = msg.leaderboard as LeaderboardEntry[];
        if (lb) setLeaderboard(lb);
        setParticipantCount(msg.participantCount as number);
        const state = msg.roomState as { status?: string } | null | undefined;
        if (state?.status === 'active') setStatusMsg('Quiz in progress — joining mid-session');
        break;
      }

      case 'participant_joined':
        setParticipantCount(msg.participantCount as number);
        break;

      case 'participant_left':
        setParticipantCount(msg.participantCount as number);
        break;

      case 'question': {
        const q = msg.question as Question;
        const remainingMs = (msg.remainingMs as number) ?? q.timeLimitSeconds * 1000;
        setCurrentQ(q);
        setQIndex(msg.qIndex as number);
        setTotalQ(msg.totalQuestions as number || totalQ);
        setSelected(null);
        setAnswerResult(null);
        setPhase('question');
        startTimer(Math.ceil(remainingMs / 1000), q.timeLimitSeconds);
        setStatusMsg('');
        break;
      }

      case 'answer_result': {
        const result = msg as unknown as AnswerResult & { type: string };
        setAnswerResult(result);
        setPhase('answer_reveal');
        if (result.points > 0) setMyScore(s => s + result.points);
        stopTimer();
        break;
      }

      case 'leaderboard': {
        const lb = msg.leaderboard as LeaderboardEntry[];
        setLeaderboard(lb);
        if (phase === 'answer_reveal') {
          setTimeout(() => setPhase('leaderboard'), 800);
        }
        break;
      }

      case 'quiz_ended': {
        setFinalLeaderboard(msg.leaderboard as LeaderboardEntry[]);
        setPhase('ended');
        stopTimer();
        break;
      }

      case 'error':
        setStatusMsg(`⚠️ ${msg.message}`);
        break;
    }
  }, [phase, totalQ]);

  const { send, status } = useWebSocket({
    quizId,
    token: token || '',
    onMessage: handleMessage,
    enabled: !!token && !!quizId,
  });

  
  function startTimer(seconds: number, _total: number) {
    stopTimer();
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { stopTimer(); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  useEffect(() => () => stopTimer(), []);

  
  const sendAnswer = (optionIndex: number) => {
    if (selected !== null || !currentQ) return;
    setSelected(optionIndex);
    send({ type: 'answer', questionId: currentQ._id, optionIndex });
  };

  const nextQuestion = () => send({ type: 'next_question' });
  const endQuiz = () => { if (window.confirm('End quiz for everyone?')) send({ type: 'end_quiz' }); };



  const timerPct = currentQ ? (timeLeft / currentQ.timeLimitSeconds) * 100 : 100;
  const timerState = timerPct > 50 ? '' : timerPct > 25 ? ' is-warn' : ' is-low';

  const myRank = leaderboard.findIndex(e => e.userId === user?._id) + 1 || '?';

  const optionClass = (i: number) => {
    if (phase === 'answer_reveal' && answerResult) {
      if (i === answerResult.correctOptionIndex) return ' is-correct';
      if (i === selected) return ' is-wrong';
      return '';
    }
    return i === selected ? ' is-selected' : '';
  };

  const hostControls = isHost && (
    <div className="host-controls">
      <button className="btn btn-primary" onClick={nextQuestion}>Next question</button>
      <button className="btn btn-danger" onClick={endQuiz}>End quiz</button>
    </div>
  );


  return (
    <div className="room">
      
      <header className="room-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('home')}>← Leave</button>
        </div>
        <div className="room-id">
          <span className="room-code">ROOM {quizId.slice(-6).toUpperCase()}</span>
          <span className={`status-dot${status === 'connected' ? ' is-ok' : ''}`}>{status}</span>
        </div>
        <div className="room-score">
          <span className="room-score-label">My score</span>
          <span className="room-score-value num">{myScore}</span>
        </div>
      </header>

      <div className="room-body">
        
        <main className="room-main">

          
          {phase === 'lobby' && (
            <div className="lobby">
              <div className="lobby-mark" />
              <h2 className="lobby-title">Waiting room</h2>
              <p className="status-msg">{statusMsg}</p>
              <div className="lobby-count num">
                {participantCount} participant{participantCount !== 1 ? 's' : ''} connected
              </div>
              {isHost && (
                <button className="btn btn-primary btn-lg" style={{ marginTop: 12 }} onClick={nextQuestion}>
                  Start first question
                </button>
              )}
            </div>
          )}

         
          {(phase === 'question' || phase === 'answer_reveal') && currentQ && (
            <div className="question">
              <div className="question-meta">
                <span>Question {qIndex + 1}{totalQ > 0 ? ` of ${totalQ}` : ''}</span>
                <span className="points-pill">{currentQ.points} pts</span>
              </div>

              {/* Timer */}
              <div className={`timer${timerState}`}>
                <div className="timer-bar">
                  <div className="timer-fill" style={{ width: `${timerPct}%` }} />
                </div>
                <span className="timer-num num">{timeLeft}s</span>
              </div>

              <h2 className="question-text">{currentQ.text}</h2>

              {statusMsg && <p className="status-msg" style={{ marginBottom: 16 }}>{statusMsg}</p>}

              <div className="option-grid">
                {currentQ.options.map((opt, i) => (
                  <button key={i} className={`option${optionClass(i)}`}
                    onClick={() => sendAnswer(i)}
                    disabled={selected !== null || phase === 'answer_reveal'}>
                    <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                    <span className="option-text">{opt}</span>
                    {phase === 'answer_reveal' && i === answerResult?.correctOptionIndex && (
                      <span className="option-check" aria-label="Correct answer">✓</span>
                    )}
                  </button>
                ))}
              </div>

              
              {answerResult && (
                <div className={`feedback ${answerResult.late ? 'is-late' : answerResult.correct ? 'is-correct' : 'is-wrong'}`}>
                  <div style={{ flex: 1 }}>
                    <div className="feedback-title">
                      {answerResult.late ? 'Too slow' : answerResult.correct ? 'Correct' : 'Wrong answer'}
                    </div>
                    <div className="feedback-time num">
                      Answered in {(answerResult.timeTakenMs / 1000).toFixed(1)}s
                    </div>
                  </div>
                  {answerResult.correct && <div className="feedback-pts num">+{answerResult.points}</div>}
                </div>
              )}

              {hostControls}
            </div>
          )}

         
          {phase === 'leaderboard' && (
            <div className="lb-area">
              <h2 className="lb-title">Leaderboard</h2>
              <LeaderboardTable entries={leaderboard} myId={user?._id} />
              {hostControls}
              {!isHost && <p className="wait-msg">Waiting for host to continue…</p>}
            </div>
          )}

          {/* ENDED */}
          {phase === 'ended' && (
            <div className="lb-area">
              <h2 className="end-title">Quiz complete</h2>
              <div className="end-score">
                <span>Your final score: <strong className="num">{myScore}</strong></span>
                {myRank !== '?' && <span className="rank-pill">Rank #{myRank}</span>}
              </div>
              {finalLeaderboard && <LeaderboardTable entries={finalLeaderboard} myId={user?._id} />}
              <button className="btn btn-primary btn-block" style={{ marginTop: 28 }}
                onClick={() => onNavigate('home')}>
                Back to home
              </button>
            </div>
          )}
        </main>

        {/* Sidebar leaderboard */}
        <aside className="room-sidebar">
          <div className="sidebar-head">
            <span className="section-title">Live leaderboard</span>
            <span className="subtle num" style={{ fontSize: 12 }}>{participantCount} online</span>
          </div>
          <div className="sidebar-me">
            Rank <strong>#{myRank}</strong> · Score <strong className="num">{myScore}</strong>
          </div>
          <LeaderboardTable entries={leaderboard.slice(0, 10)} myId={user?._id} compact />
        </aside>
      </div>
    </div>
  );
}


function LeaderboardTable({ entries, myId, compact }: {
  entries: LeaderboardEntry[];
  myId?: string;
  compact?: boolean;
}) {
  return (
    <div className={`lb-list${compact ? ' lb-list--compact' : ''}`}>
      {entries.map((e, i) => (
        <div key={e.userId} className={`lb-row${e.userId === myId ? ' is-me' : ''}`}>
          <span className={`lb-rank num${i < 3 ? ' is-top' : ''}`}>{i + 1}</span>
          <span className="lb-name">
            {e.userId === myId ? 'You' : `User …${e.userId.slice(-4)}`}
          </span>
          <span className="lb-score num">{e.score} <span className="subtle" style={{ fontWeight: 400 }}>pts</span></span>
        </div>
      ))}
      {entries.length === 0 && <div className="lb-empty">No scores yet</div>}
    </div>
  );
}
