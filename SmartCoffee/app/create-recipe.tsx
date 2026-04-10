import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

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

type IngredientItem = {
  name: string;
  note: string;
  amount: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  iconColor: string;
};

type StepItem = {
  title: string;
  body: string;
};

const initialIngredients: IngredientItem[] = [
  {
    name: 'Espresso Beans',
    note: 'Arabica Blend',
    amount: '18g',
    icon: 'cafe',
    tint: '#F5E7DA',
    iconColor: '#B85C38',
  },
  {
    name: 'Matcha Powder',
    note: 'Ceremonial Grade',
    amount: '2g',
    icon: 'leaf',
    tint: '#E6F4EA',
    iconColor: '#3E9B63',
  },
  {
    name: 'Hot Water',
    note: '80°C',
    amount: '30ml',
    icon: 'water',
    tint: '#E9F1FF',
    iconColor: '#3A74D8',
  },
];

const initialSteps: StepItem[] = [
  {
    title: 'Prepare Matcha Base',
    body:
      'Whisk 2g matcha powder with 30ml warm water until smooth and frothy. Ensure no clumps remain.',
  },
  {
    title: 'Extract Espresso',
    body:
      'Pull a double shot of espresso (18g in, 36g out) directly over the serving glass or into a small pitcher.',
  },
];

const categories = ['Coffee', 'Tea', 'Mocktail', 'Chocolate'];
const primaryStyles = ['Sweet', 'Nutty', 'Fruity', 'Floral'];
const secondaryStyles = ['Creamy', 'Spicy', 'Citrus', 'Smooth'];
const difficulties = ['Beginner', 'Intermediate', 'Advanced'];
const brewingMethods = ['Espresso Machine', 'Pour Over', 'French Press', 'Cold Brew'];
const marginOptions = ['45%', '55%', '65%', '75%'];

