import React, { useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

interface CoffeeCard {
  id: string;
  name: string;
  image: string;
  flavor: string;
  time: string;
  difficulty: string;
  level: string;
  raw: Record<string, unknown>;
}

export default function AIRecommendationsScreen() {
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

  const recipes = useMemo(() => {
    if (!data) return [] as CoffeeCard[];
    try {
      const parsed = JSON.parse(String(data));
      const raw = parsed?.data ?? parsed?.result ?? parsed;
      const list =
        (Array.isArray(raw) && raw) ||
        (Array.isArray(raw?.recipes) && raw.recipes) ||
        (Array.isArray(raw?.items) && raw.items) ||
        (Array.isArray(raw?.data) && raw.data) ||
        [];

      return list.slice(0, 3).map((item: Record<string, unknown>, index: number) => {
        const image =
          toText(
            pick(
              item?.image,
              item?.imageUrl,
              item?.imageURL,
              item?.thumbnail,
              item?.thumbnailUrl
            )
          ) || fallbackImage;
        return {
          id: String(item?.id ?? item?.recipeId ?? item?.menuId ?? index + 1),
          name: toText(
            pick(item?.recipeName, item?.name, item?.title, item?.beverageName)
          ) || 'AI Recipe',
          image,
          flavor: toText(pick(item?.flavorNote, item?.flavor, item?.taste, item?.notes)) || '-',
          time: toText(pick(item?.prepTimeRange, item?.prepTime, item?.time)) || '-',
          difficulty:
            toText(pick(item?.difficultyLevel, item?.brewing?.selectedDifficultyId)) || '-',
          level: toText(pick(item?.brewing?.selectedHeatLevelId, item?.level)) || '-',
          raw: item,
        } as CoffeeCard;
      });
    } catch {
      return [] as CoffeeCard[];
    }
  }, [data]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Recommendations</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Results</Text>

        <View style={styles.grid}>
          {recipes.map((coffee) => (
            <View key={coffee.id} style={styles.card}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/ai-result',
                    params: { data: JSON.stringify({ data: coffee.raw }) },
                  })
                }
              >
                <Image source={{ uri: coffee.image }} style={styles.cardImage} />
              </Pressable>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{coffee.name}</Text>
                <View style={styles.cardInfo}>
                  <View style={styles.infoRow}>
                    <Ionicons name="cafe-outline" size={14} color="#8B7355" />
                    <Text style={styles.infoText}>{coffee.flavor}</Text>
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color="#8B7355"
                      style={{ marginLeft: 8 }}
                    />
                    <Text style={styles.infoText}>{coffee.time}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="flame-outline" size={14} color="#D97706" />
                    <Text style={styles.difficultyText}>{coffee.difficulty}</Text>
                    <Ionicons
                      name="flash-outline"
                      size={14}
                      color="#D97706"
                      style={{ marginLeft: 8 }}
                    />
                    <Text style={styles.levelText}>{coffee.level}</Text>
                  </View>
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
  manualButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
