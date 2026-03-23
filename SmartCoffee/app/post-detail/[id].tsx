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

import { API_ENDPOINTS, AUTH_BASE_URL } from '@/services/api';
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

const resolveRecipeImageUrl = (raw?: string | null) => {
  if (!raw || raw === 'null' || raw === 'undefined') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `${AUTH_BASE_URL}${raw.startsWith('/') ? raw : `/images/${raw}`}`;
};

export default function PostDetailScreen() {
  const router = useRouter();
  const { coffeeShopId } = useAuth();
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
  const lastReportedViewKey = useRef<string | null>(null);

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
      setEditTitle(data?.title ?? '');
      setEditContent(data?.content ?? '');
      setSelectedCategoryId(data?.postCategoryId ?? null);

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
  const isPublicPost = postStatus === 'public' || postStatus === 'active';
  const isPendingPost = postStatus === 'pending';
  const canEditPost = canManagePost && !isPublicPost;
  const showManageButtons = canManagePost && !isPendingPost;
  const recipeImage = resolveRecipeImageUrl(recipe?.image ?? null);
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
              <Text style={styles.tagText}>{categoryLabel}</Text>
            </View>
            <Text style={styles.metaText}>{dateLabel}</Text>
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
            <Text style={styles.title}>{post?.title}</Text>
          )}

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
                <Text style={styles.recipeTitle}>{recipe.recipeName ?? 'Untitled recipe'}</Text>
                {recipe.flavorNote ? (
                  <Text style={styles.recipeNote}>{recipe.flavorNote}</Text>
                ) : null}

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
              </View>
            ) : (
              <Text style={styles.metaText}>No recipe details available.</Text>
            )}
          </View>
        ) : null}
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
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
  },
  recipeBlock: {
    gap: 12,
  },
  recipeImage: {
    width: '100%',
    height: 180,
    borderRadius: 18,
  },
  recipeImageFallback: {
    width: '100%',
    height: 180,
    borderRadius: 18,
    backgroundColor: '#F1E5DA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  recipeTitle: {
    fontSize: 20,
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
    borderRadius: 14,
    padding: 10,
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
    lineHeight: 22,
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
});
