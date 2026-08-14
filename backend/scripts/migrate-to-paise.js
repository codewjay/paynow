require('dotenv').config();
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Migrate Expenses
  const expenses = await Expense.find();
  for (const e of expenses) {
    if (e.amount > 0) {
      e.amount = Math.round(e.amount * 100);
      for (const s of e.splits) {
        s.amount = Math.round(s.amount * 100);
      }
      await e.save();
    }
  }
  console.log(`Migrated ${expenses.length} expenses.`);

  // Migrate Settlements
  const settlements = await Settlement.find();
  for (const s of settlements) {
    if (s.amount > 0) {
      s.amount = Math.round(s.amount * 100);
      await s.save();
    }
  }
  console.log(`Migrated ${settlements.length} settlements.`);

  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
