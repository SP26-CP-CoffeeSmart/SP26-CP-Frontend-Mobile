import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';
import SubscriptionGateModal from '@/components/subscription-gate-modal';
import AiWarningModal from '@/components/ai-warning-modal';
import { isSubscriptionActive, resolveCurrentSubscription } from '@/services/subscriptionResolver';

const COLORS = {
  bg: '#F4EFE9',
  text: '#2E221B',
  muted: '#7B6F67',
  border: '#E5D8CC',
  card: '#FFFFFF',
  accent: '#7C5C40',
  accentDark: '#5C402B',
  chip: '#FFFFFF',
  chipActive: '#E7D3C1',
  highlight: '#FFFFFF',
  surface: '#F7EFE7',
};

const layoutOptions = [
  {
    key: 'vertical',
    label: 'Vertical',
    image: require('../assets/vertical.jpg'),
  },
  {
    key: 'horizontal',
    label: 'Horizontal',
    image: require('../assets/horizontal.jpg'),
  },
  {
    key: 'descriptive',
    label: 'Descriptive',
    image: require('../assets/descriptive.png'),
  },
];

const resolveImageSource = (image: unknown) => {
  if (typeof image === 'number') {
    return image;
  }
  if (typeof image === 'string' && image.trim()) {
    return { uri: image };
  }
  return null;
};

const topics = [
  {
    key: 'Summer Refresh',
    label: 'Summer Refresh',
    image: require('../assets/summer.webp'),
  },
  {
    key: 'Winter Warmers',
    label: 'Winter Warmers',
    image: require('../assets/winter.jpg'),
  },
  {
    key: 'Rainy Day Comfort',
    label: 'Rainy Day Comfort',
    image: require('../assets/rainy.jpg'),
  },
];
const shopStyles = [
  'Modern Minimalist',
  'Rustic & Cozy',
  'Third-wave Special',
  'Vintage Classic',
];
const pricingOptions = [
  { key: 'budget', label: 'Budget', range: '20,000 - 40,000 VND' },
  { key: 'moderate', label: 'Moderate', range: '30,000 - 60,000 VND' },
  { key: 'premium', label: 'Premium', range: '50,000 - 80,000 VND' },
  { key: 'luxury', label: 'Luxury', range: '70,000 - 120,000 VND' },
];

type BeverageCategory = {
  id?: number;
  beverageCategoryId?: number;
  name?: string;
  categoryName?: string;
};

type MenuGroup = {
  name: string;
  selectedBeverageCategories: number[];
};

