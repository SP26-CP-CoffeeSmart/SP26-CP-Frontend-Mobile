import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetForgotPassword } from '@/services/authService';

const COLORS = {
  bg: '#F7F3EF',
  text: '#3C2A21',
  muted: '#8E7B6F',
  border: '#B08B61',
  accent: '#5B3216',
  accentSoft: '#EFE6DE',
  white: '#FFFFFF',
  shadow: 'rgba(0,0,0,0.08)',
};

const BACKGROUND_IMAGE = require('../assets/background.png');
const FORGOT_PASSWORD_EMAIL_KEY = 'forgot-password:email';
const FORGOT_PASSWORD_OTP_KEY = 'forgot-password:otp';

const normalizeParam = (value?: string | string[]) => {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
};

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const initialEmail = useMemo(() => normalizeParam(params.email).trim(), [params.email]);
  const [email, setEmail] = useState(initialEmail);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const hydrateEmail = async () => {
      const [storedEmail, storedOtp] = await AsyncStorage.multiGet([
        FORGOT_PASSWORD_EMAIL_KEY,
        FORGOT_PASSWORD_OTP_KEY,
      ]);
      if (initialEmail) {
        setEmail(initialEmail);
      } else if (storedEmail?.[1]) {
        setEmail((storedEmail[1] ?? '').trim());
      }
      if (storedOtp?.[1]) {
        setOtp((storedOtp[1] ?? '').trim());
      }
    };

    hydrateEmail();
  }, [initialEmail]);

  const handleChangePassword = async () => {
    const resolvedEmail = email.trim();
    const resolvedOtp = otp.trim();
    const newPassword = password.trim();

    if (!resolvedEmail) {
      Toast.show({ type: 'error', text1: 'Reset failed', text2: 'Missing email for password reset.' });
      return;
    }

    if (!resolvedOtp) {
      Toast.show({ type: 'error', text1: 'Reset failed', text2: 'Missing OTP verification context. Please request OTP again.' });
      return;
    }

    if (!newPassword) {
      Toast.show({ type: 'error', text1: 'Reset failed', text2: 'Please enter your new password.' });
      return;
    }

    try {
      setSubmitting(true);
      await resetForgotPassword(resolvedEmail, resolvedOtp, newPassword);
      await AsyncStorage.multiRemove([FORGOT_PASSWORD_EMAIL_KEY, FORGOT_PASSWORD_OTP_KEY]);
      Toast.show({ type: 'success', text1: 'Password changed successfully' });
      router.replace('/sign-in');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to change password.';
      Toast.show({ type: 'error', text1: 'Reset failed', text2: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} imageStyle={styles.backgroundImage}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={COLORS.text} />
            </Pressable>

            <View style={styles.heroBlock}>
              <Image source={BACKGROUND_IMAGE} style={styles.heroImage} resizeMode="contain" />
              <Text style={styles.title}>SmartCoffee</Text>
              <Text style={styles.subtitle}>Create your new password</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputFlex}
                  placeholder="Enter your new password"
                  placeholderTextColor={COLORS.muted}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable onPress={() => setShowPassword((prev) => !prev)} style={styles.iconButton}>
                  <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={18} color={COLORS.text} />
                </Pressable>
              </View>
            </View>

            <Pressable style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]} onPress={handleChangePassword} disabled={submitting}>
              <Text style={styles.primaryButtonText}>{submitting ? 'Changing...' : 'Change Password'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  backgroundImage: {
    opacity: 0.18,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  heroBlock: {
    alignItems: 'center',
    marginBottom: 18,
    gap: 6,
  },
  heroImage: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    backgroundColor: COLORS.white,
    color: COLORS.text,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
  },
  inputFlex: {
    flex: 1,
    height: 48,
    color: COLORS.text,
  },
  iconButton: {
    padding: 6,
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
});
