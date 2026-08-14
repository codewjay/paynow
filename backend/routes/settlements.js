const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Group = require('../models/Group');
const Settlement = require('../models/Settlement');
const Expense = require('../models/Expense');
const { requireAuth } = require('../middleware/auth');
const { sendToUser } = require('../config/notifications');
const { isPositivePaiseAmount } = require('../utils/money');

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

function emitRoom(req, groupId, event, payload) {
  req.app.get('io')?.to(`group:${groupId}`).emit(event, payload);
}

// POST /api/settlements/initiate  — payer marks themselves as paid (awaiting_confirmation)
router.post(
  '/initiate',
  body('groupId').isMongoId(),
  body('receiverId').isMongoId(),
  body('amount').custom(isPositivePaiseAmount).withMessage('amount must be a positive value with at most two decimal places'),
  body('expenseId').optional().isMongoId(),
  body('note').optional().isString().isLength({ max: 200 }),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const { groupId, receiverId, amount, expenseId, note } = req.body;

      const group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ error: 'Group not found' });

      const payerInGroup = group.members.some((m) => m.equals(req.user._id));
      const receiverInGroup = group.members.some((m) => m.equals(receiverId));
      if (!payerInGroup || !receiverInGroup) {
        return res.status(403).json({ error: 'Payer and receiver must both be group members' });
      }
      if (req.user._id.equals(receiverId)) {
        return res.status(400).json({ error: "Can't settle with yourself" });
      }
      if (expenseId) {
        const exists = await Expense.exists({ _id: expenseId, group: groupId });
        if (!exists) return res.status(400).json({ error: 'Expense not in this group' });
      }

      const pending = await Settlement.exists({
        group: groupId,
        payer: req.user._id,
        receiver: receiverId,
        status: 'awaiting_confirmation',
      });
      if (pending) {
        return res.status(409).json({ error: 'A payment to this person is already awaiting confirmation' });
      }

      let settlement;
      try {
        settlement = await Settlement.create({
          group: groupId,
          expense: expenseId || null,
          payer: req.user._id,
          receiver: receiverId,
          amount: Number(amount),
          status: 'awaiting_confirmation',
          paidAt: new Date(),
          note: note || '',
        });
      } catch (err) {
        if (err.code === 11000) {
          return res.status(409).json({ error: 'A payment to this person is already awaiting confirmation' });
        }
        throw err;
      }

      const populated = await Settlement.findById(settlement._id)
        .populate('payer', 'name phone avatar')
        .populate('receiver', 'name phone upiId avatar');

      emitRoom(req, groupId, 'payment_initiated', { settlement: populated });

      // Fire-and-forget push to the receiver so they get notified even when
      // the app is backgrounded and the socket room is unjoined.
      sendToUser(receiverId, {
        title: 'Payment incoming',
        body: `${populated.payer?.name || 'Someone'} paid you ₹${populated.amount}`,
        data: {
          type: 'payment_initiated',
          settlementId: String(populated._id),
          groupId: String(groupId),
        },
      });

      res.status(201).json({ settlement: populated });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/settlements/:settlementId/confirm  — receiver confirms money received
router.post(
  '/:settlementId/confirm',
  param('settlementId').isMongoId(),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      // Atomic transition: only one of confirm/dispute can win.
      const settlement = await Settlement.findOneAndUpdate(
        {
          _id: req.params.settlementId,
          receiver: req.user._id,
          status: 'awaiting_confirmation',
        },
        { $set: { status: 'confirmed', confirmedAt: new Date() } },
        { new: true }
      );
      if (!settlement) {
        // Distinguish "not found" from "wrong state / wrong user".
        const exists = await Settlement.findById(req.params.settlementId);
        if (!exists) return res.status(404).json({ error: 'Settlement not found' });
        if (!exists.receiver.equals(req.user._id)) {
          return res.status(403).json({ error: 'Only the receiver can confirm' });
        }
        return res.status(409).json({ error: 'Only an awaiting payment can be confirmed' });
      }

      const populated = await Settlement.findById(settlement._id)
        .populate('payer', 'name phone avatar')
        .populate('receiver', 'name phone upiId avatar');

      emitRoom(req, settlement.group, 'payment_confirmed', { settlement: populated });

      // Notify the payer that the receiver acknowledged the payment.
      sendToUser(settlement.payer, {
        title: 'Payment confirmed',
        body: `${populated.receiver?.name || 'They'} confirmed your ₹${populated.amount}`,
        data: {
          type: 'payment_confirmed',
          settlementId: String(populated._id),
          groupId: String(settlement.group),
        },
      });

      res.json({ settlement: populated });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/settlements/:settlementId/dispute  — receiver disputes
router.post(
  '/:settlementId/dispute',
  param('settlementId').isMongoId(),
  body('reason').optional().isString().isLength({ max: 200 }),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const updateFields = { status: 'disputed' };
      if (req.body.reason) updateFields.note = req.body.reason;

      // Atomic transition: only one of confirm/dispute can win.
      const settlement = await Settlement.findOneAndUpdate(
        {
          _id: req.params.settlementId,
          receiver: req.user._id,
          status: 'awaiting_confirmation',
        },
        { $set: updateFields },
        { new: true }
      );
      if (!settlement) {
        const exists = await Settlement.findById(req.params.settlementId);
        if (!exists) return res.status(404).json({ error: 'Settlement not found' });
        if (!exists.receiver.equals(req.user._id)) {
          return res.status(403).json({ error: 'Only the receiver can dispute' });
        }
        return res.status(409).json({ error: 'Only an awaiting payment can be disputed' });
      }

      const populated = await Settlement.findById(settlement._id)
        .populate('payer', 'name phone avatar')
        .populate('receiver', 'name phone avatar');

      emitRoom(req, settlement.group, 'payment_disputed', { settlement: populated });

      sendToUser(settlement.payer, {
        title: 'Payment disputed',
        body: `${populated.receiver?.name || 'They'} disputed your ₹${populated.amount} settlement`,
        data: {
          type: 'payment_disputed',
          settlementId: String(populated._id),
          groupId: String(settlement.group),
        },
      });

      res.json({ settlement: populated });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/settlements/group/:groupId
router.get(
  '/group/:groupId',
  param('groupId').isMongoId(),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const group = await Group.findById(req.params.groupId);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      if (!group.members.some((m) => m.equals(req.user._id))) {
        return res.status(403).json({ error: 'Not a member of this group' });
      }
      const settlements = await Settlement.find({ group: group._id })
        .populate('payer', 'name phone avatar')
        .populate('receiver', 'name phone upiId avatar')
        .sort({ createdAt: -1 });
      res.json({ settlements });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/settlements/pending  — settlements waiting on the current user to confirm/dispute
router.get('/pending', async (req, res, next) => {
  try {
    const settlements = await Settlement.find({
      receiver: req.user._id,
      status: 'awaiting_confirmation',
    })
      .populate('payer', 'name phone avatar')
      .populate('receiver', 'name phone upiId avatar')
      .populate('group', 'name emoji')
      .sort({ createdAt: -1 });
    res.json({ settlements });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
