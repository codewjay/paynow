const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Group = require('../models/Group');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const { requireAuth } = require('../middleware/auth');
const { sendToUser } = require('../config/notifications');
const { hasSamePaiseTotal, isPositivePaiseAmount } = require('../utils/money');

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

async function loadGroupForMember(groupId, userId) {
  const group = await Group.findById(groupId);
  if (!group) return { error: 'Group not found', status: 404 };
  if (!group.members.some((m) => m.equals(userId))) return { error: 'Not a member of this group', status: 403 };
  return { group };
}

// GET /api/expenses/group/:groupId
router.get(
  '/group/:groupId',
  param('groupId').isMongoId(),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const r = await loadGroupForMember(req.params.groupId, req.user._id);
      if (r.error) return res.status(r.status).json({ error: r.error });
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
      const skip = (page - 1) * limit;

      const [expenses, total] = await Promise.all([
        Expense.find({ group: r.group._id })
          .populate('paidBy', 'name phone avatar')
          .populate('createdBy', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Expense.countDocuments({ group: r.group._id })
      ]);

      res.json({ 
        expenses,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) }
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/expenses/group/:groupId
// Body: { title, amount, category, paidBy (userId), splits[{user, amount}], splitType }
router.post(
  '/group/:groupId',
  param('groupId').isMongoId(),
  body('title').isString().trim().isLength({ min: 1, max: 120 }),
  body('amount').custom(isPositivePaiseAmount).withMessage('amount must be a positive value with at most two decimal places'),
  body('category').optional().isString().isLength({ max: 40 }),
  body('paidBy').isMongoId(),
  body('splits').isArray({ min: 1 }),
  body('splits.*.user').isMongoId(),
  body('splits.*.amount').custom(isPositivePaiseAmount).withMessage('split amounts must be positive values with at most two decimal places'),
  body('splitType').optional().isIn(['equal', 'custom', 'percentage']),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const r = await loadGroupForMember(req.params.groupId, req.user._id);
      if (r.error) return res.status(r.status).json({ error: r.error });

      const memberIds = new Set(r.group.members.map((m) => String(m)));
      if (!memberIds.has(String(req.body.paidBy))) {
        return res.status(400).json({ error: 'paidBy must be a group member' });
      }
      for (const s of req.body.splits) {
        if (!memberIds.has(String(s.user))) {
          return res.status(400).json({ error: 'splits must reference group members only' });
        }
      }

      const expense = await Expense.create({
        group: r.group._id,
        title: req.body.title.trim(),
        amount: Number(req.body.amount),
        category: req.body.category || '',
        paidBy: req.body.paidBy,
        splits: req.body.splits.map((s) => ({ user: s.user, amount: Number(s.amount), isPaid: false })),
        splitType: req.body.splitType || 'equal',
        createdBy: req.user._id,
      });

      r.group.updatedAt = new Date();
      await r.group.save();

      const populated = await Expense.findById(expense._id).populate('paidBy', 'name phone avatar');

      // Broadcast to anyone watching this group room.
      req.app.get('io')?.to(`group:${r.group._id}`).emit('expense_added', { expense: populated });

      // Push to each split recipient that isn't the payer (they already know).
      const payerStr = String(req.body.paidBy);
      const me = String(req.user._id);
      const payerName = populated.paidBy?.name || 'Someone';
      for (const s of populated.splits || []) {
        const uid = String(s.user);
        if (uid === payerStr || uid === me) continue;
        sendToUser(uid, {
          title: `New expense in ${r.group.name}`,
          body: `${payerName} paid ₹${populated.amount} for ${populated.title} · your share ₹${s.amount}`,
          data: {
            type: 'expense_added',
            expenseId: String(populated._id),
            groupId: String(r.group._id),
          },
        });
      }

      res.status(201).json({ expense: populated });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/expenses/:expenseId
router.put(
  '/:expenseId',
  param('expenseId').isMongoId(),
  body('title').optional().isString().trim().isLength({ min: 1, max: 120 }),
  body('amount').optional().custom(isPositivePaiseAmount).withMessage('amount must be a positive value with at most two decimal places'),
  body('category').optional().isString().isLength({ max: 40 }),
  body('paidBy').optional().isMongoId(),
  body('splits').optional().isArray({ min: 1 }),
  body('splits.*.user').optional().isMongoId(),
  body('splits.*.amount').optional().custom(isPositivePaiseAmount).withMessage('split amounts must be positive values with at most two decimal places'),
  body('splitType').optional().isIn(['equal', 'custom', 'percentage']),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const expense = await Expense.findById(req.params.expenseId);
      if (!expense) return res.status(404).json({ error: 'Expense not found' });

      const r = await loadGroupForMember(expense.group, req.user._id);
      if (r.error) return res.status(r.status).json({ error: r.error });

      const memberIds = new Set(r.group.members.map((m) => String(m)));
      const nextPaidBy = req.body.paidBy ?? expense.paidBy;
      const nextSplits = req.body.splits ?? expense.splits;
      const nextAmount = req.body.amount ?? expense.amount;
      if (!memberIds.has(String(nextPaidBy))) {
        return res.status(400).json({ error: 'paidBy must be a group member' });
      }
      if (!nextSplits.every((s) => memberIds.has(String(s.user)))) {
        return res.status(400).json({ error: 'splits must reference group members only' });
      }
      const splitTotal = nextSplits.reduce((total, split) => total + Number(split.amount), 0);
      if (!hasSamePaiseTotal(splitTotal, nextAmount)) {
        return res.status(400).json({ error: 'Split total must equal the expense amount' });
      }

      const fields = ['title', 'amount', 'category', 'paidBy', 'splitType'];
      for (const f of fields) if (req.body[f] !== undefined) expense[f] = req.body[f];
      if (Array.isArray(req.body.splits)) {
        expense.splits = req.body.splits.map((s) => ({
          user: s.user,
          amount: Number(s.amount),
          isPaid: !!s.isPaid,
        }));
      }
      await expense.save();

      const populated = await Expense.findById(expense._id).populate('paidBy', 'name phone avatar');
      req.app.get('io')?.to(`group:${expense.group}`).emit('expense_updated', { expense: populated });
      res.json({ expense: populated });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/expenses/:expenseId  — only the creator may delete
router.delete(
  '/:expenseId',
  param('expenseId').isMongoId(),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const expense = await Expense.findById(req.params.expenseId);
      if (!expense) return res.status(404).json({ error: 'Expense not found' });

      const r = await loadGroupForMember(expense.group, req.user._id);
      if (r.error) return res.status(r.status).json({ error: r.error });

      if (!expense.createdBy.equals(req.user._id)) {
        return res.status(403).json({ error: 'Only the creator can delete this expense' });
      }

      const hasConfirmedSettlements = await Settlement.exists({ 
        expense: expense._id, 
        status: 'confirmed' 
      });
      if (hasConfirmedSettlements) {
        return res.status(409).json({ 
          error: 'Cannot delete expense because someone has already settled a portion of it.' 
        });
      }

      const groupId = expense.group;

      // Mark any in-flight settlements linked to this expense as disputed so
      // they don't silently reference a deleted expense.
      await Settlement.updateMany(
        { expense: expense._id, status: { $in: ['pending', 'awaiting_confirmation'] } },
        { $set: { status: 'disputed', note: 'Linked expense was deleted' } }
      );

      await expense.deleteOne();

      req.app.get('io')?.to(`group:${groupId}`).emit('expense_deleted', { expenseId: req.params.expenseId });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/expenses/activity  — recent expenses across all of the user's groups
router.get('/activity', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const query = { $or: [{ paidBy: req.user._id }, { 'splits.user': req.user._id }] };

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .populate('paidBy', 'name phone avatar')
        .populate('group', 'name emoji')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Expense.countDocuments(query)
    ]);

    res.json({ 
      expenses,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
