import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import MemberAvatar from '../components/MemberAvatar';
import { groupApi, errorMessage } from '../services/api';
import { useStore } from '../store/useStore';

const EMOJI_CHOICES = ['🏠', '🍛', '✈️', '🎓', '🎮', '🎂', '🍻', '☕', '🚗', '🏖️', '🏏', '🎬'];

export default function GroupSettingsScreen({ navigation, route }) {
  const { groupId } = route.params;
  const currentUser = useStore((s) => s.currentUser);
  const fetchGroups = useStore((s) => s.fetchGroups);

  const [group, setGroup] = useState(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const detail = await groupApi.get(groupId);
      setGroup(detail.group);
      setName(detail.group.name);
      setEmoji(detail.group.emoji || '');
    } catch (err) {
      setError(errorMessage(err, 'Could not load group'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [groupId]);

  const isCreator =
    group && currentUser && String(group.createdBy?._id || group.createdBy) === String(currentUser._id);

  const dirty = group && (name.trim() !== group.name || emoji !== (group.emoji || ''));

  const onSave = async () => {
    if (!dirty || !name.trim()) return;
    setError('');
    setSaving(true);
    try {
      await groupApi.update(groupId, { name: name.trim(), emoji });
      await fetchGroups();
      navigation.goBack();
    } catch (err) {
      setError(errorMessage(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = (member) => {
    const isSelf = String(member._id) === String(currentUser?._id);
    Alert.alert(
      isSelf ? 'Leave group?' : `Remove ${member.name || member.email}?`,
      isSelf
        ? 'You will stop seeing expenses and balances for this group.'
        : 'They will be removed from this group. Existing expenses keep their share.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isSelf ? 'Leave' : 'Remove',
          style: 'destructive',
          onPress: () => doRemove(member._id, isSelf),
        },
      ]
    );
  };

  const doRemove = async (userId, isSelf) => {
    setError('');
    setRemovingId(userId);
    try {
      await groupApi.removeMember(groupId, userId);
      await fetchGroups();
      if (isSelf) {
        navigation.popToTop();
      } else {
        await load();
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not remove member'));
    } finally {
      setRemovingId(null);
    }
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.sm }}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Group settings</Text>
        <TouchableOpacity
          onPress={onSave}
          disabled={!dirty || !name.trim() || saving || !isCreator}
          style={{ padding: spacing.sm }}
        >
          {saving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: dirty && name.trim() && isCreator ? colors.primary : colors.textMuted,
              }}
            >
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <SectionLabel>Name</SectionLabel>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <TextInput
            value={name}
            onChangeText={setName}
            editable={isCreator}
            placeholder="Group name"
            placeholderTextColor={colors.textMuted}
            style={{
              height: 52,
              borderRadius: radius.card,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderSoft,
              paddingHorizontal: spacing.lg,
              fontSize: 16,
              color: isCreator ? colors.textPrimary : colors.textMuted,
            }}
          />
        </View>

        <SectionLabel>Emoji</SectionLabel>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}
        >
          {EMOJI_CHOICES.map((e) => {
            const sel = emoji === e;
            return (
              <TouchableOpacity
                key={e}
                onPress={() => isCreator && setEmoji(sel ? '' : e)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: sel ? colors.primaryContainer : colors.surface,
                  borderWidth: 1,
                  borderColor: sel ? 'transparent' : colors.borderSoft,
                  opacity: isCreator ? 1 : 0.5,
                }}
              >
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {!isCreator && (
          <Text
            style={{
              fontSize: 12,
              color: colors.textMuted,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.sm,
            }}
          >
            Only the group creator can rename or change the emoji.
          </Text>
        )}

        <SectionLabel>Members</SectionLabel>
        <View style={{ paddingHorizontal: spacing.md }}>
          {group.members.map((m) => {
            if (!m) return null;
            const isSelf = String(m?._id) === String(currentUser?._id);
            const canRemove = isSelf || isCreator;
            return (
              <View
                key={m?._id || Math.random().toString()}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radius.card,
                }}
              >
                <MemberAvatar name={m?.name || m?.email} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                    {isSelf ? 'You' : (m?.name || m?.email)}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    {m?.email}
                  </Text>
                </View>
                {canRemove && (
                  <TouchableOpacity
                    onPress={() => m?._id && confirmRemove(m)}
                    disabled={removingId === m?._id}
                    style={{ padding: 6 }}
                  >
                    {removingId === m?._id ? (
                      <ActivityIndicator color={colors.dangerText} />
                    ) : (
                      <Ionicons
                        name={isSelf ? 'log-out-outline' : 'person-remove-outline'}
                        size={20}
                        color={colors.dangerText}
                      />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {error ? (
          <Text style={{ color: colors.dangerText, textAlign: 'center', padding: spacing.md, fontSize: 13 }}>
            {error}
          </Text>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.xl }}>
          {isCreator ? (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Delete Group?',
                  'This will permanently delete the group and all its expenses and settlements for everyone. This cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        setSaving(true);
                        try {
                          await useStore.getState().deleteGroup(groupId);
                          navigation.popToTop();
                        } catch (err) {
                          setError(errorMessage(err, 'Could not delete group'));
                          setSaving(false);
                        }
                      }
                    }
                  ]
                );
              }}
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
              <Ionicons name="trash-outline" size={20} color={colors.dangerText} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.dangerText }}>Delete Group</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => confirmRemove(group.members.find(m => String(m._id) === String(currentUser._id)))}
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
              <Ionicons name="log-out-outline" size={20} color={colors.dangerText} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.dangerText }}>Leave Group</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ children }) {
  return (
    <Text
      style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: 6,
        fontSize: 12.5,
        fontWeight: '700',
        color: colors.textMuted,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}
