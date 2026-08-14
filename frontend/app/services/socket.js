import { io } from 'socket.io-client';
import { apiBaseUrl, loadToken } from './api';

let socket = null;

export async function connectSocket() {
  if (socket && socket.connected) return socket;
  const token = await loadToken();
  if (!token) return null;

  socket = io(apiBaseUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
  });

  return new Promise((resolve) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => {
      console.warn('[socket] connect_error:', err.message);
      resolve(null);
    });
  });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

export function joinGroup(groupId) {
  return new Promise((resolve) => {
    if (!socket?.connected) return resolve({ ok: false, error: 'not connected' });
    socket.emit('join_group', groupId, (ack) => resolve(ack || { ok: false }));
  });
}

export function leaveGroup(groupId) {
  return new Promise((resolve) => {
    if (!socket?.connected) return resolve({ ok: false });
    socket.emit('leave_group', groupId, (ack) => resolve(ack || { ok: false }));
  });
}

// Subscribe helpers that return an unsubscribe fn — caller wires these to useEffect cleanup.
export function onPaymentInitiated(cb) {
  if (!socket) return () => {};
  socket.on('payment_initiated', cb);
  return () => socket?.off('payment_initiated', cb);
}
export function onPaymentConfirmed(cb) {
  if (!socket) return () => {};
  socket.on('payment_confirmed', cb);
  return () => socket?.off('payment_confirmed', cb);
}
export function onPaymentDisputed(cb) {
  if (!socket) return () => {};
  socket.on('payment_disputed', cb);
  return () => socket?.off('payment_disputed', cb);
}
export function onExpenseAdded(cb) {
  if (!socket) return () => {};
  socket.on('expense_added', cb);
  return () => socket?.off('expense_added', cb);
}
export function onExpenseUpdated(cb) {
  if (!socket) return () => {};
  socket.on('expense_updated', cb);
  return () => socket?.off('expense_updated', cb);
}
export function onExpenseDeleted(cb) {
  if (!socket) return () => {};
  socket.on('expense_deleted', cb);
  return () => socket?.off('expense_deleted', cb);
}
