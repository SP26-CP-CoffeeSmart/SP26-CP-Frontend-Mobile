import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Pressable,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface SuggestedItem {
  id: string;
  name: string;
  category: string;
  priceVnd: number;
  image: string;
  subtitle: string;
  qtyNeeded: number;
  timeRange: string;
  rating: number;
}

// Mock data - sẽ thay bằng data từ API
const MOCK_SUGGESTIONS: SuggestedItem[] = [
  {
    id: '1',
    name: 'Arabica',
    category: 'Bean',
    priceVnd: 100000,
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600',
    subtitle: 'Hat cafe nguyen chat day vi...',
    qtyNeeded: 1,
    timeRange: '1-2h',
    rating: 4.5,
  },
  {
    id: '2',
    name: 'Robusta',
    category: 'Bean',
    priceVnd: 100000,
    image: 'https://images.unsplash.com/photo-1515442261605-65987783cb6a?w=600',
    subtitle: 'Hat cafe nguyen chat day vi...',
    qtyNeeded: 1,
    timeRange: '1-2h',
    rating: 4.5,
  },
  {
    id: '3',
    name: 'Oat Milk',
    category: 'Milk',
    priceVnd: 70000,
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600',
    subtitle: 'Sua hat mem min cho latte...',
    qtyNeeded: 2,
    timeRange: '2-3h',
    rating: 4.3,
  },
  {
    id: '4',
    name: 'Caramel Syrup',
    category: 'Syrup',
    priceVnd: 90000,
    image: 'https://images.unsplash.com/photo-1541976076758-347942db197c?w=600',
    subtitle: 'Huong caramel ngam ngot...',
    qtyNeeded: 1,
    timeRange: '1-2h',
    rating: 4.6,
  },
  {
    id: '5',
    name: 'Hazelnut Syrup',
    category: 'Syrup',
    priceVnd: 95000,
    image: 'https://images.unsplash.com/photo-1502740479091-635887520276?w=600',
    subtitle: 'Huong hat de chiua...',
    qtyNeeded: 1,
    timeRange: '1-2h',
    rating: 4.4,
  },
  {
    id: '6',
    name: 'Whole Milk',
    category: 'Milk',
    priceVnd: 60000,
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600',
    subtitle: 'Sua beo tu nhien...',
    qtyNeeded: 2,
    timeRange: '2-3h',
    rating: 4.1,
  },
];

const CATEGORY_FILTERS = ['All', 'Bean', 'Milk', 'Syrup'];

