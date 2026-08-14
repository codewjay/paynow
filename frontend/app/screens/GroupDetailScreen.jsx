import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, fontSize } from '../theme';
import { groupApi, settlementApi, errorMessage } from '../services/api';
import { useStore } from '../store/useStore';
import {
  joinGroup,
  leaveGroup,
  onExpenseAdded,
  onExpenseDeleted,
  onExpenseUpdated,
  onPaymentConfirmed,
  onPaymentDisputed,
  onPaymentInitiated,
} from '../services/socket';
import MemberAvatar from '../components/MemberAvatar';
import ExpenseRow from '../components/ExpenseRow';
import BalanceChip from '../components/BalanceChip';
import { formatINR } from '../utils/formatters';
import { minimizeTransactions } from '../utils/splitCalculator';

export default function GroupDetailScreen({ navigation, route }) {
  const { groupId } = route.params;
  const currentUser = useStore((s) => s.currentUser);
  const applyExpenseAdded = useStore((s) => s.applyExpenseAdded);
  const applyPaymentConfirmed = useStore((s) => s.applyPaymentConfirmed);

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [detail, bals, setts] = await Promise.all([
        groupApi.get(groupId),
        groupApi.balances(groupId),
        settlementApi.byGroup(groupId),
      ]);
      setGroup(detail.group);
      setExpenses(detail.expenses);
      setBalances(bals);
      setSettlements(setts);
    } catch (err) {
      setError(errorMessage(err, 'Could not load group'));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  // Socket: join the group room on focus, leave on blur. Apply server-pushed
  // changes by re-fetching (cheap and keeps balances consistent).
  useEffect(() => {
    let active = true;
    (async () => {
      const ack = await joinGroup(groupId);
      if (!active || !ack.ok) return;
    })();

    const offExpense = onExpenseAdded(() => {
      load();
      applyExpenseAdded();
    });
    const offExpenseUpdated = onExpenseUpdated(() => {
      load();
      applyExpenseAdded();
    });
    const offExpenseDeleted = onExpenseDeleted(() => {
      load();
      applyExpenseAdded();
    });
    const offConfirmed = onPaymentConfirmed(({ settlement }) => {
      load();
      if (settlement) applyPaymentConfirmed(settlement);
    });
    const offInitiated = onPaymentInitiated(() => {
      load();
    });
    const offDisputed = onPaymentDisputed(() => {
      load();
    });

    return () => {
      active = false;
      leaveGroup(groupId);
      offExpense();
      offExpenseUpdated();
      offExpenseDeleted();
      offConfirmed();
      offInitiated();
      offDisputed();
    };
  }, [groupId, load, applyExpenseAdded, applyPaymentConfirmed]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Decide who the current user should settle with (largest absolute counterparty).
  const balanceMap = Object.fromEntries(balances.map((b) => [String(b.user?._id), b.net]));
  const myNet = balanceMap[String(currentUser?._id)] || 0;
  const txns = minimizeTransactions(balanceMap);
  const mySettleSuggestion = txns.find(
    (t) => String(t.from) === String(currentUser?._id)
  );

  const onSettleUp = () => {
    if (!mySettleSuggestion) {
      Alert.alert('All settled up', "You don't owe anyone in this group right now.");
      return;
    }
    const receiver = balances.find((b) => String(b.user?._id) === String(mySettleSuggestion.to))?.user;
    if (!receiver?.upiId) {
      Alert.alert('No UPI ID', `${receiver?.name || 'They'} haven't added a UPI ID yet.`);
      return;
    }
    navigation.navigate('SettleUp', {
      groupId,
      receiver,
      amount: mySettleSuggestion.amount,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
        <Text style={{ color: colors.dangerText }}>{error || 'Group not found'}</Text>
      </SafeAreaView>
    );
  }

  const balanceChips = balances
    .filter((b) => String(b.user?._id) !== String(currentUser?._id))
    .filter((b) => Math.abs(b.net) >= 0.01)
    .slice(0, 6);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.sm }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.sm }}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('GroupSettings', { groupId })}
            style={{ padding: spacing.sm }}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddExpense', { groupId, members: group.members })}
            style={{ padding: spacing.sm }}
          >
            <Ionicons name="add" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          <Text style={{ fontSize: 32, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.7 }}>
            {group.emoji ? `${group.emoji} ` : ''}{group.name}
          </Text>
          <Text style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 6 }}>
            {group.members.length} members
          </Text>
        </View>

        {/* Members */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.lg, paddingVertical: spacing.sm }}
        >
          {group.members.map((m) => (
            <View key={m._id} style={{ alignItems: 'center', gap: 6 }}>
              <MemberAvatar name={m.name || m.email} size={52} />
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textPrimary }}>
                {String(m._id) === String(currentUser?._id) ? 'You' : (m.name || m.email)}
              </Text>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => navigation.navigate('AddFriend', { groupId, addingTo: 'group' })}
            style={{ alignItems: 'center', gap: 6 }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                borderWidth: 1.5,
                borderColor: colors.border,
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
              }}
            >
              <Ionicons name="add" size={22} color={colors.textMuted} />
            </View>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>Invite</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Balance chips */}
        {balanceChips.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            {balanceChips.map((b) => (
              <BalanceChip
                key={b.user?._id || Math.random().toString()}
                tone={b.net > 0 ? 'success' : 'danger'}
                label={b.net > 0 ? `${b.user?.name || 'They'} owes you` : `You owe ${b.user?.name || 'them'}`}
                amount={Math.abs(b.net)}
              />
            ))}
          </View>
        )}

        {/* Recent expenses */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl,
            paddingBottom: spacing.sm,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>Recent expenses</Text>
          {expenses.length > 0 && (
            <Text style={{ fontSize: 13, color: colors.textMuted }}>{expenses.length} total</Text>
          )}
        </View>

        <View style={{ paddingHorizontal: spacing.md }}>
          {expenses.length === 0 ? (
            <Text style={{ color: colors.textMuted, padding: spacing.lg, textAlign: 'center' }}>
              No expenses yet. Tap + to add one.
            </Text>
          ) : (
            expenses.map((e) => (
              <ExpenseRow key={e._id} expense={e} currentUserId={currentUser?._id} />
            ))
          )}
        </View>

        {/* Settlements log */}
        {settlements.length > 0 && (
          <>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: colors.textPrimary,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.xl,
                paddingBottom: spacing.sm,
              }}
            >
              Settlements
            </Text>
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              {settlements.slice(0, 6).map((s) => (
                <View
                  key={s._id}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.card,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: colors.borderSoft,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 14, color: colors.textPrimary }}>
                      {s.payer?.name || 'Someone'} → {s.receiver?.name || 'Someone'}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      {formatINR(s.amount)} · {s.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Sticky CTA — Settle up */}
      <View
        style={{
          padding: spacing.md,
          paddingBottom: spacing.lg,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.borderSoft,
        }}
      >
        <TouchableOpacity
          onPress={onSettleUp}
          disabled={!mySettleSuggestion}
          style={{
            height: 56,
            borderRadius: radius.button + 6,
            backgroundColor: mySettleSuggestion ? colors.primary : colors.surfaceVariant,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
        >
          <Text style={{ color: mySettleSuggestion ? '#fff' : colors.textMuted, fontSize: 16, fontWeight: '700' }}>
            {mySettleSuggestion
              ? `Settle up ${formatINR(mySettleSuggestion.amount)}`
              : myNet > 0
              ? 'Wait for others to settle with you'
              : 'All settled up'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
