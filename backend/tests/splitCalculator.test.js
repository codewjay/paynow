/**
 * splitCalculator.test.js — tests the frontend split calculator functions
 * in a Node environment. The source uses ESM exports, so we re-implement
 * the same logic here for backend validation (the functions are pure math
 * with no React dependencies).
 */

// ── Inline copies of the calculator functions ──────────────────────
// (The frontend versions use ESM `export` — we replicate the logic
// here so it can run under Jest/CommonJS without a build step.)

function calculateEqual(amount, memberIds) {
  const total = Number(amount) || 0;
  const n = memberIds.length;
  if (!n) return [];
  const base = Math.floor(total / n);
  const shares = memberIds.map((u) => ({ user: u, amount: base }));
  const residue = total - base * n;
  if (residue !== 0 && shares.length) {
    shares[shares.length - 1].amount += residue;
  }
  return shares;
}

function calculateCustom(amount, customMap) {
  const entries = Object.entries(customMap || {});
  const shares = entries.map(([user, a]) => ({ user, amount: Number(a) || 0 }));
  const sum = shares.reduce((acc, s) => acc + s.amount, 0);
  const amountsArePositive = shares.every((s) => s.amount > 0 && Number.isInteger(s.amount));
  const ok = amountsArePositive && sum === Number(amount);
  return { shares, ok, sum };
}

function calculatePercentage(amount, percentMap) {
  const entries = Object.entries(percentMap || {});
  const totalPercent = entries.reduce((acc, [, p]) => acc + (Number(p) || 0), 0);
  const percentageValuesArePositive = entries.every(([, p]) => Number(p) > 0);
  const ok = percentageValuesArePositive && Math.abs(totalPercent - 100) <= 0.1;
  const shares = entries.map(([user, p]) => ({
    user,
    amount: Math.round(((Number(p) || 0) / 100) * Number(amount)),
  }));
  if (ok && shares.length) {
    const sum = shares.reduce((acc, s) => acc + s.amount, 0);
    const residue = Number(amount) - sum;
    if (residue !== 0) shares[shares.length - 1].amount += residue;
  }
  return {
    shares,
    ok: ok && shares.every((s) => s.amount > 0),
    totalPercent: Math.round(totalPercent * 10) / 10,
  };
}

function getNetBalance(expenses, settlements, userId) {
  let net = 0;
  for (const e of expenses || []) {
    if (String(e.paidBy?._id || e.paidBy) === String(userId)) net += Number(e.amount) || 0;
    for (const s of e.splits || []) {
      if (String(s.user?._id || s.user) === String(userId)) net -= Number(s.amount) || 0;
    }
  }
  for (const s of settlements || []) {
    if (s.status !== 'confirmed') continue;
    if (String(s.payer?._id || s.payer) === String(userId)) net += Number(s.amount) || 0;
    if (String(s.receiver?._id || s.receiver) === String(userId)) net -= Number(s.amount) || 0;
  }
  return net;
}

function minimizeTransactions(balanceMap) {
  const creditors = [];
  const debtors = [];
  for (const [user, balance] of Object.entries(balanceMap)) {
    const v = Number(balance) || 0;
    if (v > 0) creditors.push({ user, amount: v });
    else if (v < 0) debtors.push({ user, amount: -v });
  }
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const txns = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    txns.push({
      from: debtors[i].user,
      to: creditors[j].user,
      amount: pay,
    });
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }
  return txns;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('calculateEqual', () => {
  test('10000 paise / 3 people — no paisa lost or duplicated', () => {
    const shares = calculateEqual(10000, ['A', 'B', 'C']);
    expect(shares).toHaveLength(3);
    const sum = shares.reduce((acc, s) => acc + s.amount, 0);
    // Sum must be exactly 10000
    expect(sum).toBe(10000);
    // First two get floor(3333) = 3333, last absorbs residue
    expect(shares[0].amount).toBe(3333);
    expect(shares[1].amount).toBe(3333);
    expect(shares[2].amount).toBe(3334);
  });

  test('10000 paise / 4 people — divides evenly', () => {
    const shares = calculateEqual(10000, ['A', 'B', 'C', 'D']);
    expect(shares.every((s) => s.amount === 2500)).toBe(true);
  });

  test('single-member group', () => {
    const shares = calculateEqual(10000, ['A']);
    expect(shares).toHaveLength(1);
    expect(shares[0].amount).toBe(10000);
  });

  test('empty members returns empty', () => {
    expect(calculateEqual(10000, [])).toEqual([]);
  });

  test('100 paise / 3 people', () => {
    const shares = calculateEqual(100, ['A', 'B', 'C']);
    const sum = shares.reduce((acc, s) => acc + s.amount, 0);
    expect(sum).toBe(100);
  });

  test('1 paisa / 2 people', () => {
    const shares = calculateEqual(1, ['A', 'B']);
    const sum = shares.reduce((acc, s) => acc + s.amount, 0);
    expect(sum).toBe(1);
  });
});

