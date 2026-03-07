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
  danger: '#B23B3B',
};

const headerImage =
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80';

const cartItems = [
  {
    id: '1',
    shop: 'The Coffee House',
    name: 'Arabica',
    desc: 'Hat cafe nguyen chat duoc rang ...',
    price: '100.000vnd/g',
    image:
      'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: '2',
    shop: 'Highland',
    name: 'Arabica',
    desc: 'Hat cafe nguyen chat duoc rang ...',
    price: '100.000vnd/g',
    image:
      'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=400&q=80',
  },
];

export default function CartPage() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image source={{ uri: headerImage }} style={styles.headerImage} />
          <View style={styles.headerOverlay} />
          <Text style={styles.headerTitle}>Your Cart</Text>
          <TouchableOpacity
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.selectAllRow}>
            <TouchableOpacity style={styles.checkbox} />
            <Text style={styles.selectAllText}>All</Text>
          </View>

          {cartItems.map((item) => (
            <View key={item.id} style={styles.shopSection}>
              <View style={styles.shopRow}>
                <TouchableOpacity style={styles.checkbox} />
                <Text style={styles.shopText}>{item.shop} ></Text>
              </View>
              <View style={styles.itemCard}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemDesc}>{item.desc}</Text>
                  <Text style={styles.itemPrice}>{item.price}</Text>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity style={styles.qtyButton}>
                      <Ionicons name="remove" size={14} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>1</Text>
                    <TouchableOpacity style={styles.qtyButton}>
                      <Ionicons name="add" size={14} color={COLORS.text} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Image source={{ uri: item.image }} style={styles.itemImage} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  headerTitle: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  headerBackButton: {
    position: 'absolute',
    left: 16,
    top: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
    backgroundColor: COLORS.white,
  },
  selectAllText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  shopSection: {
    marginBottom: 12,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  shopText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  itemCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemDesc: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginVertical: 4,
  },
  itemPrice: {
    fontSize: 11,
    color: COLORS.danger,
    fontWeight: '700',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  qtyButton: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#E8CCBE',
  },
});
