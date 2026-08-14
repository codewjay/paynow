import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { formatINR, formatDate } from '../utils/formatters';

const CATEGORY_EMOJI = {
  Canteen: '🍛',
  Chai: '☕',
  Hostel: '🏠',
  Petrol: '⛽',
  Notes: '📚',
  Gaming: '🎮',
  Trip: '✈️',
  Birthday: '🎂',
};

export default function ExpenseRow({ expense, currentUserId, onPress }) {
  const paidByMe = currentUserId && String(expense.paidBy?._id || expense.paidBy) === String(currentUserId);
  const myShare = (expense.splits || []).find(
    (s) => currentUserId && String(s.user?._id || s.user) === String(currentUserId)
  );
  const myAmount = myShare ? Number(myShare.amount) : 0;

  // What you net from this expense:
  //   if you paid    → you get back (amount − your share)
  //   else           → you owe (your share)
  const net = paidByMe ? Number(expense.amount) - myAmount : -myAmount;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.card,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 22 }}>{CATEGORY_EMOJI[expense.category] || '🧾'}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
          {expense.title}
        </Text>
        <Text style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
          {paidByMe ? 'You paid' : `${expense.paidBy?.name || 'Someone'} paid`} · {formatDate(expense.createdAt)}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: net === 0
              ? colors.textMuted
              : net > 0
              ? colors.successText
              : colors.dangerText,
            fontVariant: ['tabular-nums'],
          }}
        >
          {net === 0 ? '—' : formatINR(net, { withSign: true })}
        </Text>
        <Text style={{ fontSize: 11, color: colors.textMuted }}>
          {formatINR(expense.amount)} total
        </Text>
      </View>
    </TouchableOpacity>
  );
}
