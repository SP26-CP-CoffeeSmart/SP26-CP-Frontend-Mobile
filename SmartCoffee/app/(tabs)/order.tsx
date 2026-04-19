import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { useCart } from '@/context/cart-context';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

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
};

const fallbackAssetUri =
  Image.resolveAssetSource(require('../../assets/AI_RecommendationBackground.jpg')).uri;
const headerImage = fallbackAssetUri;

const statuses = [
  { key: 'pending', label: 'Pending', icon: 'hourglass-outline' },
  { key: 'preparing', label: 'Preparing', icon: 'cafe-outline' },
  { key: 'delivering', label: 'Delivering', icon: 'bicycle-outline' },
  { key: 'delivered', label: 'Delivered', icon: 'checkmark-circle-outline' },
  { key: 'completed', label: 'Completed', icon: 'checkmark-done-outline' },
  { key: 'cancelled', label: 'Cancelled', icon: 'close-outline' },
  { key: 'rejected', label: 'Rejected', icon: 'close-circle-outline' },
  { key: 'refunded', label: 'Refunded', icon: 'cash-outline' },
];

const fallbackOrderImage = fallbackAssetUri;

type OrderResponse = {
  orderId?: number;
  status?: string;
  totalPrice?: number;
  shippingFee?: number;
  createAt?: string;
  supplierId?: number;
  expectedDeliveryTime?: string;
  shipDate?: string;
  receiveDate?: string;
  shipAddress?: string;
  receiveAddress?: string;
  orderDetails?: {
    orderDetailId?: number;
    order_detail_id?: number;
    id?: number;
    type?: string;
    ingredientId?: number;
    ingredientName?: string;
    quantity?: number;
    price?: number;
  }[];
};

type FeedbackFormState = {
  type: string;
  content: string;
  rating: number;
};

type PagedOrderResponse = {
  totalCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  items?: OrderResponse[];
};

const ORDER_PAGE_SIZE = 10;

const toApiOrderStatus = (key: string): string => {
  const found = statuses.find((s) => s.key === key);
  return found?.label ?? key;
};

