import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import shopRecipeIngredientsService, { ShopRecipeIngredient } from '../../services/shopRecipeIngredientsService';

// Color theme
const COLORS = {
  primaryBrown: '#4A3428',
  primaryGold: '#C5A059',
  accentGold: '#D4AF37',
  bgWarm: '#F9F7F2',
  cardBg: '#FFFFFF',
  white: '#FFFFFF',
  error: '#E74C3C',
};

export default function InventoryScreen() {
  const [ingredients, setIngredients] = useState<ShopRecipeIngredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<ShopRecipeIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  // Fetch data từ API
  const fetchIngredients = async () => {
    try {
      setError(null);
      const data = await shopRecipeIngredientsService.getAll();
      setIngredients(data);
      setFilteredIngredients(data);
    } catch (err) {
      setError('Không thể tải dữ liệu. Vui lòng kiểm tra kết nối API.');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
  }, []);

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchIngredients();
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredIngredients(ingredients);
    } else {
      const filtered = ingredients.filter((item) =>
        item.ingredient.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredIngredients(filtered);
    }
  };

  const getStatusStyle = (cost: number) => {
    if (cost > 50000) {
      return { bg: '#FEE2E2', text: '#DC2626', label: 'High Cost' };
    } else if (cost > 20000) {
      return { bg: '#FEF3C7', text: '#D97706', label: 'Medium Cost' };
    } else {
      return { bg: '#D1FAE5', text: '#059669', label: 'Low Cost' };
    }
  };

  const renderInventoryItem = (item: ShopRecipeIngredient) => {
    const statusStyle = getStatusStyle(item.cost);

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.imageContainer}>
            <View style={styles.iconPlaceholder}>
              <Ionicons name="nutrition" size={32} color={COLORS.primaryGold} />
            </View>
          </View>
          
          <View style={styles.itemDetails}>
            <View style={styles.itemHeader}>
              <View style={styles.itemTitleContainer}>
                <Text style={styles.itemName}>{item.ingredient.name}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.statusText, { color: statusStyle.text }]}>
                  {statusStyle.label}
                </Text>
              </View>
            </View>
            
            <Text style={styles.itemSubtitle}>{item.ingredient.category}</Text>
            
            <View style={styles.stockInfo}>
              <View style={styles.stockInfoRow}>
                <Ionicons name="scale-outline" size={16} color={COLORS.primaryBrown} />
                <Text style={styles.stockLabel}>Quantity:</Text>
                <Text style={styles.stockValue}>{item.quantity}</Text>
              </View>
              <View style={styles.stockInfoRow}>
                <Ionicons name="cash-outline" size={16} color={COLORS.primaryBrown} />
                <Text style={styles.stockLabel}>Cost:</Text>
                <Text style={styles.stockValue}>{item.cost.toLocaleString('en-US')} USD</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primaryGold} />
          <Text style={styles.loadingText}>Loading data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchIngredients}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgWarm} />
      
      <ScrollView 
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primaryGold]}
            tintColor={COLORS.primaryGold}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>Inventory Management</Text>
            <Text style={styles.headerTitle}>Inventory</Text>
            <Text style={styles.headerSubtitle}>{filteredIngredients.length} Ingredient</Text>
          </View>
        </View>

        {/* Search and Filter */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons
              name="search-outline"
              size={20}
              color={`${COLORS.primaryBrown}66`}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Find Ingredients..."
              placeholderTextColor={`${COLORS.primaryBrown}4D`}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={20} color={COLORS.primaryBrown} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Inventory List */}
        <View style={styles.inventoryList}>
          {filteredIngredients.length > 0 ? (
            filteredIngredients.map((item) => renderInventoryItem(item))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="basket-outline" size={64} color={COLORS.primaryBrown} style={{ opacity: 0.3 }} />
              <Text style={styles.emptyText}>No ingredients found</Text>
            </View>
          )}
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab}>
        <Ionicons name="add" size={28} color={COLORS.primaryGold} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bgWarm,
  },
  container: {
    flex: 1,
    marginTop: 40,
    backgroundColor: COLORS.bgWarm,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.primaryBrown,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primaryGold,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  recipeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryGold,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  recipeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primaryGold,
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.primaryBrown,
  },
  headerSubtitle: {
    fontSize: 14,
    color: `${COLORS.primaryBrown}99`,
    marginTop: 4,
  },
  profileContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${COLORS.primaryGold}33`,
    padding: 2,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 24,
    gap: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.primaryBrown,
    paddingVertical: 14,
  },
  inventoryList: {
    paddingHorizontal: 24,
    marginTop: 24,
    gap: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: `${COLORS.primaryBrown}99`,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.primaryBrown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 3,
    borderWidth: 1,
    borderColor: `${COLORS.primaryGold}0D`,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
  },
  imageContainer: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: COLORS.bgWarm,
    overflow: 'hidden',
  },
  iconPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryBrown,
    lineHeight: 22,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  premiumText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primaryGold,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 12,
    color: `${COLORS.primaryBrown}99`,
    fontWeight: '500',
    marginTop: 2,
  },
  stockInfo: {
    gap: 4,
  },
  stockInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stockLabel: {
    fontSize: 12,
    color: `${COLORS.primaryBrown}99`,
    flex: 1,
  },
  stockValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primaryBrown,
  },
  stockText: {
    fontSize: 11,
    fontWeight: '700',
    color: `${COLORS.primaryBrown}66`,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  percentageText: {
    fontSize: 11,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 24,
    width: 56,
    height: 56,
    backgroundColor: COLORS.primaryBrown,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
