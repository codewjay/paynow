import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, fontSize } from '../theme';
import ExpenseRow from '../components/ExpenseRow';
import SettlementStatusCard from '../components/SettlementStatusCard';
import { useStore } from '../store/useStore';
import { errorMessage } from '../services/api';
import { formatINR } from '../utils/formatters';

export default function ActivityScreen({ navigation }) {
  const currentUser = useStore((s) => s.currentUser);
  const activities = useStore((s) => s.activities);
  const pendingSettlements = useStore((s) => s.pendingSettlements);
  const fetchActivity = useStore((s) => s.fetchActivity);
  const fetchPending = useStore((s) => s.fetchPending);
  const confirmSettlement = useStore((s) => s.confirmSettlement);
  const disputeSettlement = useStore((s) => s.disputeSettlement);
  const loading = useStore((s) => s.loading.activity);

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null); // settlement id mid-action

  const refresh = useCallback(async () => {
    setError('');
    setRefreshing(true);
    try {
      await Promise.all([fetchActivity(), fetchPending()]);
    } catch (err) {
      setError(errorMessage(err, 'Could not refresh activity'));
    } finally {
      setRefreshing(false);
    }
  }, [fetchActivity, fetchPending]);

  useEffect(() => {
    if (activities.length === 0) refresh();
  }, [refresh, activities.length]);

  const doConfirm = async (id) => {
    setBusy(id);
    try {
      await confirmSettlement(id);
    } catch (err) {
      setError(errorMessage(err, 'Could not confirm'));
    } finally {
      setBusy(null);
    }
  };
  const doDispute = async (id) => {
    setBusy(id);
    try {
      await disputeSettlement(id, '');
    } catch (err) {
      setError(errorMessage(err, 'Could not dispute'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={{ padding: spacing.lg }}>
          <Text style={{ fontSize: fontSize.h1, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.6 }}>
            Activity
          </Text>
        </View>

        {pendingSettlements.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginBottom: spacing.lg }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Needs your confirmation
            </Text>
            {pendingSettlements.map((s) => (
              <View
                key={s._id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.card,
                  padding: spacing.lg,
                  borderWidth: 1,
                  borderColor: colors.borderSoft,
                  gap: spacing.md,
                }}
              >
                <Text style={{ fontSize: 15, color: colors.textPrimary }}>
                  <Text style={{ fontWeight: '700' }}>{s.payer?.name || 'Someone'}</Text> says they paid you {formatINR(s.amount)}
                  {s.group?.name ? ` in ${s.group.name}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TouchableOpacity
                    onPress={() => doConfirm(s._id)}
                    disabled={busy === s._id}
                    style={{
                      flex: 1,
                      backgroundColor: colors.primary,
                      borderRadius: radius.button,
                      paddingVertical: 12,
                      alignItems: 'center',
                    }}
                  >
                    {busy === s._id ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Got it ✓</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => doDispute(s._id)}
                    disabled={busy === s._id}
                    style={{
                      flex: 1,
                      backgroundColor: colors.surface,
                      borderRadius: radius.button,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingVertical: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Didn't get it</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text
          style={{
            paddingHorizontal: spacing.lg,
            fontSize: 13,
            fontWeight: '700',
            color: colors.textMuted,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            marginBottom: spacing.sm,
          }}
        >
          Recent expenses
        </Text>

        {loading && activities.length === 0 ? (
          <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : activities.length === 0 ? (
          <Text style={{ color: colors.textMuted, padding: spacing.xl, textAlign: 'center' }}>
            Nothing here yet. Add expenses to your groups to see them flow through.
          </Text>
        ) : (
          <View style={{ paddingHorizontal: spacing.md }}>
            {activities.map((e) => (
              <ExpenseRow
                key={e._id}
                expense={e}
                currentUserId={currentUser?._id}
                onPress={() => e.group?._id && navigation.navigate('GroupDetail', { groupId: e.group._id })}
              />
            ))}
          </View>
        )}

        {error ? (
          <Text style={{ color: colors.dangerText, textAlign: 'center', marginTop: spacing.md }}>{error}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
