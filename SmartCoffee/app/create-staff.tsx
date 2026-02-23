import React, { useState } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
    Pressable,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

const COLORS = {
    bg: '#F7F3EF',
    bgTint: '#FFF8F0',
    text: '#3C2A21',
    muted: '#8E7B6F',
    mutedLight: '#C2B6A8',
    border: '#E8E1D9',
    accent: '#D38B2A',
    accentDark: '#A36D2D',
    white: '#FFFFFF',
    error: '#C51B1B',
};

export default function CreateStaffScreen() {
    const router = useRouter();
    const { coffeeShopId: profileCoffeeShopId } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreateAccount = async () => {
        if (submitting) {
            return;
        }

        const trimmedEmail = email.trim();

        if (!trimmedEmail) {
            setError('Please enter a staff email.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            setError('Please enter a valid email address.');
            return;
        }

        if (!password) {
            setError('Please enter a temporary password.');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        if (!profileCoffeeShopId) {
            setError('Missing coffee shop id.');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            const payload = {
                email: trimmedEmail,
                password: password,
                coffeeShopId: profileCoffeeShopId,
            };

            const response = await authorizedFetch(API_ENDPOINTS.shopStaff.create(), {
                method: 'POST',
                headers: {
                    Accept: 'text/plain',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `HTTP error! status: ${response.status}`);
            }

            Toast.show({
                type: 'success',
                text1: 'Staff account created',
                text2: `${trimmedEmail} has been added to your team.`,
            });

            setEmail('');
            setPassword('');
            router.back();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to create staff account.';
            setError(message);
            Toast.show({
                type: 'error',
                text1: 'Create staff failed',
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
                        <Ionicons name="person-add" size={48} color={COLORS.accent} />
                    </View>
                </View>

                <View style={styles.header}>
                    <Text style={styles.title}>Create Staff Account</Text>
                    <Text style={styles.subtitle}>Set up a new workspace for your team member</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.field}>
                        <Text style={styles.label}>Staff Email</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="mail-outline" size={16} color={COLORS.muted} />
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. staff@example.com"
                                placeholderTextColor={COLORS.muted}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                                editable={!submitting}
                            />
                        </View>
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Temporary Password</Text>
                        <View style={[styles.inputWrapper, styles.passwordField]}>
                            <Ionicons name="lock-closed-outline" size={16} color={COLORS.muted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter password"
                                placeholderTextColor={COLORS.muted}
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={setPassword}
                                editable={!submitting}
                            />
                            <Pressable
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeButton}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye' : 'eye-off'}
                                    size={16}
                                    color={COLORS.muted}
                                />
                            </Pressable>
                        </View>
                    </View>

                    {error && <Text style={styles.errorText}>{error}</Text>}

                    <Pressable
                        style={[styles.createButton, submitting && styles.createButtonDisabled]}
                        onPress={handleCreateAccount}
                        disabled={submitting}

                    >
                        {submitting ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <>
                                <Text style={styles.createButtonText}>Create Account</Text>
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
        backgroundColor: COLORS.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 12,
        height: 48,
        gap: 8,
    },
    passwordField: {
        paddingRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 13,
        color: COLORS.text,
    },
    eyeButton: {
        padding: 8,
    },
    errorText: {
        fontSize: 12,
        color: COLORS.error,
        marginTop: 4,
    },
    createButton: {
        backgroundColor: COLORS.accent,
        borderRadius: 20,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 8,
    },
    createButtonDisabled: {
        opacity: 0.7,
    },
    createButtonText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '700',
    },
    spacer: {
        height: 24,
    },
});
