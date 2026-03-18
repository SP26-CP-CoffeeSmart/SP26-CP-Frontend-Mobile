import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LineChart } from 'react-native-chart-kit';
import Toast from 'react-native-toast-message';
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
  ingredient: IngredientInfo | null;
  coffeeShop: CoffeeShopInfo | null;
}

export default function IngredientDetailScreen() {
  const isDark = false;
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [inventoryDetail, setInventoryDetail] = useState<ShopInventoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minStockLevel, setMinStockLevel] = useState(5.0);
  const [isAutoSuggest, setIsAutoSuggest] = useState(false);
  const [aiSuggestedValue, setAiSuggestedValue] = useState(3.5);
  const [isUpdating, setIsUpdating] = useState(false);
  const [manualThresholdText, setManualThresholdText] = useState('');

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

  // Mock usage forecast data
  const forecastData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        data: [2.5, 3.2, 4.1, 3.8, 3.5, 2.9],
        color: (opacity = 1) => `rgba(184, 115, 51, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  useEffect(() => {
    fetchIngredientDetail();
  }, [id]);

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
      setMinStockLevel(nextMinStock);
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
    if (!isAutoSuggest && !Number.isFinite(parsedManual)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid threshold',
        text2: 'Please enter a valid number for the manual threshold.',
      });
      return;
    }

    const valueToApply = isAutoSuggest ? aiSuggestedValue : parsedManual;
    const unitLabel = inventoryDetail.measurement || 'unit';

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
      setMinStockLevel(updatedValue);
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

  const screenWidth = Dimensions.get('window').width;

  // Extract ingredient info with fallbacks
  const ingredientName = inventoryDetail.ingredient?.name || `Ingredient #${inventoryDetail.inventoryDetailId}`;
  const ingredientImage = inventoryDetail.ingredient?.image || null;
  const ingredientCategory = inventoryDetail.ingredient?.category || 'Unknown';
  const ingredientEndDate = inventoryDetail.ingredient?.endDate || new Date().toISOString();
  const measurementUnit = inventoryDetail.measurement || 'unit';
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
              <Image source={{ uri: ingredientImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
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

        {/* Usage Forecast */}
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.muted, letterSpacing: 1 }}>
              USAGE FORECAST
            </Text>
            <Text style={{ fontSize: 12, color: '#9AA1B1' }}>Last 30 days vs Predicted</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: COLORS.ink, marginTop: 6 }}>
            42 {measurementUnit}
          </Text>
          <LineChart
            data={forecastData}
            width={screenWidth - 64}
            height={180}
            chartConfig={{
              backgroundColor: COLORS.card,
              backgroundGradientFrom: COLORS.card,
              backgroundGradientTo: COLORS.card,
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(184, 115, 51, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(154, 161, 177, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: COLORS.accent,
              },
            }}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
          />
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
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#F3ECE7',
              borderRadius: 12,
              padding: 12,
              marginBottom: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: COLORS.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                <Ionicons name="sparkles" size={14} color="#FFFFFF" />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.ink }}>AI Auto-Suggest</Text>
                <Text style={{ fontSize: 12, color: COLORS.muted }}>Optimized based on usage trends</Text>
              </View>
            </View>
            <Switch
              value={isAutoSuggest}
              onValueChange={setIsAutoSuggest}
              trackColor={{ false: '#C9C1BB', true: COLORS.accent }}
              thumbColor="#FFFFFF"
            />
          </View>

          <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>
            Threshold ({measurementUnit})
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              value={isAutoSuggest ? aiSuggestedValue.toFixed(1) : manualThresholdText}
              editable={!isAutoSuggest}
              onChangeText={(value) => {
                const normalized = value.replace(',', '.');
                setManualThresholdText(normalized);
                const next = Number.parseFloat(normalized);
                if (Number.isFinite(next)) {
                  setMinStockLevel(next);
                }
              }}
              onBlur={() => {
                if (isAutoSuggest) {
                  return;
                }
                const next = Number.parseFloat(manualThresholdText.replace(',', '.'));
                if (Number.isFinite(next)) {
                  setManualThresholdText(next.toFixed(1));
                  setMinStockLevel(next);
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
    </View>
  );
}
