import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, fontSize } from '../theme';
import MemberAvatar from '../components/MemberAvatar';
import { useStore } from '../store/useStore';
import { errorMessage } from '../services/api';

const EMOJIS = ['🏠', '🍕', '☕', '🎓', '🏖️', '🎮', '✈️', '🎂', '⚽', '🎬'];

export default function CreateGroupScreen({ navigation }) {
  const friends = useStore((s) => s.friends);
  const fetchFriends = useStore((s) => s.fetchFriends);
  const createGroup = useStore((s) => s.createGroup);

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [selected, setSelected] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFriends().catch((err) => setError(errorMessage(err, 'Could not load friends')));
  }, [fetchFriends]);

  const selectedEmails = friends.filter((f) => selected[f._id]).map((f) => f.email);
  const ready = name.trim().length > 0;

  const submit = async () => {
    if (!ready) return;
    setError('');
    setSubmitting(true);
    try {
      const group = await createGroup({
        name: name.trim(),
        emoji,
        memberemails: selectedEmails,
      });
      navigation.replace('GroupDetail', { groupId: group._id });
    } catch (err) {
      setError(errorMessage(err, 'Could not create group'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.sm }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.sm }}>
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>New group</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={{ padding: spacing.lg }}>
            <Text style={{ fontSize: fontSize.h2, fontWeight: '700', color: colors.textPrimary }}>
              What's this group?
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Hostel Room 4"
              placeholderTextColor={colors.textMuted}
              style={{
                marginTop: spacing.lg,
                height: 56,
                borderRadius: radius.card,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: spacing.lg,
                fontSize: 16,
                color: colors.textPrimary,
              }}
              autoFocus
            />

            <Text
              style={{
                paddingTop: spacing.xl,
                fontSize: 12.5,
                fontWeight: '700',
                color: colors.textMuted,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              Icon (optional)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm }}>
              {EMOJIS.map((e) => {
                const sel = emoji === e;
                return (
                  <TouchableOpacity
                    key={e}
                    onPress={() => setEmoji(sel ? '' : e)}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: sel ? colors.primaryContainer : colors.surface,
                      borderWidth: 1,
                      borderColor: sel ? 'transparent' : colors.borderSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text
              style={{
                paddingTop: spacing.xl,
                fontSize: 12.5,
                fontWeight: '700',
                color: colors.textMuted,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              Add friends
            </Text>

            {friends.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: spacing.md }}>
                No friends yet. You can still create the group and add members later from inside it.
              </Text>
            ) : (
              <View style={{ marginTop: spacing.sm }}>
                {friends.map((f) => {
                  if (!f) return null;
                  const sel = f?._id ? !!selected[f._id] : false;
                  return (
                    <TouchableOpacity
                      key={f?._id || Math.random().toString()}
                      onPress={() => f?._id && setSelected({ ...selected, [f._id]: !sel })}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.md,
                        paddingVertical: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          backgroundColor: sel ? colors.primary : 'transparent',
                          borderWidth: sel ? 0 : 1.75,
                          borderColor: colors.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {sel && <Ionicons name="checkmark" size={16} color="#fff" />}
                      </View>
                      <MemberAvatar name={f?.name || f?.email} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                          {f?.name || f?.email}
                        </Text>
                        {f?.upiId ? (
                          <Text style={{ fontSize: 12, color: colors.textMuted }}>{f.upiId}</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {error ? (
              <Text style={{ color: colors.dangerText, marginTop: spacing.md, fontSize: 13 }}>{error}</Text>
            ) : null}
          </View>
        </ScrollView>

        <View
          style={{
            padding: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.borderSoft,
          }}
        >
          <TouchableOpacity
            onPress={submit}
            disabled={!ready || submitting}
            style={{
              height: 56,
              borderRadius: radius.button + 6,
              backgroundColor: ready ? colors.primary : colors.surfaceVariant,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: ready ? '#fff' : colors.textMuted, fontSize: 16, fontWeight: '700' }}>
                Create group
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
