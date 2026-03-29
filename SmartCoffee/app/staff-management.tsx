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
    bg: '#FBF8F4',
    bgTint: '#F5EFE8',
    text: '#2D211B',
    muted: '#8B8179',
    mutedLight: '#C6BDB6',
    border: '#EFE8E1',
    accent: '#32211E',
    accentDark: '#231713',
    white: '#FFFFFF',
    error: '#C51B1B',
    iconSoft: '#F4EFE9',
};

export default function StaffManagementScreen() {
    type SortOption = 'NAME_ASC' | 'NAME_DESC' | 'ROLE_ASC';

    const router = useRouter();
    const { coffeeShopId: profileCoffeeShopId } = useAuth();
    const [staff, setStaff] = useState<ShopStaff[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>('NAME_ASC');
    const [showSortOptions, setShowSortOptions] = useState(false);

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

    const filteredStaff = React.useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        const list = staff.filter((staffMember) => {
            const name = getStaffName(staffMember).toLowerCase();
            const email = getStaffEmail(staffMember).toLowerCase();
            const position = getStaffPosition(staffMember).toLowerCase();
            const queryMatched =
                !query ||
                name.includes(query) ||
                email.includes(query) ||
                position.includes(query);
            return queryMatched;
        });

        return [...list].sort((a, b) => {
            if (sortOption === 'NAME_ASC') {
                return getStaffName(a).localeCompare(getStaffName(b));
            }
            if (sortOption === 'NAME_DESC') {
                return getStaffName(b).localeCompare(getStaffName(a));
            }
            return getStaffPosition(a).localeCompare(getStaffPosition(b));
        });
    }, [searchQuery, sortOption, staff]);

    const getSortLabel = () => {
        if (sortOption === 'NAME_DESC') {
            return 'Name Z-A';
        }
        if (sortOption === 'ROLE_ASC') {
            return 'Role A-Z';
        }
        return 'Name A-Z';
    };

    const getStaffInitials = (staffMember: ShopStaff) => {
        const name = getStaffName(staffMember).trim();
        if (!name) {
            return 'NA';
        }
        const parts = name.split(/\s+/).filter(Boolean);
        const initials = parts
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('');
        return initials || 'NA';
    };

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
                        <Text style={styles.title}>Staff Management</Text>
                    </View>
                    <View style={styles.searchBox}>
                        <Ionicons name="search" size={18} color={COLORS.muted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name or role..."
                            placeholderTextColor={COLORS.muted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                {!loading && !error && (
                    <View style={styles.statsWrap}>
                        <View style={[styles.statCard, styles.totalCard]}>
                            <View>
                                <Text style={styles.statLabel}>TOTAL STAFF</Text>
                                <Text style={styles.statValue}>{staff.length}</Text>
                            </View>
                            <View style={styles.statIconWrap}>
                                <Ionicons name="people" size={20} color={COLORS.accent} />
                            </View>
                        </View> 
                    </View>
                )}

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
                        <Text style={styles.emptyText}>{staff.length === 0 ? 'No staff members found' : 'No matching staff'}</Text>
                        <Text style={styles.emptySubtext}>
                            {staff.length === 0
                                ? 'Tap + to add your first staff member'
                                : 'Try another keyword or sort option'}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.directorySection}>
                        <View style={styles.directoryHeader}>
                            <Text style={styles.directoryTitle}>Staff Members</Text>
                            <Pressable
                                style={styles.sortButton}
                                onPress={() => setShowSortOptions((prev) => !prev)}
                            >
                                <Ionicons name="swap-vertical-outline" size={14} color={COLORS.muted} />
                                <Text style={styles.sortText}>{getSortLabel()}</Text>
                            </Pressable>
                        </View>
                        {showSortOptions && (
                            <View style={styles.sortOptionsRow}>
                                <Pressable
                                    style={[styles.sortOptionChip, sortOption === 'NAME_ASC' && styles.sortOptionChipActive]}
                                    onPress={() => {
                                        setSortOption('NAME_ASC');
                                        setShowSortOptions(false);
                                    }}
                                >
                                    <Text style={[styles.sortOptionText, sortOption === 'NAME_ASC' && styles.sortOptionTextActive]}>
                                        Name A-Z
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.sortOptionChip, sortOption === 'NAME_DESC' && styles.sortOptionChipActive]}
                                    onPress={() => {
                                        setSortOption('NAME_DESC');
                                        setShowSortOptions(false);
                                    }}
                                >
                                    <Text style={[styles.sortOptionText, sortOption === 'NAME_DESC' && styles.sortOptionTextActive]}>
                                        Name Z-A
                                    </Text>
                                </Pressable>
                            </View>
                        )}
                        <View style={styles.staffList}>
                        {filteredStaff.map((staffMember, index) => {
                            const staffId = staffMember.id ?? staffMember.staffId;

                            return (
                                <View key={staffId ?? index} style={styles.staffCard}>
                                    <View style={styles.staffHeader}>
                                        <View style={styles.staffInfo}>
                                            <View style={styles.avatarWrap}>
                                                <Text style={styles.avatarText}>{getStaffInitials(staffMember)}</Text>
                                            </View>
                                            <View style={styles.staffDetails}>
                                                <Text style={styles.staffName}>{getStaffName(staffMember)}</Text>
                                                <Text style={styles.staffPosition}>{getStaffPosition(staffMember)}</Text>
                                            </View>
                                        </View>
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
                    </View>
                )}

                <View style={styles.spacer} />
            </ScrollView>
            <Pressable
                style={styles.floatingAddButton}
                onPress={() => router.push('/create-staff' as any)}
            >
                <Ionicons name="add" size={28} color={COLORS.white} />
            </Pressable>
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
        paddingHorizontal: 20,
    },
    backButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
        marginBottom: 10,
    },
    header: {
        marginBottom: 18,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    title: {
        fontSize: 30,
        fontWeight: '700',
        color: COLORS.text,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 16,
        height: 50,
        shadowColor: '#3A2A1F',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 13,
        color: COLORS.text,
    },
    statsWrap: {
        marginBottom: 16,
        gap: 12,
    },
    totalCard: {
        minHeight: 92,
    },
    statCard: {
        backgroundColor: COLORS.white,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 18,
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#3D2B20',
        shadowOpacity: 0.07,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
    },
    statLabel: {
        color: COLORS.muted,
        fontSize: 10,
        letterSpacing: 1.4,
        fontWeight: '600',
    },
    statValue: {
        color: COLORS.text,
        fontSize: 34,
        fontWeight: '700',
        lineHeight: 40,
        marginTop: 2,
    },
    statIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: COLORS.iconSoft,
        alignItems: 'center',
        justifyContent: 'center',
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
    directorySection: {
        marginTop: 4,
    },
    directoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    directoryTitle: {
        color: COLORS.text,
        fontSize: 28,
        fontWeight: '700',
    },
    sortButton: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.white,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    sortText: {
        color: COLORS.muted,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    sortOptionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    sortOptionChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.white,
    },
    sortOptionChipActive: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.bgTint,
    },
    sortOptionText: {
        fontSize: 12,
        color: COLORS.muted,
        fontWeight: '600',
    },
    sortOptionTextActive: {
        color: COLORS.accent,
    },
    staffList: {
        gap: 12,
        paddingBottom: 20,
    },
    staffCard: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#3C2B20',
        shadowOpacity: 0.07,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
    },
    staffHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginBottom: 10,
    },
    staffInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    avatarWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.iconSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    avatarText: {
        color: COLORS.accent,
        fontSize: 16,
        fontWeight: '700',
    },
    staffDetails: {
        flex: 1,
    },
    staffName: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.text,
    },
    staffPosition: {
        fontSize: 13,
        color: COLORS.muted,
        marginTop: 2,
    },
    staffMeta: {
        gap: 5,
        paddingTop: 3,
        paddingLeft: 62,
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
        height: 90,
    },
    floatingAddButton: {
        position: 'absolute',
        right: 20,
        bottom: 28,
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#1E1210',
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
    },
});
