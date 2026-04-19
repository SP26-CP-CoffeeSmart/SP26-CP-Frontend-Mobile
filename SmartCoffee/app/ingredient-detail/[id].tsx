import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';

interface IngredientInfo {
  ingredientId: number;
  name: string;
  image: string | null;
  category: string;
  createDate: string;
  endDate: string;
}

interface CoffeeShopInfo {
  coffeeShopId: number;
  shopName: string;
  address: string;
  provinceId: number | null;
  districtId: number | null;
  wardCode: string | null;
  timestamp: string;
}

interface ShopInventoryDetail {
  inventoryDetailId: number;
  coffeeShopId: number;
  ingredientId: number;
  quantity: number;
  minStock: number;
  expirationDate: string | null;
  measurement: string;
  imageUrl?: string | null;
  image?: string | null;
  ingredient: IngredientInfo | null;
  coffeeShop: CoffeeShopInfo | null;
}

const MAX_ZOOM_SCALE = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;

const COLORS = {
  bg: '#F7F3EF',
  white: '#FFFFFF',
  text: '#3C2A21',
  textSecondary: '#8E7B6F',
  border: '#E8E1D9',
  accent: '#A36D2D',
  accentSoft: '#EFE5D9',
  successBg: '#E3F7E6',
  successText: '#2F7D4D',
  warningBg: '#FFF2DE',
  warningText: '#9B6A2F',
  dangerBg: '#FDECEC',
  dangerText: '#A33434',
};

const formatMeasurement = (measurement?: string) => {
  if (!measurement) return 'units';
  const normalized = measurement.trim().toLowerCase();
  if (['g', 'gram', 'grams', 'gam'].includes(normalized)) return 'g';
  if (['kg', 'kilogram', 'kilograms'].includes(normalized)) return 'kg';
  if (['ml', 'milliliter', 'milliliters'].includes(normalized)) return 'ml';
  if (['l', 'liter', 'liters', 'litre', 'litres'].includes(normalized)) return 'l';
  if (['unit', 'units', 'pcs', 'pc', 'piece', 'pieces'].includes(normalized)) return 'units';
  return measurement;
};

const parseMinStockInput = (input: string): number | null => {
  const normalized = input.trim().replace(',', '.');
  if (!normalized) return null;
  if (!/^(?:\d+|\d+\.\d+|\.\d+)$/.test(normalized)) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return parsed;
};

