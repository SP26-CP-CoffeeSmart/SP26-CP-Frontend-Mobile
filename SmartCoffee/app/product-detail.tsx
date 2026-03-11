import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useCart } from '@/context/cart-context';

const COLORS = {
  bg: '#F7F3EF',
  text: '#3C2A21',
  textSecondary: '#8E7B6F',
  border: '#E8E1D9',
  accent: '#D38B2A',
  white: '#FFFFFF',
  danger: '#B23B3B',
};

const fallbackHeaderImage =
  'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80';

interface SupplierProductApiItem {
  productId: number;
  supplierId: number;
  supplierName?: string | null;
  ingredientId: number;
  price: number;
  stock: number;
  status: string;
  createDate: string;
  measurement: string;
  image?: string | null;
  description?: string | null;
  ingredient?: {
    ingredientId: number;
    name: string;
    category: string;
    image: string | null;
    createDate: string;
    endDate: string;
  };
}

interface SupplierProductListResponse {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: SupplierProductApiItem[];
}

export default function ProductDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const productId = Number(params.productId);
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const addScale = useRef(new Animated.Value(1)).current;
  const [product, setProduct] = useState<SupplierProductApiItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    if (product) {
      addItem({
        productId: product.productId,
        supplierId: product.supplierId,
        supplierName: product.supplierName ?? null,
        name: product.ingredient?.name ?? 'Unknown product',
        category: product.ingredient?.category ?? 'Unknown category',
        image: product.ingredient?.image ?? null,
        measurement: product.measurement ?? 'unit',
        unitPrice: product.price ?? 0,
        quantity,
      });

      Toast.show({
        type: 'success',
        text1: 'Added to cart',
        text2: 'Your order has been added to the cart.',
      });
    }
  };

  useEffect(() => {
    const fetchProductDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await authorizedFetch(`${AUTH_BASE_URL}/SupplierProduct`, {
          headers: {
            Accept: '*/*',
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = (await response.json()) as SupplierProductListResponse | SupplierProductApiItem[];
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : [];
        const match = items.find((item) => item.productId === productId) || null;
        setProduct(match);
      } catch (fetchError) {
        setError('Failed to load product detail.');
      } finally {
        setLoading(false);
      }
    };

    if (!Number.isNaN(productId)) {
      fetchProductDetail();
    } else {
      setLoading(false);
      setError('Invalid product.');
    }
  }, [productId]);

  const unitPrice = product?.price ?? 0;
  const totalPrice = useMemo(() => unitPrice * quantity, [unitPrice, quantity]);
  const name = product?.ingredient?.name ?? 'Unknown product';
  const category = product?.ingredient?.category ?? 'Unknown category';
  const description = String(product?.description ?? '').trim();
  const imageUrl = product?.image ?? product?.ingredient?.image ?? fallbackHeaderImage;
  const measurement = product?.measurement ?? 'unit';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Image source={{ uri: imageUrl }} style={styles.headerImage} />
        <View style={styles.headerOverlay} />
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.sheet}>
        {loading ? (
          <View style={styles.stateRow}>
            <ActivityIndicator size="small" color={COLORS.accent} />
            <Text style={styles.stateText}>Loading product...</Text>
          </View>
        ) : error ? (
          <Text style={styles.stateText}>{error}</Text>
        ) : !product ? (
          <Text style={styles.stateText}>Product not found.</Text>
        ) : (
          <>
            <Text style={styles.title}>{name}</Text>
            <Text style={styles.desc}>{category}</Text>
            {description ? <Text style={styles.desc}>{description}</Text> : null}

            <View style={styles.vendorRow}>
              <Ionicons name="storefront" size={14} color={COLORS.textSecondary} />
              <Text style={styles.vendorText}>
                {product.supplierName ?? `Supplier #${product.supplierId}`}
              </Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceText}>
                {totalPrice.toLocaleString('vi-VN')}vnd/{measurement}
              </Text>
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
          </>
        )}
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
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  stateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
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
