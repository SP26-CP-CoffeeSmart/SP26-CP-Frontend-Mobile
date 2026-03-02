import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import menuPerformanceService, {
  MenuPerformanceSummary,
  ChartDataItem,
} from '../../services/menuPerformanceService';
import menuItemService, { MenuItem } from '../../services/menuItemService';
import shopBeverageService, { ShopBeverage } from '../../services/shopBeverageService';
import { useAuth } from '../../context/auth-context';

export default function MenuInsightsScreen() {
  const { menuId } = useLocalSearchParams<{ menuId?: string }>();
  const { coffeeShopId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MenuPerformanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [beverages, setBeverages] = useState<ShopBeverage[]>([]);

  useEffect(() => {
    fetchMenuPerformance();
    if (coffeeShopId) {
      fetchMenuItems();
    }
  }, [menuId, coffeeShopId]);

  const fetchMenuPerformance = async () => {
    try {
      setLoading(true);
      setError(null);
      const id = menuId ? Number(menuId) : 1;
      const result = await menuPerformanceService.getSummary(id);
      setData(result);
      // Set to latest date by default
      if (result.chartData && result.chartData.length > 0) {
        setSelectedDateIndex(result.chartData.length - 1);
      }
    } catch (err) {
      console.error('Error fetching menu performance:', err);
      setError('Failed to load menu performance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuItems = async () => {
    try {
      setLoadingItems(true);
      const id = menuId ? Number(menuId) : 1;
      
      // Fetch menu items and beverages in parallel
      const [items, beveragesData] = await Promise.all([
        menuItemService.getByMenuId(id),
        coffeeShopId ? shopBeverageService.getByShopId(coffeeShopId) : Promise.resolve([])
      ]);
      
      setBeverages(beveragesData);
      
      // Merge beverage data into menu items
      const enrichedItems = items.map(item => {
        const beverage = beveragesData.find(b => b.beverageId === item.beverageId);
        return {
          ...item,
          shopBeverage: beverage || item.shopBeverage
        };
      });
      
      setMenuItems(enrichedItems);
      console.log('[Menu Insights] Enriched menu items with beverage data:', enrichedItems.length);
    } catch (err) {
      console.error('Error fetching menu items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const getSelectedDateData = (): ChartDataItem | null => {
    if (!data || !data.chartData || data.chartData.length === 0) return null;
    return data.chartData[selectedDateIndex] || null;
  };

  const getMenuScore = () => {
    const selectedData = getSelectedDateData();
    if (!selectedData) return 'N/A';
    
    const profit = selectedData.totalRevenue - selectedData.cost;
    const profitMargin = selectedData.totalRevenue > 0 
      ? (profit / selectedData.totalRevenue) * 100 
      : 0;
    
    if (profitMargin >= 70) return 'Excellent';
    if (profitMargin >= 50) return 'Good';
    if (profitMargin >= 30) return 'Fair';
    return 'Poor';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const getFilteredMenuItems = () => {
    if (!searchQuery) return menuItems;
    const query = searchQuery.toLowerCase();
    console.log(`[Menu Insights] Filtering menu items with query: "${query}"`);
    return menuItems.filter(item => 
      item.shopBeverage?.name?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.shopBeverage?.beverageCategory?.name?.toLowerCase().includes(query)
    );
  };

  console.log(getFilteredMenuItems());

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#4a3621" />
          <Text style={{ marginTop: 12, color: '#847362' }}>Loading menu insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <Ionicons name="alert-circle-outline" size={48} color="#e71008" />
          <Text style={{ marginTop: 12, color: '#4a3621', fontSize: 16, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity
            onPress={fetchMenuPerformance}
            style={[styles.aiButton, { marginTop: 16, paddingHorizontal: 24 }]}
          >
            <Text style={styles.aiButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Menu Insights</Text>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color="#4a3621" />
          </TouchableOpacity>
        </View>

        {/* Menu Score Banner */}
        <View style={styles.bannerContainer}>
          <View style={styles.banner}>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerSubtitle}>Daily Performance</Text>
              <Text style={styles.bannerTitle}>
                Menu Score: {getMenuScore()}
              </Text>
            </View>
            <View style={styles.bannerIcon}>
              <Ionicons name="trending-up" size={32} color="#FFF" />
            </View>
          </View>
        </View>

        {/* Date Picker */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.datePicker}
            onPress={() => setShowDatePicker(true)}
          >
            <View style={styles.datePickerContent}>
              <Ionicons name="calendar-outline" size={20} color="#847362" />
              <Text style={styles.datePickerText}>
                {getSelectedDateData() 
                  ? formatDate(getSelectedDateData()!.date)
                  : 'Select date'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#847362" />
          </TouchableOpacity>

          {/* KPI Row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.kpiScrollView}
            contentContainerStyle={styles.kpiContainer}
          >
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>REVENUE</Text>
              <Text style={styles.kpiValue}>
                {formatCurrency(getSelectedDateData()?.totalRevenue || 0)}
              </Text>
              <View style={styles.kpiChange}>
                <Ionicons
                  name={data?.revenueChangePercent && data.revenueChangePercent >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={data?.revenueChangePercent && data.revenueChangePercent >= 0 ? '#07880e' : '#e71008'}
                />
                <Text
                  style={
                    data?.revenueChangePercent && data.revenueChangePercent >= 0
                      ? styles.kpiChangeTextGreen
                      : styles.kpiChangeTextRed
                  }
                >
                  {formatPercentage(data?.revenueChangePercent || 0)}
                </Text>
              </View>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>PROFIT</Text>
              <Text style={styles.kpiValue}>
                {formatCurrency((getSelectedDateData()?.totalRevenue || 0) - (getSelectedDateData()?.cost || 0))}
              </Text>
              <View style={styles.kpiChange}>
                <Ionicons name="circle" size={12} color="#847362" />
                <Text style={styles.kpiChangeTextGreen}>—</Text>
              </View>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>COST</Text>
              <Text style={styles.kpiValue}>
                {formatCurrency(getSelectedDateData()?.cost || 0)}
              </Text>
              <View style={styles.kpiChange}>
                <Ionicons name="circle" size={12} color="#847362" />
                <Text style={styles.kpiChangeTextGreen}>—</Text>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#847362" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search menu items..."
              placeholderTextColor="#847362"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#847362" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="options" size={20} color="#4a3621" />
          </TouchableOpacity>
        </View>

        {/* Menu Items Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Menu Items ({getFilteredMenuItems().length})</Text>
        </View>

        {/* Menu Items List */}
        <View style={styles.itemsList}>
          {loadingItems ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#4a3621" />
              <Text style={{ marginTop: 8, color: '#847362' }}>Loading menu items...</Text>
            </View>
          ) : getFilteredMenuItems().length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={48} color="#847362" />
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'No menu items found' : 'No menu items available'}
              </Text>
            </View>
          ) : (
            getFilteredMenuItems().map((item) => (
              <View key={item.menuItemId} style={styles.menuItem}>
                <View style={styles.menuItemImage}>
                  {item.shopBeverage?.image || item.shopBeverage?.imageUrl ? (
                    <Image 
                      source={{ uri: item.shopBeverage.image || item.shopBeverage.imageUrl }} 
                      style={{ width: 80, height: 80, borderRadius: 12 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={{ backgroundColor: '#e1dbd6', width: 80, height: 80, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="cafe" size={32} color="#847362" />
                    </View>
                  )}
                </View>
                <View style={styles.menuItemContent}>
                  <View style={styles.menuItemHeader}>
                    <Text style={styles.menuItemTitle} numberOfLines={2}>
                      {item.shopBeverage?.name || 'Unnamed Item'}
                    </Text>
                  </View>
                  {item.description && (
                    <Text style={styles.menuItemDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                  <View style={styles.menuItemPriceRow}>
                    <Text style={styles.menuItemPrice}>
                      {formatCurrency(item.sellingPrice)}
                    </Text>
                    {item.shopBeverage?.beverageCategory?.name && (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>
                          {item.shopBeverage.beverageCategory.name}
                        </Text>
                      </View>
                    )}
                  </View>
                  {item.itemSizeViewModels && item.itemSizeViewModels.length > 0 && (
                    <View style={styles.sizesContainer}>
                      <Text style={styles.sizesLabel}>Sizes: </Text>
                      {item.itemSizeViewModels.map((size, index) => (
                        <Text key={size.itemSizeId} style={styles.sizeText}>
                          {size.beverageSize?.sizeName || size.beverageSize?.volume ? 
                            `${size.beverageSize?.sizeName || ''}${size.beverageSize?.volume ? ` (${size.beverageSize.volume}ml)` : ''}` : 
                            size.sellingPrice ? formatCurrency(size.sellingPrice) : 'Size'}
                          {index < item.itemSizeViewModels!.length - 1 ? ', ' : ''}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* AI Suggestions */}
        <View style={styles.itemsList}>
          <View style={styles.aiSection}>
            <View style={styles.aiHeader}>
              <View style={styles.aiIconContainer}>
                <Ionicons name="bulb" size={24} color="#FFF" />
              </View>
              <View style={styles.aiTextContainer}>
                <Text style={styles.aiTitle}>AI Suggestions</Text>
                <Text style={styles.aiDescription}>
                  Analyze your menu performance and get AI-powered recommendations to improve profit.
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.aiButton}>
              <Text style={styles.aiButtonText}>Generate Menu</Text>
              <Ionicons name="rocket" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color="#4a3621" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={data?.chartData || []}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.dateItem,
                    selectedDateIndex === index && styles.dateItemSelected
                  ]}
                  onPress={() => {
                    setSelectedDateIndex(index);
                    setShowDatePicker(false);
                  }}
                >
                  <View style={styles.dateItemContent}>
                    <Ionicons 
                      name="calendar" 
                      size={20} 
                      color={selectedDateIndex === index ? '#FFF' : '#4a3621'} 
                    />
                    <Text style={[
                      styles.dateItemText,
                      selectedDateIndex === index && styles.dateItemTextSelected
                    ]}>
                      {formatDate(item.date)}
                    </Text>
                  </View>
                  <View style={styles.dateItemStats}>
                    <Text style={[
                      styles.dateItemRevenue,
                      selectedDateIndex === index && styles.dateItemTextSelected
                    ]}>
                      {formatCurrency(item.totalRevenue)}
                    </Text>
                    <Text style={[
                      styles.dateItemCups,
                      selectedDateIndex === index && styles.dateItemTextSelected
                    ]}>
                      {item.totalCups} cups
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f6',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4a3621',
  },
  notificationButton: {
    padding: 8,
    borderRadius: 50,
  },
  bannerContainer: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  banner: {
    backgroundColor: '#4a3621',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  bannerContent: {
    flex: 1,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: '#FFF',
    opacity: 0.8,
    fontWeight: '500',
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  bannerIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 12,
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1dbd6',
    marginBottom: 16,
  },
  datePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  datePickerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a3621',
  },
  kpiScrollView: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  kpiContainer: {
    gap: 16,
    paddingRight: 24,
  },
  kpiCard: {
    minWidth: 160,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e1dbd6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  kpiLabel: {
    fontSize: 10,
    color: '#847362',
    fontWeight: '600',
    letterSpacing: 1,
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 8,
    gap: 12,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1dbd6',
    gap: 8,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4a3621',
    marginTop: 4,
  },
  kpiChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  kpiChangeTextGreen: {
    fontSize: 12,
    fontWeight: '700',
    color: '#07880e',
  },
  kpiChangeTextRed: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e71008',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1dbd6',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 2,
    fontSize: 14,
    color: '#4a3621',
  },
  filterButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#e1dbd6',
    padding: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemsList: {
    paddingHorizontal: 24,
    gap: 16,
    paddingBottom: 16,
  },
  menuItem: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1dbd6',
    flexDirection: 'row',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  menuItemWarning: {
    borderLeftWidth: 4,
    borderLeftColor: '#e71008',
  },
  menuItemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4a3621',
    flex: 1,
    marginRight: 8,
  },
  badgeGreen: {
    backgroundColor: 'rgba(7, 136, 14, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(7, 136, 14, 0.2)',
  },
  badgeTextGreen: {
    fontSize: 9,
    fontWeight: '700',
    color: '#07880e',
  },
  badgeRed: {
    backgroundColor: 'rgba(231, 16, 8, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(231, 16, 8, 0.2)',
  },
  badgeTextRed: {
    fontSize: 9,
    fontWeight: '700',
    color: '#e71008',
  },
  menuItemStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4a3621',
  },
  soldText: {
    fontSize: 12,
    color: '#847362',
  },
  profitBarContainer: {
    marginTop: 4,
  },
  profitBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  profitLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4a3621',
    letterSpacing: 0.5,
  },
  costLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#847362',
    letterSpacing: 0.5,
  },
  profitBar: {
    height: 8,
    width: '100%',
    backgroundColor: '#e5e5e5',
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  profitFill: {
    height: '100%',
    backgroundColor: '#4a3621',
  },
  costFill: {
    height: '100%',
    backgroundColor: 'rgba(74, 54, 33, 0.3)',
  },
  aiSection: {
    backgroundColor: 'rgba(74, 54, 33, 0.05)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(74, 54, 33, 0.2)',
    gap: 16,
  },
  aiHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  aiIconContainer: {
    backgroundColor: '#4a3621',
    padding: 8,
    borderRadius: 12,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiTextContainer: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4a3621',
    marginBottom: 4,
  },
  aiDescription: {
    fontSize: 14,
    color: '#847362',
  },
  aiButton: {
    backgroundColor: '#4a3621',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  aiButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSpacing: {
    height: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4a3621',
    marginBottom: 8,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#847362',
    textAlign: 'center',
  },
  menuItemDescription: {
    fontSize: 13,
    color: '#847362',
    marginBottom: 8,
    lineHeight: 18,
  },
  menuItemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4a3621',
  },
  categoryBadge: {
    backgroundColor: 'rgba(74, 54, 33, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4a3621',
  },
  sizesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  sizesLabel: {
    fontSize: 11,
    color: '#847362',
    fontWeight: '600',
  },
  sizeText: {
    fontSize: 11,
    color: '#847362',
  },
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e1dbd6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1dbd6',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4a3621',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#847362',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4a3621',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1dbd6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4a3621',
  },
  dateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dateItemSelected: {
    backgroundColor: '#4a3621',
  },
  dateItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a3621',
  },
  dateItemTextSelected: {
    color: '#FFF',
  },
  dateItemStats: {
    alignItems: 'flex-end',
  },
  dateItemRevenue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4a3621',
  },
  dateItemCups: {
    fontSize: 12,
    color: '#847362',
    marginTop: 2,
  },
});
