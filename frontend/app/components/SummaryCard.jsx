import React from 'react';
import { View, Text } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { formatINR } from '../utils/formatters';

export default function SummaryCard({ label, amount, sub, tone = 'success' }) {
  const palette =
    tone === 'success'
      ? { bg: colors.success, fg: colors.successText }
      : { bg: colors.danger, fg: colors.dangerText };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.bg,
        borderRadius: radius.card + 8,
        padding: spacing.lg,
        minHeight: 124,
        justifyContent: 'space-between',
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: palette.fg,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 32, fontWeight: '700', color: palette.fg, letterSpacing: -0.5 }}>
        {formatINR(amount)}
      </Text>
      {sub && (
        <Text style={{ fontSize: 12, color: palette.fg, opacity: 0.75 }}>{sub}</Text>
      )}
    </View>
  );
}
