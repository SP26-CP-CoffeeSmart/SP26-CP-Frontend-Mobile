import React, { useEffect, useMemo, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import { ActivityIndicator } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCart } from '@/context/cart-context';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS, AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { Swipeable } from 'react-native-gesture-handler';
import { WebView } from 'react-native-webview';

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
  const { items, updateQuantity, removeItem, clearCart } = useCart();
  const { walletBalance, walletId, refreshProfile } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [selectedTopup, setSelectedTopup] = useState<number | null>(null);
  const [customTopup, setCustomTopup] = useState('');
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [payosUrl, setPayosUrl] = useState<string | null>(null);
  const [showPayosModal, setShowPayosModal] = useState(false);
  const [lastTopupAmount, setLastTopupAmount] = useState<number | null>(null);
  const [successSubmitting, setSuccessSubmitting] = useState(false);
  const successTriggeredRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      totalAmount: totalPrice ,
    };
  }, [selectedItems]);
  const canAfford = totals.totalAmount <= walletBalance;
  const hasSelection = selectedItems.length > 0;
  const showInsufficient = hasSelection && !canAfford;

  const topupPresets = [100000, 500000, 1000000, 5000000];

  const handleSelectTopup = (amount: number) => {
    if (selectedTopup === amount) {
      setSelectedTopup(null);
      return;
    }
    setSelectedTopup(amount);
    setCustomTopup('');
  };

  const handleTopup = () => {
    const runTopup = async () => {
      if (topupSubmitting) {
        return;
      }

      const customValue = Number(customTopup.replace(/[^0-9]/g, ''));
      const amount = selectedTopup ?? (Number.isFinite(customValue) ? customValue : 0);
      if (!amount || amount <= 0) {
        Alert.alert('Top up', 'Please select or enter a top-up amount.');
        return;
      }

      try {
        setTopupSubmitting(true);
        if (!walletId) {
          Alert.alert('Top up', 'Wallet not found. Please refresh and try again.');
          return;
        }

        const returnUrl = 'http://localhost:8081/wallet-topup/success';
        const cancelUrl = 'http://localhost:8081/wallet-topup/cancel';

        const response = await authorizedFetch(`${AUTH_BASE_URL}/Wallet/${walletId}/top-up`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletId,
            amount,
            returnUrl,
            cancelUrl,
          }),
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = await response.json();
        const checkoutUrl = String(data?.checkoutUrl ?? '').trim();
        if (!checkoutUrl) {
          throw new Error('Missing checkout url');
        }

        setLastTopupAmount(amount);
        successTriggeredRef.current = false;
        setPayosUrl(checkoutUrl);
        setShowTopupModal(false);
        setShowPayosModal(true);
      } catch (error) {
        Alert.alert('Top up', 'Unable to create top-up checkout.');
      } finally {
        setTopupSubmitting(false);
      }
    };

    runTopup();
  };

  const handleTopupSuccess = async () => {
    if (successSubmitting) {
      return;
    }

    if (!walletId || !lastTopupAmount) {
      Alert.alert('Top up', 'Missing top-up data. Please try again.');
      return;
    }

    try {
      setSuccessSubmitting(true);
      const response = await authorizedFetch(
        `${AUTH_BASE_URL}/Wallet/${walletId}/top-up/success?amount=${lastTopupAmount}`,
        {
          method: 'POST',
          headers: {
            Accept: '*/*',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      await refreshProfile();
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      closeTimerRef.current = setTimeout(() => {
        setShowPayosModal(false);
        setPayosUrl(null);
        setLastTopupAmount(null);
        closeTimerRef.current = null;
      }, 3000);
    } catch (error) {
      Alert.alert('Top up', 'Unable to confirm top-up.');
    } finally {
      setSuccessSubmitting(false);
    }
  };

  const handlePayosShouldStart = (event: { url?: string }) => {
    const rawUrl = String(event?.url ?? '');
    const url = rawUrl.toLowerCase();

    if (!url) {
      return true;
    }

    const isSuccessRoute = url.includes('wallet-topup/success');
    const isCancelRoute =
      url.includes('wallet-topup/cancel') ||
      url.includes('cancel=true') ||
      url.includes('status=cancelled');
    const isPaidStatus = url.includes('status=paid');

    if (isCancelRoute) {
      setShowPayosModal(false);
      setPayosUrl(null);
      setLastTopupAmount(null);
      successTriggeredRef.current = false;
      return false;
    }

    if (isSuccessRoute || isPaidStatus) {
      if (!successTriggeredRef.current) {
        successTriggeredRef.current = true;
        handleTopupSuccess();
      }
      return false;
    }

    return true;
  };
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

    if (!canAfford) {
      Alert.alert('Purchase', 'Not enough wallet balance. Please top up.');
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const payload = {
        notes: 'giao gap',
        shipperName: 'string',
        shipDate: nowIso,
        receiDate: nowIso,
        shipAddress: 'string',
        receiveAddress: 's702a',
        items: selectedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      };

      const response = await authorizedFetch(
        API_ENDPOINTS.order.fromSupplierProducts(),
        {
          method: 'POST',
          headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }

      // Only remove the purchased items, leaving unpurchased items in cart
      selectedItems.forEach((item) => removeItem(item.productId));
      setSelectedIds(new Set());
      Toast.show({
        type: 'success',
        text1: 'Order placed successfully!',
        text2: 'Your order has been submitted.',
      });
      // Navigate back to order tab so user sees the new order
      setTimeout(() => router.replace('/(tabs)/order'), 300);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Purchase failed.';
      Alert.alert('Purchase', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
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
                        return (
                          <View key={item.productId}>
                            {idx > 0 && <View style={styles.itemDivider} />}
                            <Swipeable
                              renderRightActions={() => renderRightActions(item.productId)}
                              rightThreshold={32}
                            >
                              <TouchableOpacity
                                style={[styles.itemCard, isSelected && styles.itemCardSelected]}
                                onPress={() => toggleItem(item.productId)}
                                activeOpacity={0.55}
                              >
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
                                <View style={styles.itemSelectOverlay}>
                                  <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                                    {isSelected ? (
                                      <Ionicons name="checkmark" size={12} color={COLORS.white} />
                                    ) : null}
                                  </View>
                                </View>
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
            <Text style={styles.summaryTotalLabel}>Total Amount:</Text>
            <Text style={styles.summaryTotalValue}>{formatVnd(totals.totalAmount)} vnd</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Wallet balance:</Text>
            <Text style={styles.summaryValue}>{formatVnd(walletBalance)} vnd</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Balance after payment:</Text>
            <Text style={[styles.summaryValue, { color: canAfford ? '#2E7D32' : COLORS.danger }]}>
              {formatVnd(walletBalance - totals.totalAmount)} vnd
            </Text>
          </View>
          {showInsufficient ? (
            <Text style={styles.balanceWarning}>Not enough balance. Please top up.</Text>
          ) : null}
          {showInsufficient ? (
            <TouchableOpacity style={styles.topupCta} onPress={() => setShowTopupModal(true)}>
              <Text style={styles.topupCtaText}>Top up wallet</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.purchaseCta, (!canAfford || isSubmitting || !hasSelection) && styles.purchaseCtaDisabled]}
            onPress={() => {
              if (!hasSelection) {
                Alert.alert('Purchase', 'Please select at least one item.');
                return;
              }
              if (!canAfford) {
                Alert.alert('Purchase', 'Not enough wallet balance. Please top up.');
                return;
              }
              setShowConfirmModal(true);
            }}
            disabled={isSubmitting || !canAfford || !hasSelection}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
            ) : null}
            <Text style={styles.purchaseCtaText}>
              {isSubmitting ? 'Purchasing...' : 'Purchase'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Purchase Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Confirm Purchase</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to place this order?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowConfirmModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmOkBtn}
                onPress={() => {
                  setShowConfirmModal(false);
                  handlePurchase();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmOkText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTopupModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTopupModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.topupCard}>
            <View style={styles.topupHeader}>
              <Text style={styles.topupTitle}>Top up wallet</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowTopupModal(false)}
              >
                <Ionicons name="close" size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.topupHint}>Choose an amount</Text>
            <View style={styles.topupOptions}>
              {topupPresets.map((amount) => {
                const isActive = amount === selectedTopup;
                return (
                  <TouchableOpacity
                    key={amount}
                    style={[styles.topupChip, isActive && styles.topupChipActive]}
                    activeOpacity={0.8}
                    onPress={() => handleSelectTopup(amount)}
                  >
                    <Text style={[styles.topupChipText, isActive && styles.topupChipTextActive]}>
                      {amount.toLocaleString('vi-VN')} vnd
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.topupHint}>Or enter a custom amount</Text>
            <TextInput
              value={customTopup}
              onChangeText={(value) => {
                setCustomTopup(value);
                if (selectedTopup) {
                  setSelectedTopup(null);
                }
              }}
              placeholder="e.g. 250000"
              keyboardType="numeric"
              style={styles.topupInput}
            />
            <TouchableOpacity
              style={[styles.topupSubmit, topupSubmitting && styles.topupSubmitDisabled]}
              onPress={handleTopup}
              disabled={topupSubmitting}
            >
              <Text style={styles.topupSubmitText}>
                {topupSubmitting ? 'Processing...' : 'Top up wallet'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPayosModal}
        animationType="slide"
        onRequestClose={() => setShowPayosModal(false)}
      >
        <SafeAreaView style={styles.payosContainer} edges={['top']}>
          <View style={styles.payosHeader}>
            <Text style={styles.payosTitle}>PayOS Checkout</Text>
            <TouchableOpacity
              style={styles.payosCloseButton}
              onPress={() => {
                setShowPayosModal(false);
                if (closeTimerRef.current) {
                  clearTimeout(closeTimerRef.current);
                  closeTimerRef.current = null;
                }
              }}
            >
              <Ionicons name="close" size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          {payosUrl ? (
            <WebView
              source={{ uri: payosUrl }}
              style={styles.payosWebview}
              onShouldStartLoadWithRequest={handlePayosShouldStart}
            />
          ) : (
            <View style={styles.payosFallback}>
              <Text style={styles.payosFallbackText}>Missing checkout url.</Text>
            </View>
          )}
        </SafeAreaView>
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
  itemCard: {
    backgroundColor: COLORS.white,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
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
  purchaseCtaDisabled: {
    opacity: 0.5,
  },
  purchaseCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  balanceWarning: {
    fontSize: 11,
    color: COLORS.danger,
    fontWeight: '600',
  },
  topupCta: {
    marginTop: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topupCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  topupCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
  },
  topupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  topupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2E9E1',
  },
  topupHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  topupOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  topupChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.white,
  },
  topupChipActive: {
    backgroundColor: '#F3D7AA',
    borderColor: COLORS.accent,
  },
  topupChipText: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '600',
  },
  topupChipTextActive: {
    color: COLORS.text,
  },
  topupInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: COLORS.text,
    marginBottom: 10,
  },
  topupSubmit: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  topupSubmitDisabled: {
    opacity: 0.6,
  },
  topupSubmitText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  payosContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  payosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  payosTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  payosCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2E9E1',
  },
  payosWebview: {
    flex: 1,
  },
  payosFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payosFallbackText: {
    fontSize: 12,
    color: COLORS.textSecondary,
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
  confirmOkText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
});
