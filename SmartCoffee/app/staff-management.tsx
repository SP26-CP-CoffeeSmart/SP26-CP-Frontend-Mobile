import React, { useState, useEffect } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    Pressable,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { TextInput } from 'react-native';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';

export interface ShopStaff {
    id?: number;
    staffId?: number;
    accountId?: number;
    coffeeShopId?: number;
    shopId?: number;
    fullName?: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
    phone?: string;
    position?: string;
    role?: string;
    status?: string;
    isActive?: boolean;
    active?: boolean;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
}

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
    success: '#1F7A1F',
    error: '#C51B1B',
    statusActive: '#E3F7E6',
    statusInactive: '#F2F2F2',
};

export default function StaffManagementScreen() {
    const router = useRouter();
    const { profile, coffeeShopId: profileCoffeeShopId } = useAuth();
    const [staff, setStaff] = useState<ShopStaff[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        let isActive = true;

        const loadStaff = async () => {
            if (!profileCoffeeShopId) {
                if (isActive) {
                    setStaff([]);
                    setError('You have not added your coffee shop yet.');
                    setLoading(false);
                }
                return;
            }

            try {
                if (isActive) {
                    setLoading(true);
                }
                const response = await authorizedFetch(
                    API_ENDPOINTS.shopStaff.getByShop(profileCoffeeShopId),
                    {
                        headers: {
                            Accept: '*/*',
                        },
                    }
                );
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                if (isActive) {
                    setStaff(Array.isArray(data) ? data : []);
                    setError(null);
                }
            } catch (err) {
                if (isActive) {
                    setError('Unable to load staff members.');
                    console.error('Error loading staff:', err);
                }
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        loadStaff();

        return () => {
            isActive = false;
        };
    }, [profileCoffeeShopId]);

    const handleRefresh = async () => {
        if (!profileCoffeeShopId) {
            return;
        }

        try {
            setRefreshing(true);
            const response = await authorizedFetch(
                API_ENDPOINTS.shopStaff.getByShop(profileCoffeeShopId),
                {
                    headers: {
                        Accept: '*/*',
                    },
                }
            );
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setStaff(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err) {
            setError('Unable to refresh staff members.');
            console.error('Error refreshing staff:', err);
        } finally {
            setRefreshing(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            handleRefresh();
        }, [profileCoffeeShopId])
    );

    const getStaffName = (staffMember: ShopStaff) => {
        return staffMember.fullName ?? staffMember.name ?? 'Unknown staff';
    };

    const getStaffEmail = (staffMember: ShopStaff) => {
        return staffMember.email ?? '-';
    };

    const getStaffPhone = (staffMember: ShopStaff) => {
        return staffMember.phoneNumber ?? staffMember.phone ?? '-';
    };

    const getStaffPosition = (staffMember: ShopStaff) => {
        return staffMember.position ?? staffMember.role ?? 'Staff';
    };

    const isStaffActive = (staffMember: ShopStaff) => {
        const statusBool = staffMember.isActive ?? staffMember.active;
        if (typeof statusBool === 'boolean') {
            return statusBool;
        }
        return String(staffMember.status ?? '').toLowerCase() === 'active';
    };

    const getStaffStatus = (staffMember: ShopStaff) => {
        return isStaffActive(staffMember) ? 'Active' : 'Inactive';
    };

    const filteredStaff = staff.filter((staffMember) => {
        const name = getStaffName(staffMember).toLowerCase();
        const email = getStaffEmail(staffMember).toLowerCase();
        const position = getStaffPosition(staffMember).toLowerCase();
        const query = searchQuery.toLowerCase();
        return name.includes(query) || email.includes(query) || position.includes(query);
    });

    return (
        <SafeAreaView style={styles.safeArea}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={20} color={COLORS.text} />
                </Pressable>

                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <View>
                            <Text style={styles.title}>Staff Management</Text>
                            <Text style={styles.subtitle}>Manage your coffee shop staff</Text>
                        </View>
                        <Pressable
                            style={styles.createButton}
                            onPress={() => router.push('/create-staff' as any)}

                        >
                            <Ionicons name="add" size={24} color={COLORS.white} />
                        </Pressable>
                    </View>
                    <View style={styles.searchBox}>
                        <Ionicons name="search" size={18} color={COLORS.muted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search staff members..."
                            placeholderTextColor={COLORS.muted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.accent} />
                        <Text style={styles.loadingText}>Loading staff members...</Text>
                    </View>
                ) : error ? (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
                        <Text style={styles.errorText}>{error}</Text>
                        <Pressable style={styles.retryButton} onPress={handleRefresh}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </Pressable>
                    </View>
                ) : filteredStaff.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={48} color={COLORS.mutedLight} />
                        <Text style={styles.emptyText}>{staff.length === 0 ? 'No staff members found' : 'No results found'}</Text>
                        <Text style={styles.emptySubtext}>{staff.length === 0 ? 'Add staff members to manage your team' : 'Try a different search'}</Text>
                    </View>
                ) : (
                    <View style={styles.staffList}>
                        {filteredStaff.map((staffMember, index) => {
                            const active = isStaffActive(staffMember);
                            const staffId = staffMember.id ?? staffMember.staffId;

                            return (
                                <View key={staffId ?? index} style={styles.staffCard}>
                                    <View style={styles.staffHeader}>
                                        <View style={styles.staffInfo}>
                                            <View style={styles.staffIconWrap}>
                                                <Ionicons name="person-circle" size={44} color={COLORS.accent} />
                                            </View>
                                            <View style={styles.staffDetails}>
                                                <Text style={styles.staffName}>{getStaffName(staffMember)}</Text>
                                                <Text style={styles.staffPosition}>{getStaffPosition(staffMember)}</Text>
                                            </View>
                                        </View>
                                        {/* <View
                      style={[
                        styles.statusBadge,
                        active ? styles.statusBadgeActive : styles.statusBadgeInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          active
                            ? styles.statusBadgeTextActive
                            : styles.statusBadgeTextInactive,
                        ]}
                      >
                        {getStaffStatus(staffMember)}
                      </Text>
                    </View> */}
                                    </View>

                                    <View style={styles.staffMeta}>
                                        <View style={styles.metaRow}>
                                            <Ionicons name="mail-outline" size={14} color={COLORS.muted} />
                                            <Text style={styles.metaText}>{getStaffEmail(staffMember)}</Text>
                                        </View>
                                        <View style={styles.metaRow}>
                                            <Ionicons name="call-outline" size={14} color={COLORS.muted} />
                                            <Text style={styles.metaText}>{getStaffPhone(staffMember)}</Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

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
    },
    header: {
        marginBottom: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.text,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.muted,
        marginTop: 4,
    },
    createButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 12,
        height: 44,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 13,
        color: COLORS.text,
    },
    loadingContainer: {
        flex: 1,
        minHeight: 300,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 14,
        color: COLORS.muted,
    },
    errorContainer: {
        minHeight: 300,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 32,
    },
    errorText: {
        fontSize: 14,
        color: COLORS.error,
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 20,
    },
    retryButtonText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: '700',
    },
    emptyContainer: {
        minHeight: 300,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 32,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
    },
    emptySubtext: {
        fontSize: 13,
        color: COLORS.muted,
        textAlign: 'center',
    },
    staffList: {
        gap: 12,
        paddingBottom: 20,
    },
    staffCard: {
        backgroundColor: COLORS.white,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#3C2B20',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    staffHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    staffInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    staffIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.bgTint,
        alignItems: 'center',
        justifyContent: 'center',
    },
    staffDetails: {
        flex: 1,
    },
    staffName: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
    staffPosition: {
        fontSize: 12,
        color: COLORS.muted,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusBadgeActive: {
        backgroundColor: COLORS.statusActive,
    },
    statusBadgeInactive: {
        backgroundColor: COLORS.statusInactive,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    statusBadgeTextActive: {
        color: COLORS.success,
    },
    statusBadgeTextInactive: {
        color: '#9A9A9A',
    },
    staffMeta: {
        gap: 6,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: 10,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    metaText: {
        fontSize: 12,
        color: COLORS.muted,
        flex: 1,
    },
    spacer: {
        height: 20,
    },
});
