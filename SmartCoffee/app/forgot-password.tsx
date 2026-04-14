import React, { useState } from 'react';
import {
  Image,
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { requestForgotPasswordOtp } from '@/services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FORGOT_PASSWORD_EMAIL_KEY = 'forgot-password:email';

// Match sign-in styles
const COLORS = {
  bg: '#F7F3EF',
  text: '#3C2A21',
  muted: '#8E7B6F',
  border: '#B08B61',
  accent: '#5B3216',
  white: '#FFFFFF',
  shadow: 'rgba(0,0,0,0.08)',
};

const BACKGROUND_IMAGE = require('../assets/background.png');

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSendOtp = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Toast.show({ type: 'error', text1: 'Send OTP failed', text2: 'Please enter your email.' });
      return;
    }

    try {
      setSubmitting(true);
      await requestForgotPasswordOtp(trimmedEmail);
      await AsyncStorage.setItem(FORGOT_PASSWORD_EMAIL_KEY, trimmedEmail);
      Toast.show({ type: 'success', text1: 'OTP sent', text2: 'Please check your email for the OTP code.' });
      router.push({ pathname: '/otp', params: { email: trimmedEmail, flow: 'forgot-password' } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send OTP.';
      Toast.show({ type: 'error', text1: 'Send OTP failed', text2: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} imageStyle={styles.backgroundImage}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </Pressable>

            <View style={styles.heroBlock}>
              <Image source={BACKGROUND_IMAGE} style={styles.heroImage} resizeMode="contain" />
              <Text style={styles.title}>Recovery Options</Text>
              <Text style={styles.subtitle}>Enter your details to reset your password</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email/Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your Email/Phone"
                placeholderTextColor={COLORS.muted}
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <Pressable style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]} onPress={handleSendOtp} disabled={submitting}>
              <Text style={styles.primaryButtonText}>{submitting ? 'Sending...' : 'Send OTP'}</Text>
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
    paddingTop: 16,
    paddingBottom: 24,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginLeft: -8,
  },
  heroBlock: {
    alignItems: 'center',
    marginBottom: 22,
    gap: 8,
  },
  heroImage: {
    width: 100,
    height: 100,
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
    marginBottom: 22,
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
