import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import Toast from 'react-native-toast-message';

const COLORS = {
  bg: '#F7F3EF',
  white: '#FFFFFF',
  text: '#3C2A21',
  textSecondary: '#8E7B6F',
  border: '#E8E1D9',
  primary: '#A36D2D',
  primarySoft: '#EFE5D9',
  chip: '#F1E9DF',
  chipText: '#5B4639',
  successBg: '#E3F7E6',
  successText: '#2F7D4D',
  warningBg: '#FFF2DE',
  warningText: '#9B6A2F',
  dangerBg: '#FDECEC',
  dangerText: '#A33434',
  infoBg: '#F3EBDD',
  infoText: '#7A5D42',
  noteBg: '#F3EEE8',
  noteText: '#6F6055',
  errorBorder: '#F3C9C9',
  totalText: '#5A3F2A',
};

const ORDER_PAGE_SIZE = 6;

const ORDER_STATUSES = [
  { key: 'all', label: 'All', apiLabel: '' },
  { key: 'pending', label: 'Pending', apiLabel: 'Pending' },
  { key: 'preparing', label: 'Preparing', apiLabel: 'Preparing' },
  { key: 'delivering', label: 'Delivering', apiLabel: 'Delivering' },
  { key: 'delivered', label: 'Delivered', apiLabel: 'Delivered' },
  { key: 'completed', label: 'Completed', apiLabel: 'Completed' },
  { key: 'cancelled', label: 'Cancelled', apiLabel: 'Cancelled' },
  { key: 'rejected', label: 'Rejected', apiLabel: 'Rejected' },
  { key: 'refunded', label: 'Refunded', apiLabel: 'Refunded' },
];

type OrderDetailItem = {
  orderDetailId?: number;
  ingredientName?: string;
  type?: string;
  quantity?: number;
};

type OrderItem = {
  orderId?: number;
  status?: string;
  totalPrice?: number;
  shippingFee?: number;
  createAt?: string;
  notes?: string;
  supplierId?: number;
  receiveAddress?: string;
  orderDetails?: OrderDetailItem[];
};

type PagedOrderResponse = {
  totalCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  items?: OrderItem[];
};

