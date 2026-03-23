import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

type PostCategory = {
  postCategoryId: number;
  name?: string | null;
  categoryName?: string | null;
  description?: string | null;
};

type Ingredient = {
  ingredient?: {
    name?: string | null;
  };
};

type RecipeData = {
  recipeId?: number;
  shopRecipeId?: number;
  recipeName?: string;
  flavorNote?: string;
  brewingMethod?: string | null;
  prepTimeRange?: string | null;
  suggestedOccasions?: string | null;
};

const COLORS = {
  bg: '#F7F3EF',
  card: '#FFFFFF',
  text: '#3C2A21',
  muted: '#8E7B6F',
  border: '#E2D6CB',
  accent: '#B98155',
  accentDeep: '#9C6D44',
  accentSoft: '#F3E4D4',
  shadow: '#D9C9BB',
};

const safeParseJson = (value?: string) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export default function PublishRecipeScreen() {
  const router = useRouter();
  const { recipeId, recipe: recipeParam, ingredients: ingredientsParam } = useLocalSearchParams();

  const [recipe, setRecipe] = useState<RecipeData | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<PostCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const resolvedRecipeId = useMemo(() => {
    const idFromParams = Number(recipeId ?? 0);
    const idFromRecipe = Number(recipe?.shopRecipeId ?? recipe?.recipeId ?? 0);
    return idFromParams || idFromRecipe || 0;
  }, [recipeId, recipe]);

  const ingredientNames = useMemo(() => {
    return ingredients
      .map((item) => item?.ingredient?.name)
      .filter((name): name is string => Boolean(name));
  }, [ingredients]);

  const filteredCategories = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((category) => {
      const label = (category.categoryName ?? category.name ?? '').toLowerCase();
      return label.includes(query);
    });
  }, [categories, categoryQuery]);

  const selectedCategoryLabel = useMemo(() => {
    const selected = categories.find((category) => category.postCategoryId === selectedCategoryId);
    return selected?.categoryName ?? selected?.name ?? null;
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    const parsedRecipe = safeParseJson(recipeParam as string) as RecipeData | null;
    const parsedIngredients = safeParseJson(ingredientsParam as string) as Ingredient[] | null;
    setRecipe(parsedRecipe ?? null);
    setIngredients(Array.isArray(parsedIngredients) ? parsedIngredients : []);
  }, [recipeParam, ingredientsParam]);

  useEffect(() => {
    if (!recipe) return;
    setTitle((prev) => (prev.trim().length > 0 ? prev : recipe.recipeName ?? ''));
  }, [recipe]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoadingCategories(true);
        const response = await authorizedFetch(API_ENDPOINTS.postCategory.list());
        const payload = await response.json();
        const normalized = Array.isArray(payload) ? payload : payload?.data ?? payload?.items ?? [];
        setCategories(normalized);
        if (normalized.length > 0) {
          setSelectedCategoryId((prev) => prev ?? normalized[0].postCategoryId);
        }
      } catch (error) {
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

  const handlePublish = async () => {
    if (!resolvedRecipeId) {
      Toast.show({ type: 'error', text1: 'Missing recipe id' });
      return;
    }
    if (!title.trim() || !content.trim() || !selectedCategoryId) {
      Toast.show({
        type: 'error',
        text1: 'Missing fields',
        text2: 'Please fill title, category, and content.',
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await authorizedFetch(API_ENDPOINTS.shopRecipe.enablePublic(resolvedRecipeId), {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          postCategoryId: selectedCategoryId,
          content: content.trim(),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }

      Toast.show({ type: 'success', text1: 'Recipe submitted for approval.' });
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Publish failed.';
      Toast.show({ type: 'error', text1: 'Publish failed', text2: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>Publish Recipe</Text>
            <Text style={styles.subtitle}>Let the community taste your creation.</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.snapshotCard}>
          <View style={styles.snapshotHeader}>
            <Text style={styles.snapshotTitle}>Recipe Snapshot</Text>
            <Text style={styles.snapshotMeta}>ID #{resolvedRecipeId || '--'}</Text>
          </View>
          <Text style={styles.snapshotName}>
            {recipe?.recipeName?.trim() || 'Untitled Recipe'}
          </Text>
          {recipe?.flavorNote ? (
            <Text style={styles.snapshotNote}>{recipe.flavorNote}</Text>
          ) : null}

          <View style={styles.snapshotGrid}>
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>Method</Text>
              <Text style={styles.snapshotValue}>{recipe?.brewingMethod || 'Not set'}</Text>
            </View>
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>Prep time</Text>
              <Text style={styles.snapshotValue}>{recipe?.prepTimeRange || 'Not set'}</Text>
            </View>
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>Occasions</Text>
              <Text style={styles.snapshotValue}>{recipe?.suggestedOccasions || 'Open'}</Text>
            </View>
          </View>

          {ingredientNames.length > 0 ? (
            <View style={styles.ingredientWrap}>
              {ingredientNames.map((name) => (
                <View key={name} style={styles.ingredientChip}>
                  <Text style={styles.ingredientText}>{name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyHint}>No ingredients added yet.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Post details</Text>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter title"
            placeholderTextColor={COLORS.muted}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[styles.label, styles.sectionSpacing]}>Category</Text>
          <TouchableOpacity
            style={styles.selectBar}
            onPress={() => setIsCategoryOpen((prev) => !prev)}
            activeOpacity={0.8}
          >
            <View style={styles.selectTextWrap}>
              <Text style={styles.selectLabel}>Category</Text>
              <Text style={styles.selectValue}>
                {selectedCategoryLabel ?? 'Select a category'}
              </Text>
            </View>
            <Text style={styles.selectChevron}>{isCategoryOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {loadingCategories ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.mutedText}>Loading categories...</Text>
            </View>
          ) : isCategoryOpen ? (
            <View style={styles.dropdownPanel}>
              <TextInput
                style={[styles.input, styles.inputCompact]}
                placeholder="Search categories"
                placeholderTextColor={COLORS.muted}
                value={categoryQuery}
                onChangeText={setCategoryQuery}
              />
            <ScrollView
                style={styles.categoryList}
                contentContainerStyle={styles.categoryListContent}
                nestedScrollEnabled
            >
              {filteredCategories.length === 0 ? (
                <Text style={styles.categoryEmpty}>No categories found.</Text>
              ) : (
                filteredCategories.map((category) => {
                  const active = category.postCategoryId === selectedCategoryId;
                  const label =
                    category.categoryName ?? category.name ?? `#${category.postCategoryId}`;
                  return (
                    <TouchableOpacity
                      key={category.postCategoryId}
                      onPress={() => {
                        setSelectedCategoryId(category.postCategoryId);
                        setIsCategoryOpen(false);
                      }}
                      style={[styles.categoryOption, active && styles.categoryOptionActive]}
                    >
                      <View style={[styles.categoryRadio, active && styles.categoryRadioActive]} />
                      <Text
                        style={[styles.categoryOptionText, active && styles.categoryOptionTextActive]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            </View>
          ) : null}

          <Text style={[styles.label, styles.sectionSpacing]}>Content</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Write your story, origin, and brew tips"
            placeholderTextColor={COLORS.muted}
            multiline
            value={content}
            onChangeText={setContent}
          />
          <Text style={styles.helperText}>This content is visible to all users.</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
          onPress={handlePublish}
          disabled={submitting}
        >
          <Text style={styles.primaryButtonText}>
            {submitting ? 'Publishing...' : 'Publish'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 8,
  },
  container: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FBF6F0',
  },
  backText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  headerTextBlock: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.muted,
  },
  headerSpacer: {
    width: 46,
  },
  snapshotCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  snapshotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  snapshotTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accentDeep,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  snapshotMeta: {
    fontSize: 12,
    color: COLORS.muted,
  },
  snapshotName: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  snapshotNote: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
  },
  snapshotGrid: {
    marginTop: 14,
    gap: 10,
  },
  snapshotItem: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  snapshotLabel: {
    fontSize: 11,
    color: COLORS.accentDeep,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  snapshotValue: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.text,
  },
  ingredientWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  ingredientChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#FBF7F2',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ingredientText: {
    fontSize: 12,
    color: COLORS.text,
  },
  emptyHint: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.muted,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  sectionSpacing: {
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    backgroundColor: '#FFFDFB',
  },
  inputCompact: {
    paddingVertical: 8,
  },
  textArea: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFDFB',
  },
  selectTextWrap: {
    flex: 1,
  },
  selectLabel: {
    fontSize: 11,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  selectValue: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  selectChevron: {
    fontSize: 12,
    color: COLORS.muted,
    marginLeft: 12,
  },
  dropdownPanel: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: '#FBF7F2',
    padding: 10,
    gap: 10,
  },
  categoryList: {
    maxHeight: 220,
  },
  categoryListContent: {
    gap: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFDFB',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryOptionActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  categoryRadio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
  },
  categoryRadioActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
  },
  categoryOptionText: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
  },
  categoryOptionTextActive: {
    color: COLORS.accentDeep,
    fontWeight: '700',
  },
  categoryEmpty: {
    color: COLORS.muted,
    fontSize: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mutedText: {
    color: COLORS.muted,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.muted,
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