export default function CreateRecipeScreen() {
  const router = useRouter();
  const [hasCover, setHasCover] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [source, setSource] = useState('');
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [secondaryIndex, setSecondaryIndex] = useState(0);
  const [notes, setNotes] = useState<string[]>(['Caramel', 'Vanilla']);
  const [noteDraft, setNoteDraft] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [isHot, setIsHot] = useState(true);
  const [isIce, setIsIce] = useState(true);
  const [isCold, setIsCold] = useState(false);
  const [isMilk, setIsMilk] = useState(true);
  const [strength, setStrength] = useState(0.72);
  const [price, setPrice] = useState('');
  const [marginIndex, setMarginIndex] = useState(2);
  const [difficultyIndex, setDifficultyIndex] = useState(0);
  const [prepMin, setPrepMin] = useState('');
  const [prepMax, setPrepMax] = useState('');
  const [ingredients, setIngredients] = useState<IngredientItem[]>(initialIngredients);
  const [showIngredientInput, setShowIngredientInput] = useState(false);
  const [ingredientDraft, setIngredientDraft] = useState({ name: '', note: '', amount: '' });
  const [brewIndex, setBrewIndex] = useState(0);
  const [steps, setSteps] = useState<StepItem[]>(initialSteps);
  const [showStepInput, setShowStepInput] = useState(false);
  const [stepDraft, setStepDraft] = useState({ title: '', body: '' });

  const strengthLabel = useMemo(() => {
    if (strength < 0.33) return 'Decaf';
    if (strength < 0.66) return 'Regular';
    return 'High';
  }, [strength]);

  const handleAddNote = () => {
    const trimmed = noteDraft.trim();
    if (!trimmed) return;
    setNotes((prev) => [...prev, trimmed]);
    setNoteDraft('');
    setShowNoteInput(false);
  };

  const handleAddIngredient = () => {
    const name = ingredientDraft.name.trim();
    const note = ingredientDraft.note.trim();
    const amount = ingredientDraft.amount.trim();
    if (!name || !amount) return;
    setIngredients((prev) => [
      ...prev,
      {
        name,
        note: note || 'Custom',
        amount,
        icon: 'nutrition',
        tint: '#F3EFEA',
        iconColor: palette.accent,
      },
    ]);
    setIngredientDraft({ name: '', note: '', amount: '' });
    setShowIngredientInput(false);
  };

  const handleAddStep = () => {
    const title = stepDraft.title.trim();
    const body = stepDraft.body.trim();
    if (!title || !body) return;
    setSteps((prev) => [...prev, { title, body }]);
    setStepDraft({ title: '', body: '' });
    setShowStepInput(false);
  };

  const applyAiSuggestion = () => {
    setRecipeName('Matcha Espresso Fusion');
    setCategoryIndex(0);
    setPrimaryIndex(2);
    setSecondaryIndex(1);
    setNotes(['Matcha', 'Vanilla', 'Toffee']);
    setDifficultyIndex(1);
    setPrice('55000');
    setMarginIndex(2);
    setPrepMin('3');
    setPrepMax('5');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color={palette.accentDeep} />
          </Pressable>
          <Text style={styles.headerTitle}>Create Recipe</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Pressable
          style={[styles.coverCard, hasCover && styles.coverCardSelected]}
          onPress={() => setHasCover((prev) => !prev)}
        >
          <View style={styles.coverIconWrap}>
            <Ionicons name="camera" size={20} color={palette.accent} />
            <View style={styles.coverPlus}>
              <Ionicons name="add" size={10} color={palette.accent} />
            </View>
          </View>
          <Text style={styles.coverText}>
            {hasCover ? 'Cover Photo Selected' : 'Upload Cover Photo'}
          </Text>
        </Pressable>

        <View style={styles.formBlock}>
          <Text style={styles.sectionLabel}>RECIPE NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Honey Lavender Latte"
            placeholderTextColor={palette.muted}
            value={recipeName}
            onChangeText={setRecipeName}
          />

          <View style={styles.rowSplit}>
            <View style={styles.flexItem}>
              <Text style={styles.sectionLabel}>CATEGORY</Text>
              <Pressable
                style={styles.selectInput}
                onPress={() => setCategoryIndex((prev) => (prev + 1) % categories.length)}
              >
                <Text style={styles.selectText}>{categories[categoryIndex]}</Text>
                <Ionicons name="chevron-down" size={16} color={palette.muted} />
              </Pressable>
            </View>
            <View style={styles.flexItem}>
              <Text style={styles.sectionLabel}>SOURCE</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. In-house"
                placeholderTextColor={palette.muted}
                value={source}
                onChangeText={setSource}
              />
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
                onPress={() => setPrimaryIndex((prev) => (prev + 1) % primaryStyles.length)}
              >
                <Text style={styles.selectText}>{primaryStyles[primaryIndex]}</Text>
                <Ionicons name="chevron-down" size={16} color={palette.muted} />
              </Pressable>
            </View>
            <View style={styles.flexItem}>
              <Text style={styles.fieldLabel}>Secondary Style</Text>
              <Pressable
                style={styles.selectInput}
                onPress={() => setSecondaryIndex((prev) => (prev + 1) % secondaryStyles.length)}
              >
                <Text style={styles.selectText}>{secondaryStyles[secondaryIndex]}</Text>
                <Ionicons name="chevron-down" size={16} color={palette.muted} />
              </Pressable>
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
                onValueChange={setIsHot}
                trackColor={{ false: '#E0D7CF', true: palette.accentDeep }}
                thumbColor="#FFFFFF"
              />
              <Text style={styles.toggleLabel}>Cold</Text>
              <Switch
                value={isCold}
                onValueChange={setIsCold}
                trackColor={{ false: '#E0D7CF', true: palette.accentDeep }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Ice</Text>
              <Switch
                value={isIce}
                onValueChange={setIsIce}
                trackColor={{ false: '#E0D7CF', true: palette.accentDeep }}
                thumbColor="#FFFFFF"
              />
              <Text style={styles.toggleLabel}>Milk</Text>
              <Switch
                value={isMilk}
                onValueChange={setIsMilk}
                trackColor={{ false: '#E0D7CF', true: palette.accentDeep }}
                thumbColor="#FFFFFF"
              />
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
                  onChangeText={setPrice}
                />
                <Text style={styles.inputSuffix}>VND</Text>
              </View>
            </View>
            <View style={styles.flexItem}>
              <Text style={styles.sectionLabel}>EST. MARGIN (%)</Text>
              <Pressable
                style={styles.marginPill}
                onPress={() => setMarginIndex((prev) => (prev + 1) % marginOptions.length)}
              >
                <Text style={styles.marginText}>{marginOptions[marginIndex]}</Text>
                <Ionicons name="trending-up" size={14} color={palette.greenText} />
              </Pressable>
            </View>
          </View>

          <View style={styles.rowSplit}>
            <View style={styles.flexItem}>
              <Text style={styles.sectionLabel}>DIFFICULTY</Text>
              <Pressable
                style={styles.selectInput}
                onPress={() => setDifficultyIndex((prev) => (prev + 1) % difficulties.length)}
              >
                <Text style={styles.selectText}>{difficulties[difficultyIndex]}</Text>
                <Ionicons name="chevron-down" size={16} color={palette.muted} />
              </Pressable>
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
                  onChangeText={setPrepMin}
                />
                <Text style={styles.timeDash}>-</Text>
                <TextInput
                  style={[styles.input, styles.timeInput]}
                  placeholder="5"
                  placeholderTextColor={palette.muted}
                  keyboardType="numeric"
                  value={prepMax}
                  onChangeText={setPrepMax}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="clipboard" size={18} color={palette.accent} />
            <Text style={styles.sectionTitle}>Preparation</Text>
            <Pressable style={styles.aiChip} onPress={applyAiSuggestion}>
              <Ionicons name="sparkles" size={12} color={palette.accentDeep} />
              <Text style={styles.aiChipText}>AI SUGGESTION</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>INGREDIENTS LIST</Text>
          {ingredients.map((item, index) => (
            <View key={`${item.name}-${index}`} style={styles.ingredientCard}>
              <View style={[styles.ingredientIcon, { backgroundColor: item.tint }]}
              >
                <Ionicons name={item.icon} size={16} color={item.iconColor} />
              </View>
              <View style={styles.ingredientInfo}>
                <Text style={styles.ingredientName}>{item.name}</Text>
                <Text style={styles.ingredientNote}>{item.note}</Text>
              </View>
              <View style={styles.ingredientAmount}>
                <Text style={styles.ingredientAmountText}>{item.amount}</Text>
              </View>
            </View>
          ))}

          {!showIngredientInput ? (
            <Pressable style={styles.addRow} onPress={() => setShowIngredientInput(true)}>
              <Ionicons name="add" size={16} color={palette.accentDeep} />
              <Text style={styles.addRowText}>Add Ingredient</Text>
            </Pressable>
          ) : (
            <View style={styles.inlineForm}>
              <TextInput
                style={styles.input}
                placeholder="Ingredient name"
                placeholderTextColor={palette.muted}
                value={ingredientDraft.name}
                onChangeText={(text) =>
                  setIngredientDraft((prev) => ({ ...prev, name: text }))
                }
              />
              <View style={styles.rowSplit}>
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  placeholder="Note"
                  placeholderTextColor={palette.muted}
                  value={ingredientDraft.note}
                  onChangeText={(text) =>
                    setIngredientDraft((prev) => ({ ...prev, note: text }))
                  }
                />
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  placeholder="Amount"
                  placeholderTextColor={palette.muted}
                  value={ingredientDraft.amount}
                  onChangeText={(text) =>
                    setIngredientDraft((prev) => ({ ...prev, amount: text }))
                  }
                />
              </View>
              <View style={styles.inlineActions}>
                <Pressable style={styles.primaryAction} onPress={handleAddIngredient}>
                  <Text style={styles.primaryActionText}>Add</Text>
                </Pressable>
                <Pressable
                  style={styles.ghostAction}
                  onPress={() => {
                    setIngredientDraft({ name: '', note: '', amount: '' });
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
            onPress={() => setBrewIndex((prev) => (prev + 1) % brewingMethods.length)}
          >
            <Text style={styles.selectText}>{brewingMethods[brewIndex]}</Text>
            <Ionicons name="chevron-down" size={16} color={palette.muted} />
          </Pressable>

          <Text style={styles.sectionLabel}>STEPS</Text>
          {steps.map((step, index) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.stepIndicator}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
              </View>
              <View style={styles.stepCard}>
                <Text style={styles.stepTitle}>{step.title}</Text>
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
                onChangeText={(text) => setStepDraft((prev) => ({ ...prev, title: text }))}
              />
              <TextInput
                style={[styles.input, styles.stepInput]}
                placeholder="Step description"
                placeholderTextColor={palette.muted}
                value={stepDraft.body}
                onChangeText={(text) => setStepDraft((prev) => ({ ...prev, body: text }))}
                multiline
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
      </ScrollView>
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
    paddingBottom: 40,
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
  rowSplit: {
    flexDirection: 'row',
    gap: 12,
  },
  rowSplitTight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flexItem: {
    flex: 1,
    gap: 8,
  },
  flexInput: {
    flex: 1,
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
  aiChip: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.accentSoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  aiChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.accentDeep,
    letterSpacing: 0.4,
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
  stepTitle: {
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
});
