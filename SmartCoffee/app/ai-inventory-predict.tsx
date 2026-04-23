import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

type UrgencyLevel = 'Cao' | 'Trung binh' | 'Thap' | string;

interface InventoryPrediction {
  ingredientId: number;
  ingredientName: string;
  currentQuantity: number;
  minStock: number;
  predictedDailyUsage: number;
  suggestedPurchaseQuantity: number;
  measurement: string;
  urgency: UrgencyLevel;
  reason: string;
}

interface InventoryPredictResponse {
  success: boolean;
  coffeeShopId: number;
  daysAnalyzed: number;
  daysToPredict: number;
  inventoryCount: number;
  predictionsCount: number;
  predictions: InventoryPrediction[];
}

const DEFAULT_DAYS_ANALYZE = 30;
const DEFAULT_DAYS_PREDICT = 7;

const COLORS = {
  background: '#F7F2EE',
  card: '#FFFFFF',
  ink: '#1E1B16',
  muted: '#7A6F67',
  accent: '#2B1C15',
  border: '#EFE4D8',
  successBg: '#DCFCE7',
  successText: '#166534',
  warningBg: '#FEF3C7',
  warningText: '#92400E',
  dangerBg: '#FEE2E2',
  dangerText: '#991B1B',
};

const parseNonNegativeNumber = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
};

const sanitizeDayInput = (value: string) => value.replace(/[^\d]/g, '');

const getDayInputError = (value: string, fieldLabel: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return `${fieldLabel} must be numeric.`;
  }

  if (!/^\d+$/.test(trimmed)) {
    return `${fieldLabel} must be numeric.`;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return `${fieldLabel} cannot be negative.`;
  }

  return null;
};

const formatAmount = (value: number) => {
  if (!Number.isFinite(value)) return '-';
  return Number(value.toFixed(2)).toString();
};

const getUrgencyStyle = (urgency: string) => {
  const normalized = urgency.trim().toLowerCase();
  if (normalized === 'cao' || normalized === 'high') {
    return {
      bgColor: COLORS.dangerBg,
      textColor: COLORS.dangerText,
      label: 'High',
    };
  }

  if (normalized === 'trung binh' || normalized === 'medium') {
    return {
      bgColor: COLORS.warningBg,
      textColor: COLORS.warningText,
      label: 'Medium',
    };
  }

  return {
    bgColor: COLORS.successBg,
    textColor: COLORS.successText,
    label: 'Low',
  };
};

