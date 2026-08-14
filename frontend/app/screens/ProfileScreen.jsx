import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import MemberAvatar from '../components/MemberAvatar';
import { useStore } from '../store/useStore';
import { errorMessage } from '../services/api';

export default function ProfileScreen({ navigation }) {
  const currentUser = useStore((s) => s.currentUser);
  const signOut = useStore((s) => s.signOut);
  const deleteAccount = useStore((s) => s.deleteAccount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in with the same email address.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await signOut();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently removes your profile, friends and group memberships. Existing expenses keep their history but will show "Someone" where your name was. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            setError('');
            setBusy(true);
            try {
              await deleteAccount();
            } catch (err) {
              setError(errorMessage(err, 'Could not delete account'));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.sm }}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Profile</Text>
        <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} style={{ padding: spacing.sm }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md }}>
          <MemberAvatar name={currentUser?.name || currentUser?.email || '?'} size={84} />
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary }}>
            {currentUser?.name || 'No name yet'}
          </Text>
          {currentUser?.username ? (
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary, marginTop: -8, paddingHorizontal: 4 }}>
              {`@${currentUser.username}  `}
            </Text>
          ) : null}
          <Text style={{ fontSize: 14, color: colors.textMuted }}>{currentUser?.email}</Text>
          {currentUser?.upiId ? (
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: colors.primaryContainer,
              }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.primary }}>
                {currentUser.upiId}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm, marginTop: spacing.md }}>
          <TouchableOpacity
            onPress={confirmSignOut}
            disabled={busy}
            style={{
              height: 52,
              borderRadius: radius.button + 4,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderSoft,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.textPrimary} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Sign out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={confirmDelete}
            disabled={busy}
            style={{
              height: 52,
              borderRadius: radius.button + 4,
              backgroundColor: colors.danger,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.dangerText} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color={colors.dangerText} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.dangerText }}>
                  Delete account
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {error ? (
          <Text style={{ color: colors.dangerText, textAlign: 'center', padding: spacing.md, fontSize: 13 }}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
