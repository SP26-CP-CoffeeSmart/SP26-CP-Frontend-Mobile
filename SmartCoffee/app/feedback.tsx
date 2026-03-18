import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

type DrinkOption = {
  id: string;
  menuItemId: number;
  name: string;
  subtitle: string;
  image: string;
};

type FiveScaleField = {
  id: 'strength' | 'acidity' | 'bitterness' | 'sweetness';
  label: string;
  options: string[];
};

type MenuItemApi = {
  menuItemId: number;
  description?: string | null;
  shopBeverage?: {
    name?: string | null;
    beverageCategoryName?: string | null;
    imageUrl?: string | null;
  };
  shopRecipe?: {
    recipeName?: string | null;
    image?: string | null;
  };
};

type MenuGroupApi = {
  name?: string | null;
  menuItems?: MenuItemApi[];
};

type MenuVersionApi = {
  menuId: number;
  isActive?: boolean;
  menuGroups?: MenuGroupApi[];
};

const COLORS = {
  page: '#F8F5F2',
  card: '#FFFFFF',
  text: '#3A231B',
  subtext: '#7F6A5F',
  border: '#E6DBD2',
  borderStrong: '#CDB8AA',
  primary: '#5B3428',
  primarySoft: '#EFE3DB',
  accent: '#C89A5D',
  mutedBg: '#F7F2EE',
  starOn: '#E6B35A',
  starOff: '#DCCFC4',
};

const fallbackDrinkImage =
  'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=400&q=80';

const TASTE_FIELDS: FiveScaleField[] = [
  {
    id: 'strength',
    label: 'Strength',
    options: ['Very light', 'Light', 'Medium', 'Strong', 'Very strong'],
  },
  {
    id: 'acidity',
    label: 'Acidity',
    options: ['Very low', 'Low', 'Medium', 'High', 'Very high'],
  },
  {
    id: 'bitterness',
    label: 'Bitterness',
    options: ['Very low', 'Low', 'Medium', 'High', 'Very high'],
  },
  {
    id: 'sweetness',
    label: 'Sweetness',
    options: ['Not sweet', 'Slightly sweet', 'Medium', 'Sweet', 'Very sweet'],
  },
];

const PRICE_OPTIONS = ['Cheap', 'Reasonable', 'A bit expensive', 'Too expensive'];
const REPURCHASE_OPTIONS = ['Yes', 'Maybe', 'No'] as const;

