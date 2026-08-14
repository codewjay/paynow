import React, { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, fontSize } from '../../theme';
import { useStore } from '../../store/useStore';
import { isValidUPI } from '../../services/upi';
import { errorMessage } from '../../services/api';

export default function ProfileSetupScreen() {
  const completeProfile = useStore((s) => s.completeProfile);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [upiId, setUpiId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const usernameOk = /^[a-z0-9_.-]{3,15}$/.test(username);
  const ready = name.trim().length >= 1 && usernameOk && isValidUPI(upiId.trim());

  const submit = async () => {
    if (!ready) return;
    setError('');
    setSubmitting(true);
    try {
      await completeProfile(name.trim(), username.trim().toLowerCase(), upiId.trim());
      // App.js swaps to AppNavigator once profileComplete flips to true.
    } catch (err) {
      setError(errorMessage(err, 'Could not save profile'));
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 56,
    fontSize: 16,
    color: colors.textPrimary,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.xl, flexGrow: 1, justifyContent: 'center' }}>
          <Text style={{ fontSize: fontSize.h1, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.6 }}>
            One more step
          </Text>
          <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 22 }}>
            Tell us your name and the UPI ID friends will pay you on.
          </Text>

          <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textMuted, marginTop: spacing.xl, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Your name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Jay Sharma"
            placeholderTextColor={colors.textMuted}
            style={[fieldStyle, { marginTop: spacing.sm }]}
            autoCapitalize="words"
          />

          <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textMuted, marginTop: spacing.lg, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Username
          </Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="username (3-15 chars)"
            placeholderTextColor={colors.textMuted}
            style={[fieldStyle, { marginTop: spacing.sm }]}
            autoCapitalize="none"
          />
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
            Friends can use this to find you instead of your email.
          </Text>

          <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textMuted, marginTop: spacing.lg, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            UPI ID
          </Text>
          <TextInput
            value={upiId}
            onChangeText={(t) => setUpiId(t.replace(/\s/g, ''))}
            placeholder="yourname@okhdfcbank"
            placeholderTextColor={colors.textMuted}
            style={[fieldStyle, { marginTop: spacing.sm }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
            Format: name@bank — used to generate UPI deep links when friends settle up.
          </Text>

          {error ? (
            <Text style={{ color: colors.dangerText, marginTop: spacing.md, fontSize: 13 }}>{error}</Text>
          ) : null}

          <Button
            mode="contained"
            onPress={submit}
            disabled={!ready || submitting}
            loading={submitting}
            style={{ marginTop: spacing.xl, borderRadius: radius.button + 4 }}
            contentStyle={{ height: 52 }}
            labelStyle={{ fontSize: 16, fontWeight: '700' }}
          >
            Let's go 🚀
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
