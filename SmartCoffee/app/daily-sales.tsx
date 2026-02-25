import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    TextInput,
    RefreshControl,
    Image,
    FlatList,
    Platform,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';
import beverageSizeService, { BeverageSize } from '@/services/beverageSizeService';

const COLORS = {
    bg: '#F7F3EF',
    text: '#3C2A21',
    textSecondary: '#8E7B6F',
    border: '#E8E1D9',
    accent: '#D38B2A',
    accentDark: '#A36D2D',
    white: '#FFFFFF',
    status: '#E3F7E6',
    outOfStock: '#FFE6E6',
};

interface MenuItem {
    menuItemId: number;
    description: string | null;
    sellingPrice: number;
    addedDate: string;
    shopBeverage: {
        beverageId: number;
        name: string;
        status: string;
        beverageCategoryId: number;
        beverageCategoryName: string;
        imageUrl: string | null;
    };
    shopRecipe: {
        recipeId: number;
        recipeName: string;
        image: string | null;
    };
}

interface MenuGroup {
    menuGroupId: number;
    name: string;
    orderIndex: number;
    menuItems: MenuItem[];
}

interface MenuData {
    menuId: number;
    menuHeaderId: number;
    versionNumber: string;
    status: string;
    isActive: boolean;
    menuGroups: MenuGroup[];
}

interface DailySalesItem {
    menuItemId: number;
    sizes: { [key: string]: number }; // Dynamic size quantities
    total: number;
    item: MenuItem;
}

const fallbackMenuImage = 'https://via.placeholder.com/60';

