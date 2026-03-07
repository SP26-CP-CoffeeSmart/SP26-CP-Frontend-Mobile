import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const COLORS = {
  bg: '#F7F3EF',
  text: '#3C2A21',
  textSecondary: '#8E7B6F',
  border: '#E8E1D9',
  accent: '#D38B2A',
  white: '#FFFFFF',
  chip: '#F2E9E1',
  chipText: '#8B5E34',
  danger: '#B23B3B',
};

const headerImage =
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80';

const statuses = [
  { key: 'pending', label: 'Pending', icon: 'hourglass-outline' },
  { key: 'pickup', label: 'Awaiting pickup', icon: 'cafe-outline' },
  { key: 'delivery', label: 'Awaiting delivery', icon: 'bicycle-outline' },
  { key: 'done', label: 'Delivered', icon: 'checkmark-circle-outline' },
];

const sampleOrders = [
  {
    id: '1',
    name: 'Arabica',
    desc: 'Description',
    price: '100.000 vnd',
    image:
      'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: '2',
    name: 'Robusta',
    desc: 'Description',
    price: '100.000 vnd',
    image:
      'https://images.unsplash.com/photo-1462917882517-e150004895fa?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: '3',
    name: 'Liberica',
    desc: 'Description',
    price: '100.000 vnd',
    image:
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80',
  },
];

export default function OrderScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}
        >
          <Image source={{ uri: headerImage }} style={styles.headerImage} />
          <View style={styles.headerOverlay} />
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Order Page</Text>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => router.push('/cart')}
            >
              <Ionicons name="bag-outline" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent orders</Text>

        <View style={styles.statusRow}>
          {statuses.map((item) => (
            <View key={item.key} style={styles.statusItem}>
              <View style={styles.statusIconWrap}>
                <Ionicons name={item.icon as any} size={18} color={COLORS.chipText} />
              </View>
              <Text style={styles.statusText}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cardList}>
          {sampleOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <Image source={{ uri: order.image }} style={styles.orderImage} />
              <View style={styles.orderInfo}>
                <Text style={styles.orderName}>{order.name}</Text>
                <Text style={styles.orderDesc}>{order.desc}</Text>
                <Text style={styles.orderPrice}>{order.price}</Text>
              </View>
              <TouchableOpacity style={styles.reorderButton}>
                <Text style={styles.reorderText}>Re-Order</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.loadMoreButton}>
          <Text style={styles.loadMoreText}>Load more</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/product-page')}>
        <Ionicons name="add" size={24} color={COLORS.text} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  header: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    height: 180,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  headerRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  statusItem: {
    alignItems: 'center',
    width: 72,
  },
  statusIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.chip,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  cardList: {
    paddingHorizontal: 16,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#E8CCBE',
  },
  orderInfo: {
    flex: 1,
    marginLeft: 10,
  },
  orderName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  orderDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  orderPrice: {
    fontSize: 11,
    color: COLORS.danger,
    fontWeight: '600',
  },
  reorderButton: {
    backgroundColor: COLORS.text,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  reorderText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  loadMoreButton: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  loadMoreText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E7D8C9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
