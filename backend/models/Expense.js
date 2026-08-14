const mongoose = require('mongoose');
const { hasSamePaiseTotal, isPositivePaiseAmount } = require('../utils/money');

const SplitSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: {
      type: Number,
      required: true,
      validate: { validator: isPositivePaiseAmount, message: 'Amounts must be positive and have at most two decimal places' },
    },
    isPaid: { type: Boolean, default: false },
  },
  { _id: false }
);

const ExpenseSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    amount: {
      type: Number,
      required: true,
      validate: { validator: isPositivePaiseAmount, message: 'Amounts must be positive and have at most two decimal places' },
    },
    category: { type: String, default: '', maxlength: 40 },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    splits: { type: [SplitSchema], default: [] },
    splitType: { type: String, enum: ['equal', 'custom', 'percentage'], default: 'equal' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

// Sanity check: split totals must equal the expense amount (within 1 paisa).
ExpenseSchema.pre('validate', function (next) {
  if (!Array.isArray(this.splits) || this.splits.length === 0) {
    this.invalidate('splits', 'Expense must have at least one split');
    return next();
  }
  const sum = this.splits.reduce((acc, s) => acc + Number(s.amount || 0), 0);
  if (!hasSamePaiseTotal(sum, this.amount)) {
    this.invalidate('splits', `Split total (${sum.toFixed(2)}) does not equal expense amount (${Number(this.amount).toFixed(2)})`);
    return next();
  }
  next();
});

ExpenseSchema.index({ group: 1, createdAt: -1 });
ExpenseSchema.index({ paidBy: 1, createdAt: -1 });

module.exports = mongoose.model('Expense', ExpenseSchema);
