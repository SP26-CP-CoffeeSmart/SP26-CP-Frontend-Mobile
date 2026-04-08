import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCart } from '@/context/cart-context';
import { Swipeable } from 'react-native-gesture-handler';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

const COLORS = {
  bg: '#F7F3EF',
  text: '#3C2A21',
  textSecondary: '#8E7B6F',
  border: '#E8E1D9',
  accent: '#D38B2A',
  white: '#FFFFFF',
  danger: '#B23B3B',
};

const headerImage =
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80';

const fallbackItemImage =
  'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=400&q=80';

type StockCheckResponseItem = {
  productId: number;
  stock?: number | null;
  holdStock?: number | null;
  availableStock?: number | null;
};

export default function CartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, clearCart } = useCart();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [stockIssueLines, setStockIssueLines] = useState<string[]>([]);
  const [showStockIssueModal, setShowStockIssueModal] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formatVnd = (value: number) =>
    value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

  const allIds = useMemo(() => items.map((item) => item.productId), [items]);
  const idsKey = useMemo(() => allIds.join(','), [allIds]);
  const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  // Fetch real-time stock
  const [availableStockByProduct, setAvailableStockByProduct] = useState<Record<number, number | null>>({});

  useEffect(() => {
    let isCancelled = false;
    const loadLatestStock = async () => {
      if (allIds.length === 0) {
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
          body: JSON.stringify(allIds),
        });

        if (!response.ok) return;

        const stockItems = await response.json() as StockCheckResponseItem[];

        if (isCancelled) return;

        const nextMap: Record<number, number> = {};
        stockItems.forEach((item) => {
          if (typeof item.productId !== 'number') return;
          const availableRaw =
            item.availableStock ??
            (Number(item.stock ?? 0) - Number(item.holdStock ?? 0));
          nextMap[item.productId] = Math.max(0, Math.floor(Number(availableRaw) || 0));
        });
        setAvailableStockByProduct(nextMap);
      } catch {
        // silently fail and fallback to context
      }
    };
    loadLatestStock();
    return () => {
      isCancelled = true;
    };
  }, [idsKey, allIds]);

  useEffect(() => {
    if (!hasInitializedSelection && items.length > 0) {
      setSelectedIds(new Set(allIds));
      setHasInitializedSelection(true);
    }
  }, [allIds, hasInitializedSelection, items.length]);

  const toggleAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(allIds));
  };

  const toggleSupplier = (supplierId: number) => {
    const supplierIds = items
      .filter((item) => item.supplierId === supplierId)
      .map((item) => item.productId);
    const isSupplierSelected = supplierIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isSupplierSelected) {
        supplierIds.forEach((id) => next.delete(id));
      } else {
        supplierIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleItem = (productId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const selectedItems = items.filter((item) => selectedIds.has(item.productId));
  const hasSelection = selectedItems.length > 0;

  const renderRightActions = (productId: number) => (
    <View style={styles.swipeActionWrap}>
      <TouchableOpacity
        style={styles.swipeDeleteButton}
        onPress={() => removeItem(productId)}
      >
        <Ionicons name="trash" size={18} color={COLORS.white} />
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2000);
  };

  const handlePurchase = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('Purchase', 'Please select at least one item.');
      return;
    }

    setIsSubmitting(true);

    try {
      const productIds = selectedItems.map((item) => item.productId);

      const response = await authorizedFetch(API_ENDPOINTS.supplierProduct.checkAvailableStock(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productIds),
      });

      if (!response.ok) {
        throw new Error(`Unable to verify stock: ${response.status}`);
      }

      const stockItems = await response.json() as StockCheckResponseItem[];
      const byProductId = new Map<number, StockCheckResponseItem>();

      stockItems.forEach((stockItem) => {
        if (typeof stockItem.productId === 'number') {
          byProductId.set(stockItem.productId, stockItem);
        }
      });

      const invalidItems: string[] = [];

      selectedItems.forEach((selected) => {
        const latest = byProductId.get(selected.productId);
        const availableRaw =
          latest?.availableStock ??
          (Number(latest?.stock ?? 0) - Number(latest?.holdStock ?? 0));
        const available = Math.max(0, Math.floor(Number(availableRaw) || 0));

        if (!latest || selected.quantity > available) {
          invalidItems.push(`${selected.name}: max ${available}`);
        }
      });

      if (invalidItems.length > 0) {
        setStockIssueLines(invalidItems);
        setShowStockIssueModal(true);
        return;
      }

      const selectedIdsArray = Array.from(selectedIds);
      router.push({
        pathname: '/checkout',
        params: { selectedIds: JSON.stringify(selectedIdsArray) },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to verify stock.';
      Alert.alert('Purchase', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.page}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Image source={{ uri: headerImage }} style={styles.headerImage} />
            <View style={styles.headerOverlay} />
            <Text style={styles.headerTitle}>Your Cart</Text>
            <TouchableOpacity
              style={styles.headerBackButton}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.selectAllRow}
              onPress={toggleAll}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, isAllSelected && styles.checkboxChecked]}>
                {isAllSelected ? (
                  <Ionicons name="checkmark" size={12} color={COLORS.white} />
                ) : null}
              </View>
              <Text style={styles.selectAllText}>All</Text>
            </TouchableOpacity>

            {items.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Your cart is empty.</Text>
              </View>
            ) : (
              (() => {
                // Group items by supplierId, preserving insertion order
                const groups: { supplierId: number; supplierName: string | null | undefined; items: typeof items }[] = [];
                const seen = new Map<number, number>();
                for (const item of items) {
                  if (!seen.has(item.supplierId)) {
                    seen.set(item.supplierId, groups.length);
                    groups.push({ supplierId: item.supplierId, supplierName: item.supplierName, items: [] });
                  }
                  groups[seen.get(item.supplierId)!].items.push(item);
                }

                return groups.map((group) => {
                  const supplierSelected = group.items.every((item) =>
                    selectedIds.has(item.productId)
                  );
                  const label = group.supplierName ?? `Supplier #${group.supplierId}`;

                  return (
                    <View key={group.supplierId} style={styles.shopSection}>
                      {/* Supplier header row */}
                      <TouchableOpacity
                        style={styles.shopRow}
                        onPress={() => toggleSupplier(group.supplierId)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, supplierSelected && styles.checkboxChecked]}>
                          {supplierSelected ? (
                            <Ionicons name="checkmark" size={12} color={COLORS.white} />
                          ) : null}
                        </View>
                        <Text style={styles.shopText}>{label} {'>'}</Text>
                      </TouchableOpacity>

                      {/* All items from this supplier inside one rounded container */}
                      <View style={styles.shopItemsContainer}>
                        {group.items.map((item, idx) => {
                          const isSelected = selectedIds.has(item.productId);
                          const limitRaw = availableStockByProduct[item.productId];
                          const limit = typeof limitRaw === 'number'
                            ? limitRaw
                            : (typeof item.availableStock === 'number' ? Math.max(0, Math.floor(item.availableStock)) : null);
                          const isOutOfStock = limit !== null && limit === 0;

                          return (
                            <View key={item.productId}>
                              {idx > 0 && <View style={styles.itemDivider} />}
                              <Swipeable
                                renderRightActions={() => renderRightActions(item.productId)}
                                rightThreshold={32}
                              >
                                <TouchableOpacity
                                  style={[styles.itemCardContainer, isSelected && styles.itemCardSelected]}
                                  onPress={() => toggleItem(item.productId)}
                                  activeOpacity={0.55}
                                >
                                  <View style={[styles.itemCardContent, isOutOfStock && { opacity: 0.4 }]}>
                                    <View style={styles.itemInfo}>
                                      <Text style={styles.itemName}>{item.name}</Text>
                                      <Text style={styles.itemDesc}>{item.category}</Text>
                                      <Text style={styles.itemPrice}>
                                        {formatVnd(item.unitPrice)} VND/{item.measurement}
                                      </Text>
                                      <View style={styles.qtyRow}>
                                        <TouchableOpacity
                                          style={styles.qtyButton}
                                          onPress={() =>
                                            updateQuantity(item.productId, Math.max(1, item.quantity - 1))
                                          }
                                        >
                                          <Ionicons name="remove" size={14} color={COLORS.text} />
                                        </TouchableOpacity>
                                        <Text style={styles.qtyValue}>{item.quantity}</Text>
                                        <TouchableOpacity
                                          style={styles.qtyButton}
                                          onPress={() => {
                                            if (limit !== null && item.quantity >= limit) {
                                              showToast(`Max available: ${limit}`);
                                              return;
                                            }

                                            updateQuantity(item.productId, item.quantity + 1);
                                          }}
                                        >
                                          <Ionicons name="add" size={14} color={COLORS.text} />
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                    <Image
                                      source={{ uri: item.image ?? fallbackItemImage }}
                                      style={styles.itemImage}
                                    />
                                    <View style={styles.itemSelectOverlay}>
                                      <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                                        {isSelected ? (
                                          <Ionicons name="checkmark" size={12} color={COLORS.white} />
                                        ) : null}
                                      </View>
                                    </View>
                                  </View>

                                  {isOutOfStock && (
                                    <View style={styles.issueOverlayContainer}>
                                      <Text style={styles.outOfStockBadge}>Out of Stock</Text>
                                    </View>
                                  )}
                                </TouchableOpacity>
                              </Swipeable>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                });
              })()
            )}
          </View>
        </ScrollView>

        <View style={styles.bottomContainer}>
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.addIngredientsBtn}
              onPress={() => router.push('/product-page')}
            >
              <Text style={styles.addIngredientsText}>+ Add ingredients</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.purchaseItemsBtn,
                (!hasSelection || isSubmitting) && styles.purchaseItemsBtnDisabled,
              ]}
              onPress={handlePurchase}
              disabled={!hasSelection || isSubmitting}
            >
              <Ionicons name="cart-outline" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
              <Text style={styles.purchaseItemsText}>
                {isSubmitting ? 'Purchasing...' : 'Purchase Items'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Stock Alert Modal */}
      <Modal
        visible={showStockIssueModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStockIssueModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Stock Limit Reached</Text>
            <Text style={styles.confirmMessage}>
              Please adjust quantity for these items:
            </Text>
            <View style={styles.stockIssueBox}>
              <Text style={styles.stockIssueText}>{stockIssueLines.join('\n')}</Text>
            </View>
            <TouchableOpacity
              style={styles.confirmOkBtnFull}
              onPress={() => setShowStockIssueModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmOkText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {toastMessage ? (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  page: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  header: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  headerTitle: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  headerBackButton: {
    position: 'absolute',
    left: 16,
    top: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  selectAllText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  shopSection: {
    marginBottom: 12,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  shopText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  shopItemsContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  itemDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 10,
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  itemCardContainer: {
    backgroundColor: COLORS.white,
    padding: 10,
    position: 'relative',
  },
  itemCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCardSelected: {
    backgroundColor: '#FDF6EC',
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemDesc: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginVertical: 4,
  },
  itemPrice: {
    fontSize: 11,
    color: COLORS.danger,
    fontWeight: '700',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  qtyButton: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#E8CCBE',
  },
  itemSelectOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  swipeActionWrap: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  swipeDeleteButton: {
    width: 90,
    height: '100%',
    backgroundColor: '#B23B3B',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
  },
  swipeDeleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.white,
  },
  bottomContainer: {
    backgroundColor: COLORS.bg,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  orderSummaryCard: {
    backgroundColor: '#FAF7F2',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderSummaryTitle: {
    fontSize: 18,
    color: '#3C2A21',
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#8E7B6F',
  },
  summaryValue: {
    fontSize: 14,
    color: '#8E7B6F',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E8E1D9',
    marginVertical: 12,
  },
  summaryTotalLabel: {
    fontSize: 16,
    color: '#3C2A21',
    fontWeight: '700',
  },
  summaryTotalValue: {
    fontSize: 16,
    color: '#3C2A21',
    fontWeight: '700',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    gap: 12,
  },
  addIngredientsBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E1D9',
    borderRadius: 40,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIngredientsText: {
    fontSize: 14,
    color: '#3C2A21',
    fontWeight: '600',
  },
  purchaseItemsBtn: {
    flex: 1,
    backgroundColor: '#2A1810',
    borderRadius: 40,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  purchaseItemsBtnDisabled: {
    opacity: 0.5,
  },
  purchaseItemsText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#3A1C1C',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  confirmCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 24,
    marginHorizontal: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  confirmMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  confirmOkBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.text,
    alignItems: 'center',
  },
  confirmOkBtnFull: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.text,
    alignItems: 'center',
  },
  confirmOkText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  stockIssueBox: {
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  stockIssueText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
  },
  issueOverlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  outOfStockBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    fontFamily: 'Outfit-Bold',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
