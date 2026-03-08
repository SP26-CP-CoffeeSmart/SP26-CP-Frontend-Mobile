import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface ReviewItem {
  id: string;
  name: string;
  description: string;
  qty: number;
  supplier: string;
  deliveryTime: string;
  priceVnd: number;
  rating: number;
  image: string;
}

const MOCK_REVIEW_ITEMS: ReviewItem[] = [
  {
    id: '1',
    name: 'Arabica Coffee Beans',
    description: 'Premium grade Arabica with distinct floral notes and balanced acidity.',
    qty: 2,
    supplier: 'Highland Farms',
    deliveryTime: '1-2h delivery',
    priceVnd: 100000,
    rating: 4.5,
    image: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1200',
  },
  {
    id: '2',
    name: 'Robusta Coffee Beans',
    description: 'Strong and earthy Robusta beans, perfect for a bold espresso blend.',
    qty: 5,
    supplier: 'Central Valley',
    deliveryTime: '1-2h delivery',
    priceVnd: 100000,
    rating: 4.5,
    image: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1200',
  },
];

export default function AIOrderReviewScreen() {
  const router = useRouter();

  const subtotalVnd = MOCK_REVIEW_ITEMS.reduce((sum, item) => sum + item.priceVnd * item.qty, 0);
  const deliveryVnd = 25000;
  const totalVnd = subtotalVnd + deliveryVnd;

  const formattedVnd = (value: number) =>
    value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=1200' }}
        style={styles.header}
        imageStyle={styles.headerImage}
      >
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIconButton}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}>
            <Ionicons name="ellipsis-vertical" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Review List</Text>
          <Text style={styles.headerSubtitle}>Verify your inventory order</Text>
        </View>
      </ImageBackground>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {MOCK_REVIEW_ITEMS.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <Image source={{ uri: item.image }} style={styles.itemImage} />
            <View style={styles.itemBody}>
              <View style={styles.itemHeaderRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color="#E67E22" />
                  <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                </View>
              </View>
              <Text style={styles.itemDescription}>{item.description}</Text>
              <View style={styles.itemMetaGrid}>
                <View style={styles.metaItem}>
                  <Ionicons name="cube-outline" size={14} color="#E67E22" />
                  <Text style={styles.metaText}>Qty: {item.qty} units</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="storefront-outline" size={14} color="#E67E22" />
                  <Text style={styles.metaText}>{item.supplier}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color="#E67E22" />
                  <Text style={styles.metaText}>{item.deliveryTime}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="cash-outline" size={14} color="#E67E22" />
                  <Text style={styles.metaText}>{formattedVnd(item.priceVnd)} vnd/g</Text>
                </View>
              </View>
            </View>
          </View>
        ))}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal ({MOCK_REVIEW_ITEMS.length} units)</Text>
            <Text style={styles.summaryValue}>{formattedVnd(subtotalVnd)} VND</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>{formattedVnd(deliveryVnd)} VND</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>{formattedVnd(totalVnd)} VND</Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.purchaseBar}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/ai-order-add-ingredients')}
        >
          <Ionicons name="add" size={18} color="#2C1B13" />
          <Text style={styles.addButtonText}>Add ingredients</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.purchaseButton}>
          <Ionicons name="cart-outline" size={18} color="#FFF" />
          <Text style={styles.purchaseButtonText}>Purchase Items</Text>
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
    height: 220,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 24,
  },
  headerImage: {
    resizeMode: 'cover',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBlock: {
    gap: 6,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#F5EEE7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 18,
  },
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: 180,
  },
  itemBody: {
    padding: 16,
    gap: 8,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C1B13',
    flex: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF4EA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E67E22',
  },
  itemDescription: {
    fontSize: 13,
    color: '#6F5E52',
    lineHeight: 18,
  },
  itemMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '48%',
  },
  metaText: {
    fontSize: 12,
    color: '#6F5E52',
  },
  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2D7CD',
    backgroundColor: '#FBF8F5',
    padding: 16,
    gap: 10,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C1B13',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6F5E52',
  },
  summaryValue: {
    fontSize: 13,
    color: '#6F5E52',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E2D7CD',
    marginVertical: 4,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C1B13',
  },
  summaryTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C1B13',
  },
  bottomSpacer: {
    height: 10,
  },
  purchaseBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: 'rgba(246, 242, 238, 0.95)',
    flexDirection: 'row',
    gap: 12,
  },
  addButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D9CFC5',
    borderRadius: 28,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
  },
  addButtonText: {
    color: '#2C1B13',
    fontSize: 14,
    fontWeight: '700',
  },
  purchaseButton: {
    flex: 1,
    backgroundColor: '#2C1B13',
    borderRadius: 28,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  purchaseButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
