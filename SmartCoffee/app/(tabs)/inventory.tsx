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
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';

interface Ingredient {
  name: string;
  image: string;
  category: string;
  createDate: string;
  endDate: string;
}

interface ShopInventoryItem {
  inventoryDetailId: number;
  coffeeShopId?: number;
  ingredientId?: number;
  quantity?: number;
  minStock?: number;
  expirationDate?: string;
  measurement?: string;
  imageUrl?: string;
  image?: string;
  ingredient?: Ingredient;
}

export default function InventoryScreen() {
  const router = useRouter();
  const { coffeeShopId } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [sortOption, setSortOption] = useState<'alpha' | 'qty-asc' | 'qty-desc'>('alpha');
  const [draftCategory, setDraftCategory] = useState('All');
  const [draftStatus, setDraftStatus] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [draftSort, setDraftSort] = useState<'alpha' | 'qty-asc' | 'qty-desc'>('alpha');
  const [ingredients, setIngredients] = useState<ShopInventoryItem[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<ShopInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);

  const maxQuantity = 500;
  const defaultMinStock = 100;

  const COLORS = {
    background: '#F7F2EE',
    card: '#FFFFFF',
    ink: '#1E1B16',
    muted: '#7A6F67',
    accent: '#2B1C15',
    chip: '#F2E7DA',
    chipActive: '#2B1C15',
    border: '#EFE4D8',
    surface: '#FBF7F2',
  };

  const fetchIngredients = async () => {
    if (!coffeeShopId) {
      setIngredients([]);
      setFilteredIngredients([]);
      setError('Không tìm thấy shopId của tài khoản hiện tại.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await authorizedFetch(API_ENDPOINTS.shopInventory.getByShop(coffeeShopId));
      const data = await response.json();

      console.log('Fetched ingredients:', data);
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
  }, [coffeeShopId]);

  const categoryOptions = ['All', ...Array.from(
    new Set(ingredients.map((item) => item.ingredient?.category || 'Uncategorized'))
  ).filter((value) => value)];

  const hasInventory = ingredients.length > 0;

  useEffect(() => {
    let filtered = ingredients;

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter((item) => {
        const category = item.ingredient?.category || 'Uncategorized';
        return category === selectedCategory;
      });
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter((item) => {
        const quantity = Number(item.quantity ?? 0);
        const minStock = Number(item.minStock ?? defaultMinStock);
        const status = getStockStatus(quantity, minStock).label;
        if (status.includes('OUT')) return selectedStatus === 'out';
        if (status.includes('LOW')) return selectedStatus === 'low';
        return selectedStatus === 'in';
      });
    }

    // Filter by search query
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter((item) => {
        const name = item.ingredient?.name || `Inventory #${item.inventoryDetailId}`;
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    if (sortOption !== 'alpha') {
      filtered = [...filtered].sort((a, b) => {
        const qtyA = Number(a.quantity ?? 0);
        const qtyB = Number(b.quantity ?? 0);
        return sortOption === 'qty-asc' ? qtyA - qtyB : qtyB - qtyA;
      });
    } else {
      filtered = [...filtered].sort((a, b) => {
        const nameA = (a.ingredient?.name || `Inventory #${a.inventoryDetailId}`).toLowerCase();
        const nameB = (b.ingredient?.name || `Inventory #${b.inventoryDetailId}`).toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }

    setFilteredIngredients(filtered);
  }, [searchQuery, selectedCategory, selectedStatus, sortOption, ingredients]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchIngredients();
  };

  const openFilter = () => {
    setDraftCategory(selectedCategory);
    setDraftStatus(selectedStatus);
    setDraftSort(sortOption);
    setFilterVisible(true);
  };

  const applyFilter = () => {
    setSelectedCategory(draftCategory);
    setSelectedStatus(draftStatus);
    setSortOption(draftSort);
    setFilterVisible(false);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedStatus('all');
    setSortOption('alpha');
    setDraftCategory('All');
    setDraftStatus('all');
    setDraftSort('alpha');
    setFilterVisible(false);
  };

  const getStockStatus = (quantity: number, minStock: number) => {
    if (quantity <= 0) {
      return {
        label: 'OUT OF STOCK',
        color: '#B91C1C',
        bgColor: '#FEE2E2',
        barColor: '#EF4444',
      };
    }

    if (quantity <= minStock) {
      return {
        label: 'LOW STOCK',
        color: '#B45309',
        bgColor: '#FEF3C7',
        barColor: '#F59E0B',
      };
    }

    return {
      label: 'IN STOCK',
      color: '#15803D',
      bgColor: '#DCFCE7',
      barColor: '#22C55E',
    };
  };

  const getStockPercentage = (quantity: number) => {
    return Math.min((quantity / maxQuantity) * 100, 100);
  };

  const formatMeasurement = (measurement?: string) => {
    if (!measurement) return 'units';
    const normalized = measurement.trim().toLowerCase();
    if (['g', 'gram', 'grams', 'gam'].includes(normalized)) return 'g';
    if (['kg', 'kilogram', 'kilograms'].includes(normalized)) return 'kg';
    if (['ml', 'milliliter', 'milliliters'].includes(normalized)) return 'ml';
    if (['l', 'liter', 'liters', 'litre', 'litres'].includes(normalized)) return 'l';
    if (['unit', 'units', 'pcs', 'pc', 'piece', 'pieces'].includes(normalized)) return 'units';
    return measurement;
  };

  const renderItem = ({ item }: { item: ShopInventoryItem }) => {
    const quantity = Number(item.quantity ?? 0);
    const minStockValue = Number(item.minStock ?? defaultMinStock);
    const status = getStockStatus(quantity, minStockValue);
    const percentage = getStockPercentage(quantity);
    const unitLabel = formatMeasurement(item.measurement);

    // Extract ingredient info (use ingredient object if exists, otherwise show item ID)
    const ingredientName = item.ingredient?.name || `Inventory #${item.inventoryDetailId}`;
    const ingredientImage = item.image || item.imageUrl || item.ingredient?.image;
    const ingredientCategory = item.ingredient?.category || 'Unknown Category';

    return (
      <TouchableOpacity
        onPress={() => router.push(`/ingredient-detail/${item.inventoryDetailId}`)}
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
            {/* Title */}
            <View className="flex-row items-center mb-1">
              <Text
                style={{ flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.ink }}
                numberOfLines={1}>
                {ingredientName}
              </Text>
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
                {quantity} {unitLabel}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.muted }}>
                Min: {minStockValue} {unitLabel}
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
      <FlatList
        data={filteredIngredients}
        renderItem={renderItem}
        keyExtractor={(item) => item.inventoryDetailId.toString()}
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
                <View className="flex-row items-center" style={{ gap: 10 }}>
                  <TouchableOpacity
                    className="w-10 h-10 items-center justify-center"
                    style={{ backgroundColor: COLORS.card, borderRadius: 14 }}
                    onPress={() => router.push('/inventory-history')}
                  >
                    <Ionicons name="time-outline" size={19} color={COLORS.ink} />
                  </TouchableOpacity>
                </View>
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
                    opacity: hasInventory ? 1 : 0.5,
                  }}
                  onPress={openFilter}
                  disabled={!hasInventory}
                >
                  <Ionicons name="options-outline" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={{
                  marginTop: 12,
                  backgroundColor: COLORS.accent,
                  borderRadius: 16,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  shadowColor: '#000',
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 3,
                }}
                onPress={() => router.push('/ai-inventory-predict')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>
                      AI Predict Inventory
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
                      Forecast low-stock items
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {(selectedCategory !== 'All' || selectedStatus !== 'all' || sortOption !== 'alpha') ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 6 }}>
                {selectedCategory !== 'All' ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      marginRight: 8,
                      marginBottom: 8,
                      backgroundColor: COLORS.chipActive,
                    }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>{selectedCategory}</Text>
                  </View>
                ) : null}
                {selectedStatus !== 'all' ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      marginRight: 8,
                      marginBottom: 8,
                      backgroundColor: COLORS.chipActive,
                    }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                      {selectedStatus === 'in' ? 'In Stock' : 'Out of Stock'}
                    </Text>
                  </View>
                ) : null}
                {sortOption !== 'alpha' ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      marginRight: 8,
                      marginBottom: 8,
                      backgroundColor: COLORS.chipActive,
                    }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                      {sortOption === 'qty-asc' ? 'Stock: Low to High' : 'Stock: High to Low'}
                    </Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  onPress={resetFilters}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    marginBottom: 8,
                  }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.ink }}>Clear</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={{ paddingHorizontal: 24, paddingTop: 28 }}>
            <View
              style={{
                backgroundColor: COLORS.card,
                borderRadius: 18,
                paddingVertical: 28,
                paddingHorizontal: 20,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: COLORS.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <Ionicons name="cafe-outline" size={28} color={COLORS.muted} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.ink, marginBottom: 6 }}>
                No ingredients yet
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center', marginBottom: 16 }}>
                Add your first ingredient or clear filters to see all items.
              </Text>
              <View className="flex-row" style={{ gap: 10 }}>
                <TouchableOpacity
                  onPress={resetFilters}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                  }}
                >
                  <Text style={{ color: COLORS.ink, fontWeight: '600' }}>Clear Filters</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onRefresh}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: COLORS.chipActive,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Refresh</Text>
                </TouchableOpacity>
              </View>
            </View>
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


      <Modal
        animationType="slide"
        transparent
        visible={filterVisible}
        onRequestClose={() => setFilterVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: COLORS.card,
              paddingHorizontal: 20,
              paddingTop: 14,
              paddingBottom: 20,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}>
            <View
              style={{
                alignSelf: 'center',
                width: 44,
                height: 5,
                borderRadius: 999,
                backgroundColor: '#DED5CC',
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.ink }}>Filter & Sort</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <Ionicons name="close" size={18} color={COLORS.ink} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.2, marginBottom: 12 }}>
                Category
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
                {categoryOptions.map((category) => {
                  const isActive = draftCategory === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      onPress={() => setDraftCategory(category)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 16,
                        backgroundColor: isActive ? COLORS.chipActive : COLORS.chip,
                        gap: 6,
                      }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? '#FFFFFF' : COLORS.ink }}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.2, marginBottom: 12 }}>
                Stock Status
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
                {[
                  { key: 'in', label: 'In Stock', icon: 'checkmark-circle' as const },
                  { key: 'low', label: 'Low Stock', icon: 'alert-circle' as const },
                  { key: 'out', label: 'Out of Stock', icon: 'close-circle' as const },
                ].map((item) => {
                  const isActive = draftStatus === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => setDraftStatus(item.key as 'in' | 'low' | 'out')}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 16,
                        backgroundColor: isActive ? COLORS.chipActive : COLORS.chip,
                        gap: 6,
                      }}>
                      <Ionicons name={item.icon} size={14} color={isActive ? '#FFFFFF' : COLORS.ink} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? '#FFFFFF' : COLORS.ink }}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  onPress={() => setDraftStatus('all')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 16,
                    backgroundColor: draftStatus === 'all' ? COLORS.chipActive : COLORS.chip,
                    gap: 6,
                  }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: draftStatus === 'all' ? '#FFFFFF' : COLORS.ink }}>
                    All Status
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.2, marginBottom: 12 }}>
                Sort By
              </Text>
              {[{
                key: 'alpha' as const,
                label: 'Alphabetical (A-Z)',
              }, {
                key: 'qty-asc' as const,
                label: 'Stock Level: Low to High',
              }, {
                key: 'qty-desc' as const,
                label: 'Stock Level: High to Low',
              }].map((item) => {
                const isActive = draftSort === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => setDraftSort(item.key)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: COLORS.border,
                    }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.ink }}>{item.label}</Text>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: isActive ? COLORS.chipActive : COLORS.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      {isActive ? (
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.chipActive }} />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={{
                marginTop: 18,
                backgroundColor: COLORS.chipActive,
                paddingVertical: 16,
                borderRadius: 18,
                alignItems: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 4,
              }}
              onPress={applyFilter}
            >
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>Apply Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 12, alignItems: 'center', paddingVertical: 6 }} onPress={resetFilters}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.muted }}>Reset to Default</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
