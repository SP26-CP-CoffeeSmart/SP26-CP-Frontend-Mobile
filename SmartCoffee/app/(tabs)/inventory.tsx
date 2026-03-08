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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

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

export default function InventoryScreen() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [ingredients, setIngredients] = useState<ShopRecipeIngredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<ShopRecipeIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = ['All', 'Coffee Beans', 'Milk', 'Syrup', 'Supplies'];
  const maxQuantity = 500;
  const minStock = 100;

  const COLORS = {
    background: '#F7F2EE',
    card: '#FFFFFF',
    ink: '#1E1B16',
    muted: '#7A6F67',
    accent: '#E07A2D',
    chip: '#F2E7DA',
    chipActive: '#2B1C15',
    border: '#EFE4D8',
    surface: '#FBF7F2',
  };

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await authorizedFetch(`${AUTH_BASE_URL}/ShopRecipeIngredients`);
      const data = await response.json();

      if (Array.isArray(data)) {
        setIngredients(data);
        setFilteredIngredients(data);
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
    const percentage = (quantity / maxQuantity) * 100;

    if (percentage >= 80) {
      return {
        label: 'SUFFICIENT',
        color: '#15803D',
        bgColor: '#DCFCE7',
        barColor: '#22C55E',
      };
    } else if (percentage >= 60) {
      return {
        label: 'STABLE',
        color: '#0F766E',
        bgColor: '#CCFBF1',
        barColor: '#14B8A6',
      };
    } else if (percentage >= 30) {
      return {
        label: 'LOW STOCK',
        color: '#B45309',
        bgColor: '#FEF3C7',
        barColor: '#F59E0B',
      };
    } else {
      return {
        label: 'OUT OF STOCK',
        color: '#B91C1C',
        bgColor: '#FEE2E2',
        barColor: '#EF4444',
      };
    }
  };

  const getStockPercentage = (quantity: number) => {
    return Math.min((quantity / maxQuantity) * 100, 100);
  };

  const renderItem = ({ item }: { item: ShopRecipeIngredient }) => {
    const status = getStockStatus(item.quantity);
    const percentage = getStockPercentage(item.quantity);
    
    // Extract ingredient info (use ingredient object if exists, otherwise show item ID)
    const ingredientName = item.ingredient?.name || `Ingredient #${item.id}`;
    const ingredientImage = item.ingredient?.image;
    const ingredientCategory = item.ingredient?.category || 'Unknown Category';

    return (
      <TouchableOpacity
        onPress={() => router.push(`/ingredient-detail/${item.id}`)}
        style={{
          marginHorizontal: 16,
          marginBottom: 14,
          borderRadius: 20,
          backgroundColor: COLORS.card,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        }}>
        <View className="flex-row p-4">
          {/* Image */}
          <View className="w-16 h-16 rounded-2xl mr-4 overflow-hidden" style={{ backgroundColor: COLORS.surface }}>
            {ingredientImage ? (
              <Image
                source={{ uri: ingredientImage }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full items-center justify-center">
                <Ionicons name="cafe" size={28} color={COLORS.muted} />
              </View>
            )}
          </View>

          {/* Content */}
          <View className="flex-1">
            {/* Title and Badge */}
            <View className="flex-row items-center mb-1">
              <Text
                style={{ flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.ink }}
                numberOfLines={1}>
                {ingredientName}
              </Text>
              {item.cost > 50000 && (
                <View
                  style={{
                    backgroundColor: '#FFF1E0',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 999,
                    marginLeft: 8,
                  }}>
                  <Text style={{ color: '#9A5A1F', fontSize: 11, fontWeight: '700' }}>Premium</Text>
                </View>
              )}
            </View>

            {/* Subtitle */}
            <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 8 }}>
              {ingredientCategory}
            </Text>

            {/* Quantity and Status */}
            <View className="flex-row items-center justify-between mb-2">
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.ink }}>
                Current Stock
              </Text>
              <View
                style={{
                  backgroundColor: status.bgColor,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: status.color, letterSpacing: 0.3 }}>
                  {status.label}
                </Text>
              </View>
            </View>
            <View className="flex-row items-baseline justify-between mb-2">
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.ink }}>
                {item.quantity} Units
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.muted }}>
                Min: {minStock}
              </Text>
            </View>

            {/* Progress Bar */}
            <View className="flex-row items-center">
              <View
                style={{
                  flex: 1,
                  height: 6,
                  backgroundColor: COLORS.border,
                  borderRadius: 999,
                  overflow: 'hidden',
                  marginRight: 10,
                }}>
                <View
                  style={{
                    height: '100%',
                    width: `${percentage}%`,
                    backgroundColor: status.barColor,
                  }}
                />
              </View>
              <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: '700' }}>
                {Math.round(percentage)}%
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View className={`flex-1 items-center justify-center`} style={{ backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color="#D9A05B" />
      </View>
    );
  }

  if (error) {
    return (
      <View className={`flex-1 items-center justify-center px-6`} style={{ backgroundColor: COLORS.background }}>
        <Text className={`text-center mb-4`} style={{ color: COLORS.ink }}>
          {error}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: COLORS.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 }}
          onPress={fetchIngredients}>
          <Text className="text-white font-semibold">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.background }}>
      {filteredIngredients.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text style={{ color: COLORS.muted }}>No ingredients found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredIngredients}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListHeaderComponent={
            <View style={{ paddingTop: 40 }}>
              <View className="px-5" style={{ paddingBottom: 10 }}>
                <View className="flex-row items-center justify-between">
                  <TouchableOpacity className="w-10 h-10 items-center justify-center" style={{ backgroundColor: COLORS.card, borderRadius: 14 }}>
                    <Ionicons name="chevron-back" size={20} color={COLORS.ink} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.ink }}>
                    Inventory Dashboard
                  </Text>
                  <TouchableOpacity className="w-10 h-10 items-center justify-center" style={{ backgroundColor: COLORS.card, borderRadius: 14 }}>
                    <Ionicons name="notifications-outline" size={20} color={COLORS.ink} />
                    <View
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 10,
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: '#E9563A',
                      }}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="px-5" style={{ paddingBottom: 14 }}>
                <View className="flex-row items-center">
                  <View
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: COLORS.card,
                      borderRadius: 18,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}>
                    <Ionicons name="search-outline" size={20} color={COLORS.muted} />
                    <TextInput
                      style={{ flex: 1, marginLeft: 10, fontSize: 14, color: COLORS.ink }}
                      placeholder="Search inventory..."
                      placeholderTextColor={COLORS.muted}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>
                  <TouchableOpacity
                    style={{
                      marginLeft: 10,
                      width: 46,
                      height: 46,
                      borderRadius: 16,
                      backgroundColor: COLORS.chipActive,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="options-outline" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 6 }}>
                {categories.map((category) => {
                  const isActive = selectedCategory === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      onPress={() => setSelectedCategory(category)}
                      style={{
                        paddingHorizontal: 18,
                        paddingVertical: 10,
                        borderRadius: 999,
                        marginRight: 10,
                        backgroundColor: isActive ? COLORS.chipActive : COLORS.chip,
                      }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '700',
                          color: isActive ? '#FFFFFF' : COLORS.ink,
                        }}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          }
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

      <View style={{ position: 'absolute', bottom: 18, left: 16, right: 16 }}>
        <TouchableOpacity
          style={{
            backgroundColor: COLORS.chipActive,
            borderRadius: 18,
            paddingVertical: 14,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 5,
          }}>
          <View className="flex-row items-center">
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16, marginLeft: 8 }}>
              Update Stock
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
