import React, { useEffect, useRef, useState } from 'react';
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
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';

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

// Match the deep brown used in menu-staff dailySalesCard (#6B4423)
const DAILY_SALES_BROWN = '#6B4423';
const MAX_CUPS_PER_SIZE = 1000;
const NAME_WRAP_WIDTH = Math.floor(Dimensions.get('window').width * 0.4);

interface MenuItem {
    menuItemId: number;
    description: string | null;
    sellingPrice: number;
    addedDate: string;
    itemSizeViewModels?: ItemSize[];
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

interface ItemSize {
    itemSizeId: number;
    beverageSizeId: number;
    menuItemId: number;
    sellingPrice: number;
    beverageSize?: {
        beverageSizeId: number;
        sizeName?: string;
        volume?: number;
    };
}

interface SizeInfo {
    name: string;
    hasPrice: boolean;
    price?: number;
}

const fallbackMenuImage = 'https://via.placeholder.com/60';

const normalizeFirebaseUrl = (url?: string | null): string => {
    if (!url) return fallbackMenuImage;

    const trimmed = url.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
        return fallbackMenuImage;
    }

    if (!trimmed.includes('firebasestorage.googleapis.com')) {
        return trimmed;
    }

    try {
        const parsed = new URL(trimmed);
        const marker = '/o/';
        const markerIndex = parsed.pathname.indexOf(marker);

        if (markerIndex === -1) return trimmed;

        const objectPath = parsed.pathname.slice(markerIndex + marker.length);
        const decodedObjectPath = decodeURIComponent(objectPath);
        const normalizedObjectPath = decodedObjectPath
            .split('/')
            .filter(Boolean)
            .map((segment) => encodeURIComponent(segment))
            .join('%2F');

        parsed.pathname = `${parsed.pathname.slice(0, markerIndex + marker.length)}${normalizedObjectPath}`;
        return parsed.toString();
    } catch {
        return trimmed;
    }
};

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
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorModalMessage, setErrorModalMessage] = useState('');
    const lastQuantityValidationToastAtRef = useRef(0);

    const getTodayEnd = () => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return today;
    };

    const isFutureDate = (date: Date) => date.getTime() > getTodayEnd().getTime();

    const normalizeSizeName = (value?: string) => (value || '').trim().toUpperCase();

    const formatPrice = (value?: number) => {
        if (value == null) return '';
        try {
            return `${value.toLocaleString('vi-VN')} VND`;
        } catch {
            return `${value} VND`;
        }
    };

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

    const getAvailableSizes = (): string[] => {
        const fromItems = allItems
            .flatMap((item) => item.itemSizeViewModels || [])
            .map((sizeItem) => (sizeItem.beverageSize?.sizeName || '').trim())
            .filter((name) => !!name);

        if (fromItems.length > 0) {
            return Array.from(new Set(fromItems));
        }

        return ['S', 'M', 'L'];
    };

    const getSizeInfosForItem = (menuItemId: number): SizeInfo[] => {
        const sizeNames = getAvailableSizes();
        const currentItem = allItems.find((item) => item.menuItemId === menuItemId);
        const itemSizesForItem = currentItem?.itemSizeViewModels || [];

        return sizeNames.map((name) => {
            const trimmedName = name.trim();
            const normalizedName = normalizeSizeName(trimmedName);

            const matchByName = itemSizesForItem.find(
                (it) => normalizeSizeName(it.beverageSize?.sizeName) === normalizedName
            );

            return {
                name: trimmedName,
                hasPrice: !!matchByName,
                price: matchByName?.sellingPrice,
            };
        });
    };

    const calculateItemSubtotal = (
        sizeInfos: SizeInfo[],
        sale?: DailySalesItem
    ): number => {
        if (!sale) return 0;

        return sizeInfos.reduce((sum, sizeInfo) => {
            const quantity = sale.sizes[sizeInfo.name] || 0;
            const unitPrice = sizeInfo.price ?? 0;
            return sum + quantity * unitPrice;
        }, 0);
    };

    const updateSalesQuantity = (
        menuItemId: number,
        sizeName: string,
        quantity: number
    ) => {
        const item = allItems.find((i) => i.menuItemId === menuItemId);
        if (!item) return;

        const key = menuItemId;
        let current = salesData.get(key);

        if (!current) {
            current = {
                menuItemId,
                sizes: {},
                total: 0,
                item,
            };

            const allSizes = getAvailableSizes();
            allSizes.forEach((size) => {
                current!.sizes[size] = 0;
            });
        }

        if (!(sizeName in current.sizes)) {
            current.sizes[sizeName] = 0;
        }

        current.sizes[sizeName] = Math.min(MAX_CUPS_PER_SIZE, Math.max(0, quantity));
        current.total = Object.values(current.sizes).reduce(
            (sum, val) => sum + (typeof val === 'number' ? val : 0),
            0
        );

        const newMap = new Map(salesData);
        if (current.total === 0) {
            newMap.delete(key);
        } else {
            newMap.set(key, current);
        }
        setSalesData(newMap);
    };

    const handleQuantityInputChange = (
        menuItemId: number,
        sizeName: string,
        rawValue: string
    ) => {
        const trimmedValue = rawValue.trim();

        if (!trimmedValue) {
            updateSalesQuantity(menuItemId, sizeName, 0);
            return;
        }

        const showValidationToast = (message: string) => {
            const now = Date.now();
            // Throttle to avoid spamming the same toast while typing.
            if (now - lastQuantityValidationToastAtRef.current < 1200) return;
            lastQuantityValidationToastAtRef.current = now;
            Toast.show({
                type: 'error',
                text1: 'Invalid quantity',
                text2: message,
            });
        };

        if (trimmedValue.includes('-')) {
            showValidationToast('Quantity cannot be negative.');
            return;
        }

        if (!/^\d+$/.test(trimmedValue)) {
            showValidationToast('Please enter numbers only.');
            return;
        }

        const parsed = Number.parseInt(trimmedValue, 10);
        if (parsed > MAX_CUPS_PER_SIZE) {
            showValidationToast(`Quantity cannot exceed ${MAX_CUPS_PER_SIZE}.`);
            return;
        }
        updateSalesQuantity(menuItemId, sizeName, Number.isFinite(parsed) ? parsed : 0);
    };

    const calculateEstimatedTotals = () => {
        let totalCups = 0;
        let totalRevenue = 0;

        salesData.forEach((sale) => {
            const sizeInfos = getSizeInfosForItem(sale.menuItemId);

            Object.entries(sale.sizes).forEach(([sizeName, qty]) => {
                const quantity = typeof qty === 'number' ? qty : 0;
                if (quantity <= 0) return;

                const sizeInfo = sizeInfos.find(
                    (it) => normalizeSizeName(it.name) === normalizeSizeName(sizeName)
                );
                const price = sizeInfo?.price ?? 0;

                totalCups += quantity;
                totalRevenue += quantity * price;
            });
        });

        return { totalCups, totalRevenue };
    };

    const getFilteredItems = (): MenuItem[] => {
        if (selectedGroupId === null) {
            return allItems;
        }

        const group = menuData?.menuGroups.find(
            (g) => g.menuGroupId === selectedGroupId
        );
        return group?.menuItems || [];
    };

    const onRefresh = () => {
        setRefreshing(true);
        setLoading(true);
        fetchMenu();
    };

    const renderSalesItem = (item: MenuItem) => {
        const sale = salesData.get(item.menuItemId);
        const imageUrl = normalizeFirebaseUrl(
            item.shopRecipe?.image || item.shopBeverage.imageUrl
        );
        const sizeInfos = getSizeInfosForItem(item.menuItemId);
        const itemSubtotal = calculateItemSubtotal(sizeInfos, sale);

        return (
            <View key={item.menuItemId} style={styles.salesItemCard}>
                {/* Card header: image + title */}
                <View style={styles.salesItemHeader}>
                    <View style={styles.salesItemHeaderLeft}>
                        <Image
                            source={{ uri: imageUrl }}
                            style={styles.salesItemImage}
                            defaultSource={{ uri: fallbackMenuImage }}
                        />
                        <Text style={[styles.salesItemName, { maxWidth: NAME_WRAP_WIDTH }]} numberOfLines={2}>
                            {item.shopRecipe.recipeName}
                        </Text>
                    </View>
                    <View style={styles.itemSubtotalBlock}>
                        <Text style={styles.itemSubtotalLabel}>Subtotal</Text>
                        <Text style={styles.itemSubtotalValue}>
                            {formatPrice(itemSubtotal)}
                        </Text>
                    </View>
                </View>

                {/* Size rows: follow web UI - each size with - qty + */}
                <View style={styles.sizeQuantityRow}>
                    {sizeInfos.map((size: SizeInfo, index: number) => {
                        const isDisabled = !size.hasPrice;
                        const quantity = sale?.sizes[size.name] || 0;

                        return (
                            <View
                                key={size.name}
                                style={[
                                    styles.sizeQuantityInput,
                                    index > 0 && styles.sizeQuantityInputDivider,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.sizeLabel,
                                        (!size.hasPrice || quantity === 0) &&
                                        styles.sizeLabelMuted,
                                    ]}
                                >
                                    {size.name}
                                    {size.hasPrice
                                        ? ` • ${formatPrice(size.price)}`
                                        : ' • Chưa có giá'}
                                </Text>
                                <View style={styles.sizeQuantityControls}>
                                    <TouchableOpacity
                                        style={[
                                            styles.sizeStepperButton,
                                            styles.sizeStepperMinus,
                                            (isDisabled || quantity <= 0) &&
                                            styles.sizeStepperButtonDisabled,
                                        ]}
                                        disabled={isDisabled || quantity <= 0}
                                        onPress={() =>
                                            updateSalesQuantity(
                                                item.menuItemId,
                                                size.name,
                                                Math.max(0, quantity - 1)
                                            )
                                        }
                                    >
                                        <Ionicons
                                            name="remove"
                                            size={18}
                                            color={COLORS.accentDark}
                                        />
                                    </TouchableOpacity>
                                    <TextInput
                                        style={[
                                            styles.sizeQuantityInputField,
                                            (!size.hasPrice || quantity === 0) &&
                                            styles.sizeQuantityValueMuted,
                                        ]}
                                        value={String(quantity)}
                                        keyboardType="number-pad"
                                        editable={!isDisabled}
                                        selectTextOnFocus={!isDisabled}
                                        maxLength={4}
                                        onChangeText={(value) =>
                                            handleQuantityInputChange(item.menuItemId, size.name, value)
                                        }
                                    />
                                    <TouchableOpacity
                                        style={[
                                            styles.sizeStepperButton,
                                            styles.sizeStepperPlus,
                                            isDisabled && styles.sizeStepperButtonDisabled,
                                        ]}
                                        disabled={isDisabled}
                                        onPress={() =>
                                            updateSalesQuantity(
                                                item.menuItemId,
                                                size.name,
                                                quantity + 1
                                            )
                                        }
                                    >
                                        <Ionicons
                                            name="add"
                                            size={18}
                                            color={COLORS.white}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    };

    const handleChangeDate = () => {
        setShowDatePicker(true);
    };

    const handleDatePickerChange = (event: any, date?: Date) => {
        if (date) {
            if (isFutureDate(date)) {
                Toast.show({
                    type: 'error',
                    text1: 'Invalid date',
                    text2: 'Cannot select a date later than today',
                });
                setSelectedDate(getTodayEnd());
                return;
            }
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

        if (isFutureDate(selectedDate)) {
            Toast.show({
                type: 'error',
                text1: 'Invalid date',
                text2: 'Daily sales date cannot be in the future',
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
                const itemSizes = sale.item.itemSizeViewModels || [];

                // For each size from itemSizeViewModels, create an entry
                itemSizes.forEach((sizeItem) => {
                    const sizeKey = sizeItem.beverageSize?.sizeName || '';
                    const matchingSizeEntry = Object.entries(sale.sizes).find(
                        ([name]) => normalizeSizeName(name) === normalizeSizeName(sizeKey)
                    );
                    const quantity = matchingSizeEntry?.[1] || 0;

                    if (quantity > 0) {
                        menuItemList.push({
                            menuItemId: sale.menuItemId,
                            saleDate: isoDate,
                            totalCups: quantity,
                            beverageSizeId: sizeItem.beverageSizeId,
                        });
                    }
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
                let responseBody = '';
                try {
                    responseBody = await response.text();
                } catch (readError) {
                    console.log('[Daily Sales] Failed to read error response:', readError);
                }
                console.log('[Daily Sales] Save response status:', response.status);
                console.log('[Daily Sales] Save response body:', responseBody);
                let backendMessage = '';
                if (responseBody) {
                    try {
                        const parsed = JSON.parse(responseBody);
                        if (typeof parsed === 'string') {
                            backendMessage = parsed;
                        } else if (Array.isArray(parsed)) {
                            backendMessage = parsed.filter(Boolean).join(', ');
                        } else {
                            backendMessage =
                                parsed?.message ||
                                parsed?.error ||
                                parsed?.detail ||
                                parsed?.title ||
                                '';
                        }
                    } catch {
                        backendMessage = responseBody;
                    }
                }

                const fallbackMessage = responseBody.trim() || backendMessage.trim();
                setErrorModalMessage(
                    fallbackMessage || `HTTP error! status: ${response.status}`
                );
                setShowErrorModal(true);
                return;
            }

            // Clear data and show success
            setSalesData(new Map());

            Toast.show({
                type: 'success',
                text1: 'Sales records saved',
                text2: 'Records saved successfully',
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to save records';
            setErrorModalMessage(errorMessage);
            setShowErrorModal(true);
            console.log('[Daily Sales] Save error:', errorMessage);
        }
    };

    // (legacy renderSalesItem implementation removed - using the new UI version above)

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
    const { totalCups, totalRevenue } = calculateEstimatedTotals();

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
                            {filteredItems.map((item: MenuItem) => renderSalesItem(item))}
                        </View>
                    )}
                </ScrollView>

                {/* Total Revenue Footer */}
                {!showDatePicker && (
                    <View style={styles.footerContainer}>
                        <View style={styles.summaryRow}>
                            <View>
                                <Text style={styles.summaryLabel}>Estimated total cups</Text>
                                <Text style={styles.summaryValue}>{totalCups}</Text>
                            </View>
                            <View style={{ flex: 1 }} />
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.summaryLabel}>Estimated revenue</Text>
                                <Text style={styles.summaryValue}>{formatPrice(totalRevenue)}</Text>
                            </View>
                        </View>

                        {/* Save Button */}
                        <TouchableOpacity
                            style={[
                                styles.saveButton,
                                salesData.size === 0 && styles.saveButtonDisabled,
                            ]}
                            onPress={() => {
                                if (salesData.size === 0) return;
                                handleSaveRecords();
                            }}
                            activeOpacity={salesData.size === 0 ? 1 : 0.8}
                            disabled={salesData.size === 0}
                        >
                            <Text style={styles.saveButtonText}>Save Sales Records</Text>
                            <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Date Time Picker Modal - Outside SafeAreaView */}
            </SafeAreaView>

            <Modal
                transparent
                visible={showErrorModal}
                animationType="fade"
                onRequestClose={() => setShowErrorModal(false)}
            >
                <View style={styles.errorModalBackdrop}>
                    <View style={styles.errorModalCard}>
                        <View style={styles.errorModalIconWrap}>
                            <Ionicons name="alert-circle-outline" size={28} color={COLORS.accent} />
                        </View>
                        <Text style={styles.errorModalTitle}>Save failed</Text>
                        <Text style={styles.errorModalMessage}>{errorModalMessage}</Text>
                        <TouchableOpacity
                            style={styles.errorModalButton}
                            onPress={() => setShowErrorModal(false)}
                        >
                            <Text style={styles.errorModalButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {showDatePicker && (
                <Modal
                    visible={showDatePicker}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowDatePicker(false)}
                >
                    <View style={styles.datePickerContainer}>
                        <View style={styles.datePickerSheet}>
                            <View style={styles.datePickerHeader}>
                                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                    <Text style={styles.datePickerCancelBtn}>Cancel</Text>
                                </TouchableOpacity>
                                <Text style={styles.datePickerTitle}>Select Date</Text>
                                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                    <Text style={styles.datePickerConfirmBtn}>Done</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.datePickerBody}>
                                <DateTimePicker
                                    value={selectedDate}
                                    mode="date"
                                    display="spinner"
                                    onChange={handleDatePickerChange}
                                    maximumDate={getTodayEnd()}
                                    textColor={COLORS.text}
                                />
                            </View>
                        </View>
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
        color: DAILY_SALES_BROWN,
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
        color: DAILY_SALES_BROWN,
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
        backgroundColor: DAILY_SALES_BROWN,
        borderColor: DAILY_SALES_BROWN,
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
        borderWidth: 1,
        borderColor: COLORS.border,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
    },
    salesItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#F5F2EE',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    salesItemHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    salesItemImage: {
        width: 50,
        height: 50,
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
    itemSubtotalBlock: {
        alignItems: 'flex-end',
        marginLeft: 10,
    },
    itemSubtotalLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: COLORS.textSecondary,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    itemSubtotalValue: {
        marginTop: 4,
        fontSize: 14,
        fontWeight: '700',
        color: DAILY_SALES_BROWN,
    },
    // legacy quantity / size selector styles removed in favor of new per-size controls
    sizeQuantityRow: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 4,
    },
    sizeQuantityInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sizeQuantityInputDivider: {
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: 8,
        marginTop: 4,
    },
    sizeLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    sizeLabelMuted: {
        color: '#B0A79F',
    },
    sizeQuantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    sizeStepperButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.white,
    },
    sizeStepperMinus: {
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    sizeStepperPlus: {
        backgroundColor: DAILY_SALES_BROWN,
    },
    sizeStepperButtonDisabled: {
        opacity: 0.4,
    },
    sizeQuantityValue: {
        minWidth: 28,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
    },
    sizeQuantityInputField: {
        minWidth: 46,
        height: 36,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        backgroundColor: COLORS.white,
        paddingHorizontal: 6,
        paddingVertical: 0,
    },
    sizeQuantityValueMuted: {
        color: '#C2BAB2',
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
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    summaryLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    summaryValue: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
        marginTop: 4,
    },
    saveButton: {
        flexDirection: 'row',
        backgroundColor: DAILY_SALES_BROWN,
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
    datePickerSheet: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
        paddingBottom: 24,
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
    datePickerBody: {
        backgroundColor: COLORS.white,
        paddingBottom: 8,
    },
    datePickerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: DAILY_SALES_BROWN,
    },
    datePickerCancelBtn: {
        fontSize: 16,
        color: '#999',
        fontWeight: '500',
    },
    datePickerConfirmBtn: {
        fontSize: 16,
        color: DAILY_SALES_BROWN,
        fontWeight: '600',
    },
    errorModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    errorModalCard: {
        width: '100%',
        backgroundColor: COLORS.white,
        borderRadius: 16,
        paddingHorizontal: 18,
        paddingVertical: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    errorModalIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#FFF3E6',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 12,
    },
    errorModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: 8,
    },
    errorModalMessage: {
        fontSize: 13,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
    },
    errorModalButton: {
        marginTop: 16,
        backgroundColor: DAILY_SALES_BROWN,
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
    },
    errorModalButtonText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '600',
    },
});
