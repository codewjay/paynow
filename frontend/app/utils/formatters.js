// ₹1,450 — Indian-grouping ("en-IN") locale. Expects paise.
export function formatINR(paiseAmount, { withSign = false } = {}) {
  const n = Number(paiseAmount) || 0;
  const inrValue = n / 100;
  const abs = Math.abs(inrValue);
  const formatted = abs.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const sign = withSign ? (inrValue >= 0 ? '+' : '−') : '';
  return `${sign}₹${formatted}`;
}

const DAY = 24 * 60 * 60 * 1000;

export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;

  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return 'Today';

  const yest = new Date(now.getTime() - DAY);
  if (yest.toDateString() === d.toDateString()) return 'Yesterday';

  if (diff < 7 * DAY) {
    return d.toLocaleDateString('en-IN', { weekday: 'short' });
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function initialsOf(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}


export function sanitizeMoneyInput(value) {
  const [whole = '', ...fractionParts] = String(value || '').replace(/[^\d.]/g, '').split('.');
  if (fractionParts.length === 0) return whole;
  return `${whole || '0'}.${fractionParts.join('').slice(0, 2)}`;
}
