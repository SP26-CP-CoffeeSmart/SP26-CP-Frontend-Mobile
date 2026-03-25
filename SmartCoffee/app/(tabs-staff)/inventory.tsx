import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth-context';

interface Ingredient {
    ingredientId: number;
    name: string;
    image: string;
    category: string;
    createDate: string;
    endDate: string;
}

interface ShopInventoryItem {
    inventoryDetailId: number;
    coffeeShopId?: number;
    ingredientId?: number;
    quantity?: number;
    minStock?: number;
    expirationDate?: string;
    measurement?: string;
    ingredient?: Ingredient;
}

const COLORS = {
    background: '#F7F2EE',
    card: '#FFFFFF',
    ink: '#1E1B16',
    muted: '#7A6F67',
    accent: '#2B1C15',
    accentAlt: '#1F2A44',
    chip: '#F2E7DA',
    chipActive: '#2B1C15',
    border: '#EFE4D8',
    surface: '#FBF7F2',
    success: '#15803D',
    warning: '#B45309',
};

export default function InventoryScreen() {
    const router = useRouter();
    const { coffeeShopId } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedStatus, setSelectedStatus] = useState<'all' | 'in' | 'low' | 'out'>('all');
    const [sortOption, setSortOption] = useState<'alpha' | 'qty-asc' | 'qty-desc'>('alpha');
    const [draftCategory, setDraftCategory] = useState('All');
    const [draftStatus, setDraftStatus] = useState<'all' | 'in' | 'low' | 'out'>('all');
    const [draftSort, setDraftSort] = useState<'alpha' | 'qty-asc' | 'qty-desc'>('alpha');
    const [ingredients, setIngredients] = useState<ShopInventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filterVisible, setFilterVisible] = useState(false);

    const defaultMinStock = 10;

    const categoryOptions = useMemo(() => {
        const unique = Array.from(
            new Set(ingredients.map((item) => item.ingredient?.category || 'Uncategorized'))
        );
        return ['All', ...unique.filter((value) => value)];
    }, [ingredients]);

    const hasInventory = ingredients.length > 0;

    const fetchIngredients = async () => {
        if (!coffeeShopId) {
            setIngredients([]);
            setError('Không tìm thấy shopId của tài khoản hiện tại.');
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const response = await authorizedFetch(API_ENDPOINTS.shopInventory.getByShop(coffeeShopId));
            const data = await response.json();

            if (Array.isArray(data)) {
                setIngredients(data);
            } else {
                setIngredients([]);
            }
        } catch (err) {
            console.error('Error fetching ingredients:', err);
            setError('Failed to load ingredients. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchIngredients();
    }, [coffeeShopId]);

    const filteredIngredients = useMemo(() => {
        let filtered = ingredients;

        if (selectedCategory !== 'All') {
            filtered = filtered.filter((item) => {
                const category = item.ingredient?.category || 'Uncategorized';
                return category === selectedCategory;
            });
        }

        if (selectedStatus !== 'all') {
            filtered = filtered.filter((item) => {
                const label = getStatus(item).label;
                if (label === 'OUT OF STOCK') return selectedStatus === 'out';
                if (label === 'LOW STOCK') return selectedStatus === 'low';
                return selectedStatus === 'in';
            });
        }

        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            filtered = filtered.filter((item) =>
                (item.ingredient?.name || `Inventory #${item.inventoryDetailId}`).toLowerCase().includes(query)
            );
        }

        if (sortOption !== 'alpha') {
            filtered = [...filtered].sort((a, b) => {
                const qtyA = Number(a.quantity ?? 0);
                const qtyB = Number(b.quantity ?? 0);
                return sortOption === 'qty-asc' ? qtyA - qtyB : qtyB - qtyA;
            });
        } else {
            filtered = [...filtered].sort((a, b) => {
                const nameA = (a.ingredient?.name || `Inventory #${a.inventoryDetailId}`).toLowerCase();
                const nameB = (b.ingredient?.name || `Inventory #${b.inventoryDetailId}`).toLowerCase();
                return nameA.localeCompare(nameB);
            });
        }

        return filtered;
    }, [ingredients, searchQuery, selectedCategory, selectedStatus, sortOption]);

    const openFilter = () => {
        setDraftCategory(selectedCategory);
        setDraftStatus(selectedStatus);
        setDraftSort(sortOption);
        setFilterVisible(true);
    };

    const applyFilter = () => {
        setSelectedCategory(draftCategory);
        setSelectedStatus(draftStatus);
        setSortOption(draftSort);
        setFilterVisible(false);
    };

    const resetFilters = () => {
        setSelectedCategory('All');
        setSelectedStatus('all');
        setSortOption('alpha');
        setDraftCategory('All');
        setDraftStatus('all');
        setDraftSort('alpha');
        setFilterVisible(false);
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchIngredients();
    };

    const getStatus = (item: ShopInventoryItem) => {
        const quantity = Number(item.quantity ?? 0);
        const minStock = Number(item.minStock ?? defaultMinStock);

        if (quantity <= 0) {
            return { label: 'OUT OF STOCK', color: '#B91C1C', bgColor: '#FEE2E2' };
        }

        if (quantity <= minStock) {
            return { label: 'LOW STOCK', color: COLORS.warning, bgColor: '#FEF3C7' };
        }

        return { label: 'IN STOCK', color: COLORS.success, bgColor: '#DCFCE7' };
    };

    const renderItem = ({ item }: { item: ShopInventoryItem }) => {
        const ingredientName = item.ingredient?.name || `Inventory #${item.inventoryDetailId}`;
        const ingredientImage = item.ingredient?.image;
        const ingredientCategory = item.ingredient?.category || 'Uncategorized';
        const quantity = Number(item.quantity ?? 0);
        const measurement = item.measurement ?? 'units';
        const status = getStatus(item);

        return (
            <View style={styles.cardItem}>
                <View style={styles.cardImageWrap}>
                    {ingredientImage ? (
                        <Image source={{ uri: ingredientImage }} style={styles.cardImage} />
                    ) : (
                        <View style={styles.cardImageFallback}>
                            <Ionicons name="cafe" size={26} color={COLORS.muted} />
                        </View>
                    )}
                </View>
                <View style={styles.cardContent}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                            {ingredientName}
                        </Text>
                        <View style={[styles.statusPill, { backgroundColor: status.bgColor }]}> 
                            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                        </View>
                    </View>
                    <Text style={styles.cardSubtitle}>{ingredientCategory}</Text>
                    <Text style={styles.cardQuantity}>
                        {quantity.toFixed(1)} {measurement}
                    </Text>
                </View>
                <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.muted} />
            </View>
        );
    };

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.loaderContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchIngredients}>
                    <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                data={filteredIngredients}
                keyExtractor={(item) => item.inventoryDetailId.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.accent]}
                        tintColor={COLORS.accent}
                    />
                }
                ListHeaderComponent={
                    <View>
                        <View style={styles.headerRow}>
                            <TouchableOpacity style={styles.headerIcon}>
                                <Ionicons name="chevron-back" size={20} color={COLORS.ink} />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>Staff Inventory</Text>
                            <TouchableOpacity
                                style={styles.headerIcon}
                                onPress={() => router.push('/inventory-history')}
                            >
                                <Ionicons name="time-outline" size={20} color={COLORS.ink} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.requestRow}>
                            <TouchableOpacity
                                style={[styles.requestCard, { backgroundColor: COLORS.accent }]}
                                onPress={() => router.push('/import-request')}
                            >
                                <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                                <Text style={styles.requestLabel}>Request{`\n`}Import</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.requestCard, { backgroundColor: COLORS.accentAlt, marginRight: 0 }]}
                                onPress={() => router.push('/export-request')}
                                >
                                <Ionicons name="arrow-up-circle-outline" size={20} color="#FFFFFF" />
                                <Text style={styles.requestLabel}>Request{`\n`}Export</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchRow}>
                            <View style={styles.searchBar}>
                                <Ionicons name="search" size={18} color={COLORS.muted} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search ingredients..."
                                    placeholderTextColor={COLORS.muted}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>
                            <TouchableOpacity
                                style={[styles.filterButton, !hasInventory && styles.filterButtonDisabled]}
                                onPress={openFilter}
                                disabled={!hasInventory}
                            >
                                <Ionicons name="options-outline" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        {(selectedCategory !== 'All' || selectedStatus !== 'all' || sortOption !== 'alpha') ? (
                            <View style={styles.badgeRow}>
                                {selectedCategory !== 'All' ? (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{selectedCategory}</Text>
                                    </View>
                                ) : null}
                                {selectedStatus !== 'all' ? (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>
                                            {selectedStatus === 'in'
                                                ? 'In Stock'
                                                : selectedStatus === 'low'
                                                    ? 'Low Stock'
                                                    : 'Out of Stock'}
                                        </Text>
                                    </View>
                                ) : null}
                                {sortOption !== 'alpha' ? (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>
                                            {sortOption === 'qty-asc' ? 'Stock: Low to High' : 'Stock: High to Low'}
                                        </Text>
                                    </View>
                                ) : null}
                                <TouchableOpacity style={styles.badgeClear} onPress={resetFilters}>
                                    <Text style={styles.badgeClearText}>Reset</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="cube-outline" size={28} color={COLORS.muted} />
                        <Text style={styles.emptyTitle}>No inventory yet</Text>
                        <Text style={styles.emptySubtitle}>Pull to refresh or clear filters.</Text>
                    </View>
                }
            />
            <Modal
                animationType="slide"
                transparent
                visible={filterVisible}
                onRequestClose={() => setFilterVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filter & Sort</Text>
                            <TouchableOpacity onPress={() => setFilterVisible(false)}>
                                <Ionicons name="close" size={18} color={COLORS.ink} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
                            <Text style={styles.sectionLabel}>Category</Text>
                            <View style={styles.chipGrid}>
                                {categoryOptions.map((category) => {
                                    const isActive = draftCategory === category;
                                    return (
                                        <TouchableOpacity
                                            key={category}
                                            onPress={() => setDraftCategory(category)}
                                            style={[styles.filterChip, isActive && styles.filterChipActive]}
                                        >
                                            <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                                                {category}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.sectionLabel}>Stock Status</Text>
                            <View style={styles.chipGrid}>
                                {[
                                    { key: 'in', label: 'In Stock', icon: 'checkmark-circle' as const },
                                    { key: 'low', label: 'Low Stock', icon: 'alert-circle' as const },
                                    { key: 'out', label: 'Out of Stock', icon: 'close-circle' as const },
                                ].map((item) => {
                                    const isActive = draftStatus === item.key;
                                    return (
                                        <TouchableOpacity
                                            key={item.key}
                                            onPress={() => setDraftStatus(item.key)}
                                            style={[styles.filterChip, isActive && styles.filterChipActive]}
                                        >
                                            <Ionicons
                                                name={item.icon}
                                                size={14}
                                                color={isActive ? '#FFFFFF' : COLORS.ink}
                                            />
                                            <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                                                {item.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                                <TouchableOpacity
                                    onPress={() => setDraftStatus('all')}
                                    style={[styles.filterChip, draftStatus === 'all' && styles.filterChipActive]}
                                >
                                    <Text style={[styles.filterChipText, draftStatus === 'all' && styles.filterChipTextActive]}>
                                        All Status
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.sectionLabel}>Sort By</Text>
                            {[{
                                key: 'alpha' as const,
                                label: 'Alphabetical (A-Z)',
                            }, {
                                key: 'qty-asc' as const,
                                label: 'Stock Level: Low to High',
                            }, {
                                key: 'qty-desc' as const,
                                label: 'Stock Level: High to Low',
                            }].map((item) => {
                                const isActive = draftSort === item.key;
                                return (
                                    <TouchableOpacity
                                        key={item.key}
                                        style={styles.sortRow}
                                        onPress={() => setDraftSort(item.key)}
                                    >
                                        <Text style={styles.sortLabel}>{item.label}</Text>
                                        <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                                            {isActive ? <View style={styles.radioInner} /> : null}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                        <TouchableOpacity style={styles.applyButton} onPress={applyFilter}>
                            <Text style={styles.applyButtonText}>Apply Filters</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                            <Text style={styles.resetButtonText}>Reset to Default</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loaderContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        backgroundColor: COLORS.background,
    },
    errorText: {
        color: COLORS.ink,
        textAlign: 'center',
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: 22,
        paddingVertical: 10,
        borderRadius: 999,
    },
    retryText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        marginBottom: 16,
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: COLORS.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    headerSpacer: {
        width: 40,
        height: 40,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.ink,
    },
    requestRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    requestCard: {
        flex: 1,
        borderRadius: 18,
        paddingVertical: 20,
        alignItems: 'center',
        marginRight: 12,
    },
    requestLabel: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 10,
        textAlign: 'center',
        letterSpacing: 0.6,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    searchInput: {
        marginLeft: 8,
        flex: 1,
        fontSize: 14,
        color: COLORS.ink,
    },
    filterButton: {
        marginLeft: 10,
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: COLORS.chipActive,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterButtonDisabled: {
        opacity: 0.5,
    },
    badgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 16,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.chipActive,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        marginRight: 8,
        marginBottom: 8,
        gap: 6,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    badgeClear: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 8,
    },
    badgeClearText: {
        color: COLORS.ink,
        fontSize: 12,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: COLORS.card,
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 20,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    modalHandle: {
        alignSelf: 'center',
        width: 44,
        height: 5,
        borderRadius: 999,
        backgroundColor: '#DED5CC',
        marginBottom: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.ink,
    },
    modalBody: {
        maxHeight: 420,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.muted,
        letterSpacing: 1.2,
        marginBottom: 12,
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 22,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: COLORS.chip,
        gap: 6,
    },
    filterChipActive: {
        backgroundColor: COLORS.accent,
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.ink,
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    sortRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    sortLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.ink,
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#D9CEC3',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterActive: {
        borderColor: COLORS.accent,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.accent,
    },
    applyButton: {
        marginTop: 18,
        backgroundColor: COLORS.accent,
        paddingVertical: 16,
        borderRadius: 18,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    applyButtonText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    resetButton: {
        marginTop: 12,
        alignItems: 'center',
        paddingVertical: 6,
    },
    resetButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.muted,
    },
    cardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderRadius: 18,
        padding: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cardImageWrap: {
        width: 64,
        height: 64,
        borderRadius: 16,
        overflow: 'hidden',
        marginRight: 12,
        backgroundColor: COLORS.surface,
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },
    cardImageFallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardContent: {
        flex: 1,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.ink,
        flex: 1,
        marginRight: 10,
    },
    cardSubtitle: {
        fontSize: 12,
        color: COLORS.muted,
        marginBottom: 6,
    },
    cardQuantity: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.ink,
    },
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.ink,
        marginTop: 10,
    },
    emptySubtitle: {
        fontSize: 12,
        color: COLORS.muted,
        marginTop: 6,
    },
});
