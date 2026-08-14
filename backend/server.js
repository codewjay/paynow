require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const { connectDB } = require('./config/db');
const { initFirebase } = require('./config/firebase');
const { registerSocketHandlers } = require('./socket/handlers');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const groupRoutes = require('./routes/groups');
const expenseRoutes = require('./routes/expenses');
const settlementRoutes = require('./routes/settlements');

const PORT = Number(process.env.PORT) || 5000;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim());

function validateEnvironment() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a random value of at least 32 characters');
  }
  if (process.env.NODE_ENV === 'production' && CORS_ORIGINS.includes('*')) {
    throw new Error('CORS_ORIGINS must name explicit origins in production');
  }
}

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin(origin, cb) {
    if (!origin || CORS_ORIGINS.includes('*') || CORS_ORIGINS.includes(origin)) return cb(null, true);
    // Expo dev clients connect from exp://… origins; allow when the wildcard is configured.
    if (CORS_ORIGINS.some((o) => o.endsWith('*') && origin.startsWith(o.slice(0, -1)))) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  // Authentication uses an Authorization header, not browser cookies.
  credentials: false,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.path }));

// Centralized error handler — keeps route code small (no try/catch boilerplate everywhere).
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  if (err.type === 'entity.parse.failed' || err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ error: err.message || 'Invalid request' });
  }
  const status = err.status || 500;
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : (err.message || 'Request failed') });
});

const io = new Server(server, { cors: corsOptions });

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Missing auth token'));
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.sub;
    next();
  } catch (err) {
    next(new Error('Invalid auth token'));
  }
});

registerSocketHandlers(io);

// Expose the io instance to route handlers via req.app.get('io') so settlement
// routes can broadcast room events when REST mutations happen.
app.set('io', io);

async function start() {
  try {
    validateEnvironment();
    initFirebase();
    await connectDB();
    server.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
  } catch (err) {
    console.error('[startup] failed:', err);
    process.exit(1);
  }
}

start();

module.exports = { app, server };
