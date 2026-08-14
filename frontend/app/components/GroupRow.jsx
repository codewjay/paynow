import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import MemberAvatar from './MemberAvatar';
import { colors, radius, spacing } from '../theme';
import { formatINR } from '../utils/formatters';

export default function GroupRow({ group, onPress }) {
  const members = group.members || [];
  const net = Number(group.net) || 0;
  const positive = net >= 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.card + 2,
      }}
    >
      <View style={{ width: 56, height: 40, position: 'relative' }}>
        {members.slice(0, 3).map((m, i) => (
          <View
            key={(m._id || m.phone || i) + ''}
            style={{
              position: 'absolute',
              left: i * 14,
              top: 0,
              borderWidth: 2,
              borderColor: colors.background,
              borderRadius: 18,
            }}
          >
            <MemberAvatar name={m.name || m.phone} size={32} />
          </View>
        ))}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 15.5, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
            {group.name}
          </Text>
          {group.emoji ? <Text style={{ fontSize: 14 }}>{group.emoji}</Text> : null}
        </View>
        <Text style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 2 }}>
          {members.length} member{members.length === 1 ? '' : 's'}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{
            fontSize: 14.5,
            fontWeight: '700',
            color: Math.abs(net) < 0.01
              ? colors.textMuted
              : positive
              ? colors.successText
              : colors.dangerText,
            fontVariant: ['tabular-nums'],
          }}
        >
          {Math.abs(net) < 0.01 ? 'Settled up' : formatINR(net, { withSign: true })}
        </Text>
        {Math.abs(net) >= 0.01 && (
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
            {positive ? 'owed to you' : 'you owe'}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
