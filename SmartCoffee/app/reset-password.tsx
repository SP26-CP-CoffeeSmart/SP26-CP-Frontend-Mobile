import React, { useState } from 'react';
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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

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
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              placeholder="Enter your Password"
              placeholderTextColor={COLORS.muted}
              secureTextEntry={!showPassword}
            />
            <Pressable onPress={() => setShowPassword((prev) => !prev)} style={styles.iconButton}>
              <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={18} color={COLORS.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your Password"
            placeholderTextColor={COLORS.muted}
            secureTextEntry
          />
        </View>

        <Pressable style={styles.primaryButton} onPress={() => router.replace('/sign-in')}>
          <Text style={styles.primaryButtonText}>Change Password</Text>
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
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
});
