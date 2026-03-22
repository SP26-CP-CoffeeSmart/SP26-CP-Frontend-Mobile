import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

type PostDetail = {
  postId: number;
  recipeId?: number | null;
  coffeeShopId?: number | null;
  postCategoryId?: number | null;
  title: string;
  status?: string | null;
  viewCount?: number | null;
  publishedAt?: string | null;
  isApproved?: boolean | null;
  content?: string | null;
  createdAt?: string | null;
  recipeImageUrl?: string | null;
  postCommentIds?: number[] | null;
};

type CoffeeShopItem = {
  coffeeShopId: number;
  shopName?: string | null;
};

const COLORS = {
  bg: '#F6EFE8',
  card: '#FFFFFF',
  ink: '#2A1F16',
  muted: '#7B6B5B',
  accent: '#9B5D2E',
  accentSoft: '#E8D7C8',
  border: '#E3D7CD',
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString();
};

const splitLines = (text?: string | null) => {
  if (!text) return [] as string[];
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0);
};

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const postId = useMemo(() => Number(id ?? 0), [id]);

  const loadPost = useCallback(async () => {
    if (!postId) {
      setError('Missing post id.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await authorizedFetch(API_ENDPOINTS.post.getById(postId), {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const data = (await response.json()) as PostDetail;
      setPost(data);

      if (data?.coffeeShopId) {
        const shopResponse = await authorizedFetch(
          API_ENDPOINTS.coffeeShop.getById(data.coffeeShopId),
          { headers: { Accept: 'application/json' } }
        );
        if (shopResponse.ok) {
          const shopData = (await shopResponse.json()) as CoffeeShopItem;
          setShopName(shopData?.shopName ?? null);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load post.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const contentLines = useMemo(() => splitLines(post?.content), [post?.content]);
  const dateLabel = formatDate(post?.publishedAt ?? post?.createdAt);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPost}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={COLORS.ink} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>

        {post?.recipeImageUrl ? (
          <Image source={{ uri: post.recipeImageUrl }} style={styles.heroImage} />
        ) : (
          <View style={styles.heroFallback}>
            <Ionicons name="images" size={28} color={COLORS.accent} />
            <Text style={styles.heroFallbackText}>Recipe Highlight</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.tagRow}>
            <View style={styles.tagPill}>
              <Text style={styles.tagText}>#{post?.postCategoryId ?? 'General'}</Text>
            </View>
            <Text style={styles.metaText}>{dateLabel}</Text>
          </View>

          <Text style={styles.title}>{post?.title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Ionicons name="storefront" size={14} color={COLORS.muted} />
              <Text style={styles.metaPillText}>
                {shopName ?? `Shop ${post?.coffeeShopId ?? '-'}`}
              </Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="eye" size={14} color={COLORS.muted} />
              <Text style={styles.metaPillText}>{post?.viewCount ?? 0}</Text>
            </View>
          </View>

          <View style={styles.contentBlock}>
            {contentLines.length === 0 ? (
              <Text style={styles.contentText}>No content available.</Text>
            ) : (
              contentLines.map((line, index) => (
                <Text key={`${index}-${line}`} style={styles.contentText}>
                  {line}
                </Text>
              ))
            )}
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: 40,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: COLORS.ink,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backText: {
    color: COLORS.ink,
    fontWeight: '600',
  },
  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: 22,
  },
  heroFallback: {
    width: '100%',
    height: 220,
    borderRadius: 22,
    backgroundColor: '#F1E5DA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroFallbackText: {
    color: COLORS.muted,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.ink,
    fontFamily: 'Georgia',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
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
  contentBlock: {
    gap: 10,
  },
  contentText: {
    color: COLORS.ink,
    lineHeight: 22,
  },
});
