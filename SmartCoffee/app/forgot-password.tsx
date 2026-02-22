import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const COLORS = {
  bg: '#F7F3EF',
  text: '#3C2A21',
  muted: '#8E7B6F',
  border: '#B08B61',
  accent: '#9C7A4B',
  white: '#FFFFFF',
};

export default function ForgotPasswordScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </Pressable>

        <View style={styles.headerBlock}>
          <Text style={styles.title}>SmartCoffee</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone Number/Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email/phonenumber"
            placeholderTextColor={COLORS.muted}
          />
        </View>

        <Pressable style={styles.primaryButton} onPress={() => router.push('/otp')}>
          <Text style={styles.primaryButtonText}>Send</Text>
        </Pressable>
      </View>
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
    marginBottom: 40,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
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
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
});
