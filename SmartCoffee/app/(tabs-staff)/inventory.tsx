import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
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
        return unique.filter((value) => value);
    }, [ingredients]);

    const fetchIngredients = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await authorizedFetch(`${AUTH_BASE_URL}/ShopInventory`);
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
    }, []);

    const filteredIngredients = useMemo(() => {
        let filtered = ingredients;

        if (selectedCategories.length > 0) {
            filtered = filtered.filter((item) => {
                const category = item.ingredient?.category || 'Uncategorized';
                return selectedCategories.includes(category);
            });
        }

        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            filtered = filtered.filter((item) =>
                (item.ingredient?.name || `Inventory #${item.inventoryDetailId}`).toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [ingredients, searchQuery, selectedCategories]);

    const toggleCategory = (category: string) => {
        setSelectedCategories((prev) =>
            prev.includes(category) ? prev.filter((value) => value !== category) : [...prev, category]
        );
    };

    const clearCategories = () => {
        setSelectedCategories([]);
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
                            <View style={styles.headerSpacer} />
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
                                style={[styles.filterButton, categoryOptions.length === 0 && styles.filterButtonDisabled]}
                                onPress={() => setFilterVisible(true)}
                                disabled={categoryOptions.length === 0}
                            >
                                <Ionicons name="options-outline" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        {selectedCategories.length > 0 ? (
                            <View style={styles.badgeRow}>
                                {selectedCategories.map((category) => (
                                    <TouchableOpacity
                                        key={category}
                                        style={styles.badge}
                                        onPress={() => toggleCategory(category)}
                                    >
                                        <Text style={styles.badgeText}>{category}</Text>
                                        <Ionicons name="close" size={12} color="#FFFFFF" />
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity style={styles.badgeClear} onPress={clearCategories}>
                                    <Text style={styles.badgeClearText}>Clear</Text>
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
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filter categories</Text>
                            <TouchableOpacity onPress={() => setFilterVisible(false)}>
                                <Ionicons name="close" size={18} color={COLORS.ink} />
                            </TouchableOpacity>
                        </View>
                        {categoryOptions.length === 0 ? (
                            <Text style={styles.modalEmpty}>No categories available.</Text>
                        ) : (
                            <View style={styles.modalChips}>
                                {categoryOptions.map((category) => {
                                    const isActive = selectedCategories.includes(category);
                                    return (
                                        <TouchableOpacity
                                            key={category}
                                            onPress={() => toggleCategory(category)}
                                            style={[
                                                styles.modalChip,
                                                isActive && styles.modalChipActive,
                                            ]}
                                        >
                                            <Text style={[styles.modalChipText, isActive && styles.modalChipTextActive]}>
                                                {category}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalClear} onPress={clearCategories}>
                                <Text style={styles.modalClearText}>Clear</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalApply}
                                onPress={() => setFilterVisible(false)}
                            >
                                <Text style={styles.modalApplyText}>Apply</Text>
                            </TouchableOpacity>
                        </View>
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
        padding: 20,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.ink,
    },
    modalEmpty: {
        color: COLORS.muted,
        fontSize: 13,
        marginBottom: 12,
    },
    modalChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
    },
    modalChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginRight: 8,
        marginBottom: 8,
        backgroundColor: COLORS.surface,
    },
    modalChipActive: {
        backgroundColor: COLORS.chipActive,
        borderColor: COLORS.chipActive,
    },
    modalChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.ink,
    },
    modalChipTextActive: {
        color: '#FFFFFF',
    },
    modalActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modalClear: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    modalClearText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.ink,
    },
    modalApply: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: COLORS.chipActive,
    },
    modalApplyText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
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
