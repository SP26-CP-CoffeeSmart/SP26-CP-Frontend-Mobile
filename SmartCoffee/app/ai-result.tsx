import React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
  brewingVariablesData: string | Record<string, any>;
  presentationData: string;
  isHot: boolean;
  isCold: boolean;
  hasIce: boolean;
  caffeineStrength: number;
  proposedSellingPrice: number;
  profitMarginPercent: number;
  status: string;
  [key: string]: any;
}

export default function AiResultScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { data } = useLocalSearchParams<{ data?: string }>();
  const fallbackImage =
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=1200&auto=format&fit=crop';

  const toBool = (value: unknown) => value === true || value === 'true' || value === 1;

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

  let recipe: Recipe | null = null;
  if (data) {
    try {
      const parsed = JSON.parse(String(data));
      console.log('AI Recipe Result raw payload:', parsed);
      recipe = parsed?.recipe ?? parsed;
    } catch {
      recipe = null;
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image
            source={{
              uri: normalizeImageUrl(recipe?.image),
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
              uri: normalizeImageUrl(recipe?.image),
            }}
            style={styles.resultBanner}
          />
          <View style={styles.titleRow}>
            <Image
              source={{
                uri: normalizeImageUrl(recipe?.image),
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

          <View style={styles.sectionHeader}>
            <MaterialIcons name="info-outline" size={16} color="#8B5E3C" />
            <ThemedText style={styles.sectionTitle}>Quick Facts</ThemedText>
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
            {formatBrewingVariables(recipe?.brewingVariablesData)}
          </ThemedText>

          <View style={styles.sectionSpacing} />

          <View style={styles.sectionHeader}>
            <MaterialIcons name="style" size={16} color="#8B5E3C" />
            <ThemedText style={styles.sectionTitle}>Presentation</ThemedText>
          </View>
          <ThemedText style={styles.bodyText}>{recipe?.presentationData || '-'}</ThemedText>

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
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="bolt" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Caffeine Strength</ThemedText>
            </View>
            <ThemedText style={styles.value}>
              {recipe?.caffeineStrength || '-'}
            </ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="payments" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Proposed Price</ThemedText>
            </View>
            <ThemedText style={styles.value}>
              {recipe?.proposedSellingPrice || '-'}
            </ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <MaterialIcons name="trending-up" size={16} color="#8B5E3C" />
              <ThemedText style={styles.label}>Profit Margin</ThemedText>
            </View>
            <ThemedText style={styles.value}>
              {recipe?.profitMarginPercent ? `${recipe.profitMarginPercent}%` : '-'}
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
});
