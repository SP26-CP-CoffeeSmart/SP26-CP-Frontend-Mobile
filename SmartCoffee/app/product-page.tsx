import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Alert,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS, AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useSuggestions, SuggestionItem } from '@/context/suggestion-context';

const COLORS = {
  bg: '#F7F3EF',
  text: '#3C2A21',
  textSecondary: '#8E7B6F',
  border: '#E8E1D9',
  accent: '#D38B2A',
  white: '#FFFFFF',
  chip: '#F2E9E1',
  chipText: '#8B5E34',
  danger: '#B23B3B',
  shadow: '#000000',
};

const fallbackAssetUri =
  Image.resolveAssetSource(require('../assets/AI_RecommendationBackground.jpg')).uri;
const headerImage = fallbackAssetUri;
const fallbackProductImage = fallbackAssetUri;

interface SupplierProductApiItem {
  productId: number;
  supplierId: number;
  supplierName?: string | null;
  ingredientId: number;
  price: number;
  stock: number;
  holdStock?: number | null;
  status: string;
  createDate: string;
  rating?: number;
  measurement: string;
  // packageSize: khối lượng 1 túi (theo measurement)
  packageSize?: number | null;
  image?: string | null;
  description?: string | null;
  ingredient?: {
    ingredientId: number;
    name: string;
    category: string;
    image: string | null;
    createDate: string;
    endDate: string;
  };
}

interface SupplierProductListResponse {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: SupplierProductApiItem[];
}

type SuggestionInputMode = 'cups' | 'forecast';

const { width, height } = Dimensions.get('window');
const cardGap = 12;
const cardWidth = (width - 32 - cardGap) / 2;
const suggestionModalFixedHeight = Math.min(height * 0.65, 520);

