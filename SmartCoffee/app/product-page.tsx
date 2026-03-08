import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Dimensions,
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
  shadow: '#000000',
};

const headerImage =
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80';

const categories = ['Bean', 'Milk', 'Sugar', 'Syrup'];

const products = [
  {
    id: '1',
    name: 'Arabica',
    desc: 'Description',
    price: '100.000 vnd/gam',
    eta: '1 - 2h',
    rating: '4,5',
    image:
      'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: '2',
    name: 'Robusta',
    desc: 'Description',
    price: '100.000 vnd/gam',
    eta: '1 - 2h',
    rating: '4,5',
    image:
      'https://images.unsplash.com/photo-1462917882517-e150004895fa?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: '3',
    name: 'Arabica',
    desc: 'Description',
    price: '100.000 vnd/gam',
    eta: '1 - 2h',
    rating: '4,5',
    image:
      'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: '4',
    name: 'Robusta',
    desc: 'Description',
    price: '100.000 vnd/gam',
    eta: '1 - 2h',
    rating: '4,5',
    image:
      'https://images.unsplash.com/photo-1462917882517-e150004895fa?auto=format&fit=crop&w=600&q=80',
  },
];

const { width } = Dimensions.get('window');
const cardGap = 12;
const cardWidth = (width - 32 - cardGap) / 2;

export default function ProductPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const term = search.trim().toLowerCase();
    return products.filter((item) => item.name.toLowerCase().includes(term));
  }, [search]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image source={{ uri: headerImage }} style={styles.headerImage} />
          <View style={styles.headerOverlay} />
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.headerBackButton}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => router.push('/cart')}
            >
              <Ionicons name="bag-outline" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={COLORS.textSecondary} />
          <TextInput
            placeholder="Hat Robusta"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.categoryRow}>
          {categories.map((item) => (
            <TouchableOpacity key={item} style={styles.categoryChip}>
              <Text style={styles.categoryText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.suggestionBox}>
          <TouchableOpacity onPress={() => router.push('/ai-order-suggestions')}>
          <Ionicons name="sparkles" size={14} color={COLORS.text} />
          <Text style={styles.suggestionText}>
            AI suggestion: Helping you make purchases quickly based on inventory analysis.
          </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {filteredProducts.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => router.push('/product-detail')}
              activeOpacity={0.9}
            >
              <Image source={{ uri: item.image }} style={styles.cardImage} />
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardDesc}>{item.desc}</Text>
              <Text style={styles.cardPrice}>{item.price}</Text>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>{item.eta}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="star" size={12} color={COLORS.accent} />
                  <Text style={styles.metaText}>{item.rating}</Text>
                </View>
              </View>
            </TouchableOpacity>
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
    height: 160,
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
  headerBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  categoryChip: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  suggestionBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suggestionText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: cardGap,
  },
  card: {
    width: cardWidth,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#E8CCBE',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardDesc: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cardPrice: {
    fontSize: 11,
    color: COLORS.danger,
    marginTop: 4,
    fontWeight: '700',
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
});
