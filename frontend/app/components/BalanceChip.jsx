import React from 'react';
import { View, Text } from 'react-native';
import { colors, radius } from '../theme';
import { formatINR } from '../utils/formatters';

const PALETTES = {
  success: { bg: colors.success, fg: colors.successText },
  warning: { bg: colors.warning, fg: colors.warningText },
  danger: { bg: colors.danger, fg: colors.dangerText },
  neutral: { bg: colors.surfaceVariant, fg: colors.textSecondary },
};

export default function BalanceChip({ tone = 'neutral', label, amount }) {
  const p = PALETTES[tone] || PALETTES.neutral;
  return (
    <View
      style={{
        backgroundColor: p.bg,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Text style={{ color: p.fg, fontSize: 12.5, fontWeight: '600', letterSpacing: 0.1 }}>
        {label}
        {amount != null ? ` ${formatINR(amount)}` : ''}
      </Text>
    </View>
  );
}
