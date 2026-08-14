import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import MemberAvatar from '../components/MemberAvatar';
import { openUPI } from '../services/upi';
import { onPaymentConfirmed, onPaymentDisputed } from '../services/socket';
import { useStore } from '../store/useStore';
import { errorMessage } from '../services/api';
import { formatINR } from '../utils/formatters';

// States: 'pay' → 'pending' (awaiting_confirmation) → 'confirmed' or 'disputed'
export default function SettleUpScreen({ navigation, route }) {
  const { groupId, receiver, amount, expenseId } = route.params;
  const initiateSettlement = useStore((s) => s.initiateSettlement);

  const [state, setState] = useState('pay');
  const [settlement, setSettlement] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Socket listeners: receiver confirms or disputes from their device.
  useEffect(() => {
    const offConfirmed = onPaymentConfirmed(({ settlement: s }) => {
      if (s && settlement && s._id === settlement._id) {
        setSettlement(s);
        setState('confirmed');
      }
    });
    const offDisputed = onPaymentDisputed(({ settlement: s }) => {
      if (s && settlement && s._id === settlement._id) {
        setSettlement(s);
        setState('disputed');
      }
    });
    return () => {
      offConfirmed();
      offDisputed();
    };
  }, [settlement]);

  const onOpenUpi = async () => {
    await openUPI({
      upiId: receiver.upiId,
      name: receiver.name || receiver.email,
      amount,
      note: 'PayNow settlement',
    });
  };

  const onMarkPaid = async () => {
    setError('');
    setSubmitting(true);
    try {
      const s = await initiateSettlement({
        groupId,
        receiverId: receiver._id,
        amount,
        expenseId,
      });
      setSettlement(s);
      setState('pending');
    } catch (err) {
      setError(errorMessage(err, "Couldn't mark as paid"));
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => navigation.goBack();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.sm }}>
        <TouchableOpacity onPress={close} style={{ padding: spacing.sm }}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
        {state === 'confirmed' ? (
          <>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: colors.success,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.lg,
              }}
            >
              <Ionicons name="checkmark" size={56} color={colors.successText} />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', letterSpacing: -0.4 }}>
              {receiver.name || 'They'} confirmed
              {'\n'}
              {formatINR(amount)} received
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' }}>
              You're settled with {receiver.name || 'them'} in this group.
            </Text>
          </>
        ) : state === 'disputed' ? (
          <>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: colors.danger,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.lg,
              }}
            >
              <Ionicons name="alert" size={48} color={colors.dangerText} />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>
              {receiver.name || 'They'} disputed this
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' }}>
              {settlement?.note || 'No reason given. Reach out to them directly to sort it out.'}
            </Text>
          </>
        ) : (
          <>
            <View style={{ opacity: state === 'pending' ? 0.55 : 1 }}>
              <MemberAvatar name={receiver.name || receiver.email} size={88} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.lg }}>
              {receiver.name || receiver.email}
            </Text>
            <Text
              style={{
                fontSize: 56,
                fontWeight: '700',
                color: state === 'pending' ? colors.textMuted : colors.textPrimary,
                letterSpacing: -2,
                marginTop: spacing.md,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatINR(amount)}
            </Text>
            <Text style={{ fontSize: 13.5, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>
              {receiver.upiId ? `Pays to ${receiver.upiId}` : 'No UPI ID on file'}
            </Text>

            {state === 'pending' && (
              <View
                style={{
                  marginTop: spacing.xl,
                  backgroundColor: colors.warning,
                  borderRadius: radius.pill,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <ActivityIndicator size="small" color={colors.warningText} />
                <Text style={{ color: colors.warningText, fontSize: 13, fontWeight: '600' }}>
                  Waiting for {receiver.name || 'them'} to confirm…
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      <View style={{ padding: spacing.lg }}>
        {error ? (
          <Text style={{ color: colors.dangerText, textAlign: 'center', marginBottom: spacing.md, fontSize: 13 }}>
            {error}
          </Text>
        ) : null}

        {state === 'pay' && (
          <>
            <TouchableOpacity
              onPress={async () => {
                await onOpenUpi();
                // Prompt the user to mark as paid after returning from UPI app —
                // we can't verify completion from outside, so this is honour-system.
                Alert.alert(
                  'Did the payment go through?',
                  "Mark as paid only if it succeeded — your friend will confirm receipt.",
                  [
                    { text: 'Not yet', style: 'cancel' },
                    { text: 'Mark as paid', onPress: onMarkPaid },
                  ]
                );
              }}
              disabled={submitting || !receiver.upiId}
              style={{
                height: 56,
                borderRadius: radius.button + 6,
                backgroundColor: receiver.upiId ? colors.primary : colors.surfaceVariant,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: receiver.upiId ? '#fff' : colors.textMuted, fontSize: 16, fontWeight: '700' }}>
                Open UPI app
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11.5, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 }}>
              PayNow doesn't handle your money — you pay directly via GPay, PhonePe, or Paytm.
            </Text>
          </>
        )}

        {state === 'pending' && (
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
            We'll update this screen as soon as {receiver.name || 'they'} confirm.
          </Text>
        )}

        {(state === 'confirmed' || state === 'disputed') && (
          <TouchableOpacity
            onPress={close}
            style={{
              height: 56,
              borderRadius: radius.button + 6,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
