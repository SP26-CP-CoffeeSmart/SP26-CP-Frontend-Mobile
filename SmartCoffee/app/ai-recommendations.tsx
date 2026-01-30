import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

interface CoffeeCard {
  id: string;
  name: string;
  image: any;
  flavor: string;
  time: string;
  difficulty: string;
  level: string;
}

export default function AIRecommendationsScreen() {
  const router = useRouter();
  const { data } = useLocalSearchParams<{ data?: string }>();

  const coffeeRecommendations: CoffeeCard[] = [
    {
      id: '1',
      name: 'Cold Brew',
      image: require('@/assets/images/partial-react-logo.png'),
      flavor: 'Bitter',
      time: '5 min',
      difficulty: 'Easy',
      level: 'High',
    },
    {
      id: '2',
      name: 'Lemon Espresso',
      image: require('@/assets/images/partial-react-logo.png'),
      flavor: 'Bitter',
      time: '10 min',
      difficulty: 'Med',
      level: 'Med',
    },
    {
      id: '3',
      name: 'Blended Coffee',
      image: require('@/assets/images/partial-react-logo.png'),
      flavor: 'Sweet',
      time: '5 min',
      difficulty: 'Med',
      level: 'Med',
    },
    {
      id: '4',
      name: 'Matcha Espresso',
      image: require('@/assets/images/partial-react-logo.png'),
      flavor: 'Bitter',
      time: '15 min',
      difficulty: 'High',
      level: 'Low',
    },
  ];

  const buildPayload = (coffee: CoffeeCard) => {
    if (data) return data;
    return JSON.stringify({
      data: {
        recipeName: coffee.name,
        flavorNote: coffee.flavor,
        prepTimeRange: coffee.time,
        difficultyLevel: coffee.difficulty,
        createdSource: 'AI Recommendation',
      },
    });
  };

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
          {coffeeRecommendations.map((coffee) => (
            <View key={coffee.id} style={styles.card}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/ai-result',
                    params: { data: buildPayload(coffee) },
                  })
                }
              >
                <Image source={coffee.image} style={styles.cardImage} />
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
