import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

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
  'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80';

export default function ProductDetail() {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const addScale = useRef(new Animated.Value(1)).current;

  const onAddToCart = () => {
    Animated.sequence([
      Animated.spring(addScale, {
        toValue: 0.95,
        useNativeDriver: true,
        speed: 30,
        bounciness: 0,
      }),
      Animated.spring(addScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 6,
      }),
    ]).start();

    Toast.show({
      type: 'success',
      text1: 'Added to cart',
      text2: 'Your order has been added to the cart.',
    });
  };

  const totalPrice = useMemo(() => 100000 * quantity, [quantity]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Image source={{ uri: headerImage }} style={styles.headerImage} />
        <View style={styles.headerOverlay} />
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.title}>Robusta Bean</Text>
        <Text style={styles.desc}>
          Robusta coffee beans are known for their strong, earthy flavor and high caffeine
          content.
        </Text>

        <View style={styles.vendorRow}>
          <Ionicons name="storefront" size={14} color={COLORS.textSecondary} />
          <Text style={styles.vendorText}>The Coffee House</Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceText}>{totalPrice.toLocaleString('vi-VN')}vnd/g</Text>
          <View style={styles.quantityRow}>
            <TouchableOpacity
              style={styles.qtyButton}
              onPress={() => setQuantity((prev) => Math.max(1, prev - 1))}
            >
              <Ionicons name="remove" size={16} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.qtyButton}
              onPress={() => setQuantity((prev) => prev + 1)}
            >
              <Ionicons name="add" size={16} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Animated.View style={{ transform: [{ scale: addScale }] }}>
            <TouchableOpacity style={styles.addButton} onPress={onAddToCart}>
              <Text style={styles.addButtonText}>Add To Cart</Text>
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity
            style={styles.purchaseButton}
            onPress={() => router.push('/cart')}
          >
            <Text style={styles.purchaseButtonText}>Purchase</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    borderRadius: 20,
    overflow: 'hidden',
    height: 240,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  headerBackButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    marginHorizontal: 16,
    marginTop: -20,
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  desc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  vendorText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.danger,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qtyValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    minWidth: 20,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.text,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  purchaseButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#3A1C1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
