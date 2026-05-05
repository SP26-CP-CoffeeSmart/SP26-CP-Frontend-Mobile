import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_ENDPOINTS, AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { isSubscriptionActive, resolveCurrentSubscription } from '@/services/subscriptionResolver';
import { Platform } from 'react-native';
import { useAuth } from '@/context/auth-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SubscriptionGateModal from '@/components/subscription-gate-modal';
import AiWarningModal from '@/components/ai-warning-modal';

const TAGS = ['Bold', 'Smooth', 'Fruity', 'Nutty', 'Caramel', 'Smoky', 'Floral', 'Chocolatey'];
const COFFEE_TYPES = ['Moka', 'Exelsa', 'Culi', 'Liberica', 'Robusta', 'Arabica'];
const ROAST_LEVELS = ['Light', 'Medium', 'Dark'];
const GRIND_LEVELS = ['Coarse', 'Medium', 'Fine', 'Extra Fine'];

const SWEETENERS = ['Sugar', 'Brown-sugar', 'Vanilla-syrup', 'Hazelnut-syrup', 'Caramel-syrup', 'Honey'];
const TOPPINGS = [
  'Pink-salt',
  'Macchiato',
  'Cheese',
  'Cacao',
  'Black-bubble',
  'Coffee-jelly',
  'Latte Art',
  'Caramel Drizzle',
  'Orange Peel',
];
const BREW_METHODS = ['Espresso', 'Pour-over', 'Cold Brew', 'Phin Vietnam', 'Shaker Mix'];
const ICE_RATIOS = ['30%', '50%', '70%'];
const FROTHING_LEVELS = [
  { label: 'Micro-foam', icon: 'local-cafe' },
  { label: 'Airy-foam', icon: 'grain' },
  { label: 'No foam', icon: 'stop-circle' },
];
const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];
const EQUIPMENTS = [
  { label: 'Espresso Machine', icon: 'local-cafe' },
  { label: 'Coffee Grinder', icon: 'build' },
  { label: 'Manual Tools', icon: 'handyman' },
];
const CUP_TYPES = [
  { label: 'Plastic', icon: 'local-drink' },
  { label: 'Glass', icon: 'liquor' },
];
const COLOR_STYLES = ['Black', 'White', 'Iced-crystal', 'Brown', 'Creamy'];
const CATEGORIES = ['Seasonal', 'Signature', 'Special', 'Budget', 'Premium', 'Latte Art', 'Dirty Coffee'];
const NUMBER_OPTIONS = [1, 2, 3];
const PRICING_STRATEGIES = [
  { key: 0, label: 'Budget', range: '20,000 - 40,000 VND' },
  { key: 1, label: 'Moderate', range: '30,000 - 60,000 VND' },
  { key: 2, label: 'Premium', range: '50,000 - 80,000 VND' },
  { key: 3, label: 'Luxury', range: '70,000 - 120,000 VND' },
];

const SLIDER_KEYS = ['Bitterness', 'Sweetness', 'Body', 'Acidity'] as const;
const BEVERAGE_REFRESH_FLAG_KEY = 'beverage:list:refresh:needed';

const getLevelLabel = (value: number) => {
  if (value <= 2) return 'Very Low';
  if (value <= 4) return 'Low';
  if (value <= 6) return 'Medium';
  if (value <= 8) return 'High';
  return 'Very High';
};

