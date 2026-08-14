import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import MemberAvatar from '../components/MemberAvatar';
import { useStore } from '../store/useStore';
import { groupApi, errorMessage } from '../services/api';
import { calculateEqual, calculateCustom, calculatePercentage } from '../utils/splitCalculator';
import { sanitizeMoneyInput, formatINR } from '../utils/formatters';

const CATEGORIES = [
  { emoji: '🍛', label: 'Canteen' },
  { emoji: '☕', label: 'Chai' },
  { emoji: '🏠', label: 'Hostel' },
  { emoji: '⛽', label: 'Petrol' },
  { emoji: '📚', label: 'Notes' },
  { emoji: '🎮', label: 'Gaming' },
  { emoji: '✈️', label: 'Trip' },
  { emoji: '🎂', label: 'Birthday' },
];

export default function AddExpenseScreen({ navigation, route }) {
  const { groupId, members: initialMembers } = route.params;
  const currentUser = useStore((s) => s.currentUser);
  const addExpense = useStore((s) => s.addExpense);

  const [members, setMembers] = useState(initialMembers || []);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Canteen');
  const [paidBy, setPaidBy] = useState(currentUser?._id);
  const [splitType, setSplitType] = useState('equal');
  const [included, setIncluded] = useState({});
  const [customAmounts, setCustomAmounts] = useState({}); // { userId: "12.50" }
  const [percentages, setPercentages] = useState({});     // { userId: "33.33" }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // If we landed here without members in params, fetch them.
  useEffect(() => {
    if (initialMembers && initialMembers.length) return;
    (async () => {
      try {
        const detail = await groupApi.get(groupId);
        setMembers(detail.group.members);
      } catch (err) {
        setError(errorMessage(err, 'Could not load group'));
      }
    })();
  }, [groupId, initialMembers]);

  // Default: all members included.
  useEffect(() => {
    if (members.length && Object.keys(included).length === 0) {
      const next = {};
      for (const m of members) if (m?._id) next[m._id] = true;
      setIncluded(next);
    }
  }, [members, included]);

  const includedIds = useMemo(
    () => members.filter((m) => m?._id && included[m._id]).map((m) => m._id),
    [members, included]
  );

  const amountNum = Math.round((parseFloat(amount) || 0) * 100);
  const perPerson =
    amountNum && includedIds.length > 0
      ? Math.floor(amountNum / includedIds.length)
      : 0;

  // Live preview of the split that will be sent — kept in sync with the
  // selected splitType so the row labels (₹X / 33% etc.) always match.
  const splitPreview = useMemo(() => {
    if (splitType === 'equal') {
      return { shares: calculateEqual(amountNum, includedIds), ok: true };
    }
    if (splitType === 'custom') {
      const map = {};
      for (const id of includedIds) {
        map[id] = Math.round((parseFloat(customAmounts[id]) || 0) * 100);
      }
      return calculateCustom(amountNum, map);
    }
    // percentage
    const map = {};
    for (const id of includedIds) map[id] = percentages[id];
    return calculatePercentage(amountNum, map);
  }, [splitType, amountNum, includedIds, customAmounts, percentages]);

  const splitOk =
    splitType === 'equal'
      ? splitPreview.shares.every((share) => share.amount > 0)
      : (splitPreview.ok && includedIds.length > 0);

  const ready =
    title.trim() &&
    amountNum > 0 &&
    includedIds.length > 0 &&
    paidBy &&
    splitOk;

  const submit = async () => {
    if (!ready) return;
    setError('');
    setSubmitting(true);
    try {
      const splits = splitPreview.shares;
      await addExpense(groupId, {
        title: title.trim(),
        amount: amountNum,
        category,
        paidBy,
        splits,
        splitType,
      });
      navigation.goBack();
    } catch (err) {
      setError(errorMessage(err, 'Could not add expense'));
    } finally {
      setSubmitting(false);
    }
  };

  // Map: userId → share amount for the row hint.
  const previewByUser = useMemo(() => {
    const m = {};
    for (const s of splitPreview.shares || []) m[String(s.user)] = s.amount;
    return m;
  }, [splitPreview]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.sm }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.sm }}>
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>New expense</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Amount */}
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Amount
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
              <Text style={{ fontSize: 40, color: colors.textMuted, fontWeight: '500' }}>₹</Text>
              <TextInput
                value={amount}
                onChangeText={(t) => setAmount(sanitizeMoneyInput(t))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                style={{
                  fontSize: 56,
                  fontWeight: '700',
                  color: colors.textPrimary,
                  letterSpacing: -2,
                  minWidth: 100,
                  textAlign: 'center',
                  padding: 0,
                }}
              />
            </View>
            <View
              style={{
                width: 80,
                height: 2,
                borderRadius: 1,
                backgroundColor: colors.primary,
                opacity: 0.6,
                marginTop: -4,
              }}
            />
          </View>

          {/* Title */}
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What's this for?"
              placeholderTextColor={colors.textMuted}
              style={{
                height: 56,
                borderRadius: radius.card,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.borderSoft,
                paddingHorizontal: spacing.lg,
                fontSize: 16,
                color: colors.textPrimary,
              }}
            />
          </View>

          {/* Paid by */}
          <SectionLabel>Paid by</SectionLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
          >
            {members.map((m) => {
              const sel = m?._id && String(paidBy) === String(m._id);
              return (
                <TouchableOpacity
                  key={m?._id || Math.random().toString()}
                  onPress={() => m?._id && setPaidBy(m._id)}
                  style={{ alignItems: 'center', gap: 6 }}
                >
                  <View
                    style={{
                      padding: 3,
                      borderRadius: 32,
                      backgroundColor: sel ? colors.primary : 'transparent',
                    }}
                  >
                    <View style={{ borderWidth: 2, borderColor: sel ? colors.background : 'transparent', borderRadius: 26 }}>
                      <MemberAvatar name={m?.name || m?.email} size={48} />
                    </View>
                  </View>
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: sel ? '700' : '500',
                      color: sel ? colors.primary : colors.textMuted,
                    }}
                  >
                    {String(m?._id) === String(currentUser?._id) ? 'You' : (m?.name || m?.email)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Category */}
          <SectionLabel>Category</SectionLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}
          >
            {CATEGORIES.map((c) => {
              const sel = category === c.label;
              return (
                <TouchableOpacity
                  key={c.label}
                  onPress={() => setCategory(c.label)}
                  style={{
                    height: 40,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: sel ? colors.primaryContainer : colors.surface,
                    borderWidth: 1,
                    borderColor: sel ? 'transparent' : colors.borderSoft,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
                  <Text style={{ fontSize: 13.5, fontWeight: sel ? '700' : '500', color: colors.textPrimary }}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Split type — segmented */}
          <SectionLabel>Split</SectionLabel>
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: colors.surfaceVariant,
                borderRadius: 14,
                padding: 4,
                gap: 4,
              }}
            >
              {[
                { id: 'equal', label: 'Equal' },
                { id: 'custom', label: 'Custom' },
                { id: 'percentage', label: 'Percentage' },
              ].map((t) => {
                const sel = splitType === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setSplitType(t.id)}
                    style={{
                      flex: 1,
                      height: 38,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: sel ? colors.surface : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 13.5, fontWeight: sel ? '700' : '500', color: sel ? colors.textPrimary : colors.textMuted }}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {splitType === 'custom' && amountNum > 0 && (
              <Text
                style={{
                  fontSize: 11.5,
                  marginTop: 8,
                  color: splitPreview.ok ? colors.textMuted : colors.dangerText,
                }}
              >
                {splitPreview.ok
                  ? `Sum: ₹${(splitPreview.sum / 100).toFixed(2)} of ₹${(amountNum / 100).toFixed(2)}`
                  : `Sum ₹${((splitPreview.sum || 0) / 100).toFixed(2)} ≠ ₹${(amountNum / 100).toFixed(2)}`}
              </Text>
            )}
            {splitType === 'percentage' && (
              <Text
                style={{
                  fontSize: 11.5,
                  marginTop: 8,
                  color: splitPreview.ok ? colors.textMuted : colors.dangerText,
                }}
              >
                {splitPreview.ok
                  ? `Total: ${(splitPreview.totalPercent ?? 0).toFixed(1)}%`
                  : `Total ${(splitPreview.totalPercent ?? 0).toFixed(1)}% — must equal 100%`}
              </Text>
            )}
          </View>

          {/* Split between */}
          <SectionLabel>Split between</SectionLabel>
          <View style={{ paddingHorizontal: spacing.sm }}>
            {members.map((m) => {
              const sel = m?._id ? !!included[m._id] : false;
              const share = m?._id ? previewByUser[String(m._id)] : undefined;
              return (
                <View
                  key={m?._id || Math.random().toString()}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    paddingHorizontal: 10,
                    paddingVertical: 12,
                    borderRadius: radius.card,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => m?._id && setIncluded({ ...included, [m._id]: !sel })}
                    hitSlop={10}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        backgroundColor: sel ? colors.primary : 'transparent',
                        borderWidth: sel ? 0 : 1.75,
                        borderColor: colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {sel && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => m?._id && setIncluded({ ...included, [m._id]: !sel })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}
                  >
                    <MemberAvatar name={m?.name || m?.email} size={36} />
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                      {String(m?._id) === String(currentUser?._id) ? 'You' : (m?.name || m?.email)}
                    </Text>
                  </TouchableOpacity>

                  {sel && splitType === 'equal' && (
                    <Text style={{ fontSize: 13.5, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>
                      ₹{((share ?? perPerson) / 100).toFixed(2).replace(/\.00$/, '')}
                    </Text>
                  )}

                  {sel && splitType === 'custom' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 14, color: colors.textMuted }}>₹</Text>
                      <TextInput
                        value={m?._id ? (customAmounts[m._id] ?? '') : ''}
                        onChangeText={(t) =>
                          m?._id && setCustomAmounts({ ...customAmounts, [m._id]: sanitizeMoneyInput(t) })
                        }
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        style={{
                          minWidth: 70,
                          height: 36,
                          paddingHorizontal: 10,
                          borderRadius: 10,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.borderSoft,
                          color: colors.textPrimary,
                          fontVariant: ['tabular-nums'],
                          textAlign: 'right',
                        }}
                      />
                    </View>
                  )}

                  {sel && splitType === 'percentage' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <TextInput
                        value={m?._id ? (percentages[m._id] ?? '') : ''}
                        onChangeText={(t) =>
                          m?._id && setPercentages({ ...percentages, [m._id]: sanitizeMoneyInput(t) })
                        }
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        style={{
                          minWidth: 60,
                          height: 36,
                          paddingHorizontal: 10,
                          borderRadius: 10,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.borderSoft,
                          color: colors.textPrimary,
                          fontVariant: ['tabular-nums'],
                          textAlign: 'right',
                        }}
                      />
                      <Text style={{ fontSize: 14, color: colors.textMuted }}>%</Text>
                      {share != null && (
                        <Text
                          style={{
                            fontSize: 11.5,
                            color: colors.textMuted,
                            marginLeft: 6,
                            minWidth: 50,
                            textAlign: 'right',
                            fontVariant: ['tabular-nums'],
                          }}
                        >
                          ₹{(Number(share) / 100).toFixed(2).replace(/\.00$/, '')}
                        </Text>
                      )}
                    </View>
                  )}

                  {!sel && (
                    <Text style={{ fontSize: 13.5, color: colors.textMuted }}>—</Text>
                  )}
                </View>
              );
            })}
          </View>

          {error ? (
            <Text style={{ color: colors.dangerText, textAlign: 'center', padding: spacing.md, fontSize: 13 }}>
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View
          style={{
            padding: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.borderSoft,
            backgroundColor: colors.background,
          }}
        >
          <TouchableOpacity
            onPress={submit}
            disabled={!ready || submitting}
            style={{
              height: 56,
              borderRadius: radius.button + 6,
              backgroundColor: ready ? colors.primary : colors.surfaceVariant,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: ready ? '#fff' : colors.textMuted, fontSize: 16, fontWeight: '700' }}>
                Add expense
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionLabel({ children }) {
  return (
    <Text
      style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: 6,
        fontSize: 12.5,
        fontWeight: '700',
        color: colors.textMuted,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}