export default function AIOrderSuggestionsScreen() {
  const router = useRouter();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedFilter, setSelectedFilter] = useState('All');

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredSuggestions.length) {
      setSelectedItems(new Set());
      return;
    }
    setSelectedItems(new Set(filteredSuggestions.map((item) => item.id)));
  };

  const filteredSuggestions = useMemo(() => {
    if (selectedFilter === 'All') {
      return MOCK_SUGGESTIONS;
    }
    return MOCK_SUGGESTIONS.filter((item) => item.category === selectedFilter);
  }, [selectedFilter]);

  const totalVnd = MOCK_SUGGESTIONS.filter((item) => selectedItems.has(item.id)).reduce(
    (sum, item) => sum + item.priceVnd,
    0
  );

  const formattedVnd = (value: number) =>
    value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

  return (
    <View style={styles.container}>
      {/* Header */}
      <ImageBackground
        source={{
          uri: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200',
        }}
        style={styles.header}
        imageStyle={styles.headerImage}
      >
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Suggested List</Text>
        </View>
      </ImageBackground>

      {/* Filters */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {CATEGORY_FILTERS.map((label) => {
            const isActive = selectedFilter === label;
            return (
              <Pressable
                key={label}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedFilter(label)}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Select all row */}
      <View style={styles.selectRow}>
        <Pressable style={styles.selectRowLeft} onPress={toggleSelectAll}>
          <View
            style={[
              styles.selectCircle,
              selectedItems.size === filteredSuggestions.length && styles.selectCircleActive,
            ]}
          >
            {selectedItems.size === filteredSuggestions.length && (
              <Ionicons name="checkmark" size={14} color="#FFF" />
            )}
          </View>
          <Text style={styles.selectText}>Select all products</Text>
        </Pressable>
        <TouchableOpacity style={styles.filterIconButton}>
          <Ionicons name="options-outline" size={18} color="#2C1B13" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredSuggestions.map((item) => {
          const isSelected = selectedItems.has(item.id);
          return (
            <Pressable
              key={item.id}
              style={[styles.itemCard, isSelected && styles.itemCardSelected]}
              onPress={() => toggleItemSelection(item.id)}
            >
              <View style={styles.itemLeft}>
                <View style={styles.itemSelectCircle}>
                  {isSelected ? (
                    <View style={styles.itemSelectCircleActive}>
                      <Ionicons name="checkmark" size={12} color="#FFF" />
                    </View>
                  ) : (
                    <View style={styles.itemSelectCircleInactive} />
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                  <Text style={styles.itemPrice}>
                    {formattedVnd(item.priceVnd)} VND/g
                  </Text>
                  <Text style={styles.itemQty}>Qty needed: {item.qtyNeeded}</Text>
                  <View style={styles.itemMetaRow}>
                    <View style={styles.itemMetaBadge}>
                      <Ionicons name="time-outline" size={12} color="#9B8B7B" />
                      <Text style={styles.itemMetaText}>{item.timeRange}</Text>
                    </View>
                    <View style={styles.itemMetaBadge}>
                      <Ionicons name="star" size={12} color="#D0A45C" />
                      <Text style={styles.itemMetaText}>{item.rating.toFixed(1)}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <Image source={{ uri: item.image }} style={styles.itemImage} />
            </Pressable>
          );
        })}

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.selectedCount}>{selectedItems.size} items selected</Text>
          <Text style={styles.selectedTotal}>{formattedVnd(totalVnd)} VND</Text>
        </View>
        <TouchableOpacity style={styles.reviewButton}>
          <Text style={styles.reviewButtonText}>Review</Text>
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
    height: 180,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerImage: {
    resizeMode: 'cover',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.2,
  },
  filtersWrapper: {
    backgroundColor: '#F6F2EE',
    paddingVertical: 12,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EEE6DC',
  },
  filterChipActive: {
    backgroundColor: '#2C1B13',
    borderColor: '#2C1B13',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3E2A22',
  },
  filterTextActive: {
    color: '#FFF',
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  selectRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CFC2B6',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleActive: {
    backgroundColor: '#2C1B13',
    borderColor: '#2C1B13',
  },
  selectText: {
    fontSize: 13,
    color: '#8B7A6A',
  },
  filterIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 14,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1EAE2',
  },
  itemCardSelected: {
    borderColor: '#2C1B13',
  },
  itemLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  itemSelectCircle: {
    marginTop: 6,
  },
  itemSelectCircleInactive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CFC2B6',
    backgroundColor: '#FFF',
  },
  itemSelectCircleActive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2C1B13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C1B13',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#8B7A6A',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2C1B13',
    marginTop: 8,
  },
  itemQty: {
    fontSize: 12,
    color: '#8B7A6A',
    marginTop: 4,
  },
  itemMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  itemMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F6F2EE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  itemMetaText: {
    fontSize: 11,
    color: '#8B7A6A',
    fontWeight: '600',
  },
  itemImage: {
    width: 92,
    height: 92,
    borderRadius: 16,
    backgroundColor: '#EEE5DB',
  },
  bottomSpacer: {
    height: 90,
  },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  selectedCount: {
    fontSize: 12,
    color: '#8B7A6A',
  },
  selectedTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C1B13',
    marginTop: 4,
  },
  reviewButton: {
    backgroundColor: '#2C1B13',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
  },
  reviewButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
