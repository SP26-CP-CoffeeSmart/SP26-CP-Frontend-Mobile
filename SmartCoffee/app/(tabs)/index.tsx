import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';

type PostItem = {
  postId: number;
  title: string;
  content?: string | null;
  createdAt?: string | null;
  publishedAt?: string | null;
  viewCount?: number | null;
  recipeImageUrl?: string | null;
  postCategoryId?: number | null;
  coffeeShopId?: number | null;
  isApproved?: boolean | null;
  status?: string | null;
};

type PostApiResponse = {
  totalCount?: number;
  items?: PostItem[];
};

type CoffeeShopItem = {
  coffeeShopId: number;
  shopName?: string | null;
};

type PostCategory = {
  postCategoryId: number;
  name?: string | null;
  categoryName?: string | null;
};

const PAGE_SIZE = 8;

const COLORS = {
  bg: '#F5EEE6',
  card: '#FFFFFF',
  ink: '#2F2116',
  muted: '#7B6B5B',
  accent: '#9B5D2E',
  accentSoft: '#E7D5C6',
  border: '#E4D9CF',
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString();
};

const buildSnippet = (content?: string | null) => {
  if (!content) return '';
  const trimmed = content.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= 140) return trimmed;
  return `${trimmed.slice(0, 140).trim()}...`;
};

const buildPostUrl = (pageNo: number, status?: string | null) => {
  const params = new URLSearchParams();
  params.set('pageNo', String(pageNo));
  params.set('pageSize', String(PAGE_SIZE));
  if (status) {
    params.set('status', status);
  }
  return `${API_ENDPOINTS.post.list()}?${params.toString()}`;
};

const isActiveStatus = (status?: string | null) => {
  if (!status) return true;
  return status.toLowerCase() === 'active';
};

