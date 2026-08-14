const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const User = require('../models/User');
const Group = require('../models/Group');
const Friendship = require('../models/Friendship');
const { requireAuth } = require('../middleware/auth');
const { admin } = require('../config/firebase');

const router = express.Router();

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg, details: errors.array() });
    return true;
  }
  return false;
};

router.use(requireAuth);

// GET /api/users/me
router.get('/me', (req, res) => {
  res.json({ user: req.user.toPublicJSON() });
});

// PUT /api/users/me  — update name, upiId, fcmToken, username
router.put(
  '/me',
  body('name').optional().isString().trim().isLength({ min: 1, max: 60 }),
  body('upiId').optional().isString().matches(/^[\w.\-]+@[\w]+$/).withMessage('UPI ID must look like name@bank'),
  body('username').optional().isString().trim().toLowerCase().matches(/^[a-z0-9_.-]{3,20}$/).withMessage('Username must be 3-20 chars (letters, numbers, _, ., -)'),
  body('fcmToken').optional().isString().isLength({ max: 500 }),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const { name, upiId, fcmToken, username } = req.body;
      if (name !== undefined) req.user.name = name.trim();
      if (upiId !== undefined) req.user.upiId = upiId.trim();
      if (fcmToken !== undefined) req.user.fcmToken = fcmToken;
      
      if (username !== undefined) {
        const existing = await User.findOne({ username: username.trim(), _id: { $ne: req.user._id } });
        if (existing) return res.status(400).json({ error: 'Username already taken' });
        req.user.username = username.trim();
      }

      await req.user.save();
      res.json({ user: req.user.toPublicJSON() });
    } catch (err) {
      if (err.code === 11000) return res.status(400).json({ error: 'Username already taken' });
      next(err);
    }
  }
);

// GET /api/users/search?q=test@test.com
router.get(
  '/search',
  query('q').isString().trim().notEmpty().withMessage('Query required'),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const queryStr = req.query.q.toLowerCase();
      const user = await User.findOne({ 
        $or: [{ email: queryStr }, { username: queryStr }], 
        isDeleted: false 
      });
      if (!user || user._id.equals(req.user._id)) {
        return res.status(404).json({ error: 'No user found' });
      }
      res.json({ user: user.toPublicJSON() });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/users/friends/:userId  — add a friend (mutual)
router.post(
  '/friends/:userId',
  param('userId').isMongoId(),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const { userId } = req.params;
      if (req.user._id.equals(userId)) return res.status(400).json({ error: "Can't add yourself" });

      const friend = await User.findOne({ _id: userId, isDeleted: false });
      if (!friend) return res.status(404).json({ error: 'User not found' });

      const a = req.user._id;
      const b = friend._id;
      const existing = await Friendship.findOne({ users: { $all: [a, b] } });
      if (!existing) {
        await Friendship.create({ users: [a, b] });
      }

      res.json({ friend: friend.toPublicJSON() });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/users/friends
router.get('/friends', async (req, res, next) => {
  try {
    const friendships = await Friendship.find({ users: req.user._id }).populate({
      path: 'users',
      match: { _id: { $ne: req.user._id }, isDeleted: false },
    });
    
    // Extract the other user from each friendship
    const friends = friendships
      .map(f => f.users.find(u => u && !u.equals(req.user._id)))
      .filter(Boolean);
      
    res.json({ friends: friends.map((f) => f.toPublicJSON()) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/me  — GDPR-style account deletion.
// Retains a non-identifying tombstone for historical balances. Deleting the
// document or removing group membership would make past shares disappear from
// the ledger and corrupt the remaining members' balances.
router.delete('/me', async (req, res, next) => {
  try {
    const uid = req.user._id;
    const firebaseUid = req.user.firebaseUid;

    await Friendship.deleteMany({ users: uid });

    if (firebaseUid) {
      try {
        await admin.auth().deleteUser(firebaseUid);
      } catch (err) {
        // user-not-found is fine; anything else we log and proceed.
        if (err?.code !== 'auth/user-not-found') {
          console.warn('[auth] firebase deleteUser failed:', err?.message || err);
        }
      }
    }

    req.user.firebaseUid = `deleted:${uid}`;
    req.user.email = `deleted:${uid}@deleted.com`;
    req.user.username = undefined;
    req.user.name = 'Deleted user';
    req.user.upiId = '';
    req.user.avatar = '?';
    req.user.fcmToken = '';
    req.user.isDeleted = true;
    req.user.deletedAt = new Date();
    await req.user.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
