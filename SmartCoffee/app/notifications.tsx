import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'low' | 'expiry' | 'out';
  forecast?: string;
  primaryAction?: string;
  secondaryAction?: string;
};

const todayItems: NotificationItem[] = [
  {
    id: 'low-stock',
    title: 'Low Stock Alert',
    message: 'Arabica coffee beans are running low (5kg left).',
    time: '2h ago',
    type: 'low',
    forecast: 'AI Forecast: Stock will deplete in approx. 2 days based on current demand.',
    primaryAction: 'Add to cart',
    secondaryAction: 'View details',
  },
  {
    id: 'near-expiry',
    title: 'Near Expiry Alert',
    message: 'Espresso beans (Batch #20231025) will expire in 3 days. Consider prioritizing use.',
    time: '5h ago',
    type: 'expiry',
    secondaryAction: 'View batch',
  },
];

const yesterdayItems: NotificationItem[] = [
  {
    id: 'out-stock',
    title: 'Out of Stock',
    message: 'Espresso beans is currently out of stock. Customers cannot order espresso-based drinks.',
    time: '1d ago',
    type: 'out',
    primaryAction: 'Order now',
  },
];

const getIcon = (type: NotificationItem['type']) => {
  switch (type) {
    case 'low':
      return { name: 'warning-outline', color: '#F36B2B', bg: '#FFF3E8' } as const;
    case 'expiry':
      return { name: 'time-outline', color: '#E07A0A', bg: '#FFF6E6' } as const;
    case 'out':
      return { name: 'cube-outline', color: '#E02323', bg: '#FFECEC' } as const;
    default:
      return { name: 'alert-circle-outline', color: '#8B5E3C', bg: '#F5EDE3' } as const;
  }
};

export default function NotificationsScreen() {
  const router = useRouter();

  const renderItem = (item: NotificationItem) => {
    const icon = getIcon(item.type);

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name} size={22} color={icon.color} />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMessage}>{item.message}</Text>
          </View>
          <Text style={styles.cardTime}>{item.time}</Text>
        </View>

        {item.forecast ? (
          <View style={styles.forecastBox}>
            <Ionicons name="sparkles" size={14} color="#8B5E3C" />
            <Text style={styles.forecastText}>{item.forecast}</Text>
          </View>
        ) : null}

        {(item.primaryAction || item.secondaryAction) ? (
          <View style={styles.cardActions}>
            {item.primaryAction ? (
              <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>{item.primaryAction}</Text>
                {item.type === 'out' ? (
                  <Ionicons name="cart-outline" size={16} color="#FFF" />
                ) : null}
              </TouchableOpacity>
            ) : null}
            {item.secondaryAction ? (
              <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85}>
                <Text style={styles.secondaryButtonText}>{item.secondaryAction}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#3F2A1D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="options-outline" size={20} color="#3F2A1D" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Today</Text>
        {todayItems.map(renderItem)}

        <Text style={styles.sectionLabel}>Yesterday</Text>
        {yesterdayItems.map(renderItem)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F4EF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3F2A1D',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionLabel: {
    color: '#9A8A79',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 10,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitleWrap: {
    flex: 1,
    paddingRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3F2A1D',
    marginBottom: 4,
  },
  cardMessage: {
    fontSize: 14,
    color: '#6D5A4B',
    lineHeight: 20,
  },
  cardTime: {
    fontSize: 12,
    color: '#B3A495',
  },
  forecastBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F4EFE8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  forecastText: {
    marginLeft: 8,
    color: '#6D5A4B',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#3F2A1D',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2D8CC',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#3F2A1D',
    fontWeight: '600',
    fontSize: 14,
  },
});