export default function HomeScreen() {
  const router = useRouter();
  const { role, coffeeShopId } = useAuth();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageNo, setPageNo] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [shopNames, setShopNames] = useState<Record<number, string>>({});
  const [categoryMap, setCategoryMap] = useState<Record<number, string>>({});

  const hasMore = posts.length < totalCount;
  const canSeeDisabled = role && role !== 'Staff';

  const loadPosts = useCallback(
    async (page: number, mode: 'replace' | 'append') => {
      const statusFilter = canSeeDisabled ? null : 'Active';
      const response = await authorizedFetch(buildPostUrl(page, statusFilter), {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const payload = (await response.json()) as PostApiResponse;
      const rawItems = Array.isArray(payload?.items) ? payload.items : [];
      const approvedItems = rawItems.filter((item) => item.isApproved === true);
      const items = canSeeDisabled && coffeeShopId
        ? approvedItems.filter((item) =>
            isActiveStatus(item.status) || item.coffeeShopId === coffeeShopId
          )
        : approvedItems;
      const count = Number(payload?.totalCount ?? items.length);

      setTotalCount(count);
      setPageNo(page);
      setPosts((prev) => (mode === 'replace' ? items : [...prev, ...items]));
    },
    [canSeeDisabled, coffeeShopId]
  );

  const fetchFirstPage = useCallback(async () => {
    try {
      setLoading(true);
      await loadPosts(1, 'replace');
    } finally {
      setLoading(false);
    }
  }, [loadPosts]);

  const loadCoffeeShops = useCallback(async () => {
    const response = await authorizedFetch(API_ENDPOINTS.coffeeShop.list(), {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    const data = (await response.json()) as CoffeeShopItem[];
    const map = Array.isArray(data)
      ? data.reduce<Record<number, string>>((acc, item) => {
          if (item?.coffeeShopId && item?.shopName) {
            acc[item.coffeeShopId] = item.shopName;
          }
          return acc;
        }, {})
      : {};
    setShopNames(map);
  }, []);

  const loadPostCategories = useCallback(async () => {
    const response = await authorizedFetch(API_ENDPOINTS.postCategory.list(), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    const payload = await response.json();
    const items: PostCategory[] = Array.isArray(payload)
      ? payload
      : payload?.data ?? payload?.items ?? [];
    const map = items.reduce<Record<number, string>>((acc, item) => {
      const label = item.categoryName ?? item.name;
      if (item.postCategoryId && label) {
        acc[item.postCategoryId] = label;
      }
      return acc;
    }, {});
    setCategoryMap(map);
  }, []);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadPosts(1, 'replace');
    } finally {
      setRefreshing(false);
    }
  }, [loadPosts]);

  const onLoadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    try {
      setLoadingMore(true);
      await loadPosts(pageNo + 1, 'append');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadPosts, loading, loadingMore, pageNo]);

  useEffect(() => {
    fetchFirstPage();
    loadCoffeeShops();
    loadPostCategories();
  }, [fetchFirstPage, loadCoffeeShops, loadPostCategories]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const applyViewUpdate = async () => {
        try {
          const raw = await AsyncStorage.getItem('postViewUpdate');
          if (!raw || !isActive) return;
          const parsed = JSON.parse(raw) as { postId?: number; viewCount?: number };
          if (parsed?.postId) {
            setPosts((prev) =>
              prev.map((item) =>
                item.postId === parsed.postId
                  ? { ...item, viewCount: parsed.viewCount ?? item.viewCount }
                  : item
              )
            );
          }
          await AsyncStorage.removeItem('postViewUpdate');
        } catch {
          // Ignore persistence errors.
        }
      };

      applyViewUpdate();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const header = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <View style={styles.titleRow}>
          <View style={styles.titleBadge}>
            <Ionicons name="cafe" size={18} color={COLORS.accent} />
          </View>
          <View>
            <Text style={styles.title}>Community Posts</Text>
            <Text style={styles.subtitle}>Discover new recipes and brewing notes.</Text>
          </View>
        </View>
      </View>
    ),
    []
  );

  const renderPost = ({ item }: { item: PostItem }) => {
    const snippet = buildSnippet(item.content);
    const dateLabel = formatDate(item.publishedAt ?? item.createdAt);
    const shopName = item.coffeeShopId ? shopNames[item.coffeeShopId] : undefined;
    const isDisabled = !isActiveStatus(item.status);
    const showDisabled = Boolean(canSeeDisabled && coffeeShopId && isDisabled && item.coffeeShopId === coffeeShopId);
    const categoryLabel = item.postCategoryId
      ? categoryMap[item.postCategoryId] ?? `#${item.postCategoryId}`
      : 'General';

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.card, showDisabled && styles.cardDisabled]}
        onPress={() => router.push(`/post-detail/${item.postId}`)}
      >
        {item.recipeImageUrl ? (
          <Image source={{ uri: item.recipeImageUrl }} style={styles.cardImage} />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="images" size={28} color={COLORS.accent} />
            <Text style={styles.imageFallbackText}>Recipe Highlight</Text>
          </View>
        )}

        <View style={styles.cardBody}>
          <View style={styles.tagRow}>
            <View style={styles.tagPill}>
              <Text style={styles.tagText}>{categoryLabel}</Text>
            </View>
            <View style={styles.tagMetaRow}>
              {showDisabled ? (
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>Disabled</Text>
                </View>
              ) : null}
              <Text style={styles.metaText}>{dateLabel}</Text>
            </View>
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {snippet ? (
            <Text style={styles.cardSnippet} numberOfLines={3}>
              {snippet}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Ionicons name="eye" size={14} color={COLORS.muted} />
              <Text style={styles.metaPillText}>{item.viewCount ?? 0}</Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="storefront" size={14} color={COLORS.muted} />
              <Text style={styles.metaPillText}>{shopName ?? `Shop ${item.coffeeShopId ?? '-'}`}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.postId)}
        renderItem={renderPost}
        ListHeaderComponent={header}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={COLORS.accent} style={styles.footerLoader} /> : null
        }
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    padding: 20,
    paddingBottom: 32,
    gap: 18,
  },
  headerBlock: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  titleBadge: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.ink,
    fontFamily: 'Georgia',
  },
  subtitle: {
    color: COLORS.muted,
    marginTop: 4,
  },
  card: {
    borderRadius: 22,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  cardImage: {
    width: '100%',
    height: 180,
  },
  imageFallback: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1E5DA',
    gap: 8,
  },
  imageFallbackText: {
    color: COLORS.muted,
    fontWeight: '600',
  },
  cardBody: {
    padding: 16,
    gap: 10,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#B29C8A',
    backgroundColor: '#F2E7DD',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5E4331',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
  },
  metaText: {
    color: COLORS.muted,
    fontSize: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.ink,
    fontFamily: 'Georgia',
  },
  cardSnippet: {
    color: COLORS.muted,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FBF7F3',
  },
  metaPillText: {
    color: COLORS.muted,
    fontSize: 12,
  },
  footerLoader: {
    marginTop: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245, 238, 230, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
