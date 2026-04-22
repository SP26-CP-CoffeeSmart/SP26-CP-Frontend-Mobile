import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useSuggestions, SuggestionItem } from '@/context/suggestion-context';

interface SupplierProductRecommendation {
  productId: number;
  ingredientId: number;
  ingredientName: string;
  currentStock: number;
  minStock: number;
  recommendedProductId: number;
  productDescription?: string | null;
  supplierId: number;
  supplierName?: string | null;
  supplierRating?: number | null;
  productRating?: number | null;
  price: number;
  stock?: number | null;
  holdStock?: number | null;
  packageSize?: number | null;
  measurement?: string | null;
  image?: string | null;
  suggestedQuantity?: number | null;
}

const toArrayPayload = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const candidate = payload as { data?: unknown; items?: unknown; result?: unknown };
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    if (Array.isArray(candidate.items)) return candidate.items as T[];
    if (Array.isArray(candidate.result)) return candidate.result as T[];
  }
  return [];
};

export default function AiLoadingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string;
    message?: string;
    suggestionInputMode?: string;
    numberCupWanted?: string;
    from?: string;
    to?: string;
  }>();
  const { coffeeShopId } = useAuth();
  const { setItems, clear } = useSuggestions();
  const [messageIndex, setMessageIndex] = useState(0);
  const textOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const isForecastErrorMode = params.mode === 'forecast-error';
  const errorModalShownRef = useRef(false);
  const forecastErrorMessage =
    typeof params.message === 'string'
      ? params.message
      : Array.isArray(params.message)
        ? params.message[0]
        : 'Khong the tao recipe theo pricing strategy hien tai.';
  const messages = [
    'AI is creating your results.',
    'Please be patient while we finish the menu.',
  ];

  useEffect(() => {
    if (isForecastErrorMode) {
      return;
    }

    let isMounted = true;

    const runTextCycle = () => {
      textOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.delay(1800),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.delay(200),
      ]).start(({ finished }) => {
        if (!finished || !isMounted) return;
        setMessageIndex((prev) => (prev + 1) % messages.length);
        runTextCycle();
      });
    };

    runTextCycle();

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();

    return () => {
      isMounted = false;
      pulseAnimation.stop();
    };
  }, [isForecastErrorMode, messages.length, pulse, textOpacity]);

  useEffect(() => {
    if (!isForecastErrorMode) {
      return;
    }

    const timeoutId = setTimeout(() => {
      router.back();
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [isForecastErrorMode, router]);

  useEffect(() => {
    if (params.mode !== 'order-suggestions') {
      return;
    }

    let isCancelled = false;

    const runOrderSuggestionsFlow = async () => {
      const MIN_DURATION_MS = 3000;
      const startedAt = Date.now();
      const readParam = (value?: string | string[]) => {
        if (typeof value === 'string') return value.trim();
        if (Array.isArray(value) && typeof value[0] === 'string') {
          return value[0].trim();
        }
        return '';
      };

      const numberCupWanted = readParam(params.numberCupWanted);
      const from = readParam(params.from);
      const to = readParam(params.to);
      const suggestionInputMode = readParam(params.suggestionInputMode).toLowerCase();
      const hasCupInput = numberCupWanted.length > 0;
      const hasDateInput = from.length > 0 && to.length > 0;

      const ensureMinDisplayTime = async () => {
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_DURATION_MS) {
          await new Promise((resolve) => setTimeout(resolve, MIN_DURATION_MS - elapsed));
        }
      };

      const parseErrorMessage = (error: unknown) => {
        if (error instanceof Error && error.message) {
          const trimmed = error.message.trim();
          try {
            const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
            if (typeof parsed?.error === 'string' && parsed.error.trim()) {
              return parsed.error.trim();
            }
            if (typeof parsed?.message === 'string' && parsed.message.trim()) {
              return parsed.message.trim();
            }
          } catch {
            // keep original error text
          }
          return trimmed;
        }
        return 'Unable to load AI purchase suggestions.';
      };

      const showErrorAndGoBack = (message: string) => {
        if (errorModalShownRef.current) return;
        errorModalShownRef.current = true;
        Alert.alert('AI Order Suggestions', message, [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/product-page');
            },
          },
        ]);
      };

      if (!coffeeShopId) {
        if (isCancelled) return;
        clear();
        await ensureMinDisplayTime();
        if (isCancelled) return;
        showErrorAndGoBack('Could not find your coffee shop.');
        return;
      }

      if (!hasCupInput && !hasDateInput) {
        if (isCancelled) return;
        clear();
        await ensureMinDisplayTime();
        if (isCancelled) return;
        showErrorAndGoBack('Missing input. Please provide cups to sell or forecast duration to run AI suggestions.');
        return;
      }

      if (hasCupInput) {
        const parsedCup = Number(numberCupWanted);
        if (!Number.isInteger(parsedCup) || parsedCup < 50) {
          if (isCancelled) return;
          clear();
          await ensureMinDisplayTime();
          if (isCancelled) return;
          showErrorAndGoBack('Estimated cup count must be an integer of at least 50 cups.');
          return;
        }
      }

      if (suggestionInputMode === 'forecast' && !hasDateInput) {
        if (isCancelled) return;
        clear();
        await ensureMinDisplayTime();
        if (isCancelled) return;
        showErrorAndGoBack('Forecast duration is missing. Please choose the forecast range again.');
        return;
      }

      if (suggestionInputMode === 'cups' && !hasCupInput) {
        if (isCancelled) return;
        clear();
        await ensureMinDisplayTime();
        if (isCancelled) return;
        showErrorAndGoBack('Estimated cups to sell is missing. Please enter a valid value.');
        return;
      }

      try {
        const url = API_ENDPOINTS.supplierProduct.recommendationsByShop(coffeeShopId, {
          threshold: 10,
          ...(hasCupInput ? { numberCupWanted: Number(numberCupWanted) } : {}),
          ...(hasDateInput ? { from, to } : {}),
        });
        console.log('[AI Suggestion] GET endpoint:', url);

        const response = await authorizedFetch(url, {
          method: 'GET',
          headers: {
            Accept: '*/*',
          },
        });

        console.log('[AI Suggestion] Response status:', response.status);

        const text = await response.text();
        console.log('[AI Suggestion] Raw response preview:', text.slice(0, 1200));
        if (isCancelled) return;

        if (!response.ok) {
          throw new Error(text || `Request failed (${response.status})`);
        }

        const parsedJson = text ? JSON.parse(text) : [];
        const data = toArrayPayload<SupplierProductRecommendation>(parsedJson);
        console.log('[AI Suggestion] Parsed item count:', data.length);

        const mapped: SuggestionItem[] = data.map(
          (item, index) => {
            const qtyNeeded = Math.max(item.minStock - item.currentStock, 0);
            const shortDescription = (item.productDescription || '').split('\n')[0];
            const image = String(item.image || '').trim();
            const availableStock =
              typeof item.stock === 'number'
                ? Math.max(0, Number(item.stock ?? 0) - Number(item.holdStock ?? 0))
                : null;

            return {
              id: String(item.recommendedProductId || item.ingredientId || index),
              productId: item.productId,
              supplierId: item.supplierId,
              supplierName: item.supplierName ?? null,
              name: item.ingredientName || 'Unknown ingredient',
              image: image || '',
              subtitle: shortDescription || 'Recommended by inventory AI.',
              qtyNeeded,
              productRating:
                typeof item.productRating === 'number' ? item.productRating : undefined,
              timeRange: qtyNeeded > 0 ? 'Need restock' : 'OK',
              rating: Number(item.supplierRating || 0),
              measurement: item.measurement ?? null,
              packageSize: item.packageSize ?? null,
              availableStock,
              suggestedQuantity: item.suggestedQuantity ?? null,
              priceVnd: item.price,
            };
          }
        );

        console.log('[AI Suggestion] Mapped item count:', mapped.length);

        setItems(mapped);

        await ensureMinDisplayTime();
        if (isCancelled) return;

        router.replace({
          pathname: '/ai-order-suggestions',
        });
      } catch (error) {
        if (isCancelled) return;
        clear();
        await ensureMinDisplayTime();
        if (isCancelled) return;
        showErrorAndGoBack(parseErrorMessage(error));
      }
    };

    runOrderSuggestionsFlow();

    return () => {
      isCancelled = true;
    };
  }, [coffeeShopId, params.from, params.mode, params.numberCupWanted, params.to, router]);

  return (
    <View style={styles.root}>
      <View style={styles.centerWrap}>
        <View style={styles.card}>
          <Animated.View
            style={[
              styles.heroImageWrap,
              {
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1.03],
                    }),
                  },
                ],
              },
            ]}>
            <Image
              source={require('../assets/loadingscreenai.png')}
              resizeMode="contain"
              style={styles.heroImage}
            />
          </Animated.View>

          <View style={styles.messageWrap}>
            {isForecastErrorMode ? (
              <View style={styles.errorBlock}>
                <ThemedText style={styles.errorTitle}>Can not create recipe</ThemedText>
                <ThemedText style={styles.errorMessage}>{forecastErrorMessage}</ThemedText>
              </View>
            ) : (
              <Animated.View style={[styles.messageBlock, { opacity: textOpacity }]}>
                <ThemedText
                  style={styles.title}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}>
                  {messages[messageIndex]}
                </ThemedText>
              </Animated.View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2E6DA',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#F2E2D3',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 26,
    shadowColor: '#3D2918',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    maxWidth: 360,
    width: '100%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#E1CDBB',
  },
  heroImageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: 220,
    height: 220,
    alignSelf: 'center',
  },
  messageWrap: {
    minHeight: 54,
    marginTop: 18,
    justifyContent: 'center',
  },
  messageBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  errorBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 6,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: Fonts.rounded,
    color: '#7A2F2F',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B2E1E',
    textAlign: 'center',
  },
  title: {
    fontSize: 15,
    fontFamily: Fonts.rounded,
    color: '#4B2E1E',
    textAlign: 'center',
  },
});
