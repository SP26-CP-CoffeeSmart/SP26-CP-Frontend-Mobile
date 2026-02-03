import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from 'axios';

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
  const [ingredients, setIngredients] = useState<ShopRecipeIngredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<ShopRecipeIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (searchQuery.trim() === '') {
      setFilteredIngredients(ingredients);
    } else {
      const filtered = ingredients.filter((item) =>
        item.ingredient.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredIngredients(filtered);
    }
  }, [searchQuery, ingredients]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchIngredients();
  };

  const getStatusColor = (cost: number) => {
    if (cost > 50000) return 'bg-red-500';
    if (cost > 20000) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = (cost: number) => {
    if (cost > 50000) return 'High';
    if (cost > 20000) return 'Medium';
    return 'Low';
  };

  const renderItem = ({ item }: { item: ShopRecipeIngredient }) => (
    <View
      className={`mx-4 mb-3 p-4 rounded-2xl border ${
        isDark ? 'bg-surface-dark border-gray-700' : 'bg-white border-gray-200'
      }`}>
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className={`text-lg font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>
            {item.ingredient.name}
          </Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {item.ingredient.category}
          </Text>
        </View>
        <View className={`px-3 py-1 rounded-full ${getStatusColor(item.cost)}`}>
          <Text className="text-white text-xs font-semibold">{getStatusText(item.cost)}</Text>
        </View>
      </View>

      <View className="flex-row justify-between items-center mt-2">
        <View>
          <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Quantity</Text>
          <Text className={`text-base font-semibold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>
            {item.quantity} kg
          </Text>
        </View>
        <View>
          <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Cost</Text>
          <Text className="text-base font-semibold text-primary">
            {item.cost.toLocaleString()} VNĐ
          </Text>
        </View>
      </View>
    </View>
  );

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
    <View className={`flex-1 ${isDark ? 'bg-background-dark' : 'bg-background-light'}`}>
      {/* Header */}
      <View className={`mt-8 px-6 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-3xl font-bold italic text-primary">Inventory</Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {filteredIngredients.length} items
          </Text>
        </View>

        {/* Search */}
        <View
          className={`flex-row items-center px-4 py-3 rounded-2xl border ${
            isDark ? 'bg-surface-dark border-gray-700' : 'bg-white border-gray-200'
          }`}>
          <Text className="text-xl mr-2">🔍</Text>
          <TextInput
            className={`flex-1 text-base ${isDark ? 'text-text-dark' : 'text-text-light'}`}
            placeholder="Search ingredients..."
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text className="text-gray-400 text-lg">✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      {filteredIngredients.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            No ingredients found
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredIngredients}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
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
    </View>
  );
}
