import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';

type WithdrawalItem = {
  withdrawId: number;
  walletId: number;
  accountName: string;
  amount: number;
  status: string;
  balanceBefore: number;
  balanceAfter: number;
  createAt: string;
};

type WithdrawalResponse = {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: WithdrawalItem[];
};

const PAGE_SIZE = 10;

const formatVnd = (value: number) => value.toLocaleString('en-US');

const toVnTime = (value: string) => {
  const hasTz = /z$|[+-]\d{2}:?\d{2}$/i.test(value);
  const parsed = new Date(hasTz ? value : `${value}Z`);
  return Number.isNaN(parsed.getTime()) ? new Date(value) : parsed;
};

const formatDateLabel = (value: string) => {
  const date = toVnTime(value);
  return date.toLocaleDateString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' });
};

const formatDateTime = (value: string) => {
  const date = toVnTime(value);
  const day = date.toLocaleDateString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' });
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  return `${day} ${time}`;
};

const getStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return { bg: '#E6F4EA', text: '#1E7F46' };
    case 'pending':
      return { bg: '#FFF4E5', text: '#B86A00' };
    case 'processing':
      return { bg: '#E8F0FE', text: '#2A5DB0' };
    case 'rejected':
    case 'failed':
      return { bg: '#FDECEA', text: '#B42318' };
    default:
      return { bg: '#F2F2F2', text: '#555' };
  }
};

export default function WalletWithdrawHistoryScreen() {
  const router = useRouter();
  const { walletId } = useAuth();

  const [items, setItems] = useState<WithdrawalItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('All');

  const fetchPage = useCallback(
    async (pageToLoad: number, options?: { refresh?: boolean }) => {
      if (!walletId) return;
      if (pageToLoad === 1 && !options?.refresh) {
        setLoading(true);
      }
      try {
        const response = await authorizedFetch(
          API_ENDPOINTS.wallet.withdrawalsByWallet(walletId, {
            page: pageToLoad,
            pageSize: PAGE_SIZE,
          })
        );
        const data = (await response.json()) as WithdrawalResponse;
        if (!response.ok) {
          throw new Error('Failed to load withdrawal history.');
        }
        setTotalCount(data.totalCount ?? 0);
        setPage(data.page ?? pageToLoad);
        setTotalPages(data.totalPages ?? 1);
        setItems(prev => (pageToLoad === 1 ? data.items ?? [] : [...prev, ...(data.items ?? [])]));
      } catch {
        if (pageToLoad === 1) {
          setItems([]);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [walletId]
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPage(1, { refresh: true });
  }, [fetchPage]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || loading || page >= totalPages) return;
    setLoadingMore(true);
    fetchPage(page + 1);
  }, [fetchPage, loadingMore, loading, page, totalPages]);

  React.useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  const statusOptions = useMemo(() => {
    const unique = Array.from(new Set(items.map(item => item.status).filter(Boolean)));
    return ['All', ...unique];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (selectedStatus === 'All') return items;
    return items.filter(item => item.status === selectedStatus);
  }, [items, selectedStatus]);

  const sections = useMemo(() => {
    const sorted = [...filteredItems].sort(
      (a, b) => new Date(b.createAt).getTime() - new Date(a.createAt).getTime()
    );
    const grouped = new Map<string, WithdrawalItem[]>();
    sorted.forEach(item => {
      const key = formatDateLabel(item.createAt);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(item);
    });
    return Array.from(grouped.entries()).map(([title, data]) => ({ title, data }));
  }, [filteredItems]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
            <Ionicons name="arrow-back" size={22} color="#2F2A25" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Withdrawal history</Text>
            <Text style={styles.headerSubtitle}>{totalCount} transactions</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>Filter status</Text>
          <View style={styles.filterRow}>
            {statusOptions.map(status => {
              const isActive = status === selectedStatus;
              return (
                <TouchableOpacity
                  key={status}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setSelectedStatus(status)}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#A36D2D" />
            <Text style={styles.loadingText}>Loading history...</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={item => String(item.withdrawId)}
            contentContainerStyle={styles.listContent}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item }) => {
              const statusStyle = getStatusStyle(item.status);
              return (
                <View style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.amount}>{formatVnd(item.amount)} VND</Text>
                    <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}
                    >
                      <Text style={[styles.statusText, { color: statusStyle.text }]}>
                        {item.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>Account: {item.accountName}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.time}>{formatDateTime(item.createAt)}</Text>
                    <Text style={styles.balance}>Balance: {formatVnd(item.balanceAfter)} VND</Text>
                  </View>
                </View>
              );
            }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#A36D2D" />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.2}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="wallet-outline" size={32} color="#C7B39A" />
                <Text style={styles.emptyText}>No withdrawal transactions yet.</Text>
              </View>
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color="#A36D2D" />
                  <Text style={styles.loadingMoreText}>Loading more...</Text>
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F6EFE6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#FFF',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2F2A25',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8A6A3B',
    marginTop: 2,
  },
  filterCard: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 6,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3E342A',
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F5F1EC',
  },
  filterChipActive: {
    backgroundColor: '#A36D2D',
  },
  filterChipText: {
    fontSize: 12,
    color: '#6F5840',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3E342A',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2F2A25',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  meta: {
    marginTop: 8,
    fontSize: 12,
    color: '#6E6258',
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  time: {
    fontSize: 12,
    color: '#6E6258',
  },
  balance: {
    fontSize: 12,
    color: '#6E6258',
    fontWeight: '600',
  },
  loadingWrap: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#6E6258',
  },
  loadingMore: {
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
  },
  loadingMoreText: {
    fontSize: 12,
    color: '#6E6258',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: '#7B6A58',
  },
});
