import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { registerAccount } from '@/services/authService';

const COLORS = {
  bg: '#F7F3EF',
  text: '#3C2A21',
  muted: '#8E7B6F',
  border: '#B08B61',
  accent: '#9C7A4B',
  white: '#FFFFFF',
};

export default function SignUpScreen() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!email || !password) {
      Toast.show({ type: 'error', text1: 'Registration failed', text2: 'Email and password are required.' });
      return;
    }

    if (password !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Registration failed', text2: 'Passwords do not match.' });
      return;
    }

    if (!accepted) {
      Toast.show({ type: 'error', text1: 'Registration failed', text2: 'Please accept the Terms of Service.' });
      return;
    }

    try {
      setSubmitting(true);
      const message = await registerAccount(email, password);
      Toast.show({ type: 'success', text1: 'Registration successful', text2: message || 'OTP sent to your email.' });
      router.push({ pathname: '/otp', params: { email } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Register failed.';
      Toast.show({ type: 'error', text1: 'Registration failed', text2: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </Pressable>

        <View style={styles.headerBlock}>
          <Text style={styles.title}>SmartCoffee</Text>
          <Text style={styles.subtitle}>Please enter your email, password, or social account to continue.</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your Email Address"
            placeholderTextColor={COLORS.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your User name"
            placeholderTextColor={COLORS.muted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
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

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              placeholder="Enter your Password"
              placeholderTextColor={COLORS.muted}
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <Pressable onPress={() => setShowConfirm((prev) => !prev)} style={styles.iconButton}>
              <Ionicons name={showConfirm ? 'eye' : 'eye-off'} size={18} color={COLORS.text} />
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.checkboxRow} onPress={() => setAccepted((prev) => !prev)}>
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
            {accepted && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
          </View>
          <Text style={styles.checkboxText}>I agree to the Terms of Service</Text>
        </Pressable>

        <Pressable style={styles.primaryButton} onPress={handleRegister} disabled={submitting}>
          <Text style={styles.primaryButtonText}>{submitting ? 'Signing Up...' : 'Sign Up'}</Text>
        </Pressable>
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
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingVertical: 36,
    justifyContent: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 26,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  fieldGroup: {
    marginBottom: 16,
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  checkboxText: {
    fontSize: 12,
    color: COLORS.text,
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
});
