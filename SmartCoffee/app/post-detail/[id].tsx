import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';

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

type PostCategory = {
  postCategoryId: number;
  name?: string | null;
  categoryName?: string | null;
};

type RecipeDetail = {
  shopRecipeId?: number | null;
  recipeId?: number | null;
  recipeName?: string | null;
  image?: string | null;
  flavorNote?: string | null;
  brewingMethod?: string | null;
  prepTimeRange?: string | null;
  brewingSteps?: string | string[] | null;
  suggestedOccasions?: string | null;
  difficultyLevel?: string | null;
  caffeineStrength?: number | null;
  containsMilk?: boolean | null;
  hasIce?: boolean | null;
  proposedSellingPrice?: number | null;
  profitMarginPercent?: number | null;
  ingredients?: RecipeIngredient[] | null;
};

type RecipeIngredient = {
  quantity?: number | null;
  measurement?: string | null;
  ingredient?: {
    name?: string | null;
  } | null;
};

type PostCommentReply = {
  commentId: number;
  postId?: number | null;
  parentId?: number | null;
  userId?: number | null;
  content?: string | null;
  createdAt?: string | null;
};

type PostCommentItem = {
  commentId: number;
  postId?: number | null;
  parentId?: number | null;
  userId?: number | null;
  content?: string | null;
  createdAt?: string | null;
  branchCommentIds?: number[] | null;
  branchComments?: PostCommentReply[] | null;
};

type ShopStaffItem = {
  staffId?: number | null;
  accountId?: number | null;
  fullName?: string | null;
};

type CoffeeShopWithAccount = {
  coffeeShopId: number;
  shopName?: string | null;
  account?: {
    accountId?: number | null;
    userName?: string | null;
    fullName?: string | null;
    email?: string | null;
  } | null;
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
const COMMENT_PAGE_SIZE = 3;

const parseJSON = (value: any) => {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
};

const getBrewingSteps = (rawSteps?: string | string[] | null): string[] => {
  if (!rawSteps) return [];
  if (Array.isArray(rawSteps)) return rawSteps;
  const parsed = parseJSON(rawSteps);
  if (Array.isArray(parsed)) return parsed;
  if (typeof rawSteps === 'string' && rawSteps.trim()) return [rawSteps.trim()];
  return [];
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString();
};

const pickDisplayName = (...candidates: unknown[]) => {
  for (const value of candidates) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return null;
};

const getEmailAlias = (value: unknown) => {
  const email = String(value ?? '').trim();
  if (!email || !email.includes('@')) return null;
  const alias = email.split('@')[0]?.trim();
  return alias || null;
};

const formatStatusLabel = (value?: string | null) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return 'Draft';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const splitLines = (text?: string | null) => {
  if (!text) return [] as string[];
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0);
};

