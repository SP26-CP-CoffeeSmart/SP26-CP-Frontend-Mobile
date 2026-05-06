import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  Switch,
  ActivityIndicator,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';

const palette = {
  background: '#FBF7F2',
  card: '#FFFFFF',
  ink: '#1F1A17',
  muted: '#9B9289',
  line: '#E9E1D8',
  accent: '#6F4A3D',
  accentSoft: '#F4EDE6',
  accentDeep: '#5B3B30',
  green: '#E6F6EA',
  greenText: '#2F7D4A',
};

const MAX_RECIPE_NAME_LENGTH = 32;
const MAX_PRICE_VALUE = 10000000;
const MAX_PREP_MINUTES = 60;
const MAX_SUGGESTED_OCCASIONS_LENGTH = 32;
const MAX_STEP_TITLE_LENGTH = 32;
const MAX_STEP_BODY_LENGTH = 1000;
const MAX_INGREDIENT_QUANTITY = 9999;

type IngredientItem = {
  ingredientId: number;
  name: string;
  note: string;
  amount: string;
  measurement: string;
  averagePrice?: number | null;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  iconColor: string;
};

type StepItem = {
  title: string;
  body: string;
};

type BeverageOption = {
  id: number;
  name: string;
};

type IngredientOption = {
  id: number;
  name: string;
  category?: string;
};

const categories = ['Coffee', 'Tea', 'Mocktail', 'Chocolate'];
const primaryStyles = ['Sweet', 'Nutty', 'Fruity', 'Floral'];
const secondaryStyles = ['Creamy', 'Spicy', 'Citrus', 'Smooth'];
const difficulties = ['Beginner', 'Intermediate', 'Advanced'];
const brewingMethods = ['Espresso Machine', 'Pour Over', 'French Press', 'Cold Brew'];
const measurementOptions = ['g', 'ml'];
const INGREDIENT_PAGE_SIZE = 20;

const resolveIngredientMeasurementOptions = (category?: string): string[] => {
  const normalized = String(category ?? '').trim().toLowerCase();

  if (normalized.includes('liquid')) {
    return ['ml'];
  }

  if (normalized.includes('dry')) {
    return ['g'];
  }

  // Fallback: if category is unknown, keep both options.
  return measurementOptions;
};

const extractAveragePrice = (payload: any): number | null => {
  const queue: unknown[] = [payload];

  while (queue.length > 0) {
    const candidate = queue.shift();

    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }

    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        queue.push(item);
      }
      continue;
    }

    if (candidate && typeof candidate === 'object') {
      const obj = candidate as Record<string, unknown>;
      const fields = [
        obj.averagePrice,
        obj.avgPrice,
        obj.price,
        obj.cost,
        obj.totalCost,
        obj.calculatedPrice,
      ];

      for (const field of fields) {
        const num = Number(field);
        if (Number.isFinite(num)) {
          return num;
        }
      }

      queue.push(obj.data, obj.result, obj.item, obj.items);
    }
  }

  return null;
};

const mapListPayload = <T extends unknown>(payload: any): { items: T[]; totalCount: number } => {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : [];
  const totalCount = Number(payload?.totalCount ?? payload?.total ?? payload?.totalItems ?? items.length);
  return {
    items: items as T[],
    totalCount: Number.isFinite(totalCount) ? totalCount : items.length,
  };
};

const getUploadFileInfo = (uri: string) => {
  const cleanUri = uri.split('?')[0];
  const namePart = cleanUri.split('/').pop() || `recipe_${Date.now()}`;
  const ext = namePart.includes('.') ? namePart.split('.').pop() : '';
  const lowerExt = String(ext).toLowerCase();
  const mimeType =
    lowerExt === 'jpg' || lowerExt === 'jpeg'
      ? 'image/jpeg'
      : lowerExt === 'png'
        ? 'image/png'
        : lowerExt === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
  const fileName = namePart.includes('.') ? namePart : `${namePart}.jpg`;
  return { fileName, mimeType };
};

const parseCreatedRecipeId = (payload: any) => {
  const candidate = Number(
    payload?.recipeId ??
      payload?.id ??
      payload?.shopRecipeId ??
      payload?.data?.recipeId ??
      payload?.data?.id ??
      0
  );
  return Number.isFinite(candidate) && candidate > 0 ? candidate : null;
};

