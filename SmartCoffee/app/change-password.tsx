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
import { Stack, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { changePassword } from '@/services/authService';

const COLORS = {
  bg: '#F7F3EF',
  text: '#3C2A21',
  muted: '#8E7B6F',
  border: '#B08B61',
  accent: '#9C7A4B',
  white: '#FFFFFF',
};

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      Toast.show({
        type: 'error',
        text1: 'Change password failed',
        text2: 'Please enter old and new password.',
      });
      return;
    }

    if (oldPassword === newPassword) {
      Toast.show({
        type: 'error',
        text1: 'Change password failed',
        text2: 'New password must be different from old password.',
      });
      return;
    }

    try {
      setSubmitting(true);
      await changePassword(oldPassword, newPassword);
      Toast.show({ type: 'success', text1: 'Password updated successfully.' });
      setOldPassword('');
      setNewPassword('');
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to change password.';
      Toast.show({ type: 'error', text1: 'Change password failed', text2: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </Pressable>

        <View style={styles.headerBlock}>
          <Text style={styles.title}>SmartCoffee</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Old Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              placeholder="Enter your Password"
              placeholderTextColor={COLORS.muted}
              secureTextEntry={!showOldPassword}
              value={oldPassword}
              onChangeText={setOldPassword}
            />
            <Pressable
              onPress={() => setShowOldPassword((prev) => !prev)}
              style={styles.iconButton}
            >
              <Ionicons name={showOldPassword ? 'eye' : 'eye-off'} size={18} color={COLORS.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>New Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              placeholder="Enter your Password"
              placeholderTextColor={COLORS.muted}
              secureTextEntry={!showNewPassword}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <Pressable
              onPress={() => setShowNewPassword((prev) => !prev)}
              style={styles.iconButton}
            >
              <Ionicons name={showNewPassword ? 'eye' : 'eye-off'} size={18} color={COLORS.text} />
            </Pressable>
          </View>
        </View>

        <Pressable
          style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
          onPress={handleChangePassword}
          disabled={submitting}
        >
          <Text style={styles.primaryButtonText}>
            {submitting ? 'Changing...' : 'Change Password'}
          </Text>
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