const parseOccasions = (value?: string | null) => {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Ignore parsing errors and fall back to string parsing.
  }

  return value
    .replace(/[\[\]"]+/g, '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export default function PostDetailScreen() {
  const router = useRouter();
  const { coffeeShopId, accountId, profile } = useAuth();
  const { id } = useLocalSearchParams();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  const [categories, setCategories] = useState<PostCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [recipeError, setRecipeError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [showEnableModal, setShowEnableModal] = useState(false);
  const [comments, setComments] = useState<PostCommentItem[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState<PostCommentItem | null>(null);
  const [sendingComment, setSendingComment] = useState(false);
  const [commentAuthorMap, setCommentAuthorMap] = useState<Record<number, string>>({});
  const [visibleCommentLimit, setVisibleCommentLimit] = useState(COMMENT_PAGE_SIZE);
  const lastReportedViewKey = useRef<string | null>(null);

  const postId = useMemo(() => Number(id ?? 0), [id]);

  const loadPost = useCallback(async (options?: { showLoader?: boolean; syncEditor?: boolean }) => {
    const showLoader = options?.showLoader ?? true;
    const syncEditor = options?.syncEditor ?? true;
    if (!postId) {
      setError('Missing post id.');
      if (showLoader) setLoading(false);
      return null;
    }

    try {
      if (showLoader) setLoading(true);
      setError(null);

      const response = await authorizedFetch(API_ENDPOINTS.post.getById(postId), {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const data = (await response.json()) as PostDetail;
      setPost(data);
      if (syncEditor) {
        setEditTitle(data?.title ?? '');
        setEditContent(data?.content ?? '');
        setSelectedCategoryId(data?.postCategoryId ?? null);
      }

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
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load post.';
      setError(message);
      return null;
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [postId]);

  const loadCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const response = await authorizedFetch(API_ENDPOINTS.postCategory.list(), {
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json();
      const normalized = Array.isArray(payload) ? payload : payload?.data ?? payload?.items ?? [];
      setCategories(normalized);
    } catch {
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const loadRecipe = useCallback(async (recipeId?: number | null) => {
    if (!recipeId) {
      setRecipe(null);
      setRecipeIngredients([]);
      setRecipeError(null);
      return;
    }

    try {
      setLoadingRecipe(true);
      setRecipeError(null);

      const response = await authorizedFetch(API_ENDPOINTS.shopRecipe.getById(recipeId), {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const data = (await response.json()) as RecipeDetail;
      setRecipe(data);

      if (Array.isArray(data?.ingredients) && data.ingredients.length > 0) {
        setRecipeIngredients(data.ingredients);
        return;
      }

      const resolvedRecipeId = Number(data?.recipeId ?? recipeId);
      if (!resolvedRecipeId) {
        setRecipeIngredients([]);
        return;
      }

      const ingredientResponse = await authorizedFetch(
        API_ENDPOINTS.shopRecipeIngredients.getByRecipeId(resolvedRecipeId),
        { headers: { Accept: 'application/json' } }
      );

      if (!ingredientResponse.ok) {
        setRecipeIngredients([]);
        return;
      }

      const ingredientPayload = (await ingredientResponse.json()) as RecipeIngredient[];
      setRecipeIngredients(Array.isArray(ingredientPayload) ? ingredientPayload : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load recipe details.';
      setRecipeError(message);
      setRecipe(null);
      setRecipeIngredients([]);
    } finally {
      setLoadingRecipe(false);
    }
  }, []);

  const sortCommentsByDate = useCallback(
    <T extends { createdAt?: string | null }>(items: T[]) =>
      [...items].sort((a, b) => {
        const timeA = new Date(a.createdAt ?? 0).getTime();
        const timeB = new Date(b.createdAt ?? 0).getTime();
        if (!Number.isFinite(timeA) || !Number.isFinite(timeB)) return 0;
        return timeA - timeB;
      }),
    []
  );

  const loadComments = useCallback(
    async (commentIds?: number[] | null) => {
      const ids = Array.isArray(commentIds)
        ? Array.from(new Set(commentIds.map((item) => Number(item)).filter((item) => item > 0)))
        : [];

      if (ids.length === 0) {
        setComments([]);
        setVisibleCommentLimit(COMMENT_PAGE_SIZE);
        setCommentError(null);
        return;
      }

      try {
        setLoadingComments(true);
        setCommentError(null);

        const responses = await Promise.allSettled(
          ids.map(async (commentId) => {
            const response = await authorizedFetch(API_ENDPOINTS.postComment.getById(commentId), {
              headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
              throw new Error(`Request failed (${response.status})`);
            }
            const payload = (await response.json()) as PostCommentItem;
            return {
              ...payload,
              branchComments: sortCommentsByDate(Array.isArray(payload?.branchComments) ? payload.branchComments : []),
            } as PostCommentItem;
          })
        );

        const loaded = responses
          .filter((result): result is PromiseFulfilledResult<PostCommentItem> => result.status === 'fulfilled')
          .map((result) => result.value);

        setComments(sortCommentsByDate(loaded));
        setVisibleCommentLimit(COMMENT_PAGE_SIZE);
        if (loaded.length === 0) {
          setCommentError('Unable to load comments right now.');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load comments.';
        setCommentError(message);
        setComments([]);
        setVisibleCommentLimit(COMMENT_PAGE_SIZE);
      } finally {
        setLoadingComments(false);
      }
    },
    [sortCommentsByDate]
  );

  const resolveCommentAuthors = useCallback(
    async (items: PostCommentItem[], sourceShopId?: number | null) => {
      const userIds = new Set<number>();
      items.forEach((item) => {
        if (item.userId && item.userId > 0) userIds.add(item.userId);
        if (Array.isArray(item.branchComments)) {
          item.branchComments.forEach((reply) => {
            if (reply.userId && reply.userId > 0) userIds.add(reply.userId);
          });
        }
      });

      if (userIds.size === 0) return;

      const resolved: Record<number, string> = {};

      if (accountId && userIds.has(accountId)) {
        const selfName = pickDisplayName(
          (profile as any)?.fullName,
          (profile as any)?.userName,
          (profile as any)?.name,
          getEmailAlias((profile as any)?.email)
        );
        if (selfName) {
          resolved[accountId] = selfName;
        }
      }

      if (sourceShopId) {
        try {
          const response = await authorizedFetch(API_ENDPOINTS.shopStaff.getByShop(sourceShopId), {
            headers: { Accept: 'application/json' },
          });
          if (response.ok) {
            const payload = await response.json();
            const staffItems = (Array.isArray(payload) ? payload : payload?.data ?? payload?.items ?? []) as ShopStaffItem[];
            staffItems.forEach((staff) => {
              const id = Number(staff?.accountId ?? 0);
              if (id > 0 && userIds.has(id)) {
                const name = pickDisplayName(staff?.fullName);
                if (name) {
                  resolved[id] = name;
                }
              }
            });
          }
        } catch {
          // Keep fallback labels when lookup fails.
        }
      }

      try {
        const response = await authorizedFetch(API_ENDPOINTS.coffeeShop.list(), {
          headers: { Accept: 'application/json' },
        });
        if (response.ok) {
          const payload = await response.json();
          const shops = (Array.isArray(payload) ? payload : payload?.data ?? payload?.items ?? []) as CoffeeShopWithAccount[];
          shops.forEach((shop) => {
            const id = Number(shop?.account?.accountId ?? 0);
            if (id > 0 && userIds.has(id) && !resolved[id]) {
              const name = pickDisplayName(
                shop?.account?.fullName,
                shop?.account?.userName,
                shop?.shopName,
                getEmailAlias(shop?.account?.email)
              );
              if (name) {
                resolved[id] = name;
              }
            }
          });
        }
      } catch {
        // Keep fallback labels when lookup fails.
      }

      if (Object.keys(resolved).length > 0) {
        setCommentAuthorMap((prev) => ({ ...prev, ...resolved }));
      }
    },
    [accountId, profile]
  );

  const handleSubmitComment = useCallback(async () => {
    if (!post?.postId) return;
    const content = commentDraft.trim();
    if (!content) {
      Toast.show({ type: 'error', text1: 'Missing comment', text2: 'Please type your message.' });
      return;
    }

    try {
      setSendingComment(true);
      const payload: { content: string; parentId?: number } = { content };
      if (replyTarget?.commentId) {
        payload.parentId = replyTarget.commentId;
      }

      const response = await authorizedFetch(API_ENDPOINTS.postComment.create(post.postId), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      setCommentDraft('');
      setReplyTarget(null);

      const refreshedPost = await loadPost({ showLoader: false, syncEditor: false });
      const nextCommentIds = refreshedPost?.postCommentIds ?? post?.postCommentIds ?? [];
      await loadComments(nextCommentIds);

      Toast.show({
        type: 'success',
        text1: replyTarget?.commentId ? 'Reply posted' : 'Comment posted',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to submit comment.';
      Toast.show({ type: 'error', text1: 'Comment failed', text2: message });
    } finally {
      setSendingComment(false);
    }
  }, [commentDraft, loadComments, loadPost, post?.postCommentIds, post?.postId, replyTarget]);

  const handleSave = useCallback(async () => {
    if (!post) return;
    if (!editTitle.trim()) {
      Toast.show({ type: 'error', text1: 'Missing title', text2: 'Please enter a title.' });
      return;
    }

    if (!selectedCategoryId) {
      Toast.show({ type: 'error', text1: 'Missing category', text2: 'Please select a category.' });
      return;
    }

    try {
      setSaving(true);
      const response = await authorizedFetch(API_ENDPOINTS.post.update(post.postId), {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim(),
          postCategoryId: selectedCategoryId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const updated = (await response.json()) as PostDetail;
      setPost(updated);
      setIsEditing(false);
      Toast.show({ type: 'success', text1: 'Post updated successfully' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed.';
      Toast.show({ type: 'error', text1: 'Update failed', text2: message });
    } finally {
      setSaving(false);
    }
  }, [editContent, editTitle, post, selectedCategoryId]);

  const handleDisableConfirm = useCallback(async () => {
    if (!post) return;
    try {
      setDisabling(true);
      const response = await authorizedFetch(API_ENDPOINTS.post.toggleVisibility(post.postId), {
        method: 'PUT',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const updated = (await response.json()) as PostDetail;
      setPost(updated);
      Toast.show({ type: 'success', text1: 'Post disabled' });
      setShowDisableModal(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Disable failed.';
      Toast.show({ type: 'error', text1: 'Disable failed', text2: message });
    } finally {
      setDisabling(false);
    }
  }, [post]);

  const handleEnableConfirm = useCallback(async () => {
    if (!post) return;
    try {
      setEnabling(true);
      const response = await authorizedFetch(API_ENDPOINTS.post.toggleVisibility(post.postId), {
        method: 'PUT',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const updated = (await response.json()) as PostDetail;
      setPost(updated);
      Toast.show({ type: 'success', text1: 'Post enabled' });
      setShowEnableModal(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Enable failed.';
      Toast.show({ type: 'error', text1: 'Enable failed', text2: message });
    } finally {
      setEnabling(false);
    }
  }, [post]);

  useEffect(() => {
    loadPost();
    loadCategories();
  }, [loadPost, loadCategories]);

  useEffect(() => {
    loadRecipe(post?.recipeId ?? null);
  }, [loadRecipe, post?.recipeId]);

  useEffect(() => {
    loadComments(post?.postCommentIds ?? null);
  }, [loadComments, post?.postCommentIds]);

  useEffect(() => {
    if (comments.length === 0) return;
    resolveCommentAuthors(comments, post?.coffeeShopId ?? coffeeShopId ?? null);
  }, [coffeeShopId, comments, post?.coffeeShopId, resolveCommentAuthors]);

  useEffect(() => {
    if (!post?.postId) return;
    const viewKey = `${post.postId}:${post.viewCount ?? 0}`;
    if (lastReportedViewKey.current === viewKey) return;
    lastReportedViewKey.current = viewKey;

    AsyncStorage.setItem(
      'postViewUpdate',
      JSON.stringify({ postId: post.postId, viewCount: post.viewCount ?? 0 })
    ).catch(() => {
      // Ignore persistence errors.
    });
  }, [post?.postId, post?.viewCount]);

  const contentLines = useMemo(() => splitLines(post?.content), [post?.content]);
  const dateLabel = formatDate(post?.publishedAt ?? post?.createdAt);
  const categoryMap = useMemo(() => {
    return categories.reduce<Record<number, string>>((acc, item) => {
      const label = item.categoryName ?? item.name;
      if (item.postCategoryId && label) {
        acc[item.postCategoryId] = label;
      }
      return acc;
    }, {});
  }, [categories]);
  const categoryLabel = post?.postCategoryId
    ? categoryMap[post.postCategoryId] ?? `#${post.postCategoryId}`
    : 'General';
  const canManagePost = Boolean(
    coffeeShopId && post?.coffeeShopId && coffeeShopId === post.coffeeShopId
  );
  const postStatus = String(post?.status ?? '').trim().toLowerCase();
  const postStatusLabel = formatStatusLabel(post?.status);
  const isPublicPost = postStatus === 'public' || postStatus === 'active';
  const isPendingPost = postStatus === 'pending';
  const canEditPost = canManagePost && !isPublicPost;
  const showManageButtons = canManagePost && (!isPendingPost || isEditing);
  const commentCount = useMemo(
    () =>
      comments.reduce(
        (total, item) => total + 1 + (Array.isArray(item.branchComments) ? item.branchComments.length : 0),
        0
      ),
    [comments]
  );
  const occasionList = useMemo(
    () => parseOccasions(recipe?.suggestedOccasions ?? null),
    [recipe?.suggestedOccasions]
  );
  const recipeInfoItems = useMemo(
    () =>
      [
        { label: 'Method', value: recipe?.brewingMethod || 'Not set' },
        { label: 'Prep time', value: recipe?.prepTimeRange || 'Not set' },
        { label: 'Difficulty', value: recipe?.difficultyLevel || 'Not set' },
        {
          label: 'Caffeine',
          value: recipe?.caffeineStrength != null ? String(recipe.caffeineStrength) : 'Not set',
        },
        {
          label: 'Milk / Ice',
          value: `${recipe?.containsMilk ? 'Milk' : 'No milk'} · ${recipe?.hasIce ? 'Ice' : 'No ice'}`,
        },
        {
          label: 'Price',
          value:
            recipe?.proposedSellingPrice != null
              ? `${recipe.proposedSellingPrice.toLocaleString()} VND`
              : 'Not set',
        },
        {
          label: 'Margin',
          value:
            recipe?.profitMarginPercent != null
              ? `${recipe.profitMarginPercent}%`
              : 'Not set',
        },
      ] as Array<{ label: string; value: string }>,
    [recipe]
  );
  const getAuthorLabel = useCallback(
    (userId?: number | null) => {
      const id = Number(userId ?? 0);
      if (id <= 0) return 'User #-';
      return commentAuthorMap[id] ?? `User #${id}`;
    },
    [commentAuthorMap]
  );
  const visibleComments = useMemo(
    () => comments.slice(0, visibleCommentLimit),
    [comments, visibleCommentLimit]
  );
  const hasMoreComments = visibleCommentLimit < comments.length;
  const handleLoadMoreComments = useCallback(() => {
    setVisibleCommentLimit((prev) => Math.min(prev + COMMENT_PAGE_SIZE, comments.length));
  }, [comments.length]);

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
          <TouchableOpacity style={styles.retryButton} onPress={() => loadPost()}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={COLORS.ink} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{postStatusLabel}</Text>
          </View>
        </View>

        <View style={styles.heroShell}>
          {post?.recipeImageUrl ? (
            <Image source={{ uri: post.recipeImageUrl }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <Ionicons name="images" size={28} color={COLORS.accent} />
              <Text style={styles.heroFallbackText}>Recipe Highlight</Text>
            </View>
          )}
          <View style={styles.heroOverlay} />
          <View style={styles.heroInfo}>
            <View style={styles.heroCategoryPill}>
              <Text style={styles.heroCategoryText}>{categoryLabel}</Text>
            </View>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {post?.title}
            </Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaPill}>
                <Ionicons name="calendar-outline" size={13} color="#FDF7F0" />
                <Text style={styles.heroMetaText}>{dateLabel || 'No date'}</Text>
              </View>
              <View style={styles.heroMetaPill}>
                <Ionicons name="eye-outline" size={13} color="#FDF7F0" />
                <Text style={styles.heroMetaText}>{post?.viewCount ?? 0}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.tagRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Post details</Text>
              <Text style={styles.sectionTitle}>Story and context</Text>
            </View>
            <View style={styles.softStatusPill}>
              <Text style={styles.softStatusText}>{postStatusLabel}</Text>
            </View>
          </View>

          {isEditing ? (
            <View style={styles.editBlock}>
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.input}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Enter title"
                placeholderTextColor={COLORS.muted}
              />
              <Text style={styles.inputLabel}>Category</Text>
              {loadingCategories ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                  <Text style={styles.metaText}>Loading categories...</Text>
                </View>
              ) : (
                <View style={styles.chipRow}>
                  {categories.map((category) => {
                    const active = category.postCategoryId === selectedCategoryId;
                    const label =
                      category.categoryName ?? category.name ?? `#${category.postCategoryId}`;
                    return (
                      <TouchableOpacity
                        key={category.postCategoryId}
                        onPress={() => setSelectedCategoryId(category.postCategoryId)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              <Text style={styles.inputLabel}>Content</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editContent}
                onChangeText={setEditContent}
                placeholder="Write content"
                placeholderTextColor={COLORS.muted}
                multiline
              />
            </View>
          ) : (
            <View style={styles.metaStrip}>
              <View style={styles.metaCard}>
                <View style={styles.metaIconBubble}>
                  <Ionicons name="storefront-outline" size={14} color={COLORS.accent} />
                </View>
                <View style={styles.metaCopyBlock}>
                  <Text style={styles.metaCardLabel}>Coffee Shop</Text>
                  <Text style={styles.metaCardValue}>{shopName ?? `Shop ${post?.coffeeShopId ?? '-'}`}</Text>
                </View>
              </View>
              <View style={styles.metaCard}>
                <View style={styles.metaIconBubble}>
                  <Ionicons name="analytics-outline" size={14} color={COLORS.accent} />
                </View>
                <View style={styles.metaCopyBlock}>
                  <Text style={styles.metaCardLabel}>Views</Text>
                  <Text style={styles.metaCardValue}>{post?.viewCount ?? 0}</Text>
                </View>
              </View>
            </View>
          )}

          {!isEditing && (
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
          )}

          {showManageButtons && (
            <View style={styles.actionRow}>
              {isEditing ? (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.secondaryButton]}
                    onPress={() => setIsEditing(false)}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.primaryButton]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    <Text style={styles.primaryText}>{saving ? 'Saving...' : 'Save'}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>

                  {post?.status?.toLowerCase() === 'hidden' ? (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.primaryButton]}
                      onPress={() => setShowEnableModal(true)}
                      disabled={enabling}
                    >
                      <Text style={styles.primaryText}>
                        {enabling ? 'Enabling...' : 'Enable'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      {canEditPost && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.secondaryButton]}
                          onPress={() => setIsEditing(true)}
                        >
                          <Text style={styles.secondaryText}>Edit</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.actionButton, styles.dangerButton]}
                        onPress={() => setShowDisableModal(true)}
                        disabled={disabling}
                      >
                        <Text style={styles.dangerText}>
                          {disabling ? 'Disabling...' : 'Disable'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </View>
          )}
          {isPendingPost && canManagePost && !isEditing && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={() => setIsEditing(true)}
              >
                <Text style={styles.secondaryText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {post?.recipeId ? (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recipe details</Text>
            </View>

            {loadingRecipe ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.accent} />
                <Text style={styles.metaText}>Loading recipe...</Text>
              </View>
            ) : recipeError ? (
              <Text style={styles.errorText}>{recipeError}</Text>
            ) : recipe ? (
              <View style={styles.recipeBlock}>
                <View style={styles.recipeIntroCard}>
                  <View style={styles.recipeIntroIcon}>
                    <Ionicons name="cafe-outline" size={22} color={COLORS.accent} />
                  </View>
                  <View style={styles.recipeIntroCopy}>
                    <Text style={styles.recipeTitle}>{recipe.recipeName ?? 'Untitled recipe'}</Text>
                    <Text style={styles.recipeNote}>
                      {recipe.flavorNote || 'A curated recipe with brew settings and step-by-step guide.'}
                    </Text>
                  </View>
                </View>

                <View style={styles.recipeGrid}>
                  {recipeInfoItems.map((item) => (
                    <View key={item.label} style={styles.recipeGridItem}>
                      <Text style={styles.recipeLabel}>{item.label}</Text>
                      <Text style={styles.recipeValue}>{item.value}</Text>
                    </View>
                  ))}
                </View>

                {occasionList.length > 0 ? (
                  <View style={styles.occasionRow}>
                    {occasionList.map((occasion) => (
                      <View key={occasion} style={styles.occasionChip}>
                        <Text style={styles.occasionText}>{occasion}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {recipeIngredients.length > 0 ? (
                  <View style={styles.ingredientRow}>
                    {recipeIngredients.map((item, index) => {
                      const name = item?.ingredient?.name ?? 'Unnamed ingredient';
                      const qty = item?.quantity != null ? String(item.quantity) : '';
                      const measurement = item?.measurement ? ` ${item.measurement}` : '';
                      return (
                        <View key={`${name}-${index}`} style={styles.ingredientChip}>
                          <Text style={styles.ingredientText}>
                            {name}
                            {qty ? ` · ${qty}${measurement}` : ''}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {getBrewingSteps(recipe?.brewingSteps).length > 0 ? (
                  <View style={styles.stepsBlock}>
                    <Text style={styles.stepsTitle}>Steps</Text>
                    {getBrewingSteps(recipe?.brewingSteps).map((step: any, index: number) => {
                      const stepNumber =
                        typeof step === 'object' && step !== null && step.step
                          ? step.step
                          : index + 1;
                      const stepText =
                        typeof step === 'string'
                          ? step
                          : step.title || step.desc || '';
                      return (
                        <View key={index} style={styles.stepRow}>
                          <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>{stepNumber}</Text>
                          </View>
                          <Text style={styles.stepText}>{stepText || ''}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={styles.metaText}>No recipe details available.</Text>
            )}
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Comments</Text>
            <View style={styles.commentCountPill}>
              <Text style={styles.commentCountText}>{commentCount}</Text>
            </View>
          </View>

          <View style={styles.commentComposer}>
            <TextInput
              style={[styles.input, styles.commentInput]}
              value={commentDraft}
              onChangeText={setCommentDraft}
              placeholder="Write a comment..."
              placeholderTextColor={COLORS.muted}
              multiline
            />
            <TouchableOpacity
              style={[styles.commentSubmitButton, sendingComment && styles.commentSubmitButtonDisabled]}
              onPress={handleSubmitComment}
              disabled={sendingComment}
            >
              <Text style={styles.commentSubmitText}>
                {sendingComment ? 'Sending...' : replyTarget ? 'Post reply' : 'Post comment'}
              </Text>
            </TouchableOpacity>
          </View>

          {loadingComments ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.metaText}>Loading comments...</Text>
            </View>
          ) : null}

          {commentError ? <Text style={styles.errorText}>{commentError}</Text> : null}

          {!loadingComments && comments.length === 0 && !commentError ? (
            <Text style={styles.metaText}>No comments yet. Be the first to comment.</Text>
          ) : null}

          {comments.length > 0 ? (
            <View style={styles.commentList}>
              {visibleComments.map((comment) => (
                <View key={comment.commentId} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>
                      {getAuthorLabel(comment.userId)}
                      {accountId && comment.userId === accountId ? ' (You)' : ''}
                    </Text>
                    <Text style={styles.commentTime}>{formatDate(comment.createdAt) || 'No date'}</Text>
                  </View>
                  <Text style={styles.commentContent}>{comment.content || ''}</Text>
                  <TouchableOpacity
                    style={styles.commentReplyButton}
                    onPress={() => setReplyTarget(comment)}
                    disabled={sendingComment}
                  >
                    <Ionicons name="return-down-forward-outline" size={14} color={COLORS.accent} />
                    <Text style={styles.commentReplyText}>Reply</Text>
                  </TouchableOpacity>

                  {Array.isArray(comment.branchComments) && comment.branchComments.length > 0 ? (
                    <View style={styles.replyList}>
                      {comment.branchComments.map((reply) => (
                        <View key={reply.commentId} style={styles.replyCard}>
                          <View style={styles.commentHeader}>
                            <Text style={styles.commentAuthor}>
                              {getAuthorLabel(reply.userId)}
                              {accountId && reply.userId === accountId ? ' (You)' : ''}
                            </Text>
                            <Text style={styles.commentTime}>{formatDate(reply.createdAt) || 'No date'}</Text>
                          </View>
                          <Text style={styles.commentContent}>{reply.content || ''}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {replyTarget?.commentId === comment.commentId ? (
                    <View style={styles.inlineReplyComposer}>
                      <View style={styles.replyHintRow}>
                        <Text style={styles.replyHintText}>Replying to comment #{comment.commentId}</Text>
                        <TouchableOpacity onPress={() => setReplyTarget(null)} disabled={sendingComment}>
                          <Text style={styles.replyHintAction}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={[styles.input, styles.commentInput]}
                        value={commentDraft}
                        onChangeText={setCommentDraft}
                        placeholder={`Write a reply to #${comment.commentId}...`}
                        placeholderTextColor={COLORS.muted}
                        multiline
                      />
                      <TouchableOpacity
                        style={[styles.commentSubmitButton, sendingComment && styles.commentSubmitButtonDisabled]}
                        onPress={handleSubmitComment}
                        disabled={sendingComment}
                      >
                        <Text style={styles.commentSubmitText}>
                          {sendingComment ? 'Sending...' : 'Post reply'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
          {comments.length > 0 ? (
            <View style={styles.commentPagerRow}>
              <Text style={styles.metaText}>
                Showing {Math.min(visibleCommentLimit, comments.length)} / {comments.length} comments
              </Text>
              {hasMoreComments ? (
                <TouchableOpacity style={styles.commentPagerButton} onPress={handleLoadMoreComments}>
                  <Text style={styles.commentPagerText}>Load more comments</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal transparent visible={showDisableModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Disable this post?</Text>
            <Text style={styles.modalText}>
              The post will be hidden from the community feed.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={() => setShowDisableModal(false)}
                disabled={disabling}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.dangerButton]}
                onPress={handleDisableConfirm}
                disabled={disabling}
              >
                <Text style={styles.dangerText}>
                  {disabling ? 'Disabling...' : 'Disable'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showEnableModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enable this post?</Text>
            <Text style={styles.modalText}>
              The post will be visible in the community feed.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={() => setShowEnableModal(false)}
                disabled={enabling}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handleEnableConfirm}
                disabled={enabling}
              >
                <Text style={styles.primaryText}>
                  {enabling ? 'Enabling...' : 'Enable'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4ECE3',
  },
  container: {
    padding: 20,
    paddingBottom: 48,
    gap: 18,
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#FDF9F5',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backText: {
    color: COLORS.ink,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F0E1D2',
    borderWidth: 1,
    borderColor: '#E2CBB5',
  },
  statusPillText: {
    color: '#805233',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  heroShell: {
    height: 252,
    borderRadius: 26,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#D9C2AE',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F1E5DA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroFallbackText: {
    color: COLORS.muted,
    fontWeight: '600',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(34, 22, 13, 0.36)',
  },
  heroInfo: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    gap: 10,
  },
  heroCategoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  heroCategoryText: {
    color: '#FFF9F3',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '700',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
  },
  heroMetaText: {
    color: '#FDF7F0',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9B7B63',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  softStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F5ECE3',
    borderWidth: 1,
    borderColor: '#EAD8C7',
  },
  softStatusText: {
    color: '#8B5A37',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  metaText: {
    color: COLORS.muted,
    fontSize: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.ink,
  },
  editBlock: {
    gap: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.ink,
    backgroundColor: '#FBF7F3',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.ink,
  },
  metaStrip: {
    flexDirection: 'row',
    gap: 10,
  },
  metaCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9DDD1',
    backgroundColor: '#FCF7F2',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  metaIconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1E3D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaCopyBlock: {
    flex: 1,
    gap: 2,
  },
  metaCardLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaCardValue: {
    color: COLORS.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  recipeBlock: {
    gap: 14,
  },
  recipeIntroCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8D8C7',
    backgroundColor: '#FCF5EE',
    padding: 12,
  },
  recipeIntroIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1E2D1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeIntroCopy: {
    flex: 1,
    gap: 4,
  },
  recipeTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.ink,
  },
  recipeNote: {
    color: COLORS.muted,
    lineHeight: 20,
  },
  recipeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  recipeGridItem: {
    width: '48%',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 11,
    backgroundColor: '#FBF7F3',
  },
  recipeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
  },
  recipeValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ink,
  },
  occasionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  occasionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
  },
  occasionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accent,
  },
  ingredientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ingredientChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FBF7F3',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ingredientText: {
    fontSize: 12,
    color: COLORS.ink,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FBF7F3',
  },
  chipActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.ink,
  },
  chipTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
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
    fontSize: 15,
    lineHeight: 24,
  },
  commentCountPill: {
    minWidth: 28,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2CBB5',
    backgroundColor: '#F4E5D7',
    alignItems: 'center',
  },
  commentCountText: {
    color: '#805233',
    fontSize: 12,
    fontWeight: '700',
  },
  commentComposer: {
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: '#FCF8F4',
    padding: 12,
  },
  commentInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  commentSubmitButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  commentSubmitButtonDisabled: {
    opacity: 0.6,
  },
  commentSubmitText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  replyHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  replyHintText: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  replyHintAction: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  inlineReplyComposer: {
    marginTop: 4,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E9DDD1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 10,
  },
  commentList: {
    gap: 10,
  },
  commentCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: '#FBF7F3',
    padding: 12,
    gap: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  commentAuthor: {
    flex: 1,
    color: COLORS.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  commentTime: {
    color: COLORS.muted,
    fontSize: 11,
  },
  commentContent: {
    color: COLORS.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  commentReplyButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2CBB5',
    backgroundColor: '#F4E5D7',
  },
  commentReplyText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  replyList: {
    marginTop: 4,
    gap: 8,
  },
  commentPagerRow: {
    marginTop: 2,
    gap: 8,
    alignItems: 'flex-start',
  },
  commentPagerButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2CBB5',
    backgroundColor: '#F4E5D7',
  },
  commentPagerText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  replyCard: {
    marginLeft: 16,
    borderWidth: 1,
    borderColor: '#E9DDD1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
  },
  secondaryButton: {
    backgroundColor: COLORS.accentSoft,
  },
  dangerButton: {
    backgroundColor: '#3B1F1A',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryText: {
    color: COLORS.ink,
    fontWeight: '700',
  },
  dangerText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 14, 10, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.ink,
  },
  modalText: {
    color: COLORS.muted,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  stepsBlock: {
    marginTop: 16,
    gap: 12,
  },
  stepsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.ink,
    fontWeight: '500',
  },
});