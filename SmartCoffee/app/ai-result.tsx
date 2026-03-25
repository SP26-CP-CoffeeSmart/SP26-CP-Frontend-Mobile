import React, { useEffect, useMemo, useRef, useState } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useAiSavedRecipe } from '@/context/ai-saved-recipe-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

interface Recipe {
  recipeName: string;
  image: string;
  createdSource: string;
  category: string;
  flavorStylePrimary: string;
  flavorStyleSecondary: string;
  brewingMethod: string;
  difficultyLevel: string;
  prepTimeRange: string;
  flavorNote: string;
  brewingSteps: string | string[];
  brewingVariablesData?: string | Record<string, any>;
  brewingVariables?: string | Record<string, any>;
  presentationData?: string | Record<string, any>;
  presentation?: string | Record<string, any>;
  ingredients?: Array<Record<string, any>>;
  isHot: boolean;
  isCold: boolean;
  hasIce: boolean;
  caffeineStrength: number;
  proposedSellingPrice: number;
  profitMarginPercent: number;
  status: string;
  shopRecipeIngredients?: Array<{
    id: number;
    quantity: number;
    cost: number;
    ingredient: {
      ingredientId: number;
      name: string;
      image: string;
      category: string;
      createDate: string;
      endDate: string;
    };
  }>;
  [key: string]: any;
}

interface UniquenessInfo {
  maxJaccardSimilarity?: number;
  uniquenessScore?: number;
  mostSimilarRecipeId?: number;
  mostSimilarRecipeName?: string;
  isUnique?: boolean;
  existingRecipesCompared?: number;
  newIngredientCount?: number;
}

