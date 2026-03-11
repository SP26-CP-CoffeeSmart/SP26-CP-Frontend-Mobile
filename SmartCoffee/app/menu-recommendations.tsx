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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';

const COLORS = {
  bg: '#F6F1EB',
  text: '#3C2A21',
  muted: '#8E7B6F',
  border: '#D7C7B8',
  card: '#FFFFFF',
  accent: '#9C7A4B',
  accentDark: '#3C2A21',
  chip: '#E9DFD4',
};

const layoutOptions = [
  {
    key: 'vertical',
    label: 'Vertical',
    image:
      'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=600&q=80&auto=format&fit=crop',
  },
  {
    key: 'horizontal',
    label: 'Horizontal',
    image:
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80&auto=format&fit=crop',
  },
  {
    key: 'descriptive',
    label: 'Descriptive',
    image:
      'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=600&q=80&auto=format&fit=crop',
  },
];

const topics = ['Summer Refresh', 'Winter Warmers', 'Rainy Day Comfort'];
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
  const [categories, setCategories] = useState<BeverageCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [useExistingShopItems, setUseExistingShopItems] = useState(true);

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
    () => Math.max(1, layoutOptions.findIndex((option) => option.key === selectedLayout) + 1),
    [selectedLayout]
  );
  const topicValue = useMemo(
    () => Math.max(1, topics.findIndex((topic) => topic === selectedTopic) + 1),
    [selectedTopic]
  );
  const pricingValue = useMemo(
    () => Math.max(1, pricingOptions.findIndex((option) => option.key === selectedPricing) + 1),
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
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create menu skeleton.';
      router.back();
      Toast.show({ type: 'error', text1: 'Create menu failed', text2: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
              onChangeText={setMenuTitle}
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
              thumbTintColor={COLORS.accentDark}
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
                  >
                    <Image source={{ uri: option.image }} style={styles.layoutImage} />
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
                const active = selectedTopic === topic;
                return (
                  <TouchableOpacity
                    key={topic}
                    style={[styles.topicChip, active && styles.topicChipActive]}
                    onPress={() => setSelectedTopic(topic)}
                  >
                    <Text style={[styles.topicText, active && styles.topicTextActive]}>{topic}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Shop Style</Text>
              <Text style={styles.valueText}>{selectedShopStyle}</Text>
            </View>
            <Text style={styles.helperText}>What vibe did your coffee shop have ?</Text>
            <View style={styles.styleRow}>
              {shopStyles.map((style) => {
                const active = selectedShopStyle === style;
                return (
                  <TouchableOpacity
                    key={style}
                    style={[styles.styleChip, active && styles.styleChipActive]}
                    onPress={() => setSelectedShopStyle(style)}
                  >
                    <Text style={[styles.styleChipText, active && styles.styleChipTextActive]}>
                      {style}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Please specify your coffee shop style"
              placeholderTextColor={COLORS.muted}
              value={shopStyleText}
              onChangeText={setShopStyleText}
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
                <View key={`${group.name}-${index}`} style={styles.groupRow}>
                  <Ionicons name="reorder-three" size={18} color={COLORS.muted} />
                  <View style={styles.groupContent}>
                    <View style={styles.groupHeaderRow}>
                      <Text style={styles.groupText}>{group.name}</Text>
                      <TouchableOpacity
                        style={styles.groupAddButton}
                        onPress={() => openCategoryModal(index)}
                      >
                        <Ionicons name="add" size={16} color={COLORS.accent} />
                        <Text style={styles.groupAddText}>Add beverage category</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.groupDeleteButton}
                        onPress={() => handleRemoveGroup(index)}
                      >
                        <Ionicons name="trash-outline" size={16} color={COLORS.accentDark} />
                      </TouchableOpacity>
                    </View>
                    {group.selectedBeverageCategories.length === 0 ? (
                      <Text style={styles.groupCategoryEmpty}>No beverage categories selected.</Text>
                    ) : (
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
              ))}
              <View style={styles.groupInputRow}>
                <TextInput
                  style={styles.groupInput}
                  placeholder="Menu Group name..."
                  placeholderTextColor={COLORS.muted}
                  value={menuGroupInput}
                  onChangeText={setMenuGroupInput}
                />
                <TouchableOpacity style={styles.groupInputAction} onPress={handleAddGroup}>
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

                  return (
                    <TouchableOpacity
                      key={id}
                      style={[styles.modalRow, selected && styles.modalRowActive]}
                      onPress={() => toggleCategoryForGroup(id)}
                    >
                      <Text style={[styles.modalRowText, selected && styles.modalRowTextActive]}>
                        {getCategoryName(category)}
                      </Text>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
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
    backgroundColor: '#F1E7DC',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerSpacer: {
    textAlign: 'center',
    width: 36,
  },
  heroImage: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
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
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFF7F0',
    paddingHorizontal: 12,
    color: COLORS.text,
    marginTop: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  layoutRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  layoutCard: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: COLORS.chip,
    padding: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  layoutCardActive: {
    borderColor: COLORS.accent,
    backgroundColor: '#F5E7D8',
  },
  layoutImage: {
    width: '100%',
    height: 70,
    borderRadius: 10,
    marginBottom: 6,
  },
  layoutLabel: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  topicList: {
    gap: 10,
    marginTop: 10,
  },
  topicChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.chip,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  topicChipActive: {
    backgroundColor: '#F5E7D8',
    borderColor: COLORS.accent,
  },
  topicText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  topicTextActive: {
    color: COLORS.accentDark,
  },
  styleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  styleChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: COLORS.chip,
  },
  styleChipActive: {
    backgroundColor: COLORS.accentDark,
  },
  styleChipText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  styleChipTextActive: {
    color: '#FFF',
  },
  pricingRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  pricingChip: {
    minWidth: 150,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.chip,
    alignItems: 'center',
  },
  pricingChipActive: {
    backgroundColor: COLORS.accentDark,
  },
  pricingLabel: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  pricingRange: {
    fontSize: 10,
    color: COLORS.muted,
    textAlign: 'center',
  },
  pricingLabelActive: {
    color: '#FFF',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  optionChip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: COLORS.chip,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionChipActive: {
    backgroundColor: '#F5E7D8',
    borderColor: COLORS.accent,
  },
  optionChipText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  optionChipTextActive: {
    color: COLORS.accentDark,
  },
  groupBadge: {
    backgroundColor: '#F2E7DC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  groupBadgeText: {
    fontSize: 10,
    color: COLORS.accent,
    fontWeight: '600',
  },
  groupList: {
    marginTop: 10,
    gap: 10,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.chip,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  groupContent: {
    flex: 1,
    gap: 6,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  groupAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groupAddText: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: '600',
  },
  groupDeleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1E3D5',
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
    fontWeight: '600',
  },
  groupInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    backgroundColor: '#FFF7F0',
    color: COLORS.text,
  },
  groupInputAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1E7DC',
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
    borderColor: COLORS.accentDark,
  },
  recipeRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accentDark,
  },
  recipeToggleText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: COLORS.accentDark,
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
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
    backgroundColor: '#F1E7DC',
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
    backgroundColor: '#F6F1EB',
    marginBottom: 8,
  },
  modalRowActive: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: '#F5E7D8',
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
