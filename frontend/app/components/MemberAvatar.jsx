import React from 'react';
import { View, Text } from 'react-native';
import { initialsOf } from '../utils/formatters';

const AVATAR_HUES = [12, 45, 95, 150, 200, 240, 280, 320];
const PALETTE = [
  '#FCE4EC', '#FFF3E0', '#F1F8E9', '#E8F5E9',
  '#E0F7FA', '#E3F2FD', '#E8EAF6', '#F3E5F5',
];
const FG_PALETTE = [
  '#AD1457', '#E65100', '#558B2F', '#2E7D32',
  '#00838F', '#1565C0', '#283593', '#6A1B9A',
];

function hueIndex(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}

export default function MemberAvatar({ name = '?', size = 40, style }) {
  const idx = hueIndex(name);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: PALETTE[idx],
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text style={{ color: FG_PALETTE[idx], fontWeight: '700', fontSize: size * 0.4 }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}
