function isPositivePaiseAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && Number.isInteger(amount);
}

function hasSamePaiseTotal(left, right) {
  return Number(left) === Number(right);
}

module.exports = { hasSamePaiseTotal, isPositivePaiseAmount };
