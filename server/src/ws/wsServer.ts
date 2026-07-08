import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import {
  getRoomState,
  setRoomState,
  updateLeaderboard,
  getTopLeaderboard,
  initLeaderboardMember,
  hasUserAnswered,
  markUserAnswered,
  deleteRoomState,
} from '../services/redis/redis';
import { getCachedQuestions } from '../services/redis/cache';
import Quiz from '../models/Quiz';
import Result from '../models/Result';
import { IAnswerRecord } from '../models/Result';
import mongoose from 'mongoose';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthenticatedWS extends WebSocket {
  userId: string;
  userName: string;
  role: string;
  quizId: string;
  isAlive: boolean;
}

interface WSMessage {
  type: string;
  [key: string]: unknown;
}

// ─── Room registry ────────────────────────────────────────────────────────────
// quizId → Set of connected WS clients
const rooms = new Map<string, Set<AuthenticatedWS>>();

function getRoom(quizId: string): Set<AuthenticatedWS> {
  if (!rooms.has(quizId)) rooms.set(quizId, new Set());
  return rooms.get(quizId)!;
}

function broadcast(quizId: string, payload: object, exclude?: AuthenticatedWS): void {
  const msg = JSON.stringify(payload);
  const room = getRoom(quizId);
  for (const client of room) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

function sendTo(ws: AuthenticatedWS, payload: object): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

// ─── Answer tracking (in-memory per session for analytics) ───────────────────
const sessionAnswers = new Map<string, IAnswerRecord[]>(); // key: `${quizId}:${userId}`

function getSessionAnswers(quizId: string, userId: string): IAnswerRecord[] {
  const key = `${quizId}:${userId}`;
  if (!sessionAnswers.has(key)) sessionAnswers.set(key, []);
  return sessionAnswers.get(key)!;
}

// ─── Persist final result to MongoDB ─────────────────────────────────────────
async function persistResult(quizId: string, userId: string): Promise<void> {
  const answers = getSessionAnswers(quizId, userId);
  if (!answers.length) return;

  const totalScore = answers.reduce((s, a) => s + a.points, 0);
  const correctCount = answers.filter((a) => a.correct).length;

  await Result.findOneAndUpdate(
    { quizId, userId },
    {
      totalScore,
      correctCount,
      questionsAttempted: answers.length,
      answers,
      finishedAt: new Date(),
    },
    { upsert: true, new: true }
  );
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleJoin(ws: AuthenticatedWS): Promise<void> {
  const { quizId, userId } = ws;
  const room = getRoom(quizId);
  room.add(ws);

  // Initialize leaderboard entry
  await initLeaderboardMember(quizId, userId);

  // Update participant count
  await Quiz.findByIdAndUpdate(quizId, { participantCount: room.size });

  const state = await getRoomState(quizId);
  const leaderboard = await getTopLeaderboard(quizId);

  sendTo(ws, {
    type: 'room_joined',
    quizId,
    participantCount: room.size,
    roomState: state,
    leaderboard,
  });

  // Notify others
  broadcast(quizId, { type: 'participant_joined', userId, participantCount: room.size }, ws);

  // If quiz is mid-flow, send current question to late joiner
  if (state && state.status === 'active' && state.currentQuestionIndex >= 0) {
    const questions = await getCachedQuestions(quizId);
    const q = questions[state.currentQuestionIndex];
    if (q) {
      const elapsed = Date.now() - state.qStartedAt;
      const remaining = Math.max(0, (q as any).timeLimitSeconds * 1000 - elapsed);
      sendTo(ws, {
        type: 'question',
        question: {
          _id: (q as any)._id,
          text: q.text,
          options: q.options,
          timeLimitSeconds: q.timeLimitSeconds,
          points: q.points,
        },
        qIndex: state.currentQuestionIndex,
        remainingMs: remaining,
      });
    }
  }
}

async function handleNextQuestion(ws: AuthenticatedWS): Promise<void> {
  const { quizId, userId, role } = ws;
  const state = await getRoomState(quizId);

  if (!state || state.hostId !== userId) {
    sendTo(ws, { type: 'error', message: 'Not authorized to control this quiz' });
    return;
  }

  const questions = await getCachedQuestions(quizId);
  const nextIndex = state.currentQuestionIndex + 1;

  if (nextIndex >= questions.length) {
    sendTo(ws, { type: 'error', message: 'No more questions — end the quiz' });
    return;
  }

  const q = questions[nextIndex];
  const now = Date.now();

  await setRoomState(quizId, {
    ...state,
    currentQuestionIndex: nextIndex,
    qStartedAt: now,
    status: 'active',
  });

  await Quiz.findByIdAndUpdate(quizId, { currentQuestionIndex: nextIndex });

  // Broadcast question (no correctOptionIndex)
  broadcast(quizId, {
    type: 'question',
    question: {
      _id: (q as any)._id,
      text: q.text,
      options: q.options,
      timeLimitSeconds: q.timeLimitSeconds,
      points: q.points,
    },
    qIndex: nextIndex,
    totalQuestions: questions.length,
    remainingMs: q.timeLimitSeconds * 1000,
  });

  // Auto-advance timer: broadcast leaderboard after question expires
  setTimeout(async () => {
    const lb = await getTopLeaderboard(quizId);
    broadcast(quizId, { type: 'leaderboard', leaderboard: lb, qIndex: nextIndex });
  }, q.timeLimitSeconds * 1000 + 500);
}

async function handleAnswer(
  ws: AuthenticatedWS,
  msg: WSMessage
): Promise<void> {
  const { quizId, userId } = ws;
  const { questionId, optionIndex } = msg as unknown as { questionId: string; optionIndex: number };

  const state = await getRoomState(quizId);
  if (!state || state.status !== 'active') {
    sendTo(ws, { type: 'error', message: 'Quiz is not active' });
    return;
  }

  // Dedup — one answer per question per user
  const alreadyAnswered = await hasUserAnswered(quizId, state.currentQuestionIndex, userId);
  if (alreadyAnswered) {
    sendTo(ws, { type: 'error', message: 'Already answered this question' });
    return;
  }

  const questions = await getCachedQuestions(quizId);
  const q = questions[state.currentQuestionIndex];

  if (!q || String((q as any)._id) !== questionId) {
    sendTo(ws, { type: 'error', message: 'Question mismatch' });
    return;
  }

  // Timing check
  const now = Date.now();
  const elapsed = now - state.qStartedAt;
  const late = elapsed > q.timeLimitSeconds * 1000;

  const correct = !late && Number(optionIndex) === q.correctOptionIndex;
  const points = correct ? q.points : 0;
  const timeTakenMs = Math.min(elapsed, q.timeLimitSeconds * 1000);

  // Mark answered to prevent duplicates
  await markUserAnswered(quizId, state.currentQuestionIndex, userId);

  // Update leaderboard ZSET
  if (points > 0) await updateLeaderboard(quizId, userId, points);

  // Track answer for final analytics
  const answers = getSessionAnswers(quizId, userId);
  answers.push({
    questionId: new mongoose.Types.ObjectId(questionId),
    selectedIndex: Number(optionIndex),
    correct,
    points,
    timeTakenMs,
    late,
  });

  // Ack to answerer
  sendTo(ws, {
    type: 'answer_result',
    correct,
    points,
    correctOptionIndex: q.correctOptionIndex,
    late,
    timeTakenMs,
  });

  // Broadcast updated leaderboard to all
  const leaderboard = await getTopLeaderboard(quizId);
  broadcast(quizId, { type: 'leaderboard', leaderboard });
}

async function handleEnd(ws: AuthenticatedWS): Promise<void> {
  const { quizId, userId } = ws;
  const state = await getRoomState(quizId);

  if (!state || state.hostId !== userId) {
    sendTo(ws, { type: 'error', message: 'Not authorized' });
    return;
  }

  await Quiz.findByIdAndUpdate(quizId, { status: 'ended', endedAt: new Date() });
  await deleteRoomState(quizId);

  const leaderboard = await getTopLeaderboard(quizId, 50);

  // Persist all session results
  const room = getRoom(quizId);
  const persistPromises: Promise<void>[] = [];
  for (const client of room) {
    persistPromises.push(persistResult(quizId, client.userId));
  }
  await Promise.allSettled(persistPromises);

  broadcast(quizId, {
    type: 'quiz_ended',
    leaderboard,
    message: 'The quiz has ended!',
  });
}

async function handlePing(ws: AuthenticatedWS): Promise<void> {
  ws.isAlive = true;
  sendTo(ws, { type: 'pong' });
}

// ─── Main WebSocket server setup ──────────────────────────────────────────────

export function setupWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Heartbeat
  const heartbeat = setInterval(() => {
    wss.clients.forEach((rawWs) => {
      const ws = rawWs as AuthenticatedWS;
      if (!ws.isAlive) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', async (rawWs: WebSocket, req: IncomingMessage) => {
    const ws = rawWs as AuthenticatedWS;
    ws.isAlive = true;

    // ── Auth: extract JWT from query string ──
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token');
    const quizId = url.searchParams.get('quizId');

    if (!token || !quizId) {
      ws.close(4001, 'Missing token or quizId');
      return;
    }

    let payload: TokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      ws.close(4003, 'Invalid or expired token');
      return;
    }

    ws.userId = payload.userId;
    ws.role = payload.role;
    ws.quizId = quizId;
    ws.userName = payload.email;

    // Check quiz exists and is active
    const quiz = await Quiz.findById(quizId).lean();
    if (!quiz) { ws.close(4004, 'Quiz not found'); return; }
    if (quiz.status === 'ended') { ws.close(4005, 'Quiz already ended'); return; }

    console.log(`[WS] ${payload.role} ${payload.userId} joined quiz ${quizId}`);
    await handleJoin(ws);

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (data) => {
      let msg: WSMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        sendTo(ws, { type: 'error', message: 'Invalid JSON' });
        return;
      }

      try {
        switch (msg.type) {
          case 'next_question': await handleNextQuestion(ws); break;
          case 'answer':        await handleAnswer(ws, msg); break;
          case 'end_quiz':      await handleEnd(ws); break;
          case 'ping':          await handlePing(ws); break;
          case 'get_leaderboard': {
            const lb = await getTopLeaderboard(quizId);
            sendTo(ws, { type: 'leaderboard', leaderboard: lb });
            break;
          }
          default:
            sendTo(ws, { type: 'error', message: `Unknown event: ${msg.type}` });
        }
      } catch (err) {
        console.error('[WS] handler error:', err);
        sendTo(ws, { type: 'error', message: 'Internal server error' });
      }
    });

    ws.on('close', async () => {
      const room = getRoom(quizId);
      room.delete(ws);
      if (room.size === 0) rooms.delete(quizId);
      await persistResult(quizId, ws.userId);
      broadcast(quizId, { type: 'participant_left', userId: ws.userId, participantCount: room.size });
      await Quiz.findByIdAndUpdate(quizId, { participantCount: room.size });
      console.log(`[WS] ${ws.userId} disconnected from quiz ${quizId}`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] error for ${ws.userId}:`, err.message);
    });
  });

  console.log('[WS] WebSocket server ready on /ws');
  return wss;
}