export default function AiCreateScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const [profileValues, setProfileValues] = useState({
    Bitterness: 5,
    Sweetness: 8,
    Body: 3,
    Acidity: 2,
  });
  const { coffeeShopId } = useAuth();
  const [beveragesList, setBeveragesList] = useState<Array<{ id: string; name: string; raw: Record<string, any> }>>([]);
  const [beveragesLoading, setBeveragesLoading] = useState(false);
  const [beveragesError, setBeveragesError] = useState<string | null>(null);
  const [selectedBeverageId, setSelectedBeverageId] = useState<string | null>(null);
  const [selectedBeverage, setSelectedBeverage] = useState<Record<string, any> | null>(null);
  const [beverageSelectionError, setBeverageSelectionError] = useState<string | null>(null);

  const [showBeverageModal, setShowBeverageModal] = useState(false);
  const [beverageSearch, setBeverageSearch] = useState('');
  const [beveragePage, setBeveragePage] = useState(1);
  const [beverageHasMore, setBeverageHasMore] = useState(true);
  const [beverageLoadingMore, setBeverageLoadingMore] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('Bold');
  const [coffeeType, setCoffeeType] = useState('Robusta');
  const [roastLevel, setRoastLevel] = useState('Light');
  const [grindLevel, setGrindLevel] = useState('Coarse');
  const [heatLevel] = useState('High');

  const [sweetener, setSweetener] = useState('Sugar');
  const [topping, setTopping] = useState('Pink-salt');
  const [brewMethod, setBrewMethod] = useState('Espresso');
  const [brewTime, setBrewTime] = useState(3);
  const [iceRatio, setIceRatio] = useState('30%');
  const [frothingLevel, setFrothingLevel] = useState('Micro-foam');
  const [difficulty, setDifficulty] = useState('Easy');
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>(
    EQUIPMENTS.map((item) => item.label)
  );
  const [cupType, setCupType] = useState('Plastic');
  const [colorStyle, setColorStyle] = useState('Black');
  const [category, setCategory] = useState('Seasonal');

  const [isUnique, setIsUnique] = useState(false);
  const [subscriptionPackageName, setSubscriptionPackageName] = useState<string | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionModalMessage, setSubscriptionModalMessage] = useState(
    'The shop does not have an active subscription.'
  );
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalTitle, setLimitModalTitle] = useState('Generate failed');
  const [limitModalMessage, setLimitModalMessage] = useState('');
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [showUniqueModal, setShowUniqueModal] = useState(false);
  const [numberOption, setNumberOption] = useState(3);
  const [pricingStrategy, setPricingStrategy] = useState(2);
  const [isLoading, setIsLoading] = useState(false);

  const extractErrorMessage = (raw: unknown) => {
    if (raw instanceof Error) {
      const text = raw.message.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const parsedMessage = parsed?.error ?? parsed?.message;
          if (parsedMessage) return String(parsedMessage);
        } catch {
          // ignore JSON parse error
        }
      }
      return text || 'Request failed.';
    }

    if (typeof raw === 'string') {
      return raw.trim();
    }

    return 'Request failed.';
  };

  const isUsageLimitError = (message: string) => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes('usage limit') ||
      normalized.includes('limit exceeded') ||
      /used\s+\d+\s*\/\s*\d+/i.test(message)
    );
  };

  const isProPlan = subscriptionPackageName?.toLowerCase() === 'pro';

  const fetchBeverages = useCallback(async (isLoadMore = false, page = 1, search = '') => {
    if (!coffeeShopId) return;

    if (isLoadMore) {
      setBeverageLoadingMore(true);
    } else {
      setBeveragesLoading(true);
      setBeverageHasMore(true);
    }
    setBeveragesError(null);

    try {
      const qs = `page=${page}&pageSize=10${search ? `&beverageName=${encodeURIComponent(search)}` : ''}`;
      const response = await authorizedFetch(`${AUTH_BASE_URL}/ShopBeverage/shop/${coffeeShopId}?${qs}`);
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const result = await response.json();
      const rawList: Record<string, any>[] = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.data?.items)
            ? result.data.items
            : Array.isArray(result?.items)
              ? result.items
              : Array.isArray(result?.result)
                ? result.result
                : [];
      
      const totalCount = Number(result?.totalCount ?? result?.total ?? result?.totalItems ?? 0);

      const mapped = rawList.map((item, index) => ({
        id: String(item?.beverageId ?? item?.id ?? index),
        name: String(item?.beverageName ?? item?.name ?? 'Unknown'),
        raw: item ?? {},
      }));

      if (isLoadMore) {
        setBeveragesList((prev) => {
          const newList = [...prev, ...mapped];
          if (totalCount > 0) {
            setBeverageHasMore(newList.length < totalCount);
          } else {
            setBeverageHasMore(mapped.length >= 10);
          }
          return newList;
        });
      } else {
        setBeveragesList(mapped);
        if (totalCount > 0) {
          setBeverageHasMore(mapped.length < totalCount);
        } else {
          setBeverageHasMore(mapped.length >= 10);
        }

        setSelectedBeverageId((prevId) => {
          if (!prevId && !search && mapped.length > 0) {
            setSelectedBeverage(mapped[0].raw);
            return mapped[0].id;
          }
          return prevId;
        });
      }

      setBeveragePage(page);
    } catch (error) {
      setBeveragesError('Failed to load beverages.');
    } finally {
      if (isLoadMore) {
        setBeverageLoadingMore(false);
      } else {
        setBeveragesLoading(false);
      }
    }
  }, [coffeeShopId]);

  const loadMoreBeverages = useCallback(() => {
    if (!beverageHasMore || beverageLoadingMore || beveragesLoading) return;
    fetchBeverages(true, beveragePage + 1, beverageSearch);
  }, [beverageHasMore, beverageLoadingMore, beveragesLoading, beveragePage, beverageSearch, fetchBeverages]);

  // Initial fetch
  useEffect(() => {
    fetchBeverages(false, 1, '');
  }, [fetchBeverages]);

  // Search debounce
  useEffect(() => {
    if (!showBeverageModal) return; // Only search when modal is open
    const delayDebounceFn = setTimeout(() => {
      fetchBeverages(false, 1, beverageSearch);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [beverageSearch, showBeverageModal]);

  useEffect(() => {
    let isMounted = true;

    const fetchSubscription = async () => {
      if (!coffeeShopId) {
        if (isMounted) {
          setSubscriptionPackageName(null);
        }
        return;
      }

      try {
        const response = await authorizedFetch(API_ENDPOINTS.subscription.byShop(coffeeShopId));
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }
        const data = await response.json();
        const resolved = resolveCurrentSubscription(data);
        const name =
          resolved?.package?.name ??
          resolved?.subscriptionPackage?.name ??
          resolved?.packageName ??
          resolved?.name ??
          null;
        const active = resolved ? isSubscriptionActive(resolved) : false;
        if (isMounted) {
          setSubscriptionPackageName(typeof name === 'string' ? name : null);
          setHasActiveSubscription(active);
        }
      } catch (error) {
        if (isMounted) {
          setSubscriptionPackageName(null);
          setHasActiveSubscription(false);
        }
      }
    };

    fetchSubscription();

    return () => {
      isMounted = false;
    };
  }, [coffeeShopId]);

  const ensureActiveSubscription = useCallback(async () => {
    if (checkingSubscription) return false;
    if (!coffeeShopId) {
      setSubscriptionModalMessage('Missing coffee shop information.');
      setShowSubscriptionModal(true);
      return false;
    }

    if (hasActiveSubscription === true) {
      return true;
    }

    try {
      setCheckingSubscription(true);
      const response = await authorizedFetch(API_ENDPOINTS.subscription.byShop(coffeeShopId));
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const data = await response.json();
      const resolved = resolveCurrentSubscription(data);
      const active = resolved ? isSubscriptionActive(resolved) : false;
      setHasActiveSubscription(active);

      if (!active) {
        setSubscriptionModalMessage('The shop does not have an active subscription.');
        setShowSubscriptionModal(true);
      }

      return active;
    } catch {
      setSubscriptionModalMessage('Unable to verify subscription status.');
      setShowSubscriptionModal(true);
      return false;
    } finally {
      setCheckingSubscription(false);
    }
  }, [checkingSubscription, coffeeShopId, hasActiveSubscription]);

  useFocusEffect(
    useCallback(() => {
      const syncOnFocus = async () => {
        try {
          const shouldRefresh = await AsyncStorage.getItem(BEVERAGE_REFRESH_FLAG_KEY);
          if (shouldRefresh === '1') {
            await AsyncStorage.removeItem(BEVERAGE_REFRESH_FLAG_KEY);
            fetchBeverages(false, 1, beverageSearch);
          }
        } catch {
          // Ignore storage errors; still refresh from API.
        }
      };

      syncOnFocus();

      const onBackPress = () => {
        router.replace('/(tabs)/menu');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [fetchBeverages, router])
  );

  const handleSubmit = async () => {
    if (isLoading) return;
    const canProceed = await ensureActiveSubscription();
    if (!canProceed) {
      return;
    }
    if (!selectedBeverageId) {
      setBeverageSelectionError('Please choose a beverage.');
      return;
    }
    setIsLoading(true);
    router.push('/ai-loading');
    const payload = {
      coffeeShopId,
      flavorProfile: {
        bitterness: profileValues.Bitterness,
        sweetness: profileValues.Sweetness,
        body: profileValues.Body,
        acidity: profileValues.Acidity,
      },
      basicInfo: {
        beverageId: Number.parseInt(selectedBeverageId, 10),
        selectedFlavorStyleId: selectedStyle,
      },
      coffeeConfig: {
        selectedCoffeeTypeId: coffeeType,
        selectedRoastLevelId: roastLevel,
        selectedGrindSizeId: grindLevel,
        selectedHeatLevelId: heatLevel,
      },
      ingredients: {
        selectedSweetenerId: sweetener,
        selectedToppingId: topping,
      },
      brewing: {
        selectedMethodId: '',
        brewingTimeMinutes: brewTime,
        selectedIceRatio: Number.parseInt(iceRatio.replace('%', ''), 10) || 0,
        selectedFrothingId: frothingLevel,
        selectedDifficultyId: difficulty,
        selectedEquipmentId: selectedEquipments.length > 0 ? selectedEquipments.join(', ') : '',
      },
      presentation: {
        selectedCupTypeId: cupType,
        selectedColorStyleId: colorStyle,
        selectedCategoryId: category,
      },
      numberOption,
      isUnique,
      pricingStrategy,
    };

    try {
      console.log('AI create payload:', JSON.stringify(payload, null, 2));

      const [createRecipeResponse, forecastSellingPriceResponse] = await Promise.all([
        authorizedFetch(`${AUTH_BASE_URL}/AI/create-unique-ai-recipe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }),
        authorizedFetch(`${AUTH_BASE_URL}/ShopRecipe/forecast-selling-price`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }),
      ]);

      const [createRecipeResponseText, forecastSellingPriceResponseText] = await Promise.all([
        createRecipeResponse.text(),
        forecastSellingPriceResponse.text(),
      ]);

      console.log('[AI recommend] create-unique-ai-recipe status:', createRecipeResponse.status);
      console.log('[AI recommend] create-unique-ai-recipe body:', createRecipeResponseText);
      console.log(
        '[AI recommend] forecast-selling-price status:',
        forecastSellingPriceResponse.status
      );
      console.log('[AI recommend] forecast-selling-price body:', forecastSellingPriceResponseText);

      if (!forecastSellingPriceResponse.ok) {
        throw new Error(
          `Forecast selling price request failed: ${forecastSellingPriceResponse.status}: ${forecastSellingPriceResponseText}`
        );
      }

      const forecastData = forecastSellingPriceResponseText
        ? JSON.parse(forecastSellingPriceResponseText)
        : null;

      console.log('[AI recommend] parsed forecast-selling-price:', forecastData);
      console.log('[AI recommend] forecast code:', forecastData?.code);
      console.log('[AI recommend] forecast canCreateRecipe:', forecastData?.data?.canCreateRecipe);
      console.log('[AI recommend] forecast message:', forecastData?.message);

      const forecastCode = forecastData?.code;

      if (forecastCode === 'FORECAST_NOT_FEASIBLE') {
        console.log('[AI recommend] branch: forecast not feasible, show error on loading and go back');
        router.replace({
          pathname: '/ai-loading',
          params: {
            mode: 'forecast-error',
            message: forecastData?.message ?? 'Khong the tao recipe theo pricing strategy hien tai.',
          },
        });
        return;
      }

      if (forecastCode !== 'FORECAST_FEASIBLE') {
        throw new Error(
          `Unexpected forecast code: ${String(forecastCode)}. Body: ${forecastSellingPriceResponseText}`
        );
      }

      console.log('[AI recommend] branch: forecast feasible, continue loading and create result');

      if (!createRecipeResponse.ok) {
        throw new Error(
          `Create recipe request failed: ${createRecipeResponse.status}: ${createRecipeResponseText}`
        );
      }

      const data = createRecipeResponseText ? JSON.parse(createRecipeResponseText) : null;
      console.log('[AI recommend] branch: go to ai-recommendations with create recipe data');
      console.log('[AI recommend] parsed create-unique-ai-recipe:', data);
      router.replace({
        pathname: '/ai-recommendations',
        params: {
          data: JSON.stringify(data),
          beverageId: selectedBeverageId,
          beverage: selectedBeverage ? JSON.stringify(selectedBeverage) : undefined,
        },
      });
    } catch (error) {
      const message = extractErrorMessage(error);
      if (isUsageLimitError(message)) {
        setLimitModalTitle('Generate failed');
        setLimitModalMessage(message);
        setShowLimitModal(true);
      } else {
        console.error(error);
      }
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const sliderItems = useMemo(
    () =>
      SLIDER_KEYS.map((key) => ({
        key,
        value: profileValues[key],
        label: getLevelLabel(profileValues[key]),
      })),
    [profileValues]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        keyboardVerticalOffset={Platform.select({ ios: 20, android: 0 })}>
        <View style={styles.screenBody}>
          <View style={styles.hero}>
            <Image
              source={require('../../assets/AI_RecommendationBackground.jpg')}
              style={styles.heroImage}
            />
            <View style={styles.heroOverlay} />
            <View style={styles.heroContent}>
              <Pressable onPress={() => router.replace('/(tabs)/menu')} style={styles.backButton}>
                <ThemedText style={styles.backArrow}>←</ThemedText>
              </Pressable>
              <ThemedText style={styles.heroTitle}>AI Recipe Suggestions</ThemedText>
            </View>
          </View>

          <View style={styles.card}>
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <View style={styles.grabber} />
              <ThemedText style={styles.sectionTitle}>What’s your coffee idea ?</ThemedText>

              <ThemedText style={styles.subSectionTitle}>Flavor Profile</ThemedText>
              {sliderItems.map((slider) => (
                <View key={slider.key} style={styles.sliderBlock}>
                  <View style={styles.sliderRow}>
                    <ThemedText style={styles.sliderLabel}>{slider.key}</ThemedText>
                    <ThemedText style={styles.sliderValue}>{slider.label}</ThemedText>
                  </View>
                  <Slider
                    value={slider.value}
                    minimumValue={1}
                    maximumValue={10}
                    step={1}
                    minimumTrackTintColor="#B4632D"
                    maximumTrackTintColor="#E5E5E5"
                    thumbTintColor="#B4632D"
                    onValueChange={(next) =>
                      setProfileValues((prev) => ({
                        ...prev,
                        [slider.key]: next,
                      }))
                    }
                  />
                  <View style={styles.sliderScale}>
                    <ThemedText style={styles.scaleText}>Very Low</ThemedText>
                    <ThemedText style={styles.scaleText}>Medium</ThemedText>
                    <ThemedText style={styles.scaleText}>Very High</ThemedText>
                  </View>
                </View>
              ))}

              <View style={styles.sectionSpacing} />

              <ThemedText style={styles.subSectionTitle}>Beverage</ThemedText>
              <ThemedText style={styles.helperText}>What drink does this recipe make?</ThemedText>
              <Pressable
                style={styles.dropdownSelector}
                onPress={() => setShowBeverageModal(true)}
              >
                <ThemedText
                  style={[
                    styles.dropdownText,
                    !selectedBeverageId && styles.dropdownPlaceholder,
                  ]}
                >
                  {selectedBeverage ? selectedBeverage.name || selectedBeverage.beverageName : 'Select a beverage...'}
                </ThemedText>
                <MaterialIcons name="arrow-drop-down" size={24} color="#8D6E63" />
              </Pressable>
              {beverageSelectionError ? (
                <ThemedText style={styles.beverageErrorText}>{beverageSelectionError}</ThemedText>
              ) : null}

              <View style={styles.sectionSpacing} />

              <ThemedText style={styles.subSectionTitle}>Flavor Style</ThemedText>
              <ThemedText style={styles.helperText}>Please specify a style you enjoy</ThemedText>
              <View style={styles.tags}>
                {TAGS.map((tag) => {
                  const isSelected = tag === selectedStyle;
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => setSelectedStyle(tag)}
                      style={[styles.tag, isSelected && styles.tagSelected]}>
                      <ThemedText style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                        {tag}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.tipRow}>
                <View style={styles.tipIcon}>
                  <ThemedText style={styles.tipIconText}>i</ThemedText>
                </View>
                <ThemedText style={styles.tipText}>
                  An intense flavor profile, often with roasty or smoky notes and a heavy body.
                </ThemedText>
              </View>

              <View style={styles.sectionSpacing} />

              <ThemedText style={styles.subSectionTitle}>Coffee</ThemedText>
              <ThemedText style={styles.helperText}>Determine which kind of coffee and its process</ThemedText>

              <View style={styles.groupHeader}>
                <ThemedText style={styles.groupTitle}>Type</ThemedText>
                <ThemedText style={styles.groupValue}>{coffeeType}</ThemedText>
              </View>
              <View style={styles.tags}>
                {COFFEE_TYPES.map((item) => {
                  const isSelected = item === coffeeType;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setCoffeeType(item)}
                      style={[styles.tag, isSelected && styles.tagSelected]}>
                      <ThemedText style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                        {item}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.groupHeader}>
                <ThemedText style={styles.groupTitle}>Frying</ThemedText>
                <ThemedText style={styles.groupValue}>{roastLevel}</ThemedText>
              </View>
              <View style={styles.tags}>
                {ROAST_LEVELS.map((item) => {
                  const isSelected = item === roastLevel;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setRoastLevel(item)}
                      style={[styles.tag, isSelected && styles.tagSelected]}>
                      <ThemedText style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                        {item}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.groupHeader}>
                <ThemedText style={styles.groupTitle}>Grinding</ThemedText>
                <ThemedText style={styles.groupValue}>{grindLevel}</ThemedText>
              </View>
              <View style={styles.tags}>
                {GRIND_LEVELS.map((item) => {
                  const isSelected = item === grindLevel;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setGrindLevel(item)}
                      style={[styles.tag, isSelected && styles.tagSelected]}>
                      <ThemedText style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                        {item}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.sectionSpacing} />

              <ThemedText style={styles.subSectionTitle}>Sweetener</ThemedText>
              <ThemedText style={styles.helperText}>How do you want your coffee sweet?</ThemedText>
              <View style={styles.groupHeader}>
                <ThemedText style={styles.groupTitle}></ThemedText>
                <ThemedText style={styles.groupValue}>{sweetener}</ThemedText>
              </View>
              <View style={styles.tags}>
                {SWEETENERS.map((item) => {
                  const isSelected = item === sweetener;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setSweetener(item)}
                      style={[styles.tag, isSelected && styles.tagSelected]}>
                      <ThemedText style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                        {item}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.sectionSpacing} />

              <ThemedText style={styles.subSectionTitle}>Topping</ThemedText>
              <ThemedText style={styles.helperText}>Which topping to add to your coffee ?</ThemedText>
              <View style={styles.groupHeader}>
                <ThemedText style={styles.groupTitle}></ThemedText>
                <ThemedText style={styles.groupValue}>{topping}</ThemedText>
              </View>
              <View style={styles.tags}>
                {TOPPINGS.map((item) => {
                  const isSelected = item === topping;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setTopping(item)}
                      style={[styles.tag, isSelected && styles.tagSelected]}>
                      <ThemedText style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                        {item}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.sectionSpacing} />

              <View style={styles.groupHeader}>
                <ThemedText style={styles.groupTitle}>Time</ThemedText>
                <ThemedText style={styles.groupValue}>{brewTime} mins</ThemedText>
              </View>
              <Slider
                value={brewTime}
                minimumValue={0}
                maximumValue={10}
                step={1}
                minimumTrackTintColor="#B4632D"
                maximumTrackTintColor="#E5E5E5"
                thumbTintColor="#B4632D"
                onValueChange={(next) => setBrewTime(next)}
              />
              <View style={styles.sliderScale}>
                <ThemedText style={styles.scaleText}>0 min</ThemedText>
                <ThemedText style={styles.scaleText}>10 mins</ThemedText>
              </View>

              <View style={styles.sectionSpacing} />

              <View style={styles.groupHeader}>
                <ThemedText style={styles.subSectionTitle}>Ice Ratio</ThemedText>
                <ThemedText style={styles.groupValue}>{iceRatio}</ThemedText>
              </View>
              <View style={styles.tags}>
                {ICE_RATIOS.map((item) => {
                  const isSelected = item === iceRatio;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setIceRatio(item)}
                      style={[styles.tag, isSelected && styles.tagSelected]}>
                      <ThemedText style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                        {item}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.sectionSpacing} />

              <View style={styles.groupHeader}>
                <ThemedText style={styles.subSectionTitle}>Frothing Level</ThemedText>
                <ThemedText style={styles.groupValue}>{frothingLevel}</ThemedText>
              </View>
              <View style={styles.cardsRow}>
                {FROTHING_LEVELS.map((item) => {
                  const isSelected = item.label === frothingLevel;
                  return (
                    <Pressable
                      key={item.label}
                      onPress={() => setFrothingLevel(item.label)}
                      style={[styles.iconCard, isSelected && styles.iconCardSelected]}>
                      <MaterialIcons name={item.icon as any} size={26} color={isSelected ? '#6B3E1F' : '#B69A86'} />
                      <ThemedText style={[styles.iconCardText, isSelected && styles.iconCardTextSelected]}>
                        {item.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.sectionSpacing} />

              <View style={styles.groupHeader}>
                <ThemedText style={styles.subSectionTitle}>Difficulty Level</ThemedText>
                <ThemedText style={styles.groupValue}>{difficulty}</ThemedText>
              </View>
              <View style={styles.tags}>
                {DIFFICULTY_LEVELS.map((item) => {
                  const isSelected = item === difficulty;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setDifficulty(item)}
                      style={[styles.tag, isSelected && styles.tagSelected]}>
                      <ThemedText style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                        {item}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.sectionSpacing} />

              <View style={styles.groupHeader}>
                <ThemedText style={styles.subSectionTitle}>Special Equipment</ThemedText>
                <ThemedText style={styles.groupValue} numberOfLines={1}>
                  {selectedEquipments.length > 0 ? selectedEquipments.join(', ') : 'None'}
                </ThemedText>
              </View>
              <View style={styles.cardsRow}>
                {EQUIPMENTS.map((item) => {
                  const isSelected = selectedEquipments.includes(item.label);
                  return (
                    <Pressable
                      key={item.label}
                      onPress={() => {
                        setSelectedEquipments((prev) =>
                          prev.includes(item.label)
                            ? prev.filter((value) => value !== item.label)
                            : [...prev, item.label]
                        );
                      }}
                      style={[styles.iconCard, isSelected && styles.iconCardSelected]}>
                      <MaterialIcons name={item.icon as any} size={26} color={isSelected ? '#6B3E1F' : '#B69A86'} />
                      <ThemedText style={[styles.iconCardText, isSelected && styles.iconCardTextSelected]}>
                        {item.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.sectionSpacing} />

              <View style={styles.groupHeader}>
                <ThemedText style={styles.subSectionTitle}>Cup Type</ThemedText>
                <ThemedText style={styles.groupValue}>{cupType}</ThemedText>
              </View>
              <View style={styles.cardsRow}>
                {CUP_TYPES.map((item) => {
                  const isSelected = item.label === cupType;
                  return (
                    <Pressable
                      key={item.label}
                      onPress={() => setCupType(item.label)}
                      style={[styles.iconCard, isSelected && styles.iconCardSelected]}>
                      <MaterialIcons name={item.icon as any} size={26} color={isSelected ? '#6B3E1F' : '#B69A86'} />
                      <ThemedText style={[styles.iconCardText, isSelected && styles.iconCardTextSelected]}>
                        {item.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.sectionSpacing} />

              <View style={styles.groupHeader}>
                <ThemedText style={styles.subSectionTitle}>Color Style</ThemedText>
                <ThemedText style={styles.groupValue}>{colorStyle}</ThemedText>
              </View>
              <View style={styles.tags}>
                {COLOR_STYLES.map((item) => {
                  const isSelected = item === colorStyle;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setColorStyle(item)}
                      style={[styles.tag, isSelected && styles.tagSelected]}>
                      <ThemedText style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                        {item}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.sectionSpacing} />

              <View style={styles.groupHeader}>
                <ThemedText style={styles.subSectionTitle}>Category</ThemedText>
                <ThemedText style={styles.groupValue}>{category}</ThemedText>
              </View>
              <View style={styles.tags}>
                {CATEGORIES.map((item) => {
                  const isSelected = item === category;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setCategory(item)}
                      style={[styles.tag, isSelected && styles.tagSelected]}>
                      <ThemedText style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                        {item}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.sectionSpacing} />

              <ThemedText style={styles.subSectionTitle}>Number of options</ThemedText>
              <ThemedText style={styles.helperText}>Choose how many recipes to generate</ThemedText>
              <View style={styles.tags}>
                {NUMBER_OPTIONS.map((option) => {
                  const isSelected = option === numberOption;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setNumberOption(option)}
                      style={[styles.optionChip, isSelected && styles.optionChipSelected]}>
                      <ThemedText style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                        {option}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.sectionSpacing} />

              <ThemedText style={styles.subSectionTitle}>Pricing Strategy</ThemedText>
              <ThemedText style={styles.helperText}>Select a pricing tier for the recipe</ThemedText>
              <View style={styles.pricingRow}>
                {PRICING_STRATEGIES.map((option) => {
                  const isSelected = option.key === pricingStrategy;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setPricingStrategy(option.key)}
                      style={[styles.pricingChip, isSelected && styles.pricingChipActive]}>
                      <ThemedText style={[styles.pricingLabel, isSelected && styles.pricingLabelActive]}>
                        {option.label}
                      </ThemedText>
                      <ThemedText style={[styles.pricingRange, isSelected && styles.pricingRangeActive]}>
                        {option.range}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.sectionSpacing} />
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextWrap}>
                  <ThemedText style={styles.subSectionTitle}>Check uniqueness?</ThemedText>
                  <ThemedText style={styles.helperText}>Enable to evaluate recipe uniqueness</ThemedText>
                </View>
                <Switch
                  value={isUnique}
                  onValueChange={(value) => {
                    if (value && !isProPlan) {
                      setShowUniqueModal(true);
                      setIsUnique(false);
                      return;
                    }
                    setIsUnique(value);
                  }}
                  trackColor={{ false: '#E5E5E5', true: '#D9B08C' }}
                  thumbColor={isUnique ? '#6B3E1F' : '#A3A3A3'}
                />
              </View>
              <Modal
                transparent
                visible={showUniqueModal}
                animationType="fade"
                onRequestClose={() => setShowUniqueModal(false)}
              >
                <View style={styles.upgradeModalBackdrop}>
                  <View style={styles.upgradeModalCard}>
                    <ThemedText style={styles.upgradeModalTitle}>Feature locked</ThemedText>
                    <ThemedText style={styles.upgradeModalText}>
                      Tinh nang "Cong thuc doc nhat" chi danh cho goi Pro. Vui long nang cap goi de su dung.
                    </ThemedText>
                    <Pressable
                      style={styles.upgradeModalButton}
                      onPress={() => setShowUniqueModal(false)}
                    >
                      <ThemedText style={styles.upgradeModalButtonText}>Got it</ThemedText>
                    </Pressable>
                  </View>
                </View>
              </Modal>

              <Modal
                transparent
                visible={showBeverageModal}
                animationType="slide"
                onRequestClose={() => setShowBeverageModal(false)}
              >
                <View style={styles.modalBackdrop}>
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <ThemedText style={styles.modalTitle}>Select Beverage</ThemedText>
                      <Pressable onPress={() => setShowBeverageModal(false)} style={styles.modalCloseButton}>
                        <MaterialIcons name="close" size={24} color="#5D4037" />
                      </Pressable>
                    </View>

                    <View style={styles.searchContainer}>
                      <MaterialIcons name="search" size={20} color="#8D6E63" style={styles.searchIcon} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search beverages..."
                        placeholderTextColor="#A1887F"
                        value={beverageSearch}
                        onChangeText={setBeverageSearch}
                      />
                    </View>

                    {beveragesError ? (
                      <View style={styles.modalStateContainer}>
                        <ThemedText style={styles.beverageErrorText}>{beveragesError}</ThemedText>
                      </View>
                    ) : beveragesList.length === 0 && !beveragesLoading ? (
                      <View style={styles.modalStateContainer}>
                        <ThemedText style={styles.beverageStateText}>No beverages found.</ThemedText>
                      </View>
                    ) : (
                      <FlatList
                        data={beveragesList}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                        onEndReached={loadMoreBeverages}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={() => (
                          <View style={styles.listFooter}>
                            {beveragesLoading || beverageLoadingMore ? (
                              <ActivityIndicator size="small" color="#B4632D" />
                            ) : !beverageHasMore && beveragesList.length > 0 ? (
                              <ThemedText style={styles.endOfListText}>No more beverages</ThemedText>
                            ) : null}
                          </View>
                        )}
                        renderItem={({ item }) => {
                          const isSelected = item.id === selectedBeverageId;
                          return (
                            <Pressable
                              style={[
                                styles.listItem,
                                isSelected && styles.listItemSelected
                              ]}
                              onPress={() => {
                                setSelectedBeverageId(item.id);
                                setSelectedBeverage(item.raw ?? null);
                                setBeverageSelectionError(null);
                                setShowBeverageModal(false);
                              }}
                            >
                              <ThemedText style={[
                                styles.listItemText,
                                isSelected && styles.listItemTextSelected
                              ]}>
                                {item.name}
                              </ThemedText>
                              {isSelected && (
                                <MaterialIcons name="check" size={20} color="#FFFFFF" />
                              )}
                            </Pressable>
                          );
                        }}
                      />
                    )}
                  </View>
                </View>
              </Modal>
              <Pressable
                style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isLoading}>
                <ThemedText style={styles.submitButtonText}>AI Recommend Recipe</ThemedText>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
      <SubscriptionGateModal
        visible={showSubscriptionModal}
        message={subscriptionModalMessage}
        onClose={() => setShowSubscriptionModal(false)}
      />
      <AiWarningModal
        visible={showLimitModal}
        title={limitModalTitle}
        message={limitModalMessage}
        onClose={() => setShowLimitModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screenBody: {
    flex: 1,
    backgroundColor: '#F9F5F2',
  },
  hero: {
    height: 210,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(33, 19, 10, 0.55)',
  },
  heroContent: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backArrow: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  heroTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    flex: 1,
    marginRight: 20,
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    paddingBottom: 40,
  },
  card: {
    marginTop: -36,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    flex: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 4,
  },
  grabber: {
    alignSelf: 'center',
    width: 46,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#DADADA',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.rounded,
    color: '#1F2937',
    marginBottom: 14,
  },
  subSectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.rounded,
    color: '#1F2937',
    marginBottom: 6,
  },
  helperText: {
    fontSize: 12,
    color: '#7C7C7C',
    marginBottom: 10,
  },
  sliderBlock: {
    marginBottom: 14,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sliderLabel: {
    fontSize: 13,
    color: '#2D2D2D',
  },
  sliderValue: {
    fontSize: 12,
    color: '#B4632D',
  },
  sliderScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  scaleText: {
    fontSize: 10,
    color: '#8A8A8A',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E4D6C9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  beverageStateText: {
    fontSize: 12,
    color: '#7C7C7C',
  },
  beverageOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  beverageOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8C3B4',
    backgroundColor: '#FFFFFF',
  },
  beverageOptionSelected: {
    backgroundColor: '#6B3E1F',
    borderColor: '#6B3E1F',
  },
  beverageOptionText: {
    fontSize: 12,
    color: '#6B3E1F',
  },
  beverageOptionTextSelected: {
    color: '#FFFFFF',
  },
  beverageErrorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#B0412C',
  },
  submitButton: {
    marginTop: 18,
    backgroundColor: '#6B3E1F',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  upgradeModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 17, 17, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  upgradeModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E6D6C8',
  },
  upgradeModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3C2A21',
    marginBottom: 8,
  },
  upgradeModalText: {
    fontSize: 13,
    color: '#6B4D35',
    lineHeight: 18,
    marginBottom: 14,
  },
  upgradeModalButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#6B3E1F',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  upgradeModalButtonText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#FFF',
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E5D5C5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownText: {
    fontWeight: '500',
    fontSize: 14,
    color: '#3E2723',
  },
  dropdownPlaceholder: {
    color: '#A1887F',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '75%',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  modalTitle: {
    fontWeight: '600',
    fontSize: 18,
    color: '#3E2723',
  },
  modalCloseButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFEBE9',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#3E2723',
    paddingVertical: 10,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    borderRadius: 6,
  },
  listItemSelected: {
    backgroundColor: '#B4632D',
    borderBottomColor: 'transparent',
  },
  listItemText: {
    fontWeight: '500',
    fontSize: 15,
    color: '#5D4037',
  },
  listItemTextSelected: {
    color: '#FFFFFF',
  },
  modalStateContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
  },
  listFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endOfListText: {
    fontSize: 12,
    color: '#A1887F',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Fonts.rounded,
  },
  sectionSpacing: {
    height: 14,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  pricingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pricingChip: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E7D8CB',
    backgroundColor: '#FFFFFF',
    minWidth: 140,
  },
  pricingChipActive: {
    backgroundColor: '#6B3E1F',
    borderColor: '#6B3E1F',
  },
  pricingLabel: {
    fontSize: 12,
    color: '#6B3E1F',
    fontFamily: Fonts.rounded,
  },
  pricingLabelActive: {
    color: '#FFFFFF',
  },
  pricingRange: {
    fontSize: 10,
    color: '#8A7B70',
    marginTop: 2,
  },
  pricingRangeActive: {
    color: '#F5E8DD',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleTextWrap: {
    flex: 1,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  groupTitle: {
    fontSize: 12,
    color: '#2D2D2D',
  },
  groupValue: {
    fontSize: 12,
    color: '#B4632D',
    flexShrink: 1,
    maxWidth: '58%',
    textAlign: 'right',
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8C3B4',
  },
  tagSelected: {
    backgroundColor: '#6B3E1F',
    borderColor: '#6B3E1F',
  },
  tagText: {
    fontSize: 12,
    color: '#6B3E1F',
  },
  tagTextSelected: {
    color: '#FFFFFF',
  },
  optionChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8C3B4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionChipSelected: {
    backgroundColor: '#6B3E1F',
    borderColor: '#6B3E1F',
  },
  optionText: {
    fontSize: 14,
    color: '#6B3E1F',
    fontFamily: Fonts.rounded,
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  iconCard: {
    width: 96,
    borderWidth: 1,
    borderColor: '#D8C3B4',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  iconCardSelected: {
    borderColor: '#6B3E1F',
    borderWidth: 2,
  },
  iconCardText: {
    fontSize: 11,
    color: '#6B3E1F',
    textAlign: 'center',
  },
  iconCardTextSelected: {
    fontFamily: Fonts.rounded,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#D8C3B4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipIconText: {
    fontSize: 12,
    color: '#6B3E1F',
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    color: '#7C7C7C',
    lineHeight: 16,
  },
});