export default function AiResultScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { isRecipeSaved, markRecipeSaved } = useAiSavedRecipe();
  const { data, beverageId, beverage } = useLocalSearchParams<{
    data?: string;
    beverageId?: string;
    beverage?: string;
  }>();
  const parsedBeverageId = beverageId ? Number.parseInt(beverageId, 10) : NaN;
  let selectedBeverage: Record<string, any> | null = null;
  if (beverage) {
    try {
      selectedBeverage = JSON.parse(String(beverage));
    } catch {
      selectedBeverage = null;
    }
  }
  const fallbackImage =
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=1200&auto=format&fit=crop';

  const toBool = (value: unknown) => value === true || value === 'true' || value === 1;

  const buildRecipeSaveToken = (targetRecipe: Recipe | null): string | null => {
    if (!targetRecipe) return null;

    const ingredientSource = Array.isArray(targetRecipe.shopRecipeIngredients)
      ? targetRecipe.shopRecipeIngredients
      : Array.isArray((targetRecipe as any).ingredients)
        ? ((targetRecipe as any).ingredients as Array<any>)
        : [];

    const ingredientsToken = ingredientSource
      .map((item: any) => {
        const id = item?.id ?? item?.ingredientId ?? item?.ingredient?.ingredientId ?? '';
        const qty = item?.quantity ?? item?.amount ?? '';
        return `${id}:${qty}`;
      })
      .join('|');

    return [
      Number.isFinite(parsedBeverageId) ? parsedBeverageId : 'no-beverage',
      String(targetRecipe.recipeName ?? ''),
      String(targetRecipe.proposedSellingPrice ?? ''),
      String(targetRecipe.profitMarginPercent ?? ''),
      ingredientsToken,
    ].join('::');
  };

  const parseJsonString = (value: unknown): any => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try {
          return JSON.parse(trimmed);
        } catch {
          return value;
        }
      }
    }
    return value;
  };

  const formatBrewingVariables = (value: unknown): string => {
    const parsed = parseJsonString(value);
    if (typeof parsed === 'string') {
      return parsed || '-';
    }
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.entries(parsed)
        .map(([key, val]) => `${key}: ${val}`)
        .join('\n') || '-';
    }
    return '-';
  };

  const formatPercent = (value: unknown, digits = 0): string => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `${(value * 100).toFixed(digits)}%`;
    }
    return '-';
  };

  const formatCount = (value: unknown): string => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return '-';
  };

  const normalizeImageUrl = (url: unknown): string => {
    if (!url || typeof url !== 'string') return fallbackImage;
    const trimmed = url.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return fallbackImage;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return fallbackImage;

    // Re-encode Firebase URLs: convert / back to %2F in the path
    if (trimmed.includes('firebasestorage.googleapis.com')) {
      // Find the 'o/' part and encode everything after it
      const oIndex = trimmed.indexOf('/o/');
      if (oIndex !== -1) {
        const baseUrl = trimmed.substring(0, oIndex + 3); // includes '/o/'
        const path = trimmed.substring(oIndex + 3);
        const encodedPath = path.replace(/\//g, '%2F');
        return baseUrl + encodedPath;
      }
    }

    return trimmed;
  };

  const toList = (value: unknown): string[] => {
    if (value === null || value === undefined || value === '') return [];
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).filter(Boolean);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      const splitByStep = trimmed.split(/(?=Bước\s*\d+:)/g).map((item) => item.trim());
      if (splitByStep.length > 1) return splitByStep.filter(Boolean);
      return trimmed.split(/\n|•/g).map((item) => item.trim()).filter(Boolean);
    }
    return [];
  };

  const resolveGeneratedImageUrl = (payload: any): string | null => {
    if (!payload) return null;
    if (typeof payload === 'string') return payload;
    return (
      payload.imageUrl ||
      payload.firebaseUrl ||
      payload.image ||
      (Array.isArray(payload.results) && payload.results[0]?.imageUrl) ||
      payload.data?.imageUrl ||
      payload.data?.firebaseUrl ||
      payload.data?.image ||
      payload.result?.imageUrl ||
      payload.result?.firebaseUrl ||
      payload.result?.image ||
      (Array.isArray(payload.images) && payload.images[0]?.url) ||
      null
    );
  };

  const encodeFirebaseImageUrl = (url: unknown): string | undefined => {
    if (!url || typeof url !== 'string') return undefined;
    const trimmed = url.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return undefined;

    // Encode Firebase URLs: convert / to %2F in the path after '/o/'
    if (trimmed.includes('firebasestorage.googleapis.com')) {
      const oIndex = trimmed.indexOf('/o/');
      if (oIndex !== -1) {
        const baseUrl = trimmed.substring(0, oIndex + 3); // includes '/o/'
        const path = trimmed.substring(oIndex + 3);
        const encodedPath = path.replace(/\//g, '%2F');
        return baseUrl + encodedPath;
      }
    }

    return trimmed;
  };

  let recipe: Recipe | null = null;
  let imageGeneration: any = null;
  let uniqueness: UniquenessInfo | null = null;
  let imagePrompt: string | null = null;
  if (data) {
    try {
      const parsed = JSON.parse(String(data));
      console.log('AI Recipe Result raw payload:', parsed);
      recipe = parsed?.recipe ?? parsed;
      imageGeneration = parsed?.imageGeneration ?? null;
      imagePrompt = parsed?.imagePrompt ?? null;
      uniqueness = parsed?.uniqueness ?? parsed?.recipe?.uniqueness ?? null;
    } catch {
      recipe = null;
      imageGeneration = null;
      uniqueness = null;
      imagePrompt = null;
    }
  }

  const resolveUniquenessStatus = (value: UniquenessInfo | null): boolean | null => {
    if (!value) return null;
     if (typeof value.uniquenessScore === 'number') {
      return value.uniquenessScore >= 0.6;
    }
    if (typeof value.isUnique === 'boolean') return value.isUnique;
    if (typeof value.maxJaccardSimilarity === 'number') {
      return value.maxJaccardSimilarity === 0;
    }
   
    return null;
  };

  const ingredientsList =
    (recipe?.shopRecipeIngredients && recipe.shopRecipeIngredients.length > 0
      ? recipe.shopRecipeIngredients
      : ((recipe as any)?.ingredients as Array<any> | undefined)) ?? [];

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };

  const recipeSaveToken = useMemo(() => buildRecipeSaveToken(recipe), [recipe]);

  useEffect(() => {
    const recipeId = Number(recipe?.recipeId);
    setIsSaved(isRecipeSaved(Number.isFinite(recipeId) ? recipeId : null, recipeSaveToken));
  }, [isRecipeSaved, recipe?.recipeId, recipeSaveToken]);

  useEffect(() => {
    let isActive = true;
    const generateImage = async () => {
      const hasGeneratedImage =
        Boolean(generatedImageUrl) ||
        (typeof recipe?.image === 'string' && recipe.image.includes('firebasestorage.googleapis.com'));

      if (!imagePrompt || !recipe?.recipeName || isGeneratingImage || hasGeneratedImage) {
        return;
      }

      setIsGeneratingImage(true);
      try {
        const response = await authorizedFetch(`${AUTH_BASE_URL}/AI/generate-recipe-images`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              recipeName: recipe.recipeName,
              imagePrompt,
            },
          ]),
        });

        const responseText = await response.text();
        if (!response.ok) {
          throw new Error(responseText || `Request failed (${response.status})`);
        }

        const payload = responseText ? JSON.parse(responseText) : null;
        const resolvedUrl = resolveGeneratedImageUrl(payload);
        if (isActive && resolvedUrl) {
          setGeneratedImageUrl(resolvedUrl);
        }
      } catch (error) {
        console.error('Image generation error:', error);
      } finally {
        if (isActive) {
          setIsGeneratingImage(false);
        }
      }
    };

    generateImage();

    return () => {
      isActive = false;
    };
  }, [imagePrompt, recipe?.recipeName, isGeneratingImage, generatedImageUrl]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleSaveRecipe = async () => {
    if (!recipe) {
      Alert.alert('Error', 'No recipe data to save');
      return;
    }

    if (!Number.isFinite(parsedBeverageId)) {
      Alert.alert('Error', 'Missing beverage selection. Please choose a beverage first.');
      return;
    }

    if (isSaved) {
      return;
    }

    setIsLoading(true);
    try {
      const encodedRecipeImage = encodeFirebaseImageUrl(recipe.image);
      const encodedGeneratedImage = encodeFirebaseImageUrl(generatedImageUrl ?? undefined);
      const finalImageUrl = encodedGeneratedImage || encodedRecipeImage;
      const resolvedIsUnique =
        typeof recipe?.isUnique === 'boolean'
          ? recipe.isUnique
          : typeof uniqueness?.isUnique === 'boolean'
            ? uniqueness.isUnique
            : false;

      const rawRecipe = { ...recipe } as Record<string, any>;
      const recipeEntries = Object.entries(rawRecipe).filter(
        ([key]) => key !== 'isUnique' && key !== 'beverageId' && key !== 'totalCost' && key !== 'createDate' && key !== 'applyDate'
      );

      const orderedRecipe: Record<string, any> = {};
      let insertedIsUnique = false;
      recipeEntries.forEach(([key, value]) => {
        orderedRecipe[key] = value;
        if (key === 'isPublic') {
          orderedRecipe.isUnique = resolvedIsUnique;
          insertedIsUnique = true;
        }
      });

      if (!insertedIsUnique) {
        orderedRecipe.isUnique = resolvedIsUnique;
      }

      const sourceIngredients = Array.isArray(rawRecipe.ingredients)
        ? rawRecipe.ingredients
        : Array.isArray(rawRecipe.shopRecipeIngredients)
          ? rawRecipe.shopRecipeIngredients
          : [];

      const normalizedIngredients = sourceIngredients
        .map((item: any) => {
          const resolvedId = Number(
            item?.id ?? item?.ingredientId ?? item?.ingredient?.ingredientId ?? 0
          );
          const quantity = Number(item?.quantity ?? item?.amount ?? 0);
          const cost = Number(item?.cost ?? 0);
          const measurement =
            item?.measurement ??
            (item?.ingredient?.category === 'Milk' || item?.ingredient?.category === 'Beverage'
              ? 'ml'
              : 'g');

          return {
            ingredientId: resolvedId,
            quantity: Number.isFinite(quantity) ? quantity : 0,
            cost: Number.isFinite(cost) ? cost : 0,
            measurement: String(measurement ?? ''),
          };
        })
        .filter((item: { ingredientId: number }) => Number.isFinite(item.ingredientId) && item.ingredientId > 0);

      if (normalizedIngredients.length > 0) {
        orderedRecipe.ingredients = normalizedIngredients;
      } else {
        delete orderedRecipe.ingredients;
      }

      delete orderedRecipe.shopRecipeIngredients;

      orderedRecipe.beverageId = Number.isFinite(parsedBeverageId)
        ? parsedBeverageId
        : recipe.beverageId;

      const requestBody: Record<string, any> = {
        recipe: orderedRecipe,
      };

      if (uniqueness) {
        requestBody.uniqueness = uniqueness;
      }
      if (imagePrompt) {
        requestBody.imagePrompt = imagePrompt;
      }
      if (finalImageUrl) {
        requestBody.imageUrl = finalImageUrl;
      }

      console.log('========== SAVE RECIPE REQUEST ==========');
      console.log('Request Body:');
      console.log(JSON.stringify(requestBody, null, 2));
      console.log('========================================');

      const response = await authorizedFetch(`${AUTH_BASE_URL}/ShopRecipe/save-ai-recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response body:', responseText);

      if (!response.ok) {
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData?.message || `HTTP ${response.status}`);
        } catch {
          throw new Error(`HTTP ${response.status}: ${responseText}`);
        }
      }

      const result = JSON.parse(responseText);
      console.log('Recipe saved successfully:', result);

      const recipeId = Number(recipe?.recipeId);
      markRecipeSaved(Number.isFinite(recipeId) ? recipeId : null, recipeSaveToken);

      setIsSaved(true);
      showToast('Recipe saved successfully!');
    } catch (error) {
      console.error('Error saving recipe:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to save recipe. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const displayImageUrl = normalizeImageUrl(generatedImageUrl ?? recipe?.image);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image
            source={{
              uri: displayImageUrl,
            }}
            style={styles.heroImage}
          />
          {isGeneratingImage ? (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator color="#FFFFFF" size="large" />
            </View>
          ) : null}
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back-ios-new" size={20} color="#FFFFFF" />
            </Pressable>
            <ThemedText style={styles.heroTitle}>AI Recipe Result</ThemedText>
          </View>
        </View>

        <View style={styles.card}>
          {recipe?.status === 'Error' ? (
            <View style={styles.alertBox}>
              <MaterialIcons name="error-outline" size={18} color="#B45309" />
              <ThemedText style={styles.alertText}>
                Backend returned status Error. Please try again or check API response.
              </ThemedText>
            </View>
          ) : null}
          <Image
            source={{
              uri: displayImageUrl,
            }}
            style={styles.resultBanner}
          />
          <View style={styles.titleRow}>
            <Image
              source={{
                uri: displayImageUrl,
              }}
              style={styles.thumbnail}
            />
            <View style={styles.titleStack}>
              <ThemedText style={styles.recipeTitle}>
                {recipe?.recipeName || 'Recipe Result'}
              </ThemedText>
              <ThemedText style={styles.recipeSubtitle}>
                {recipe?.createdSource || 'AI Recommendation'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.sectionSpacing} />
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <MaterialIcons name="whatshot" size={14} color="#B45309" />
              <ThemedText style={styles.pillText}>
                {recipe?.isHot === null || recipe?.isHot === undefined
                  ? 'Unknown'
                  : toBool(recipe?.isHot)
                    ? 'Hot'
                    : 'Not Hot'}
              </ThemedText>
            </View>
            <View style={styles.pill}>
              <MaterialIcons name="ac-unit" size={14} color="#2563EB" />
              <ThemedText style={styles.pillText}>
                {recipe?.isCold === null || recipe?.isCold === undefined
                  ? 'Unknown'
                  : toBool(recipe?.isCold)
                    ? 'Cold'
                    : 'Not Cold'}
              </ThemedText>
            </View>
            <View style={styles.pill}>
              <MaterialIcons name="icecream" size={14} color="#0EA5E9" />
              <ThemedText style={styles.pillText}>
                {recipe?.hasIce === null || recipe?.hasIce === undefined
                  ? 'Unknown'
                  : toBool(recipe?.hasIce)
                    ? 'Has Ice'
                    : 'No Ice'}
              </ThemedText>
            </View>
          </View>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="info-outline" size={16} color="#8B5E3C" />
            <ThemedText style={styles.sectionTitle}>Detail</ThemedText>
          </View>
          <View style={styles.factsGrid}>
            <View style={styles.factCard}>
              <ThemedText style={styles.factLabel}>Category</ThemedText>
              <ThemedText style={styles.factValue}>{recipe?.category || '-'}</ThemedText>
            </View>
            <View style={styles.factCard}>
              <ThemedText style={styles.factLabel}>Flavor Style</ThemedText>
              <ThemedText style={styles.factValue}>
                {recipe?.flavorStylePrimary || '-'}
                {recipe?.flavorStyleSecondary ? ` · ${recipe.flavorStyleSecondary}` : ''}
              </ThemedText>
            </View>
            <View style={styles.factCard}>
              <ThemedText style={styles.factLabel}>Brewing Method</ThemedText>
              <ThemedText style={styles.factValue}>{recipe?.brewingMethod || '-'}</ThemedText>
            </View>
            <View style={styles.factCard}>
              <ThemedText style={styles.factLabel}>Difficulty</ThemedText>
              <ThemedText style={styles.factValue}>{recipe?.difficultyLevel || '-'}</ThemedText>
            </View>
            <View style={styles.factCard}>
              <ThemedText style={styles.factLabel}>Prep Time</ThemedText>
              <ThemedText style={styles.factValue}>{recipe?.prepTimeRange || '-'}</ThemedText>
            </View>
            <View style={styles.factCard}>
              <ThemedText style={styles.factLabel}>Caffeine Strength</ThemedText>
              <ThemedText style={styles.factValue}>
                {recipe?.caffeineStrength || '-'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.sectionSpacing} />

          <View style={styles.sectionHeader}>
            <MaterialIcons name="insights" size={16} color="#8B5E3C" />
            <ThemedText style={styles.sectionTitle}>Uniqueness</ThemedText>
          </View>
          {uniqueness ? (
            <>
              <View style={styles.factsGrid}>
                <View style={styles.factCard}>
                  <ThemedText style={styles.factLabel}>Status</ThemedText>
                  <ThemedText style={styles.factValue}>
                    {resolveUniquenessStatus(uniqueness) === null
                      ? 'Unknown'
                      : resolveUniquenessStatus(uniqueness)
                        ? 'Unique'
                        : 'Not unique'}
                  </ThemedText>
                </View>
                <View style={styles.factCard}>
                  <ThemedText style={styles.factLabel}>Score</ThemedText>
                  <ThemedText style={styles.factValue}>
                    {formatPercent(uniqueness.uniquenessScore, 0)}
                  </ThemedText>
                </View>
                <View style={styles.factCard}>
                  <ThemedText style={styles.factLabel}>Max Similarity</ThemedText>
                  <ThemedText style={styles.factValue}>
                    {formatPercent(uniqueness.maxJaccardSimilarity, 0)}
                  </ThemedText>
                </View>
                <View style={styles.factCard}>
                  <ThemedText style={styles.factLabel}>Compared</ThemedText>
                  <ThemedText style={styles.factValue}>
                    {formatCount(uniqueness.existingRecipesCompared)}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.sectionSpacing} />
              <View style={styles.row}>
                <View style={styles.labelRow}>
                  <MaterialIcons name="compare" size={16} color="#8B5E3C" />
                  <ThemedText style={styles.label}>Most Similar</ThemedText>
                </View>
                <ThemedText style={styles.value}>
                  {uniqueness.mostSimilarRecipeName
                    ? `${uniqueness.mostSimilarRecipeName}${
                      uniqueness.mostSimilarRecipeId ? ` (#${uniqueness.mostSimilarRecipeId})` : ''
                    }`
                    : 'None'}
                </ThemedText>
              </View>
            </>
          ) : (
            <ThemedText style={styles.bodyText}>-</ThemedText>
          )}

          <View style={styles.sectionSpacing} />

          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="category" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Category</ThemedText>
            </View>
            <ThemedText style={styles.value}>{recipe?.category || '-'}</ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="emoji-food-beverage" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Flavor Style</ThemedText>
            </View>
            <ThemedText style={styles.value}>
              {recipe?.flavorStylePrimary || '-'}
              {recipe?.flavorStyleSecondary ? ` · ${recipe.flavorStyleSecondary}` : ''}
            </ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="coffee-maker" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Brewing Method</ThemedText>
            </View>
            <ThemedText style={styles.value}>{recipe?.brewingMethod || '-'}</ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="speed" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Difficulty</ThemedText>
            </View>
            <ThemedText style={styles.value}>{recipe?.difficultyLevel || '-'}</ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="schedule" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Prep Time</ThemedText>
            </View>
            <ThemedText style={styles.value}>{recipe?.prepTimeRange || '-'}</ThemedText>
          </View>

          <View style={styles.sectionSpacing} />

          <View style={styles.sectionHeader}>
            <MaterialIcons name="auto-awesome" size={16} color="#8B5E3C" />
            <ThemedText style={styles.sectionTitle}>Flavor Note</ThemedText>
          </View>
          <ThemedText style={styles.bodyText}>{recipe?.flavorNote || '-'}</ThemedText>

          <View style={styles.sectionSpacing} />

          <View style={styles.sectionHeader}>
            <MaterialIcons name="format-list-bulleted" size={16} color="#8B5E3C" />
            <ThemedText style={styles.sectionTitle}>Brewing Steps</ThemedText>
          </View>
          {toList(parseJsonString(recipe?.brewingSteps))?.length ? (
            <View style={styles.stepsList}>
              {toList(parseJsonString(recipe?.brewingSteps)).map((step, index) => (
                <View key={`${step}-${index}`} style={styles.stepItem}>
                  <View style={styles.stepBullet} />
                  <ThemedText style={styles.stepText}>{step}</ThemedText>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText style={styles.bodyText}>{recipe?.brewingSteps || '-'}</ThemedText>
          )}

          <View style={styles.sectionSpacing} />

          <View style={styles.sectionHeader}>
            <MaterialIcons name="tune" size={16} color="#8B5E3C" />
            <ThemedText style={styles.sectionTitle}>Brewing Variables</ThemedText>
          </View>
          <ThemedText style={styles.bodyText}>
            {formatBrewingVariables(recipe?.brewingVariablesData ?? recipe?.brewingVariables)}
          </ThemedText>

          <View style={styles.sectionSpacing} />

          <View style={styles.sectionHeader}>
            <MaterialIcons name="style" size={16} color="#8B5E3C" />
            <ThemedText style={styles.sectionTitle}>Presentation</ThemedText>
          </View>
          <ThemedText style={styles.bodyText}>
            {formatBrewingVariables(recipe?.presentationData ?? recipe?.presentation)}
          </ThemedText>

          <View style={styles.sectionSpacing} />

          {imagePrompt ? (
            <>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="image" size={16} color="#8B5E3C" />
                <ThemedText style={styles.sectionTitle}>Image Prompt</ThemedText>
              </View>
              <ThemedText style={styles.bodyText}>{imagePrompt}</ThemedText>
              <View style={styles.sectionSpacing} />
            </>
          ) : null}

          <View style={styles.sectionHeader}>
            <MaterialIcons name="shopping-bag" size={16} color="#8B5E3C" />
            <ThemedText style={styles.sectionTitle}>Ingredients</ThemedText>
          </View>
          {ingredientsList.length > 0 ? (
            <View style={styles.ingredientsList}>
              {ingredientsList.map((item, index) => (
                <View
                  key={`${item.id ?? item.ingredient?.ingredientId ?? 'ingredient'}-${index}`}
                  style={styles.ingredientRow}>
                  <View style={styles.ingredientInfo}>
                    <ThemedText style={styles.ingredientName}>
                      {item.ingredient?.name || item.name || (item.id ? `Ingredient ${item.id}` : 'Ingredient')}
                    </ThemedText>
                    <ThemedText style={styles.ingredientDetail}>
                      {(item.quantity ?? item.amount ?? '')}
                      {item.measurement
                        ? ` ${item.measurement}`
                        : item.ingredient?.category === 'Milk' || item.ingredient?.category === 'Beverage'
                          ? 'ml'
                          : 'g'}
                      {item.cost ? ` •${item.cost.toLocaleString()} ₫` : ''}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText style={styles.bodyText}>-</ThemedText>
          )}

          <View style={styles.sectionSpacing} />


          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="bolt" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Caffeine Strength</ThemedText>
            </View>
            <ThemedText style={styles.value}>
                {recipe?.caffeineStrength ?? '-'}
            </ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="payments" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Proposed Price</ThemedText>
            </View>
            <ThemedText style={styles.value}>
                {recipe?.proposedSellingPrice ?? '-'}
            </ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="trending-up" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Profit Margin</ThemedText>
            </View>
            <ThemedText style={styles.value}>
                {recipe?.profitMarginPercent != null ? `${recipe.profitMarginPercent}%` : '-'}
            </ThemedText>
          </View>

          <View style={styles.sectionSpacing} />

          <Pressable
            style={[
              styles.saveButton,
              (isLoading || isSaved) && styles.saveButtonDisabled,
            ]}
            onPress={handleSaveRecipe}
            disabled={isLoading || isSaved}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialIcons name="save" size={18} color="#FFFFFF" />
                <ThemedText style={styles.saveButtonText}>
                  {isSaved ? 'Saved' : 'Save Recipe'}
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
      {toastMessage ? (
        <View style={styles.toastContainer}>
          <View style={styles.toastCard}>
            <ThemedText style={styles.toastText}>{toastMessage}</ThemedText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
    backgroundColor: '#F6F1EA',
  },
  hero: {
    height: 210,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(33, 19, 10, 0.55)',
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    zIndex: 2,
  },
  heroContent: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    flex: 1,
    marginRight: 20,
  },
  card: {
    marginTop: -36,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 4,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#F5D7B3',
    marginBottom: 12,
  },
  alertText: {
    fontSize: 12,
    color: '#7A5234',
    flex: 1,
  },
  resultBanner: {
    width: '100%',
    height: 140,
    borderRadius: 18,
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleStack: {
    flex: 1,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  recipeTitle: {
    fontSize: 20,
    fontFamily: Fonts.rounded,
    color: '#1F2937',
  },
  recipeSubtitle: {
    fontSize: 12,
    color: '#7C7C7C',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.rounded,
    color: '#1F2937',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sectionSpacing: {
    height: 12,
  },
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  factCard: {
    width: '48%',
    backgroundColor: '#FAF6F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F0E5D8',
  },
  factLabel: {
    fontSize: 11,
    color: '#9C8A7A',
    marginBottom: 4,
  },
  factValue: {
    fontSize: 12,
    color: '#1F2937',
    fontFamily: Fonts.rounded,
  },
  bodyText: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
  },
  stepsList: {
    gap: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  stepBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8B5E3C',
    marginTop: 6,
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EDE5',
    gap: 10,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: '#7C7C7C',
  },
  value: {
    fontSize: 12,
    color: '#1F2937',
    textAlign: 'right',
    flex: 1,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  pillText: {
    fontSize: 11,
    color: '#1F2937',
  },
  ingredientsList: {
    gap: 10,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FAF6F0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0E5D8',
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  ingredientDetail: {
    fontSize: 11,
    color: '#7C7C7C',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#8B5E3C',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontFamily: Fonts.rounded,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 26,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toastCard: {
    backgroundColor: '#2D2116',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  toastText: {
    color: '#FFF',
    fontSize: 12,
  },
});
