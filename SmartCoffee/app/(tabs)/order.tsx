import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
  createAt?: string;
  supplierId?: number;
};

type PagedOrderResponse = {
  items?: OrderResponse[];
};

export default function OrderScreen() {
  const router = useRouter();
  const { accountId } = useAuth();
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const formatVnd = (value: number) =>
    value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

  useEffect(() => {
    const loadOrders = async () => {
      if (!accountId) {
        setOrders([]);
        return;
      }

      try {
        setLoading(true);
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
      }
    };

    loadOrders();
  }, [accountId]);

  const visibleOrders = useMemo(() => {
    const filtered = orders.filter((order) => {
      const status = String(order.status ?? '').toLowerCase();
      return status === selectedStatus;
    });
    return filtered.slice(0, 10);
  }, [orders, selectedStatus]);
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
                onPress={() => setSelectedStatus(item.key)}
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
              <View key={String(order.orderId ?? Math.random())} style={styles.orderCard}>
                <Image source={{ uri: fallbackOrderImage }} style={styles.orderImage} />
                <View style={styles.orderInfo}>
                  <Text style={styles.orderName}>Order #{order.orderId ?? '-'}</Text>
                  <Text style={styles.orderDesc}>{order.status ?? 'Pending'}</Text>
                  <Text style={styles.orderPrice}>
                    {formatVnd(order.totalPrice ?? 0)} vnd
                  </Text>
                </View>
                <TouchableOpacity style={styles.reorderButton}>
                  <Text style={styles.reorderText}>Re-Order</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.loadMoreButton}>
          <Text style={styles.loadMoreText}>Load more</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/product-page')}>
        <Ionicons name="add" size={24} color={COLORS.text} />
      </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
