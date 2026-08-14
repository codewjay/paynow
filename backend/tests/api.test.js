const request = require('supertest');
const mongoose = require('mongoose');
const Settlement = require('../models/Settlement');
const Expense = require('../models/Expense');

const {
  setupTestDB,
  teardownTestDB,
  clearDB,
  createTestApp,
  signTestJwt,
  createTestUser,
  createTestGroup,
  createTestExpense,
} = require('./helpers');

let app;

beforeAll(async () => {
  await setupTestDB();
  const testApp = createTestApp();
  app = testApp.app;
});

afterAll(async () => {
  await teardownTestDB();
});

afterEach(async () => {
  await clearDB();
});

// ─── Auth ──────────────────────────────────────────────────────────

describe('Auth / Token Middleware', () => {
  test('GET /api/users/me without token → 401', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/missing/i);
  });

  test('GET /api/users/me with invalid token → 401', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer garbage.token.here');
    expect(res.status).toBe(401);
  });

  test('GET /api/users/me with expired token → 401', async () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign({ sub: 'fake' }, process.env.JWT_SECRET, { expiresIn: '0s' });
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/expired/i);
  });
});

// ─── Users ─────────────────────────────────────────────────────────

describe('Users API', () => {
  test('GET /api/users/me returns current user', async () => {
    const { token, user } = await createTestUser();
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user._id).toBe(String(user._id));
    expect(res.body.user.name).toBe(user.name);
  });

  test('PUT /api/users/me updates name', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Updated Name');
  });

  test('PUT /api/users/me rejects invalid UPI ID', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ upiId: 'not-a-valid-upi' });
    expect(res.status).toBe(400);
  });

  test('GET /api/users/search finds by phone', async () => {
    const { user: target } = await createTestUser();
    const { token } = await createTestUser();
    const res = await request(app)
      .get('/api/users/search')
      .query({ phone: target.phone })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user._id).toBe(String(target._id));
  });

  test('GET /api/users/search returns 404 for own phone', async () => {
    const { token, user } = await createTestUser();
    const res = await request(app)
      .get('/api/users/search')
      .query({ phone: user.phone })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('POST /api/users/friends/:id adds friend mutually', async () => {
    const { user: a, token: tokenA } = await createTestUser();
    const { user: b } = await createTestUser();

    const res = await request(app)
      .post(`/api/users/friends/${b._id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);

    const friendsRes = await request(app)
      .get('/api/users/friends')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(friendsRes.body.friends.some((f) => f._id === String(b._id))).toBe(true);
  });

  test('POST /api/users/friends/:id rejects adding self', async () => {
    const { user, token } = await createTestUser();
    const res = await request(app)
      .post(`/api/users/friends/${user._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

// ─── Groups ────────────────────────────────────────────────────────

describe('Groups API', () => {
  test('POST /api/groups creates a group', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Room 404', emoji: '🏠' });
    expect(res.status).toBe(201);
    expect(res.body.group.name).toBe('Room 404');
    expect(res.body.group.members).toHaveLength(1);
  });

  test('POST /api/groups with member phones', async () => {
    const { token: tokenA } = await createTestUser();
    const { user: b } = await createTestUser();
    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Test Group', memberPhones: [b.phone] });
    expect(res.status).toBe(201);
    expect(res.body.group.members).toHaveLength(2);
  });

  test('POST /api/groups rejects non-existent phone', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nope', memberPhones: ['+919999999999'] });
    expect(res.status).toBe(400);
  });

  test('GET /api/groups lists user groups', async () => {
    const { user, token } = await createTestUser();
    await createTestGroup({ creator: user, name: 'G1' });
    await createTestGroup({ creator: user, name: 'G2' });
    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.groups).toHaveLength(2);
  });

  test('GET /api/groups/:id returns group detail', async () => {
    const { user, token } = await createTestUser();
    const group = await createTestGroup({ creator: user });
    const res = await request(app)
      .get(`/api/groups/${group._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.group.name).toBe('Test Group');
  });

  test('GET /api/groups/:id rejects non-member', async () => {
    const { user: creator } = await createTestUser();
    const { token: outsiderToken } = await createTestUser();
    const group = await createTestGroup({ creator });
    const res = await request(app)
      .get(`/api/groups/${group._id}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/groups/:id with invalid ObjectId → 400', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .get('/api/groups/not-a-valid-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test('PUT /api/groups/:id updates group (creator only)', async () => {
    const { user, token } = await createTestUser();
    const group = await createTestGroup({ creator: user });
    const res = await request(app)
      .put(`/api/groups/${group._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.group.name).toBe('Renamed');
  });

  test('POST /api/groups/:id/members adds member', async () => {
    const { user: creator, token } = await createTestUser();
    const { user: newMember } = await createTestUser();
    const group = await createTestGroup({ creator });
    const res = await request(app)
      .post(`/api/groups/${group._id}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: newMember.phone });
    expect(res.status).toBe(200);
  });

  test('POST /api/groups/:id/members rejects duplicate', async () => {
    const { user: creator, token } = await createTestUser();
    const { user: member } = await createTestUser();
    const group = await createTestGroup({ creator, members: [member] });
    const res = await request(app)
      .post(`/api/groups/${group._id}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: member.phone });
    expect(res.status).toBe(409);
  });

  test('GET /api/groups/:id/balances returns zero for fresh group', async () => {
    const { user, token } = await createTestUser();
    const group = await createTestGroup({ creator: user });
    const res = await request(app)
      .get(`/api/groups/${group._id}/balances`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.balances.every((b) => b.net === 0)).toBe(true);
  });
});

// ─── Expenses ──────────────────────────────────────────────────────

describe('Expenses API', () => {
  let creator, creatorToken, member, group;

  beforeEach(async () => {
    const c = await createTestUser();
    creator = c.user;
    creatorToken = c.token;
    const m = await createTestUser();
    member = m.user;
    group = await createTestGroup({ creator, members: [member] });
  });

  test('POST /api/expenses/group/:id creates expense', async () => {
    const res = await request(app)
      .post(`/api/expenses/group/${group._id}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        title: 'Lunch',
        amount: 10000,
        category: 'Canteen',
        paidBy: String(creator._id),
        splits: [
          { user: String(creator._id), amount: 5000 },
          { user: String(member._id), amount: 5000 },
        ],
        splitType: 'equal',
      });
    expect(res.status).toBe(201);
    expect(res.body.expense.title).toBe('Lunch');
  });

  test('POST rejects splits that don\'t sum to amount', async () => {
    const res = await request(app)
      .post(`/api/expenses/group/${group._id}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        title: 'Bad split',
        amount: 10000,
        paidBy: String(creator._id),
        splits: [
          { user: String(creator._id), amount: 3000 },
          { user: String(member._id), amount: 3000 },
        ],
        splitType: 'custom',
      });
    expect(res.status).toBe(400);
  });

  test('POST rejects zero amount', async () => {
    const res = await request(app)
      .post(`/api/expenses/group/${group._id}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        title: 'Zero',
        amount: 0,
        paidBy: String(creator._id),
        splits: [{ user: String(creator._id), amount: 0 }],
      });
    expect(res.status).toBe(400);
  });

  test('POST rejects negative amount', async () => {
    const res = await request(app)
      .post(`/api/expenses/group/${group._id}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        title: 'Negative',
        amount: -5000,
        paidBy: String(creator._id),
        splits: [{ user: String(creator._id), amount: -5000 }],
      });
    expect(res.status).toBe(400);
  });

  test('POST rejects paidBy who is not a group member', async () => {
    const { user: outsider } = await createTestUser();
    const res = await request(app)
      .post(`/api/expenses/group/${group._id}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        title: 'Outsider pays',
        amount: 10000,
        paidBy: String(outsider._id),
        splits: [
          { user: String(creator._id), amount: 5000 },
          { user: String(member._id), amount: 5000 },
        ],
      });
    expect(res.status).toBe(400);
  });

  test('GET /api/expenses/group/:id lists expenses', async () => {
    await createTestExpense({
      group,
      paidBy: creator,
      amount: 10000,
      splits: [
        { user: creator._id, amount: 5000 },
        { user: member._id, amount: 5000 },
      ],
    });
    const res = await request(app)
      .get(`/api/expenses/group/${group._id}`)
      .set('Authorization', `Bearer ${creatorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.expenses).toHaveLength(1);
  });

  test('DELETE /api/expenses/:id deletes and cleans up orphan settlements', async () => {
    const expense = await createTestExpense({
      group,
      paidBy: creator,
      amount: 10000,
      splits: [
        { user: creator._id, amount: 5000 },
        { user: member._id, amount: 5000 },
      ],
    });

    // Create an in-flight settlement linked to this expense
    const settlement = await Settlement.create({
      group: group._id,
      expense: expense._id,
      payer: member._id,
      receiver: creator._id,
      amount: 5000,
      status: 'awaiting_confirmation',
      paidAt: new Date(),
    });

    const res = await request(app)
      .delete(`/api/expenses/${expense._id}`)
      .set('Authorization', `Bearer ${creatorToken}`);
    expect(res.status).toBe(200);

    // Settlement should be marked disputed with system note
    const updated = await Settlement.findById(settlement._id);
    expect(updated.status).toBe('disputed');
    expect(updated.note).toMatch(/deleted/i);
  });

  test('GET /api/expenses/activity returns user\'s expenses', async () => {
    await createTestExpense({
      group,
      paidBy: creator,
      amount: 10000,
      splits: [
        { user: creator._id, amount: 5000 },
        { user: member._id, amount: 5000 },
      ],
    });
    const res = await request(app)
      .get('/api/expenses/activity')
      .set('Authorization', `Bearer ${creatorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.expenses.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Settlements ───────────────────────────────────────────────────

describe('Settlements API', () => {
  let payer, payerToken, receiver, receiverToken, group, expense;

  beforeEach(async () => {
    const p = await createTestUser();
    payer = p.user;
    payerToken = p.token;
    const r = await createTestUser();
    receiver = r.user;
    receiverToken = r.token;
    group = await createTestGroup({ creator: payer, members: [receiver] });
    expense = await createTestExpense({
      group,
      paidBy: payer,
      amount: 10000,
      splits: [
        { user: payer._id, amount: 5000 },
        { user: receiver._id, amount: 5000 },
      ],
    });
  });

  test('POST /api/settlements/initiate creates awaiting settlement', async () => {
    const res = await request(app)
      .post('/api/settlements/initiate')
      .set('Authorization', `Bearer ${payerToken}`)
      .send({
        groupId: String(group._id),
        receiverId: String(receiver._id),
        amount: 5000,
      });
    expect(res.status).toBe(201);
    expect(res.body.settlement.status).toBe('awaiting_confirmation');
  });

  test('initiate rejects self-settlement', async () => {
    const res = await request(app)
      .post('/api/settlements/initiate')
      .set('Authorization', `Bearer ${payerToken}`)
      .send({
        groupId: String(group._id),
        receiverId: String(payer._id),
        amount: 5000,
      });
    expect(res.status).toBe(400);
  });

  test('initiate rejects duplicate awaiting settlement', async () => {
    await request(app)
      .post('/api/settlements/initiate')
      .set('Authorization', `Bearer ${payerToken}`)
      .send({
        groupId: String(group._id),
        receiverId: String(receiver._id),
        amount: 50,
      });
    const res = await request(app)
      .post('/api/settlements/initiate')
      .set('Authorization', `Bearer ${payerToken}`)
      .send({
        groupId: String(group._id),
        receiverId: String(receiver._id),
        amount: 50,
      });
    expect(res.status).toBe(409);
  });

  // ── State machine: happy paths ──

  test('full lifecycle: initiate → confirm', async () => {
    const init = await request(app)
      .post('/api/settlements/initiate')
      .set('Authorization', `Bearer ${payerToken}`)
      .send({
        groupId: String(group._id),
        receiverId: String(receiver._id),
        amount: 50,
      });
    const sid = init.body.settlement._id;

    const confirm = await request(app)
      .post(`/api/settlements/${sid}/confirm`)
      .set('Authorization', `Bearer ${receiverToken}`);
    expect(confirm.status).toBe(200);
    expect(confirm.body.settlement.status).toBe('confirmed');
    expect(confirm.body.settlement.confirmedAt).toBeTruthy();
  });

  test('full lifecycle: initiate → dispute', async () => {
    const init = await request(app)
      .post('/api/settlements/initiate')
      .set('Authorization', `Bearer ${payerToken}`)
      .send({
        groupId: String(group._id),
        receiverId: String(receiver._id),
        amount: 50,
      });
    const sid = init.body.settlement._id;

    const dispute = await request(app)
      .post(`/api/settlements/${sid}/dispute`)
      .set('Authorization', `Bearer ${receiverToken}`)
      .send({ reason: 'Did not receive' });
    expect(dispute.status).toBe(200);
    expect(dispute.body.settlement.status).toBe('disputed');
  });

  // ── State machine: invalid transitions ──

  test('cannot confirm a pending settlement (should be awaiting)', async () => {
    const settlement = await Settlement.create({
      group: group._id,
      payer: payer._id,
      receiver: receiver._id,
      amount: 5000,
      status: 'pending',
    });
    const res = await request(app)
      .post(`/api/settlements/${settlement._id}/confirm`)
      .set('Authorization', `Bearer ${receiverToken}`);
    expect(res.status).toBe(409);
  });

  test('cannot confirm an already confirmed settlement', async () => {
    const init = await request(app)
      .post('/api/settlements/initiate')
      .set('Authorization', `Bearer ${payerToken}`)
      .send({
        groupId: String(group._id),
        receiverId: String(receiver._id),
        amount: 50,
      });
    const sid = init.body.settlement._id;

    await request(app)
      .post(`/api/settlements/${sid}/confirm`)
      .set('Authorization', `Bearer ${receiverToken}`);

    const second = await request(app)
      .post(`/api/settlements/${sid}/confirm`)
      .set('Authorization', `Bearer ${receiverToken}`);
    expect(second.status).toBe(409);
  });

  test('cannot dispute an already confirmed settlement', async () => {
    const init = await request(app)
      .post('/api/settlements/initiate')
      .set('Authorization', `Bearer ${payerToken}`)
      .send({
        groupId: String(group._id),
        receiverId: String(receiver._id),
        amount: 50,
      });
    const sid = init.body.settlement._id;

    await request(app)
      .post(`/api/settlements/${sid}/confirm`)
      .set('Authorization', `Bearer ${receiverToken}`);

    const res = await request(app)
      .post(`/api/settlements/${sid}/dispute`)
      .set('Authorization', `Bearer ${receiverToken}`);
    expect(res.status).toBe(409);
  });

  test('payer cannot confirm their own settlement', async () => {
    const init = await request(app)
      .post('/api/settlements/initiate')
      .set('Authorization', `Bearer ${payerToken}`)
      .send({
        groupId: String(group._id),
        receiverId: String(receiver._id),
        amount: 50,
      });
    const sid = init.body.settlement._id;

    const res = await request(app)
      .post(`/api/settlements/${sid}/confirm`)
      .set('Authorization', `Bearer ${payerToken}`);
    expect(res.status).toBe(403);
  });

  // ── Concurrency test ──

  test('concurrent confirm + dispute: only one wins', async () => {
    const init = await request(app)
      .post('/api/settlements/initiate')
      .set('Authorization', `Bearer ${payerToken}`)
      .send({
        groupId: String(group._id),
        receiverId: String(receiver._id),
        amount: 50,
      });
    const sid = init.body.settlement._id;

    // Fire both simultaneously
    const [confirmRes, disputeRes] = await Promise.all([
      request(app)
        .post(`/api/settlements/${sid}/confirm`)
        .set('Authorization', `Bearer ${receiverToken}`),
      request(app)
        .post(`/api/settlements/${sid}/dispute`)
        .set('Authorization', `Bearer ${receiverToken}`),
    ]);

    // Exactly one should succeed (200), the other should get 409
    const statuses = [confirmRes.status, disputeRes.status].sort();
    expect(statuses).toEqual([200, 409]);

    // DB should have a single consistent status
    const final = await Settlement.findById(sid);
    expect(['confirmed', 'disputed']).toContain(final.status);
  });

  // ── List endpoints ──

  test('GET /api/settlements/group/:id lists settlements', async () => {
    await Settlement.create({
      group: group._id,
      payer: payer._id,
      receiver: receiver._id,
      amount: 50,
      status: 'awaiting_confirmation',
      paidAt: new Date(),
    });

    const res = await request(app)
      .get(`/api/settlements/group/${group._id}`)
      .set('Authorization', `Bearer ${payerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.settlements).toHaveLength(1);
  });

  test('GET /api/settlements/pending returns receiver\'s pending items', async () => {
    await Settlement.create({
      group: group._id,
      payer: payer._id,
      receiver: receiver._id,
      amount: 50,
      status: 'awaiting_confirmation',
      paidAt: new Date(),
    });

    const res = await request(app)
      .get('/api/settlements/pending')
      .set('Authorization', `Bearer ${receiverToken}`);
    expect(res.status).toBe(200);
    expect(res.body.settlements).toHaveLength(1);
  });

  test('GET /api/settlements/pending returns nothing for payer', async () => {
    await Settlement.create({
      group: group._id,
      payer: payer._id,
      receiver: receiver._id,
      amount: 50,
      status: 'awaiting_confirmation',
      paidAt: new Date(),
    });

    const res = await request(app)
      .get('/api/settlements/pending')
      .set('Authorization', `Bearer ${payerToken}`);
    expect(res.body.settlements).toHaveLength(0);
  });
});

// ─── Balances (integration check) ─────────────────────────────────

describe('Balances — end-to-end', () => {
  test('expense + confirmed settlement brings net to zero', async () => {
    const { user: a, token: tokenA } = await createTestUser();
    const { user: b, token: tokenB } = await createTestUser();
    const group = await createTestGroup({ creator: a, members: [b] });

    // A pays ₹100, split equally
    await createTestExpense({
      group,
      paidBy: a,
      amount: 10000,
      splits: [
        { user: a._id, amount: 5000 },
        { user: b._id, amount: 5000 },
      ],
    });

    // Check: A is owed ₹50, B owes ₹50
    let bal = await request(app)
      .get(`/api/groups/${group._id}/balances`)
      .set('Authorization', `Bearer ${tokenA}`);
    const aNet = bal.body.balances.find((b) => String(b.user._id) === String(a._id)).net;
    const bNet = bal.body.balances.find((b) => String(b.user._id) === String(a._id) ? false : true).net;
    expect(aNet).toBe(5000);
    expect(bNet).toBe(-5000);

    // B settles with A
    const init = await request(app)
      .post('/api/settlements/initiate')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        groupId: String(group._id),
        receiverId: String(a._id),
        amount: 5000,
      });
    await request(app)
      .post(`/api/settlements/${init.body.settlement._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Check: both should now be zero
    bal = await request(app)
      .get(`/api/groups/${group._id}/balances`)
      .set('Authorization', `Bearer ${tokenA}`);
    for (const b of bal.body.balances) {
      expect(b.net).toBe(0);
    }
  });
});
