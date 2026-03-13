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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/auth-context';
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

const headerImage =
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80';

const statuses = [
  { key: 'pending', label: 'Pending', icon: 'hourglass-outline' },
  { key: 'preparing', label: 'Preparing', icon: 'cafe-outline' },
  { key: 'delivering', label: 'Delivering', icon: 'bicycle-outline' },
  { key: 'delivered', label: 'Delivered', icon: 'checkmark-circle-outline' },
  { key: 'rejected', label: 'Rejected', icon: 'close-circle-outline' },
  { key: 'refunded', label: 'Refunded', icon: 'cash-outline' },
];

const fallbackOrderImage =
  'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=400&q=80';

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
  orderDetails?: { ingredientName?: string; quantity?: number; price?: number }[];
};

type PagedOrderResponse = {
  items?: OrderResponse[];
};

export default function OrderScreen() {
  const router = useRouter();
  const { accountId } = useAuth();
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [visibleCount, setVisibleCount] = useState(4);
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null);

  const formatVnd = (value: number) =>
    value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (!accountId) {
      setOrders([]);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const response = await authorizedFetch(API_ENDPOINTS.order.byOwner(accountId), {
        headers: {
          Accept: '*/*',
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = (await response.json()) as OrderResponse[] | PagedOrderResponse;
      if (Array.isArray(data)) {
        setOrders(data);
      } else if (Array.isArray(data?.items)) {
        setOrders(data.items);
      } else {
        setOrders([]);
      }
    } catch (err) {
      setError('Unable to load orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accountId]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const onRefresh = useCallback(() => {
    setVisibleCount(4);
    loadOrders(true);
  }, [loadOrders]);

  // When status changes: reset visible slice
  const handleStatusChange = (key: string) => {
    setSelectedStatus(key);
    setVisibleCount(4);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const status = String(order.status ?? '').toLowerCase();
      return status === selectedStatus;
    });
  }, [orders, selectedStatus]);

  const visibleOrders = filteredOrders.slice(0, visibleCount);
  const hasMore = visibleCount < filteredOrders.length;
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

        <View style={styles.statusRow}>
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
                    size={18}
                    color={isActive ? COLORS.white : COLORS.chipText}
                  />
                </View>
                <Text style={[styles.statusText, isActive && styles.statusTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.cardList}>
          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.emptyText}>Loading orders...</Text>
            </View>
          ) : error ? (
            <Text style={styles.emptyText}>{error}</Text>
          ) : visibleOrders.length === 0 ? (
            <Text style={styles.emptyText}>No recent orders.</Text>
          ) : (
            visibleOrders.map((order) => (
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
                      {formatVnd(order.totalPrice ?? 0)} vnd
                    </Text>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.reorderButton}>
                      <Text style={styles.reorderText}>Re-Order</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Bottom row for Feedback when Delivered */}
                {String(order.status ?? '').toLowerCase() === 'delivered' && (
                  <View style={styles.feedbackRow}>
                    <TouchableOpacity
                      style={styles.feedbackTouchable}
                      activeOpacity={0.6}
                      onPress={(e) => {
                        e.stopPropagation(); // Prevent opening modal just by clicking feedback
                        router.push({
                          pathname: '/feedback',
                          params: { orderData: JSON.stringify(order) },
                        });
                      }}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color="#D4AF37" />
                      <Text style={styles.feedbackText}>Đánh giá</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {hasMore ? (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => setVisibleCount((c) => c + 4)}
            activeOpacity={0.7}
          >
            <Text style={styles.loadMoreText}>Load more</Text>
          </TouchableOpacity>
        ) : filteredOrders.length > 0 ? (
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
                    ? `${formatVnd(selectedOrder.shippingFee)} vnd`
                    : '0 vnd'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Price:</Text>
                <Text style={[styles.detailValue, { color: COLORS.danger, fontWeight: '700' }]}>
                  {selectedOrder?.totalPrice ? formatVnd(selectedOrder.totalPrice) : 0} vnd
                </Text>
              </View>


              <View style={styles.divider} />

              <Text style={styles.sectionHeading}>Shipping Info</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Expected Delivery:</Text>
                <Text style={styles.detailValue}>
                  {selectedOrder?.expectedDeliveryTime
                    ? new Date(selectedOrder.expectedDeliveryTime).toLocaleString()
                    : 'N/A'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Ship Date:</Text>
                <Text style={styles.detailValue}>
                  {selectedOrder?.shipDate ? new Date(selectedOrder.shipDate).toLocaleString() : 'N/A'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Receive Date:</Text>
                <Text style={styles.detailValue}>
                  {selectedOrder?.receiveDate ? new Date(selectedOrder.receiveDate).toLocaleString() : 'N/A'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Ship Address:</Text>
                <Text style={styles.detailValue}>{selectedOrder?.shipAddress || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Receive Address:</Text>
                <Text style={styles.detailValue}>{selectedOrder?.receiveAddress || 'N/A'}</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionHeading}>Items</Text>
              {selectedOrder?.orderDetails?.map((item, idx) => (
                <View key={idx} style={styles.detailItemRow}>
                  <Text style={styles.detailItemName}>
                    {item.quantity || 1}x {item.ingredientName}
                  </Text>
                  <Text style={styles.detailItemPrice}>
                    {item.price ? formatVnd(item.price) : 0} đ
                  </Text>
                </View>
              ))}
            </ScrollView>
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
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  statusItem: {
    alignItems: 'center',
    width: 54,
  },
  statusIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
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
    fontSize: 9,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
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
  reorderButton: {
    backgroundColor: COLORS.text,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  reorderText: {
    color: COLORS.white,
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
  detailItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailItemName: {
    fontSize: 13,
    color: COLORS.text,
  },
  detailItemPrice: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
