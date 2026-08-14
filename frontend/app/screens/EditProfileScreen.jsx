import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { userApi, errorMessage } from '../services/api';
import { colors, radius, spacing, fontSize } from '../theme';

export default function EditProfileScreen({ navigation }) {
  const currentUser = useStore((s) => s.currentUser);
  
  // Use refs for the actual text values to avoid Android controlled-input bugs
  // where rapid typing of repeated characters drops the last character.
  const nameRef = useRef(currentUser?.name || '');
  const usernameRef = useRef(currentUser?.username || '');
  const upiIdRef = useRef(currentUser?.upiId || '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // A simple counter to trigger re-renders when we need to update button state
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const username = usernameRef.current;
  const name = nameRef.current;
  const upiId = upiIdRef.current;

  const usernameOk = /^[a-z0-9_.-]{3,15}$/.test(username);
  const nameOk = name.trim().length > 0;
  const upiOk = /^[\w.-]+@[\w.-]+$/.test(upiId);
  
  const dirty = name !== (currentUser?.name || '') || 
                username !== (currentUser?.username || '') || 
                upiId !== (currentUser?.upiId || '');

  const canSubmit = nameOk && usernameOk && upiOk && dirty;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        name: nameRef.current.trim(),
        username: usernameRef.current.trim().toLowerCase(),
        upiId: upiIdRef.current.trim(),
      };
      const res = await userApi.update(payload);
      useStore.setState({ currentUser: res });
      navigation.goBack();
    } catch (err) {
      setError(errorMessage(err, 'Failed to update profile'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.sm }}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={!canSubmit || submitting} style={{ padding: spacing.sm }}>
          {submitting ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={{ fontSize: 14, fontWeight: '600', color: canSubmit ? colors.primary : colors.textMuted }}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }}>
          
          <SectionLabel>Name</SectionLabel>
          <View style={inputWrapperStyle}>
            <TextInput
              defaultValue={nameRef.current}
              onChangeText={(t) => { nameRef.current = t; bump(); }}
              placeholder="Your full name"
              placeholderTextColor={colors.textMuted}
              style={inputStyle}
            />
          </View>

          <SectionLabel>Username</SectionLabel>
          <View style={[inputWrapperStyle, { flexDirection: 'row', alignItems: 'center' }]}>
            <Text style={{ fontSize: 16, color: colors.textMuted, marginRight: 2 }}>@</Text>
            <TextInput
              defaultValue={usernameRef.current}
              onChangeText={(t) => { usernameRef.current = t; bump(); }}
              placeholder="username (3-15 chars)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              style={[inputStyle, { flex: 1 }]}
            />
          </View>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6, marginLeft: 4 }}>
            Friends can use this to find you instead of your email.
          </Text>

          <SectionLabel>UPI ID</SectionLabel>
          <View style={inputWrapperStyle}>
            <TextInput
              defaultValue={upiIdRef.current}
              onChangeText={(t) => { upiIdRef.current = t; bump(); }}
              placeholder="e.g. name@bank"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              style={inputStyle}
            />
          </View>

          {error ? (
            <Text style={{ color: colors.dangerText, marginTop: spacing.md, fontSize: 13, textAlign: 'center' }}>{error}</Text>
          ) : null}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionLabel({ children }) {
  return (
    <Text style={{ paddingTop: spacing.lg, paddingBottom: 6, fontSize: 13, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
      {children}
    </Text>
  );
}

const inputWrapperStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.card,
  borderWidth: 1,
  borderColor: colors.borderSoft,
  paddingHorizontal: spacing.lg,
  height: 52,
  justifyContent: 'center',
};

const inputStyle = {
  fontSize: 16,
  color: colors.textPrimary,
};

