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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AUTH_BASE_URL } from '@/services/api';
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

const { width } = Dimensions.get('window');
const cardGap = 12;
const cardWidth = (width - 32 - cardGap) / 2;

export default function ProductPage() {
  const router = useRouter();
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
  const latestRequestId = useRef(0);

  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const PAGE_SIZE = 10;

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

    Alert.alert('Đã thêm', `${name} đã được thêm vào danh sách gợi ý.`);
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
            onPress={() =>
              router.push({
                pathname: '/ai-loading',
                params: { mode: 'order-suggestions' },
              })
            }
          >
            <Ionicons name="sparkles" size={14} color={COLORS.text} />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
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
});
