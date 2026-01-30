import React, { useMemo } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AiResultScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { data } = useLocalSearchParams<{ data?: string }>();
  const fallbackImage =
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=1200&auto=format&fit=crop';

  const pick = (...values: Array<unknown>) =>
    values.find((value) => value !== undefined && value !== null && value !== '') ?? null;

  const toText = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '';
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' || typeof item === 'number' ? item : ''))
        .filter(Boolean)
        .join(' · ');
    }
    if (typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
        .map(([key, val]) => `${key}: ${toText(val)}`)
        .filter((item) => item.endsWith(': ') === false)
        .join(' · ');
    }
    return String(value);
  };

  const toBool = (value: unknown) => value === true || value === 'true' || value === 1;
  const toNumber = (value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const recipe = useMemo(() => {
    if (!data) return null;
    try {
      const parsed = JSON.parse(String(data));
      console.log('AI Recipe Result raw payload:', parsed);
      const raw = parsed?.data ?? parsed?.result ?? parsed;
      const content = raw?.recipe ?? raw?.aiRecipe ?? raw?.recipeResult ?? raw;

      return {
        image: pick(
          content?.image,
          content?.imageUrl,
          content?.imageURL,
          raw?.image,
          raw?.imageUrl,
          raw?.imageURL
        ),
        recipeName: pick(
          content?.recipeName,
          content?.name,
          content?.title,
          content?.beverageName,
          raw?.recipeName,
          raw?.name,
          raw?.title,
          raw?.beverageName
        ),
        createdSource: pick(
          content?.createdSource,
          content?.source,
          content?.creator,
          raw?.createdSource,
          raw?.source,
          raw?.creator
        ),
        category: pick(
          content?.category,
          content?.categoryName,
          content?.presentation?.selectedCategoryId,
          raw?.category,
          raw?.categoryName
        ),
        flavorStylePrimary: pick(
          content?.flavorStylePrimary,
          content?.flavorStyle,
          content?.flavorStyle?.primary,
          content?.basicInfo?.selectedFlavorStyleId,
          raw?.flavorStylePrimary,
          raw?.flavorStyle
        ),
        flavorStyleSecondary: pick(
          content?.flavorStyleSecondary,
          content?.flavorStyle?.secondary,
          raw?.flavorStyleSecondary
        ),
        brewingMethod: pick(
          content?.brewingMethod,
          content?.brewing?.selectedMethodId,
          raw?.brewingMethod
        ),
        difficultyLevel: pick(
          content?.difficultyLevel,
          content?.brewing?.selectedDifficultyId,
          raw?.difficultyLevel
        ),
        prepTimeRange: pick(
          content?.prepTimeRange,
          content?.prepTime,
          raw?.prepTimeRange
        ),
        flavorNote: pick(content?.flavorNote, content?.notes, raw?.flavorNote),
        brewingSteps: pick(
          content?.brewingSteps,
          content?.steps,
          content?.instructions,
          raw?.brewingSteps
        ),
        brewingVariablesData: pick(
          content?.brewingVariablesData,
          content?.brewingVariables,
          content?.variables,
          raw?.brewingVariablesData
        ),
        presentationData: pick(
          content?.presentationData,
          content?.presentation,
          raw?.presentationData
        ),
        isHot: pick(content?.isHot, content?.hot, raw?.isHot),
        isCold: pick(content?.isCold, content?.cold, raw?.isCold),
        hasIce: pick(content?.hasIce, content?.ice, raw?.hasIce),
        caffeineStrength: pick(
          content?.caffeineStrength,
          content?.caffeine,
          raw?.caffeineStrength
        ),
        proposedSellingPrice: pick(
          content?.proposedSellingPrice,
          content?.price,
          content?.pricing?.proposedSellingPrice,
          content?.pricing?.price,
          raw?.proposedSellingPrice
        ),
        profitMarginPercent: pick(
          content?.profitMarginPercent,
          content?.margin,
          content?.pricing?.marginPercent,
          raw?.profitMarginPercent
        ),
        status: pick(content?.status, raw?.status, parsed?.status),
      };
    } catch {
      return null;
    }
  }, [data]);

  const display = useMemo(() => {
    if (!recipe) return null;
    return {
      ...recipe,
      image: toText(recipe.image),
      recipeName: toText(recipe.recipeName),
      createdSource: toText(recipe.createdSource),
      category: toText(recipe.category),
      flavorStylePrimary: toText(recipe.flavorStylePrimary),
      flavorStyleSecondary: toText(recipe.flavorStyleSecondary),
      brewingMethod: toText(recipe.brewingMethod),
      difficultyLevel: toText(recipe.difficultyLevel),
      prepTimeRange: toText(recipe.prepTimeRange),
      flavorNote: toText(recipe.flavorNote),
      brewingSteps: toText(recipe.brewingSteps),
      brewingVariablesData: toText(recipe.brewingVariablesData),
      presentationData: toText(recipe.presentationData),
      caffeineStrength: toNumber(recipe.caffeineStrength),
      proposedSellingPrice: toNumber(recipe.proposedSellingPrice),
      profitMarginPercent: toNumber(recipe.profitMarginPercent),
      isHot: recipe.isHot,
      isCold: recipe.isCold,
      hasIce: recipe.hasIce,
      status: toText(recipe.status),
    };
  }, [recipe]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image
            source={{
              uri: display?.image || fallbackImage,
            }}
            style={styles.heroImage}
          />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back-ios-new" size={20} color="#FFFFFF" />
            </Pressable>
            <ThemedText style={styles.heroTitle}>AI Recipe Result</ThemedText>
          </View>
        </View>

        <View style={styles.card}>
          {display?.status === 'Error' ? (
            <View style={styles.alertBox}>
              <MaterialIcons name="error-outline" size={18} color="#B45309" />
              <ThemedText style={styles.alertText}>
                Backend returned status Error. Please try again or check API response.
              </ThemedText>
            </View>
          ) : null}
          <Image
            source={{
              uri: display?.image || fallbackImage,
            }}
            style={styles.resultBanner}
          />
          <View style={styles.titleRow}>
            <Image
              source={{
                uri: display?.image || fallbackImage,
              }}
              style={styles.thumbnail}
            />
            <View style={styles.titleStack}>
              <ThemedText style={styles.recipeTitle}>
                {display?.recipeName || 'Recipe Result'}
              </ThemedText>
              <ThemedText style={styles.recipeSubtitle}>
                {display?.createdSource || 'AI Recommendation'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.sectionSpacing} />

          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="category" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Category</ThemedText>
            </View>
            <ThemedText style={styles.value}>{display?.category || '-'}</ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="emoji-food-beverage" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Flavor Style</ThemedText>
            </View>
            <ThemedText style={styles.value}>
              {display?.flavorStylePrimary || '-'}
              {display?.flavorStyleSecondary ? ` · ${display.flavorStyleSecondary}` : ''}
            </ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="coffee-maker" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Brewing Method</ThemedText>
            </View>
            <ThemedText style={styles.value}>{display?.brewingMethod || '-'}</ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="speed" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Difficulty</ThemedText>
            </View>
            <ThemedText style={styles.value}>{display?.difficultyLevel || '-'}</ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="schedule" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Prep Time</ThemedText>
            </View>
            <ThemedText style={styles.value}>{display?.prepTimeRange || '-'}</ThemedText>
          </View>

          <View style={styles.sectionSpacing} />

          <View style={styles.sectionHeader}>
            <MaterialIcons name="auto-awesome" size={16} color="#8B5E3C" />
            <ThemedText style={styles.sectionTitle}>Flavor Note</ThemedText>
          </View>
          <ThemedText style={styles.bodyText}>{display?.flavorNote || '-'}</ThemedText>

          <View style={styles.sectionSpacing} />

          <View style={styles.sectionHeader}>
            <MaterialIcons name="format-list-bulleted" size={16} color="#8B5E3C" />
            <ThemedText style={styles.sectionTitle}>Brewing Steps</ThemedText>
          </View>
          <ThemedText style={styles.bodyText}>{display?.brewingSteps || '-'}</ThemedText>

          <View style={styles.sectionSpacing} />

          <View style={styles.sectionHeader}>
            <MaterialIcons name="tune" size={16} color="#8B5E3C" />
            <ThemedText style={styles.sectionTitle}>Brewing Variables</ThemedText>
          </View>
          <ThemedText style={styles.bodyText}>{display?.brewingVariablesData || '-'}</ThemedText>

          <View style={styles.sectionSpacing} />

          <View style={styles.sectionHeader}>
            <MaterialIcons name="style" size={16} color="#8B5E3C" />
            <ThemedText style={styles.sectionTitle}>Presentation</ThemedText>
          </View>
          <ThemedText style={styles.bodyText}>{display?.presentationData || '-'}</ThemedText>

          <View style={styles.sectionSpacing} />

          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <MaterialIcons name="whatshot" size={14} color="#B45309" />
              <ThemedText style={styles.pillText}>
                {display?.isHot === null || display?.isHot === undefined
                  ? 'Unknown'
                  : toBool(display?.isHot)
                    ? 'Hot'
                    : 'Not Hot'}
              </ThemedText>
            </View>
            <View style={styles.pill}>
              <MaterialIcons name="ac-unit" size={14} color="#2563EB" />
              <ThemedText style={styles.pillText}>
                {display?.isCold === null || display?.isCold === undefined
                  ? 'Unknown'
                  : toBool(display?.isCold)
                    ? 'Cold'
                    : 'Not Cold'}
              </ThemedText>
            </View>
            <View style={styles.pill}>
              <MaterialIcons name="icecream" size={14} color="#0EA5E9" />
              <ThemedText style={styles.pillText}>
                {display?.hasIce === null || display?.hasIce === undefined
                  ? 'Unknown'
                  : toBool(display?.hasIce)
                    ? 'Has Ice'
                    : 'No Ice'}
              </ThemedText>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="bolt" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Caffeine Strength</ThemedText>
            </View>
            <ThemedText style={styles.value}>
              {typeof display?.caffeineStrength === 'number' ? display.caffeineStrength : '-'}
            </ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="payments" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Proposed Price</ThemedText>
            </View>
            <ThemedText style={styles.value}>
              {typeof display?.proposedSellingPrice === 'number'
                ? display.proposedSellingPrice.toFixed(2)
                : '-'}
            </ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="trending-up" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Profit Margin</ThemedText>
            </View>
            <ThemedText style={styles.value}>
              {typeof display?.profitMarginPercent === 'number'
                ? `${display.profitMarginPercent}%`
                : '-'}
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
    backgroundColor: '#F9F5F2',
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
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
  bodyText: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
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
});
