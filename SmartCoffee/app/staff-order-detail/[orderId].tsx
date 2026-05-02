import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

const COLORS = {
  bg: '#F7F3EF',
  text: '#3C2A21',
  textSecondary: '#8E7B6F',
  border: '#E8E1D9',
  accent: '#A36D2D',
  accentSoft: '#F1E9DF',
  white: '#FFFFFF',
  successBg: '#E3F7E6',
  successText: '#2F7D4D',
  warningBg: '#FFF2DE',
  warningText: '#9B6A2F',
  infoBg: '#F3EBDD',
  infoText: '#7A5D42',
  dangerBg: '#FDECEC',
  danger: '#A33434',
};

type OrderDetailItem = {
  orderDetailId?: number;
  type?: string;
  ingredientId?: number;
  ingredientName?: string;
  quantity?: number;
  price?: number;
};

type OrderItem = {
  orderId?: number;
  status?: string;
  totalPrice?: number;
  shippingFee?: number;
  createAt?: string;
  notes?: string;
  supplierId?: number;
  shipAddress?: string;
  receiveAddress?: string;
  shipDate?: string;
  receiveDate?: string;
  expectedDeliveryTime?: string;
  orderDetails?: OrderDetailItem[];
};

const getSupplierNameFromPayload = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, any>;

  const nameCandidates = [
    data.supplierName,
    data.SupplierName,
    data.name,
    data.supplier?.supplierName,
    data.supplier?.SupplierName,
    data.supplier?.name,
  ];

  for (const candidate of nameCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
};

const formatVnd = (value?: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

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

const formatStatusLabel = (status?: string) => {
  if (!status) return 'UNKNOWN';
  return status.toUpperCase();
};

const getStatusStyles = (status?: string) => {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'completed' || normalized === 'delivered') {
    return { bg: COLORS.successBg, text: COLORS.successText };
  }
  if (normalized === 'pending') {
    return { bg: COLORS.warningBg, text: COLORS.warningText };
  }
  if (normalized === 'cancelled' || normalized === 'rejected' || normalized === 'refunded') {
    return { bg: COLORS.dangerBg, text: COLORS.danger };
  }
  return { bg: COLORS.infoBg, text: COLORS.infoText };
};

