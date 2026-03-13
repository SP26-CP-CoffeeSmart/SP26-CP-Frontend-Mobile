import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
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
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [ingredients, setIngredients] = useState<ShopInventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const categories = ['All', 'Beans', 'Milk', 'Syrups', 'Supplies'];
    const defaultMinStock = 10;

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

        if (selectedCategory !== 'All') {
            filtered = filtered.filter((item) =>
                (item.ingredient?.category || '').toLowerCase().includes(selectedCategory.toLowerCase())
            );
        }

        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            filtered = filtered.filter((item) =>
                (item.ingredient?.name || `Inventory #${item.inventoryDetailId}`).toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [ingredients, searchQuery, selectedCategory]);

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
                                style={[styles.requestCard, { backgroundColor: COLORS.accentAlt, marginRight: 0 }]}>
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
                            <TouchableOpacity style={styles.filterButton}>
                                <Ionicons name="options-outline" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.chipRow}>
                            {categories.map((category) => {
                                const isActive = selectedCategory === category;
                                return (
                                    <TouchableOpacity
                                        key={category}
                                        onPress={() => setSelectedCategory(category)}
                                        style={[
                                            styles.chip,
                                            { backgroundColor: isActive ? COLORS.chipActive : '#FFFFFF' },
                                        ]}>
                                        <Text style={[styles.chipText, { color: isActive ? '#FFFFFF' : COLORS.ink }]}> 
                                            {category}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
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
    chipRow: {
        flexDirection: 'row',
        marginBottom: 16,
        flexWrap: 'wrap',
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginRight: 8,
        marginBottom: 8,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '700',
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
