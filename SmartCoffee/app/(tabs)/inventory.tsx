import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Color theme
const COLORS = {
  primaryBrown: '#4A3428',
  primaryGold: '#C5A059',
  accentGold: '#D4AF37',
  bgWarm: '#F9F7F2',
  cardBg: '#FFFFFF',
  white: '#FFFFFF',
};

interface InventoryItem {
  id: string;
  name: string;
  subtitle: string;
  image: string;
  current: number;
  total: number;
  unit: string;
  percentage: number;
  status: 'premium' | 'critical' | 'low' | 'good';
  category: string;
}

const INVENTORY_DATA: InventoryItem[] = [
  {
    id: '1',
    name: 'Arabica Roast',
    subtitle: 'Single Origin • Ethiopia',
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400',
    current: 5.2,
    total: 20,
    unit: 'kg',
    percentage: 26,
    status: 'low',
    category: 'Coffee Beans',
  },
  {
    id: '2',
    name: 'Oat Milk',
    subtitle: 'Barista Edition • 1L',
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400',
    current: 2,
    total: 24,
    unit: 'units',
    percentage: 8,
    status: 'critical',
    category: 'Dairy',
  },
  {
    id: '3',
    name: 'Vanilla Syrup',
    subtitle: 'Organic Madagascar',
    image: 'https://images.unsplash.com/photo-1481391243133-f96216dcb5d2?w=400',
    current: 12,
    total: 15,
    unit: 'bottles',
    percentage: 80,
    status: 'good',
    category: 'Syrups',
  },
  {
    id: '4',
    name: 'Arabica Coffee Beans',
    subtitle: 'Premium Blend • Colombia',
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQM43Cz-hVdZsVfpjBTca1YD5Awy1noAFGtdw&s',
    current: 350,
    total: 500,
    unit: 'kg',
    percentage: 70,
    status: 'good',
    category: 'Coffee Beans',
  },
];

const CATEGORIES = ['All', 'Coffee Beans', 'Dairy', 'Syrups', 'Supplies'];

export default function InventoryScreen() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'premium':
        return { bg: '#FEF3C7', text: '#D97706', label: 'PREMIUM' };
      case 'critical':
        return { bg: '#FEE2E2', text: '#DC2626', label: 'CRITICAL' };
      case 'low':
        return { bg: '#FEF3C7', text: '#D97706', label: 'LOW STOCK' };
      case 'good':
        return { bg: '#D1FAE5', text: '#059669', label: 'IN STOCK' };
      default:
        return { bg: '#D1FAE5', text: '#059669', label: 'GOOD' };
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage <= 15) return '#F87171';
    if (percentage <= 30) return '#FB923C';
    return '#10B981';
  };

  const renderInventoryItem = (item: InventoryItem) => {
    const statusStyle = getStatusStyle(item.status);
    const progressColor = getProgressColor(item.percentage);

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: item.image }}
              style={styles.itemImage}
              resizeMode="cover"
            />
          </View>
          
          <View style={styles.itemDetails}>
            <View style={styles.itemHeader}>
              <View style={styles.itemTitleContainer}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.status === 'premium' && (
                  <View style={styles.premiumBadge}>
                    <Ionicons name="star" size={12} color={COLORS.primaryGold} />
                    <Text style={styles.premiumText}>Premium</Text>
                  </View>
                )}
              </View>
              {item.status !== 'premium' && (
                <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                  <Text style={[styles.statusText, { color: statusStyle.text }]}>
                    {statusStyle.label}
                  </Text>
                </View>
              )}
            </View>
            
            <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
            
            <View style={styles.stockInfo}>
              <Text style={styles.stockText}>
                {item.current}{item.unit === 'kg' ? 'kg' : ''} / {item.total}
                {item.unit === 'kg' ? 'kg' : ` ${item.unit}`}
              </Text>
              <Text style={[styles.percentageText, { color: progressColor }]}>
                {item.percentage}%
              </Text>
            </View>
            
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${item.percentage}%`,
                    backgroundColor: progressColor,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgWarm} />
      
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>MANAGEMENT</Text>
            <Text style={styles.headerTitle}>Inventory</Text>
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
              placeholder="Search stock items..."
              placeholderTextColor={`${COLORS.primaryBrown}4D`}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="options-outline" size={22} color={COLORS.primaryBrown} />
          </TouchableOpacity>
        </View>

        {/* Category Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category && styles.categoryTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Inventory List */}
        <View style={styles.inventoryList}>
          {INVENTORY_DATA.map((item) => renderInventoryItem(item))}
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
    backgroundColor: COLORS.bgWarm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
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
  filterButton: {
    width: 56,
    height: 56,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoriesContainer: {
    marginTop: 24,
  },
  categoriesContent: {
    paddingHorizontal: 24,
    gap: 12,
  },
  categoryChip: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${COLORS.primaryGold}1A`,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primaryBrown,
    borderColor: COLORS.primaryBrown,
    shadowColor: COLORS.primaryBrown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryBrown,
  },
  categoryTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  inventoryList: {
    paddingHorizontal: 24,
    marginTop: 24,
    gap: 16,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
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
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.bgWarm,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
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