export default function StaffOrderDetailScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string | string[] }>();
  const parsedOrderId = useMemo(() => {
    const value = Array.isArray(orderId) ? orderId[0] : orderId;
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [orderId]);

  const [order, setOrder] = useState<OrderItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState<string | null>(null);

  const loadOrderDetail = useCallback(
    async (isRefresh?: boolean) => {
      if (!parsedOrderId) {
        setError('Invalid order id.');
        return;
      }

      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setError(null);

        const response = await authorizedFetch(API_ENDPOINTS.order.byId(parsedOrderId), {
          headers: {
            Accept: '*/*',
          },
        });

        if (!response.ok) {
          throw new Error(`Unable to fetch order detail (${response.status})`);
        }

        const data = (await response.json()) as OrderItem & Record<string, unknown>;
        const supplierId = Number(data.supplierId ?? 0);
        let nextSupplierName = getSupplierNameFromPayload(data);

        if (!nextSupplierName && Number.isFinite(supplierId) && supplierId > 0) {
          try {
            const supplierResponse = await authorizedFetch(`${API_ENDPOINTS.supplier.list()}/${supplierId}`, {
              headers: {
                Accept: '*/*',
              },
            });

            if (supplierResponse.ok) {
              const supplierData = (await supplierResponse.json()) as Record<string, unknown>;
              nextSupplierName = getSupplierNameFromPayload(supplierData);
            }
          } catch {
            // Keep fallback display when supplier lookup fails.
          }
        }

        setOrder(data);
        setSupplierName(nextSupplierName);
      } catch (detailError) {
        const message = detailError instanceof Error ? detailError.message : 'Load detail failed.';
        setError(message);
        setOrder(null);
        setSupplierName(null);
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [parsedOrderId]
  );

  React.useEffect(() => {
    loadOrderDetail();
  }, [loadOrderDetail]);

  const onRefresh = useCallback(() => {
    loadOrderDetail(true);
  }, [loadOrderDetail]);

  const summaryRows = useMemo(() => {
    if (!order) return [];
    const supplierValue = supplierName || (order.supplierId ? `#${order.supplierId}` : '--');

    return [
      { label: 'Supplier', value: supplierValue },
      { label: 'Shipping fee', value: formatVnd(order.shippingFee) },
      { label: 'Total amount', value: formatVnd(order.totalPrice) },
      { label: 'Total line items', value: String(order.orderDetails?.length ?? 0) },
    ];
  }, [order, supplierName]);

  const timelineRows = useMemo(() => {
    if (!order) return [];
    return [
      { label: 'Created at', value: formatDateTime(order.createAt) },
      { label: 'Ship date', value: formatDateTime(order.shipDate) },
      { label: 'Expected delivery', value: formatDateTime(order.expectedDeliveryTime) },
      { label: 'Received at', value: formatDateTime(order.receiveDate) },
    ];
  }, [order]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Order Detail</Text>
          <Text style={styles.headerSubtitle}>Order #{parsedOrderId || '--'}</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        contentContainerStyle={styles.content}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>Unable to load order details</Text>
            <Text style={styles.errorSub}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                Toast.show({ type: 'info', text1: 'Reloading order details...' });
                loadOrderDetail();
              }}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && !error && order ? (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <View>
                  <Text style={styles.heroLabel}>Order</Text>
                  <Text style={styles.heroCode}>#ORD-{order.orderId ?? '--'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusStyles(order.status).bg }]}>
                  <Text style={[styles.statusText, { color: getStatusStyles(order.status).text }]}>
                    {formatStatusLabel(order.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.heroFooter}>
                <View style={styles.heroMeta}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.heroMetaText}>{formatDateTime(order.createAt)}</Text>
                </View>
                <View style={styles.heroMeta}>
                  <Ionicons name="cube-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.heroMetaText}>{order.orderDetails?.length ?? 0} items</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Order Summary</Text>
              {summaryRows.map((row) => (
                <View key={row.label} style={styles.row}>
                  <Text style={styles.label}>{row.label}</Text>
                  <Text style={styles.value}>{row.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Timeline</Text>
              {timelineRows.map((row) => (
                <View key={row.label} style={styles.row}>
                  <Text style={styles.label}>{row.label}</Text>
                  <Text style={styles.value}>{row.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Addresses</Text>
              <View style={styles.addressItem}>
                <View style={styles.addressIconWrap}>
                  <Ionicons name="navigate-outline" size={15} color={COLORS.accent} />
                </View>
                <View style={styles.addressBody}>
                  <Text style={styles.addressLabel}>Ship address</Text>
                  <Text style={styles.addressValue}>{order.shipAddress || '--'}</Text>
                </View>
              </View>
              <View style={styles.addressItem}>
                <View style={styles.addressIconWrap}>
                  <Ionicons name="location-outline" size={15} color={COLORS.accent} />
                </View>
                <View style={styles.addressBody}>
                  <Text style={styles.addressLabel}>Receive address</Text>
                  <Text style={styles.addressValue}>{order.receiveAddress || '--'}</Text>
                </View>
              </View>
            </View>

            {order.notes ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <View style={styles.noteBox}>
                  <Ionicons name="chatbox-ellipses-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.noteText}>{order.notes}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Order Items</Text>
                <Text style={styles.sectionCount}>{order.orderDetails?.length ?? 0}</Text>
              </View>
              {order.orderDetails?.length ? (
                order.orderDetails.map((item, index) => (
                  <View
                    key={`${item.orderDetailId ?? 'detail'}-${index}`}
                    style={[styles.detailItem, index !== (order.orderDetails?.length ?? 0) - 1 && styles.detailBorder]}
                  >
                    <View style={styles.detailTop}>
                      <Text style={styles.detailName}>{item.ingredientName || `Item #${index + 1}`}</Text>
                      <Text style={styles.detailPrice}>{formatVnd(item.price)}</Text>
                    </View>
                    <View style={styles.detailMetaWrap}>
                      <Text style={styles.detailMeta}>Qty: {item.quantity ?? 0}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyDetail}>No order details available.</Text>
              )}
            </View>
          </>
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
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  center: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.danger,
    textAlign: 'center',
  },
  errorSub: {
    marginTop: 6,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 14,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  heroLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  heroCode: {
    marginTop: 3,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  heroFooter: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    flexDirection: 'row',
    gap: 16,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sectionCount: {
    minWidth: 28,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  addressIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  addressBody: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  addressValue: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 19,
  },
  noteBox: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  noteText: {
    flex: 1,
    color: COLORS.text,
    lineHeight: 20,
    fontSize: 13,
  },
  detailItem: {
    paddingVertical: 10,
  },
  detailBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  detailPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
  },
  detailMetaWrap: {
    marginTop: 5,
    gap: 2,
  },
  detailMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  emptyDetail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
});