export default function CreateRecipeScreen() {
  const router = useRouter();
  const { coffeeShopId } = useAuth();
  const scrollRef = React.useRef<ScrollView | null>(null);

  const [coverImageUri, setCoverImageUri] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [beverageOptions, setBeverageOptions] = useState<BeverageOption[]>([]);
  const [selectedBeverageId, setSelectedBeverageId] = useState<number | null>(null);

  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [secondaryIndex, setSecondaryIndex] = useState(0);
  const [notes, setNotes] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  const [isHot, setIsHot] = useState(false);
  const [isIce, setIsIce] = useState(false);
  const [isCold, setIsCold] = useState(false);
  const [isMilk, setIsMilk] = useState(false);

  const [strength, setStrength] = useState(0.72);
  const [price, setPrice] = useState('');
  const [difficultyIndex, setDifficultyIndex] = useState(0);
  const [prepMin, setPrepMin] = useState('');
  const [prepMax, setPrepMax] = useState('');
  const [prepTimeError, setPrepTimeError] = useState('');
  const [suggestedOccasions, setSuggestedOccasions] = useState('');

  const [ingredientOptions, setIngredientOptions] = useState<IngredientOption[]>([]);
  const [ingredientPage, setIngredientPage] = useState(0);
  const [ingredientHasMore, setIngredientHasMore] = useState(true);
  const [loadingIngredientMore, setLoadingIngredientMore] = useState(false);
  const [ingredientSearchKeyword, setIngredientSearchKeyword] = useState('');
  const [ingredientSearchDebounced, setIngredientSearchDebounced] = useState('');

  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [showIngredientInput, setShowIngredientInput] = useState(false);
  const [selectedIngredientId, setSelectedIngredientId] = useState<number | null>(null);
  const [ingredientDraft, setIngredientDraft] = useState({ quantity: '', measurement: 'g' });
  const [ingredientError, setIngredientError] = useState('');
  const [showBeverageDropdown, setShowBeverageDropdown] = useState(false);
  const [showIngredientDropdown, setShowIngredientDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showPrimaryStyleDropdown, setShowPrimaryStyleDropdown] = useState(false);
  const [showDifficultyDropdown, setShowDifficultyDropdown] = useState(false);
  const [showBrewingMethodDropdown, setShowBrewingMethodDropdown] = useState(false);
  const [showSecondaryStyleDropdown, setShowSecondaryStyleDropdown] = useState(false);

  const [brewIndex, setBrewIndex] = useState(0);
  const [steps, setSteps] = useState<StepItem[]>([
    {
      title: 'Prepare ingredients',
      body: 'Measure all ingredients and get tools ready.',
    },
  ]);
  const [showStepInput, setShowStepInput] = useState(false);
  const [stepDraft, setStepDraft] = useState({ title: '', body: '' });

  const [loadingInit, setLoadingInit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const clampNumberInput = (value: string, maxValue: number) => {
    const digits = value.replace(/[^0-9]/g, '');
    if (!digits) return '';
    const parsed = Number(digits);
    if (!Number.isFinite(parsed)) return '';
    return String(Math.min(parsed, maxValue));
  };

  const clampPrepInput = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '');
    if (!digits) return '';
    let parsed = Number(digits);
    if (!Number.isFinite(parsed)) return '';
    parsed = Math.min(parsed, MAX_PREP_MINUTES);
    return String(parsed);
  };

  const validatePrepTime = () => {
    if (!prepMin.trim() || !prepMax.trim()) {
      setPrepTimeError('');
      return true;
    }

    const minValue = Number(prepMin);
    const maxValue = Number(prepMax);
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      setPrepTimeError('Prep time must be a number.');
      return false;
    }

    if (minValue >= maxValue) {
      setPrepTimeError('Prep time min must be less than max.');
      return false;
    }

    setPrepTimeError('');
    return true;
  };

  const handleStepInputFocus = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const strengthLabel = useMemo(() => {
    if (strength < 0.33) return 'Decaf';
    if (strength < 0.66) return 'Regular';
    return 'High';
  }, [strength]);

  const currentBeverageName = useMemo(() => {
    const target = beverageOptions.find((item) => item.id === selectedBeverageId);
    return target?.name ?? 'No beverage available';
  }, [beverageOptions, selectedBeverageId]);

  const currentIngredientName = useMemo(() => {
    const target = ingredientOptions.find((item) => item.id === selectedIngredientId);
    return target?.name ?? 'No ingredient available';
  }, [ingredientOptions, selectedIngredientId]);

  const selectedIngredientOption = useMemo(
    () => ingredientOptions.find((item) => item.id === selectedIngredientId),
    [ingredientOptions, selectedIngredientId]
  );

  const allowedMeasurementOptions = useMemo(
    () => resolveIngredientMeasurementOptions(selectedIngredientOption?.category),
    [selectedIngredientOption?.category]
  );

  const totalIngredientAveragePrice = useMemo(
    () => ingredients.reduce((sum, item) => sum + (Number(item.averagePrice) || 0), 0),
    [ingredients]
  );

  const calculatedProfitMarginPercent = useMemo(() => {
    const sellingPrice = Number(price);
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      return null;
    }

    return ((sellingPrice - totalIngredientAveragePrice) / sellingPrice) * 100;
  }, [price, totalIngredientAveragePrice]);

  const calculatedProfitMarginLabel = useMemo(() => {
    if (calculatedProfitMarginPercent === null || !Number.isFinite(calculatedProfitMarginPercent)) {
      return '--';
    }

    return `${calculatedProfitMarginPercent.toFixed(1)}%`;
  }, [calculatedProfitMarginPercent]);

  const fetchBeverages = useCallback(async () => {
    if (!coffeeShopId) {
      setBeverageOptions([]);
      setSelectedBeverageId(null);
      return;
    }

    const response = await authorizedFetch(
      `${API_ENDPOINTS.shopBeverage.getByShop(coffeeShopId)}?page=1&pageSize=100`,
      { headers: { Accept: '*/*' } }
    );

    if (!response.ok) {
      throw new Error(`Load beverages failed (${response.status})`);
    }

    const payload = await response.json();
    const { items } = mapListPayload<any>(payload);
    const mapped = items
      .map((item) => {
        const id = Number(item?.beverageId ?? item?.id ?? 0);
        const name = String(item?.name ?? item?.beverageName ?? '').trim();
        return { id, name } as BeverageOption;
      })
      .filter((item) => item.id > 0 && item.name.length > 0);

    setBeverageOptions(mapped);
    setSelectedBeverageId((prev) => prev ?? mapped[0]?.id ?? null);
  }, [coffeeShopId]);

  const fetchIngredientPage = useCallback(async (page: number, searchByName?: string) => {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(INGREDIENT_PAGE_SIZE),
    });

    const trimmedKeyword = String(searchByName ?? '').trim();
    if (trimmedKeyword) {
      query.set('name', trimmedKeyword);
    }

    const response = await authorizedFetch(
      `${API_ENDPOINTS.ingredient.getAll()}?${query.toString()}`,
      { headers: { Accept: '*/*' } }
    );

    if (!response.ok) {
      throw new Error(`Load ingredients failed (${response.status})`);
    }

    const payload = await response.json();
    const { items, totalCount } = mapListPayload<any>(payload);
    const mapped = items
      .map((item) => {
        const id = Number(item?.ingredientId ?? item?.id ?? 0);
        const name = String(item?.name ?? item?.ingredientName ?? '').trim();
        const category = String(item?.category ?? item?.ingredientCategory ?? '').trim();
        return { id, name, category } as IngredientOption;
      })
      .filter((item) => item.id > 0 && item.name.length > 0);

    return { mapped, totalCount };
  }, []);

  const loadInitialIngredients = useCallback(async (searchByName = '') => {
    const { mapped, totalCount } = await fetchIngredientPage(1, searchByName);
    setIngredientOptions(mapped);
    setSelectedIngredientId((prev) => {
      if (prev && mapped.some((item) => item.id === prev)) return prev;
      return mapped[0]?.id ?? null;
    });
    setIngredientPage(1);
    setIngredientHasMore(mapped.length < totalCount);
  }, [fetchIngredientPage]);

  const loadMoreIngredients = useCallback(async () => {
    if (!ingredientHasMore || loadingIngredientMore) return;

    try {
      setLoadingIngredientMore(true);
      const nextPage = ingredientPage + 1;
      const { mapped, totalCount } = await fetchIngredientPage(nextPage, ingredientSearchDebounced);
      let loadedCount = 0;
      setIngredientOptions((prev) => {
        const dedup = new Map<number, IngredientOption>();
        for (const item of [...prev, ...mapped]) dedup.set(item.id, item);
        const next = Array.from(dedup.values());
        loadedCount = next.length;
        return next;
      });
      setIngredientPage(nextPage);
      setIngredientHasMore(loadedCount < totalCount && mapped.length > 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load more ingredients.';
      Toast.show({ type: 'error', text1: 'Ingredient', text2: message });
    } finally {
      setLoadingIngredientMore(false);
    }
  }, [fetchIngredientPage, ingredientHasMore, ingredientPage, ingredientSearchDebounced, loadingIngredientMore]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIngredientSearchDebounced(ingredientSearchKeyword);
    }, 350);

    return () => clearTimeout(timeout);
  }, [ingredientSearchKeyword]);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        setLoadingInit(true);
        await Promise.all([fetchBeverages(), loadInitialIngredients()]);
      } catch (error) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : 'Unable to load data.';
        Toast.show({ type: 'error', text1: 'Create recipe', text2: message });
      } finally {
        if (mounted) setLoadingInit(false);
      }
    };

    hydrate();
    return () => {
      mounted = false;
    };
  }, [fetchBeverages, loadInitialIngredients]);

  useEffect(() => {
    if (loadingInit) return;

    const run = async () => {
      try {
        await loadInitialIngredients(ingredientSearchDebounced);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to search ingredients.';
        Toast.show({ type: 'error', text1: 'Ingredient search', text2: message });
      }
    };

    run();
  }, [ingredientSearchDebounced, loadInitialIngredients, loadingInit]);

  const ensureMediaLibraryPermission = useCallback(async () => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (current.granted) {
      return true;
    }

    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (requested.granted) {
      return true;
    }

    if (requested.canAskAgain === false) {
      Alert.alert(
        'Permission required',
        'Please allow photo library access in Settings to set recipe image.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              Linking.openSettings();
            },
          },
        ]
      );
    }

    return false;
  }, []);

  const handlePickCoverImage = async () => {
    const granted = await ensureMediaLibraryPermission();
    if (!granted) {
      Toast.show({ type: 'info', text1: 'Permission required', text2: 'Please allow photo access.' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    setCoverImageUri(result.assets[0].uri);
  };

  const handleAddNote = () => {
    const trimmed = noteDraft.trim();
    if (!trimmed) return;
    setNotes((prev) => [...prev, trimmed]);
    setNoteDraft('');
    setShowNoteInput(false);
  };

  const handleAddIngredient = async () => {
    if (!selectedIngredientId) {
      setIngredientError('Please select an ingredient.');
      Toast.show({ type: 'error', text1: 'Ingredient required' });
      return;
    }

    const quantity = Number(ingredientDraft.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setIngredientError('Quantity must be greater than 0.');
      Toast.show({ type: 'error', text1: 'Quantity must be greater than 0' });
      return;
    }
    if (quantity > MAX_INGREDIENT_QUANTITY) {
      setIngredientError(`Quantity must not exceed ${MAX_INGREDIENT_QUANTITY}.`);
      Toast.show({ type: 'error', text1: `Quantity must not exceed ${MAX_INGREDIENT_QUANTITY}` });
      return;
    }

    const ingredientName = ingredientOptions.find((item) => item.id === selectedIngredientId)?.name;
    const measurement =
      allowedMeasurementOptions.includes(ingredientDraft.measurement)
        ? ingredientDraft.measurement
        : allowedMeasurementOptions[0] ?? 'g';

    let averagePrice: number | null = null;

    try {
      const averagePayload = [
        {
          ingredientId: selectedIngredientId,
          quantity,
          measurement,
        },
      ];

      console.log('[Create Recipe] average-price payload:', JSON.stringify(averagePayload, null, 2));

      const averageResponse = await authorizedFetch(API_ENDPOINTS.supplierProduct.averagePriceByIngredients(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(averagePayload),
      });

      const averageText = await averageResponse.text();
      console.log('[Create Recipe] average-price status:', averageResponse.status);
      console.log('[Create Recipe] average-price body:', averageText);

      if (!averageResponse.ok) {
        throw new Error(averageText || `Request failed: ${averageResponse.status}`);
      }

      let averageData: any = null;
      try {
        averageData = averageText ? JSON.parse(averageText) : null;
      } catch {
        const asNumber = Number(averageText);
        averageData = Number.isFinite(asNumber) ? asNumber : averageText;
      }

      averagePrice = extractAveragePrice(averageData);

      if (averagePrice !== null) {
        Toast.show({
          type: 'success',
          text1: 'Average price calculated',
          text2: `${averagePrice.toLocaleString('vi-VN')} VND`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to calculate average price.';
      Toast.show({ type: 'error', text1: 'Average price error', text2: message });
    }

    setIngredients((prev) => {
      const existingIndex = prev.findIndex((item) => item.ingredientId === selectedIngredientId);
      const nextItem: IngredientItem = {
        ingredientId: selectedIngredientId,
        name: ingredientName || `Ingredient #${selectedIngredientId}`,
        note: averagePrice !== null ? `Avg: ${averagePrice.toLocaleString('vi-VN')} VND` : 'Avg price unavailable',
        amount: String(quantity),
        measurement,
        averagePrice,
        icon: 'nutrition',
        tint: '#F3EFEA',
        iconColor: palette.accent,
      };

      if (existingIndex >= 0) {
        return prev.map((item, index) => (index === existingIndex ? nextItem : item));
      }

      return [...prev, nextItem];
    });

    setIngredientDraft({ quantity: '', measurement: 'g' });
    setIngredientError('');
    setShowIngredientInput(false);
  };

  useEffect(() => {
    if (!showIngredientInput) return;

    if (!allowedMeasurementOptions.includes(ingredientDraft.measurement)) {
      setIngredientDraft((prev) => ({
        ...prev,
        measurement: allowedMeasurementOptions[0] ?? 'g',
      }));
    }
  }, [allowedMeasurementOptions, ingredientDraft.measurement, showIngredientInput]);

  const handleToggleHot = (next: boolean) => {
    setIsHot(next);
    if (next) {
      setIsCold(false);
      setIsIce(false);
    }
  };

  const handleToggleCold = (next: boolean) => {
    if (!next && isIce) {
      setIsCold(true);
      return;
    }

    setIsCold(next);
    if (next) {
      setIsHot(false);
    }
  };

  const handleToggleIce = (next: boolean) => {
    setIsIce(next);
    if (next) {
      setIsHot(false);
      setIsCold(true);
    }
  };

  const handleAddStep = () => {
    const title = stepDraft.title.trim();
    const body = stepDraft.body.trim();
    if (!title || !body) return;
    setSteps((prev) => [...prev, { title, body }]);
    setStepDraft({ title: '', body: '' });
    setShowStepInput(false);
  };

  const handleRemoveStep = (targetIndex: number) => {
    setSteps((prev) => prev.filter((_, index) => index !== targetIndex));
  };

  const handleIngredientDropdownScroll = (event: any) => {
    if (!ingredientHasMore || loadingIngredientMore) return;

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceToBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);

    if (distanceToBottom < 40) {
      loadMoreIngredients();
    }
  };

  const handleSaveRecipe = async () => {
    console.log('[Create Recipe] save tapped');

    if (submitting) return;

    const trimmedName = recipeName.trim();
    if (!trimmedName) {
      console.log('[Create Recipe] validation failed: missing recipeName');
      Toast.show({ type: 'error', text1: 'Recipe name is required' });
      return;
    }

    if (!selectedBeverageId) {
      console.log('[Create Recipe] validation failed: missing beverageId');
      Toast.show({ type: 'error', text1: 'Please select a beverage' });
      return;
    }

    if (ingredients.length === 0) {
      console.log('[Create Recipe] validation failed: no ingredients selected');
      Toast.show({ type: 'error', text1: 'Please add at least one ingredient' });
      return;
    }

    if (!validatePrepTime()) {
      Toast.show({ type: 'error', text1: 'Prep time is invalid' });
      return;
    }

    console.log('[Create Recipe] validation passed');

    const proposedSellingPrice = Number(price);
    const profitMarginPercent =
      calculatedProfitMarginPercent !== null && Number.isFinite(calculatedProfitMarginPercent)
        ? Number(calculatedProfitMarginPercent.toFixed(2))
        : 0;

    const payload = {
      recipeName: trimmedName,
      image: '',
      createdSource: 'Manually',
      category: categories[categoryIndex],
      flavorStylePrimary: primaryStyles[primaryIndex],
      flavorStyleSecondary: secondaryStyles[secondaryIndex],
      flavorNote: notes.join(', '),
      isHot,
      isCold,
      hasIce: isIce,
      caffeineStrength: Math.round(strength * 10),
      containsMilk: isMilk,
      suggestedOccasions: suggestedOccasions.trim(),
      proposedSellingPrice: Number.isFinite(proposedSellingPrice) ? proposedSellingPrice : 0,
      profitMarginPercent: Number.isFinite(profitMarginPercent) ? profitMarginPercent : 0,
      difficultyLevel: difficulties[difficultyIndex],
      prepTimeRange: `${prepMin || '0'}-${prepMax || '0'} min`,
      brewingMethod: brewingMethods[brewIndex],
      brewingSteps: steps.map((step) => `${step.title}: ${step.body}`),
      brewingVariablesData: JSON.stringify({
        caffeineStrength: Math.round(strength * 10),
        containsMilk: isMilk,
        isHot,
        isCold,
        hasIce: isIce,
      }),
      presentationData: JSON.stringify({
        flavorNote: notes.join(', '),
        suggestedOccasions: suggestedOccasions.trim(),
      }),
      isPublic: false,
      isUnique: false,
      status: 'Active',
      beverageId: selectedBeverageId,
      ingredients: ingredients.map((item) => ({
        ingredient_id: item.ingredientId,
        quantity: Number(item.amount) || 0,
        measurement: item.measurement,
      })),
    };

    try {
      setSubmitting(true);
      console.log('[Create Recipe] request payload:', JSON.stringify(payload, null, 2));

      const createResponse = await authorizedFetch(API_ENDPOINTS.shopRecipe.create(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const createResponseText = await createResponse.text();
      console.log('[Create Recipe] response status:', createResponse.status);
      console.log('[Create Recipe] response body:', createResponseText);

      if (!createResponse.ok) {
        throw new Error(`Create recipe failed (${createResponse.status}): ${createResponseText}`);
      }

      const createPayload = createResponseText ? JSON.parse(createResponseText) : null;
      console.log('[Create Recipe] parsed response:', createPayload);
      const recipeId = parseCreatedRecipeId(createPayload);
      console.log('[Create Recipe] resolved recipeId:', recipeId);

      if (coverImageUri && recipeId) {
        const { fileName, mimeType } = getUploadFileInfo(coverImageUri);
        const formData = new FormData();
        formData.append('file', {
          uri: coverImageUri,
          name: fileName,
          type: mimeType,
        } as any);

        const uploadResponse = await authorizedFetch(
          `${API_ENDPOINTS.shopRecipe.uploadImage()}?id=${recipeId}`,
          {
            method: 'POST',
            headers: {
              Accept: '*/*',
            },
            body: formData,
          }
        );

        const uploadResponseText = await uploadResponse.text();
        console.log('[Create Recipe] upload image status:', uploadResponse.status);
        console.log('[Create Recipe] upload image body:', uploadResponseText);

        if (!uploadResponse.ok) {
          throw new Error(`Upload recipe image failed (${uploadResponse.status}): ${uploadResponseText}`);
        }
      }

      Toast.show({ type: 'success', text1: 'Recipe created successfully' });
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create recipe.';
      Toast.show({ type: 'error', text1: 'Create recipe failed', text2: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        keyboardVerticalOffset={Platform.select({ ios: 90, android: 80 })}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color={palette.accentDeep} />
          </Pressable>
          <Text style={styles.headerTitle}>Create Recipe</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Pressable
          style={[styles.coverCard, coverImageUri && styles.coverCardSelected]}
          onPress={handlePickCoverImage}
        >
          {coverImageUri ? (
            <Image source={{ uri: coverImageUri }} style={styles.coverPreview} />
          ) : (
            <View style={styles.coverIconWrap}>
              <Ionicons name="camera" size={20} color={palette.accent} />
              <View style={styles.coverPlus}>
                <Ionicons name="add" size={10} color={palette.accent} />
              </View>
            </View>
          )}
          <Text style={styles.coverText}>
            {coverImageUri ? 'Cover Photo Selected (Tap to change)' : 'Upload Cover Photo'}
          </Text>
        </Pressable>

        {loadingInit ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={palette.accentDeep} />
            <Text style={styles.loadingText}>Loading beverages and ingredients...</Text>
          </View>
        ) : null}

        <View style={styles.formBlock}>
          <Text style={styles.sectionLabel}>RECIPE NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Honey Lavender Latte"
            placeholderTextColor={palette.muted}
            value={recipeName}
            onChangeText={(value) => setRecipeName(value.slice(0, MAX_RECIPE_NAME_LENGTH))}
            maxLength={MAX_RECIPE_NAME_LENGTH}
          />

          <View style={styles.rowSplit}>
            <View style={styles.flexItem}>
              <Text style={styles.sectionLabel}>CATEGORY</Text>
              <Pressable
                style={styles.selectInput}
                onPress={() => setShowCategoryDropdown((prev) => !prev)}
              >
                <Text style={styles.selectText}>{categories[categoryIndex]}</Text>
                <Ionicons name={showCategoryDropdown ? 'chevron-up' : 'chevron-down'} size={16} color={palette.muted} />
              </Pressable>
              {showCategoryDropdown ? (
                <View style={styles.dropdownCard}>
                  <ScrollView nestedScrollEnabled style={styles.dropdownList}>
                    {categories.map((item, index) => (
                      <Pressable
                        key={item}
                        style={[
                          styles.dropdownItem,
                          index === categoryIndex && styles.dropdownItemSelected,
                        ]}
                        onPress={() => {
                          setCategoryIndex(index);
                          setShowCategoryDropdown(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            index === categoryIndex && styles.dropdownItemTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {item}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
            <View style={styles.flexItem}>
              <Text style={styles.sectionLabel}>BEVERAGE</Text>
              <Pressable
                style={styles.selectInput}
                onPress={() => setShowBeverageDropdown((prev) => !prev)}
              >
                <Text style={styles.selectText} numberOfLines={1}>{currentBeverageName}</Text>
                <Ionicons name={showBeverageDropdown ? 'chevron-up' : 'chevron-down'} size={16} color={palette.muted} />
              </Pressable>
              {showBeverageDropdown ? (
                <View style={styles.dropdownCard}>
                  <ScrollView nestedScrollEnabled style={styles.dropdownList}>
                    {beverageOptions.map((item) => (
                      <Pressable
                        key={item.id}
                        style={[
                          styles.dropdownItem,
                          item.id === selectedBeverageId && styles.dropdownItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedBeverageId(item.id);
                          setShowBeverageDropdown(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            item.id === selectedBeverageId && styles.dropdownItemTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="color-palette" size={18} color={palette.accent} />
            <Text style={styles.cardTitle}>Flavor Profile</Text>
          </View>

          <View style={styles.rowSplit}>
            <View style={styles.flexItem}>
              <Text style={styles.fieldLabel}>Primary Style</Text>
              <Pressable
                style={styles.selectInput}
                onPress={() => setShowPrimaryStyleDropdown((prev) => !prev)}
              >
                <Text style={styles.selectText}>{primaryStyles[primaryIndex]}</Text>
                <Ionicons name={showPrimaryStyleDropdown ? 'chevron-up' : 'chevron-down'} size={16} color={palette.muted} />
              </Pressable>
              {showPrimaryStyleDropdown ? (
                <View style={styles.dropdownCard}>
                  <ScrollView nestedScrollEnabled style={styles.dropdownList}>
                    {primaryStyles.map((item, index) => (
                      <Pressable
                        key={item}
                        style={[
                          styles.dropdownItem,
                          index === primaryIndex && styles.dropdownItemSelected,
                        ]}
                        onPress={() => {
                          setPrimaryIndex(index);
                          setShowPrimaryStyleDropdown(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            index === primaryIndex && styles.dropdownItemTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {item}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
            <View style={styles.flexItem}>
              <Text style={styles.fieldLabel}>Secondary Style</Text>
              <Pressable
                style={styles.selectInput}
                onPress={() => setShowSecondaryStyleDropdown((prev) => !prev)}
              >
                <Text style={styles.selectText}>{secondaryStyles[secondaryIndex]}</Text>
                <Ionicons name={showSecondaryStyleDropdown ? 'chevron-up' : 'chevron-down'} size={16} color={palette.muted} />
              </Pressable>
              {showSecondaryStyleDropdown ? (
                <View style={styles.dropdownCard}>
                  <ScrollView nestedScrollEnabled style={styles.dropdownList}>
                    {secondaryStyles.map((item, index) => (
                      <Pressable
                        key={item}
                        style={[
                          styles.dropdownItem,
                          index === secondaryIndex && styles.dropdownItemSelected,
                        ]}
                        onPress={() => {
                          setSecondaryIndex(index);
                          setShowSecondaryStyleDropdown(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            index === secondaryIndex && styles.dropdownItemTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {item}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          </View>

          <Text style={styles.fieldLabel}>Flavor Notes</Text>
          <View style={styles.chipRow}>
            {notes.map((note, index) => (
              <View key={`${note}-${index}`} style={styles.chip}>
                <Text style={styles.chipText}>{note}</Text>
                <Pressable
                  onPress={() => setNotes((prev) => prev.filter((_, i) => i !== index))}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={12} color={palette.accentDeep} />
                </Pressable>
              </View>
            ))}
            {!showNoteInput ? (
              <Pressable style={styles.chipGhost} onPress={() => setShowNoteInput(true)}>
                <Text style={styles.chipGhostText}>+ Add Note</Text>
              </Pressable>
            ) : (
              <View style={styles.noteInputRow}>
                <TextInput
                  style={[styles.input, styles.noteInput]}
                  placeholder="New note"
                  placeholderTextColor={palette.muted}
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                />
                <Pressable style={styles.noteButton} onPress={handleAddNote}>
                  <Text style={styles.noteButtonText}>Add</Text>
                </Pressable>
                <Pressable
                  style={[styles.noteButton, styles.noteCancelButton]}
                  onPress={() => {
                    setNoteDraft('');
                    setShowNoteInput(false);
                  }}
                >
                  <Text style={styles.noteCancelText}>Cancel</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="options" size={18} color={palette.accent} />
            <Text style={styles.cardTitle}>Attributes</Text>
          </View>

          <View style={styles.toggleGrid}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Hot</Text>
              <Switch
                value={isHot}
                onValueChange={handleToggleHot}
                disabled={isCold || isIce}
                trackColor={{ false: '#E0D7CF', true: palette.accentDeep }}
                thumbColor="#FFFFFF"
              />
              <Text style={styles.toggleLabel}>Cold</Text>
              <Switch
                value={isCold}
                onValueChange={handleToggleCold}
                disabled={isHot}
                trackColor={{ false: '#E0D7CF', true: palette.accentDeep }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Ice</Text>
              <Switch
                value={isIce}
                onValueChange={handleToggleIce}
                disabled={isHot}
                trackColor={{ false: '#E0D7CF', true: palette.accentDeep }}
                thumbColor="#FFFFFF"
              />
              <Text style={styles.toggleLabel}>Milk</Text>
              <Switch value={isMilk} onValueChange={setIsMilk} trackColor={{ false: '#E0D7CF', true: palette.accentDeep }} thumbColor="#FFFFFF" />
            </View>
          
          </View>

          <View style={styles.sliderHeader}>
            <Text style={styles.fieldLabel}>Caffeine Strength</Text>
            <View style={styles.strengthPill}>
              <Text style={styles.strengthText}>{strengthLabel}</Text>
            </View>
          </View>
          <Slider
            value={strength}
            onValueChange={setStrength}
            minimumValue={0}
            maximumValue={1}
            minimumTrackTintColor={palette.accentDeep}
            maximumTrackTintColor={palette.line}
            thumbTintColor={palette.accentDeep}
            style={styles.slider}
          />
          <View style={styles.sliderScale}>
            <Text style={styles.sliderHint}>DECAF</Text>
            <Text style={styles.sliderHint}>REGULAR</Text>
            <Text style={styles.sliderHint}>EXTRA</Text>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="briefcase" size={18} color={palette.accent} />
            <Text style={styles.sectionTitle}>Business Details</Text>
          </View>
          <View style={styles.rowSplit}>
            <View style={styles.flexItem}>
              <Text style={styles.sectionLabel}>PRICE (VND)</Text>
              <View style={styles.inputWithSuffix}>
                <TextInput
                  style={styles.input}
                  placeholder="55000"
                  placeholderTextColor={palette.muted}
                  keyboardType="numeric"
                  value={price}
                  onChangeText={(value) => setPrice(clampNumberInput(value, MAX_PRICE_VALUE))}
                  maxLength={8}
                />
                <Text style={styles.inputSuffix}>VND</Text>
              </View>
            </View>
            <View style={styles.flexItem}>
              <Text style={styles.sectionLabel}>EST. MARGIN (%)</Text>
              <View style={styles.marginPill}>
                <Text style={styles.marginText}>{calculatedProfitMarginLabel}</Text>
                <Ionicons name="trending-up" size={14} color={palette.greenText} />
              </View>
            </View>
          </View>

          <View style={styles.rowSplit}>
            <View style={styles.flexItem}>
              <Text style={styles.sectionLabel}>DIFFICULTY</Text>
              <Pressable
                style={styles.selectInput}
                onPress={() => setShowDifficultyDropdown((prev) => !prev)}
              >
                <Text style={styles.selectText}>{difficulties[difficultyIndex]}</Text>
                <Ionicons name={showDifficultyDropdown ? 'chevron-up' : 'chevron-down'} size={16} color={palette.muted} />
              </Pressable>
              {showDifficultyDropdown ? (
                <View style={styles.dropdownCard}>
                  <ScrollView nestedScrollEnabled style={styles.dropdownList}>
                    {difficulties.map((item, index) => (
                      <Pressable
                        key={item}
                        style={[
                          styles.dropdownItem,
                          index === difficultyIndex && styles.dropdownItemSelected,
                        ]}
                        onPress={() => {
                          setDifficultyIndex(index);
                          setShowDifficultyDropdown(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            index === difficultyIndex && styles.dropdownItemTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {item}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
            <View style={styles.flexItem}>
              <Text style={styles.sectionLabel}>PREP TIME (MIN)</Text>
              <View style={styles.rowSplitTight}>
                <TextInput
                  style={[styles.input, styles.timeInput]}
                  placeholder="3"
                  placeholderTextColor={palette.muted}
                  keyboardType="numeric"
                  value={prepMin}
                  onChangeText={(value) => {
                    setPrepMin(clampPrepInput(value));
                    if (prepTimeError) setPrepTimeError('');
                  }}
                  onBlur={validatePrepTime}
                  maxLength={2}
                />
                <Text style={styles.timeDash}>-</Text>
                <TextInput
                  style={[styles.input, styles.timeInput]}
                  placeholder="5"
                  placeholderTextColor={palette.muted}
                  keyboardType="numeric"
                  value={prepMax}
                  onChangeText={(value) => {
                    setPrepMax(clampPrepInput(value));
                    if (prepTimeError) setPrepTimeError('');
                  }}
                  onBlur={validatePrepTime}
                  maxLength={2}
                />
              </View>
              {prepTimeError ? (
                <Text style={styles.prepErrorText}>{prepTimeError}</Text>
              ) : null}
            </View>
          </View>

          <Text style={styles.sectionLabel}>SUGGESTED OCCASIONS</Text>
          <TextInput
            style={styles.input}
            placeholder="Morning rush, weekend brunch, date night..."
            placeholderTextColor={palette.muted}
            value={suggestedOccasions}
            onChangeText={(value) =>
              setSuggestedOccasions(value.slice(0, MAX_SUGGESTED_OCCASIONS_LENGTH))
            }
            maxLength={MAX_SUGGESTED_OCCASIONS_LENGTH}
          />
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="clipboard" size={18} color={palette.accent} />
            <Text style={styles.sectionTitle}>Preparation</Text>
          </View>

          <Text style={styles.sectionLabel}>INGREDIENTS LIST</Text>
          {ingredients.map((item, index) => (
            <View key={`${item.ingredientId}-${index}`} style={styles.ingredientCard}>
              <View style={[styles.ingredientIcon, { backgroundColor: item.tint }]}
              >
                <Ionicons name={item.icon} size={16} color={item.iconColor} />
              </View>
              <View style={styles.ingredientInfo}>
                <Text style={styles.ingredientName}>{item.name}</Text>
                <Text style={styles.ingredientNote}>{item.note}</Text>
              </View>
              <View style={styles.ingredientAmount}>
                <Text style={styles.ingredientAmountText}>{item.amount} {item.measurement}</Text>
              </View>
              <Pressable onPress={() => setIngredients((prev) => prev.filter((row) => row.ingredientId !== item.ingredientId))}>
                <Ionicons name="trash-outline" size={16} color={palette.accentDeep} />
              </Pressable>
            </View>
          ))}

          {!showIngredientInput ? (
            <Pressable
              style={styles.addRow}
              onPress={() => {
                setIngredientSearchKeyword('');
                setShowIngredientInput(true);
              }}
            >
              <Ionicons name="add" size={16} color={palette.accentDeep} />
              <Text style={styles.addRowText}>Add Ingredient</Text>
            </Pressable>
          ) : (
            <View style={styles.inlineForm}>
              <Pressable
                style={styles.selectInput}
                onPress={() => setShowIngredientDropdown((prev) => !prev)}
              >
                <Text style={styles.selectText} numberOfLines={1}>{currentIngredientName}</Text>
                <Ionicons name={showIngredientDropdown ? 'chevron-up' : 'chevron-down'} size={16} color={palette.muted} />
              </Pressable>
              {showIngredientDropdown ? (
                <View style={styles.dropdownCard}>
                  <View style={styles.dropdownSearchWrap}>
                    <Ionicons name="search" size={14} color={palette.muted} />
                    <TextInput
                      style={styles.dropdownSearchInput}
                      placeholder="Search ingredient name..."
                      placeholderTextColor={palette.muted}
                      value={ingredientSearchKeyword}
                      onChangeText={setIngredientSearchKeyword}
                    />
                  </View>
                  <ScrollView
                    nestedScrollEnabled
                    style={styles.dropdownList}
                    onScroll={handleIngredientDropdownScroll}
                    scrollEventThrottle={16}
                  >
                    {ingredientOptions.map((item) => (
                      <Pressable
                        key={item.id}
                        style={[
                          styles.dropdownItem,
                          item.id === selectedIngredientId && styles.dropdownItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedIngredientId(item.id);
                          setShowIngredientDropdown(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            item.id === selectedIngredientId && styles.dropdownItemTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                      </Pressable>
                    ))}
                    {loadingIngredientMore ? (
                      <View style={styles.dropdownLoadingRow}>
                        <ActivityIndicator size="small" color={palette.accentDeep} />
                      </View>
                    ) : null}
                  </ScrollView>
                </View>
              ) : null}

              <View style={styles.rowSplit}>
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  placeholder="Quantity"
                  placeholderTextColor={palette.muted}
                  keyboardType="numeric"
                  value={ingredientDraft.quantity}
                  onChangeText={(value) => {
                    setIngredientDraft((prev) => ({ ...prev, quantity: clampNumberInput(value, MAX_INGREDIENT_QUANTITY) }));
                    if (ingredientError) setIngredientError('');
                  }}
                  maxLength={4}
                />
                <View
                  style={[
                    styles.measurementPickerWrap,
                    ingredientError ? styles.measurementPickerError : null,
                  ]}
                >
                  <Text style={styles.measurementLabel}>Measurement</Text>
                  {ingredientError ? (
                    <Text style={styles.ingredientErrorText}>{ingredientError}</Text>
                  ) : null}
                  <View style={styles.measurementOptions}>
                    {measurementOptions.map((unit) => {
                      const disabled = !allowedMeasurementOptions.includes(unit);
                      const selected = ingredientDraft.measurement === unit;
                      return (
                        <Pressable
                          key={unit}
                          style={[
                            styles.measureChip,
                            selected && styles.measureChipSelected,
                            disabled && styles.measureChipDisabled,
                          ]}
                          disabled={disabled}
                          onPress={() => {
                            setIngredientDraft((prev) => ({ ...prev, measurement: unit }));
                            if (ingredientError) setIngredientError('');
                          }}
                        >
                          <Text
                            style={[
                              styles.measureChipText,
                              selected && styles.measureChipTextSelected,
                              disabled && styles.measureChipTextDisabled,
                            ]}
                          >
                            {unit}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.inlineActions}>
                <Pressable style={styles.primaryAction} onPress={handleAddIngredient}>
                  <Text style={styles.primaryActionText}>Add</Text>
                </Pressable>
                <Pressable
                  style={styles.ghostAction}
                  onPress={() => {
                    setIngredientDraft({ quantity: '', measurement: 'g' });
                    setShowIngredientInput(false);
                  }}
                >
                  <Text style={styles.ghostActionText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}

          <Text style={styles.sectionLabel}>BREWING METHOD</Text>
          <Pressable
            style={styles.selectInput}
            onPress={() => setShowBrewingMethodDropdown((prev) => !prev)}
          >
            <Text style={styles.selectText}>{brewingMethods[brewIndex]}</Text>
            <Ionicons name={showBrewingMethodDropdown ? 'chevron-up' : 'chevron-down'} size={16} color={palette.muted} />
          </Pressable>
          {showBrewingMethodDropdown ? (
            <View style={styles.dropdownCard}>
              <ScrollView nestedScrollEnabled style={styles.dropdownList}>
                {brewingMethods.map((item, index) => (
                  <Pressable
                    key={item}
                    style={[
                      styles.dropdownItem,
                      index === brewIndex && styles.dropdownItemSelected,
                    ]}
                    onPress={() => {
                      setBrewIndex(index);
                      setShowBrewingMethodDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        index === brewIndex && styles.dropdownItemTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>STEPS</Text>
          {steps.map((step, index) => (
            <View key={`${step.title}-${index}`} style={styles.stepRow}>
              <View style={styles.stepIndicator}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
              </View>
              <View style={styles.stepCard}>
                <View style={styles.stepCardHeader}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Pressable style={styles.stepRemoveButton} onPress={() => handleRemoveStep(index)}>
                    <Ionicons name="trash-outline" size={14} color={palette.accentDeep} />
                  </Pressable>
                </View>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}

          {!showStepInput ? (
            <Pressable style={styles.addStepRow} onPress={() => setShowStepInput(true)}>
              <View style={styles.addStepCircle}>
                <Ionicons name="add" size={14} color={palette.accentDeep} />
              </View>
              <Text style={styles.addStepText}>Add Next Step</Text>
            </Pressable>
          ) : (
            <View style={styles.inlineForm}>
              <TextInput
                style={styles.input}
                placeholder="Step title"
                placeholderTextColor={palette.muted}
                value={stepDraft.title}
                onChangeText={(text) =>
                  setStepDraft((prev) => ({
                    ...prev,
                    title: text.slice(0, MAX_STEP_TITLE_LENGTH),
                  }))
                }
                maxLength={MAX_STEP_TITLE_LENGTH}
                onFocus={handleStepInputFocus}
              />
              <TextInput
                style={[styles.input, styles.stepInput]}
                placeholder="Step description"
                placeholderTextColor={palette.muted}
                value={stepDraft.body}
                onChangeText={(text) =>
                  setStepDraft((prev) => ({
                    ...prev,
                    body: text.slice(0, MAX_STEP_BODY_LENGTH),
                  }))
                }
                multiline
                maxLength={MAX_STEP_BODY_LENGTH}
                onFocus={handleStepInputFocus}
              />
              <View style={styles.inlineActions}>
                <Pressable style={styles.primaryAction} onPress={handleAddStep}>
                  <Text style={styles.primaryActionText}>Add Step</Text>
                </Pressable>
                <Pressable
                  style={styles.ghostAction}
                  onPress={() => {
                    setStepDraft({ title: '', body: '' });
                    setShowStepInput(false);
                  }}
                >
                  <Text style={styles.ghostActionText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <Pressable style={[styles.saveButton, submitting && styles.saveButtonDisabled]} onPress={handleSaveRecipe} disabled={submitting || loadingInit}>
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Recipe</Text>
          )}
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    marginTop: 6,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.line,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink,
  },
  headerSpacer: {
    width: 36,
  },
  coverCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    borderStyle: 'dashed',
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.card,
  },
  coverIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  coverPlus: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.line,
  },
  coverText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.accentDeep,
  },
  coverCardSelected: {
    borderColor: palette.accent,
    backgroundColor: '#FFFBF6',
  },
  coverPreview: {
    width: 92,
    height: 92,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.line,
  },
  loadingRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: palette.muted,
  },
  formBlock: {
    marginTop: 20,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.muted,
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: palette.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: palette.ink,
  },
  selectInput: {
    backgroundColor: palette.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontSize: 14,
    color: palette.ink,
    fontWeight: '600',
  },
  beverageSelectRow: {
    backgroundColor: palette.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  beverageNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beverageSelectText: {
    flex: 1,
    fontSize: 13,
    color: palette.ink,
    fontWeight: '600',
  },
  dropdownCard: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    backgroundColor: palette.card,
    overflow: 'hidden',
  },
  dropdownSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2EBE2',
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 13,
    color: palette.ink,
    fontWeight: '500',
    paddingVertical: 0,
  },
  dropdownList: {
    maxHeight: 180,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2EBE2',
  },
  dropdownItemSelected: {
    backgroundColor: palette.accentSoft,
  },
  dropdownItemText: {
    fontSize: 13,
    color: palette.ink,
    fontWeight: '600',
  },
  dropdownItemTextSelected: {
    color: palette.accentDeep,
  },
  dropdownLoadingRow: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  rowSplit: {
    flexDirection: 'row',
    gap: 12,
  },
  rowSplitTight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prepErrorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#C0392B',
    fontWeight: '600',
  },
  flexItem: {
    flex: 1,
    gap: 8,
  },
  flexInput: {
    flex: 1,
  },
  measurementPickerWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 18,
    backgroundColor: palette.card,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  measurementLabel: {
    fontSize: 11,
    color: palette.muted,
    fontWeight: '700',
  },
  measurementOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  measureChip: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
  },
  measureChipSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  measureChipDisabled: {
    opacity: 0.35,
  },
  measureChipText: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '700',
  },
  measureChipTextSelected: {
    color: palette.accentDeep,
  },
  measureChipTextDisabled: {
    color: palette.muted,
  },
  card: {
    marginTop: 18,
    backgroundColor: palette.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: palette.accentSoft,
  },
  chipText: {
    fontSize: 12,
    color: palette.accentDeep,
    fontWeight: '600',
  },
  chipGhost: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipGhostText: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
  },
  noteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  noteInput: {
    flex: 1,
  },
  noteButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: palette.accent,
  },
  noteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  noteCancelButton: {
    backgroundColor: palette.accentSoft,
  },
  noteCancelText: {
    color: palette.accentDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  toggleGrid: {
    gap: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleLabel: {
    fontSize: 13,
    color: palette.ink,
    fontWeight: '600',
  },
  toggleSpacer: {
    width: 52,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  strengthPill: {
    backgroundColor: palette.accentSoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  strengthText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.accentDeep,
  },
  slider: {
    marginTop: 4,
  },
  sliderScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderHint: {
    fontSize: 10,
    color: palette.muted,
    fontWeight: '600',
  },
  sectionBlock: {
    marginTop: 20,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink,
  },
  inputWithSuffix: {
    position: 'relative',
  },
  inputSuffix: {
    position: 'absolute',
    right: 14,
    top: 12,
    fontSize: 14,
    color: palette.muted,
  },
  marginPill: {
    backgroundColor: palette.green,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  marginText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.greenText,
  },
  timeInput: {
    flex: 1,
    textAlign: 'center',
  },
  timeDash: {
    fontSize: 16,
    color: palette.muted,
  },
  ingredientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 12,
  },
  ingredientIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink,
  },
  ingredientNote: {
    fontSize: 12,
    color: palette.muted,
  },
  ingredientAmount: {
    backgroundColor: palette.accentSoft,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ingredientAmountText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.accentDeep,
  },
  addRow: {
    borderWidth: 1,
    borderColor: palette.line,
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.card,
  },
  addRowText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.accentDeep,
  },
  inlineForm: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
    backgroundColor: palette.card,
    gap: 10,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryAction: {
    flex: 1,
    backgroundColor: palette.accentDeep,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  ghostAction: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.line,
  },
  ghostActionText: {
    color: palette.accentDeep,
    fontWeight: '700',
    fontSize: 12,
  },
  stepInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  stepCard: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 6,
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepRemoveButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink,
  },
  stepBody: {
    fontSize: 12,
    color: palette.muted,
    lineHeight: 18,
  },
  addStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  addStepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addStepText: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: palette.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