export default function DailySalesScreen() {
    const router = useRouter();
    const { coffeeShopId } = useAuth();
    const [menuData, setMenuData] = useState<MenuData | null>(null);
    const [allItems, setAllItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
    const [salesData, setSalesData] = useState<Map<number, DailySalesItem>>(new Map());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [beverageSizes, setBeverageSizes] = useState<BeverageSize[]>([]);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [editingItems, setEditingItems] = useState<Set<number>>(new Set());
    const [originalSalesData, setOriginalSalesData] = useState<
        Map<number, DailySalesItem | null>
    >(new Map());

    const fetchMenu = async () => {
        if (!coffeeShopId) {
            setError('Coffee shop ID not found');
            setLoading(false);
            return;
        }

        try {
            setError(null);

            // Fetch menu data
            const menuResponse = await authorizedFetch(
                API_ENDPOINTS.menu.getActiveByShop(coffeeShopId),
                {
                    headers: {
                        Accept: '*/*',
                    },
                }
            );

            if (!menuResponse.ok) {
                if (menuResponse.status === 404) {
                    setError('No active menu found for this shop');
                } else {
                    throw new Error(`HTTP error! status: ${menuResponse.status}`);
                }
                return;
            }

            const menuData = await menuResponse.json();
            setMenuData(menuData);

            // Flatten all menu items from all groups
            const items: MenuItem[] = [];
            if (menuData.menuGroups && Array.isArray(menuData.menuGroups)) {
                menuData.menuGroups.forEach((group: MenuGroup) => {
                    if (group.menuItems && Array.isArray(group.menuItems)) {
                        items.push(...group.menuItems);
                    }
                });
            }
            setAllItems(items);

            // Fetch beverage sizes for this shop
            try {
                const sizes = await beverageSizeService.getByShop(coffeeShopId);
                // Filter only active sizes
                const activeSizes = sizes.filter(
                    (size: BeverageSize) => size.isActive === true || size.active === true
                );
                setBeverageSizes(activeSizes);
            } catch (sizeError) {
                console.error('[Daily Sales] Error fetching beverage sizes:', sizeError);
                // Continue without beverage sizes
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load menu';
            setError(errorMessage);
            console.error('[Daily Sales] Error:', errorMessage);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchMenu();
    }, [coffeeShopId]);

    const onRefresh = () => {
        setRefreshing(true);
        setLoading(true);
        fetchMenu();
    };

    const getFilteredItems = () => {
        if (selectedGroupId === null) {
            return allItems;
        }

        const group = menuData?.menuGroups.find((g) => g.menuGroupId === selectedGroupId);
        return group?.menuItems || [];
    };

    const getAvailableSizes = (): string[] => {
        if (beverageSizes.length > 0) {
            return beverageSizes.map(size => size.sizeName || size.name || '').filter(Boolean);
        }
        return ['S', 'M', 'L'];
    };

    const updateSalesQuantity = (menuItemId: number, sizeName: string, quantity: number) => {
        const item = allItems.find((i) => i.menuItemId === menuItemId);
        if (!item) return;

        const key = menuItemId;
        let current = salesData.get(key);

        if (!current) {
            // Initialize new sales item with all (current) beverage sizes
            current = {
                menuItemId,
                sizes: {},
                total: 0,
                item,
            };
            // Initialize all sizes with 0
            const allSizes = getAvailableSizes();
            allSizes.forEach((size) => {
                current!.sizes[size] = 0;
            });
        }

        // Ensure the size key exists
        if (!(sizeName in current.sizes)) {
            current.sizes[sizeName] = 0;
        }

        current.sizes[sizeName] = Math.max(0, quantity);
        current.total = Object.values(current.sizes).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);

        const newMap = new Map(salesData);
        if (current.total === 0) {
            newMap.delete(key);
        } else {
            newMap.set(key, current);
        }
        setSalesData(newMap);
    };

    const handleStartEdit = (menuItemId: number) => {
        setEditingItems((prev) => {
            if (prev.has(menuItemId)) return prev;
            const next = new Set(prev);
            next.add(menuItemId);
            return next;
        });

        setOriginalSalesData((prev) => {
            if (prev.has(menuItemId)) return prev;
            const existing = salesData.get(menuItemId);
            const clone = existing
                ? { ...existing, sizes: { ...existing.sizes } }
                : null;
            const next = new Map(prev);
            next.set(menuItemId, clone);
            return next;
        });
    };

    const handleCancelEdit = (menuItemId: number) => {
        setSalesData((prev) => {
            const next = new Map(prev);
            const original = originalSalesData.get(menuItemId);
            if (original) {
                next.set(menuItemId, { ...original, sizes: { ...original.sizes } });
            } else {
                next.delete(menuItemId);
            }
            return next;
        });

        setEditingItems((prev) => {
            const next = new Set(prev);
            next.delete(menuItemId);
            return next;
        });

        setOriginalSalesData((prev) => {
            const next = new Map(prev);
            next.delete(menuItemId);
            return next;
        });
    };

    const handleConfirmEdit = (menuItemId: number) => {
        setEditingItems((prev) => {
            const next = new Set(prev);
            next.delete(menuItemId);
            return next;
        });

        setOriginalSalesData((prev) => {
            const next = new Map(prev);
            next.delete(menuItemId);
            return next;
        });
    };

    const handleChangeDate = () => {
        setShowDatePicker(true);
    };

    const handleDatePickerChange = (event: any, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        if (date) {
            setSelectedDate(date);
        }
    };

    const handleSaveRecords = async () => {
        if (salesData.size === 0) {
            Toast.show({
                type: 'error',
                text1: 'No sales records',
                text2: 'Please enter at least one item',
            });
            return;
        }

        try {
            // Build request payload
            const menuItemList: Array<{
                menuItemId: number;
                saleDate: string;
                totalCups: number;
                beverageSizeId: number | undefined;
            }> = [];

            const isoDate = selectedDate.toISOString();

            // For each item in salesData
            salesData.forEach((sale) => {
                // For each size, create an entry
                beverageSizes.forEach((size) => {
                    const sizeKey = size.sizeName || size.name;
                    const quantity = sale.sizes[sizeKey || ''] || 0;

                    menuItemList.push({
                        menuItemId: sale.menuItemId,
                        saleDate: isoDate,
                        totalCups: quantity,
                        beverageSizeId: size.beverageSizeId || size.id,
                    });
                });
            });

            // Call API
            const response = await authorizedFetch(
                API_ENDPOINTS.dailySale.batch(),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: '*/*',
                    },
                    body: JSON.stringify({ menuItemList }),
                }
            );

            console.log('[Daily Sales] Payload sent:', { menuItemList });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Clear data and show success
            setSalesData(new Map());
            setEditingItems(new Set());
            setOriginalSalesData(new Map());

            Toast.show({
                type: 'success',
                text1: 'Sales records saved',
                text2: 'Records saved successfully',
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to save records';
            Toast.show({
                type: 'error',
                text1: 'Save failed',
                text2: errorMessage,
            });
            console.error('[Daily Sales] Save error:', errorMessage);
        }
    };

    const renderSalesItem = (item: MenuItem) => {
        const sale = salesData.get(item.menuItemId);
        const imageUrl = item.shopBeverage.imageUrl || fallbackMenuImage;
        const sizes = getAvailableSizes();
        const isEditing = editingItems.has(item.menuItemId);

        return (
            <View key={item.menuItemId} style={styles.salesItemCard}>
                <View style={styles.salesItemContent}>
                    {/* Image */}
                    <Image
                        source={{ uri: imageUrl }}
                        style={styles.salesItemImage}
                        defaultSource={{ uri: fallbackMenuImage }}
                    />

                    {/* Item Details */}
                    <View style={styles.salesItemDetails}>
                        <Text style={styles.salesItemName}>{item.shopRecipe.recipeName}</Text>

                        {/* Size Selector */}
                        <View style={styles.sizeSelector}>
                            {sizes.map((size) => (
                                <TouchableOpacity
                                    key={size}
                                    style={[
                                        styles.sizeButton,
                                        sale && sale.sizes[size] > 0 && styles.sizeButtonActive,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.sizeButtonText,
                                            sale && sale.sizes[size] > 0 && styles.sizeButtonTextActive,
                                        ]}
                                    >
                                        {size}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Quantity Input and Add Button */}
                    {isEditing ? (
                        <View style={styles.editActionSection}>
                            <TouchableOpacity
                                style={styles.cancelEditButton}
                                onPress={() => handleCancelEdit(item.menuItemId)}
                            >
                                <Ionicons name="close" size={18} color="#E94B3C" />
                            </TouchableOpacity>
                            <View style={styles.editQuantityDisplay}>
                                <Text style={styles.editQuantityText}>{(sale?.total || 0).toString()}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.confirmEditButton}
                                onPress={() => handleConfirmEdit(item.menuItemId)}
                            >
                                <Ionicons name="checkmark" size={20} color={COLORS.white} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.quantitySection}>
                            <TextInput
                                style={styles.quantityInput}
                                placeholder="0"
                                value={(sale?.total || 0).toString()}
                                editable={false}
                                keyboardType="numeric"
                            />
                            <TouchableOpacity
                                style={styles.addButton}
                                onPress={() => {
                                    // Start edit mode and increment the first size by default
                                    handleStartEdit(item.menuItemId);
                                    const firstSize = sizes[0] || 'S';
                                    updateSalesQuantity(
                                        item.menuItemId,
                                        firstSize,
                                        (sale?.sizes[firstSize] || 0) + 1
                                    );
                                }}
                            >
                                <Ionicons name="add" size={20} color={COLORS.white} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Size quantity inputs */}
                {sale && sale.total > 0 && (
                    <View style={styles.sizeQuantityRow}>
                        {sizes.map((size) => (
                            <View key={size} style={styles.sizeQuantityInput}>
                                <Text style={styles.sizeLabel}>{size}</Text>
                                <TextInput
                                    style={styles.quantitySmallInput}
                                    value={(sale?.sizes[size] || 0).toString()}
                                    onChangeText={(text) => {
                                        const quantity = parseInt(text) || 0;
                                        updateSalesQuantity(item.menuItemId, size, quantity);
                                    }}
                                    keyboardType="numeric"
                                    placeholder="0"
                                />
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                    <Text style={styles.loadingText}>Loading menu...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={28} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Daily Sales Input</Text>
                    <View style={{ width: 28 }} />
                </View>
                <View style={styles.centerContent}>
                    <Ionicons name="alert-circle" size={48} color={COLORS.accent} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const filteredItems = getFilteredItems();

    return (
        <>
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={28} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Daily Sales Input</Text>
                    <View style={{ width: 28 }} />
                </View>

                {/* Main Content ScrollView */}
                <ScrollView
                    style={styles.mainScroll}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[COLORS.accent]}
                            tintColor={COLORS.accent}
                        />
                    }
                >
                    {/* Date Picker */}
                    <View style={styles.dateSection}>
                        <Ionicons name="calendar" size={20} color={COLORS.accent} />
                        <View style={styles.dateInfo}>
                            <Text style={styles.dateLabel}>DATE</Text>
                            <Text style={styles.dateValue}>
                                {selectedDate.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: '2-digit',
                                    year: 'numeric',
                                })}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={handleChangeDate}>
                            <Text style={styles.changeButton}>Change</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Category Tabs */}
                    <View style={styles.categoryTabsWrapper}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.categoryTabsContent}
                        >
                            <TouchableOpacity
                                style={[
                                    styles.categoryTab,
                                    selectedGroupId === null && styles.categoryTabActive,
                                ]}
                                onPress={() => setSelectedGroupId(null)}
                            >
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.categoryTabText,
                                        selectedGroupId === null && styles.categoryTabTextActive,
                                    ]}
                                >
                                    All Items
                                </Text>
                            </TouchableOpacity>
                            {menuData?.menuGroups.map((group) => (
                                <TouchableOpacity
                                    key={group.menuGroupId}
                                    style={[
                                        styles.categoryTab,
                                        selectedGroupId === group.menuGroupId && styles.categoryTabActive,
                                    ]}
                                    onPress={() => setSelectedGroupId(group.menuGroupId)}
                                >
                                    <Text
                                        numberOfLines={1}
                                        style={[
                                            styles.categoryTabText,
                                            selectedGroupId === group.menuGroupId && styles.categoryTabTextActive,
                                        ]}
                                    >
                                        {group.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Items List */}
                    {filteredItems.length === 0 ? (
                        <View style={styles.emptyContent}>
                            <Ionicons name="list" size={48} color={COLORS.textSecondary} />
                            <Text style={styles.emptyTitle}>No items available</Text>
                            <Text style={styles.emptyText}>
                                No items found in this category
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.itemsContent}>
                            {filteredItems.map((item) => renderSalesItem(item))}
                        </View>
                    )}
                </ScrollView>

                {/* Total Revenue Footer */}
                {!showDatePicker && (
                    <View style={styles.footerContainer}>
                        {/* Save Button */}
                        <TouchableOpacity
                            style={[
                                styles.saveButton,
                                editingItems.size > 0 && styles.saveButtonDisabled,
                            ]}
                            onPress={() => {
                                if (editingItems.size > 0) return;
                                handleSaveRecords();
                            }}
                            activeOpacity={editingItems.size > 0 ? 1 : 0.8}
                            disabled={editingItems.size > 0}
                        >
                            <Text style={styles.saveButtonText}>Save Sales Records</Text>
                            <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Date Time Picker Modal - Outside SafeAreaView */}
            </SafeAreaView>

            {showDatePicker && (
                <Modal
                    visible={showDatePicker}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowDatePicker(false)}
                >
                    <View style={styles.datePickerContainer}>
                        <View style={styles.datePickerHeader}>
                            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                <Text style={styles.datePickerCancelBtn}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.datePickerTitle}>Select Date</Text>
                            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                <Text style={styles.datePickerConfirmBtn}>Done</Text>
                            </TouchableOpacity>
                        </View>
                        <DateTimePicker
                            value={selectedDate}
                            mode="date"
                            display="spinner"
                            onChange={handleDatePickerChange}
                            textColor={COLORS.text}
                        />
                    </View>
                </Modal>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    mainScroll: {
        flex: 1,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.text,
        fontStyle: 'italic',
    },
    dateSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
    },
    dateInfo: {
        flex: 1,
        marginLeft: 12,
    },
    dateLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    dateValue: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginTop: 4,
    },
    changeButton: {
        fontSize: 13,
        color: COLORS.accent,
        fontWeight: '600',
    },
    categoryTabsWrapper: {
        backgroundColor: COLORS.bg,
        paddingHorizontal: 0,
        marginHorizontal: 0,
    },
    categoryTabs: {
        marginTop: 0,
        marginBottom: 0,
    },
    categoryTabsContent: {
        paddingHorizontal: 16,
        gap: 8,
        paddingBottom: 12,
    },
    categoryTab: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryTabActive: {
        backgroundColor: COLORS.accentDark,
        borderColor: COLORS.accentDark,
    },
    categoryTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text,
    },
    categoryTabTextActive: {
        color: COLORS.white,
    },
    itemsContent: {
        paddingVertical: 0,
        paddingHorizontal: 0,
    },
    salesItemCard: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    salesItemContent: {
        flexDirection: 'row',
        padding: 12,
        alignItems: 'center',
    },
    salesItemImage: {
        width: 70,
        height: 70,
        borderRadius: 8,
        backgroundColor: '#E8CCBE',
    },
    salesItemDetails: {
        flex: 1,
        marginHorizontal: 12,
    },
    salesItemName: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 4,
    },
    sizeSelector: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    sizeButton: {
        minWidth: 36,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.white,
    },
    sizeButtonActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    sizeButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    sizeButtonTextActive: {
        color: COLORS.white,
    },
    quantitySection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    editActionSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cancelEditButton: {
        width: 32,
        height: 32,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E94B3C',
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editQuantityDisplay: {
        minWidth: 44,
        height: 32,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    editQuantityText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
    },
    confirmEditButton: {
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: COLORS.accentDark,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityInput: {
        width: 45,
        height: 40,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 6,
        backgroundColor: COLORS.accentDark,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sizeQuantityRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingBottom: 12,
        gap: 10,
    },
    sizeQuantityInput: {
        flex: 1,
        alignItems: 'center',
    },
    sizeLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    quantitySmallInput: {
        width: '80%',
        height: 32,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
        textAlign: 'center',
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text,
    },
    emptyContent: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
        marginTop: 12,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 8,
    },
    footerContainer: {
        backgroundColor: COLORS.white,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingBottom: 20,
    },
    saveButton: {
        flexDirection: 'row',
        backgroundColor: COLORS.accentDark,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.white,
    },
    loadingText: {
        fontSize: 16,
        color: COLORS.text,
        marginTop: 12,
    },
    errorText: {
        fontSize: 16,
        color: COLORS.text,
        textAlign: 'center',
        marginTop: 12,
        marginBottom: 20,
    },
    retryButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: COLORS.accent,
        borderRadius: 8,
    },
    retryButtonText: {
        color: COLORS.white,
        fontWeight: '600',
        fontSize: 14,
    },
    datePickerContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    datePickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    datePickerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
    },
    datePickerCancelBtn: {
        fontSize: 16,
        color: '#999',
        fontWeight: '500',
    },
    datePickerConfirmBtn: {
        fontSize: 16,
        color: COLORS.accent,
        fontWeight: '600',
    },
});
