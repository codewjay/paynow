const mongoose = require('mongoose');
const { isPositivePaiseAmount } = require('../utils/money');

const SettlementSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    expense: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null },
    payer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: {
      type: Number,
      required: true,
      validate: { validator: isPositivePaiseAmount, message: 'Amounts must be positive and have at most two decimal places' },
    },
    status: {
      type: String,
      enum: ['pending', 'awaiting_confirmation', 'confirmed', 'disputed'],
      default: 'pending',
    },
    paidAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    note: { type: String, default: '', maxlength: 200 },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

SettlementSchema.index(
  { group: 1, payer: 1, receiver: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'awaiting_confirmation' } }
);
SettlementSchema.index({ group: 1, createdAt: -1 });
SettlementSchema.index({ receiver: 1, status: 1 });
SettlementSchema.index({ payer: 1, status: 1 });

module.exports = mongoose.model('Settlement', SettlementSchema);
