// Equal split — last share absorbs the rounding residue so the sum exactly
// equals the total (avoids server-side "split total ≠ amount" rejection).
export function calculateEqual(amount, memberIds) {
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

// Custom split — { userId: amount } that the caller supplies directly. The
// server validates that the sum equals the total; we surface a structured
// error here so the UI can warn before submission.
export function calculateCustom(amount, customMap) {
  const entries = Object.entries(customMap || {});
  const shares = entries.map(([user, a]) => ({ user, amount: Number(a) || 0 }));
  const sum = shares.reduce((acc, s) => acc + s.amount, 0);
  const amountsArePositive = shares.every((s) => s.amount > 0 && Number.isInteger(s.amount));
  const ok = amountsArePositive && sum === Number(amount);
  return { shares, ok, sum };
}

// Percentage split — { userId: percent }. Percents must add to 100 (±0.1).
export function calculatePercentage(amount, percentMap) {
  const entries = Object.entries(percentMap || {});
  const total = entries.reduce((acc, [, p]) => acc + (Number(p) || 0), 0);
  const percentageValuesArePositive = entries.every(([, p]) => Number(p) > 0);
  const ok = percentageValuesArePositive && Math.abs(total - 100) <= 0.1;
  const shares = entries.map(([user, p]) => ({
    user,
    amount: Math.round(((Number(p) || 0) / 100) * Number(amount)),
  }));
  // Patch rounding residue into the last share, same trick as calculateEqual.
  if (ok && shares.length) {
    const sum = shares.reduce((acc, s) => acc + s.amount, 0);
    const residue = Number(amount) - sum;
    if (residue !== 0) shares[shares.length - 1].amount += residue;
  }
  return {
    shares,
    ok: ok && shares.every((s) => s.amount > 0),
    totalPercent: Math.round(total * 10) / 10,
  };
}

// Net balance for one user across a list of expenses + confirmed settlements.
// Positive = others owe you; negative = you owe.
export function getNetBalance(expenses, settlements, userId) {
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

// Build a minimal-transactions debt graph from a balance map. Greedy match
// (largest creditor with largest debtor) — optimal for small N (≤20 typical).
export function minimizeTransactions(balanceMap) {
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
