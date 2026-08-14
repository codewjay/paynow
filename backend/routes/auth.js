const express = require('express');
const { body, validationResult } = require('express-validator');
const { admin } = require('../config/firebase');
const User = require('../models/User');
const { requireAuth, signJwt } = require('../middleware/auth');

const router = express.Router();

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg, details: errors.array() });
    return true;
  }
  return false;
};

// POST /api/auth/verify-token
// Body: { idToken } — Firebase ID token from the phone-auth client.
// Returns: { token (JWT), user, isNewUser }
router.post(
  '/verify-token',
  body('idToken').isString().notEmpty().withMessage('idToken required'),
  async (req, res, next) => {
    console.log('[verify-token] request received');
    if (handleValidation(req, res)) {
      console.log('[verify-token] validation failed:', validationResult(req).array());
      return;
    }
    try {
      const decoded = await admin.auth().verifyIdToken(req.body.idToken);
      console.log('[verify-token] decoded email:', decoded.email);
      if (!decoded.email) {
        console.log('[verify-token] no email in token');
        return res.status(400).json({ error: 'Token has no email — use email auth' });
      }
      const email = decoded.email;

      let user = await User.findOne({ firebaseUid: decoded.uid });
      let isNewUser = false;
      if (!user) {
        // A user may exist under the same email if they re-verified — link by email first.
        user = await User.findOne({ email });
        if (user) {
          user.firebaseUid = decoded.uid;
          await user.save();
        } else {
          user = await User.create({ firebaseUid: decoded.uid, email });
          isNewUser = true;
        }
      }

      const token = signJwt(user._id);
      res.json({ token, user: user.toPublicJSON(), isNewUser: isNewUser || !user.name });
    } catch (err) {
      if (err.code && err.code.startsWith('auth/')) {
        return res.status(401).json({ error: 'Invalid Firebase token' });
      }
      next(err);
    }
  }
);

// POST /api/auth/complete-profile  (requires JWT)
// Body: { name, upiId, username }
router.post(
  '/complete-profile',
  requireAuth,
  body('name').isString().trim().isLength({ min: 1, max: 60 }).withMessage('Name is required'),
  body('username').isString().trim().toLowerCase().matches(/^[a-z0-9_.-]{3,15}$/).withMessage('Username must be 3-15 chars (letters, numbers, _, ., -)'),
  body('upiId')
    .isString()
    .matches(/^[\w.\-]+@[\w]+$/)
    .withMessage('UPI ID must look like name@bank'),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const { name, upiId, username } = req.body;
      const existing = await User.findOne({ username: username.trim(), _id: { $ne: req.user._id } });
      if (existing) return res.status(400).json({ error: 'Username already taken' });

      req.user.name = name.trim();
      req.user.username = username.trim();
      req.user.upiId = upiId.trim();
      if (!req.user.avatar) req.user.avatar = req.user.name.charAt(0).toUpperCase();
      
      await req.user.save();
      res.json({ user: req.user.toPublicJSON() });
    } catch (err) {
      if (err.code === 11000) return res.status(400).json({ error: 'Username already taken' });
      next(err);
    }
  }
);

module.exports = router;
