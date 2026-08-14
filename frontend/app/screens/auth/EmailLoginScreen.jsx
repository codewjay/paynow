import React, { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import { useStore } from '../../store/useStore';
import { colors, radius, spacing, fontSize } from '../../theme';

export default function EmailLoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const signInWithFirebaseIdToken = useStore((s) => s.signInWithFirebaseIdToken);

  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const passOk = password.length >= 6;
  const canSubmit = emailOk && passOk;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);
    try {
      let userCredential;
      if (isLogin) {
        userCredential = await auth().signInWithEmailAndPassword(email, password);
      } else {
        userCredential = await auth().createUserWithEmailAndPassword(email, password);
      }
      
      const idToken = await userCredential.user.getIdToken();
      const res = await signInWithFirebaseIdToken(idToken);
      
      if (!res.profileComplete) {
        navigation.navigate('ProfileSetup');
      }
    } catch (err) {
      console.warn('[email_auth] failed:', err);
      setError(err?.message || 'Authentication failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <Text style={{ fontSize: fontSize.h1, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.6 }}>
            {isLogin ? 'Welcome back' : 'Create account'}
          </Text>
          <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 22 }}>
            {isLogin ? 'Enter your email and password to log in.' : 'Sign up to start splitting expenses.'}
          </Text>

          <View
            style={{
              marginTop: spacing.xl,
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.lg,
              height: 60,
              justifyContent: 'center',
            }}
          >
            <TextInput
              value={email}
              onChangeText={(t) => setEmail(t.toLowerCase().trim())}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              style={{
                fontSize: 16,
                fontWeight: '500',
                color: colors.textPrimary,
              }}
              autoFocus
            />
          </View>

          <View
            style={{
              marginTop: spacing.md,
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.lg,
              height: 60,
              justifyContent: 'center',
            }}
          >
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password (min 6 chars)"
              placeholderTextColor={colors.textMuted}
              style={{
                fontSize: 16,
                fontWeight: '500',
                color: colors.textPrimary,
              }}
            />
          </View>

          {error ? (
            <Text style={{ color: colors.dangerText, marginTop: spacing.md, fontSize: 13 }}>{error}</Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
            loading={submitting}
            style={{ marginTop: spacing.xl, borderRadius: radius.button + 4 }}
            contentStyle={{ height: 52 }}
            labelStyle={{ fontSize: 16, fontWeight: '700' }}
          >
            {isLogin ? 'Log In' : 'Sign Up'}
          </Button>

          <Button
            mode="text"
            onPress={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            style={{ marginTop: spacing.sm }}
            textColor={colors.primary}
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
