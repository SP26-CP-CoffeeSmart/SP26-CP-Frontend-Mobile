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
  TextInput,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useSuggestions } from '@/context/suggestion-context';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

const recommendationBgImage = require('../assets/AI_RecommendationBackground.jpg');
const recommendationBgUri = Image.resolveAssetSource(recommendationBgImage).uri;

type SupplierProductStockItem = {
  productId: number;
  stock?: number | null;
  holdStock?: number | null;
  availableStock?: number | null;
};

export default function AIOrderSuggestionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const { items: suggestions, setItems } = useSuggestions();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [error] = useState<string | null>(() => (params.error ? String(params.error) : null));
  const [isReviewing, setIsReviewing] = useState(false);
  const [availableStockByProduct, setAvailableStockByProduct] = useState<Record<number, number>>({});
  const [reviewQtyById, setReviewQtyById] = useState<Record<string, number>>({});
  const [reviewQtyInputById, setReviewQtyInputById] = useState<Record<string, string>>({});
  const [reviewQtyErrorById, setReviewQtyErrorById] = useState<Record<string, string>>({});
  const suggestionProductIds = useMemo(
    () =>
      Array.from(
        new Set(
          suggestions
            .map((item) => item.productId)
            .filter((productId) => typeof productId === 'number')
        )
      ),
    [suggestions]
  );

  const convertSuggestedQuantity = (
    rawQty: number | null | undefined,
    measurement: string | null | undefined
  ): { value: number; unit: string } | null => {
    if (rawQty == null || !Number.isFinite(rawQty)) return null;
    const m = (measurement ?? '').trim().toLowerCase();
    // API already returns suggestedQuantity in base units (ml/g).
    // We only convert the unit label: l→ml, kg→g.
    if (m === 'l' || m === 'liter' || m === 'litre') {
      return { value: Math.round(rawQty), unit: 'ml' };
    }
    if (m === 'kg' || m === 'kilogram') {
      return { value: Math.round(rawQty), unit: 'g' };
    }
    if (m === 'ml' || m === 'milliliter') {
      return { value: Math.round(rawQty), unit: 'ml' };
    }
    // gram, g, or anything else → treat as grams
    return { value: Math.round(rawQty), unit: 'g' };
  };

  const convertPackageSize = (
    size: number | null | undefined,
    measurement: string | null | undefined
  ): { value: number; unit: string } | null => {
    if (size == null || !Number.isFinite(size)) return null;
    const m = (measurement ?? '').trim().toLowerCase();
    // packageSize needs actual conversion: 1l = 1000ml, 1kg = 1000g
    if (m === 'l' || m === 'liter' || m === 'litre') {
      return { value: Math.round(size * 1000), unit: 'ml' };
    }
    if (m === 'kg' || m === 'kilogram') {
      return { value: Math.round(size * 1000), unit: 'g' };
    }
    if (m === 'ml' || m === 'milliliter') {
      return { value: Math.round(size), unit: 'ml' };
    }
    // gram, g, or anything else → treat as grams
    return { value: Math.round(size), unit: 'g' };
  };

  // Calculate actual cost for an item:
  // cost = (suggestedQuantityInBaseUnits / packageSizeInBaseUnits) * priceVnd * reviewQty
  const calcItemPrice = (item: (typeof suggestions)[number]): number => {
    const pkgBase = (() => {
      const s = item.packageSize;
      if (s == null || !Number.isFinite(s)) return null;
      const m = (item.measurement ?? '').trim().toLowerCase();
      if (m === 'l' || m === 'liter' || m === 'litre') return s * 1000;
      if (m === 'kg' || m === 'kilogram') return s * 1000;
      return s; // ml, gram, g, etc.
    })();

    const sqBase = (() => {
      const q = item.suggestedQuantity;
      if (q == null || !Number.isFinite(q)) return null;
      return q; // API already returns in base unit (ml/g)
    })();

    if (pkgBase && pkgBase > 0 && sqBase != null) {
      const reviewQty = isReviewing ? getSafeQtyAllowZero(reviewQtyById[item.id]) : 1;
      return (sqBase / pkgBase) * item.priceVnd * reviewQty;
    }

    // fallback: priceVnd * reviewQty (package-level)
    const reviewQty = isReviewing ? getSafeQtyAllowZero(reviewQtyById[item.id]) : 1;
    return item.priceVnd * reviewQty;
  };

  const suggestionIdsKey = useMemo(() => suggestionProductIds.join(','), [suggestionProductIds]);

  const getSafeQty = (rawQty: unknown) => {
    const num =
      typeof rawQty === 'number'
        ? rawQty
        : typeof rawQty === 'string'
          ? parseFloat(rawQty)
          : NaN;

    if (!Number.isFinite(num) || num <= 0) {
      return 1;
    }

    const rounded = Math.round(num);
    return rounded > 0 ? rounded : 1;
  };
  const getSafeQtyAllowZero = (rawQty: unknown) => {
    const num =
      typeof rawQty === 'number'
        ? rawQty
        : typeof rawQty === 'string'
          ? parseFloat(rawQty)
          : NaN;

    if (!Number.isFinite(num) || num < 0) {
      return 0;
    }

    const rounded = Math.round(num);
    return rounded >= 0 ? rounded : 0;
  };

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
      if (suggestionProductIds.length === 0) {
        setAvailableStockByProduct({});
        return;
      }

      try {
        const response = await authorizedFetch(API_ENDPOINTS.supplierProduct.checkAvailableStock(), {
          method: 'POST',
          headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(suggestionProductIds),
        });

        if (!response.ok) {
          return;
        }

        const items = await response.json() as SupplierProductStockItem[];

        if (isCancelled) return;

        const nextMap: Record<number, number> = {};
        items.forEach((item) => {
          if (typeof item.productId !== 'number') return;
          const available = Math.max(
            0,
            Number(item.availableStock ?? Number(item.stock ?? 0) - Number(item.holdStock ?? 0))
          );
          nextMap[item.productId] = available;
        });
        setAvailableStockByProduct(nextMap);

        setItems((prev) =>
          prev.map((item) => {
            const limit = nextMap[item.productId];
            if (typeof limit !== 'number') {
              return item;
            }

            const currentQty = getSafeQty(item.qtyNeeded);
            const nextQty = limit > 0 ? Math.min(currentQty, limit) : 0;
            return {
              ...item,
              availableStock: limit,
              qtyNeeded: nextQty,
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
  }, [setItems, suggestionIdsKey, suggestionProductIds]);

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

  const getDisplayQty = (item: (typeof suggestions)[number]) => {
    if (isReviewing) {
      const reviewQty = reviewQtyById[item.id];
      return getSafeQtyAllowZero(reviewQty);
    }
    return getSafeQty(item.qtyNeeded);
  };

  const totalVnd = suggestions.reduce(
    (sum, item) => {
      return sum + calcItemPrice(item);
    },
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
      const qty = getDisplayQty(item);
      if (qty <= 0) return true;
      return limit !== null && (limit <= 0 || qty > limit);
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

    if (isReviewing) {
      setItems((prev) =>
        prev.map((item) => {
          const limit = getItemLimit(item);
          const reviewedQty = getSafeQtyAllowZero(reviewQtyById[item.id]);
          const safeQty =
            limit === null
              ? reviewedQty
              : Math.max(0, Math.min(reviewedQty, Math.max(0, limit)));
          return {
            ...item,
            qtyNeeded: safeQty,
          };
        })
      );
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
      const nextReviewQtyById: Record<string, number> = {};
      const nextReviewQtyInputById: Record<string, string> = {};
      const nextReviewQtyErrorById: Record<string, string> = {};
      suggestions.forEach((item) => {
        const limit = getItemLimit(item);
        const initialQty = limit !== null && limit <= 0 ? 0 : 1;
        nextReviewQtyById[item.id] = initialQty;
        nextReviewQtyInputById[item.id] = String(initialQty);
        if (limit !== null && limit <= 0) {
          nextReviewQtyErrorById[item.id] = 'Out of stock.';
        }
      });
      setReviewQtyById(nextReviewQtyById);
      setReviewQtyInputById(nextReviewQtyInputById);
      setReviewQtyErrorById(nextReviewQtyErrorById);
      setIsReviewing(true);
      return;
    }

    handlePurchase();
  };

  const handleChangeQuantity = (id: string, delta: number) => {
    const targetItem = suggestions.find((item) => item.id === id);
    if (!targetItem) return;

    setReviewQtyById((prev) => {
      const currentQty = getSafeQtyAllowZero(prev[id]);
      const updatedQty = currentQty + delta;
      const limit = getItemLimit(targetItem);

      if (limit !== null && limit <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Out of stock',
          text2: 'This item is currently unavailable.',
        });
        setReviewQtyInputById((current) => ({ ...current, [id]: '0' }));
        setReviewQtyErrorById((current) => ({ ...current, [id]: 'Out of stock.' }));
        return {
          ...prev,
          [id]: 0,
        };
      }

      if (delta > 0 && limit !== null && currentQty >= limit) {
        Toast.show({
          type: 'info',
          text1: 'Stock limit',
          text2: `Maximum available quantity is ${limit}.`,
        });
        return prev;
      }

      const safeQty = (() => {
        const base =
          limit === null
            ? Math.max(1, updatedQty)
            : Math.max(1, Math.min(updatedQty, limit));
        const rounded = Math.round(base);
        return rounded > 0 ? rounded : 1;
      })();

      return {
        ...prev,
        [id]: safeQty,
      };
    });
    setReviewQtyInputById((current) => {
      const currentValue = getSafeQtyAllowZero(current[id]);
      const target = Math.max(0, currentValue + delta);
      const limit = getItemLimit(targetItem);
      const next =
        limit === null ? Math.max(1, target) : Math.max(1, Math.min(target, Math.max(1, limit)));
      return { ...current, [id]: String(next) };
    });
    setReviewQtyErrorById((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const handleReviewQtyInputChange = (id: string, rawValue: string) => {
    const targetItem = suggestions.find((item) => item.id === id);
    if (!targetItem) return;

    const limit = getItemLimit(targetItem);
    const normalized = rawValue.replace(/[^0-9]/g, '');
    setReviewQtyInputById((prev) => ({ ...prev, [id]: normalized }));

    if (limit !== null && limit <= 0) {
      setReviewQtyById((prev) => ({ ...prev, [id]: 0 }));
      setReviewQtyErrorById((prev) => ({ ...prev, [id]: 'Out of stock.' }));
      return;
    }

    if (!normalized) {
      setReviewQtyById((prev) => ({ ...prev, [id]: 0 }));
      setReviewQtyErrorById((prev) => ({ ...prev, [id]: 'Quantity must be numeric and greater than 0.' }));
      return;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setReviewQtyById((prev) => ({ ...prev, [id]: 0 }));
      setReviewQtyErrorById((prev) => ({ ...prev, [id]: 'Quantity must be greater than 0.' }));
      return;
    }

    const clamped = limit === null ? parsed : Math.min(parsed, limit);
    if (limit !== null && parsed > limit) {
      Toast.show({
        type: 'info',
        text1: 'Stock limit',
        text2: `Maximum available quantity is ${limit}.`,
      });
      setReviewQtyErrorById((prev) => ({
        ...prev,
        [id]: `Maximum available quantity is ${limit}.`,
      }));
    } else {
      setReviewQtyErrorById((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }

    setReviewQtyById((prev) => ({ ...prev, [id]: clamped }));
    setReviewQtyInputById((prev) => ({ ...prev, [id]: String(clamped) }));
  };

  const handleReviewQtyInputBlur = (id: string) => {
    const targetItem = suggestions.find((item) => item.id === id);
    if (!targetItem) return;

    const limit = getItemLimit(targetItem);
    if (limit !== null && limit <= 0) {
      setReviewQtyById((prev) => ({ ...prev, [id]: 0 }));
      setReviewQtyInputById((prev) => ({ ...prev, [id]: '0' }));
      setReviewQtyErrorById((prev) => ({ ...prev, [id]: 'Out of stock.' }));
      return;
    }

    const raw = reviewQtyInputById[id] ?? '';
    const parsed = Number(raw);
    const normalized = Number.isFinite(parsed) ? parsed : 0;
    const safeQty = Math.max(1, limit === null ? normalized : Math.min(normalized, limit));
    setReviewQtyById((prev) => ({ ...prev, [id]: safeQty }));
    setReviewQtyInputById((prev) => ({ ...prev, [id]: String(safeQty) }));
    setReviewQtyErrorById((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setReviewQtyById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
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
        source={recommendationBgImage}
        style={styles.header}
        imageStyle={styles.headerImage}
      >
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => {
              if (isReviewing) {
                setIsReviewing(false);
              } else {
                router.back();
              }
            }}
            style={styles.backButton}
          >
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

        {filteredSuggestions.map((item) => {
          const card = (
            <View style={styles.itemCard}>
              <View style={styles.itemLeft}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                  <Text style={styles.itemPrice}>
                    {formattedVnd(item.priceVnd)} VND /
                    {(() => {
                      const pkg = convertPackageSize(item.packageSize, item.measurement);
                      if (pkg) return ` ${formattedVnd(pkg.value)}${pkg.unit}`;
                      return item.packageSize ? ` ${item.packageSize}${item.measurement}` : '';
                    })()}
                  </Text>
                  {(() => {
                    const converted = convertSuggestedQuantity(item.suggestedQuantity, item.measurement);
                    if (converted) {
                      return (
                        <Text style={styles.itemQty}>
                          Suggested quantity: {formattedVnd(converted.value)} {converted.unit}
                        </Text>
                      );
                    }
                    return (
                      <Text style={styles.itemQty}>
                        Qty needed: {getDisplayQty(item)} {item.measurement || 'g/ml'}
                      </Text>
                    );
                  })()}
                  {typeof getItemLimit(item) === 'number' && (
                    <Text style={styles.itemQty}>Available quantity package: {getItemLimit(item)}</Text>
                  )}
                  {/* Actual calculated price — only shown in review mode */}
                  {isReviewing && (() => {
                    const actualPrice = calcItemPrice(item);
                    return (
                      <Text style={[styles.itemQty, { color: '#B23B3B', fontWeight: '700', marginTop: 4 }]}>
                        Estimated cost: {formattedVnd(Math.round(actualPrice))} VND
                      </Text>
                    );
                  })()}
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
                      <TextInput
                        value={reviewQtyInputById[item.id] ?? String(getDisplayQty(item))}
                        onChangeText={(value) => handleReviewQtyInputChange(item.id, value)}
                        onBlur={() => handleReviewQtyInputBlur(item.id)}
                        keyboardType="number-pad"
                        style={[
                          styles.qtyInput,
                          reviewQtyErrorById[item.id] ? styles.qtyInputInvalid : null,
                        ]}
                        editable={(getItemLimit(item) ?? 0) > 0}
                        placeholder="1"
                        placeholderTextColor="#8B7A6A"
                      />
                      <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() => handleChangeQuantity(item.id, 1)}
                      >
                        <Ionicons name="add" size={16} color="#2C1B13" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {isReviewing && reviewQtyErrorById[item.id] ? (
                    <Text style={styles.qtyErrorText}>{reviewQtyErrorById[item.id]}</Text>
                  ) : null}
                </View>
                <Image
                  source={{
                    uri: item.image || recommendationBgUri,
                  }}
                  style={styles.itemImage}
                />
              </View>
            </View>
          );

          if (!isReviewing) {
            return (
              <View key={item.id}>
                {card}
              </View>
            );
          }

          return (
            <Swipeable
              key={item.id}
              renderRightActions={() => renderRightActions(item.id)}
              rightThreshold={32}
            >
              {card}
            </Swipeable>
          );
        })}

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
  qtyInput: {
    minWidth: 54,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2D7CD',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#2C1B13',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  qtyInputInvalid: {
    borderColor: '#B23B3B',
  },
  qtyErrorText: {
    marginTop: 6,
    fontSize: 11,
    color: '#B23B3B',
    fontWeight: '600',
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
