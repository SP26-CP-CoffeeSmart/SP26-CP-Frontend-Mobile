import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
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
  Image.resolveAssetSource(require('../assets/AI_RecommendationBackground.jpg')).uri;

interface SupplierProductApiItem {
  productId: number;
  supplierId: number;
  supplierName?: string | null;
  ingredientId: number;
  price: number;
  stock: number;
  holdStock?: number | null;
  status: string;
  createDate: string;
  measurement: string;
  // packageSize: khối lượng 1 túi (theo measurement)
  packageSize?: number | null;
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
  const { items, addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [quantityInput, setQuantityInput] = useState('1');
  const addScale = useRef(new Animated.Value(1)).current;
  const [product, setProduct] = useState<SupplierProductApiItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const availableQuantity = useMemo(() => {
    if (!product) return 0;
    const stock = Number(product.stock ?? 0);
    const holdStock = Number(product.holdStock ?? 0);
    return Math.max(0, stock - holdStock);
  }, [product]);

  useEffect(() => {
    const clamped = availableQuantity > 0 ? Math.min(Math.max(1, quantity), availableQuantity) : 1;
    if (clamped !== quantity) {
      setQuantity(clamped);
    }
    setQuantityInput(String(clamped));
  }, [availableQuantity, quantity]);

  const handleQuantityInputChange = (rawValue: string) => {
    const normalized = rawValue.replace(/[^0-9]/g, '');
    setQuantityInput(normalized);

    if (!normalized) {
      return;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return;
    }

    if (parsed <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid quantity',
        text2: 'Quantity must be greater than 0.',
      });
      setQuantity(1);
      setQuantityInput('1');
      return;
    }

    const clamped = availableQuantity > 0 ? Math.min(parsed, availableQuantity) : parsed;
    if (availableQuantity > 0 && parsed > availableQuantity) {
      Toast.show({
        type: 'info',
        text1: 'Stock limit',
        text2: `Maximum available quantity is ${availableQuantity}.`,
      });
    }
    setQuantity(clamped);
    setQuantityInput(String(clamped));
  };

  const handleQuantityInputBlur = () => {
    const parsed = Number(quantityInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setQuantity(1);
      setQuantityInput('1');
      return;
    }

    const clamped = availableQuantity > 0 ? Math.min(parsed, availableQuantity) : parsed;
    setQuantity(clamped);
    setQuantityInput(String(clamped));
  };

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
      if (availableQuantity <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Out of stock',
          text2: 'This product is currently unavailable.',
        });
        return;
      }

      const quantityInCart = items
        .filter((item) => item.productId === product.productId)
        .reduce((sum, item) => sum + Math.max(0, Number(item.quantity ?? 0)), 0);
      const remainingAvailable = Math.max(availableQuantity - quantityInCart, 0);

      if (remainingAvailable <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Stock limit reached',
          text2: 'This product already reached its available stock in your cart.',
        });
        return;
      }

      const safeQuantity = Math.min(quantity, remainingAvailable);

      addItem({
        productId: product.productId,
        supplierId: product.supplierId,
        supplierName: product.supplierName ?? null,
        name: product.ingredient?.name ?? 'Unknown product',
        category: product.ingredient?.category ?? 'Unknown category',
        image: product.image ?? product.ingredient?.image ?? null,
        measurement: product.measurement ?? 'unit',
        packageSize: product.packageSize ?? null,
        availableStock: availableQuantity,
        unitPrice: product.price ?? 0,
        quantity: safeQuantity,
      });

      Toast.show({
        type: 'success',
        text1: 'Added to cart',
        text2:
          safeQuantity < quantity
            ? `Only ${remainingAvailable} item(s) left. Added ${safeQuantity}.`
            : 'Your order has been added to the cart.',
      });
    }
  };

  useEffect(() => {
    const fetchProductDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        let match: SupplierProductApiItem | null = null;

        // 1. First try standard REST endpoint for a single item
        const singleResponse = await authorizedFetch(`${AUTH_BASE_URL}/SupplierProduct/${productId}`, {
          headers: {
            Accept: '*/*',
          },
        });

        if (singleResponse.ok) {
          const detailData = await singleResponse.json();
          match = detailData?.data ? detailData.data : detailData;
        } else {
          // 2. Fallback: Search across pagination if the backend doesn't support single GET by ID
          let found = false;
          let currentPage = 1;
          const pageSize = 50;

          while (!found && currentPage <= 10) { // Max 10 pages * 50 = 500 items deep scan
            const listResponse = await authorizedFetch(
              `${AUTH_BASE_URL}/SupplierProduct?page=${currentPage}&pageSize=${pageSize}`,
              { headers: { Accept: '*/*' } }
            );

            if (!listResponse.ok) break;

            const listData = await listResponse.json();
            const items = Array.isArray(listData)
              ? listData
              : Array.isArray(listData?.items)
                ? listData.items
                : [];

            if (items.length === 0) break;

            const potentialMatch = items.find((item: SupplierProductApiItem) => item.productId === productId);
            if (potentialMatch) {
              match = potentialMatch;
              found = true;
              break;
            }

            if (items.length < pageSize) break;
            currentPage++;
          }
        }

        if (!match) {
          throw new Error('Product not found on the server.');
        }

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
  const packageSize = product?.packageSize ?? null;

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
                {totalPrice.toLocaleString('vi-VN')} VND/
                {packageSize && measurement
                  ? `(${packageSize} ${measurement})`
                  : measurement}
              </Text>
              <View style={styles.quantityRow}>
                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={() =>
                    setQuantity((prev) => {
                      const next = Math.max(1, prev - 1);
                      setQuantityInput(String(next));
                      return next;
                    })
                  }
                >
                  <Ionicons name="remove" size={16} color={COLORS.text} />
                </TouchableOpacity>
                <TextInput
                  value={quantityInput}
                  onChangeText={handleQuantityInputChange}
                  onBlur={handleQuantityInputBlur}
                  keyboardType="number-pad"
                  style={styles.qtyInput}
                  placeholder="1"
                  placeholderTextColor={COLORS.textSecondary}
                />
                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={() =>
                    setQuantity((prev) => {
                      if (availableQuantity <= 0) {
                        return 1;
                      }
                      if (prev >= availableQuantity) {
                        Toast.show({
                          type: 'info',
                          text1: 'Stock limit',
                          text2: `Maximum available quantity is ${availableQuantity}.`,
                        });
                        return prev;
                      }
                      const next = Math.min(availableQuantity, prev + 1);
                      setQuantityInput(String(next));
                      return next;
                    })
                  }
                >
                  <Ionicons name="add" size={16} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.stockHint}>Available to buy: {availableQuantity}</Text>

            <View style={styles.actionRow}>
              <Animated.View style={{ transform: [{ scale: addScale }] }}>
                <TouchableOpacity
                  style={[styles.addButton, availableQuantity <= 0 && styles.addButtonDisabled]}
                  onPress={onAddToCart}
                  disabled={availableQuantity <= 0}
                >
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
  qtyInput: {
    minWidth: 46,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  stockHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 12,
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
  addButtonDisabled: {
    opacity: 0.5,
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
