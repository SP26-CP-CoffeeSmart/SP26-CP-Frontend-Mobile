import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCart } from '@/context/cart-context';
import { Swipeable } from 'react-native-gesture-handler';

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

export default function CartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem } = useCart();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
  const formatVnd = (value: number) =>
    value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

  const allIds = useMemo(() => items.map((item) => item.productId), [items]);
  const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

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
  const totals = useMemo(() => {
    const itemCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = selectedItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    const shipping = Math.round(totalPrice * 0.1);
    return {
      itemCount,
      totalPrice,
      shipping,
      totalAmount: totalPrice + shipping,
    };
  }, [selectedItems]);
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
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.emptyText}>Your cart is empty.</Text>
            </View>
          ) : (
            items.map((item) => {
              const isSelected = selectedIds.has(item.productId);
              const supplierSelected = items
                .filter((entry) => entry.supplierId === item.supplierId)
                .every((entry) => selectedIds.has(entry.productId));

              return (
              <View key={item.productId} style={styles.shopSection}>
                <TouchableOpacity
                  style={styles.shopRow}
                  onPress={() => toggleSupplier(item.supplierId)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[styles.checkbox, supplierSelected && styles.checkboxChecked]}
                  >
                    {supplierSelected ? (
                      <Ionicons name="checkmark" size={12} color={COLORS.white} />
                    ) : null}
                  </View>
                  <Text style={styles.shopText}>Supplier #{item.supplierId} ></Text>
                </TouchableOpacity>
                <Swipeable
                  renderRightActions={() => renderRightActions(item.productId)}
                  rightThreshold={32}
                >
                  <View style={styles.itemCard}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemDesc}>{item.category}</Text>
                      <Text style={styles.itemPrice}>
                        {formatVnd(item.unitPrice)}vnd/{item.measurement}
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
                          onPress={() => updateQuantity(item.productId, item.quantity + 1)}
                        >
                          <Ionicons name="add" size={14} color={COLORS.text} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Image
                      source={{ uri: item.image ?? fallbackItemImage }}
                      style={styles.itemImage}
                    />
                    <TouchableOpacity
                      style={styles.itemSelectOverlay}
                      onPress={() => toggleItem(item.productId)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[styles.checkbox, isSelected && styles.checkboxChecked]}
                      >
                        {isSelected ? (
                          <Ionicons name="checkmark" size={12} color={COLORS.white} />
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </View>
                </Swipeable>
              </View>
              );
            })
          )}
        </View>
      </ScrollView>

        <View style={styles.summaryBar}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Number of items:</Text>
            <Text style={styles.summaryValue}>{totals.itemCount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Price:</Text>
            <Text style={styles.summaryValue}>{formatVnd(totals.totalPrice)} vnd</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Estimated shipping cost:</Text>
            <Text style={styles.summaryValue}>{formatVnd(totals.shipping)} vnd</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total Amount:</Text>
            <Text style={styles.summaryTotalValue}>{formatVnd(totals.totalAmount)} vnd</Text>
          </View>
          <TouchableOpacity style={styles.purchaseCta}>
            <Text style={styles.purchaseCtaText}>Purchase</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  itemCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
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
  summaryBar: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  summaryTotalLabel: {
    fontSize: 13,
    color: COLORS.danger,
    fontWeight: '700',
  },
  summaryTotalValue: {
    fontSize: 13,
    color: COLORS.danger,
    fontWeight: '700',
  },
  purchaseCta: {
    marginTop: 8,
    backgroundColor: '#3A1C1C',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});
