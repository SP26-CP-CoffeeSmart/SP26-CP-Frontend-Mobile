import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ImageBackground,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { verifyForgotPasswordOtp, verifyOtp } from '@/services/authService';
import { useAuth } from '@/context/auth-context';

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
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
};

export default function OtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[]; flow?: string | string[] }>();
  const normalizedEmail = useMemo(() => normalizeParam(params.email).trim(), [params.email]);
  const normalizedFlow = useMemo(() => normalizeParam(params.flow).trim(), [params.flow]);
  const { refreshProfile } = useAuth();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [emailForOtp, setEmailForOtp] = useState(normalizedEmail);
  const inputsRef = useRef<Array<TextInput | null>>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (normalizedEmail) {
      setEmailForOtp(normalizedEmail);
    }
  }, [normalizedEmail]);

  useEffect(() => {
    const hydrateForgotPasswordEmail = async () => {
      if (normalizedFlow !== 'forgot-password') return;
      if (normalizedEmail) return;

      const storedEmail = await AsyncStorage.getItem(FORGOT_PASSWORD_EMAIL_KEY);
      if (storedEmail) {
        setEmailForOtp(storedEmail.trim());
      }
    };

    hydrateForgotPasswordEmail();
  }, [normalizedEmail, normalizedFlow]);

  const handleChange = (value: string, index: number) => {
    const next = [...code];
    next[index] = value;
    setCode(next);

    if (value && inputsRef.current[index + 1]) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otp = code.join('');
    const isForgotPasswordFlow = normalizedFlow === 'forgot-password';
    const resolvedEmail = emailForOtp.trim();

    if (!resolvedEmail) {
      Toast.show({ type: 'error', text1: 'Verification failed', text2: 'Missing email for verification.' });
      return;
    }

    if (otp.length < 6) {
      Toast.show({ type: 'error', text1: 'Verification failed', text2: 'Please enter the 6-digit OTP.' });
      return;
    }

    try {
      setSubmitting(true);
      if (isForgotPasswordFlow) {
        await verifyForgotPasswordOtp(resolvedEmail, otp);
        await AsyncStorage.multiSet([
          [FORGOT_PASSWORD_EMAIL_KEY, resolvedEmail],
          [FORGOT_PASSWORD_OTP_KEY, otp],
        ]);
        Toast.show({ type: 'success', text1: 'OTP verified' });
        router.replace({ pathname: '/reset-password', params: { email: resolvedEmail } });
        return;
      }

      const role = 'ShopOwner';
      const tokens = await verifyOtp(resolvedEmail, otp, role);
      await AsyncStorage.multiSet([
        ['accessToken', tokens.accessToken],
        ['refreshToken', tokens.refreshToken],
      ]);
      await refreshProfile();
      Toast.show({ type: 'success', text1: 'Verified and logged in' });
      router.replace('/onboarding');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verify failed.';
      Toast.show({ type: 'error', text1: 'Verification failed', text2: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} imageStyle={styles.backgroundImage}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.card}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={COLORS.text} />
            </Pressable>

            <View style={styles.heroBlock}>
              <Image source={BACKGROUND_IMAGE} style={styles.heroImage} resizeMode="contain" />
              <Text style={styles.title}>SmartCoffee</Text>
              <Text style={styles.subtitle}>Input your OTP</Text>
            </View>

            <View style={styles.otpRow}>
              {code.map((digit, index) => (
                <TextInput
                  key={`otp-${index}`}
                  ref={(ref) => {
                    inputsRef.current[index] = ref;
                  }}
                  style={styles.otpInput}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  onChangeText={(value) => handleChange(value, index)}
                />
              ))}
            </View>

            <View style={styles.resendRow}>
              <Text style={styles.resendText}>Didn't receive the code?</Text>
              <Pressable>
                <Text style={styles.resendLink}> Resend</Text>
              </Pressable>
            </View>

            <Pressable style={styles.primaryButton} onPress={handleVerify} disabled={submitting}>
              <Text style={styles.primaryButtonText}>{submitting ? 'Verifying...' : 'Verify'}</Text>
            </Pressable>
          </View>
        </View>
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
  },
  container: {
    flex: 1,
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
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  otpInput: {
    width: 44,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    textAlign: 'center',
    fontSize: 18,
    color: COLORS.text,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  resendText: {
    fontSize: 12,
    color: COLORS.text,
  },
  resendLink: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
});
