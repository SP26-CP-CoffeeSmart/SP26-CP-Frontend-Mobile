import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

type ExportNoteResponse = {
  exportNoteId?: number;
};

type ExportSubmitDraft = {
  noteTitle: string;
  details: ExportDetail[];
};

type AlertModalState = {
  visible: boolean;
  title: string;
  message: string;
  tone: 'warning' | 'error';
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
  const [alertModal, setAlertModal] = useState<AlertModalState>({
    visible: false,
    title: '',
    message: '',
    tone: 'warning',
  });
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [submitDraft, setSubmitDraft] = useState<ExportSubmitDraft | null>(null);

  const categoryOptions = useMemo(() => {
    const unique = Array.from(
      new Set(ingredients.map((item) => item.category).filter((category) => category))
    );
    return ['All', ...unique];
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ingredients.filter((item) => {
      if (item.currentQuantity <= 0) {
        return false;
      }
      const matchesCategory =
        selectedCategory === 'All' || item.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesQuery = !query || item.name.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [ingredients, searchQuery, selectedCategory]);
  const hasExportableIngredients = ingredients.some((item) => item.currentQuantity > 0);

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
    if (ingredient.currentQuantity <= 0) {
      showAlertModal('Out of stock', `${ingredient.name} has no available quantity to export.`);
      return;
    }

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

  const showAlertModal = (title: string, message: string, tone: AlertModalState['tone'] = 'warning') => {
    setAlertModal({
      visible: true,
      title,
      message,
      tone,
    });
  };

  const closeAlertModal = () => {
    setAlertModal((prev) => ({ ...prev, visible: false }));
  };

  const closeConfirmModal = () => {
    setConfirmVisible(false);
    setSubmitDraft(null);
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }
    if (!coffeeShopId) {
      showAlertModal('Missing shop', 'Please sign in again to continue.', 'error');
      return;
    }
    if (!hasExportableIngredients) {
      showAlertModal('No exportable ingredients', 'There are no ingredients with available stock to export.');
      return;
    }
    if (!details.length) {
      showAlertModal('Missing items', 'Please add at least one ingredient to export.');
      return;
    }

    const titleToUse = noteTitle.trim();
    if (!titleToUse) {
      showAlertModal('Missing title', 'Please enter an export note title.');
      return;
    }

    const invalidDetail = details.find(
      (detail) => detail.exportQuantity > detail.ingredient.currentQuantity
    );

    if (invalidDetail) {
      showAlertModal('Export failed', `${invalidDetail.ingredient.name} exceeds available stock.`, 'error');
      return;
    }

    if (details.some((detail) => detail.exportQuantity <= 0)) {
      showAlertModal(
        'Invalid quantity',
        'All selected ingredients must have export quantity greater than 0.'
      );
      return;
    }

    setSubmitDraft({
      noteTitle: titleToUse,
      details: details.map((detail) => ({
        ...detail,
        ingredient: { ...detail.ingredient },
      })),
    });
    setConfirmVisible(true);
  };

  const confirmSubmit = async () => {
    if (!coffeeShopId || !submitDraft) {
      return;
    }
    if (!submitDraft.details.length) {
      setConfirmVisible(false);
      showAlertModal('Missing items', 'Please add at least one ingredient to export.');
      return;
    }

    const invalidDetail = submitDraft.details.find(
      (detail) => detail.exportQuantity > detail.ingredient.currentQuantity
    );

    if (invalidDetail) {
      setConfirmVisible(false);
      showAlertModal('Export failed', `${invalidDetail.ingredient.name} exceeds available stock.`, 'error');
      return;
    }

    if (submitDraft.details.some((detail) => detail.exportQuantity <= 0)) {
      setConfirmVisible(false);
      showAlertModal(
        'Invalid quantity',
        'All selected ingredients must have export quantity greater than 0.'
      );
      return;
    }

    const itemsToExport = submitDraft.details.map((detail) => ({
      ingredientId: detail.ingredientId,
      quantityToSubtract: detail.exportQuantity,
    }));
    if (!itemsToExport.length) {
      setConfirmVisible(false);
      showAlertModal('Missing items', 'Please add at least one ingredient to export.');
      return;
    }

    try {
      setIsSubmitting(true);
      setConfirmVisible(false);
      const noteResponse = await authorizedFetch(API_ENDPOINTS.exportNote.create(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coffeeShopId,
          title: submitDraft.noteTitle,
          createdAt: new Date().toISOString(),
        }),
      });

      if (!noteResponse.ok) {
        throw new Error(`Request failed: ${noteResponse.status}`);
      }

      const noteData = (await noteResponse.json()) as ExportNoteResponse;
      if (!noteData.exportNoteId) {
        throw new Error('Export note id is missing in response.');
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

      const detailPayloads = submitDraft.details.map((detail) => ({
          exportNoteId: noteData.exportNoteId,
          ingredientId: detail.ingredientId,
          currentQuantity: detail.ingredient.currentQuantity ?? 0,
          exportQuantity: detail.exportQuantity,
          remainQuantity: Math.max(
            (detail.ingredient.currentQuantity ?? 0) - detail.exportQuantity,
            0
          ),
          measurement: detail.ingredient.measurement ?? null,
        }));

      await Promise.all(
        detailPayloads.map(async (payload) => {
          const detailResponse = await authorizedFetch(API_ENDPOINTS.exportDetail.create(), {
            method: 'POST',
            headers: {
              Accept: '*/*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!detailResponse.ok) {
            throw new Error(`Request failed: ${detailResponse.status}`);
          }
        })
      );

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
      setSubmitDraft(null);
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
              <Text style={styles.emptyText}>
                {hasExportableIngredients
                  ? 'No ingredients found for this filter.'
                  : 'No ingredients available to export.'}
              </Text>
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
          disabled={isSubmitting || !hasExportableIngredients}
        >
          <Ionicons name="log-out" size={18} color="#FFFFFF" />
          <Text style={styles.submitText}>
            {isSubmitting ? 'Submitting...' : 'Submit Export Request'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={alertModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeAlertModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModalCard}>
            <View
              style={[
                styles.modalIconWrap,
                alertModal.tone === 'error' ? styles.modalIconError : styles.modalIconWarning,
              ]}
            >
              <Ionicons
                name={alertModal.tone === 'error' ? 'close-circle' : 'alert-circle'}
                size={24}
                color={alertModal.tone === 'error' ? '#B91C1C' : '#A16207'}
              />
            </View>
            <Text style={styles.modalTitle}>{alertModal.title}</Text>
            <Text style={styles.modalMessage}>{alertModal.message}</Text>
            <TouchableOpacity style={styles.modalSingleButton} onPress={closeAlertModal}>
              <Text style={styles.modalPrimaryText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={closeConfirmModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="log-out-outline" size={24} color={COLORS.accent} />
            </View>
            <Text style={styles.modalTitle}>Confirm export request</Text>
            <Text style={styles.modalMessage}>
              Submit export with {submitDraft?.details.length ?? 0} items and update inventory now?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={closeConfirmModal}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={confirmSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.modalPrimaryText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 22, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  alertModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    gap: 10,
  },
  modalIconWrap: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
  },
  modalIconWarning: {
    backgroundColor: '#FEF3C7',
  },
  modalIconError: {
    backgroundColor: '#FEE2E2',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalPrimaryButton: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  modalSingleButton: {
    marginTop: 4,
    width: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  modalPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modalSecondaryButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  modalSecondaryText: {
    color: COLORS.ink,
    fontSize: 13,
    fontWeight: '700',
  },
});
