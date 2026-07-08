import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';

interface LeaderboardEntry {
  userId: string;
  score: number;
  rank: number;
}

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

  // ─── State ────────────────────────────────────────────────────────────────
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

  // ─── WebSocket message handler ────────────────────────────────────────────
  const handleMessage = useCallback((msg: Record<string, unknown>) => {
    const type = msg.type as string;

    switch (type) {
      case 'room_joined': {
        const lb = msg.leaderboard as LeaderboardEntry[];
        if (lb) setLeaderboard(lb);
        setParticipantCount(msg.participantCount as number);
        const state = msg.roomState as any;
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

  // ─── Timer ────────────────────────────────────────────────────────────────
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

  // ─── Actions ──────────────────────────────────────────────────────────────
  const sendAnswer = (optionIndex: number) => {
    if (selected !== null || !currentQ) return;
    setSelected(optionIndex);
    send({ type: 'answer', questionId: currentQ._id, optionIndex });
  };

  const nextQuestion = () => send({ type: 'next_question' });
  const endQuiz = () => { if (window.confirm('End quiz for everyone?')) send({ type: 'end_quiz' }); };

  // ─── Render helpers ───────────────────────────────────────────────────────
  const timerPct = currentQ ? (timeLeft / currentQ.timeLimitSeconds) * 100 : 100;
  const timerColor = timerPct > 50 ? '#22c55e' : timerPct > 25 ? '#f59e0b' : '#ef4444';

  const myRank = leaderboard.findIndex(e => e.userId === user?._id) + 1 || '?';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={styles.wrap}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.back} onClick={() => onNavigate('home')}>← Leave</button>
        <div style={styles.headerCenter}>
          <span style={styles.roomId}>Room: {quizId.slice(-6).toUpperCase()}</span>
          <span style={{ ...styles.wsBadge, color: status === 'connected' ? '#22c55e' : '#f59e0b' }}>
            ● {status}
          </span>
        </div>
        <div style={styles.scoreDisplay}>
          <span style={styles.scoreLbl}>My Score</span>
          <span style={styles.scoreVal}>{myScore}</span>
        </div>
      </div>

      <div style={styles.body}>
        {/* Left: Main area */}
        <div style={styles.main}>

          {/* LOBBY */}
          {phase === 'lobby' && (
            <div style={styles.lobby}>
              <div style={styles.lobbyEmoji}>⚡</div>
              <h2 style={styles.lobbyTitle}>Waiting Room</h2>
              <p style={styles.statusMsg}>{statusMsg}</p>
              <div style={styles.pCount}>👥 {participantCount} participant{participantCount !== 1 ? 's' : ''} connected</div>
              {isHost && (
                <button style={styles.hostBtn} onClick={nextQuestion}>
                  ▶ Start First Question
                </button>
              )}
            </div>
          )}

          {/* QUESTION */}
          {(phase === 'question' || phase === 'answer_reveal') && currentQ && (
            <div style={styles.questionArea}>
              <div style={styles.qMeta}>
                <span>Question {qIndex + 1}{totalQ > 0 ? ` of ${totalQ}` : ''}</span>
                <span style={styles.pointsBadge}>🏆 {currentQ.points} pts</span>
              </div>

              {/* Timer */}
              <div style={styles.timerWrap}>
                <div style={styles.timerBar}>
                  <div style={{ ...styles.timerFill, width: `${timerPct}%`, background: timerColor }} />
                </div>
                <span style={{ ...styles.timerNum, color: timerColor }}>{timeLeft}s</span>
              </div>

              <h2 style={styles.qText}>{currentQ.text}</h2>

              <div style={styles.optionGrid}>
                {currentQ.options.map((opt, i) => {
                  let bg = 'rgba(255,255,255,0.05)';
                  let border = '1px solid rgba(255,255,255,0.1)';
                  if (phase === 'answer_reveal' && answerResult) {
                    if (i === answerResult.correctOptionIndex) { bg='rgba(34,197,94,0.2)'; border='1px solid #22c55e'; }
                    else if (i === selected) { bg='rgba(239,68,68,0.2)'; border='1px solid #ef4444'; }
                  } else if (i === selected) { bg='rgba(124,58,237,0.3)'; border='1px solid #7c3aed'; }

                  return (
                    <button key={i} style={{ ...styles.optBtn, background: bg, border }}
                      onClick={() => sendAnswer(i)}
                      disabled={selected !== null || phase === 'answer_reveal'}>
                      <span style={styles.optLetter}>{String.fromCharCode(65 + i)}</span>
                      <span style={styles.optText}>{opt}</span>
                      {phase === 'answer_reveal' && i === answerResult?.correctOptionIndex && (
                        <span style={styles.optCheck}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Answer feedback */}
              {answerResult && (
                <div style={{ ...styles.feedback,
                  background: answerResult.correct ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  border: `1px solid ${answerResult.correct ? '#22c55e' : '#ef4444'}` }}>
                  <span style={styles.feedbackEmoji}>{answerResult.correct ? '🎉' : answerResult.late ? '⏰' : '❌'}</span>
                  <div>
                    <div style={styles.feedbackTitle}>
                      {answerResult.late ? 'Too slow!' : answerResult.correct ? 'Correct!' : 'Wrong answer'}
                    </div>
                    {answerResult.correct && <div style={styles.feedbackPts}>+{answerResult.points} points</div>}
                    <div style={styles.feedbackTime}>
                      {(answerResult.timeTakenMs / 1000).toFixed(1)}s
                    </div>
                  </div>
                </div>
              )}

              {/* Host controls */}
              {isHost && (
                <div style={styles.hostControls}>
                  <button style={styles.hostNextBtn} onClick={nextQuestion}>Next Question ▶</button>
                  <button style={styles.hostEndBtn} onClick={endQuiz}>End Quiz ⏹</button>
                </div>
              )}
            </div>
          )}

          {/* LEADERBOARD phase (mid-quiz) */}
          {phase === 'leaderboard' && (
            <div style={styles.lbArea}>
              <h2 style={styles.lbTitle}>📊 Leaderboard</h2>
              <LeaderboardTable entries={leaderboard} myId={user?._id} />
              {isHost && (
                <div style={styles.hostControls}>
                  <button style={styles.hostNextBtn} onClick={nextQuestion}>Next Question ▶</button>
                  <button style={styles.hostEndBtn} onClick={endQuiz}>End Quiz ⏹</button>
                </div>
              )}
              {!isHost && <p style={styles.waitMsg}>Waiting for host to continue…</p>}
            </div>
          )}

          {/* ENDED */}
          {phase === 'ended' && (
            <div style={styles.lbArea}>
              <div style={styles.endBanner}>🏆 Quiz Completed!</div>
              <div style={styles.myFinalScore}>
                Your final score: <strong>{myScore}</strong>
                {myRank !== '?' && <span style={styles.myRankBadge}>Rank #{myRank}</span>}
              </div>
              {finalLeaderboard && <LeaderboardTable entries={finalLeaderboard} myId={user?._id} />}
              <button style={styles.hostNextBtn} onClick={() => onNavigate('home')}>← Back to Home</button>
            </div>
          )}
        </div>

        {/* Right: Sidebar leaderboard */}
        <div style={styles.sidebar}>
          <div style={styles.sideTitle}>
            Live Leaderboard
            <span style={styles.sideCount}>👥 {participantCount}</span>
          </div>
          <div style={styles.sideRank}>
            Your rank: <strong>#{myRank}</strong> · Score: <strong>{myScore}</strong>
          </div>
          <LeaderboardTable entries={leaderboard.slice(0,10)} myId={user?._id} compact />
        </div>
      </div>
    </div>
  );
}

// ─── Leaderboard table component ─────────────────────────────────────────────
function LeaderboardTable({ entries, myId, compact }: {
  entries: LeaderboardEntry[];
  myId?: string;
  compact?: boolean;
}) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div>
      {entries.map((e, i) => (
        <div key={e.userId} style={{
          ...lbStyles.row,
          background: e.userId === myId ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
          border: e.userId === myId ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.06)',
          padding: compact ? '7px 12px' : '10px 16px',
        }}>
          <span style={lbStyles.rank}>{medals[i] || `#${i + 1}`}</span>
          <span style={lbStyles.uid}>
            {e.userId === myId ? 'You' : `User …${e.userId.slice(-4)}`}
          </span>
          <span style={lbStyles.score}>{e.score} pts</span>
        </div>
      ))}
      {entries.length === 0 && (
        <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: 20 }}>
          No scores yet
        </div>
      )}
    </div>
  );
}

const lbStyles: Record<string, React.CSSProperties> = {
  row: { display:'flex', alignItems:'center', borderRadius:8, marginBottom:6 },
  rank: { fontSize:16, width:32, textAlign:'center' },
  uid: { flex:1, fontSize:13, color:'#cbd5e1' },
  score: { fontSize:14, fontWeight:700, color:'#a78bfa' },
};

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight:'100vh', background:'#0f0f1a', color:'#f1f5f9', display:'flex', flexDirection:'column' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 24px', borderBottom:'1px solid rgba(255,255,255,0.08)',
    background:'rgba(255,255,255,0.03)', backdropFilter:'blur(10px)' },
  back: { background:'transparent', border:'1px solid rgba(255,255,255,0.12)',
    color:'#94a3b8', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:13 },
  headerCenter: { display:'flex', flexDirection:'column', alignItems:'center', gap:2 },
  roomId: { fontSize:12, color:'#64748b', letterSpacing:2, fontWeight:700 },
  wsBadge: { fontSize:11, fontWeight:600 },
  scoreDisplay: { display:'flex', flexDirection:'column', alignItems:'flex-end' },
  scoreLbl: { fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:.5 },
  scoreVal: { fontSize:22, fontWeight:800, color:'#a78bfa' },
  body: { display:'flex', flex:1, overflow:'hidden' },
  main: { flex:1, padding:32, overflowY:'auto' as const },
  sidebar: { width:260, borderLeft:'1px solid rgba(255,255,255,0.06)',
    padding:20, overflowY:'auto' as const, background:'rgba(255,255,255,0.02)' },
  sideTitle: { fontSize:13, fontWeight:700, color:'#94a3b8', textTransform:'uppercase',
    letterSpacing:.5, marginBottom:8, display:'flex', justifyContent:'space-between' },
  sideCount: { fontSize:12, color:'#475569' },
  sideRank: { fontSize:12, color:'#64748b', marginBottom:14, padding:'6px 10px',
    background:'rgba(124,58,237,0.1)', borderRadius:6 },

  // Lobby
  lobby: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    minHeight:'60vh', gap:16 },
  lobbyEmoji: { fontSize:64 },
  lobbyTitle: { fontSize:28, fontWeight:800, margin:0 },
  statusMsg: { color:'#94a3b8', fontSize:15, textAlign:'center' },
  pCount: { fontSize:14, color:'#64748b', background:'rgba(255,255,255,0.05)',
    padding:'8px 20px', borderRadius:20 },
  hostBtn: { padding:'13px 32px', borderRadius:12, border:'none', background:'#7c3aed',
    color:'#fff', fontWeight:800, cursor:'pointer', fontSize:16, marginTop:8 },

  // Question
  questionArea: { maxWidth:720, margin:'0 auto' },
  qMeta: { display:'flex', justifyContent:'space-between', alignItems:'center',
    fontSize:13, color:'#64748b', marginBottom:12 },
  pointsBadge: { background:'rgba(167,139,250,0.15)', color:'#a78bfa',
    padding:'4px 12px', borderRadius:20, fontWeight:700, fontSize:12 },
  timerWrap: { display:'flex', alignItems:'center', gap:12, marginBottom:20 },
  timerBar: { flex:1, height:8, borderRadius:4, background:'rgba(255,255,255,0.08)', overflow:'hidden' },
  timerFill: { height:'100%', borderRadius:4, transition:'width 1s linear, background .5s' },
  timerNum: { fontSize:24, fontWeight:800, width:48, textAlign:'right' as const },
  qText: { fontSize:22, fontWeight:700, lineHeight:1.4, marginBottom:24, color:'#f8fafc' },
  optionGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 },
  optBtn: { display:'flex', alignItems:'center', gap:10, padding:'14px 16px', borderRadius:12,
    cursor:'pointer', transition:'all .15s', textAlign:'left' as const },
  optLetter: { width:28, height:28, borderRadius:8, background:'rgba(255,255,255,0.1)',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:13, fontWeight:700, flexShrink:0 },
  optText: { flex:1, fontSize:14, color:'#e2e8f0', fontWeight:500 },
  optCheck: { fontSize:18, color:'#22c55e' },
  feedback: { display:'flex', alignItems:'center', gap:16, padding:'16px 20px',
    borderRadius:12, marginBottom:20 },
  feedbackEmoji: { fontSize:32 },
  feedbackTitle: { fontWeight:700, fontSize:16 },
  feedbackPts: { color:'#86efac', fontWeight:700, fontSize:18 },
  feedbackTime: { color:'#64748b', fontSize:12, marginTop:2 },

  // Leaderboard phase
  lbArea: { maxWidth:560, margin:'0 auto' },
  lbTitle: { fontSize:22, fontWeight:800, marginBottom:20, textAlign:'center' as const },
  endBanner: { textAlign:'center' as const, fontSize:32, fontWeight:800, marginBottom:16 },
  myFinalScore: { textAlign:'center' as const, fontSize:18, color:'#94a3b8',
    marginBottom:24, display:'flex', alignItems:'center', justifyContent:'center', gap:12 },
  myRankBadge: { background:'#7c3aed', color:'#fff', padding:'4px 12px',
    borderRadius:20, fontSize:13, fontWeight:700 },
  waitMsg: { textAlign:'center' as const, color:'#475569', fontSize:13, marginTop:16 },

  // Host controls
  hostControls: { display:'flex', gap:12, marginTop:24 },
  hostNextBtn: { flex:1, padding:'12px 0', borderRadius:10, border:'none',
    background:'#7c3aed', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:14 },
  hostEndBtn: { padding:'12px 20px', borderRadius:10,
    border:'1px solid rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.1)',
    color:'#f87171', fontWeight:700, cursor:'pointer', fontSize:14 },
};
