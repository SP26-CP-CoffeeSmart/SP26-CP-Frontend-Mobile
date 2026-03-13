import React, { useMemo, useState } from 'react';
import {
  Alert,
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

const COLORS = {
  background: '#F7F2EE',
  card: '#FFFFFF',
  ink: '#1E1B16',
  muted: '#7A6F67',
  accent: '#2B1C15',
  accentSoft: '#E6D7C9',
  border: '#EFE4D8',
  surface: '#FBF7F2',
  success: '#15803D',
};

type Ingredient = {
  ingredientId: number;
  name: string;
  image?: string | null;
  category: string;
  measurement: string;
  currentQuantity: number;
};

type ImportDetail = {
  ingredientId: number;
  ingredient: Ingredient;
  importQuantity: number;
  expirationDate: string;
  supplier: string;
};

const MOCK_INGREDIENTS: Ingredient[] = [
  {
    ingredientId: 1,
    name: 'Arabica Coffee Beans',
    image: 'https://images.unsplash.com/photo-1459755486867-b55449bb39ff?auto=format&fit=crop&w=200&q=60',
    category: 'Coffee Beans',
    measurement: 'kg',
    currentQuantity: 45,
  },
  {
    ingredientId: 2,
    name: 'Full Cream Milk',
    image: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac54?auto=format&fit=crop&w=200&q=60',
    category: 'Milk',
    measurement: 'liters',
    currentQuantity: 32,
  },
  {
    ingredientId: 3,
    name: 'Vanilla Syrup',
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=200&q=60',
    category: 'Syrup',
    measurement: 'bottles',
    currentQuantity: 18,
  },
  {
    ingredientId: 4,
    name: 'Paper Cups 12oz',
    image: 'https://images.unsplash.com/photo-1520315342629-6ea920342047?auto=format&fit=crop&w=200&q=60',
    category: 'Supplies',
    measurement: 'packs',
    currentQuantity: 22,
  },
];

const CATEGORY_OPTIONS = ['All', 'Coffee Beans', 'Milk', 'Syrup', 'Supplies'];

export default function ImportRequestScreen() {
  const router = useRouter();
  const [noteTitle, setNoteTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [details, setDetails] = useState<ImportDetail[]>([]);

  const filteredIngredients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return MOCK_INGREDIENTS.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesQuery = !query || item.name.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, selectedCategory]);

  const handleAddIngredient = (ingredient: Ingredient) => {
    setDetails((prev) => {
      const existing = prev.find((detail) => detail.ingredientId === ingredient.ingredientId);
      if (existing) {
        return prev.map((detail) =>
          detail.ingredientId === ingredient.ingredientId
            ? { ...detail, importQuantity: detail.importQuantity + 1 }
            : detail
        );
      }

      return [
        ...prev,
        {
          ingredientId: ingredient.ingredientId,
          ingredient,
          importQuantity: 1,
          expirationDate: '',
          supplier: '',
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
        const nextQuantity = Math.max(detail.importQuantity + delta, 0);
        return { ...detail, importQuantity: nextQuantity };
      })
    );
  };

  const handleRemoveDetail = (ingredientId: number) => {
    setDetails((prev) => prev.filter((detail) => detail.ingredientId !== ingredientId));
  };

  const handleUpdateDetailField = (
    ingredientId: number,
    field: 'expirationDate' | 'supplier',
    value: string
  ) => {
    setDetails((prev) =>
      prev.map((detail) =>
        detail.ingredientId === ingredientId ? { ...detail, [field]: value } : detail
      )
    );
  };

  const handleSubmit = () => {
    if (!details.length) {
      Alert.alert('Missing items', 'Please add at least one ingredient.');
      return;
    }

    Alert.alert('Import request submitted', 'This is a mock request for now.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={COLORS.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Import Request</Text>
          <View style={styles.headerIconSpacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Import note title</Text>
          <TextInput
            value={noteTitle}
            onChangeText={setNoteTitle}
            placeholder="Morning beans restock"
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
            {CATEGORY_OPTIONS.map((category) => {
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
            {filteredIngredients.map((ingredient) => (
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
                <Ionicons name="add-circle" size={22} color={COLORS.accent} />
              </TouchableOpacity>
            ))}
            {!filteredIngredients.length ? (
              <Text style={styles.emptyText}>No ingredients found for this filter.</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Import details</Text>
          {details.length === 0 ? (
            <Text style={styles.emptyText}>Select ingredients above to build the import note.</Text>
          ) : (
            details.map((detail) => {
              const newTotal = detail.ingredient.currentQuantity + detail.importQuantity;
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
                    <Text style={styles.quantityLabel}>Import quantity</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        style={styles.stepperButton}
                        onPress={() => handleUpdateQuantity(detail.ingredientId, -1)}
                      >
                        <Ionicons name="remove" size={16} color={COLORS.ink} />
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{detail.importQuantity}</Text>
                      <TouchableOpacity
                        style={styles.stepperButton}
                        onPress={() => handleUpdateQuantity(detail.ingredientId, 1)}
                      >
                        <Ionicons name="add" size={16} color={COLORS.ink} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.detailMeta}>New total: {newTotal} {detail.ingredient.measurement}</Text>

                  <Text style={styles.fieldLabel}>Expiry date</Text>
                  <TextInput
                    value={detail.expirationDate}
                    onChangeText={(value) => handleUpdateDetailField(detail.ingredientId, 'expirationDate', value)}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor={COLORS.muted}
                    style={styles.input}
                  />

                  <Text style={styles.fieldLabel}>Supplier</Text>
                  <TextInput
                    value={detail.supplier}
                    onChangeText={(value) => handleUpdateDetailField(detail.ingredientId, 'supplier', value)}
                    placeholder="Highland Roasters Co."
                    placeholderTextColor={COLORS.muted}
                    style={styles.input}
                  />
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Ionicons name="document-text" size={18} color="#FFFFFF" />
          <Text style={styles.submitText}>Submit Import Request</Text>
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
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
