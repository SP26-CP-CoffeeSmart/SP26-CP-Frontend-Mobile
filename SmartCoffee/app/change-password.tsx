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
import { changePassword } from '@/services/authService';

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
              <Text style={styles.title}>Change Password</Text>
              <Text style={styles.subtitle}>Enter your old and new password to update</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Old Password</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputFlex}
                  placeholder="Enter your old password"
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
                  placeholder="Enter your new password"
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