export default function ProductPage() {
  const router = useRouter();
  const { coffeeShopId } = useAuth();
  const params = useLocalSearchParams<{ fromSuggestions?: string; existingIds?: string }>();
  const fromSuggestions =
    params.fromSuggestions === '1' || params.fromSuggestions === 'true';
  const { items: suggestionItems, addItems } = useSuggestions();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<SupplierProductApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedForSuggestion, setSelectedForSuggestion] = useState<SupplierProductApiItem[]>([]);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [showMenuActivationRequiredModal, setShowMenuActivationRequiredModal] = useState(false);
  const [numberCupWantedInput, setNumberCupWantedInput] = useState('');
  const [rangeDays, setRangeDays] = useState(3);
  const [suggestionInputMode, setSuggestionInputMode] = useState<SuggestionInputMode>('cups');
  const [suggestionSubmitting, setSuggestionSubmitting] = useState(false);
  const [checkingSuggestionGate, setCheckingSuggestionGate] = useState(false);
  const latestRequestId = useRef(0);

  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const PAGE_SIZE = 10;
  const MAX_FORECAST_DAYS = 90;
  const MIN_RANGE_DAYS = 3;
  const DEFAULT_RANGE_FOR_CUPS = 30;

  const toLocalIsoDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const todayIso = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return toLocalIsoDate(now);
  };

  const dynamicCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p?.ingredient?.category) {
        cats.add(p.ingredient.category);
      }
    });
    return Array.from(cats);
  }, [products]);

  const excludedIdsFromSuggestions = useMemo(() => {
    if (!fromSuggestions) return new Set<number>();
    const ids = suggestionItems
      .map((item) => item.productId)
      .filter((id) => Number.isFinite(id) && id > 0);
    return new Set<number>(ids);
  }, [fromSuggestions, suggestionItems]);

  const fetchProducts = async (
    currentPage: number,
    isLoadMore = false,
    nameFilter = ''
  ) => {
    const requestId = ++latestRequestId.current;

    try {
      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      const query = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
      });

      const normalizedName = nameFilter.trim();
      if (normalizedName) {
        query.set('name', normalizedName);
      }

      const response = await authorizedFetch(`${AUTH_BASE_URL}/SupplierProduct?${query.toString()}`, {
        headers: {
          Accept: '*/*',
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      if (requestId !== latestRequestId.current) {
        return;
      }

      const data = (await response.json()) as SupplierProductListResponse | SupplierProductApiItem[];
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : [];

      if (items.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      setProducts((prev) => {
        if (!isLoadMore) return items;
        const newItems = items.filter(
          (item: SupplierProductApiItem) => !prev.some((p) => p.productId === item.productId)
        );
        return [...prev, ...newItems];
      });
    } catch (fetchError) {
      if (requestId !== latestRequestId.current) {
        return;
      }
      setError('Failed to load supplier products.');
      setHasMore(false);
    } finally {
      if (requestId !== latestRequestId.current) {
        return;
      }
      if (isLoadMore) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchProducts(1, false, debouncedSearch);
  }, [debouncedSearch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setActiveCategory(null);
    setPage(1);
    setHasMore(true);
    await fetchProducts(1, false, debouncedSearch);
    setRefreshing(false);
  };

  const handleScroll = ({ nativeEvent }: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    // Increase threshold significantly to trigger fetch before reaching the absolute bottom
    const paddingToBottom = 600;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isCloseToBottom && !loading && !loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchProducts(nextPage, true, debouncedSearch);
    }
  };
  const filteredProducts = useMemo(() => {
    let result = products;

    if (activeCategory) {
      result = result.filter((item) => item?.ingredient?.category === activeCategory);
    }

    // Nếu đi từ suggestions sang thì loại bỏ các product
    // đã có trong suggestion list.
    if (fromSuggestions) {
      const excluded = new Set<number>();
      excludedIdsFromSuggestions.forEach((id) => excluded.add(id));

      result = result.filter((item) => !excluded.has(item.productId));
    }

    return result;
  }, [products, activeCategory, fromSuggestions, excludedIdsFromSuggestions]);

  const formatVnd = (value: number) =>
    value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

  const addDays = (baseDate: Date, days: number) => {
    const next = new Date(baseDate);
    next.setDate(next.getDate() + days);
    return next;
  };

  const toIsoDate = (date: Date) => toLocalIsoDate(date);

  const fromIso = todayIso();
  const fromDate = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, [showSuggestionModal]);
  const toDate = useMemo(() => addDays(fromDate, rangeDays), [fromDate, rangeDays]);
  const toIso = toIsoDate(toDate);

  const hasEnteredAllSuggestionFields =
    suggestionInputMode === 'cups'
      ? numberCupWantedInput.trim().length > 0
      : fromIso.length > 0 && toIso.length > 0;

  const validateSuggestionInputs = () => {
    if (suggestionInputMode === 'cups') {
      const numberCupWanted = Number(numberCupWantedInput.trim());
      if (!Number.isInteger(numberCupWanted) || numberCupWanted < 50) {
        return {
          valid: false,
          message: 'Estimated cup count must be an integer of at least 50 cups.',
        };
      }

      return {
        valid: true,
        params: {
          numberCupWanted,
        },
      } as const;
    }

    if (rangeDays < MIN_RANGE_DAYS) {
      return {
        valid: false,
        message: `The forecast range must be at least ${MIN_RANGE_DAYS} days.`,
      };
    }

    if (rangeDays > MAX_FORECAST_DAYS) {
      return {
        valid: false,
        message: 'Selected end date is outside the 90-day window.',
      };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const computedFrom = toIsoDate(now);
    const computedTo = toIsoDate(addDays(now, rangeDays));

    return {
      valid: true,
      params: {
        from: computedFrom,
        to: computedTo,
      },
    } as const;
  };

  const openSuggestionModal = () => {
    setNumberCupWantedInput('');
    setRangeDays(DEFAULT_RANGE_FOR_CUPS);
    setSuggestionInputMode('cups');
    setShowSuggestionModal(true);
  };

  const extractMenuArrayPayload = (payload: unknown): unknown[] => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') {
      const typed = payload as { data?: unknown; items?: unknown; result?: unknown };
      if (Array.isArray(typed.data)) return typed.data;
      if (Array.isArray(typed.items)) return typed.items;
      if (Array.isArray(typed.result)) return typed.result;
      return [payload];
    }
    return [];
  };

  const isExplicitActiveMenu = (raw: unknown) => {
    if (!raw || typeof raw !== 'object') return false;

    const obj = raw as {
      is_active?: unknown;
      isActive?: unknown;
      active?: unknown;
      isActived?: unknown;
      status?: unknown;
    };

    const activeFlag = obj.is_active ?? obj.isActive ?? obj.active ?? obj.isActived;
    if (typeof activeFlag === 'boolean') return activeFlag;
    if (typeof activeFlag === 'number') return activeFlag === 1;
    if (typeof activeFlag === 'string') {
      const normalized = activeFlag.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'active') return true;
      if (normalized === 'false' || normalized === '0' || normalized === 'inactive') return false;
    }

    if (typeof obj.status === 'string') {
      return obj.status.trim().toLowerCase() === 'active';
    }

    return false;
  };

  const canUseProductSuggestion = async () => {
    if (!coffeeShopId) {
      throw new Error('Coffee shop ID not found.');
    }

    const response = await authorizedFetch(API_ENDPOINTS.menu.getByShop(coffeeShopId), {
      method: 'GET',
      headers: {
        Accept: '*/*',
      },
    });

    if (response.status === 404) {
      return false;
    }

    if (!response.ok) {
      throw new Error(`Failed to verify active menu (${response.status}).`);
    }

    const payload = await response.json();
    const menuList = extractMenuArrayPayload(payload);
    const hasActiveMenu = menuList.some((menu) => isExplicitActiveMenu(menu));
    console.log('[Suggestion Gate] Menu by shop payload:', payload);
    console.log('[Suggestion Gate] Menu count:', menuList.length);
    console.log('[Suggestion Gate] Has active menu:', hasActiveMenu);
    return hasActiveMenu;
  };

  const handleSuggestionEntryPress = async () => {
    if (checkingSuggestionGate) return;

    try {
      setCheckingSuggestionGate(true);
      const canUse = await canUseProductSuggestion();
      if (!canUse) {
        setShowMenuActivationRequiredModal(true);
        return;
      }
      openSuggestionModal();
    } catch (entryError) {
      const message = entryError instanceof Error ? entryError.message : 'Unable to validate active menu.';
      Alert.alert('Product Suggestion', message);
    } finally {
      setCheckingSuggestionGate(false);
    }
  };

  const startAiSuggestions = () => {
    if (suggestionSubmitting) return;

    const validation = validateSuggestionInputs();
    if (!validation.valid) {
      Alert.alert('AI Product Suggestion', validation.message);
      return;
    }

    setSuggestionSubmitting(true);
    setShowSuggestionModal(false);

    router.push({
      pathname: '/ai-loading',
      params: {
        mode: 'order-suggestions',
        suggestionInputMode,
        ...(validation.valid && validation.params.numberCupWanted
          ? { numberCupWanted: String(validation.params.numberCupWanted) }
          : {}),
        ...(validation.valid && validation.params.from ? { from: validation.params.from } : {}),
        ...(validation.valid && validation.params.to ? { to: validation.params.to } : {}),
      },
    });

    setSuggestionSubmitting(false);
  };

  const canStartSuggestions = hasEnteredAllSuggestionFields && !suggestionSubmitting;

  const handleAddToSuggestedList = (item: SupplierProductApiItem) => {
    const name = item?.ingredient?.name ?? 'Unknown';
    const imageUrl = item?.image ?? item?.ingredient?.image ?? fallbackProductImage;

    const availableStock = Math.max(0, Number(item.stock ?? 0) - Number(item.holdStock ?? 0));

    const suggestion: SuggestionItem = {
      id: `extra-${item.productId}`,
      productId: item.productId,
      supplierId: item.supplierId,
      supplierName: item.supplierName ?? null,
      name,
      priceVnd: item.price,
      image: imageUrl,
      subtitle: item.description ?? '',
      qtyNeeded: 1,
      timeRange: 'Manual',
      productRating: typeof item.rating === 'number' ? item.rating : undefined,
      rating: 0,
      measurement: item.measurement || 'unit',
      packageSize: item.packageSize ?? null,
      availableStock,
    };

    addItems([suggestion]);

    Alert.alert('Added', `${name} has been added to the suggested list.`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.accent]}
            tintColor={COLORS.accent}
          />
        }
      >
        <View style={styles.header}>
          <Image source={{ uri: headerImage }} style={styles.headerImage} />
          <View style={styles.headerOverlay} />
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.headerBackButton}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => {
                if (fromSuggestions) {
                  router.back();
                } else {
                  router.push('/cart');
                }
              }}
            >
              <Ionicons
                name={fromSuggestions ? 'checkmark' : 'bag-outline'}
                size={20}
                color={COLORS.white}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={COLORS.textSecondary} />
          <TextInput
            placeholder="Hat Robusta"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.categoryRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            <TouchableOpacity
              style={[
                styles.categoryChip,
                activeCategory === null && { backgroundColor: COLORS.accent },
              ]}
              onPress={() => setActiveCategory(null)}
            >
              <Text
                style={[
                  styles.categoryText,
                  activeCategory === null && { color: COLORS.white },
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {dynamicCategories.map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.categoryChip,
                  activeCategory === item && { backgroundColor: COLORS.accent },
                ]}
                onPress={() => setActiveCategory(item)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    activeCategory === item && { color: COLORS.white },
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.suggestionBox}>
          <TouchableOpacity
            style={styles.suggestionTouchable}
            activeOpacity={0.85}
            onPress={handleSuggestionEntryPress}
            disabled={checkingSuggestionGate}
          >
            {checkingSuggestionGate ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <Ionicons name="sparkles" size={14} color={COLORS.text} />
            )}
            <Text style={styles.suggestionText}>
              Product Suggestion: Helping you make purchases quickly based on inventory analysis.
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {loading ? (
            <View style={styles.stateRow}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.stateText}>Loading products...</Text>
            </View>
          ) : error ? (
            <Text style={styles.stateText}>{error}</Text>
          ) : filteredProducts.length === 0 ? (
            <Text style={styles.stateText}>No products found</Text>
          ) : (
            filteredProducts.map((item, index) => {
              const name = item?.ingredient?.name ?? 'Unknown';
              const category = item?.ingredient?.category ?? 'Unknown';
              const imageUrl =
                item?.image ?? item?.ingredient?.image ?? fallbackProductImage;
              const description = String(item?.description ?? '').trim();
              const priceText = item.packageSize && item.measurement
                ? `${formatVnd(item.price)} VND/(${item.packageSize}${item.measurement})`
                : `${formatVnd(item.price)} VND/${item.measurement || 'unit'}`;
              const stockText =
                typeof item.stock === 'number' ? String(item.stock) : 'N/A';

              return (
                <View key={`${item.productId}-${index}`} style={styles.card}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() =>
                      router.push({
                        pathname: '/product-detail',
                        params: { productId: String(item.productId) },
                      })
                    }
                  >
                    <Image source={{ uri: imageUrl }} style={styles.cardImage} />
                    <Text style={styles.cardTitle}>{name}</Text>
                    <Text style={styles.cardDesc}>{category}</Text>
                    {description ? (
                      <Text style={styles.cardDesc} numberOfLines={1}>
                        {description}
                      </Text>
                    ) : null}
                    <Text style={styles.cardPrice}>{priceText}</Text>
                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Ionicons name="cube-outline" size={12} color={COLORS.textSecondary} />
                        <Text style={styles.metaText}>{stockText}</Text>
                      </View>
                      <View style={[styles.metaItem, styles.metaItemStatus]}>
                        <Ionicons name="checkmark-circle" size={12} color={COLORS.accent} />
                        <Text style={styles.metaText}>{item.status}</Text>
                      </View>
                      <View style={[styles.metaItem, styles.metaItemRating]}>
                        <Ionicons name="star" size={12} color={COLORS.accent} />
                        <Text style={styles.metaText}>
                          {typeof item.rating === 'number'
                            ? item.rating.toFixed(1)
                            : 'N/A'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.supplierLine}>
                      <Ionicons name="storefront-outline" size={12} color={COLORS.textSecondary} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {item.supplierName ?? `Supplier #${item.supplierId}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {fromSuggestions && (
                    <TouchableOpacity
                      style={styles.addSuggestedButton}
                      onPress={() => handleAddToSuggestedList(item)}
                    >
                      <Ionicons name="add" size={12} color={COLORS.text} />
                      <Text style={styles.addSuggestedButtonText}>
                        Add to suggested list
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        {loadingMore ? (
          <View style={styles.loadingMoreContainer}>
            <ActivityIndicator size="small" color={COLORS.accent} />
            <Text style={styles.loadingMoreText}>Loading more products...</Text>
          </View>
        ) : hasMore && !loading && filteredProducts.length > 0 ? (
          <View style={styles.loadingMoreContainer}>
            <Ionicons name="swap-vertical" size={14} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
            <Text style={styles.loadingMoreText}>Scroll down to load more</Text>
          </View>
        ) : !hasMore && filteredProducts.length > 0 ? (
          <View style={styles.loadingMoreContainer}>
            <Text style={[styles.loadingMoreText, { fontStyle: 'italic' }]}>End of products</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={showSuggestionModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowSuggestionModal(false)}
      >
        <View style={styles.suggestionModalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.suggestionModalKeyboardWrap}
          >
            <View style={styles.suggestionModalCard}>
              <View style={styles.suggestionModalTopSection}>
                <View style={styles.suggestionModalHeaderRow}>
                  <View>
                    <Text style={styles.suggestionModalTitle}>AI Product Suggestion</Text>
                    <Text style={styles.suggestionModalSubtitle}>
                      Enter your sales forecast so AI can recommend supplier products.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.suggestionModalCloseButton}
                    onPress={() => setShowSuggestionModal(false)}
                  >
                    <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.suggestionModalFieldGroup}>
                  <Text style={styles.suggestionModalLabel}>Choose Input Mode</Text>
                  <View style={styles.suggestionModeRow}>
                    <TouchableOpacity
                      style={[
                        styles.suggestionModeChip,
                        suggestionInputMode === 'cups' && styles.suggestionModeChipActive,
                      ]}
                      activeOpacity={0.85}
                      onPress={() => setSuggestionInputMode('cups')}
                    >
                      <Ionicons
                        name="cafe-outline"
                        size={14}
                        color={suggestionInputMode === 'cups' ? COLORS.white : COLORS.textSecondary}
                      />
                      <Text
                        style={[
                          styles.suggestionModeChipText,
                          suggestionInputMode === 'cups' && styles.suggestionModeChipTextActive,
                        ]}
                      >
                        Cups to Sell
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.suggestionModeChip,
                        suggestionInputMode === 'forecast' && styles.suggestionModeChipActive,
                      ]}
                      activeOpacity={0.85}
                      onPress={() => setSuggestionInputMode('forecast')}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color={suggestionInputMode === 'forecast' ? COLORS.white : COLORS.textSecondary}
                      />
                      <Text
                        style={[
                          styles.suggestionModeChipText,
                          suggestionInputMode === 'forecast' && styles.suggestionModeChipTextActive,
                        ]}
                      >
                        Forecast Duration
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View
                  style={[
                    styles.suggestionModalInputSlot,
                    suggestionInputMode === 'cups' && styles.suggestionModalInputSlotCups,
                  ]}
                >
                  {suggestionInputMode === 'cups' ? (
                    <View style={styles.suggestionModalFieldGroup}>
                      <Text style={styles.suggestionModalLabel}>Estimated Cups to Sell</Text>
                      <TextInput
                        style={styles.suggestionModalInput}
                        value={numberCupWantedInput}
                        onChangeText={(text) => setNumberCupWantedInput(text.replace(/[^0-9]/g, ''))}
                        placeholder="Example: 200"
                        placeholderTextColor={COLORS.textSecondary}
                        keyboardType="number-pad"
                        returnKeyType="done"
                      />
                      <Text style={styles.suggestionModalHintInline}>Minimum: 50 cups.</Text>
                    </View>
                  ) : (
                    <View style={styles.suggestionModalFieldGroup}>
                      <View style={styles.sliderHeaderRow}>
                        <Text style={styles.suggestionModalLabel}>Forecast Duration</Text>
                        <Text style={styles.sliderValueText}>{rangeDays} days</Text>
                      </View>
                      <Slider
                        minimumValue={MIN_RANGE_DAYS}
                        maximumValue={MAX_FORECAST_DAYS}
                        step={1}
                        minimumTrackTintColor={COLORS.accent}
                        maximumTrackTintColor={COLORS.border}
                        thumbTintColor={COLORS.accent}
                        value={rangeDays}
                        onValueChange={(value) => {
                          setRangeDays(Math.round(value));
                        }}
                      />
                      <View style={styles.sliderMetaRow}>
                        <Text style={styles.sliderMetaText}>Min: {MIN_RANGE_DAYS} days</Text>
                        <Text style={styles.sliderMetaText}>Max: {MAX_FORECAST_DAYS} days</Text>
                      </View>
                    </View>
                  )}
                </View>

                <View
                  style={[
                    styles.suggestionModalDateSlot,
                    suggestionInputMode === 'cups' && styles.suggestionModalDateSlotCups,
                  ]}
                >
                  {suggestionInputMode === 'forecast' ? (
                    <>
                      <View style={styles.suggestionModalDatePreview}>
                        <View style={styles.suggestionModalDatePreviewItem}>
                          <Text style={styles.suggestionModalDatePreviewLabel}>From</Text>
                          <Text style={styles.suggestionModalDatePreviewValue}>{fromIso}</Text>
                        </View>
                        <View style={styles.suggestionModalDatePreviewItem}>
                          <Text style={styles.suggestionModalDatePreviewLabel}>To</Text>
                          <Text style={styles.suggestionModalDatePreviewValue}>{toIso}</Text>
                        </View>
                      </View>

                      <Text style={styles.suggestionModalHint}>
                        From is always today's real-time date. To is auto-calculated from duration.
                      </Text>
                    </>
                  ) : (
                    <View style={styles.suggestionModalDateSpacer} />
                  )}
                </View>
              </View>

              <View style={styles.suggestionModalBottomSection}>
                <TouchableOpacity
                  style={[
                    styles.suggestionModalStartCircle,
                    !canStartSuggestions && styles.suggestionModalStartCircleDisabled,
                  ]}
                  onPress={startAiSuggestions}
                  disabled={!canStartSuggestions}
                  activeOpacity={0.85}
                >
                  {suggestionSubmitting ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={22} color={COLORS.white} />
                      <Text style={styles.suggestionModalStartText}>Start</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={styles.suggestionModalPendingText}>
                  {!hasEnteredAllSuggestionFields
                    ? 'Please complete all required fields to start.'
                    : suggestionInputMode === 'cups' && Number(numberCupWantedInput || '0') < 50
                      ? 'Estimated cups must be at least 50.'
                      : 'Ready to run AI suggestion.'}
                </Text>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={showMenuActivationRequiredModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowMenuActivationRequiredModal(false)}
      >
        <View style={styles.guardModalBackdrop}>
          <View style={styles.guardModalCard}>
            <View style={styles.guardModalIconWrap}>
              <Ionicons name="alert-circle-outline" size={30} color={COLORS.accent} />
            </View>
            <Text style={styles.guardModalTitle}>Active Menu Required</Text>
            <Text style={styles.guardModalSubtitle}>
              You need to activate a menu before using Product Suggestion.
            </Text>

            <View style={styles.guardModalActions}>
              <TouchableOpacity
                style={styles.guardModalCloseBtn}
                onPress={() => setShowMenuActivationRequiredModal(false)}
              >
                <Text style={styles.guardModalCloseBtnText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.guardModalPrimaryBtn}
                onPress={() => {
                  setShowMenuActivationRequiredModal(false);
                  router.push('/(tabs)/menu');
                }}
              >
                <Text style={styles.guardModalPrimaryBtnText}>Go to Menu List</Text>
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
    backgroundColor: COLORS.bg,
  },
  header: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    height: 160,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  headerRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  categoryChip: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  suggestionBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suggestionTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: cardGap,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  stateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  card: {
    width: cardWidth,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#E8CCBE',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardDesc: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cardPrice: {
    fontSize: 11,
    color: COLORS.danger,
    marginTop: 4,
    fontWeight: '700',
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    flexShrink: 1,
  },
  metaItemStatus: {
    marginLeft: 8,
  },
  metaItemRating: {
    marginLeft: 8,
  },
  supplierLine: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addSuggestedButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.chip,
  },
  addSuggestedButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.chipText,
  },
  loadingMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  suggestionModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(32, 23, 17, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  suggestionModalKeyboardWrap: {
    width: '100%',
  },
  suggestionModalCard: {
    backgroundColor: '#FFF9F4',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
    height: suggestionModalFixedHeight,
    borderWidth: 1,
    borderColor: '#EEDBCB',
    shadowColor: '#2D1708',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 8,
  },
  suggestionModalTopSection: {
    flex: 1,
  },
  suggestionModalBottomSection: {
    paddingTop: 8,
  },
  suggestionModalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  suggestionModalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  suggestionModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  suggestionModalSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    maxWidth: 250,
  },
  suggestionModalFieldGroup: {
    marginBottom: 12,
  },
  suggestionModalInputSlot: {
    minHeight: 0,
  },
  suggestionModalInputSlotCups: {
    minHeight: 118,
  },
  suggestionModalDateSlot: {
    minHeight: 0,
  },
  suggestionModalDateSlotCups: {
    minHeight: 132,
  },
  suggestionModalDateSpacer: {
    flex: 1,
  },
  suggestionModeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  suggestionModeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  suggestionModeChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  suggestionModeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  suggestionModeChipTextActive: {
    color: COLORS.white,
  },
  sliderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sliderMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  sliderValueText: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '700',
  },
  sliderMetaText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  suggestionModalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  suggestionModalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
  },
  suggestionModalHintInline: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  suggestionModalHint: {
    marginTop: 10,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  suggestionModalDatePreview: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 10,
  },
  suggestionModalDatePreviewItem: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionModalDatePreviewLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  suggestionModalDatePreviewValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '700',
  },
  suggestionModalStartCircle: {
    marginTop: 16,
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#7C4808',
    shadowOpacity: 0.36,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 8,
  },
  suggestionModalStartCircleDisabled: {
    opacity: 0.55,
  },
  suggestionModalStartText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  suggestionModalPendingText: {
    marginTop: 18,
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  guardModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(32, 23, 17, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  guardModalCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EEDBCB',
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#2D1708',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 8,
  },
  guardModalIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF6ED',
    marginBottom: 12,
    alignSelf: 'center',
  },
  guardModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  guardModalSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  guardModalActions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  guardModalCloseBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardModalCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  guardModalPrimaryBtn: {
    flex: 1.2,
    borderRadius: 12,
    backgroundColor: COLORS.text,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardModalPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
});