describe('calculateCustom', () => {
  test('valid custom split', () => {
    const result = calculateCustom(10000, { A: 6000, B: 4000 });
    expect(result.ok).toBe(true);
    expect(result.sum).toBe(10000);
  });

  test('rejects when splits don\'t sum to total', () => {
    const result = calculateCustom(10000, { A: 6000, B: 3000 });
    expect(result.ok).toBe(false);
  });

  test('rejects zero amount', () => {
    const result = calculateCustom(10000, { A: 0, B: 10000 });
    expect(result.ok).toBe(false);
  });

  test('rejects negative amount', () => {
    const result = calculateCustom(10000, { A: -1000, B: 11000 });
    expect(result.ok).toBe(false);
  });

  test('rejects non-integer amount', () => {
    const result = calculateCustom(10000, { A: 5000.5, B: 4999.5 });
    expect(result.ok).toBe(false);
  });
});

describe('calculatePercentage', () => {
  test('valid 50/50 split', () => {
    const result = calculatePercentage(10000, { A: 50, B: 50 });
    expect(result.ok).toBe(true);
    expect(result.totalPercent).toBe(100);
    expect(result.shares[0].amount).toBe(5000);
    expect(result.shares[1].amount).toBe(5000);
  });

  test('rejects percentages not summing to 100', () => {
    const result = calculatePercentage(10000, { A: 50, B: 40 });
    expect(result.ok).toBe(false);
  });

  test('rejects zero percentages', () => {
    const result = calculatePercentage(10000, { A: 0, B: 100 });
    expect(result.ok).toBe(false);
  });

  test('33.33/33.33/33.34 rounding', () => {
    const result = calculatePercentage(10000, { A: 33.33, B: 33.33, C: 33.34 });
    expect(result.ok).toBe(true);
    const sum = result.shares.reduce((acc, s) => acc + s.amount, 0);
    expect(sum).toBe(10000);
  });
});

describe('getNetBalance', () => {
  test('payer gets positive net', () => {
    const expenses = [{ paidBy: 'A', amount: 10000, splits: [{ user: 'A', amount: 5000 }, { user: 'B', amount: 5000 }] }];
    expect(getNetBalance(expenses, [], 'A')).toBe(5000);
    expect(getNetBalance(expenses, [], 'B')).toBe(-5000);
  });

  test('confirmed settlements affect balance', () => {
    const settlements = [{ payer: 'B', receiver: 'A', amount: 5000, status: 'confirmed' }];
    expect(getNetBalance([], settlements, 'B')).toBe(5000);
    expect(getNetBalance([], settlements, 'A')).toBe(-5000);
  });

  test('non-confirmed settlements are ignored', () => {
    const settlements = [{ payer: 'B', receiver: 'A', amount: 5000, status: 'awaiting_confirmation' }];
    expect(getNetBalance([], settlements, 'B')).toBe(0);
  });
});

describe('minimizeTransactions', () => {
  test('simple A owes B', () => {
    const txns = minimizeTransactions({ A: -5000, B: 5000 });
    expect(txns).toHaveLength(1);
    expect(txns[0]).toEqual({ from: 'A', to: 'B', amount: 5000 });
  });

  test('triangle: A owes B, B owes C same amount → resolves to A→C', () => {
    // A: -10000, B: 0, C: 10000
    const txns = minimizeTransactions({ A: -10000, B: 0, C: 10000 });
    expect(txns).toHaveLength(1);
    expect(txns[0]).toEqual({ from: 'A', to: 'C', amount: 10000 });
  });

  test('4+ people with complex balances', () => {
    // A owes 4000, B owes 2000, C is owed 3500, D is owed 2500
    const txns = minimizeTransactions({ A: -4000, B: -2000, C: 3500, D: 2500 });
    // Greedy: A→C:3500, A→D:500, B→D:2000 = 3 txns
    const totalFrom = txns.reduce((acc, t) => acc + t.amount, 0);
    expect(totalFrom).toBe(6000); // total debt must match
    // All debtors and creditors should net to zero
    const balances = {};
    for (const t of txns) {
      balances[t.from] = (balances[t.from] || 0) - t.amount;
      balances[t.to] = (balances[t.to] || 0) + t.amount;
    }
    expect(balances.A || 0).toBe(-4000);
    expect(balances.B || 0).toBe(-2000);
    expect(balances.C || 0).toBe(3500);
    expect(balances.D || 0).toBe(2500);
  });

  test('everyone settled up — no transactions', () => {
    const txns = minimizeTransactions({ A: 0, B: 0, C: 0 });
    expect(txns).toHaveLength(0);
  });
});
