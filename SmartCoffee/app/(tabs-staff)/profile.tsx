import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { logoutAccount } from '@/services/authService';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context';

export default function StaffProfileScreen() {
    const router = useRouter();
    const {
        profile,
        loading: profileLoading,
        error: profileError,
        refreshProfile,
    } = useAuth();
    const [logoutSubmitting, setLogoutSubmitting] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const getProfileField = (value: unknown, fallback: string) => {
        if (value === null || value === undefined) {
            return fallback;
        }

        if (typeof value === 'string') {
            return value.trim() || fallback;
        }

        if (typeof value === 'number') {
            return String(value);
        }

        return fallback;
    };

    const profileName = getProfileField(
        profile?.fullName ?? profile?.name ?? profile?.userName ?? profile?.username,
        'Unknown user'
    );
    const profileRole = getProfileField(profile?.role ?? profile?.position ?? profile?.title, 'Staff');
    const profileEmail = getProfileField(profile?.email ?? profile?.mail, '-');
    const profilePhone = getProfileField(
        profile?.phoneNumber ?? profile?.phone ?? profile?.mobile,
        '-'
    );

    const showToast = (message: string) => {
        setToastMessage(message);
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = setTimeout(() => {
            setToastMessage(null);
        }, 2000);
    };

    const handleLogout = async () => {
        if (logoutSubmitting) {
            return;
        }

        try {
            setLogoutSubmitting(true);
            await logoutAccount();
            // Refresh profile to clear auth state and trigger navigation to login
            await refreshProfile();
            router.replace('/sign-in');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Logout failed.';
            showToast(message);
        } finally {
            setLogoutSubmitting(false);
        }
    };

    const handleRefresh = async () => {
        if (refreshing) {
            return;
        }

        try {
            setRefreshing(true);
            await refreshProfile();
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
            }
        };
    }, []);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                {/* Header Section */}
                <View style={styles.header}>
                    <View style={styles.avatarWrap}>
                        <View style={styles.avatar}>
                            <Ionicons name="person-outline" size={36} color="#5C4634" />
                        </View>
                    </View>
                    <Text style={styles.name}>{profileName}</Text>
                    <Text style={styles.role}>{profileRole}</Text>
                </View>

                {/* Account Information Card */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Account information</Text>
                    <View style={styles.infoRow}>
                        <Ionicons name="call" size={16} color="#8B5E3C" />
                        <Text style={styles.infoLabel}>Phone number:</Text>
                        <Text style={styles.infoValue}>{profilePhone}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Ionicons name="mail" size={16} color="#8B5E3C" />
                        <Text style={styles.infoLabel}>Email:</Text>
                        <Text style={styles.infoValue}>{profileEmail}</Text>
                    </View>
                </View>

                {/* Settings Card */}
                <View style={styles.listCard}>
                    <TouchableOpacity
                        style={styles.listItem}
                        onPress={() => router.push('/change-password')}
                    >
                        <View style={styles.listLeft}>
                            <Ionicons name="lock-closed-outline" size={18} color="#8B5E3C" />
                            <Text style={styles.listText}>Change password</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#C2B6A8" />
                    </TouchableOpacity>
                </View>

                {/* Logout Button */}
                <TouchableOpacity
                    style={styles.logoutButton}
                    activeOpacity={0.85}
                    onPress={handleLogout}
                    disabled={logoutSubmitting}
                >
                    <Text style={styles.logoutText}>
                        {logoutSubmitting ? 'Logging out...' : 'Log out'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Toast Notification */}
            {toastMessage ? (
                <View style={styles.toastContainer}>
                    <View style={styles.toastCard}>
                        <Text style={styles.toastText}>{toastMessage}</Text>
                    </View>
                </View>
            ) : null}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F7F4EF',
    },
    container: {
        paddingHorizontal: 18,
        paddingBottom: 32,
    },
    header: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 18,
    },
    avatarWrap: {
        marginBottom: 8,
    },
    avatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        borderWidth: 2,
        borderColor: '#D6C7B8',
        backgroundColor: '#FFF8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    name: {
        fontSize: 22,
        fontWeight: '700',
        color: '#3C2A21',
        marginBottom: 6,
    },
    role: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8B7355',
    },
    card: {
        backgroundColor: '#FFFAF5',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1E2D3',
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#3C2A21',
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 10,
    },
    infoLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#5C4634',
        flex: 0.4,
    },
    infoValue: {
        fontSize: 13,
        color: '#3C2A21',
        flex: 0.6,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: '#EFE7DD',
        marginVertical: 8,
    },
    listCard: {
        backgroundColor: '#FFFAF5',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1E2D3',
        overflow: 'hidden',
        marginBottom: 16,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    listLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    listText: {
        fontSize: 14,
        color: '#6B4D35',
        fontWeight: '600',
    },
    logoutButton: {
        backgroundColor: '#C51B1B',
        borderRadius: 20,
        paddingVertical: 10,
        alignItems: 'center',
    },
    logoutText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
    toastContainer: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    toastCard: {
        backgroundColor: '#3C2A21',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    toastText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
});