export default function MenuRecommendationsScreen() {
  const router = useRouter();
  const { coffeeShopId, loading: authLoading } = useAuth();
  const [menuTitle, setMenuTitle] = useState('');
  const [menuSize, setMenuSize] = useState(17);
  const [selectedLayout, setSelectedLayout] = useState('vertical');
  const [selectedTopic, setSelectedTopic] = useState('Summer Refresh');
  const [selectedShopStyle, setSelectedShopStyle] = useState('Modern Minimalist');
  const [shopStyleText, setShopStyleText] = useState('');
  const [selectedPricing, setSelectedPricing] = useState('budget');
  const [numberOfOptions, setNumberOfOptions] = useState(1);
  const [menuGroups, setMenuGroups] = useState<MenuGroup[]>([]);
  const [menuGroupInput, setMenuGroupInput] = useState('');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionModalMessage, setSubscriptionModalMessage] = useState(
    'The shop does not have an active subscription.'
  );
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalTitle, setLimitModalTitle] = useState('Create menu failed');
  const [limitModalMessage, setLimitModalMessage] = useState('');
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<BeverageCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [useExistingShopItems, setUseExistingShopItems] = useState(true);

  const extractErrorMessage = (raw: unknown) => {
    const extractValidationMessage = (value: any) => {
      const errors = value?.errors;
      if (!errors || typeof errors !== 'object') return null;
      const groups = Array.isArray(errors.Groups) ? errors.Groups : null;
      if (groups && groups.length > 0) return String(groups[0]);
      const firstKey = Object.keys(errors)[0];
      const firstValue = firstKey ? errors[firstKey] : null;
      if (Array.isArray(firstValue) && firstValue.length > 0) return String(firstValue[0]);
      if (typeof firstValue === 'string' && firstValue.trim()) return firstValue.trim();
      return null;
    };

    if (raw instanceof Error) {
      const text = raw.message.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const validationMessage = extractValidationMessage(parsed);
          if (validationMessage) return validationMessage;
          const parsedMessage = parsed?.error ?? parsed?.message;
          if (parsedMessage) return String(parsedMessage);
        } catch {
          // ignore JSON parse error
        }
      }
      return text || 'Request failed.';
    }

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return 'Request failed.';
      try {
        const parsed = JSON.parse(trimmed);
        const validationMessage = extractValidationMessage(parsed);
        if (validationMessage) return validationMessage;
        const parsedMessage = parsed?.error ?? parsed?.message;
        if (parsedMessage) return String(parsedMessage);
      } catch {
        // ignore JSON parse error
      }
      return trimmed;
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

  const getCategoryId = (category: BeverageCategory) =>
    typeof category.id === 'number'
      ? category.id
      : typeof category.beverageCategoryId === 'number'
        ? category.beverageCategoryId
        : null;

  const getCategoryName = (category: BeverageCategory) =>
    String(category.name ?? category.categoryName ?? 'Unnamed category');

  const loadCategories = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!coffeeShopId) {
      setCategories([]);
      setCategoriesError('Missing coffee shop id.');
      return;
    }

    try {
      setCategoriesLoading(true);
      const response = await authorizedFetch(
        API_ENDPOINTS.beverageCategory.getByShop(coffeeShopId)
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Request failed (${response.status})${errorText ? `: ${errorText}` : ''}`
        );
      }

      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
      setCategoriesError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load beverage categories.';
      console.error('Error loading beverage categories:', message);
      setCategoriesError(message);
    } finally {
      setCategoriesLoading(false);
    }
  }, [authLoading, coffeeShopId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const layoutValue = useMemo(
    () => layoutOptions.findIndex((option) => option.key === selectedLayout),
    [selectedLayout]
  );
  const topicValue = useMemo(
    () => topics.findIndex((topic) => topic.key === selectedTopic),
    [selectedTopic]
  );
  const pricingValue = useMemo(
    () => pricingOptions.findIndex((option) => option.key === selectedPricing),
    [selectedPricing]
  );
  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((category) => {
      const id = getCategoryId(category);
      if (id !== null) {
        map.set(id, getCategoryName(category));
      }
    });
    return map;
  }, [categories]);

  const selectedLayoutLabel =
    layoutOptions.find((option) => option.key === selectedLayout)?.label ?? 'Vertical';
  const selectedShopStyleLabel =
    selectedShopStyle || shopStyleText.trim() || 'Custom';

  const renderGroupDeleteAction = (groupIndex: number) => (
    <View style={styles.swipeActions}>
      <TouchableOpacity
        style={styles.swipeDelete}
        onPress={() => handleRemoveGroup(groupIndex)}
        activeOpacity={0.85}
      >
        <Ionicons name="trash-outline" size={18} color="#FFF" />
        <Text style={styles.swipeDeleteText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  const handleAddGroup = () => {
    const next = menuGroupInput.trim();
    if (!next) {
      return;
    }

    setMenuGroups((prev) => [...prev, { name: next, selectedBeverageCategories: [] }]);
    setMenuGroupInput('');
  };

  const handleRemoveGroup = (groupIndex: number) => {
    setMenuGroups((prev) => prev.filter((_, index) => index !== groupIndex));
    setActiveGroupIndex((current) => {
      if (current === null) {
        return current;
      }
      if (current === groupIndex) {
        return null;
      }
      return current > groupIndex ? current - 1 : current;
    });
  };

  const openCategoryModal = (groupIndex: number) => {
    setActiveGroupIndex(groupIndex);
    setCategoryModalOpen(true);
    loadCategories();
  };

  const toggleCategoryForGroup = (categoryId: number) => {
    if (activeGroupIndex === null) {
      return;
    }

    const existingGroupIndex = menuGroups.findIndex(
      (g, index) => index !== activeGroupIndex && g.selectedBeverageCategories.includes(categoryId)
    );

    if (existingGroupIndex !== -1) {
      Toast.show({
        type: 'error',
        text1: 'Category Already Selected',
        text2: `This category is already used in "${menuGroups[existingGroupIndex].name}".`,
      });
      return;
    }

    setMenuGroups((prev) =>
      prev.map((group, index) => {
        if (index !== activeGroupIndex) {
          return group;
        }

        const selected = group.selectedBeverageCategories.includes(categoryId);
        return {
          ...group,
          selectedBeverageCategories: selected
            ? group.selectedBeverageCategories.filter((id) => id !== categoryId)
            : [...group.selectedBeverageCategories, categoryId],
        };
      })
    );
  };

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }

    if (!coffeeShopId) {
      setSubscriptionModalMessage('Missing coffee shop information.');
      setShowSubscriptionModal(true);
      return;
    }

    if (!hasActiveSubscription && !checkingSubscription) {
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
          return;
        }
      } catch {
        setSubscriptionModalMessage('Unable to verify subscription status.');
        setShowSubscriptionModal(true);
        return;
      } finally {
        setCheckingSubscription(false);
      }
    }

    const title = menuTitle.trim();
    if (!title) {
      Toast.show({
        type: 'error',
        text1: 'Missing title',
        text2: 'Please enter a menu title.',
      });
      return;
    }

    const groupsMissingCategories = menuGroups.filter(
      (group) => group.selectedBeverageCategories.length === 0
    );
    if (groupsMissingCategories.length > 0) {
      Alert.alert(
        'Missing categories',
        'Each menu group must have at least one beverage category.'
      );
      Toast.show({
        type: 'error',
        text1: 'Missing categories',
        text2: 'Each menu group must have at least one beverage category.',
      });
      return;
    }

    const payload = {
      title,
      menuSizeValue: menuSize,
      numberOfOptions,
      layout: layoutValue,
      topic: topicValue,
      shopStyle: shopStyleText.trim() || selectedShopStyle,
      pricing: pricingValue,
      useExistingShopItems,
      groups: menuGroups.map((group) => ({
        name: group.name,
        selectedBeverageCategories: group.selectedBeverageCategories,
      })),
    };

    try {
      setSubmitting(true);
      router.push('/ai-loading');
      console.log('[Menu Create] Request payload:', payload);
      const response = await authorizedFetch(API_ENDPOINTS.ai.createMenuSkeleton(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }

      const responseText = await response.text();
      let responsePayload: unknown = null;
      if (responseText) {
        try {
          responsePayload = JSON.parse(responseText);
        } catch {
          responsePayload = responseText;
        }
      }
      console.log('[Menu Create] Response payload:', responsePayload ?? responseText);

      let cacheKey = '';
      if (responsePayload) {
        cacheKey = `menuSkeleton:${Date.now()}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(responsePayload));
      }

      Toast.show({ type: 'success', text1: 'Menu skeleton created.' });
      router.replace({
        pathname: '/menu-results',
        params: {
          data: responsePayload ? JSON.stringify(responsePayload) : '',
          cacheKey,
          flow: 'create-menu',
        },
      });
    } catch (error) {
      const message = extractErrorMessage(error);
      router.back();
      if (isUsageLimitError(message)) {
        setLimitModalTitle('Create menu failed');
        setLimitModalMessage(message);
        setShowLimitModal(true);
      } else {
        Toast.show({ type: 'error', text1: 'Create menu failed', text2: message });
        console.log('Error creating menu skeleton:', message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Menu Recommendations</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Image
          source={require('../assets/menurecommendations.webp')}
          style={styles.heroImage}
        />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What's your menu idea ?</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Menu Title</Text>
            <Text style={styles.helperText}>Please specify the title for your menu</Text>
            <TextInput
              style={styles.input}
              placeholder="Eg Coffee Menu #1..."
              placeholderTextColor={COLORS.muted}
              value={menuTitle}
              onChangeText={(value) => setMenuTitle(value.slice(0, 32))}
              maxLength={32}
            />
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Menu Drinks' Size</Text>
              <Text style={styles.valueText}>{menuSize}</Text>
            </View>
            <Slider
              value={menuSize}
              onValueChange={setMenuSize}
              minimumValue={10}
              maximumValue={20}
              step={1}
              minimumTrackTintColor={COLORS.accent}
              maximumTrackTintColor={COLORS.border}
              thumbTintColor={COLORS.accent}
            />
            <View style={styles.rowBetween}>
              <Text style={styles.helperText}>10</Text>
              <Text style={styles.helperText}>20</Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              How many menu results would you like the AI to return?
            </Text>
            <Text style={styles.helperText}>Choose 1, 2, or 3 options.</Text>
            <View style={styles.optionRow}>
              {[1, 2, 3].map((option) => {
                const active = numberOfOptions === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.optionChip, active && styles.optionChipActive]}
                    onPress={() => setNumberOfOptions(option)}
                  >
                    <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Menu Drinks' Layout</Text>
              <Text style={styles.valueText}>{selectedLayoutLabel}</Text>
            </View>
            <Text style={styles.helperText}>Decide which layout suit your menu</Text>
            <View style={styles.layoutRow}>
              {layoutOptions.map((option) => {
                const selected = selectedLayout === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.layoutCard, selected && styles.layoutCardActive]}
                    onPress={() => setSelectedLayout(option.key)}
                    activeOpacity={0.85}
                  >
                    <Image source={resolveImageSource(option.image)} style={styles.layoutImage} />
                    <Text style={styles.layoutLabel}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Menu Topic</Text>
              <Text style={styles.valueText}>{selectedTopic}</Text>
            </View>
            <Text style={styles.helperText}>Choose a topic for your menu</Text>
            <View style={styles.topicList}>
              {topics.map((topic) => {
                const active = selectedTopic === topic.key;
                return (
                  <TouchableOpacity
                    key={topic.key}
                    style={[styles.topicCard, active && styles.topicCardActive]}
                    onPress={() => setSelectedTopic(topic.key)}
                    activeOpacity={0.85}
                  >
                    <Image source={resolveImageSource(topic.image)} style={styles.topicImage} />
                    <View style={[styles.topicOverlay, active && styles.topicOverlayActive]}>
                      <Text style={[styles.topicTitle, active && styles.topicTitleActive]}>
                        {topic.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Shop Style</Text>
              <Text style={styles.valueText}>{selectedShopStyleLabel}</Text>
            </View>
            <Text style={styles.helperText}>What vibe did your coffee shop have ?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.styleRow}
            >
              {shopStyles.map((style) => {
                const active = selectedShopStyle === style;
                return (
                  <TouchableOpacity
                    key={style}
                    style={[styles.styleChip, active && styles.styleChipActive]}
                    onPress={() => setSelectedShopStyle(active ? '' : style)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.styleChipText, active && styles.styleChipTextActive]}>
                      {style}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TextInput
              style={styles.input}
              placeholder="Please specify your coffee shop style"
              placeholderTextColor={COLORS.muted}
              value={shopStyleText}
              onChangeText={(value) => {
                setShopStyleText(value);
                if (value.trim()) {
                  setSelectedShopStyle('');
                }
              }}
              onFocus={() => setSelectedShopStyle('')}
            />
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Pricing Strategy</Text>
              <Text style={styles.valueText}>
                {pricingOptions.find((item) => item.key === selectedPricing)?.label ?? 'Budget'}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pricingRow}
            >
              {pricingOptions.map((option) => {
                const active = selectedPricing === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.pricingChip, active && styles.pricingChipActive]}
                    onPress={() => setSelectedPricing(option.key)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.pricingLabel, active && styles.pricingLabelActive]}>
                      {option.label}
                    </Text>
                    <Text style={[styles.pricingRange, active && styles.pricingLabelActive]}>
                      {option.range}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Menu Group</Text>
              <View style={styles.groupBadge}>
                <Text style={styles.groupBadgeText}>{menuGroups.length} selected</Text>
              </View>
            </View>
            <Text style={styles.helperText}>How organizing you want for the menu ?</Text>
            <View style={styles.groupList}>
              {menuGroups.map((group, index) => (
                <Swipeable
                  key={`${group.name}-${index}`}
                  renderRightActions={() => renderGroupDeleteAction(index)}
                  overshootRight={false}
                  containerStyle={styles.groupSwipeContainer}
                  childrenContainerStyle={styles.groupSwipeChildren}
                >
                  <View style={styles.groupCardShadow}>
                    <View style={styles.groupCard}>
                      <View style={styles.groupHeaderRow}>
                        <View style={styles.groupTitleRow}>
                          <Ionicons name="list" size={18} color={COLORS.muted} />
                          <Text style={styles.groupText}>{group.name}</Text>
                        </View>
                        <View style={styles.groupCountChip}>
                          <Text style={styles.groupCountText}>
                            {group.selectedBeverageCategories.length} categories
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.groupAddButton}
                        onPress={() => openCategoryModal(index)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="add-circle-outline" size={18} color={COLORS.accent} />
                        <Text style={styles.groupAddText}>Add beverage category</Text>
                      </TouchableOpacity>

                      {group.selectedBeverageCategories.length > 0 && (
                        <View style={styles.groupCategoryList}>
                          {group.selectedBeverageCategories.map((id) => {
                            const name = categoryNameById.get(id);
                            if (!name) {
                              return null;
                            }
                            return (
                              <View key={`${group.name}-${id}`} style={styles.groupCategoryChip}>
                                <Text style={styles.groupCategoryText}>{name}</Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </View>
                </Swipeable>
              ))}
              <View style={styles.groupInputRow}>
                <TextInput
                  style={styles.groupInput}
                  placeholder="Menu Group name..."
                  placeholderTextColor={COLORS.muted}
                  value={menuGroupInput}
                  onChangeText={(value) => setMenuGroupInput(value.slice(0, 32))}
                  maxLength={32}
                />
                <TouchableOpacity
                  style={styles.groupInputAction}
                  onPress={handleAddGroup}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={18} color={COLORS.accentDark} />
                </TouchableOpacity>
              </View>
              <View style={styles.recipeToggleRow}>
                <Text style={styles.label}>Use existing recipes from your shop?</Text>
                <View style={styles.recipeToggleActions}>
                  <TouchableOpacity
                    style={styles.recipeToggleOption}
                    onPress={() => setUseExistingShopItems(true)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.recipeRadioOuter,
                        useExistingShopItems && styles.recipeRadioOuterActive,
                      ]}
                    >
                      {useExistingShopItems ? <View style={styles.recipeRadioInner} /> : null}
                    </View>
                    <Text style={styles.recipeToggleText}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.recipeToggleOption}
                    onPress={() => setUseExistingShopItems(false)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.recipeRadioOuter,
                        !useExistingShopItems && styles.recipeRadioOuterActive,
                      ]}
                    >
                      {!useExistingShopItems ? <View style={styles.recipeRadioInner} /> : null}
                    </View>
                    <Text style={styles.recipeToggleText}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? 'Submitting...' : 'Create Menu Skeleton'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={categoryModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Beverage Categories</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setCategoryModalOpen(false)}
              >
                <Ionicons name="close" size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {categoriesLoading ? (
              <Text style={styles.modalHint}>Loading categories...</Text>
            ) : categoriesError ? (
              <Text style={styles.modalHint}>{categoriesError}</Text>
            ) : (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {categories.map((category) => {
                  const id = getCategoryId(category);
                  if (id === null) {
                    return null;
                  }
                  const selected =
                    activeGroupIndex !== null &&
                    menuGroups[activeGroupIndex]?.selectedBeverageCategories.includes(id);
                  const occupiedGroup = menuGroups.find(
                    (g, index) => index !== activeGroupIndex && g.selectedBeverageCategories.includes(id)
                  );

                  return (
                    <TouchableOpacity
                      key={id}
                      style={[
                        styles.modalRow,
                        selected && styles.modalRowActive,
                        occupiedGroup && { opacity: 0.5 }
                      ]}
                      onPress={() => {
                        if (occupiedGroup) {
                          Toast.show({
                            type: 'error',
                            text1: 'Category Already Selected',
                            text2: `This category is already used in "${occupiedGroup.name}".`,
                          });
                          return;
                        }
                        toggleCategoryForGroup(id);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.modalRowText, selected && styles.modalRowTextActive]}>
                        {getCategoryName(category)}
                      </Text>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />
                      ) : occupiedGroup ? (
                        <Ionicons name="lock-closed-outline" size={16} color={COLORS.muted} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 150,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSpacer: {
    textAlign: 'center',
    width: 36,
  },
  heroImage: {
    width: '100%',
    height: 150,
    borderRadius: 18,
    marginBottom: 14,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.muted,
  },
  valueText: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '600',
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.highlight,
    paddingHorizontal: 14,
    color: COLORS.text,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  layoutRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  layoutCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: COLORS.chip,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  layoutCardActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.chipActive,
  },
  layoutImage: {
    width: '100%',
    height: 74,
    borderRadius: 12,
    marginBottom: 8,
  },
  layoutLabel: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '700',
  },
  topicList: {
    gap: 12,
    marginTop: 12,
  },
  topicCard: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  topicCardActive: {
    borderColor: COLORS.accent,
  },
  topicImage: {
    width: '100%',
    height: 120,
  },
  topicOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  topicOverlayActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  topicTitle: {
    fontSize: 15,
    color: '#FFF9F3',
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  topicTitleActive: {
    color: '#FFFDF9',
  },
  styleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingRight: 12,
    paddingBottom: 6,
    overflow: 'visible',
  },
  styleChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: COLORS.chip,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  styleChipActive: {
    backgroundColor: COLORS.chipActive,
    borderColor: COLORS.accent,
  },
  styleChipText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '700',
  },
  styleChipTextActive: {
    color: COLORS.text,
  },
  pricingRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingBottom: 8,
    overflow: 'visible',
  },
  pricingChip: {
    minWidth: 150,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.chip,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  pricingChipActive: {
    backgroundColor: COLORS.chipActive,
    borderColor: COLORS.accent,
  },
  pricingLabel: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  pricingRange: {
    fontSize: 10,
    color: COLORS.muted,
    textAlign: 'center',
  },
  pricingLabelActive: {
    color: COLORS.text,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  optionChip: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: COLORS.chip,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  optionChipActive: {
    backgroundColor: COLORS.chipActive,
    borderColor: COLORS.accent,
  },
  optionChipText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '700',
  },
  optionChipTextActive: {
    color: COLORS.text,
  },
  groupBadge: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  groupBadgeText: {
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: '600',
  },
  groupList: {
    marginTop: 12,
    gap: 12,
    paddingBottom: 6,
    overflow: 'visible',
  },
  groupSwipeContainer: {
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  groupSwipeChildren: {
    overflow: 'visible',
    paddingBottom: 6,
  },
  groupCardShadow: {
    borderRadius: 16,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  groupCard: {
    backgroundColor: COLORS.chip,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '700',
  },
  groupCountChip: {
    backgroundColor: COLORS.highlight,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  groupCountText: {
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: '600',
  },
  groupAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  groupAddText: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: '700',
  },
  groupCategoryEmpty: {
    fontSize: 11,
    color: COLORS.muted,
  },
  groupCategoryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  groupCategoryChip: {
    backgroundColor: '#F7ECDD',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  groupCategoryText: {
    fontSize: 10,
    color: COLORS.text,
    fontWeight: '700',
  },
  swipeActions: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  swipeDelete: {
    backgroundColor: '#B65A4A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeDeleteText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  groupInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupInput: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    backgroundColor: COLORS.highlight,
    color: COLORS.text,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  groupInputAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeToggleRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  recipeToggleActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  recipeToggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recipeRadioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  recipeRadioOuterActive: {
    borderColor: COLORS.accent,
  },
  recipeRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  recipeToggleText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#2A1810',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A1810',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.chip,
  },
  modalHint: {
    fontSize: 12,
    color: COLORS.muted,
  },
  modalList: {
    marginTop: 6,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.highlight,
    marginBottom: 8,
  },
  modalRowActive: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.chipActive,
  },
  modalRowText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  modalRowTextActive: {
    color: COLORS.accentDark,
  },
});
