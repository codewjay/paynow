import { create } from 'zustand';
import {
  authApi,
  userApi,
  groupApi,
  expenseApi,
  settlementApi,
  saveToken,
  loadToken,
  clearToken,
  setUnauthorizedHandler,
} from '../services/api';
import {
  connectSocket,
  disconnectSocket,
} from '../services/socket';

function refreshInBackground(action, label) {
  void action().catch((err) => console.warn(`[store] ${label} refresh failed:`, err?.message));
}

export const useStore = create((set, get) => ({
  // ─── State ─────────────────────────────────────────────────
  currentUser: null,
  profileComplete: false,
  groups: [],
  activities: [],
  pendingSettlements: [],
  friends: [],
  loading: {
    groups: false,
    activity: false,
    pending: false,
  },

  // ─── Bootstrap ─────────────────────────────────────────────
  // Try to restore a session from SecureStore. If token is valid, fetch /me
  // and decide which navigator to mount.
  bootstrap: async () => {
    setUnauthorizedHandler(() => get().signOut());
    const token = await loadToken();
    if (!token) return;
    try {
      const user = await userApi.me();
      const profileComplete = !!(user.name && user.upiId);
      set({ currentUser: user, profileComplete });
      await connectSocket();
      if (profileComplete) {
        refreshInBackground(get().fetchGroups, 'groups');
        refreshInBackground(get().fetchActivity, 'activity');
        refreshInBackground(get().fetchPending, 'pending settlements');
      }
    } catch (err) {
      console.warn('[bootstrap] failed:', err?.message);
      // Let the api interceptor handle 401s.
      // Do not clear token for generic network errors, to preserve session across offline restarts.
    }
  },

  // ─── Auth ──────────────────────────────────────────────────
  signInWithFirebaseIdToken: async (idToken) => {
    const { token, user, isNewUser } = await authApi.verifyToken(idToken);
    await saveToken(token);
    const profileComplete = !isNewUser && !!(user.name && user.upiId);
    set({ currentUser: user, profileComplete });
    await connectSocket();
    return { user, isNewUser, profileComplete };
  },

  completeProfile: async (name, username, upiId) => {
    const user = await authApi.completeProfile(name, username, upiId);
    set({ currentUser: user, profileComplete: true });
    // First-time profile completion — kick off the initial data loads.
    refreshInBackground(get().fetchGroups, 'groups');
    refreshInBackground(get().fetchActivity, 'activity');
    refreshInBackground(get().fetchPending, 'pending settlements');
    return user;
  },

  signOut: async () => {
    await clearToken();
    disconnectSocket();
    set({
      currentUser: null,
      profileComplete: false,
      groups: [],
      activities: [],
      pendingSettlements: [],
      friends: [],
    });
  },

  deleteAccount: async () => {
    await userApi.deleteMe();
    await get().signOut();
  },

  // ─── Data fetches ──────────────────────────────────────────
  fetchGroups: async () => {
    set((s) => ({ loading: { ...s.loading, groups: true } }));
    try {
      const groups = await groupApi.list();
      set((s) => ({ groups, loading: { ...s.loading, groups: false } }));
    } catch (err) {
      set((s) => ({ loading: { ...s.loading, groups: false } }));
      throw err;
    }
  },

  fetchActivity: async () => {
    set((s) => ({ loading: { ...s.loading, activity: true } }));
    try {
      const activities = await expenseApi.activity();
      set((s) => ({ activities, loading: { ...s.loading, activity: false } }));
    } catch (err) {
      set((s) => ({ loading: { ...s.loading, activity: false } }));
      throw err;
    }
  },

  fetchPending: async () => {
    set((s) => ({ loading: { ...s.loading, pending: true } }));
    try {
      const pendingSettlements = await settlementApi.pending();
      set((s) => ({ pendingSettlements, loading: { ...s.loading, pending: false } }));
    } catch (err) {
      set((s) => ({ loading: { ...s.loading, pending: false } }));
      throw err;
    }
  },

  fetchFriends: async () => {
    const friends = await userApi.friends();
    set({ friends });
  },

  // ─── Mutations ─────────────────────────────────────────────
  createGroup: async ({ name, emoji, memberemails }) => {
    const group = await groupApi.create({ name, emoji, memberemails });
    set((s) => ({ groups: [{ ...group, net: 0 }, ...s.groups] }));
    return group;
  },

  leaveGroup: async (groupId, userId) => {
    await groupApi.leaveGroup(groupId, userId);
    set((s) => ({ groups: s.groups.filter((g) => g._id !== groupId) }));
  },

  deleteGroup: async (groupId) => {
    await groupApi.deleteGroup(groupId);
    set((s) => ({ groups: s.groups.filter((g) => g._id !== groupId) }));
    // Also remove any pending settlements/activity for this group
    refreshInBackground(get().fetchActivity, 'activity');
    refreshInBackground(get().fetchPending, 'pending settlements');
  },

  addExpense: async (groupId, data) => {
    const expense = await expenseApi.create(groupId, data);
    // Refresh activity + groups so net balances update.
    refreshInBackground(get().fetchActivity, 'activity');
    refreshInBackground(get().fetchGroups, 'groups');
    return expense;
  },

  initiateSettlement: async (data) => {
    const settlement = await settlementApi.initiate(data);
    return settlement;
  },

  confirmSettlement: async (settlementId) => {
    const settlement = await settlementApi.confirm(settlementId);
    // Server broadcasts payment_confirmed to the group room via the REST route —
    // no client-side socket emit needed here.
    set((s) => ({
      pendingSettlements: s.pendingSettlements.filter((x) => x._id !== settlementId),
    }));
    refreshInBackground(get().fetchGroups, 'groups');
    return settlement;
  },

  disputeSettlement: async (settlementId, reason) => {
    const settlement = await settlementApi.dispute(settlementId, reason);
    set((s) => ({
      pendingSettlements: s.pendingSettlements.filter((x) => x._id !== settlementId),
    }));
    return settlement;
  },

  // ─── Socket-driven updates (called from screen useEffects) ──
  applyExpenseAdded: () => {
    refreshInBackground(get().fetchGroups, 'groups');
    refreshInBackground(get().fetchActivity, 'activity');
  },

  applyPaymentConfirmed: (settlement) => {
    set((s) => ({
      pendingSettlements: s.pendingSettlements.filter((x) => x._id !== settlement._id),
    }));
    refreshInBackground(get().fetchGroups, 'groups');
  },

  applyPaymentInitiated: (settlement) => {
    set((s) => {
      const exists = s.pendingSettlements.some((x) => x._id === settlement._id);
      if (exists) return s;
      // Only show in pending list if I'm the receiver.
      if (String(settlement.receiver?._id) !== String(s.currentUser?._id)) return s;
      return { pendingSettlements: [settlement, ...s.pendingSettlements] };
    });
  },
}));
