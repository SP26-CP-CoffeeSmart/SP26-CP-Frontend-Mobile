import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Switch,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LineChart } from 'react-native-chart-kit';

interface Ingredient {
  ingredientId: number;
  name: string;
  image: string;
  category: string;
  createDate: string;
  endDate: string;
}

interface ShopRecipeIngredient {
  id: number;
  quantity: number;
  cost: number;
  ingredient: Ingredient;
}

interface BatchInfo {
  batchId: string;
  expiryDate: string;
  importDate: string;
  currentWeight: number;
  totalWeight: number;
  remainingPercent: number;
}

const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:5080`;
  }

  return Platform.select({
    android: 'http://10.0.2.2:5080',
    ios: 'http://localhost:5080',
    default: 'http://localhost:5080',
  });
};

export default function IngredientDetailScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [ingredient, setIngredient] = useState<ShopRecipeIngredient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minStockLevel, setMinStockLevel] = useState(5.0);
  const [isAutoSuggest, setIsAutoSuggest] = useState(false);
  const [aiSuggestedValue, setAiSuggestedValue] = useState(3.5);

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
      const baseUrl = getApiBaseUrl();
      const response = await axios.get(`${baseUrl}/api/ShopRecipeIngredients/${id}`);
      setIngredient(response.data);
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
          backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
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
          backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
          padding: 20,
        }}
      >
        <Text style={{ color: isDark ? '#fff' : '#000', fontSize: 16, textAlign: 'center' }}>
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

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
          paddingTop: Platform.OS === 'ios' ? 50 : 20,
          paddingBottom: 15,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={24} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
        {/* Ingredient Image and Info */}
        <View
          style={{
            backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
            padding: 16,
            marginTop: 16,
            marginBottom: 12,
            borderRadius: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#3a2a1a',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 15,
              }}
            >
              {ingredient.ingredient.image ? (
                <Image
                  source={{ uri: ingredient.ingredient.image }}
                  style={{ width: 60, height: 60, borderRadius: 30 }}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="leaf" size={40} color="#B87333" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: isDark ? '#fff' : '#000',
                  marginBottom: 5,
                }}
              >
                {ingredient.ingredient.name}
              </Text>
              <Text style={{ fontSize: 14, color: '#888', marginBottom: 3 }}>
                Partner: Local Supplier Inc
              </Text>
              <Text style={{ fontSize: 14, color: '#888' }}>
                Expiry Date: {new Date(ingredient.ingredient.endDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* Usage Forecast */}
        <View
          style={{
            backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: isDark ? '#fff' : '#000' }}>
              Usage Forecast
            </Text>
            <TouchableOpacity>
              <Text style={{ fontSize: 14, color: '#B87333' }}>View Calculation Details</Text>
            </TouchableOpacity>
          </View>
          <LineChart
            data={forecastData}
            width={screenWidth - 64}
            height={180}
            chartConfig={{
              backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
              backgroundGradientFrom: isDark ? '#2a2a2a' : '#ffffff',
              backgroundGradientTo: isDark ? '#2a2a2a' : '#ffffff',
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(184, 115, 51, ${opacity})`,
              labelColor: (opacity = 1) => (isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`),
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: '#B87333',
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
            backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
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
              fontSize: 16,
              fontWeight: '600',
              color: isDark ? '#fff' : '#000',
              marginBottom: 20,
            }}
          >
            Set Minimum Stock Level
          </Text>

          {/* Manual Threshold / AI Auto Suggest */}
          <View style={{ flexDirection: 'row', marginBottom: 20 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ fontSize: 12, color: '#888', marginBottom: 5 }}>
                MANUAL THRESHOLD
              </Text>
              <View
                style={{
                  backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
                  padding: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 24, fontWeight: '600', color: isDark ? '#fff' : '#000' }}>
                  {minStockLevel.toFixed(1)}
                </Text>
              </View>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ fontSize: 12, color: '#888' }}>AI AUTO SUGGEST</Text>
                <Switch
                  value={isAutoSuggest}
                  onValueChange={setIsAutoSuggest}
                  trackColor={{ false: '#767577', true: '#B87333' }}
                  thumbColor={isAutoSuggest ? '#fff' : '#f4f3f4'}
                />
              </View>
              <View
                style={{
                  backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
                  padding: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 24, fontWeight: '600', color: '#B87333' }}>
                  {aiSuggestedValue.toFixed(1)}
                </Text>
              </View>
            </View>
          </View>

          {/* Slider */}
          <View style={{ marginBottom: 20 }}>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={0}
              maximumValue={10}
              value={isAutoSuggest ? aiSuggestedValue : minStockLevel}
              onValueChange={(value) => {
                if (isAutoSuggest) {
                  setAiSuggestedValue(value);
                } else {
                  setMinStockLevel(value);
                }
              }}
              minimumTrackTintColor="#B87333"
              maximumTrackTintColor={isDark ? '#3a3a3a' : '#d0d0d0'}
              thumbTintColor="#B87333"
              disabled={false}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: '#888' }}>0.0</Text>
              <Text style={{ fontSize: 12, color: '#888' }}>10.0</Text>
            </View>
          </View>

          {/* Apply Changes Button */}
          <TouchableOpacity
            onPress={handleApplyChanges}
            style={{
              backgroundColor: '#B87333',
              padding: 15,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Apply Changes</Text>
          </TouchableOpacity>
        </View>

        {/* Batch Information */}
        <View
          style={{
            backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: isDark ? '#fff' : '#000' }}>
              Batch information
            </Text>
            <TouchableOpacity>
              <Text style={{ fontSize: 14, color: '#B87333' }}>view all</Text>
            </TouchableOpacity>
          </View>

          {/* Batch Details */}
          <View style={{ marginBottom: 15 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="cube-outline" size={20} color="#888" />
              <Text style={{ fontSize: 14, color: '#888', marginLeft: 10 }}>Batch id:</Text>
              <Text style={{ fontSize: 14, color: isDark ? '#fff' : '#000', marginLeft: 5, fontWeight: '500' }}>
                {batchInfo.batchId}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="calendar-outline" size={20} color="#888" />
              <Text style={{ fontSize: 14, color: '#888', marginLeft: 10 }}>Expiry date:</Text>
              <Text style={{ fontSize: 14, color: isDark ? '#fff' : '#000', marginLeft: 5, fontWeight: '500' }}>
                {batchInfo.expiryDate}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
              <Ionicons name="arrow-down-circle-outline" size={20} color="#888" />
              <Text style={{ fontSize: 14, color: '#888', marginLeft: 10 }}>Import date:</Text>
              <Text style={{ fontSize: 14, color: isDark ? '#fff' : '#000', marginLeft: 5, fontWeight: '500' }}>
                {batchInfo.importDate}
              </Text>
            </View>
          </View>

          {/* Weight and Progress */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: isDark ? '#fff' : '#000' }}>
                {batchInfo.currentWeight}kg{' '}
                <Text style={{ fontSize: 14, color: '#888', fontWeight: '400' }}>
                  / {batchInfo.totalWeight}kg
                </Text>
              </Text>
              <Text style={{ fontSize: 14, color: '#888' }}>REMAINING: {batchInfo.remainingPercent}%</Text>
            </View>
            <View
              style={{
                height: 8,
                backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${batchInfo.remainingPercent}%`,
                  backgroundColor: '#B87333',
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
