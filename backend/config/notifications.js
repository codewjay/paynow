const { admin } = require('./firebase');
const User = require('../models/User');

// Send an FCM push to a single user. Silently no-ops when the user has no
// token or the platform rejects the token (we don't want a transient push
// failure to block the REST mutation that triggered it).
async function sendToUser(userId, { title, body, data }) {
  try {
    const user = await User.findById(userId).select('fcmToken');
    if (!user?.fcmToken) return { skipped: true, reason: 'no-token' };

    const message = {
      token: user.fcmToken,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [k, String(v)])
      ),
      android: { priority: 'high' },
      apns: { headers: { 'apns-priority': '10' } },
    };
    await admin.messaging().send(message);
    return { ok: true };
  } catch (err) {
    // Stale tokens come back as messaging/registration-token-not-registered.
    // Clear them so we don't keep retrying.
    if (err?.errorInfo?.code === 'messaging/registration-token-not-registered') {
      await User.updateOne({ _id: userId }, { $set: { fcmToken: '' } });
    }
    console.warn('[fcm] send failed:', err?.message || err);
    return { ok: false, error: err?.message };
  }
}

module.exports = { sendToUser };
