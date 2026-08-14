const express = require('express');
const mongoose = require('mongoose');
const { body, param, validationResult } = require('express-validator');
const Group = require('../models/Group');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const { requireAuth } = require('../middleware/auth');

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

// Helper: load a group and verify the current user is a member.
async function loadGroupForMember(req, res) {
  const group = await Group.findById(req.params.groupId);
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return null;
  }
  if (!group.members.some((m) => m.equals(req.user._id))) {
    res.status(403).json({ error: 'Not a member of this group' });
    return null;
  }
  return group;
}

// GET /api/groups  — groups the current user belongs to, with net-balance summary
router.get('/', async (req, res, next) => {
  try {
    const groups = await Group.find({ members: req.user._id, isActive: true })
      .populate('members', 'name email upiId avatar')
      .sort({ updatedAt: -1 });

    // Compute per-group net for this user (so the home list can show +/- without a second round trip).
    const ids = groups.map((g) => g._id);
    const expenseAgg = await Expense.aggregate([
      { $match: { group: { $in: ids } } },
      {
        $project: {
          group: 1,
          paidByMe: {
            $cond: [{ $eq: ['$paidBy', req.user._id] }, '$amount', 0]
          },
          mySplit: {
            $reduce: {
              input: {
                $filter: {
                  input: { $ifNull: ['$splits', []] },
                  as: 'split',
                  cond: { $eq: ['$$split.user', req.user._id] }
                }
              },
              initialValue: 0,
              in: { $add: ['$$value', '$$this.amount'] }
            }
          }
        }
      },
      {
        $group: {
          _id: '$group',
          netExpense: { $sum: { $subtract: ['$paidByMe', '$mySplit'] } }
        }
      }
    ]);

    const settlementAgg = await Settlement.aggregate([
      { $match: { group: { $in: ids }, status: 'confirmed' } },
      {
        $group: {
          _id: '$group',
          netSettlement: {
            $sum: {
              $cond: [
                { $eq: ['$payer', req.user._id] },
                '$amount',
                {
                  $cond: [
                    { $eq: ['$receiver', req.user._id] },
                    { $multiply: ['$amount', -1] },
                    0
                  ]
                }
              ]
            }
          }
        }
      }
    ]);

    const netByGroup = new Map(ids.map((id) => [String(id), 0]));

    for (const doc of expenseAgg) {
      const gid = String(doc._id);
      netByGroup.set(gid, netByGroup.get(gid) + doc.netExpense);
    }
    
    for (const doc of settlementAgg) {
      const gid = String(doc._id);
      netByGroup.set(gid, netByGroup.get(gid) + doc.netSettlement);
    }

    res.json({
      groups: groups.map((g) => ({
        _id: g._id,
        name: g.name,
        emoji: g.emoji,
        members: g.members.map((m) => m.toPublicJSON()),
        net: netByGroup.get(String(g._id)) || 0,
        updatedAt: g.updatedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/groups  — { name, emoji, memberemails[] }
router.post(
  '/',
  body('name').isString().trim().isLength({ min: 1, max: 60 }),
  body('emoji').optional().isString().isLength({ max: 8 }),
  body('memberemails').optional().isArray(),
  body('memberemails.*').optional().matches(/^\+91\d{10}$/),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const { name, emoji = '', memberemails = [] } = req.body;
      const emailSet = new Set(memberemails.filter((p) => p !== req.user.email));
      const others = emailSet.size ? await User.find({ email: { $in: [...emailSet] }, isDeleted: false }) : [];
      if (others.length !== emailSet.size) {
        return res.status(400).json({ error: 'Every member must already have an active PayNow account' });
      }

      const memberIds = [req.user._id, ...others.map((u) => u._id)];
      const group = await Group.create({
        name: name.trim(),
        emoji,
        createdBy: req.user._id,
        members: memberIds,
      });

      const populated = await Group.findById(group._id).populate('members', 'name email upiId avatar');
      res.status(201).json({
        group: {
          _id: populated._id,
          name: populated.name,
          emoji: populated.emoji,
          members: populated.members.map((m) => m.toPublicJSON()),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/groups/:groupId
router.get(
  '/:groupId',
  param('groupId').isMongoId(),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const group = await loadGroupForMember(req, res);
      if (!group) return;
      const populated = await Group.findById(group._id).populate('members', 'name email upiId avatar');
      const expenses = await Expense.find({ group: group._id })
        .populate('paidBy', 'name email avatar')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });

      res.json({
        group: {
          _id: populated._id,
          name: populated.name,
          emoji: populated.emoji,
          members: populated.members.map((m) => m.toPublicJSON()),
          createdBy: populated.createdBy,
          createdAt: populated.createdAt,
        },
        expenses,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/groups/:groupId  — rename / change emoji
router.put(
  '/:groupId',
  param('groupId').isMongoId(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 60 }),
  body('emoji').optional().isString().isLength({ max: 8 }),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const group = await loadGroupForMember(req, res);
      if (!group) return;
      if (!group.createdBy.equals(req.user._id)) {
        return res.status(403).json({ error: 'Only the creator can update this group' });
      }
      if (req.body.name !== undefined) group.name = req.body.name.trim();
      if (req.body.emoji !== undefined) group.emoji = req.body.emoji;
      await group.save();
      res.json({ group: { _id: group._id, name: group.name, emoji: group.emoji } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/groups/:groupId/members  — { email }
router.post(
  '/:groupId/members',
  param('groupId').isMongoId(),
  body('email').matches(/^\+91\d{10}$/),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const group = await loadGroupForMember(req, res);
      if (!group) return;

      const user = await User.findOne({ email: req.body.email, isDeleted: false });
      if (!user) return res.status(404).json({ error: 'No user with that email — invite them to PayNow first' });
      if (group.members.some((m) => m.equals(user._id))) {
        return res.status(409).json({ error: 'Already a member' });
      }

      group.members.push(user._id);
      await group.save();

      res.json({ member: user.toPublicJSON() });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/groups/:groupId/members/:userId
router.delete(
  '/:groupId/members/:userId',
  param('groupId').isMongoId(),
  param('userId').isMongoId(),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const group = await loadGroupForMember(req, res);
      if (!group) return;
      if (!group.createdBy.equals(req.user._id) && !req.user._id.equals(req.params.userId)) {
        return res.status(403).json({ error: 'Only the creator can remove other members' });
      }

      const uid = new mongoose.Types.ObjectId(req.params.userId);
      if (group.createdBy.equals(uid)) {
        return res.status(409).json({ error: 'The group creator cannot leave or be removed' });
      }

      const [expenseHistory, settlementHistory] = await Promise.all([
        Expense.exists({ group: group._id, $or: [{ paidBy: uid }, { 'splits.user': uid }] }),
        Settlement.exists({ group: group._id, $or: [{ payer: uid }, { receiver: uid }] }),
      ]);
      if (expenseHistory || settlementHistory) {
        return res.status(409).json({ error: 'Members with expense or settlement history cannot be removed' });
      }

      group.members = group.members.filter((m) => !m.equals(uid));
      await group.save();

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/groups/:groupId  — Delete the group completely
router.delete(
  '/:groupId',
  param('groupId').isMongoId(),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const group = await loadGroupForMember(req, res);
      if (!group) return;
      if (!group.createdBy.equals(req.user._id)) {
        return res.status(403).json({ error: 'Only the creator can delete this group' });
      }

      // Delete all expenses and settlements associated with this group
      await Promise.all([
        Expense.deleteMany({ group: group._id }),
        Settlement.deleteMany({ group: group._id }),
        Group.deleteOne({ _id: group._id })
      ]);

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/groups/:groupId/balances  — per-member net balance in this group
router.get(
  '/:groupId/balances',
  param('groupId').isMongoId(),
  async (req, res, next) => {
    if (handleValidation(req, res)) return;
    try {
      const group = await loadGroupForMember(req, res);
      if (!group) return;

      const expenses = await Expense.find({ group: group._id }).lean();
      const settlements = await Settlement.find({ group: group._id, status: 'confirmed' }).lean();

      const net = new Map(group.members.map((m) => [String(m), 0]));
      for (const e of expenses) {
        const payer = String(e.paidBy);
        if (net.has(payer)) net.set(payer, net.get(payer) + e.amount);
        for (const s of e.splits || []) {
          const u = String(s.user);
          if (net.has(u)) net.set(u, net.get(u) - s.amount);
        }
      }
      for (const s of settlements) {
        const p = String(s.payer);
        const r = String(s.receiver);
        if (net.has(p)) net.set(p, net.get(p) + s.amount);
        if (net.has(r)) net.set(r, net.get(r) - s.amount);
      }

      const populated = await Group.findById(group._id).populate('members', 'name email upiId avatar');
      const balances = populated.members.map((m) => ({
        user: m.toPublicJSON(),
        net: net.get(String(m._id)) || 0,
      }));

      res.json({ balances });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