const formatDate = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function IngredientDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { role } = useAuth();

  const [inventoryDetail, setInventoryDetail] = useState<ShopInventoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [manualThresholdText, setManualThresholdText] = useState('');
  const [showImageViewer, setShowImageViewer] = useState(false);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const normalizedRole = (role ?? '').trim().toLowerCase();
  const canSetThreshold = normalizedRole === 'shopowner' || normalizedRole === 'owner';
  const parsedThresholdValue = useMemo(() => parseMinStockInput(manualThresholdText), [manualThresholdText]);
  const isThresholdInvalid = manualThresholdText.trim().length > 0 && parsedThresholdValue === null;

  useEffect(() => {
    fetchIngredientDetail();
  }, [id]);

  const resetZoom = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const next = savedScale.value * event.scale;
      scale.value = Math.max(1, Math.min(MAX_ZOOM_SCALE, next));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value <= 1) {
        translateX.value = 0;
        translateY.value = 0;
        return;
      }

      const limit = (scale.value - 1) * 260;
      const nextX = savedTranslateX.value + event.translationX;
      const nextY = savedTranslateY.value + event.translationY;
      translateX.value = Math.max(-limit, Math.min(limit, nextX));
      translateY.value = Math.max(-limit, Math.min(limit, nextY));
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        resetZoom();
      } else {
        scale.value = 2;
        savedScale.value = 2;
      }
    });

  const pinchPanGesture = Gesture.Simultaneous(pinchGesture, panGesture);
  const imageGesture = Gesture.Exclusive(doubleTapGesture, pinchPanGesture);

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  const fetchIngredientDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await authorizedFetch(API_ENDPOINTS.shopInventory.getById(Number(id)), {
        headers: { Accept: '*/*' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as ShopInventoryDetail;
      setInventoryDetail(data);
      const nextMinStock = Number(data.minStock ?? 0);
      setManualThresholdText(Number.isFinite(nextMinStock) ? nextMinStock.toFixed(1) : '');
    } catch {
      setError('Failed to load ingredient details');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyChanges = async () => {
    if (!canSetThreshold) {
      Toast.show({
        type: 'error',
        text1: 'Permission denied',
        text2: 'Only owner can update minimum stock.',
      });
      return;
    }

    if (!inventoryDetail || isUpdating) return;

    const parsedManual = parseMinStockInput(manualThresholdText);
    if (parsedManual === null) {
      Toast.show({
        type: 'error',
        text1: 'Invalid threshold',
        text2: 'Minimum stock must be a numeric and non-empty value.',
      });
      return;
    }

    const valueToApply = parsedManual;
    const unitLabel = formatMeasurement(inventoryDetail.measurement);

    try {
      setIsUpdating(true);
      const response = await authorizedFetch(API_ENDPOINTS.shopInventory.update(inventoryDetail.inventoryDetailId), {
        method: 'PUT',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inventoryDetailId: inventoryDetail.inventoryDetailId,
          coffeeShopId: inventoryDetail.coffeeShopId,
          ingredientId: inventoryDetail.ingredientId,
          quantity: inventoryDetail.quantity,
          minStock: valueToApply,
          expirationDate: inventoryDetail.expirationDate,
          measurement: inventoryDetail.measurement,
          ingredient: inventoryDetail.ingredient,
          coffeeShop: inventoryDetail.coffeeShop,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const responseText = await response.text();
      const updated = responseText
        ? (JSON.parse(responseText) as ShopInventoryDetail)
        : { ...inventoryDetail, minStock: valueToApply };

      setInventoryDetail(updated);
      const updatedValue = Number(updated.minStock ?? valueToApply);
      setManualThresholdText(Number.isFinite(updatedValue) ? updatedValue.toFixed(1) : manualThresholdText);
      Toast.show({
        type: 'success',
        text1: 'Minimum stock updated',
        text2: `Minimum stock set to ${valueToApply.toFixed(1)} ${unitLabel}.`,
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: 'Unable to update minimum stock right now.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const statusInfo = useMemo(() => {
    if (!inventoryDetail) return { label: 'UNKNOWN', bg: COLORS.dangerBg, text: COLORS.dangerText };

    const quantity = Number(inventoryDetail.quantity ?? 0);
    const minStock = Number(inventoryDetail.minStock ?? 0);

    if (quantity <= 0) return { label: 'OUT OF STOCK', bg: COLORS.dangerBg, text: COLORS.dangerText };
    if (quantity <= minStock) return { label: 'LOW STOCK', bg: COLORS.warningBg, text: COLORS.warningText };
    return { label: 'IN STOCK', bg: COLORS.successBg, text: COLORS.successText };
  }, [inventoryDetail]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerWrap}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </SafeAreaView>
    );
  }

  if (error || !inventoryDetail) {
    return (
      <SafeAreaView style={styles.centerWrap}>
        <Text style={styles.errorText}>{error || 'Ingredient not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backToListBtn}>
          <Text style={styles.backToListText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const ingredientName = inventoryDetail.ingredient?.name || `Ingredient #${inventoryDetail.inventoryDetailId}`;
  const ingredientImage =
    inventoryDetail.image || inventoryDetail.imageUrl || inventoryDetail.ingredient?.image || null;
  const ingredientCategory = inventoryDetail.ingredient?.category || 'Uncategorized';
  const ingredientEndDate = inventoryDetail.ingredient?.endDate || new Date().toISOString();
  const ingredientCreateDate = inventoryDetail.ingredient?.createDate || null;
  const measurementUnit = formatMeasurement(inventoryDetail.measurement);
  const quantityValue = Number(inventoryDetail.quantity ?? 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ingredient Detail</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.imageWrap}>
            {ingredientImage ? (
              <TouchableOpacity
                activeOpacity={0.92}
                style={styles.imageTouch}
                onPress={() => {
                  resetZoom();
                  setShowImageViewer(true);
                }}
              >
                <Image source={{ uri: ingredientImage }} style={styles.heroImage} resizeMode="cover" />
                <View style={styles.zoomHint}>
                  <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.zoomHintText}>Tap to zoom</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.imageFallback}>
                <Ionicons name="leaf" size={46} color={COLORS.accent} />
              </View>
            )}
          </View>

          <View style={styles.heroBody}>
            <View style={styles.heroTop}>
              <Text style={styles.ingredientName}>{ingredientName}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                <Text style={[styles.statusText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
              </View>
            </View>

            <Text style={styles.categoryText}>{ingredientCategory}</Text>

            <View style={styles.heroMetrics}>
              <View style={styles.metricPill}>
                <Ionicons name="cube-outline" size={14} color={COLORS.accent} />
                <Text style={styles.metricText}>
                  {quantityValue.toFixed(1)} {measurementUnit}
                </Text>
              </View>
              <View style={styles.metricPill}>
                <Ionicons name="warning-outline" size={14} color={COLORS.accent} />
                <Text style={styles.metricText}>
                  Min {Number(inventoryDetail.minStock ?? 0).toFixed(1)} {measurementUnit}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Inventory Information</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Shop</Text>
            <Text style={styles.infoValue}>{inventoryDetail.coffeeShop?.shopName || 'Unknown'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created date</Text>
            <Text style={styles.infoValue}>{formatDate(ingredientCreateDate)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Expiry date</Text>
            <Text style={styles.infoValue}>{formatDate(ingredientEndDate)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Measurement</Text>
            <Text style={styles.infoValue}>{measurementUnit}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Inventory detail ID</Text>
            <Text style={styles.infoValue}>#{inventoryDetail.inventoryDetailId}</Text>
          </View>
        </View>

        {canSetThreshold ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Minimum Stock Level</Text>
            <Text style={styles.helperText}>Set the alert threshold ({measurementUnit}).</Text>

            <View style={styles.thresholdRow}>
              <TextInput
                value={manualThresholdText}
                onChangeText={(value) => setManualThresholdText(value.replace(',', '.'))}
                onBlur={() => {
                  const next = parseMinStockInput(manualThresholdText);
                  if (next !== null) setManualThresholdText(next.toFixed(1));
                }}
                keyboardType="decimal-pad"
                style={[styles.thresholdInput, isThresholdInvalid && styles.thresholdInputInvalid]}
              />
              <TouchableOpacity
                onPress={handleApplyChanges}
                disabled={isUpdating || parsedThresholdValue === null}
                style={[
                  styles.updateBtn,
                  (isUpdating || parsedThresholdValue === null) && styles.updateBtnDisabled,
                ]}
              >
                <Text style={styles.updateBtnText}>{isUpdating ? 'Updating...' : 'Update'}</Text>
              </TouchableOpacity>
            </View>
            {isThresholdInvalid ? (
              <Text style={styles.validationText}>Please enter a valid number (e.g. 5 or 5.5).</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Minimum Stock Level</Text>
            <Text style={styles.readOnlyText}>
              Only owners can update this value. Current minimum stock is{' '}
              <Text style={styles.readOnlyHighlight}>
                {Number(inventoryDetail.minStock ?? 0).toFixed(1)} {measurementUnit}
              </Text>
              .
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showImageViewer}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowImageViewer(false);
          resetZoom();
        }}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.viewerOverlay}>
            <TouchableOpacity
              style={styles.viewerCloseBtn}
              onPress={() => {
                setShowImageViewer(false);
                resetZoom();
              }}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.viewerImageWrap}>
              <GestureDetector gesture={imageGesture}>
                <Animated.Image
                  source={{ uri: ingredientImage || undefined }}
                  resizeMode="contain"
                  style={[styles.viewerImage, animatedImageStyle]}
                />
              </GestureDetector>
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    paddingHorizontal: 20,
  },
  errorText: {
    color: COLORS.text,
    fontSize: 16,
    textAlign: 'center',
  },
  backToListBtn: {
    marginTop: 20,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 26,
    paddingVertical: 11,
    borderRadius: 10,
  },
  backToListText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerPlaceholder: {
    width: 36,
  },
  heroCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 12,
  },
  imageWrap: {
    height: 180,
  },
  imageTouch: {
    width: '100%',
    height: '100%',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomHint: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(31, 31, 31, 0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  zoomHintText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  heroBody: {
    padding: 14,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  ingredientName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  categoryText: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  heroMetrics: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metricText: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '800',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  infoValue: {
    flexShrink: 1,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '700',
    textAlign: 'right',
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thresholdInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: '#FFFDFC',
  },
  thresholdInputInvalid: {
    borderColor: COLORS.dangerText,
  },
  validationText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.dangerText,
  },
  updateBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  updateBtnDisabled: {
    opacity: 0.7,
  },
  updateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  readOnlyText: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  readOnlyHighlight: {
    color: COLORS.text,
    fontWeight: '800',
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerCloseBtn: {
    position: 'absolute',
    top: 52,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  viewerImageWrap: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: '95%',
    height: '75%',
  },
});