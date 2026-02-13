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
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

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
  measurement?: string | null;
  ingredient_id?: number;
  ingredient?: Ingredient;
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
  const router = useRouter();

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
      
      // Try with includeIngredient parameter
      const url = `${baseUrl}/api/ShopRecipeIngredients?includeIngredient=true`;
      console.log('Fetching ingredients from:', url);
      const response = await axios.get(url);
      
      console.log('API Response sample:', response.data[0]); // Log first item to see structure
      
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
        (item.ingredient?.category || 'Unknown Category').toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }

    // Filter by search query
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter((item) =>
        (item.ingredient?.name || `Ingredient #${item.id}`).toLowerCase().includes(searchQuery.toLowerCase())
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
      return { label: 'GOOD', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-50', barClass: 'bg-emerald-500' };
    } else if (percentage >= 60) {
      return { label: 'IN STOCK', colorClass: 'text-teal-500', bgClass: 'bg-teal-50', barClass: 'bg-teal-500' };
    } else if (percentage >= 30) {
      return { label: 'LOW STOCK', colorClass: 'text-amber-500', bgClass: 'bg-amber-50', barClass: 'bg-amber-500' };
    } else {
      return { label: 'CRITICAL', colorClass: 'text-red-500', bgClass: 'bg-red-50', barClass: 'bg-red-500' };
    }
  };

  const getStockPercentage = (quantity: number) => {
    const maxQuantity = 500;
    return Math.min((quantity / maxQuantity) * 100, 100);
  };

  const renderItem = ({ item }: { item: ShopRecipeIngredient }) => {
    const status = getStockStatus(item.quantity);
    const percentage = getStockPercentage(item.quantity);
    
    // Extract ingredient info (use ingredient object if exists, otherwise show item ID)
    const ingredientName = item.ingredient?.name || `Ingredient #${item.id}`;
    const ingredientImage = item.ingredient?.image || null;
    const ingredientCategory = item.ingredient?.category || 'Unknown Category';

    return (
      <TouchableOpacity
        onPress={() => router.push(`/ingredient-detail/${item.id}`)}
        className={`mx-4 mb-3 rounded-2xl overflow-hidden shadow-md ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}>
        <View className="flex-row p-4">
          {/* Image */}
          <View className="w-16 h-16 rounded-xl mr-4 overflow-hidden">
            {ingredientImage ? (
              <Image
                source={{ uri: ingredientImage }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full bg-gray-300 items-center justify-center">
                <Ionicons name="cafe" size={32} color="#9CA3AF" />
              </View>
            )}
          </View>

          {/* Content */}
          <View className="flex-1">
            {/* Title and Badge */}
            <View className="flex-row items-center mb-1">
              <Text
                className={`flex-1 text-base font-semibold ${
                  isDark ? 'text-gray-200' : 'text-gray-900'
                }`}
                numberOfLines={1}>
                {ingredientName}
              </Text>
              {item.cost > 50000 && (
                <View className="bg-amber-50 px-2 py-0.5 rounded ml-2">
                  <Text className="text-amber-700 text-xs font-semibold">Premium</Text>
                </View>
              )}
            </View>

            {/* Subtitle */}
            <Text className="text-gray-500 text-xs mb-2">{ingredientCategory}</Text>

            {/* Quantity and Status */}
            <View className="flex-row items-center justify-between mb-2">
              <Text className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                {item.quantity} / 500 UNITS
              </Text>
              <View className={`px-2 py-1 rounded ${status.bgClass}`}>
                <Text className={`text-xs font-bold ${status.colorClass}`}>{status.label}</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View className="flex-row items-center">
              <View className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden mr-2">
                <View
                  className={`h-full ${status.barClass}`}
                  style={{ width: `${percentage}%` }}
                />
              </View>
              <Text className="text-gray-600 text-xs font-semibold">{Math.round(percentage)}%</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View className={`flex-1 items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <ActivityIndicator size="large" color="#D9A05B" />
      </View>
    );
  }

  if (error) {
    return (
      <View className={`flex-1 items-center justify-center px-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Text className={`text-center mb-4 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
          {error}
        </Text>
        <TouchableOpacity
          className="bg-amber-600 px-6 py-3 rounded-full"
          onPress={fetchIngredients}>
          <Text className="text-white font-semibold">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <View className={`pt-12 px-4 pb-4 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
        {/* Title and Notification */}
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-gray-500 text-xs tracking-wider uppercase mb-1">
              MANAGEMENT
            </Text>
            <Text className={`text-2xl font-bold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              Inventory
            </Text>
          </View>
          <TouchableOpacity className="w-10 h-10 bg-orange-100 rounded-full items-center justify-center">
            <Ionicons name="notifications-outline" size={22} color="#F97316" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View
          className={`flex-row items-center px-4 py-3 rounded-xl border ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
          }`}>
          <Ionicons name="search-outline" size={20} color="#9CA3AF" />
          <TextInput
            className={`flex-1 ml-2 text-base ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
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
          className="mt-4"
          contentContainerStyle={{ paddingRight: 16 }}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              onPress={() => setSelectedCategory(category)}
              className={`mr-2 px-4 py-2 rounded-full ${
                selectedCategory === category
                  ? 'bg-stone-800'
                  : isDark
                  ? 'bg-gray-800'
                  : 'bg-gray-100'
              }`}>
              <Text
                className={`text-sm font-medium ${
                  selectedCategory === category
                    ? 'text-white'
                    : isDark
                    ? 'text-gray-400'
                    : 'text-gray-600'
                }`}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {filteredIngredients.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
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
      <TouchableOpacity className="absolute bottom-6 right-6 w-14 h-14 bg-stone-800 rounded-full items-center justify-center shadow-lg">
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}
