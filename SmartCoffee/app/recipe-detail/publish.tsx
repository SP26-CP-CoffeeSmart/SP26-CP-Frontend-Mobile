import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

type PostCategory = {
  postCategoryId: number;
  name: string;
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
};

const safeParseJson = (value?: string) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const buildDefaultContent = (recipe: RecipeData | null, ingredients: Ingredient[]) => {
  if (!recipe) return '';
  const lines: string[] = [];

  if (recipe.recipeName) lines.push(`Recipe: ${recipe.recipeName}`);
  if (recipe.flavorNote) lines.push(`Flavor: ${recipe.flavorNote}`);
  if (recipe.brewingMethod) lines.push(`Method: ${recipe.brewingMethod}`);
  if (recipe.prepTimeRange) lines.push(`Prep time: ${recipe.prepTimeRange}`);
  if (recipe.suggestedOccasions) lines.push(`Occasions: ${recipe.suggestedOccasions}`);

  const ingredientNames = ingredients
    .map((item) => item?.ingredient?.name)
    .filter((name): name is string => Boolean(name));

  if (ingredientNames.length > 0) {
    lines.push(`Ingredients: ${ingredientNames.join(', ')}`);
  }

  return lines.join('\n');
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

  const resolvedRecipeId = useMemo(() => {
    const idFromParams = Number(recipeId ?? 0);
    const idFromRecipe = Number(recipe?.shopRecipeId ?? recipe?.recipeId ?? 0);
    return idFromParams || idFromRecipe || 0;
  }, [recipeId, recipe]);

  useEffect(() => {
    const parsedRecipe = safeParseJson(recipeParam as string) as RecipeData | null;
    const parsedIngredients = safeParseJson(ingredientsParam as string) as Ingredient[] | null;
    setRecipe(parsedRecipe ?? null);
    setIngredients(Array.isArray(parsedIngredients) ? parsedIngredients : []);
  }, [recipeParam, ingredientsParam]);

  useEffect(() => {
    if (!recipe) return;
    setTitle(recipe.recipeName ?? '');
    setContent(buildDefaultContent(recipe, ingredients));
  }, [recipe, ingredients]);

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
          <Text style={styles.title}>Publish Recipe</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter title"
            placeholderTextColor={COLORS.muted}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[styles.label, styles.sectionSpacing]}>Category</Text>
          {loadingCategories ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.mutedText}>Loading categories...</Text>
            </View>
          ) : (
            <View style={styles.chipRow}>
              {categories.map((category) => {
                const active = category.postCategoryId === selectedCategoryId;
                return (
                  <TouchableOpacity
                    key={category.postCategoryId}
                    onPress={() => setSelectedCategoryId(category.postCategoryId)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={[styles.label, styles.sectionSpacing]}>Content</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Write a short description"
            placeholderTextColor={COLORS.muted}
            multiline
            value={content}
            onChangeText={setContent}
          />
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
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 46,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  textArea: {
    minHeight: 140,
    textAlignVertical: 'top',
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
    backgroundColor: '#FBF7F2',
  },
  chipActive: {
    borderColor: COLORS.accent,
    backgroundColor: '#F5E9DD',
  },
  chipText: {
    fontSize: 12,
    color: COLORS.text,
  },
  chipTextActive: {
    color: COLORS.accentDeep,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mutedText: {
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
