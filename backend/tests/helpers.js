const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const User = require('../models/User');
const Group = require('../models/Group');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');

let mongod;

const TEST_JWT_SECRET = 'test-secret-at-least-32-chars-long!!!';

// ── Lifecycle ──────────────────────────────────────────────────────

async function setupTestDB() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

async function teardownTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

async function clearDB() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

// ── App factory ────────────────────────────────────────────────────

function createTestApp() {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.JWT_EXPIRES_IN = '1h';

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  const authRoutes = require('../routes/auth');
  const userRoutes = require('../routes/users');
  const groupRoutes = require('../routes/groups');
  const expenseRoutes = require('../routes/expenses');
  const settlementRoutes = require('../routes/settlements');

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/settlements', settlementRoutes);

  app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.path }));
  app.use((err, _req, res, _next) => {
    if (res.headersSent) return;
    if (err.type === 'entity.parse.failed' || err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ error: err.message || 'Invalid request' });
    }
    const status = err.status || 500;
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : (err.message || 'Request failed') });
  });

  // Wire a socket.io instance so the routes' io.to(...).emit(...) calls don't crash.
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  app.set('io', io);

  return { app, server, io };
}

// ── Helpers ────────────────────────────────────────────────────────

function signTestJwt(userId) {
  return jwt.sign({ sub: String(userId) }, TEST_JWT_SECRET, { expiresIn: '1h' });
}

async function createTestUser(overrides = {}) {
  const idx = Math.random().toString(36).slice(2, 8);
  const defaults = {
    firebaseUid: `fb_${idx}`,
    phone: `+91${String(Math.floor(Math.random() * 9e9) + 1e9).slice(0, 10)}`,
    name: `User ${idx}`,
    upiId: `user${idx}@okhdfcbank`,
  };
  const user = await User.create({ ...defaults, ...overrides });
  const token = signTestJwt(user._id);
  return { user, token };
}

async function createTestGroup({ creator, members = [], name = 'Test Group', emoji = '🏠' }) {
  const memberIds = [creator._id, ...members.map((m) => m._id)];
  const group = await Group.create({
    name,
    emoji,
    createdBy: creator._id,
    members: memberIds,
  });
  return group;
}

async function createTestExpense({ group, paidBy, splits, title = 'Test Expense', amount, category = 'Canteen' }) {
  const expense = await Expense.create({
    group: group._id,
    title,
    amount,
    category,
    paidBy: paidBy._id,
    splits,
    splitType: 'equal',
    createdBy: paidBy._id,
  });
  return expense;
}

module.exports = {
  setupTestDB,
  teardownTestDB,
  clearDB,
  createTestApp,
  signTestJwt,
  createTestUser,
  createTestGroup,
  createTestExpense,
  TEST_JWT_SECRET,
};
