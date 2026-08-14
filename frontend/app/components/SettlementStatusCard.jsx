import React from 'react';
import { View, Text } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { colors, radius, spacing } from '../theme';
import { formatINR } from '../utils/formatters';
import MemberAvatar from './MemberAvatar';

const COPY = {
  awaiting_confirmation: { label: 'Waiting for confirmation', tone: 'warning' },
  pending: { label: 'Pending', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  disputed: { label: 'Disputed', tone: 'danger' },
};

const PALETTES = {
  success: { bg: colors.success, fg: colors.successText },
  warning: { bg: colors.warning, fg: colors.warningText },
  danger: { bg: colors.danger, fg: colors.dangerText },
};

export default function SettlementStatusCard({ settlement, perspective = 'receiver' }) {
  const status = settlement.status;
  const copy = COPY[status] || { label: status, tone: 'warning' };
  const p = PALETTES[copy.tone];
  const counterparty =
    perspective === 'receiver' ? settlement.payer : settlement.receiver;
  const direction =
    perspective === 'receiver' ? `${counterparty?.name || 'They'} paid you` : `You paid ${counterparty?.name || 'them'}`;

  return (
    <View
      style={{
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
      <MemberAvatar name={counterparty?.name || counterparty?.phone || '?'} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
          {direction}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
          {formatINR(settlement.amount)}
          {settlement.note ? ` · ${settlement.note}` : ''}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: p.bg,
          borderRadius: radius.pill,
          paddingHorizontal: 10,
          paddingVertical: 4,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {status === 'awaiting_confirmation' && (
          <ActivityIndicator size={10} color={p.fg} />
        )}
        <Text style={{ color: p.fg, fontSize: 12, fontWeight: '600' }}>{copy.label}</Text>
      </View>
    </View>
  );
}
