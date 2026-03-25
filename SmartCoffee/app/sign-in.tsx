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
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginAccount } from '@/services/authService';
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

export default function SignInScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    console.log('[Auth] login attempt:', {
      email: trimmedEmail,
      passwordLength: trimmedPassword.length,
    });

    if (!trimmedEmail || !trimmedPassword) {
      Toast.show({ type: 'error', text1: 'Login failed', text2: 'Please enter email and password.' });
      return;
    }

    try {
      setSubmitting(true);
      const tokens = await loginAccount(trimmedEmail, trimmedPassword);
      console.log('[Auth] login successful, tokens received:', tokens);
      await AsyncStorage.multiSet([
        ['accessToken', tokens.accessToken],
        ['refreshToken', tokens.refreshToken],
      ]);
      await refreshProfile();
      Toast.show({ type: 'success', text1: 'Login successful' });
      // Navigation will be handled by root layout based on role
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed.';
      Toast.show({ type: 'error', text1: 'Login failed', text2: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} imageStyle={styles.backgroundImage}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.heroBlock}>
              <Image source={BACKGROUND_IMAGE} style={styles.heroImage} resizeMode="contain" />
              <Text style={styles.title}>Welcome To Coffee Hearts</Text>
              <Text style={styles.subtitle}>Sign in to get your day started</Text>
            </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email/Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your User name"
            placeholderTextColor={COLORS.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              placeholder="Enter your Password"
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

        <Pressable style={styles.forgotRow} onPress={() => router.push('/forgot-password')}>
          <Text style={styles.forgotText}>Forgot Password ?</Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>Or</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.socialRow}>
          <Pressable style={styles.socialButton}>
            <FontAwesome name="google" size={20} color="#EA4335" />
          </Pressable>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account ?</Text>
          <Pressable onPress={() => router.push('/sign-up')}>
            <Text style={styles.footerLink}> Sign Up</Text>
          </Pressable>
        </View>

            <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={submitting}>
              <Text style={styles.primaryButtonText}>{submitting ? 'Signing In...' : 'Sign In'}</Text>
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
    paddingVertical: 24,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  heroBlock: {
    alignItems: 'center',
    marginBottom: 22,
    gap: 8,
  },
  heroImage: {
    width: 140,
    height: 140,
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
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  forgotText: {
    fontSize: 12,
    color: COLORS.text,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2D6CC',
  },
  dividerText: {
    fontSize: 12,
    color: COLORS.muted,
  },
  socialRow: {
    alignItems: 'center',
    marginBottom: 18,
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 18,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.text,
  },
  footerLink: {
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
