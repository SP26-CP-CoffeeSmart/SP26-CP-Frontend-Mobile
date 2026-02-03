import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

interface Ingredient {
  ingredientId: number;
  name: string;
  image: string;
  category: string;
  createDate: string;
  endDate: string;
}

interface ShopRecipeIngredient {
  id: number;
  quantity: number;
  cost: number;
  ingredient: Ingredient;
}

const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:5080`;
  }

  return Platform.select({
    android: 'http://10.0.2.2:5080',
    ios: 'http://localhost:5080',
    default: 'http://localhost:5080',
  });
};

export default function InventoryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [ingredients, setIngredients] = useState<ShopRecipeIngredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<ShopRecipeIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = ['All', 'Coffee Beans', 'Dairy', 'Syrups', 'Supplies'];

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = getApiBaseUrl();
      const response = await axios.get(`${baseUrl}/api/ShopRecipeIngredients`);
      
      if (Array.isArray(response.data)) {
        setIngredients(response.data);
        setFilteredIngredients(response.data);
      }
    } catch (err) {
      console.error('Error fetching ingredients:', err);
      setError('Failed to load ingredients. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
  }, []);

  useEffect(() => {
    let filtered = ingredients;

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter((item) =>
        item.ingredient.category.toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }

    // Filter by search query
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter((item) =>
        item.ingredient.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredIngredients(filtered);
  }, [searchQuery, selectedCategory, ingredients]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchIngredients();
  };

  const getStockStatus = (quantity: number) => {
    const maxQuantity = 500;
    const percentage = (quantity / maxQuantity) * 100;

    if (percentage >= 80) {
      return { 
        label: 'GOOD', 
        color: '#10B981',
        bgColor: '#ECFDF5',
        barColor: '#10B981'
      };
    } else if (percentage >= 60) {
      return { 
        label: 'IN STOCK', 
        color: '#14B8A6',
        bgColor: '#F0FDFA',
        barColor: '#14B8A6'
      };
    } else if (percentage >= 30) {
      return { 
        label: 'LOW STOCK', 
        color: '#F59E0B',
        bgColor: '#FEF3C7',
        barColor: '#F59E0B'
      };
    } else {
      return { 
        label: 'CRITICAL', 
        color: '#EF4444',
        bgColor: '#FEE2E2',
        barColor: '#EF4444'
      };
    }
  };

  const getStockPercentage = (quantity: number) => {
    const maxQuantity = 500;
    return Math.min((quantity / maxQuantity) * 100, 100);
  };

  const renderItem = ({ item }: { item: ShopRecipeIngredient }) => {
    const status = getStockStatus(item.quantity);
    const percentage = getStockPercentage(item.quantity);

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' }
        ]}>
        <View style={styles.cardContent}>
          {/* Image */}
          <View style={styles.imageContainer}>
            {item.ingredient.image ? (
              <Image
                source={{ uri: item.ingredient.image }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: '#D1D5DB' }]}>
                <Ionicons name="cafe" size={32} color="#9CA3AF" />
              </View>
            )}
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            {/* Title and Badge */}
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.itemTitle,
                  { color: isDark ? '#E0E0E0' : '#111827' }
                ]}
                numberOfLines={1}>
                {item.ingredient.name}
              </Text>
              {item.cost > 50000 && (
                <View style={[styles.premiumBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.premiumText, { color: '#B45309' }]}>Premium</Text>
                </View>
              )}
            </View>

            {/* Subtitle */}
            <Text style={[styles.category, { color: '#6B7280' }]}>{item.ingredient.category}</Text>

            {/* Quantity and Status */}
            <View style={styles.quantityRow}>
              <Text style={[styles.quantityText, { color: isDark ? '#E0E0E0' : '#374151' }]}>
                {item.quantity} / 500 UNITS
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressRow}>
              <View style={[styles.progressBarBg, { backgroundColor: '#E5E7EB' }]}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${percentage}%`, backgroundColor: status.barColor }
                  ]}
                />
              </View>
              <Text style={[styles.percentageText, { color: '#4B5563' }]}>{Math.round(percentage)}%</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View className={`flex-1 items-center justify-center ${isDark ? 'bg-background-dark' : 'bg-background-light'}`}>
        <ActivityIndicator size="large" color="#D9A05B" />
      </View>
    );
  }

  if (error) {
    return (
      <View className={`flex-1 items-center justify-center px-6 ${isDark ? 'bg-background-dark' : 'bg-background-light'}`}>
        <Text className={`text-center mb-4 ${isDark ? 'text-text-dark' : 'text-text-light'}`}>
          {error}
        </Text>
        <TouchableOpacity
          className="bg-primary px-6 py-3 rounded-full"
          onPress={fetchIngredients}>
          <Text className="text-white font-semibold">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#121212' : '#FAFAFA' }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? '#121212' : '#FFFFFF' }]}>
        {/* Title and Notification */}
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.managementLabel, { color: '#6B7280' }]}>
              MANAGEMENT
            </Text>
            <Text style={[styles.headerTitle, { color: isDark ? '#E0E0E0' : '#111827' }]}>
              Inventory
            </Text>
          </View>
          <TouchableOpacity style={[styles.notificationButton, { backgroundColor: '#FFEDD5' }]}>
            <Ionicons name="notifications-outline" size={22} color="#F97316" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View
          style={[
            styles.searchBar,
            { 
              backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
              borderColor: isDark ? '#374151' : '#F0F0F0'
            }
          ]}>
          <Ionicons name="search-outline" size={20} color="#9CA3AF" />
          <TextInput
            style={[styles.searchInput, { color: isDark ? '#E0E0E0' : '#111827' }]}
            placeholder="Search stock items..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity>
            <Ionicons name="options-outline" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={{ paddingRight: 16 }}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              onPress={() => setSelectedCategory(category)}
              style={[
                styles.categoryTab,
                {
                  backgroundColor: selectedCategory === category
                    ? '#3E2723'
                    : isDark
                    ? '#1F2937'
                    : '#F5F5F5'
                }
              ]}>
              <Text
                style={[
                  styles.categoryText,
                  {
                    color: selectedCategory === category
                      ? '#FFFFFF'
                      : isDark
                      ? '#9CA3AF'
                      : '#4B5563'
                  }
                ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {filteredIngredients.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={{ color: isDark ? '#9CA3AF' : '#4B5563', textAlign: 'center' }}>
            No ingredients found
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredIngredients}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#D9A05B']}
              tintColor="#D9A05B"
            />
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: '#3E2723' }]}>
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
  },
  imageContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  premiumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  premiumText: {
    fontSize: 11,
    fontWeight: '600',
  },
  category: {
    fontSize: 12,
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressBar: {
    height: '100%',
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  managementLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  categoryScroll: {
    marginTop: 16,
  },
  categoryTab: {
    marginRight: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