export default function OrderScreen() {
  const router = useRouter();
  const { accountId } = useAuth();
  const { addItem, clearCart } = useCart();
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null);
  const [feedbackOrder, setFeedbackOrder] = useState<OrderResponse | null>(null);
  const [selectedFeedbackDetailId, setSelectedFeedbackDetailId] = useState<number | null>(null);
  const [feedbackForm, setFeedbackForm] = useState<FeedbackFormState>({
    type: 'Quality',
    content: '',
    rating: 5,
  });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmittedDetailIds, setFeedbackSubmittedDetailIds] = useState<number[]>([]);

  const feedbackTypes = ['Quality', 'Packaging', 'Delivery', 'Other'];

  const getOrderDetailId = (detail: NonNullable<OrderResponse['orderDetails']>[number]) => {
    const id = Number(detail.orderDetailId ?? detail.order_detail_id ?? detail.id ?? 0);
    return Number.isFinite(id) && id > 0 ? id : 0;
  };

  const canFeedbackStatus = (status?: string) => {
    const normalized = String(status ?? '').toLowerCase();
    return normalized === 'delivered' || normalized === 'completed';
  };

  const getFeedbackProgress = (order: OrderResponse) => {
    const detailIds = (order.orderDetails ?? [])
      .map((detail) => getOrderDetailId(detail))
      .filter((id) => id > 0);
    if (detailIds.length === 0) {
      return { done: 0, total: 0 };
    }
    const done = detailIds.filter((id) => feedbackSubmittedDetailIds.includes(id)).length;
    return { done, total: detailIds.length };
  };

  const openFeedbackModal = (order: OrderResponse, e?: any) => {
    if (e?.stopPropagation) e.stopPropagation();
    const details = order.orderDetails ?? [];
    const firstSelectable = details
      .map((detail) => getOrderDetailId(detail))
      .find((id) => id > 0 && !feedbackSubmittedDetailIds.includes(id));

    setFeedbackOrder(order);
    setSelectedFeedbackDetailId(firstSelectable ?? null);
    setFeedbackForm({ type: 'Quality', content: '', rating: 5 });
  };

  const handleSubmitFeedback = async () => {
    const orderId = Number(feedbackOrder?.orderId ?? 0);
    const orderDetailId = Number(selectedFeedbackDetailId ?? 0);

    if (!orderId || !orderDetailId) {
      Toast.show({ type: 'error', text1: 'Missing order detail to feedback' });
      return;
    }

    if (!feedbackForm.type.trim()) {
      Toast.show({ type: 'error', text1: 'Please select feedback type' });
      return;
    }

    if (!feedbackForm.content.trim()) {
      Toast.show({ type: 'error', text1: 'Please enter feedback content' });
      return;
    }

    if (feedbackForm.rating < 1 || feedbackForm.rating > 5) {
      Toast.show({ type: 'error', text1: 'Rating must be between 1 and 5' });
      return;
    }

    try {
      setSubmittingFeedback(true);

      const payload = {
        order_detail_id: orderDetailId,
        type: feedbackForm.type.trim(),
        content: feedbackForm.content.trim(),
        rating: feedbackForm.rating,
      };

      console.log('[Order Feedback] payload:', JSON.stringify(payload, null, 2));

      const response = await authorizedFetch(API_ENDPOINTS.orderDetailFeedback.create(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log('[Order Feedback] endpoint /OrderDetailFeedback status:', response.status);
      console.log('[Order Feedback] endpoint /OrderDetailFeedback body:', responseText);

      if (!response.ok) {
        throw new Error(responseText || `Request failed: ${response.status}`);
      }

      setFeedbackSubmittedDetailIds((prev) =>
        prev.includes(orderDetailId) ? prev : [...prev, orderDetailId]
      );

      Toast.show({ type: 'success', text1: 'Feedback submitted' });
      setSelectedFeedbackDetailId(null);
      setFeedbackForm({ type: 'Quality', content: '', rating: 5 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Submit feedback failed';
      Toast.show({ type: 'error', text1: 'Feedback failed', text2: message });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const formatVnd = (value: number) =>
    value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

  const loadOrders = useCallback(async (options?: { isRefresh?: boolean; page?: number; append?: boolean; statusKey?: string }) => {
    const isRefresh = Boolean(options?.isRefresh);
    const page = options?.page ?? 1;
    const append = Boolean(options?.append);
    const statusKey = options?.statusKey ?? selectedStatus;

    if (!accountId) {
      setOrders([]);
      setCurrentPage(1);
      setTotalPages(1);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await authorizedFetch(
        API_ENDPOINTS.order.byOwner(accountId, {
          page,
          pageSize: ORDER_PAGE_SIZE,
          orderStatus: toApiOrderStatus(statusKey),
        }),
        {
          headers: {
            Accept: '*/*',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = (await response.json()) as OrderResponse[] | PagedOrderResponse;
      let nextOrders: OrderResponse[] = [];
      let nextPage = page;
      let nextTotalPages = 1;

      if (Array.isArray(data)) {
        nextOrders = data;
        nextPage = page;
        nextTotalPages = data.length >= ORDER_PAGE_SIZE ? page + 1 : page;
      } else if (Array.isArray(data?.items)) {
        nextOrders = data.items;
        nextPage = Number(data.page ?? page);
        nextTotalPages = Number(data.totalPages ?? nextPage);
      } else {
        nextOrders = [];
        nextPage = page;
        nextTotalPages = page;
      }

      setOrders((prev) => (append ? [...prev, ...nextOrders] : nextOrders));
      setCurrentPage(nextPage);
      setTotalPages(Math.max(nextTotalPages, nextPage));
    } catch (err) {
      setError('Unable to load orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [accountId, selectedStatus]);

  useFocusEffect(
    useCallback(() => {
      loadOrders({ page: 1, append: false, statusKey: selectedStatus });
    }, [loadOrders])
  );

  const onRefresh = useCallback(() => {
    loadOrders({ isRefresh: true, page: 1, append: false, statusKey: selectedStatus });
  }, [loadOrders, selectedStatus]);

  const handleCancelOrder = (orderId: number) => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await authorizedFetch(
                API_ENDPOINTS.order.updateStatusBody(orderId),
                {
                  method: 'PATCH',
                  headers: {
                    Accept: '*/*',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ status: 'Cancelled' })
                }
              );

              if (!response.ok) {
                throw new Error('API failed');
              }

              Toast.show({ type: 'success', text1: 'Order cancelled successfully' });
              setSelectedOrder(null);
              loadOrders({ page: 1, append: false, statusKey: selectedStatus });
            } catch (err: any) {
              Toast.show({ type: 'error', text1: 'Failed to cancel order' });
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReorder = async (order: OrderResponse, e?: any) => {
    if (e) e.stopPropagation();
    try {
      setLoading(true);
      if (!order.supplierId || !order.orderDetails?.length) {
        Toast.show({ type: 'error', text1: 'Cannot reorder', text2: 'Missing supplier or items info.' });
        return;
      }

      const res = await authorizedFetch(`${API_ENDPOINTS.supplierProduct.list(1, 500)}`);
      if (!res.ok) throw new Error('API request failed');

      const data = await res.json();
      const allProducts = Array.isArray(data) ? data : (data?.items || []);
      const supplierProducts = allProducts.filter((p: any) => p.supplierId === order.supplierId);

      const reorderedCartItems = [];
      let addedCount = 0;

      for (const detail of order.orderDetails) {
        const dAny = detail as any;
        const match = supplierProducts.find((p: any) =>
          (dAny.ingredientId && p.ingredientId === dAny.ingredientId) ||
          (detail.ingredientName && p.ingredient?.name === detail.ingredientName) ||
          (detail.ingredientName && p.name && String(p.name).toLowerCase().includes(String(detail.ingredientName).toLowerCase()))
        );

        if (match) {
          const finalImage = (match.image && match.image !== 'null') ? match.image :
            (match.ingredient?.image && match.ingredient.image !== 'null') ? match.ingredient.image :
              fallbackOrderImage;

          reorderedCartItems.push({
            productId: match.productId,
            supplierId: match.supplierId,
            supplierName: match.supplierName || `Supplier #${match.supplierId}`,
            name: match.name || match.ingredient?.name || detail.ingredientName || 'Product',
            category: match.ingredient?.category || match.category || 'General',
            image: finalImage,
            measurement: match.measurement || match.ingredient?.measurement || 'unit',
            packageSize: match.packageSize,
            availableStock: match.stock - (match.holdStock || 0),
            unitPrice: match.price,
            quantity: detail.quantity || 1,
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        await AsyncStorage.setItem('checkout_reorder_data', JSON.stringify(reorderedCartItems));
        Toast.show({ type: 'success', text1: 'Reorder init', text2: 'Navigating to checkout...' });
        router.push({
          pathname: '/checkout',
          params: { source: 'reorder' }
        });
      } else {
        Toast.show({ type: 'error', text1: 'Items unavailable', text2: 'Products not found in current catalog.' });
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Reorder failed', text2: 'Unable to process reorder at this time.' });
    } finally {
      setSelectedOrder(null);
      setLoading(false);
    }
  };

  // When status changes: request the first page from server with selected orderStatus.
  const handleStatusChange = (key: string) => {
    if (key === selectedStatus) return;
    setSelectedStatus(key);
    setCurrentPage(1);
    setTotalPages(1);
    setOrders([]);
    loadOrders({ page: 1, append: false, statusKey: key });
  };

  const hasMore = useMemo(() => currentPage < totalPages, [currentPage, totalPages]);

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    loadOrders({ page: currentPage + 1, append: true, statusKey: selectedStatus });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      >
        <View style={styles.header}
        >
          <Image source={{ uri: headerImage }} style={styles.headerImage} />
          <View style={styles.headerOverlay} />
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Order Page</Text>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => router.push('/cart')}
            >
              <Ionicons name="bag-outline" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent orders</Text>

        <View style={styles.statusScrollContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusRow}
          >
            {statuses.map((item) => {
              const isActive = selectedStatus === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={styles.statusItem}
                  onPress={() => handleStatusChange(item.key)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.statusIconWrap, isActive && styles.statusIconWrapActive]}>
                    <Ionicons
                      name={item.icon as any}
                      size={20}
                      color={isActive ? COLORS.white : COLORS.chipText}
                    />
                  </View>
                  <Text style={[styles.statusText, isActive && styles.statusTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.cardList}>
          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.emptyText}>Loading orders...</Text>
            </View>
          ) : error ? (
            <Text style={styles.emptyText}>{error}</Text>
          ) : orders.length === 0 ? (
            <Text style={styles.emptyText}>No recent orders.</Text>
          ) : (
            orders.map((order) => (
              <TouchableOpacity
                key={String(order.orderId ?? Math.random())}
                style={styles.orderCard}
                activeOpacity={0.7}
                onPress={() => setSelectedOrder(order)}
              >
                <View style={styles.orderCardMain}>
                  <Image source={{ uri: fallbackOrderImage }} style={styles.orderImage} />
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderName}>Order #{order.orderId ?? '-'}</Text>
                    {order.orderDetails && order.orderDetails.length > 0 ? (
                      <Text style={styles.orderDesc} numberOfLines={1}>
                        {order.orderDetails
                          .map((d) => `${d.quantity || 1}x ${d.ingredientName}`)
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    ) : (
                      <Text style={styles.orderDesc}>{order.status ?? 'Pending'}</Text>
                    )}
                    <Text style={styles.orderPrice}>
                      {formatVnd(order.totalPrice ?? 0)} VND
                    </Text>
                  </View>
                  <View style={styles.actionButtons}>
                    {String(order.status ?? '').toLowerCase() === 'pending' && (
                      <TouchableOpacity
                        style={styles.cancelButton}
                        activeOpacity={0.7}
                        onPress={(e) => {
                          e.stopPropagation();
                          if (order.orderId) handleCancelOrder(order.orderId);
                        }}
                      >
                        <Text style={styles.cancelText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                    {String(order.status ?? '').toLowerCase() === 'completed' && (
                      <TouchableOpacity
                        style={[styles.cancelButton, { borderColor: COLORS.text, backgroundColor: COLORS.text }]}
                        activeOpacity={0.7}
                        onPress={(e) => handleReorder(order, e)}
                      >
                        <Text style={[styles.cancelText, { color: COLORS.white }]}>Re-Order</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Bottom row for Feedback when Delivered */}
                {canFeedbackStatus(order.status) && (
                  <View style={styles.feedbackRow}>
                    <TouchableOpacity
                      style={styles.feedbackTouchable}
                      activeOpacity={0.6}
                      onPress={(e) => openFeedbackModal(order, e)}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color="#D4AF37" />
                      <Text style={styles.feedbackText}>Feedback</Text>
                    </TouchableOpacity>
                    {(() => {
                      const progress = getFeedbackProgress(order);
                      if (progress.total === 0) return null;
                      return (
                        <Text style={styles.feedbackProgressText}>
                          {progress.done}/{progress.total} feedbacked
                        </Text>
                      );
                    })()}
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {hasMore ? (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={handleLoadMore}
            disabled={loadingMore}
            activeOpacity={0.7}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.loadMoreText}>Load more</Text>
            )}
          </TouchableOpacity>
        ) : orders.length > 0 ? (
          <Text style={[styles.loadMoreText, { textAlign: 'center', marginTop: 8 }]}>
            All orders loaded
          </Text>
        ) : null}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/product-page')}>
        <Ionicons name="add" size={24} color={COLORS.text} />
      </TouchableOpacity>

      {/* Order Detail Modal */}
      <Modal
        visible={!!selectedOrder}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order #{selectedOrder?.orderId}</Text>
              <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status:</Text>
                <Text style={[styles.detailValue, { color: COLORS.accent, fontWeight: '700' }]}>
                  {selectedOrder?.status || 'Pending'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Shipping Fee:</Text>
                <Text style={styles.detailValue}>
                  {selectedOrder?.shippingFee
                    ? `${formatVnd(selectedOrder.shippingFee)} VND`
                    : '0 VND'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Price:</Text>
                <Text style={[styles.detailValue, { color: COLORS.danger, fontWeight: '700' }]}>
                  {selectedOrder?.totalPrice ? formatVnd(selectedOrder.totalPrice) : 0} VND
                </Text>
              </View>


              <View style={styles.divider} />

              <View style={styles.divider} />

              <Text style={styles.sectionHeading}>Shipping Info</Text>

              <View style={styles.timelineBox}>
                <View style={[styles.timelineItem, { borderRightWidth: 1, borderColor: COLORS.border }]}>
                  <Text style={styles.timelineLabel}>Ship Date</Text>
                  <Text style={styles.timelineValue}>
                    {selectedOrder?.shipDate ? new Date(selectedOrder.shipDate).toLocaleDateString() : 'Pending'}
                  </Text>
                </View>
                <View style={[styles.timelineItem, { borderRightWidth: 1, borderColor: COLORS.border }]}>
                  <Text style={styles.timelineLabel}>Receive Date</Text>
                  <Text style={styles.timelineValue}>
                    {selectedOrder?.receiveDate ? new Date(selectedOrder.receiveDate).toLocaleDateString() : 'Pending'}
                  </Text>
                </View>
                <View style={styles.timelineItem}>
                  <Text style={styles.timelineLabel}>Expected</Text>
                  <Text style={styles.timelineValue}>
                    {selectedOrder?.expectedDeliveryTime
                      ? new Date(selectedOrder.expectedDeliveryTime).toLocaleDateString()
                      : 'Pending'}
                  </Text>
                </View>
              </View>

              <View style={styles.addressBlock}>
                <View style={styles.addressItem}>
                  <View style={styles.addressIconWrap}>
                    <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                  </View>
                  <View style={styles.addressTextWrap}>
                    <Text style={styles.addressLabel}>Ship From</Text>
                    <Text style={styles.addressValue}>{selectedOrder?.shipAddress || 'Pending update'}</Text>
                  </View>
                </View>

                <View style={styles.addressDivider} />

                <View style={styles.addressItem}>
                  <View style={styles.addressIconWrap}>
                    <Ionicons name="home-outline" size={16} color={COLORS.textSecondary} />
                  </View>
                  <View style={styles.addressTextWrap}>
                    <Text style={styles.addressLabel}>Deliver To</Text>
                    <Text style={styles.addressValue}>{selectedOrder?.receiveAddress || 'Pending update'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionHeading}>Items</Text>

              <View style={styles.receiptBox}>
                {selectedOrder?.orderDetails?.map((item, idx) => (
                  <View key={idx} style={styles.receiptItemRow}>
                    <View style={styles.receiptItemQtyWrap}>
                      <Text style={styles.receiptItemQty}>{item.quantity || 1}x</Text>
                    </View>
                    <View style={styles.receiptItemNameWrap}>
                      <Text style={styles.receiptItemName}>{item.ingredientName}</Text>
                    </View>
                    <Text style={styles.receiptItemPrice}>
                      {item.price ? formatVnd(item.price) : 0} đ
                    </Text>
                  </View>
                ))}
              </View>

              {String(selectedOrder?.status ?? '').toLowerCase() === 'pending' && (
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (selectedOrder?.orderId) {
                      handleCancelOrder(selectedOrder.orderId);
                    }
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel Order</Text>
                </TouchableOpacity>
              )}

              {String(selectedOrder?.status ?? '').toLowerCase() === 'completed' && (
                <TouchableOpacity
                  style={[styles.modalCancelButton, { backgroundColor: COLORS.text }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (selectedOrder) handleReorder(selectedOrder);
                  }}
                >
                  <Text style={styles.modalCancelText}>Re-Order</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!feedbackOrder}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setFeedbackOrder(null);
          setSelectedFeedbackDetailId(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.feedbackModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Feedback</Text>
              <TouchableOpacity
                onPress={() => {
                  setFeedbackOrder(null);
                  setSelectedFeedbackDetailId(null);
                }}
                style={styles.closeModalBtn}
              >
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.sectionHeading}>Select Item</Text>
              <View style={styles.feedbackSelectListWrap}>
                <ScrollView style={styles.feedbackSelectList} nestedScrollEnabled>
                  {(feedbackOrder?.orderDetails ?? []).map((detail, index) => {
                    const detailId = getOrderDetailId(detail);
                    const isSelected = detailId > 0 && detailId === selectedFeedbackDetailId;
                    const isSubmitted = detailId > 0 && feedbackSubmittedDetailIds.includes(detailId);

                    return (
                      <TouchableOpacity
                        key={`${detailId || 'detail'}-${index}`}
                        style={[
                          styles.feedbackDetailItem,
                          isSelected && styles.feedbackDetailItemSelected,
                          isSubmitted && styles.feedbackDetailItemDisabled,
                        ]}
                        activeOpacity={0.8}
                        disabled={isSubmitted}
                        onPress={() => {
                          if (detailId > 0 && !isSubmitted) {
                            setSelectedFeedbackDetailId(detailId);
                          }
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.feedbackDetailName}>
                            {detail.ingredientName || `Order detail #${detailId || index + 1}`}
                          </Text>
                          <Text style={styles.feedbackDetailMeta}>
                            Qty: {detail.quantity || 1}
                          </Text>
                        </View>
                        {isSubmitted ? (
                          <Text style={styles.feedbackSubmittedTag}>Submitted</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <Text style={[styles.sectionHeading, { marginTop: 14 }]}>Feedback Form</Text>

              <Text style={styles.detailLabel}>Type</Text>
              <View style={styles.feedbackTypeRow}>
                {feedbackTypes.map((type) => {
                  const active = feedbackForm.type === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.feedbackTypeChip, active && styles.feedbackTypeChipActive]}
                      onPress={() => setFeedbackForm((prev) => ({ ...prev, type }))}
                      disabled={!selectedFeedbackDetailId}
                    >
                      <Text style={[styles.feedbackTypeChipText, active && styles.feedbackTypeChipTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.detailLabel}>Content</Text>
              <TextInput
                style={styles.feedbackContentInput}
                placeholder={selectedFeedbackDetailId ? 'Write your feedback...' : 'Select an unsubmitted item to feedback'}
                placeholderTextColor={COLORS.textSecondary}
                multiline
                editable={Boolean(selectedFeedbackDetailId)}
                value={feedbackForm.content}
                onChangeText={(text) => setFeedbackForm((prev) => ({ ...prev, content: text }))}
              />

              <Text style={styles.detailLabel}>Rating</Text>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((value) => {
                  const active = value <= feedbackForm.rating;
                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setFeedbackForm((prev) => ({ ...prev, rating: value }))}
                      style={styles.ratingButton}
                      disabled={!selectedFeedbackDetailId}
                    >
                      <Ionicons
                        name={active ? 'star' : 'star-outline'}
                        size={24}
                        color={active ? '#D4AF37' : COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.feedbackSubmitButton,
                  (submittingFeedback || !selectedFeedbackDetailId) && { opacity: 0.7 },
                ]}
                onPress={handleSubmitFeedback}
                disabled={submittingFeedback || !selectedFeedbackDetailId}
              >
                {submittingFeedback ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.feedbackSubmitText}>Submit Feedback</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const MOCK_IMAGE_URL = fallbackAssetUri;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  header: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    height: 180,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  statusScrollContainer: {
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  statusItem: {
    width: 62,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  statusIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.chip,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusIconWrapActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  statusText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    width: '100%',
  },
  statusTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  cardList: {
    paddingHorizontal: 16,
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
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  orderImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#E8CCBE',
  },
  orderInfo: {
    flex: 1,
    marginLeft: 10,
  },
  orderName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  orderDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  orderPrice: {
    fontSize: 11,
    color: COLORS.danger,
    fontWeight: '600',
  },
  actionButtons: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minWidth: 70,
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  cancelText: {
    color: COLORS.danger,
    fontSize: 10,
    fontWeight: '700',
  },
  orderCardMain: {
    flexDirection: 'row',
    padding: 12,
  },
  feedbackRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedbackTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedbackText: {
    marginLeft: 8,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  feedbackProgressText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  loadMoreButton: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  loadMoreText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E7D8C9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '85%',
    maxHeight: '80%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeModalBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    color: COLORS.text,
    flex: 2,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  timelineBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    paddingVertical: 10,
    marginBottom: 16,
  },
  timelineItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  timelineLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  timelineValue: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  addressBlock: {
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    padding: 12,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressIconWrap: {
    width: 24,
    alignItems: 'center',
    marginRight: 6,
    marginTop: 2,
  },
  addressTextWrap: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  addressValue: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  addressDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
    marginLeft: 30,
  },
  receiptBox: {
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    padding: 12,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  receiptItemQtyWrap: {
    width: 24,
  },
  receiptItemQty: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '600',
  },
  receiptItemNameWrap: {
    flex: 1,
    paddingRight: 8,
  },
  receiptItemName: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  receiptItemPrice: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  modalCancelButton: {
    marginTop: 20,
    backgroundColor: COLORS.danger,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  feedbackModalCard: {
    width: '88%',
    maxHeight: '82%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  feedbackDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  feedbackDetailItemSelected: {
    borderColor: COLORS.accent,
    backgroundColor: '#FDF6EE',
  },
  feedbackDetailItemDisabled: {
    opacity: 0.65,
  },
  feedbackSelectListWrap: {
    maxHeight: 160,
  },
  feedbackSelectList: {
    maxHeight: 160,
  },
  feedbackDetailName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  feedbackDetailMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  feedbackSubmittedTag: {
    fontSize: 10,
    color: '#2F7D4A',
    fontWeight: '700',
  },
  feedbackTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  feedbackTypeChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF',
  },
  feedbackTypeChipActive: {
    backgroundColor: '#FDF6EE',
    borderColor: COLORS.accent,
  },
  feedbackTypeChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  feedbackTypeChipTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  feedbackContentInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    minHeight: 90,
    textAlignVertical: 'top',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  ratingButton: {
    marginRight: 8,
  },
  feedbackSubmitButton: {
    backgroundColor: COLORS.text,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  feedbackSubmitText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
