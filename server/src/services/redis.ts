import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

export const redisSub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('connect', () => console.log('[Redis] publisher connected'));
redis.on('error', (err) => console.error('[Redis] publisher error:', err.message));
redisSub.on('connect', () => console.log('[Redis] subscriber connected'));
redisSub.on('error', (err) => console.error('[Redis] subscriber error:', err.message));

// ─── Key helpers ────────────────────────────────────────────────────────────

export const KEYS = {
  quiz: (id: string) => `quiz:${id}`,
  questions: (id: string) => `quiz:questions:${id}`,
  roomState: (id: string) => `room:state:${id}`,
  leaderboard: (id: string) => `leaderboard:room:${id}`,
  userScore: (quizId: string, userId: string) => `room:score:${quizId}:${userId}`,
  answered: (quizId: string, qIndex: number) => `room:answered:${quizId}:${qIndex}`,
};

export const CACHE_TTL = 60 * 60; // 1 hour

// ─── Room state helpers ──────────────────────────────────────────────────────

export interface RoomState {
  quizId: string;
  currentQuestionIndex: number;
  qStartedAt: number; // unix ms
  status: 'waiting' | 'active' | 'ended';
  hostId: string;
}

export async function setRoomState(quizId: string, state: RoomState): Promise<void> {
  await redis.set(KEYS.roomState(quizId), JSON.stringify(state), 'EX', CACHE_TTL * 6);
}

export async function getRoomState(quizId: string): Promise<RoomState | null> {
  const raw = await redis.get(KEYS.roomState(quizId));
  return raw ? (JSON.parse(raw) as RoomState) : null;
}

export async function deleteRoomState(quizId: string): Promise<void> {
  await redis.del(KEYS.roomState(quizId));
}

// ─── Leaderboard helpers ─────────────────────────────────────────────────────

export async function updateLeaderboard(quizId: string, userId: string, score: number): Promise<void> {
  await redis.zadd(KEYS.leaderboard(quizId), 'NX', 0, userId); // ensure member exists
  await redis.zincrby(KEYS.leaderboard(quizId), score, userId);
  await redis.expire(KEYS.leaderboard(quizId), CACHE_TTL * 6);
}

export async function initLeaderboardMember(quizId: string, userId: string): Promise<void> {
  await redis.zadd(KEYS.leaderboard(quizId), 'NX', 0, userId);
  await redis.expire(KEYS.leaderboard(quizId), CACHE_TTL * 6);
}

export interface LeaderboardEntry {
  userId: string;
  score: number;
  rank: number;
}

export async function getTopLeaderboard(quizId: string, count = 10): Promise<LeaderboardEntry[]> {
  const raw = await redis.zrevrange(KEYS.leaderboard(quizId), 0, count - 1, 'WITHSCORES');
  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    entries.push({
      userId: raw[i],
      score: parseFloat(raw[i + 1]),
      rank: entries.length + 1,
    });
  }
  return entries;
}

export async function getUserRank(quizId: string, userId: string): Promise<number> {
  const rank = await redis.zrevrank(KEYS.leaderboard(quizId), userId);
  return rank !== null ? rank + 1 : -1;
}

// ─── Answer dedup ─────────────────────────────────────────────────────────────

export async function hasUserAnswered(quizId: string, qIndex: number, userId: string): Promise<boolean> {
  const result = await redis.sismember(KEYS.answered(quizId, qIndex), userId);
  return result === 1;
}

export async function markUserAnswered(quizId: string, qIndex: number, userId: string): Promise<void> {
  await redis.sadd(KEYS.answered(quizId, qIndex), userId);
  await redis.expire(KEYS.answered(quizId, qIndex), CACHE_TTL * 2);
}
