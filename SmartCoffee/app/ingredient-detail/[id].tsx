import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Switch,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LineChart } from 'react-native-chart-kit';
import shopRecipeIngredientsService, {
  type ShopRecipeIngredient,
} from '@/services/shopRecipeIngredientsService';

interface BatchInfo {
  batchId: string;
  expiryDate: string;
  importDate: string;
  currentWeight: number;
  totalWeight: number;
  remainingPercent: number;
}

export default function IngredientDetailScreen() {
  const isDark = false;
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [ingredient, setIngredient] = useState<ShopRecipeIngredient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minStockLevel, setMinStockLevel] = useState(5.0);
  const [isAutoSuggest, setIsAutoSuggest] = useState(false);
  const [aiSuggestedValue, setAiSuggestedValue] = useState(3.5);

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

  // Mock batch data
  const [batchInfo] = useState<BatchInfo>({
    batchId: 'BPO-202405-01',
    expiryDate: 'Dec 06, 2025',
    importDate: 'Oct 01, 2026',
    currentWeight: 2.5,
    totalWeight: 2.5,
    remainingPercent: 100,
  });

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
      console.log('Fetching ingredient detail for ID:', id);
      const data = await shopRecipeIngredientsService.getById(Number(id));
      console.log('Ingredient detail response:', data);
      setIngredient(data);
    } catch (err) {
      console.error('Error fetching ingredient:', err);
      setError('Failed to load ingredient details');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyChanges = () => {
    // TODO: Implement API call to update minimum stock level
    const valueToApply = isAutoSuggest ? aiSuggestedValue : minStockLevel;
    console.log('Applying minimum stock level:', valueToApply);
    alert(`Minimum stock level set to ${valueToApply.toFixed(1)}kg`);
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

  if (error || !ingredient) {
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
  const ingredientName = ingredient.ingredient?.name || `Ingredient #${ingredient.id}`;
  const ingredientImage = ingredient.ingredient?.image || null;
  const ingredientCategory = ingredient.ingredient?.category || 'Unknown';
  const ingredientEndDate = ingredient.ingredient?.endDate || new Date().toISOString();
  const statusLabel = ingredient.quantity > 0 ? 'IN STOCK' : 'OUT OF STOCK';

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
                  Supplier: Premium Estates Co.
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
          <Text style={{ fontSize: 28, fontWeight: '800', color: COLORS.ink, marginTop: 6 }}>42kg</Text>
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

          <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>Threshold (kg)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              value={(isAutoSuggest ? aiSuggestedValue : minStockLevel).toFixed(1)}
              onChangeText={(value) => {
                const next = Number.parseFloat(value);
                if (Number.isNaN(next)) {
                  return;
                }
                if (isAutoSuggest) {
                  setAiSuggestedValue(next);
                } else {
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
              style={{
                backgroundColor: COLORS.accent,
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Update</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Batch Information */}
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.muted, letterSpacing: 1 }}>
              CURRENT BATCH
            </Text>
            <View style={{ backgroundColor: COLORS.chip, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.ink }}>IN USE</Text>
            </View>
          </View>

          {/* Batch Details */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 12, color: '#9AA1B1', marginBottom: 4 }}>Batch Number</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.ink }}>#{batchInfo.batchId}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 12, color: '#9AA1B1', marginBottom: 4 }}>Import Date</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.ink }}>{batchInfo.importDate}</Text>
            </View>
          </View>

          {/* Weight and Progress */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: '#9AA1B1' }}>Remaining stock</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.ink }}>
                {batchInfo.currentWeight}kg / {batchInfo.totalWeight}kg
              </Text>
            </View>
            <View
              style={{
                height: 8,
                backgroundColor: '#EEF1F5',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${batchInfo.remainingPercent}%`,
                  backgroundColor: COLORS.accent,
                }}
              />
            </View>
          </View>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}
