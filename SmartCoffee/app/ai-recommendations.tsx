import React, { useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_RECIPES_KEY = 'savedAiRecipes';

export default function AIRecommendationsScreen() {
  const router = useRouter();
  const { data, beverageId, beverage } = useLocalSearchParams<{
    data?: string;
    beverageId?: string;
    beverage?: string;
  }>();
  const fallbackImage =
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=1200&auto=format&fit=crop';

  useEffect(() => {
    return () => {
      AsyncStorage.removeItem(SAVED_RECIPES_KEY).catch(() => undefined);
    };
  }, []);

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

  const formatPercent = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `${Math.round(value * 100)}%`;
    }
    return '-';
  };

  let recipes: any[] = [];
  let beverageName = 'AI Recommendations';
  if (data) {
    try {
      const parsed = JSON.parse(String(data));
      recipes = parsed?.recipes ?? [];
      // Get beverage name from first recipe
      if (recipes.length > 0 && recipes[0]?.recipe?.beverage?.name) {
        beverageName = `Recipes of ${recipes[0].recipe.beverage.name}`;
      }
    } catch {
      recipes = [];
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Recipes of </Text>
          <Text style={styles.beverageNameTitle}>{beverageName.replace('Recipes of ', '')}</Text>
        </View>
        <View style={styles.headerActionSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Results</Text>

        <View style={styles.grid}>
          {recipes.slice(0, 3).map((item, index) => (
            <View key={item?.recipe?.recipeId ?? index} style={styles.card}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/ai-result',
                    params: {
                      data: JSON.stringify({
                        recipe: item.recipe,
                        imageGeneration: item.imageGeneration,
                        uniqueness: item.uniqueness,
                      }),
                      beverageId,
                      beverage,
                    },
                  })
                }
              >
                <Image source={{ uri: normalizeImageUrl(item?.recipe?.image) }} style={styles.cardImage} />
              </Pressable>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item?.recipe?.recipeName || 'AI Recipe'}</Text>
                <View style={styles.cardInfo}>
                  <View style={styles.infoRow}>
                    <Ionicons name="cafe-outline" size={14} color="#8B7355" />
                    <Text style={styles.infoText}>{item?.recipe?.flavorNote || '-'}</Text>
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color="#8B7355"
                      style={{ marginLeft: 8 }}
                    />
                    <Text style={styles.infoText}>{item?.recipe?.prepTimeRange || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="flame-outline" size={14} color="#D97706" />
                    <Text style={styles.difficultyText}>{item?.recipe?.difficultyLevel || '-'}</Text>
                  </View>
                  {item?.uniqueness ? (
                    <View style={styles.uniquenessRow}>
                      <Ionicons name="sparkles-outline" size={14} color="#16A34A" />
                      <Text style={styles.uniquenessText}>
                        {item.uniqueness?.isUnique ? 'Unique' : 'Not unique'} · Score{' '}
                        {formatPercent(item.uniqueness?.uniquenessScore)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.suggestionBox}>
          <View style={styles.suggestionHeader}>
            <Ionicons name="bulb-outline" size={20} color="#000" />
            <Text style={styles.suggestionTitle}>Suggestion:</Text>
          </View>
          <Text style={styles.suggestionText}>Not the recipe you are looking for ?</Text>
          <TouchableOpacity style={styles.manualButton} onPress={() => router.push('/ai-create')}>
            <Text style={styles.manualButtonText}>Create Manually Now</Text>
            <Ionicons name="chevron-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.manualButton, styles.goBackButton]}
          onPress={() => router.replace('/(tabs)/menu')}>
          <Text style={styles.manualButtonText}>Go back</Text>
          <Ionicons name="chevron-forward" size={18} color="#FFF" />
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3E8DD',
  },
  headerActionText: {
    fontSize: 12,
    color: '#8B5E3C',
    fontWeight: '600',
  },
  headerActionSpacer: {
    width: 48,
  },
  beverageNameTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8B5E3C',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 20,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#FFF8E7',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#D9D9D9',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  cardInfo: {
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 11,
    color: '#8B7355',
  },
  difficultyText: {
    fontSize: 11,
    color: '#D97706',
  },
  uniquenessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  uniquenessText: {
    fontSize: 11,
    color: '#15803D',
  },
  levelText: {
    fontSize: 11,
    color: '#D97706',
  },
  suggestionBox: {
    backgroundColor: '#FFF8E7',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  suggestionText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  manualButton: {
    backgroundColor: '#6B4423',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  goBackButton: {
    marginBottom: 24,
  },
  manualButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
