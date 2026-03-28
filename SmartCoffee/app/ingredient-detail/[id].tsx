import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

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

const MAX_ZOOM_SCALE = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function IngredientDetailScreen() {
  const isDark = false;
  const { id } = useLocalSearchParams();
  const router = useRouter();

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

  const COLORS = {
    background: '#F6F1EE',
    card: '#FFFFFF',
    ink: '#2B1C15',
    muted: '#8E837B',
    accent: '#5B3B35',
    chip: '#EDE4DE',
    success: '#E5F8E6',
    successText: '#1B7A34',
    border: '#EFE7E1',
  };

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
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const fetchIngredientDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching shop inventory detail for ID:', id);
      const response = await authorizedFetch(API_ENDPOINTS.shopInventory.getById(Number(id)), {
        headers: {
          Accept: '*/*',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = (await response.json()) as ShopInventoryDetail;
      console.log('Shop inventory detail response:', data);
      setInventoryDetail(data);
      const nextMinStock = Number(data.minStock ?? 0);
      setManualThresholdText(Number.isFinite(nextMinStock) ? nextMinStock.toFixed(1) : '');
    } catch (err) {
      console.error('Error fetching ingredient:', err);
      setError('Failed to load ingredient details');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyChanges = async () => {
    if (!inventoryDetail || isUpdating) {
      return;
    }

    const parsedManual = Number.parseFloat(manualThresholdText.replace(',', '.'));
    if (!Number.isFinite(parsedManual)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid threshold',
        text2: 'Please enter a valid number for the manual threshold.',
      });
      return;
    }

    const valueToApply = parsedManual;
    const unitLabel = formatMeasurement(inventoryDetail.measurement);

    try {
      setIsUpdating(true);
      const response = await authorizedFetch(
        API_ENDPOINTS.shopInventory.update(inventoryDetail.inventoryDetailId),
        {
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
        }
      );

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const responseText = await response.text();
      const updated = responseText
        ? (JSON.parse(responseText) as ShopInventoryDetail)
        : {
            ...inventoryDetail,
            minStock: valueToApply,
          };
      setInventoryDetail(updated);
      const updatedValue = Number(updated.minStock ?? valueToApply);
      setManualThresholdText(
        Number.isFinite(updatedValue) ? updatedValue.toFixed(1) : manualThresholdText
      );
      Toast.show({
        type: 'success',
        text1: 'Minimum stock updated',
        text2: `Minimum stock level set to ${valueToApply.toFixed(1)} ${unitLabel}.`,
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: 'Unable to update minimum stock right now.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: COLORS.background,
        }}
      >
        <ActivityIndicator size="large" color="#B87333" />
      </View>
    );
  }

  if (error || !inventoryDetail) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: COLORS.background,
          padding: 20,
        }}
      >
        <Text style={{ color: COLORS.ink, fontSize: 16, textAlign: 'center' }}>
          {error || 'Ingredient not found'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 20,
            backgroundColor: '#B87333',
            paddingHorizontal: 30,
            paddingVertical: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Extract ingredient info with fallbacks
  const ingredientName = inventoryDetail.ingredient?.name || `Ingredient #${inventoryDetail.inventoryDetailId}`;
  const ingredientImage =
    inventoryDetail.image || inventoryDetail.imageUrl || inventoryDetail.ingredient?.image || null;
  const ingredientCategory = inventoryDetail.ingredient?.category || 'Unknown';
  const ingredientEndDate = inventoryDetail.ingredient?.endDate || new Date().toISOString();
  const measurementUnit = formatMeasurement(inventoryDetail.measurement);
  const quantityValue = Number(inventoryDetail.quantity ?? 0);
  const statusLabel = quantityValue > 0 ? 'IN STOCK' : 'OUT OF STOCK';

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: COLORS.background,
          paddingTop: Platform.OS === 'ios' ? 50 : 40,
          paddingBottom: 8,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.ink} />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.ink }}>
          Ingredient Detail
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
        {/* Ingredient Image and Info */}
        <View
          style={{
            backgroundColor: COLORS.card,
            marginTop: 14,
            marginBottom: 12,
            borderRadius: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <View style={{ height: 150, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' }}>
            {ingredientImage ? (
              <TouchableOpacity
                activeOpacity={0.92}
                style={{ width: '100%', height: '100%' }}
                onPress={() => {
                  resetZoom();
                  setShowImageViewer(true);
                }}
              >
                <Image source={{ uri: ingredientImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                <View
                  style={{
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
                  }}
                >
                  <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>Tap to zoom</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1, backgroundColor: COLORS.chip, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="leaf" size={48} color="#B87333" />
              </View>
            )}
          </View>
          <View style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.ink, flex: 1, marginRight: 10 }}>
                {ingredientName}
              </Text>
              <View
                style={{
                  backgroundColor: statusLabel === 'IN STOCK' ? COLORS.success : '#FEE2E2',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: statusLabel === 'IN STOCK' ? COLORS.successText : '#B91C1C',
                    letterSpacing: 0.3,
                  }}
                >
                  {statusLabel}
                </Text>
              </View>
            </View>
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Ionicons name="business-outline" size={14} color={COLORS.muted} />
                <Text style={{ fontSize: 13, color: COLORS.muted, marginLeft: 8 }}>
                  Shop: {inventoryDetail.coffeeShop?.shopName || 'Unknown'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="calendar-outline" size={14} color={COLORS.muted} />
                <Text style={{ fontSize: 13, color: COLORS.muted, marginLeft: 8 }}>
                  Expiry: {new Date(ingredientEndDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Set Minimum Stock Level */}
        <View
          style={{
            backgroundColor: COLORS.card,
            padding: 16,
            marginBottom: 12,
            borderRadius: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: COLORS.muted,
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            Set Minimum Stock Level
          </Text>
          <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>
            Threshold ({measurementUnit})
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              value={manualThresholdText}
              onChangeText={(value) => {
                const normalized = value.replace(',', '.');
                setManualThresholdText(normalized);
              }}
              onBlur={() => {
                const next = Number.parseFloat(manualThresholdText.replace(',', '.'));
                if (Number.isFinite(next)) {
                  setManualThresholdText(next.toFixed(1));
                }
              }}
              keyboardType="decimal-pad"
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 12,
                fontSize: 16,
                color: COLORS.ink,
                marginRight: 10,
              }}
            />
            <TouchableOpacity
              onPress={handleApplyChanges}
              disabled={isUpdating}
              style={{
                backgroundColor: COLORS.accent,
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 10,
                opacity: isUpdating ? 0.7 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                {isUpdating ? 'Updating...' : 'Update'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 20 }} />
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
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <TouchableOpacity
              style={{
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
              }}
              onPress={() => {
                setShowImageViewer(false);
                resetZoom();
              }}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View
              style={{
                width: SCREEN_WIDTH,
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <GestureDetector gesture={imageGesture}>
                <Animated.Image
                  source={{ uri: ingredientImage || undefined }}
                  resizeMode="contain"
                  style={[{ width: '95%', height: '75%' }, animatedImageStyle]}
                />
              </GestureDetector>
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}
