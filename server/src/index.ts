import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { redis, redisSub } from './services/redis';
import { setupWebSocketServer } from './ws/wsServer';
import authRoutes from './routes/auth';
import quizRoutes from './routes/quizzes';
import resultRoutes from './routes/results';

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '2mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/results',quizRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer(app);
setupWebSocketServer(server);

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/quizplatform');
    console.log('[DB] MongoDB connected');

    await redis.connect();
    await redisSub.connect();
    console.log('[Cache] Redis connected');

    server.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
      console.log(`[WS]     WebSocket endpoint: ws://localhost:${PORT}/ws`);
    });
  } catch (err) {
    console.error('[Startup] Fatal error:', err);
    process.exit(1);
  }
}

start();
