import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, fontSize } from '../theme';
import MemberAvatar from '../components/MemberAvatar';
import { userApi, groupApi, errorMessage } from '../services/api';
import { useStore } from '../store/useStore';

export default function AddFriendScreen({ navigation, route }) {
  const { groupId, addingTo } = route.params || {};
  const isGroupAdd = addingTo === 'group' && groupId;
  const fetchFriends = useStore((s) => s.fetchFriends);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);

  const queryOk = query.trim().length >= 3;

  const search = async () => {
    if (!queryOk) return;
    setError('');
    setFound(null);
    setDone(false);
    setSearching(true);
    try {
      const u = await userApi.search(query.toLowerCase().trim());
      setFound(u);
    } catch (err) {
      setError(errorMessage(err, 'No user found'));
    } finally {
      setSearching(false);
    }
  };

  const add = async () => {
    if (!found) return;
    setError('');
    setAdding(true);
    try {
      if (isGroupAdd) {
        await groupApi.addMember(groupId, found.email);
      } else {
        await userApi.addFriend(found._id);
        fetchFriends();
      }
      setDone(true);
      setTimeout(() => navigation.goBack(), 700);
    } catch (err) {
      setError(errorMessage(err, 'Could not add'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.sm }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.sm }}>
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
            {isGroupAdd ? 'Add member' : 'Add friend'}
          </Text>
          <View style={{ width: 42 }} />
        </View>

        <View style={{ padding: spacing.lg, flex: 1 }}>
          <Text style={{ fontSize: fontSize.h2, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.4 }}>
            Search by Email or Username
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: spacing.sm }}>
            They need to have a PayNow account already.
          </Text>

          <View
            style={{
              marginTop: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.lg,
              height: 56,
            }}
          >
            <TextInput
              value={query}
              onChangeText={(t) => setQuery(t)}
              autoCapitalize="none"
              placeholder="friend@example.com or username"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={search}
              style={{ flex: 1, fontSize: 16, color: colors.textPrimary }}
            />
            <TouchableOpacity onPress={search} disabled={!queryOk || searching}>
              {searching ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Ionicons name="search" size={20} color={queryOk ? colors.primary : colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>

          {error ? (
            <Text style={{ color: colors.dangerText, marginTop: spacing.md, fontSize: 13 }}>{error}</Text>
          ) : null}

          {found && (
            <View
              style={{
                marginTop: spacing.lg,
                backgroundColor: colors.surface,
                borderRadius: radius.card,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.borderSoft,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <MemberAvatar name={found?.name || found?.email} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                  {found?.name || found?.email}
                </Text>
                {found?.upiId ? (
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{found.upiId}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={add}
                disabled={adding || done}
                style={{
                  backgroundColor: done ? colors.success : colors.primary,
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: radius.button,
                }}
              >
                {adding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: done ? colors.successText : '#fff', fontWeight: '700', fontSize: 13 }}>
                    {done ? 'Added ✓' : isGroupAdd ? 'Add to group' : 'Add friend'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
