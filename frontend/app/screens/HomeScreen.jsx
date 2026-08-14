import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, fontSize } from '../theme';
import SummaryCard from '../components/SummaryCard';
import GroupRow from '../components/GroupRow';
import MemberAvatar from '../components/MemberAvatar';
import { useStore } from '../store/useStore';
import { errorMessage } from '../services/api';

export default function HomeScreen({ navigation }) {
  const currentUser = useStore((s) => s.currentUser);
  const groups = useStore((s) => s.groups);
  const fetchGroups = useStore((s) => s.fetchGroups);
  const fetchActivity = useStore((s) => s.fetchActivity);
  const fetchPending = useStore((s) => s.fetchPending);
  const loading = useStore((s) => s.loading.groups);

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    setRefreshing(true);
    try {
      await Promise.all([fetchGroups(), fetchActivity(), fetchPending()]);
    } catch (err) {
      setError(errorMessage(err, 'Could not refresh'));
    } finally {
      setRefreshing(false);
    }
  }, [fetchGroups, fetchActivity, fetchPending]);

  useEffect(() => {
    if (groups.length === 0) refresh();
  }, [refresh, groups.length]);

  const { owed, owe } = useMemo(() => {
    let owed = 0;
    let owe = 0;
    for (const g of groups) {
      const n = Number(g.net) || 0;
      if (n > 0) owed += n;
      else if (n < 0) owe += -n;
    }
    return { owed: Math.round(owed * 100) / 100, owe: Math.round(owe * 100) / 100 };
  }, [groups]);

  const owedFromCount = groups.filter((g) => (g.net || 0) > 0).length;
  const oweToCount = groups.filter((g) => (g.net || 0) < 0).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {/* Top row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg }}>
          <View>
            <Text style={{ fontSize: fontSize.h1, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.6 }}>
              Hey {(currentUser?.name || '').split(' ')[0] || 'there'} 👋
            </Text>
            <Text style={{ fontSize: 15.5, color: colors.textMuted, marginTop: 4 }}>
              Here's where things stand
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} hitSlop={10}>
            <MemberAvatar name={currentUser?.name || '?'} size={40} />
          </TouchableOpacity>
        </View>

        {/* Summary cards */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg }}>
          <SummaryCard
            label="You're owed"
            amount={owed}
            sub={owedFromCount ? `across ${owedFromCount} group${owedFromCount === 1 ? '' : 's'}` : 'all settled up'}
            tone="success"
          />
          <SummaryCard
            label="You owe"
            amount={owe}
            sub={oweToCount ? `across ${oweToCount} group${oweToCount === 1 ? '' : 's'}` : 'nothing pending'}
            tone="danger"
          />
        </View>

        {/* Your groups header */}
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
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>Your groups</Text>
          <TouchableOpacity onPress={() => navigation.navigate('CreateGroup')}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>New group</Text>
          </TouchableOpacity>
        </View>

        {loading && groups.length === 0 ? (
          <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : groups.length === 0 ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg }}>
              No groups yet. Create one to start splitting expenses with friends.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateGroup')}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.md,
                borderRadius: radius.button + 4,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Create your first group</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.md }}>
            {groups.map((g) => (
              <GroupRow
                key={g._id}
                group={g}
                onPress={() => navigation.navigate('GroupDetail', { groupId: g._id })}
              />
            ))}
          </View>
        )}

        {error ? (
          <Text style={{ color: colors.dangerText, textAlign: 'center', marginTop: spacing.md }}>{error}</Text>
        ) : null}
      </ScrollView>

      <View style={{ position: 'absolute', right: spacing.lg, bottom: spacing.lg, flexDirection: 'column', gap: spacing.sm }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddFriend')}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            width: 52,
            height: 52,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="person-add-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
