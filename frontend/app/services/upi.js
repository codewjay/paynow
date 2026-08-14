import { Alert, Linking } from 'react-native';

// UPI deep link spec: upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=<note>
export async function openUPI({ upiId, name, amount, note = '' }) {
  if (!upiId || !amount) {
    Alert.alert('Missing payment info', 'UPI ID and amount are required.');
    return false;
  }
  const params = new URLSearchParams({
    pa: upiId,
    pn: name || '',
    am: (Number(amount) / 100).toFixed(2),
    cu: 'INR',
    tn: note,
  });
  const url = `upi://pay?${params.toString()}`;

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
  } catch (err) {
    console.warn('[upi] canOpenURL failed:', err);
  }

  // Fallback — no UPI app installed (typical on iOS simulators / web). Show
  // the details so the user can pay manually.
  Alert.alert(
    'Pay manually',
    `No UPI app responded. Pay ₹${(Number(amount) / 100).toFixed(2)} to ${upiId}${note ? `\nNote: ${note}` : ''}`
  );
  return false;
}

export function isValidUPI(upiId) {
  return /^[\w.\-]+@[\w]+$/.test(upiId || '');
}