const formatDateTime = (value?: string) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRelativeTime = (value?: string) => {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  const diffMs = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return 'Just now';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} min ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} hours ago`;
  return `${Math.floor(diffMs / day)} days ago`;
};

const formatStatusLabel = (status?: string) => {
  if (!status) return 'Unknown';
  return status.toUpperCase();
};

const getStatusStyles = (status?: string) => {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'completed' || normalized === 'delivered') {
    return { bg: COLORS.successBg, text: COLORS.successText };
  }
  if (normalized === 'cancelled' || normalized === 'rejected' || normalized === 'refunded') {
    return { bg: COLORS.dangerBg, text: COLORS.dangerText };
  }
  if (normalized === 'pending') {
    return { bg: COLORS.warningBg, text: COLORS.warningText };
  }
  return { bg: COLORS.infoBg, text: COLORS.infoText };
};

export default function StaffOrdersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string | string[] }>();
  const { ownerId } = useAuth();
  const resolvedOwnerId = useMemo(() => ownerId ?? null, [ownerId]);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const selectedStatusLabel = useMemo(() => {
    return ORDER_STATUSES.find((item) => item.key === selectedStatus)?.label ?? 'All';
  }, [selectedStatus]);

  const mappedStatusFromParam = useMemo(() => {
    const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
    if (!rawStatus) return null;

    const normalized = rawStatus.trim().toLowerCase();
    const matched = ORDER_STATUSES.find(
      (item) =>
        item.key.toLowerCase() === normalized ||
        item.label.toLowerCase() === normalized ||
        item.apiLabel.toLowerCase() === normalized
    );

    return matched?.key ?? null;
  }, [params.status]);

  const normalizedSearchQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const filteredOrders = useMemo(() => {
    if (!normalizedSearchQuery) return orders;

    return orders.filter((order) => {
      const searchableText = [
        order.orderId ? `ord-${order.orderId}` : '',
        order.orderId ?? '',
        order.supplierId ? `supplier ${order.supplierId}` : '',
        order.receiveAddress ?? '',
        order.status ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedSearchQuery);
    });
  }, [orders, normalizedSearchQuery]);

  const loadOrders = useCallback(
    async (options?: { page?: number; append?: boolean; isRefresh?: boolean; statusKey?: string }) => {
      const page = options?.page ?? 1;
      const append = Boolean(options?.append);
      const isRefresh = Boolean(options?.isRefresh);
      const statusKey = options?.statusKey ?? selectedStatus;

      if (!resolvedOwnerId) {
        setOrders([]);
        setError('Missing owner ID. Unable to load orders.');
        return;
      }

      const selectedStatusConfig = ORDER_STATUSES.find((item) => item.key === statusKey);
      const orderStatus = selectedStatusConfig?.apiLabel || undefined;

      try {
        if (isRefresh) setRefreshing(true);
        else if (append) setLoadingMore(true);
        else setLoading(true);

        setError(null);

        const response = await authorizedFetch(
          API_ENDPOINTS.order.byOwner(resolvedOwnerId, {
            page,
            pageSize: ORDER_PAGE_SIZE,
            orderStatus,
          }),
          { headers: { Accept: '*/*' } }
        );

        if (!response.ok) {
          throw new Error(`Unable to fetch orders (${response.status})`);
        }

        const data = (await response.json()) as PagedOrderResponse | OrderItem[];
        const nextOrders = Array.isArray(data) ? data : data.items ?? [];
        const nextTotalPages = Array.isArray(data) ? 1 : Number(data.totalPages ?? 1);

        setOrders((prev) => (append ? [...prev, ...nextOrders] : nextOrders));
        setCurrentPage(page);
        setTotalPages(nextTotalPages > 0 ? nextTotalPages : 1);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : 'Failed to load orders.';
        setError(message);
        if (!append) setOrders([]);
      } finally {
        if (isRefresh) setRefreshing(false);
        else if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [resolvedOwnerId, selectedStatus]
  );

  useFocusEffect(
    useCallback(() => {
      loadOrders({ page: 1, append: false, statusKey: selectedStatus });
    }, [loadOrders, selectedStatus])
  );

  const onRefresh = useCallback(() => {
    loadOrders({ page: 1, append: false, isRefresh: true, statusKey: selectedStatus });
  }, [loadOrders, selectedStatus]);

  const onChangeStatus = useCallback((key: string) => {
    setSelectedStatus(key);
    setCurrentPage(1);
    setTotalPages(1);
    setOrders([]);
  }, []);

  useEffect(() => {
    if (!mappedStatusFromParam) return;
    if (mappedStatusFromParam === selectedStatus) return;
    onChangeStatus(mappedStatusFromParam);
  }, [mappedStatusFromParam, onChangeStatus, selectedStatus]);

  const onLoadMore = useCallback(() => {
    if (loadingMore || loading || currentPage >= totalPages) return;
    loadOrders({ page: currentPage + 1, append: true, statusKey: selectedStatus });
  }, [currentPage, loadOrders, loading, loadingMore, selectedStatus, totalPages]);

  const openOrderDetail = useCallback(
    (order: OrderItem) => {
      if (!order.orderId) {
        Toast.show({ type: 'error', text1: 'Invalid order selected' });
        return;
      }
      router.push({
        pathname: '/staff-order-detail/[orderId]',
        params: { orderId: String(order.orderId) },
      });
    },
    [router]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.screenHeader}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>Tap an order card to view full details.</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search order ID, supplier, status, address..."
          placeholderTextColor={COLORS.textSecondary}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn} activeOpacity={0.8}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item, index) => `${item.orderId ?? 'order'}-${index}`}
        renderItem={({ item }) => {
          const statusStyles = getStatusStyles(item.status);
          const itemCount = item.orderDetails?.length ?? 0;

          return (
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.card, { borderLeftColor: statusStyles.text }]}
              onPress={() => openOrderDetail(item)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderMain}>
                  <Text style={styles.orderCode}>#ORD-{item.orderId ?? '--'}</Text>
                  <View style={styles.timeRow}>
                    <Ionicons name="time-outline" size={13} color={COLORS.textSecondary} />
                    <Text style={styles.orderTime}>{formatRelativeTime(item.createAt)}</Text>
                  </View>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: statusStyles.bg }]}>
                  <Text style={[styles.statusText, { color: statusStyles.text }]}>
                    {formatStatusLabel(item.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.orderDate}>{formatDateTime(item.createAt)}</Text>

              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.infoText} numberOfLines={1}>
                  {item.receiveAddress || 'No delivery address'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="business-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.infoText}>Supplier #{item.supplierId ?? '--'}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.cardFooterRow}>
                <View style={styles.metaBadge}>
                  <Ionicons name="cube-outline" size={13} color={COLORS.primary} />
                  <Text style={styles.metaBadgeText}>{itemCount} items</Text>
                </View>

                <View style={styles.tapHintWrap}>
                  <Text style={styles.tapHintText}>Tap to view details</Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListHeaderComponent={
          <View>
            <Text style={styles.filterCaption}>
              {filteredOrders.length}/{orders.length} orders - {selectedStatusLabel}
            </Text>

            <FlatList
              horizontal
              data={ORDER_STATUSES}
              keyExtractor={(item) => item.key}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusContainer}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.statusChip, selectedStatus === item.key && styles.statusChipActive]}
                  onPress={() => onChangeStatus(item.key)}
                >
                  <Text style={[styles.statusChipText, selectedStatus === item.key && styles.statusChipTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={COLORS.dangerText} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="receipt-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>No orders found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'No matching orders. Try another keyword.'
                  : 'Try another status or pull down to refresh.'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMoreWrap}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : null
        }
        onEndReachedThreshold={0.35}
        onEndReached={onLoadMore}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.listContent}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={60}
        windowSize={7}
        removeClippedSubviews
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  screenHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  searchWrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 2,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    paddingVertical: 8,
  },
  clearSearchBtn: {
    padding: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    flexGrow: 1,
  },
  filterCaption: {
    marginTop: 10,
    marginBottom: 6,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  statusContainer: {
    paddingTop: 0,
    paddingBottom: 12,
    gap: 8,
  },
  statusChip: {
    backgroundColor: COLORS.chip,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusChipText: {
    color: COLORS.chipText,
    fontSize: 13,
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: COLORS.white,
  },
  errorBox: {
    marginBottom: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: COLORS.dangerText,
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },
  cardHeaderMain: {
    flex: 1,
  },
  orderCode: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  timeRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  orderDate: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  infoRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  divider: {
    marginTop: 12,
    marginBottom: 10,
    height: 1,
    backgroundColor: COLORS.border,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaBadgeText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  tapHintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tapHintText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  emptyWrap: {
    marginTop: 72,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySoft,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  loadingMoreWrap: {
    paddingVertical: 14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(247,243,239,0.55)',
  },
});
