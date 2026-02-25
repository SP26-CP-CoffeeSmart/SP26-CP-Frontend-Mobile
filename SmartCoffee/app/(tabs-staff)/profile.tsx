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

const purchaseStatuses = [
    { label: 'Pending confirmation', icon: 'wallet-outline' },
    { label: 'Awaiting pickup', icon: 'cube-outline' },
    { label: 'Awaiting delivery', icon: 'car-outline' },
    { label: 'Delivered', icon: 'checkmark-done-outline' },
];

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
    const profileImageUrl = profile?.profileImageUrl ?? profile?.avatar ?? profile?.image ?? null;

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
                            {profileImageUrl ? (
                                <Image source={{ uri: profileImageUrl as string }} style={styles.avatarImage} />
                            ) : (
                                <Ionicons name="person-outline" size={36} color="#5C4634" />
                            )}
                        </View>
                    </View>
                    <Text style={styles.name}>{profileName}</Text>
                    {profileRole ? <Text style={styles.role}>{profileRole}</Text> : null}
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

                {/* Purchase Order Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeading}>Purchase Order</Text>
                    <TouchableOpacity activeOpacity={0.7}>
                        <Text style={styles.sectionAction}>View purchase history</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.statusGrid}>
                    {purchaseStatuses.map((status) => (
                        <View key={status.label} style={styles.statusItem}>
                            <View style={styles.statusIconWrap}>
                                <Ionicons name={status.icon as any} size={22} color="#8B5E3C" />
                            </View>
                            <Text style={styles.statusLabel}>{status.label}</Text>
                        </View>
                    ))}
                </View>

                {/* Settings Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeading}>Settings</Text>
                </View>

                <View style={styles.listCard}>
                    <TouchableOpacity style={styles.listRow} activeOpacity={0.7}>
                        <View style={styles.listLeft}>
                            <Ionicons name="notifications" size={18} color="#8B5E3C" />
                            <Text style={styles.listText}>Notifications</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#C2B6A8" />
                    </TouchableOpacity>


                    <View style={styles.divider} />
                    <TouchableOpacity
                        style={styles.listRow}
                        activeOpacity={0.7}
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
        overflow: 'hidden',
    },
    avatarImage: {
        width: 86,
        height: 86,
        borderRadius: 43,
    },
    name: {
        fontSize: 22,
        fontWeight: '700',
        color: '#3C2B20',
    },
    role: {
        fontSize: 14,
        color: '#C48C2D',
        marginTop: 2,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E8E1D9',
        shadowColor: '#3C2B20',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
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
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        marginTop: 6,
    },
    sectionHeading: {
        fontSize: 15,
        fontWeight: '700',
        color: '#3C2A21',
    },
    sectionAction: {
        fontSize: 12,
        color: '#C89A5B',
        fontWeight: '600',
    },
    statusGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    statusItem: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E8E1D9',
    },
    statusIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF4E6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statusLabel: {
        fontSize: 12,
        color: '#6B4D35',
        fontWeight: '600',
        textAlign: 'center',
    },
    listCard: {
        backgroundColor: '#FFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E8E1D9',
        overflow: 'hidden',
        marginBottom: 16,
        shadowColor: '#3C2B20',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
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
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 8,
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
