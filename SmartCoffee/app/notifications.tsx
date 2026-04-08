import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';

type NotificationItemApi = {
  id?: string | number;
  notificationId?: string | number;
  title: string;
  message?: string;
  content?: string;
  body?: string;
  description?: string;
  type?: string;
  category?: string;
  isRead?: boolean;
  createdAt?: string;
  createDate?: string;
  sentAt?: string;
  [key: string]: unknown;
};

type NotificationItem = {
  id: string;
  notificationId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

const PAGE_SIZE = 5;
const NOTIFICATION_UNREAD_COUNT_KEY = 'notification:unread-count';

const toBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
};

const normalizeNotificationList = (payload: any): NotificationItemApi[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
};

const mapNotificationItem = (item: NotificationItemApi, index: number): NotificationItem => {
  const rawId = item.notificationId ?? item.id ?? index;
  const title = String(item.title ?? 'Notification').trim() || 'Notification';
  const message =
    String(item.message ?? item.content ?? item.body ?? item.description ?? '').trim() ||
    'No details.';
  const type = String(item.type ?? item.category ?? 'general');
  const createdAt = String(item.createdAt ?? item.createDate ?? item.sentAt ?? '');

  return {
    id: String(rawId),
    notificationId: String(rawId),
    title,
    message,
    type,
    isRead: toBoolean(item.isRead),
    createdAt,
  };
};

const getIcon = (type: string) => {
  const normalized = String(type).toLowerCase();
  if (normalized.includes('warn') || normalized.includes('alert')) {
    return { name: 'warning-outline', color: '#F36B2B', bg: '#FFF3E8' } as const;
  }
  if (normalized.includes('expir') || normalized.includes('time')) {
    return { name: 'time-outline', color: '#E07A0A', bg: '#FFF6E6' } as const;
  }
  if (normalized.includes('out') || normalized.includes('stock')) {
    return { name: 'cube-outline', color: '#E02323', bg: '#FFECEC' } as const;
  }
  return { name: 'notifications-outline', color: '#8B5E3C', bg: '#F5EDE3' } as const;
};

const formatTime = (value: string) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';

  const now = Date.now();
  const diffMs = now - parsed.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  try {
    return parsed.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return parsed.toISOString();
  }
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { accountId } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const persistUnreadCount = useCallback(async (count: number) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_UNREAD_COUNT_KEY, String(Math.max(0, count)));
    } catch {
      // Ignore storage write errors.
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await authorizedFetch(API_ENDPOINTS.notification.unreadCount(), {
        headers: { Accept: '*/*' },
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const resolved = Number(
        typeof payload === 'number'
          ? payload
          : payload?.count ?? payload?.unreadCount ?? payload?.data ?? 0
      );
      const normalized = Number.isFinite(resolved) ? resolved : 0;
      setUnreadCount(normalized);
      await persistUnreadCount(normalized);
    } catch {
      setUnreadCount(0);
      await persistUnreadCount(0);
    }
  }, [persistUnreadCount]);

  const fetchNotifications = useCallback(
    async (nextPage = 1, isLoadMore = false) => {
      if (!accountId) {
        setNotifications([]);
        setHasMore(false);
        setError('Missing account id.');
        return;
      }

      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const response = await authorizedFetch(
          API_ENDPOINTS.notification.listByAccount(accountId, {
            page: nextPage,
            pageSize: PAGE_SIZE,
          }),
          {
            headers: { Accept: '*/*' },
          }
        );

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const payload = await response.json();
        const rawItems = normalizeNotificationList(payload);
        const mapped = rawItems.map(mapNotificationItem);

        if (isLoadMore) {
          setNotifications((prev) => [...prev, ...mapped]);
        } else {
          setNotifications(mapped);
        }

        setPage(nextPage);

        const totalCount = Number(
          payload?.totalCount ?? payload?.total ?? payload?.totalItems ?? payload?.data?.totalCount ?? 0
        );
        if (Number.isFinite(totalCount) && totalCount > 0) {
          const currentLength = isLoadMore ? notifications.length + mapped.length : mapped.length;
          setHasMore(currentLength < totalCount);
        } else {
          setHasMore(mapped.length >= PAGE_SIZE);
        }

        // After loading notifications, refresh unread count as requested.
        await fetchUnreadCount();
      } catch (fetchError) {
        setError('Unable to load notifications.');
        if (!isLoadMore) {
          setNotifications([]);
        }
      } finally {
        if (isLoadMore) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [accountId, fetchUnreadCount, notifications.length]
  );

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    try {
      setRefreshing(true);
      await fetchNotifications(1, false);
    } finally {
      setRefreshing(false);
    }
  }, [fetchNotifications, refreshing]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) {
      return;
    }
    await fetchNotifications(page + 1, true);
  }, [fetchNotifications, hasMore, loading, loadingMore, page]);

  const handleOpenNotification = useCallback(
    async (item: NotificationItem) => {
      if (item.isRead) {
        return;
      }

      try {
        const response = await authorizedFetch(API_ENDPOINTS.notification.markRead(item.notificationId), {
          method: 'PUT',
          headers: {
            Accept: '*/*',
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        setNotifications((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  isRead: true,
                }
              : entry
          )
        );

        setUnreadCount((prev) => {
          const next = Math.max(prev - 1, 0);
          persistUnreadCount(next);
          return next;
        });
      } catch {
        // Ignore update error to avoid blocking navigation in future enhancements.
      }
    },
    [persistUnreadCount]
  );

  useEffect(() => {
    fetchNotifications(1, false);
  }, [fetchNotifications]);

  const emptyMessage = useMemo(() => {
    if (loading) return 'Loading notifications...';
    if (error) return error;
    return 'No notifications yet.';
  }, [error, loading]);

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const icon = getIcon(item.type);

    return (
      <TouchableOpacity
        style={[styles.card, !item.isRead && styles.cardUnread]}
        activeOpacity={0.9}
        onPress={() => handleOpenNotification(item)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name} size={22} color={icon.color} />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMessage}>{item.message}</Text>
          </View>
          <View style={styles.cardTimeWrap}>
            {!item.isRead ? <View style={styles.unreadDot} /> : null}
            <Text style={styles.cardTime}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>

        {!item.isRead ? <Text style={styles.tapHint}>Tap to mark as read</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#3F2A1D" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.unreadSummary}>{unreadCount} unread</Text>
        </View>
        <View style={styles.iconButton} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.4}
        onEndReached={handleLoadMore}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={<Text style={styles.emptyText}>{emptyMessage}</Text>}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator size="small" color="#6D5A4B" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F4EF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3F2A1D',
  },
  unreadSummary: {
    fontSize: 12,
    color: '#9A8A79',
    marginTop: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyText: {
    color: '#9A8A79',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardUnread: {
    borderWidth: 1,
    borderColor: '#ECD8C0',
    backgroundColor: '#FFF9F2',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitleWrap: {
    flex: 1,
    paddingRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3F2A1D',
    marginBottom: 4,
  },
  cardMessage: {
    fontSize: 14,
    color: '#6D5A4B',
    lineHeight: 20,
  },
  cardTimeWrap: {
    alignItems: 'flex-end',
    gap: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D48B34',
  },
  cardTime: {
    fontSize: 12,
    color: '#B3A495',
  },
  tapHint: {
    marginTop: 10,
    fontSize: 12,
    color: '#8B5E3C',
    fontWeight: '600',
  },
  footerLoading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
