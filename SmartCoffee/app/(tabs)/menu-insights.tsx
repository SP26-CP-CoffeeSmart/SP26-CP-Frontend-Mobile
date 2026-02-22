import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import menuPerformanceService, {
  MenuPerformanceSummary,
  MenuItemPerformance,
} from '../../services/menuPerformanceService';

export default function MenuInsightsScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MenuPerformanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMenuPerformance();
  }, []);

  const fetchMenuPerformance = async () => {
    try {
      setLoading(true);
      setError(null);
      // Using menuId = 1 as requested
      const result = await menuPerformanceService.getSummary(1);
      setData(result);
    } catch (err) {
      console.error('Error fetching menu performance:', err);
      setError('Failed to load menu performance data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount && amount !== 0) return 'N/A';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const formatPercentage = (value?: number) => {
    if (!value && value !== 0) return '';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value}%`;
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'HIGH_MARGIN':
        return { text: 'HIGH MARGIN', style: styles.badgeGreen };
      case 'HIGH_COST':
        return { text: 'HIGH COST', style: styles.badgeRed };
      case 'LOW_SALES':
        return { text: 'LOW SALES', style: styles.badgeRed };
      default:
        return null;
    }
  };

  const calculateProfitBarWidth = (item: MenuItemPerformance) => {
    const total = (item.profit || 0) + (item.cost || 0);
    if (total === 0) return { profitWidth: 50, costWidth: 50 };
    const profitWidth = ((item.profit || 0) / total) * 100;
    return {
      profitWidth: profitWidth,
      costWidth: 100 - profitWidth,
    };
  };

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
              <Text style={styles.bannerSubtitle}>Weekly Performance</Text>
              <Text style={styles.bannerTitle}>
                Menu Score: {data?.menuScore || 'N/A'}
              </Text>
            </View>
            <View style={styles.bannerIcon}>
              <Ionicons name="trending-up" size={32} color="#FFF" />
            </View>
          </View>
        </View>

        {/* Date Picker */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.datePicker}>
            <View style={styles.datePickerContent}>
              <Ionicons name="calendar-outline" size={20} color="#847362" />
              <Text style={styles.datePickerText}>
                {data?.startDate && data?.endDate
                  ? `${new Date(data.startDate).toLocaleDateString('vi-VN')} - ${new Date(data.endDate).toLocaleDateString('vi-VN')}`
                  : 'Select date range'}
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
              <Text style={styles.kpiValue}>{formatCurrency(data?.revenue)}</Text>
              {data?.revenueChange !== undefined && (
                <View style={styles.kpiChange}>
                  <Ionicons
                    name={data.revenueChange >= 0 ? 'arrow-up' : 'arrow-down'}
                    size={12}
                    color={data.revenueChange >= 0 ? '#07880e' : '#e71008'}
                  />
                  <Text
                    style={
                      data.revenueChange >= 0
                        ? styles.kpiChangeTextGreen
                        : styles.kpiChangeTextRed
                    }
                  >
                    {formatPercentage(data.revenueChange)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>PROFIT</Text>
              <Text style={styles.kpiValue}>{formatCurrency(data?.profit)}</Text>
              {data?.profitChange !== undefined && (
                <View style={styles.kpiChange}>
                  <Ionicons
                    name={data.profitChange >= 0 ? 'arrow-up' : 'arrow-down'}
                    size={12}
                    color={data.profitChange >= 0 ? '#07880e' : '#e71008'}
                  />
                  <Text
                    style={
                      data.profitChange >= 0
                        ? styles.kpiChangeTextGreen
                        : styles.kpiChangeTextRed
                    }
                  >
                    {formatPercentage(data.profitChange)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>COST</Text>
              <Text style={styles.kpiValue}>{formatCurrency(data?.cost)}</Text>
              {data?.costChange !== undefined && (
                <View style={styles.kpiChange}>
                  <Ionicons
                    name={data.costChange >= 0 ? 'warning-outline' : 'arrow-down'}
                    size={12}
                    color={data.costChange >= 0 ? '#e71008' : '#07880e'}
                  />
                  <Text
                    style={
                      data.costChange >= 0
                        ? styles.kpiChangeTextRed
                        : styles.kpiChangeTextGreen
                    }
                  >
                    {formatPercentage(data.costChange)}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>

        {/* Filter Bar */}
        <View style={styles.filterBar}>
          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#847362"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search menu..."
              placeholderTextColor="#847362"
            />
          </View>
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="filter" size={20} color="#4a3621" />
          </TouchableOpacity>
        </View>

        {/* Menu Items List */}
        <View style={styles.itemsList}>
          {data?.menuItems && data.menuItems.length > 0 ? (
            data.menuItems.map((item) => {
              const badge = getStatusBadge(item.status);
              const { profitWidth, costWidth } = calculateProfitBarWidth(item);
              const isLowSales = item.status === 'LOW_SALES';

              return (
                <View
                  key={item.id}
                  style={[styles.menuItem, isLowSales && styles.menuItemWarning]}
                >
                  <View style={[styles.menuItemImage, { backgroundColor: '#D4A574' }]}>
                    <Ionicons name="cafe" size={40} color="#FFF" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <View style={styles.menuItemHeader}>
                      <Text style={styles.menuItemTitle}>{item.name}</Text>
                      {badge && (
                        <View style={badge.style}>
                          <Text
                            style={
                              item.status === 'HIGH_MARGIN'
                                ? styles.badgeTextGreen
                                : styles.badgeTextRed
                            }
                          >
                            {badge.text}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.menuItemStats}>
                      {item.rating !== undefined && (
                        <View style={styles.rating}>
                          <Ionicons name="star" size={14} color="#fb923c" />
                          <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                        </View>
                      )}
                      {item.totalSold !== undefined && (
                        <Text style={styles.soldText}>• {item.totalSold} sold</Text>
                      )}
                    </View>
                    <View style={styles.profitBarContainer}>
                      <View style={styles.profitBarLabels}>
                        <Text style={styles.profitLabel}>
                          Profit: {formatCurrency(item.profit)}
                        </Text>
                        <Text style={styles.costLabel}>
                          Cost: {formatCurrency(item.cost)}
                        </Text>
                      </View>
                      <View style={styles.profitBar}>
                        <View style={[styles.profitFill, { width: `${profitWidth}%` }]} />
                        <View style={[styles.costFill, { width: `${costWidth}%` }]} />
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Ionicons name="restaurant-outline" size={48} color="#847362" />
              <Text style={{ marginTop: 12, color: '#847362', fontSize: 14 }}>
                No menu items available
              </Text>
            </View>
          )}

          {/* AI Suggestions */}
          {data?.aiSuggestions && (
            <View style={styles.aiSection}>
              <View style={styles.aiHeader}>
                <View style={styles.aiIconContainer}>
                  <Ionicons name="bulb" size={24} color="#FFF" />
                </View>
                <View style={styles.aiTextContainer}>
                  <Text style={styles.aiTitle}>AI Suggestions</Text>
                  <Text style={styles.aiDescription}>
                    {data.aiSuggestions.description ||
                      `Found ${data.aiSuggestions.count || 0} versions to improve profit based on current trends.`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.aiButton}>
                <Text style={styles.aiButtonText}>Generate Menu</Text>
                <Ionicons name="rocket" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
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
    gap: 12,
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
    paddingVertical: 10,
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
});
