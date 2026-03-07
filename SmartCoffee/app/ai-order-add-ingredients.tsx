import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageBackground,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface IngredientItem {
  id: string;
  name: string;
  category: string;
  description: string;
  priceVnd: number;
  rating: number;
  image: string;
  unit: string;
}

const CATEGORY_FILTERS = ['All', 'Bean', 'Milk', 'Sugar', 'Syrup'];

const MOCK_INGREDIENTS: IngredientItem[] = [
  {
    id: '1',
    name: 'Arabica Gold',
    category: 'Bean',
    description: 'Highland single origin beans',
    priceVnd: 100000,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800',
    unit: 'vnd/g',
  },
  {
    id: '2',
    name: 'Robusta Extra',
    category: 'Bean',
    description: 'Strong body, high caffeine',
    priceVnd: 85000,
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1512568400610-62da28bc8a13?w=800',
    unit: 'vnd/g',
  },
  {
    id: '3',
    name: 'Whole Milk',
    category: 'Milk',
    description: 'Creamy texture, farm fresh',
    priceVnd: 15000,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800',
    unit: 'vnd/ml',
  },
  {
    id: '4',
    name: 'Oat Milk',
    category: 'Milk',
    description: 'Plant-based, naturally sweet',
    priceVnd: 25000,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=800',
    unit: 'vnd/ml',
  },
];

export default function AIOrderAddIngredientsScreen() {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const filteredItems = useMemo(() => {
    const base = selectedFilter === 'All'
      ? MOCK_INGREDIENTS
      : MOCK_INGREDIENTS.filter((item) => item.category === selectedFilter);

    if (!searchText.trim()) {
      return base;
    }

    const query = searchText.toLowerCase();
    return base.filter((item) => item.name.toLowerCase().includes(query));
  }, [selectedFilter, searchText]);

  const updateQty = (id: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[id] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const totalVnd = useMemo(() => {
    return MOCK_INGREDIENTS.reduce((sum, item) => {
      const qty = quantities[item.id] ?? 0;
      return sum + item.priceVnd * qty;
    }, 0);
  }, [quantities]);

  const formattedVnd = (value: number) =>
    value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200' }}
        style={styles.header}
        imageStyle={styles.headerImage}
      >
        <View style={styles.headerOverlay} />
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIconButton}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTopTitle}>Add Ingredients</Text>
          <TouchableOpacity style={styles.headerIconButton}>
            <Ionicons name="lock-closed" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Customize Your Brew</Text>
          <Text style={styles.headerSubtitle}>Select premium ingredients for your perfect cup</Text>
        </View>
      </ImageBackground>

      <View style={styles.searchSection}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={18} color="#9B8B7B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search ingredients (e.g. Arabica, Oat Milk)"
            placeholderTextColor="#9B8B7B"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {CATEGORY_FILTERS.map((label) => {
            const isActive = selectedFilter === label;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedFilter(label)}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredItems.map((item) => {
          const qty = quantities[item.id] ?? 0;
          return (
            <View key={item.id} style={styles.itemCard}>
              <Image source={{ uri: item.image }} style={styles.itemImage} />
              <View style={styles.itemBody}>
                <View style={styles.itemHeaderRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color="#D9903D" />
                    <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                  </View>
                </View>
                <Text style={styles.itemDescription}>{item.description}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.itemPrice}>{formattedVnd(item.priceVnd)}{item.unit}</Text>
                  {qty > 0 ? (
                    <View style={styles.qtyRow}>
                      <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() => updateQty(item.id, -1)}
                      >
                        <Ionicons name="remove" size={16} color="#5B4A3F" />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{qty}g</Text>
                      <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() => updateQty(item.id, 1)}
                      >
                        <Ionicons name="add" size={16} color="#5B4A3F" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.addCircle}
                      onPress={() => updateQty(item.id, 1)}
                    >
                      <Ionicons name="add" size={18} color="#FFF" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        })}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.totalLabel}>TOTAL CUSTOMIZATION</Text>
          <Text style={styles.totalValue}>{formattedVnd(totalVnd)} VND</Text>
        </View>
        <TouchableOpacity style={styles.addToOrderButton}>
          <Text style={styles.addToOrderText}>Add to order</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F2EE',
  },
  header: {
    height: 210,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  headerImage: {
    resizeMode: 'cover',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTopTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  headerTitleBlock: {
    gap: 6,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#F5EEE7',
  },
  searchSection: {
    backgroundColor: '#F6F2EE',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E8DED4',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#3E2A22',
  },
  filtersContainer: {
    paddingVertical: 14,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E8DED4',
  },
  filterChipActive: {
    backgroundColor: '#6A4528',
    borderColor: '#6A4528',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3E2A22',
  },
  filterTextActive: {
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 14,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: '#F1E7DD',
  },
  itemBody: {
    flex: 1,
    gap: 6,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C1B13',
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6F5E52',
  },
  itemDescription: {
    fontSize: 12,
    color: '#6F5E52',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6A4528',
  },
  addCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#6A4528',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1E7DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3E2A22',
  },
  bottomSpacer: {
    height: 12,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE4D8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9B8B7B',
    letterSpacing: 0.6,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6A4528',
    marginTop: 4,
  },
  addToOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2C1B13',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  addToOrderText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
