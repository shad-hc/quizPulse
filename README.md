# ⚡ QuizPulse — Live Quiz Platform

A production-ready, real-time quiz/assessment platform built with:
- **Frontend**: React + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Real-time**: Native WebSockets (`ws` library)
- **Cache & Leaderboard**: Redis (Pub/Sub, ZSETs, key-value)
- **Database**: MongoDB (Mongoose)
- **Infra**: Docker Compose

---

## Architecture

```
Browser (React)
    │  HTTP REST (JWT)       → Express API → MongoDB
    │  WebSocket (/ws?token) → WS Server  → Redis ZSETs + Room State
    └─────────────────────────────────────────────────────────────────
                            Redis:
                              leaderboard:room:<id>  ← ZSET (live scores)
                              room:state:<id>        ← current Q, timer
                              quiz:<id>              ← cached quiz JSON
                              quiz:questions:<id>    ← cached questions
```

---

## Quick Start (Docker)

```bash
git clone <repo>
cd quiz-platform
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api
- WebSocket: ws://localhost:4000/ws

---

## Local Dev (without Docker)

### Prerequisites
- Node.js 20+
- MongoDB running on `localhost:27017`
- Redis running on `localhost:6379`

### Backend
```bash
cd server
npm install
cp .env.example .env   # edit if needed
npm run dev
```

### Frontend
```bash
cd client
npm install
npm start
```

---

## API Reference

### Auth
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | `{email, name, password, role}` | Register |
| POST | `/api/auth/login` | `{email, password}` | Login → tokens |
| POST | `/api/auth/refresh` | `{refreshToken}` | Refresh tokens |
| GET | `/api/auth/me` | — | Current user |

### Quizzes (requires Bearer token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/quizzes` | List quizzes (role-filtered) |
| POST | `/api/quizzes` | Create quiz + questions (organizer) |
| GET | `/api/quizzes/:id` | Quiz detail + questions |
| PUT | `/api/quizzes/:id/start` | Start quiz room (organizer) |
| PUT | `/api/quizzes/:id/end` | End quiz (organizer) |

### Results
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/results/:quizId` | All results + leaderboard |
| GET | `/api/results/:quizId/user/:userId` | Single user result |
| GET | `/api/results/me` | My results |

---

## WebSocket Protocol

**Connect**: `ws://localhost:4000/ws?token=<JWT>&quizId=<id>`

### Client → Server events
```jsonc
// Organizer: advance to next question
{ "type": "next_question" }

// Participant: submit answer
{ "type": "answer", "questionId": "...", "optionIndex": 2 }

// Organizer: end quiz
{ "type": "end_quiz" }

// Anyone: ping
{ "type": "ping" }

// Anyone: request leaderboard
{ "type": "get_leaderboard" }
```

### Server → Client events
```jsonc
// Joined room
{ "type": "room_joined", "participantCount": 5, "roomState": {...}, "leaderboard": [...] }

// New question broadcast
{ "type": "question", "question": {...}, "qIndex": 0, "totalQuestions": 10, "remainingMs": 30000 }

// Your answer result
{ "type": "answer_result", "correct": true, "points": 10, "correctOptionIndex": 2, "timeTakenMs": 4200 }

// Leaderboard update (broadcast after each answer)
{ "type": "leaderboard", "leaderboard": [{"userId":"...","score":30,"rank":1}] }

// Quiz ended
{ "type": "quiz_ended", "leaderboard": [...] }

// Error
{ "type": "error", "message": "Already answered this question" }
```

---

## Redis Keys

| Key Pattern | Type | Purpose |
|-------------|------|---------|
| `quiz:<id>` | String (JSON) | Cached quiz object |
| `quiz:questions:<id>` | String (JSON) | Cached questions array |
| `room:state:<id>` | String (JSON) | Live room state (current Q, timer) |
| `leaderboard:room:<id>` | **ZSET** | Scores per user, sorted |
| `room:answered:<id>:<qIndex>` | Set | Dedup: who answered Q N |

### Leaderboard ZSET commands used:
- `ZADD leaderboard:room:<id> NX 0 <userId>` — initialize member
- `ZINCRBY leaderboard:room:<id> <points> <userId>` — atomic increment
- `ZREVRANGE leaderboard:room:<id> 0 9 WITHSCORES` — top 10

---

## Roles

| Role | Permissions |
|------|------------|
| `admin` | Everything |
| `organizer` | Create quizzes, host rooms, view all results |
| `user` | Join active quiz rooms, view own results |

---

## Project Structure

```
quiz-platform/
├── docker-compose.yml
├── server/
│   ├── src/
│   │   ├── index.ts              # Express + WS + Redis startup
│   │   ├── models/               # User, Quiz, Question, Result
│   │   ├── routes/               # auth, quizzes, results
│   │   ├── controllers/          # authController, quizController, resultController
│   │   ├── middleware/           # authenticate, requireRole
│   │   ├── services/
│   │   │   ├── redis.ts          # Redis client, ZSET helpers, room state
│   │   │   └── cache.ts          # Quiz/question caching
│   │   ├── ws/
│   │   │   └── wsServer.ts       # WebSocket server, room registry, event handlers
│   │   └── utils/
│   │       └── jwt.ts            # Token sign/verify
│   ├── Dockerfile
│   └── tsconfig.json
└── client/
    ├── src/
    │   ├── App.tsx               # Simple page router
    │   ├── contexts/AuthContext.tsx
    │   ├── hooks/useWebSocket.ts  # WS hook with auto-reconnect
    │   ├── services/api.ts        # HTTP client with token refresh
    │   └── pages/
    │       ├── LoginPage.tsx
    │       ├── QuizListPage.tsx
    │       ├── CreateQuizPage.tsx
    │       ├── QuizRoomPage.tsx   # Full real-time quiz room
    │       └── ResultsPage.tsx
    ├── public/index.html
    ├── Dockerfile
    └── nginx.conf
```