export default function FeedbackScreen() {
  const router = useRouter();
  const { menuName, menuId } = useLocalSearchParams<{ menuName?: string; menuId?: string }>();

  const [searchText, setSearchText] = useState('');
  const [drinks, setDrinks] = useState<DrinkOption[]>([]);
  const [selectedDrinkId, setSelectedDrinkId] = useState<string>('');
  const [resolvedMenuId, setResolvedMenuId] = useState<number | null>(null);
  const [drinksLoading, setDrinksLoading] = useState(false);
  const [drinksError, setDrinksError] = useState<string | null>(null);

  const [isFirstTry, setIsFirstTry] = useState<boolean | null>(null);
  const [overallRating, setOverallRating] = useState(0);
  const [priceValue, setPriceValue] = useState<string | null>(null);
  const [repurchase, setRepurchase] = useState<(typeof REPURCHASE_OPTIONS)[number] | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [tasteProfile, setTasteProfile] = useState<Record<FiveScaleField['id'], number>>({
    strength: 2,
    acidity: 2,
    bitterness: 2,
    sweetness: 2,
  });

  useEffect(() => {
    let isCancelled = false;

    const resolveDrinkImage = (item: MenuItemApi) => {
      const raw = item.shopRecipe?.image ?? item.shopBeverage?.imageUrl ?? null;
      if (!raw || raw === 'null' || raw === 'undefined') return fallbackDrinkImage;
      if (typeof raw === 'string' && (raw.startsWith('http://') || raw.startsWith('https://'))) {
        return raw;
      }
      return fallbackDrinkImage;
    };

    const fetchMenuDrinks = async () => {
      if (!menuId) {
        setDrinksError('Menu id is missing.');
        return;
      }

      const parsedMenuHeaderId = Number(menuId);
      if (!Number.isFinite(parsedMenuHeaderId)) {
        setDrinksError('Invalid menu id.');
        return;
      }

      setDrinksLoading(true);
      setDrinksError(null);

      try {
        const response = await authorizedFetch(API_ENDPOINTS.menu.byHeader(parsedMenuHeaderId));
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = (await response.json()) as MenuVersionApi[];
        const list = Array.isArray(data) ? data : [];
        const activeMenu = list.find((m) => m?.isActive) ?? list[0] ?? null;

        if (!activeMenu) {
          throw new Error('No menu version found.');
        }

        const groups = Array.isArray(activeMenu.menuGroups) ? activeMenu.menuGroups : [];
        const mappedDrinks: DrinkOption[] = [];

        groups.forEach((group) => {
          const groupItems = Array.isArray(group.menuItems) ? group.menuItems : [];
          groupItems.forEach((item) => {
            const menuItemId = Number(item.menuItemId);
            if (!Number.isFinite(menuItemId)) return;

            const name =
              item.shopRecipe?.recipeName?.trim() ||
              item.shopBeverage?.name?.trim() ||
              `Menu Item #${menuItemId}`;

            const subtitle =
              item.shopBeverage?.beverageCategoryName?.trim() ||
              group?.name?.trim() ||
              'Menu drink';

            mappedDrinks.push({
              id: String(menuItemId),
              menuItemId,
              name,
              subtitle,
              image: resolveDrinkImage(item),
            });
          });
        });

        if (isCancelled) return;

        setResolvedMenuId(Number(activeMenu.menuId));
        setDrinks(mappedDrinks);

        if (mappedDrinks.length > 0) {
          setSelectedDrinkId(mappedDrinks[0].id);
        }
      } catch (error) {
        if (isCancelled) return;
        setDrinksError('Unable to load drink list from current menu.');
      } finally {
        if (isCancelled) return;
        setDrinksLoading(false);
      }
    };

    fetchMenuDrinks();

    return () => {
      isCancelled = true;
    };
  }, [menuId]);

  const filteredDrinks = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return drinks;
    return drinks.filter((drink) => `${drink.name} ${drink.subtitle}`.toLowerCase().includes(term));
  }, [searchText, drinks]);

  const selectedDrink =
    drinks.find((item) => item.id === selectedDrinkId) ??
    filteredDrinks[0] ??
    null;

  const setScaleValue = (field: FiveScaleField['id'], index: number) => {
    setTasteProfile((prev) => ({ ...prev, [field]: index }));
  };

  const handleSubmit = async () => {
    if (!selectedDrink || !resolvedMenuId) {
      Toast.show({
        type: 'error',
        text1: 'Missing drink',
        text2: 'Please select a drink from the current menu.',
      });
      return;
    }

    if (overallRating === 0 || !priceValue || !repurchase || isFirstTry === null) {
      Toast.show({
        type: 'error',
        text1: 'Missing information',
        text2: 'Please complete required feedback fields before submitting.',
      });
      return;
    }

    const payload = {
      isFirstTimeTrying: isFirstTry,
      strength: TASTE_FIELDS[0].options[tasteProfile.strength],
      acidity: TASTE_FIELDS[1].options[tasteProfile.acidity],
      bitterness: TASTE_FIELDS[2].options[tasteProfile.bitterness],
      sweetness: TASTE_FIELDS[3].options[tasteProfile.sweetness],
      rating: overallRating,
      priceRating: priceValue,
      repurchasable: repurchase,
      comment: comment.trim(),
      ratedBy: 'CoffeeShop',
    };

    try {
      setSubmitting(true);
      const response = await authorizedFetch(
        API_ENDPOINTS.feedback.byMenuItem(resolvedMenuId, selectedDrink.menuItemId),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: '*/*',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed: ${response.status}`);
      }

      Toast.show({
        type: 'success',
        text1: 'Thanks for your feedback!',
        text2: `Recorded for ${selectedDrink.name}.`,
      });
      router.back();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Submit failed',
        text2: error instanceof Error ? error.message : 'Unable to submit feedback.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.brandIdentity}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>☕</Text>
            </View>
            <Text style={styles.brandText} numberOfLines={1}>
              {menuName || 'SmartCoffee'}
            </Text>
          </View>
          <View style={styles.backButtonGhost} />
        </View>

        <Text style={styles.pageTitle}>Coffee Feedback</Text>
        <Text style={styles.pageSubtitle}>
          We value your opinion! Tell us about your recent brew to help us improve.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Drink Information</Text>
          <Text style={styles.inputLabel}>Search for your drink</Text>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={14} color={COLORS.subtext} />
            <TextInput
              placeholder="e.g. Mocha, Latte, Americano..."
              placeholderTextColor={COLORS.subtext}
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>

          {drinksLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading drinks...</Text>
            </View>
          ) : drinksError ? (
            <Text style={styles.errorText}>{drinksError}</Text>
          ) : filteredDrinks.length === 0 ? (
            <Text style={styles.errorText}>No drinks found in this menu.</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.drinkOptionsRow}
            >
              {filteredDrinks.map((drink) => {
                const selected = drink.id === selectedDrinkId;
                return (
                  <TouchableOpacity
                    key={drink.id}
                    style={[styles.drinkCard, selected && styles.drinkCardSelected]}
                    activeOpacity={0.9}
                    onPress={() => setSelectedDrinkId(drink.id)}
                  >
                    <Image source={{ uri: drink.image }} style={styles.drinkImage} />
                    <Text style={styles.drinkName}>{drink.name}</Text>
                    <Text style={styles.drinkSubtitle}>{drink.subtitle}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.booleanRow}>
            <Text style={styles.booleanQuestion}>Is this your first time trying this drink?</Text>
            <View style={styles.binaryButtons}>
              <TouchableOpacity
                style={[styles.binaryButton, isFirstTry === true && styles.binaryButtonActive]}
                onPress={() => setIsFirstTry(true)}
              >
                <Text style={[styles.binaryButtonText, isFirstTry === true && styles.binaryButtonTextActive]}>
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.binaryButton, isFirstTry === false && styles.binaryButtonActive]}
                onPress={() => setIsFirstTry(false)}
              >
                <Text
                  style={[styles.binaryButtonText, isFirstTry === false && styles.binaryButtonTextActive]}
                >
                  No
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Taste Profile</Text>
          {TASTE_FIELDS.map((field) => (
            <View key={field.id} style={styles.tasteBlock}>
              <Text style={styles.tasteLabel}>{field.label}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scaleRow}
              >
                {field.options.map((option, index) => {
                  const selected = tasteProfile[field.id] === index;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.scalePill, selected && styles.scalePillActive]}
                      onPress={() => setScaleValue(field.id, index)}
                    >
                      <Text style={[styles.scalePillText, selected && styles.scalePillTextActive]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Price & Value</Text>
          <Text style={styles.inputLabel}>How was the price?</Text>
          <View style={styles.radioList}>
            {PRICE_OPTIONS.map((option) => {
              const selected = priceValue === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.radioItem, selected && styles.radioItemActive]}
                  onPress={() => setPriceValue(option)}
                >
                  <View style={[styles.radioCircle, selected && styles.radioCircleActive]} />
                  <Text style={styles.radioText}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Repurchase Intent</Text>
          <Text style={styles.inputLabel}>Will you order this drink again?</Text>
          <View style={styles.repurchaseRow}>
            {REPURCHASE_OPTIONS.map((option) => {
              const selected = repurchase === option;
              const iconName =
                option === 'Yes' ? 'thumbs-up-outline' : option === 'No' ? 'thumbs-down-outline' : 'help-outline';
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.repurchaseButton, selected && styles.repurchaseButtonActive]}
                  onPress={() => setRepurchase(option)}
                >
                  <Ionicons
                    name={iconName}
                    size={14}
                    color={selected ? COLORS.card : COLORS.subtext}
                  />
                  <Text
                    style={[
                      styles.repurchaseButtonText,
                      selected && styles.repurchaseButtonTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.ratingTitle}>Overall rating</Text>
          <Text style={styles.ratingSubTitle}>How was your experience overall?</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => {
              const active = star <= overallRating;
              return (
                <TouchableOpacity key={star} onPress={() => setOverallRating(star)} style={styles.starButton}>
                  <Ionicons
                    name={active ? 'star' : 'star-outline'}
                    size={28}
                    color={active ? COLORS.starOn : COLORS.starOff}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Comment</Text>
          <Text style={styles.inputLabel}>Share more details about your drink experience</Text>
          <TextInput
            style={styles.commentInput}
            multiline
            numberOfLines={5}
            value={comment}
            onChangeText={setComment}
            placeholder="Tell us what you liked or what should be improved..."
            placeholderTextColor={COLORS.subtext}
            textAlignVertical="top"
          />
        </View>

        <Text style={styles.footerText}>Thank you for helping us make our coffee better!</Text>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting || drinksLoading || !selectedDrink}
        >
          <Text style={styles.submitButtonText}>{submitting ? 'Submitting...' : 'Submit Feedback'}</Text>
          <Ionicons name="arrow-forward" size={16} color={COLORS.card} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.page,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 40,
    paddingTop: 14,
    gap: 16,
  },
  brandRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  backButtonGhost: {
    width: 40,
    height: 40,
  },
  brandIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  logoEmoji: {
    fontSize: 15,
  },
  brandText: {
    maxWidth: 180,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  pageTitle: {
    width: '100%',
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  pageSubtitle: {
    width: '100%',
    marginTop: -6,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.subtext,
    textAlign: 'center',
  },
  menuContext: {
    width: '100%',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accent,
    textAlign: 'left',
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTitle: {
    width: '100%',
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'left',
  },
  inputLabel: {
    width: '100%',
    fontSize: 12,
    color: COLORS.subtext,
    fontWeight: '600',
    textAlign: 'left',
  },
  searchBox: {
    width: '100%',
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.mutedBg,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  loadingRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.subtext,
  },
  errorText: {
    fontSize: 13,
    color: '#B4482D',
    textAlign: 'left',
  },
  drinkOptionsRow: {
    gap: 12,
    paddingVertical: 2,
  },
  drinkCard: {
    width: 118,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 8,
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  drinkCardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.primarySoft,
  },
  drinkImage: {
    width: '100%',
    height: 74,
    borderRadius: 10,
    marginBottom: 8,
  },
  drinkName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  drinkSubtitle: {
    fontSize: 11,
    color: COLORS.subtext,
    textAlign: 'center',
  },
  booleanRow: {
    marginTop: 4,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  booleanQuestion: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'left',
  },
  binaryButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  binaryButton: {
    minWidth: 64,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  binaryButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  binaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.subtext,
  },
  binaryButtonTextActive: {
    color: COLORS.card,
  },
  tasteBlock: {
    width: '100%',
    gap: 9,
  },
  tasteLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'left',
  },
  scaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  scalePill: {
    minWidth: 104,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  scalePillActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  scalePillText: {
    fontSize: 11,
    color: COLORS.subtext,
    textAlign: 'center',
    fontWeight: '600',
  },
  scalePillTextActive: {
    color: COLORS.card,
  },
  ratingTitle: {
    width: '100%',
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'left',
  },
  ratingSubTitle: {
    width: '100%',
    fontSize: 13,
    textAlign: 'left',
    color: COLORS.subtext,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 6,
    gap: 8,
  },
  starButton: {
    padding: 2,
  },
  radioList: {
    width: '100%',
    gap: 8,
    marginTop: 2,
  },
  radioItem: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  radioItemActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  radioCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.card,
  },
  radioCircleActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  radioText: {
    fontSize: 13,
    color: COLORS.text,
  },
  repurchaseRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  repurchaseButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  repurchaseButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  repurchaseButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.subtext,
  },
  repurchaseButtonTextActive: {
    color: COLORS.card,
  },
  commentInput: {
    width: '100%',
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.mutedBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
    textAlign: 'left',
  },
  footerText: {
    width: '100%',
    marginTop: 2,
    textAlign: 'left',
    color: COLORS.subtext,
    fontSize: 12,
  },
  submitButton: {
    marginTop: 6,
    width: '100%',
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.card,
    fontSize: 15,
    fontWeight: '800',
  },
});
