import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/context/auth-context';
import { updateStaffProfile } from '@/services/authService';

const COLORS = {
  bg: '#F7F4EF',
  bgTint: '#FFF8F0',
  text: '#3C2A21',
  muted: '#8E7B6F',
  border: '#E8E1D9',
  accent: '#C48C2D',
  accentDark: '#8B5E3C',
  white: '#FFFFFF',
  error: '#C51B1B',
};

const getProfileField = (value: unknown, fallback: string) => {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'string') {
    return value.trim() || fallback;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return fallback;
};

const normalizePhone = (value: string) => value.replace(/[\s.-]/g, '');

const isValidVietnamPhone = (value: string) => {
  return /^(?:\+84|84|0)\d{9,10}$/.test(value);
};

const toLocalPhone = (value: string) => {
  if (value.startsWith('+84')) {
    return `0${value.slice(3)}`;
  }

  if (value.startsWith('84')) {
    return `0${value.slice(2)}`;
  }

  return value;
};

export default function StaffProfileFormScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profileEmail = getProfileField(profile?.email ?? profile?.mail, '');

  useEffect(() => {
    setFullName(
      getProfileField(
        profile?.staffName ?? profile?.fullName ?? profile?.name ?? profile?.userName ?? profile?.username,
        ''
      )
    );
    setPhone(getProfileField(profile?.phoneNumber ?? profile?.phone ?? profile?.mobile, ''));
  }, [profile]);

  const handleSave = async () => {
    if (submitting) {
      return;
    }

    const trimmedFullName = fullName.trim();
    const normalizedPhone = normalizePhone(phone.trim());

    if (!profileEmail) {
      setError('Missing account email. Please sign in again.');
      return;
    }

    if (!trimmedFullName) {
      setError('Please enter your full name.');
      return;
    }

    if (!normalizedPhone) {
      setError('Please enter your phone number.');
      return;
    }

    if (!isValidVietnamPhone(normalizedPhone)) {
      setError('Invalid phone format. Use 0xxxxxxxxx or +84xxxxxxxxx.');
      return;
    }

    const localPhone = toLocalPhone(normalizedPhone);

    try {
      setSubmitting(true);
      setError(null);

      await updateStaffProfile(profileEmail, trimmedFullName, localPhone);
      await refreshProfile();

      Toast.show({
        type: 'success',
        text1: 'Profile updated',
        text2: 'Your staff profile has been saved.',
      });

      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update profile.';
      setError(message);
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </Pressable>

        <View style={styles.iconContainer}>
          <View style={styles.icon}>
            <Ionicons name="person-circle-outline" size={48} color={COLORS.accent} />
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Staff Profile</Text>
          <Text style={styles.subtitle}>Update your full name and phone number.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={16} color={COLORS.muted} />
              <TextInput
                style={styles.input}
                placeholder="Enter full name"
                placeholderTextColor={COLORS.muted}
                value={fullName}
                onChangeText={setFullName}
                editable={!submitting}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone number</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={16} color={COLORS.muted} />
              <TextInput
                style={styles.input}
                placeholder="Enter phone number"
                placeholderTextColor={COLORS.muted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                editable={!submitting}
              />
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[styles.saveButton, submitting && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.saveButtonText}>Save changes</Text>
                <Ionicons name="checkmark" size={16} color={COLORS.white} />
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    alignSelf: 'flex-start',
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  icon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.bgTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  form: {
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: 12,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '500',
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.muted,
  },
  saveButton: {
    backgroundColor: COLORS.accentDark,
    borderRadius: 18,
    minHeight: 52,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  spacer: {
    height: 28,
  },
});