export default function AIInventoryPredictScreen() {
  const router = useRouter();
  const recommendationBgImage = require('../assets/AI_RecommendationBackground.jpg');

  const [daysAnalyzeInput, setDaysAnalyzeInput] = useState(String(DEFAULT_DAYS_ANALYZE));
  const [daysPredictInput, setDaysPredictInput] = useState(String(DEFAULT_DAYS_PREDICT));
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InventoryPredictResponse | null>(null);
  const [daysAnalyzeError, setDaysAnalyzeError] = useState<string | null>(null);
  const [daysPredictError, setDaysPredictError] = useState<string | null>(null);

  const requestPayload = useMemo(
    () => ({
      daysToAnalyze: parseNonNegativeNumber(daysAnalyzeInput, DEFAULT_DAYS_ANALYZE),
      daysToPredict: parseNonNegativeNumber(daysPredictInput, DEFAULT_DAYS_PREDICT),
    }),
    [daysAnalyzeInput, daysPredictInput]
  );

  const runPredict = async (isPullToRefresh = false) => {
    const analyzeValidationError = getDayInputError(daysAnalyzeInput, 'Days to Analyze');
    const predictValidationError = getDayInputError(daysPredictInput, 'Days to Predict');

    setDaysAnalyzeError(analyzeValidationError);
    setDaysPredictError(predictValidationError);

    if (analyzeValidationError || predictValidationError) {
      setError(analyzeValidationError || predictValidationError || null);
      return;
    }

    if (isPullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const response = await authorizedFetch(API_ENDPOINTS.ai.predictInventory(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      const text = await response.text();
      let payload: InventoryPredictResponse | null = null;

      if (text) {
        payload = JSON.parse(text) as InventoryPredictResponse;
      }

      if (!response.ok) {
        throw new Error((payload as any)?.message || `Request failed (${response.status}).`);
      }

      if (!payload) {
        throw new Error('No data returned from AI inventory prediction.');
      }

      if (payload.success === false) {
        throw new Error('AI inventory prediction failed.');
      }

      setResult(payload);
    } catch (predictError) {
      const message = predictError instanceof Error ? predictError.message : 'Failed to predict inventory.';
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => runPredict(true)} />}
      >
        <ImageBackground
          source={recommendationBgImage}
          style={styles.header}
          imageStyle={styles.headerImage}
        >
          <View style={styles.headerOverlay} />
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>AI Inventory Predict</Text>
          </View>
          <Text style={styles.headerSubtitle}>Forecast low-stock ingredients and suggested restock quantity.</Text>
        </ImageBackground>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Prediction Settings</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Days to Analyze</Text>
              <TextInput
                value={daysAnalyzeInput}
                onChangeText={(value) => {
                  setDaysAnalyzeInput(sanitizeDayInput(value));
                  setDaysAnalyzeError(null);
                }}
                keyboardType="number-pad"
                style={[styles.input, daysAnalyzeError && styles.inputError]}
                placeholder="30"
                placeholderTextColor={COLORS.muted}
              />
              {daysAnalyzeError ? <Text style={styles.fieldErrorText}>{daysAnalyzeError}</Text> : null}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Days to Predict</Text>
              <TextInput
                value={daysPredictInput}
                onChangeText={(value) => {
                  setDaysPredictInput(sanitizeDayInput(value));
                  setDaysPredictError(null);
                }}
                keyboardType="number-pad"
                style={[styles.input, daysPredictError && styles.inputError]}
                placeholder="7"
                placeholderTextColor={COLORS.muted}
              />
              {daysPredictError ? <Text style={styles.fieldErrorText}>{daysPredictError}</Text> : null}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            disabled={loading}
            onPress={() => runPredict(false)}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Run Prediction</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.dangerText} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {result ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Prediction Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{result.inventoryCount}</Text>
                <Text style={styles.summaryLabel}>Inventory items</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{result.predictionsCount}</Text>
                <Text style={styles.summaryLabel}>Need restock</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{result.daysAnalyzed}</Text>
                <Text style={styles.summaryLabel}>Days analyzed</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{result.daysToPredict}</Text>
                <Text style={styles.summaryLabel}>Days predicted</Text>
              </View>
            </View>
          </View>
        ) : null}

        {result && result.predictions.length > 0 ? (
          <View style={styles.listWrap}>
            {result.predictions.map((item) => {
              const urgencyStyle = getUrgencyStyle(item.urgency);

              return (
                <View key={item.ingredientId} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{item.ingredientName}</Text>
                    <View style={[styles.urgencyPill, { backgroundColor: urgencyStyle.bgColor }]}>
                      <Text style={[styles.urgencyText, { color: urgencyStyle.textColor }]}>{urgencyStyle.label}</Text>
                    </View>
                  </View>

                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Current stock</Text>
                    <Text style={styles.metricValue}>{formatAmount(item.currentQuantity)} {item.measurement}</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Min stock</Text>
                    <Text style={styles.metricValue}>{formatAmount(item.minStock)} {item.measurement}</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Predicted daily usage</Text>
                    <Text style={styles.metricValue}>{formatAmount(item.predictedDailyUsage)} {item.measurement}</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Suggested purchase</Text>
                    <Text style={styles.metricValueStrong}>{formatAmount(item.suggestedPurchaseQuantity)} {item.measurement}</Text>
                  </View>

                  <Text style={styles.reasonText}>{item.reason}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {result && result.predictions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.successText} />
            <Text style={styles.emptyTitle}>Inventory looks healthy</Text>
            <Text style={styles.emptyText}>No ingredients need restock for the selected period.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 28,
  },
  header: {
    height: 190,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  headerImage: {
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    maxWidth: '88%',
    lineHeight: 18,
  },
  formCard: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  formTitle: {
    color: COLORS.ink,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputGroup: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.ink,
    backgroundColor: '#FAF7F3',
  },
  inputError: {
    borderColor: COLORS.dangerText,
  },
  fieldErrorText: {
    marginTop: 4,
    color: COLORS.dangerText,
    fontSize: 11,
  },
  primaryButton: {
    marginTop: 14,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  helperText: {
    marginTop: 10,
    color: COLORS.muted,
    fontSize: 11,
  },
  errorCard: {
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: COLORS.dangerBg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: COLORS.dangerText,
    fontSize: 12,
  },
  summaryCard: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  summaryTitle: {
    color: COLORS.ink,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  summaryItem: {
    width: '50%',
  },
  summaryValue: {
    color: COLORS.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 11,
  },
  listWrap: {
    marginTop: 12,
    marginHorizontal: 16,
    gap: 10,
  },
  itemCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  itemName: {
    flex: 1,
    color: COLORS.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  urgencyPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  metricLabel: {
    color: COLORS.muted,
    fontSize: 12,
  },
  metricValue: {
    color: COLORS.ink,
    fontSize: 12,
    fontWeight: '600',
  },
  metricValueStrong: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  reasonText: {
    marginTop: 4,
    color: '#4E433C',
    fontSize: 12,
    lineHeight: 18,
  },
  emptyCard: {
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: COLORS.successText,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyText: {
    color: '#166534',
    fontSize: 12,
    textAlign: 'center',
  },
});
