import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
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
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';

const COLORS = {
  background: '#F7F2EE',
  card: '#FFFFFF',
  ink: '#1E1B16',
  muted: '#7A6F67',
  accent: '#2B1C15',
  accentSoft: '#E6D7C9',
  border: '#EFE4D8',
  surface: '#FBF7F2',
  warning: '#B91C1C',
};

type Ingredient = {
  ingredientId: number;
  name: string;
  image?: string | null;
  category: string;
  measurement: string;
  currentQuantity: number;
};

type ShopInventoryItem = {
  inventoryDetailId: number;
  ingredientId?: number;
  quantity?: number;
  measurement?: string;
  ingredient?: {
    ingredientId: number;
    name: string;
    category: string;
    image: string | null;
  } | null;
};

type ExportDetail = {
  ingredientId: number;
  ingredient: Ingredient;
  exportQuantity: number;
  reason: string;
};

const REASONS = ['Daily Sales', 'Internal Use', 'Expired', 'Damaged'];

export default function ExportRequestScreen() {
  const router = useRouter();
  const { coffeeShopId } = useAuth();
  const [noteTitle, setNoteTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [details, setDetails] = useState<ExportDetail[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoryOptions = useMemo(() => {
    const unique = Array.from(
      new Set(ingredients.map((item) => item.category).filter((category) => category))
    );
    return ['All', ...unique];
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ingredients.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesQuery = !query || item.name.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [ingredients, searchQuery, selectedCategory]);

  const loadInventory = useCallback(async () => {
    if (!coffeeShopId) {
      setIngredients([]);
      setLoadError('Missing shop information. Please log in again.');
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);
      const response = await authorizedFetch(API_ENDPOINTS.shopInventory.getByShop(coffeeShopId), {
        headers: {
          Accept: '*/*',
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = (await response.json()) as ShopInventoryItem[];
      const mapped: Ingredient[] = (Array.isArray(data) ? data : []).map((item) => {
        const rawId = item.ingredientId ?? item.ingredient?.ingredientId ?? item.inventoryDetailId;
        const ingredientId = Number.isFinite(rawId) ? Number(rawId) : item.inventoryDetailId;
        return {
          ingredientId,
          name: item.ingredient?.name || `Ingredient #${item.inventoryDetailId}`,
          image: item.ingredient?.image ?? null,
          category: item.ingredient?.category || 'Uncategorized',
          measurement: item.measurement || 'unit',
          currentQuantity: Number(item.quantity ?? 0),
        };
      });
      setIngredients(mapped);
      if (selectedCategory !== 'All' && !mapped.some((item) => item.category === selectedCategory)) {
        setSelectedCategory('All');
      }
    } catch (error) {
      setLoadError('Unable to load inventory for this shop.');
      setIngredients([]);
    } finally {
      setLoading(false);
    }
  }, [coffeeShopId, selectedCategory]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const handleAddIngredient = (ingredient: Ingredient) => {
    setDetails((prev) => {
      const existing = prev.find((detail) => detail.ingredientId === ingredient.ingredientId);
      if (existing) {
        return prev.map((detail) =>
          detail.ingredientId === ingredient.ingredientId
            ? { ...detail, exportQuantity: detail.exportQuantity + 1 }
            : detail
        );
      }

      return [
        ...prev,
        {
          ingredientId: ingredient.ingredientId,
          ingredient,
          exportQuantity: 1,
          reason: REASONS[0],
        },
      ];
    });
  };

  const handleUpdateQuantity = (ingredientId: number, delta: number) => {
    setDetails((prev) =>
      prev.map((detail) => {
        if (detail.ingredientId !== ingredientId) {
          return detail;
        }
        const nextQuantity = Math.max(detail.exportQuantity + delta, 0);
        return { ...detail, exportQuantity: nextQuantity };
      })
    );
  };

  const handleRemoveDetail = (ingredientId: number) => {
    setDetails((prev) => prev.filter((detail) => detail.ingredientId !== ingredientId));
  };

  const handleUpdateReason = (ingredientId: number, reason: string) => {
    setDetails((prev) =>
      prev.map((detail) =>
        detail.ingredientId === ingredientId ? { ...detail, reason } : detail
      )
    );
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }
    if (!coffeeShopId) {
      Toast.show({
        type: 'error',
        text1: 'Missing shop',
        text2: 'Please sign in again to continue.',
      });
      return;
    }

    const titleToUse = noteTitle.trim();
    if (!titleToUse) {
      Toast.show({
        type: 'error',
        text1: 'Missing title',
        text2: 'Please enter an export note title.',
      });
      return;
    }

    const invalidDetail = details.find(
      (detail) => detail.exportQuantity > detail.ingredient.currentQuantity
    );

    if (invalidDetail) {
      Toast.show({
        type: 'error',
        text1: 'Export failed',
        text2: `${invalidDetail.ingredient.name} exceeds available stock.`,
      });
      return;
    }

    const itemsToExport = details
      .filter((detail) => detail.exportQuantity > 0)
      .map((detail) => ({
        ingredientId: detail.ingredientId,
        quantityToSubtract: detail.exportQuantity,
      }));

    if (!itemsToExport.length) {
      Alert.alert('Missing items', 'Please add at least one ingredient.');
      return;
    }

    try {
      setIsSubmitting(true);
      const noteResponse = await authorizedFetch(API_ENDPOINTS.exportNote.create(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coffeeShopId,
          title: titleToUse,
          createdAt: new Date().toISOString(),
        }),
      });

      if (!noteResponse.ok) {
        throw new Error(`Request failed: ${noteResponse.status}`);
      }

      const response = await authorizedFetch(API_ENDPOINTS.shopInventory.export(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: itemsToExport }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      Toast.show({
        type: 'success',
        text1: 'Export request submitted',
        text2: 'Inventory was updated successfully.',
      });
      setDetails([]);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Export failed',
        text2: 'Unable to export inventory right now.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={COLORS.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Export Request</Text>
          <View style={styles.headerIconSpacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Export note title</Text>
          <TextInput
            value={noteTitle}
            onChangeText={setNoteTitle}
            placeholder="Daily stock dispatch"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
          />
          <Text style={styles.helperText}>Created today - staff can update later.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Search ingredients</Text>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={COLORS.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search inventory items"
              placeholderTextColor={COLORS.muted}
              style={styles.searchInput}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {categoryOptions.map((category) => {
              const isActive = selectedCategory === category;
              return (
                <TouchableOpacity
                  key={category}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{category}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.ingredientList}>
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={COLORS.accent} />
              </View>
            ) : loadError ? (
              <View style={styles.loadingWrap}>
                <Text style={styles.emptyText}>{loadError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadInventory}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredIngredients.map((ingredient) => (
                <TouchableOpacity
                  key={ingredient.ingredientId}
                  style={styles.ingredientRow}
                  onPress={() => handleAddIngredient(ingredient)}
                >
                  <View style={styles.ingredientImageWrap}>
                    {ingredient.image ? (
                      <Image source={{ uri: ingredient.image }} style={styles.ingredientImage} />
                    ) : (
                      <Ionicons name="cafe" size={22} color={COLORS.muted} />
                    )}
                  </View>
                  <View style={styles.ingredientInfo}>
                    <Text style={styles.ingredientName}>{ingredient.name}</Text>
                    <Text style={styles.ingredientMeta}>
                      {ingredient.category} - {ingredient.currentQuantity} {ingredient.measurement}
                    </Text>
                  </View>
                  <Ionicons name="remove-circle" size={22} color={COLORS.warning} />
                </TouchableOpacity>
              ))
            )}
            {!loading && !loadError && !filteredIngredients.length ? (
              <Text style={styles.emptyText}>No ingredients found for this filter.</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Export details</Text>
          {details.length === 0 ? (
            <Text style={styles.emptyText}>Select ingredients above to build the export note.</Text>
          ) : (
            details.map((detail) => {
              const remain = Math.max(detail.ingredient.currentQuantity - detail.exportQuantity, 0);
              return (
                <View key={detail.ingredientId} style={styles.detailCard}>
                  <View style={styles.detailHeader}>
                    <Text style={styles.detailTitle}>{detail.ingredient.name}</Text>
                    <TouchableOpacity onPress={() => handleRemoveDetail(detail.ingredientId)}>
                      <Ionicons name="close" size={18} color={COLORS.muted} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.detailMeta}>
                    Current: {detail.ingredient.currentQuantity} {detail.ingredient.measurement}
                  </Text>

                  <View style={styles.quantityRow}>
                    <Text style={styles.quantityLabel}>Export quantity</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        style={styles.stepperButton}
                        onPress={() => handleUpdateQuantity(detail.ingredientId, -1)}
                      >
                        <Ionicons name="remove" size={16} color={COLORS.ink} />
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{detail.exportQuantity}</Text>
                      <TouchableOpacity
                        style={styles.stepperButton}
                        onPress={() => handleUpdateQuantity(detail.ingredientId, 1)}
                      >
                        <Ionicons name="add" size={16} color={COLORS.ink} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.detailMeta}>
                    Remaining: {remain} {detail.ingredient.measurement}
                  </Text>

                  <Text style={styles.fieldLabel}>Reason for dispatch</Text>
                  <View style={styles.reasonRow}>
                    {REASONS.map((reason) => {
                      const isActive = detail.reason === reason;
                      return (
                        <TouchableOpacity
                          key={reason}
                          style={[styles.reasonChip, isActive && styles.reasonChipActive]}
                          onPress={() => handleUpdateReason(detail.ingredientId, reason)}
                        >
                          <Text style={[styles.reasonText, isActive && styles.reasonTextActive]}>{reason}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Ionicons name="log-out" size={18} color="#FFFFFF" />
          <Text style={styles.submitText}>
            {isSubmitting ? 'Submitting...' : 'Submit Export Request'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerIconSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.ink,
    backgroundColor: COLORS.surface,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.muted,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    marginBottom: 12,
  },
  searchInput: {
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
    color: COLORS.ink,
  },
  chipRow: {
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 10,
    backgroundColor: COLORS.surface,
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  ingredientList: {
    gap: 12,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  retryButton: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  ingredientImageWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ingredientImage: {
    width: '100%',
    height: '100%',
  },
  ingredientInfo: {
    flex: 1,
    marginLeft: 12,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
  },
  ingredientMeta: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.muted,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  detailCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
  },
  detailMeta: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 10,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quantityLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ink,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: COLORS.card,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
  },
  stepperValue: {
    minWidth: 32,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
    marginHorizontal: 6,
  },
  fieldLabel: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  reasonChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
  },
  reasonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  reasonTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    paddingVertical: 14,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
