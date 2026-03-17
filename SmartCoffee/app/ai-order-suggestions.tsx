import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Pressable,
  ImageBackground,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSuggestions } from '@/context/suggestion-context';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

type SupplierProductStockItem = {
  productId: number;
  stock?: number | null;
  holdStock?: number | null;
};

type SupplierProductListResponse = {
  items?: SupplierProductStockItem[];
};

export default function AIOrderSuggestionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const { items: suggestions, setItems } = useSuggestions();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [error] = useState<string | null>(() => (params.error ? String(params.error) : null));
  const [isReviewing, setIsReviewing] = useState(false);
  const [availableStockByProduct, setAvailableStockByProduct] = useState<Record<number, number>>({});

  const getItemLimit = (item: (typeof suggestions)[number]) => {
    if (typeof item.availableStock === 'number' && Number.isFinite(item.availableStock)) {
      return Math.max(0, Math.floor(item.availableStock));
    }

    const mapLimit = availableStockByProduct[item.productId];
    if (typeof mapLimit === 'number' && Number.isFinite(mapLimit)) {
      return Math.max(0, Math.floor(mapLimit));
    }

    return null;
  };

  useEffect(() => {
    let isCancelled = false;

    const loadLatestStock = async () => {
      try {
        const response = await authorizedFetch(API_ENDPOINTS.supplierProduct.list(), {
          headers: {
            Accept: '*/*',
          },
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as SupplierProductListResponse | SupplierProductStockItem[];
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : [];

        if (isCancelled) return;

        const nextMap: Record<number, number> = {};
        items.forEach((item) => {
          if (typeof item.productId !== 'number') return;
          const available = Math.max(0, Number(item.stock ?? 0) - Number(item.holdStock ?? 0));
          nextMap[item.productId] = available;
        });
        setAvailableStockByProduct(nextMap);

        setItems((prev) =>
          prev.map((item) => {
            const limit = nextMap[item.productId];
            if (typeof limit !== 'number') {
              return item;
            }

            const currentQty = Number.isFinite(item.qtyNeeded) && item.qtyNeeded > 0
              ? item.qtyNeeded
              : 1;

            return {
              ...item,
              availableStock: limit,
              qtyNeeded: limit > 0 ? Math.min(currentQty, limit) : currentQty,
            };
          })
        );
      } catch {
        // keep existing suggestion data as fallback
      }
    };

    loadLatestStock();

    return () => {
      isCancelled = true;
    };
  }, [setItems]);

  const filteredSuggestions = useMemo(() => {
    const source = suggestions;
    if (selectedFilter === 'All') {
      return source;
    }
    return source.filter((item) => {
      const supplierLabel = item.supplierName || 'Other suppliers';
      return supplierLabel === selectedFilter;
    });
  }, [selectedFilter, suggestions]);

  const categoryFilters = useMemo(() => {
    const set = new Set<string>();
    suggestions.forEach((item) => {
      const supplierLabel = item.supplierName || 'Other suppliers';
      set.add(supplierLabel);
    });
    return ['All', ...Array.from(set)];
  }, [suggestions]);

  const totalVnd = suggestions.reduce(
    (sum, item) => sum + item.priceVnd * (item.qtyNeeded > 0 ? item.qtyNeeded : 1),
    0
  );

  const formattedVnd = (value: number) =>
    value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

  const handlePurchase = () => {
    if (!suggestions.length) {
      return;
    }

    const invalidItems = suggestions.filter((item) => {
      const limit = getItemLimit(item);
      return limit !== null && (limit <= 0 || item.qtyNeeded > limit);
    });

    if (invalidItems.length > 0) {
      const details = invalidItems
        .slice(0, 5)
        .map((item) => {
          const limit = getItemLimit(item) ?? 0;
          return `${item.name}: max ${Math.max(0, limit)}`;
        })
        .join('\n');

      Alert.alert('Stock limit reached', `Please adjust quantity:\n${details}`);
      return;
    }

    router.push({
      pathname: '/checkout',
      params: {
        source: 'ai',
      },
    });
  };

  const handlePrimaryAction = () => {
    if (!isReviewing) {
      setIsReviewing(true);
      return;
    }

    handlePurchase();
  };

  const handleChangeQuantity = (id: string, delta: number) => {
    setItems((prev) => {
      const next = [] as typeof prev;
      prev.forEach((item) => {
        if (item.id !== id) {
          next.push(item);
          return;
        }

        const currentQty = Number.isFinite(item.qtyNeeded) && item.qtyNeeded > 0
          ? item.qtyNeeded
          : 1;
        const updatedQty = currentQty + delta;
        const limit = getItemLimit(item);

        if (delta > 0 && limit !== null && currentQty >= limit) {
          Alert.alert('Stock limit', `Maximum available quantity is ${limit}.`);
          next.push(item);
          return;
        }

        const safeQty =
          limit === null
            ? Math.max(1, updatedQty)
            : Math.max(1, Math.min(updatedQty, Math.max(1, limit)));

        next.push({ ...item, qtyNeeded: safeQty });
      });
      return next;
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const renderRightActions = (id: string) => (
    <View style={styles.swipeActionWrap}>
      <TouchableOpacity
        style={styles.swipeDeleteButton}
        onPress={() => handleRemoveItem(id)}
        activeOpacity={0.8}
      >
        <Ionicons name="trash" size={18} color="#FFF" />
        <Text style={styles.swipeDeleteText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <ImageBackground
        source={{
          uri: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200',
        }}
        style={styles.header}
        imageStyle={styles.headerImage}
      >
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Suggested List</Text>
        </View>
      </ImageBackground>

      {/* loading đã xử lý ở ai-loading, nên ở đây không cần overlay */}
      {false && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>AI is analyzing your inventory...</Text>
        </View>
      )}

      {/* Filters */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {categoryFilters.map((label) => {
            const isActive = selectedFilter === label;
            return (
              <Pressable
                key={label}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedFilter(label)}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {filteredSuggestions.map((item) => (
          <Swipeable
            key={item.id}
            renderRightActions={() => renderRightActions(item.id)}
            rightThreshold={32}
          >
            <View style={styles.itemCard}>
              <View style={styles.itemLeft}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                  <Text style={styles.itemPrice}>
                    {formattedVnd(item.priceVnd)} VND /
                    {item.packageSize ? ` ${item.packageSize}${item.measurement}` : ''}
                  </Text>
                  <Text style={styles.itemQty}>Qty needed: {item.qtyNeeded}</Text>
                  {typeof getItemLimit(item) === 'number' && (
                    <Text style={styles.itemQty}>Available: {getItemLimit(item)}</Text>
                  )}
                  <View style={styles.itemMetaRow}>
                    <View style={styles.itemMetaBadge}>
                      <Ionicons name="time-outline" size={12} color="#9B8B7B" />
                      <Text style={styles.itemMetaText}>{item.timeRange}</Text>
                    </View>
                    <View style={styles.itemMetaBadge}>
                      <Ionicons name="star" size={12} color="#D0A45C" />
                      <Text style={styles.itemMetaText}>
                        {item.productRating ? item.productRating.toFixed(1) : 'N/A'}
                      </Text>
                    </View>
                  </View>
                  {isReviewing && (
                    <View style={styles.quantityRow}>
                      <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() => handleChangeQuantity(item.id, -1)}
                      >
                        <Ionicons name="remove" size={16} color="#2C1B13" />
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{item.qtyNeeded}</Text>
                      <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() => handleChangeQuantity(item.id, 1)}
                      >
                        <Ionicons name="add" size={16} color="#2C1B13" />
                      </TouchableOpacity>

                    </View>
                  )}
                </View>
                <Image
                  source={{
                    uri:
                      item.image ||
                      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200',
                  }}
                  style={styles.itemImage}
                />
              </View>
            </View>
          </Swipeable>
        ))}

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        {isReviewing ? (
          <View style={styles.reviewSection}>
            <View style={styles.totalInfo}>
              <Text style={styles.selectedCount}>{suggestions.length} items</Text>
              <Text
                style={styles.selectedTotal}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {formattedVnd(totalVnd)} VND
              </Text>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  router.push({
                    pathname: '/product-page',
                    params: {
                      fromSuggestions: '1',
                    },
                  });
                }}
              >
                <Ionicons name="add" size={16} color="#2C1B13" />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.purchaseButton}
                onPress={handlePrimaryAction}
              >
                <Ionicons name="cart-outline" size={16} color="#FFF" />
                <Text style={styles.purchaseButtonText}>Purchase</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.totalInfo}>
              <Text style={styles.selectedCount}>{suggestions.length} items</Text>
              <Text
                style={styles.selectedTotal}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {formattedVnd(totalVnd)} VND
              </Text>
            </View>
            <TouchableOpacity
              style={styles.reviewButton}
              onPress={handlePrimaryAction}
            >
              <Text style={styles.reviewButtonText}>Review</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F2EE',
  },
  header: {
    height: 180,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerImage: {
    resizeMode: 'cover',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.2,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  filtersWrapper: {
    backgroundColor: '#F6F2EE',
    paddingVertical: 12,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EEE6DC',
  },
  filterChipActive: {
    backgroundColor: '#2C1B13',
    borderColor: '#2C1B13',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3E2A22',
  },
  filterTextActive: {
    color: '#FFF',
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  selectRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CFC2B6',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleActive: {
    backgroundColor: '#2C1B13',
    borderColor: '#2C1B13',
  },
  selectText: {
    fontSize: 13,
    color: '#8B7A6A',
  },
  filterIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 14,
  },
  errorBox: {
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F5B5B5',
  },
  errorText: {
    fontSize: 12,
    color: '#9B2C2C',
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1EAE2',
  },
  itemCardSelected: {
    borderColor: '#2C1B13',
  },
  itemLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  itemSelectCircle: {
    marginTop: 6,
  },
  itemSelectCircleInactive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CFC2B6',
    backgroundColor: '#FFF',
  },
  itemSelectCircleActive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2C1B13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C1B13',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#8B7A6A',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2C1B13',
    marginTop: 8,
  },
  itemQty: {
    fontSize: 12,
    color: '#8B7A6A',
    marginTop: 4,
  },
  itemMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  itemMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F6F2EE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  itemMetaText: {
    fontSize: 11,
    color: '#8B7A6A',
    fontWeight: '600',
  },
  itemImage: {
    width: 92,
    height: 92,
    borderRadius: 16,
    backgroundColor: '#EEE5DB',
  },
  bottomSpacer: {
    height: 90,
  },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  reviewSection: {
    flex: 1,
  },
  totalInfo: {
    flexShrink: 1,
    minWidth: 0,
    marginRight: 12,
  },
  selectedCount: {
    fontSize: 12,
    color: '#8B7A6A',
  },
  selectedTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C1B13',
    marginTop: 4,
  },
  reviewButton: {
    backgroundColor: '#2C1B13',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
  },
  reviewButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  addButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D9CFC5',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF',
  },
  addButtonText: {
    color: '#2C1B13',
    fontSize: 13,
    fontWeight: '700',
  },
  purchaseButton: {
    flex: 1,
    backgroundColor: '#2C1B13',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  purchaseButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  quantityRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2D7CD',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF4EA',
  },
  qtyValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#2C1B13',
  },
  removeButton: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECEC',
  },
  swipeActionWrap: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 8,
    marginLeft: 12,
  },
  swipeDeleteButton: {
    width: 100,
    height: 100,
    backgroundColor: '#B23B3B',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 12,
  },
  swipeDeleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
