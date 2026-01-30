import React, { useMemo, useState } from 'react';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const TAGS = ['Bold', 'Smooth', 'Fruity', 'Nutty', 'Caramel', 'Smoky', 'Floral', 'Chocolatey'];
const COFFEE_TYPES = ['Robusta', 'Arabica', 'Blend', 'Cherry', 'Culi'];
const ROAST_LEVELS = ['Light', 'Medium', 'Dark'];
const GRIND_LEVELS = ['Coarse', 'Fine', 'Espresso'];

const LIQUID_TYPES = ['Water', 'Mineral'];
const MILK_TYPES = ['Fresh', 'Almond', 'Soy', 'Oat', 'Condensed'];

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
  { label: 'Airy-foam', icon: 'coffee' },
  { label: 'No foam', icon: 'do-not-disturb' },
];
const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];
const EQUIPMENTS = [
  { label: 'Espresso Machine', icon: 'local-cafe' },
  { label: 'Coffee Grinder', icon: 'build' },
  { label: 'Manual Tools', icon: 'handyman' },
];
const CUP_TYPES = [
  { label: 'Plastic', icon: 'local-drink' },
  { label: 'Glass', icon: 'wine-bar' },
];
const SIZE_OPTIONS = ['S', 'M', 'L', 'No-size'];
const COLOR_STYLES = ['Black', 'White', 'Iced-crystal', 'Brown', 'Creamy'];
const CATEGORIES = ['Seasonal', 'Signature', 'Special', 'Budget', 'Premium', 'Latte Art', 'Dirty Coffee'];

const SLIDER_KEYS = ['Bitterness', 'Sweetness', 'Body', 'Acidity'] as const;

const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:5080`;
  }

  return Platform.select({
    android: 'http://10.0.2.2:5080',
    ios: 'http://localhost:5080',
    default: 'http://localhost:5080',
  });
};

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
  const [beverageName, setBeverageName] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('Bold');
  const [coffeeType, setCoffeeType] = useState('Robusta');
  const [roastLevel, setRoastLevel] = useState('Light');
  const [grindLevel, setGrindLevel] = useState('Coarse');

  const [liquidType, setLiquidType] = useState('Water');
  const [milkType, setMilkType] = useState('None');

  const [sweetener, setSweetener] = useState('Sugar');
  const [topping, setTopping] = useState('Pink-salt');
  const [brewMethod, setBrewMethod] = useState('Espresso');
  const [brewTime, setBrewTime] = useState(3);
  const [iceRatio, setIceRatio] = useState('30%');
  const [frothingLevel, setFrothingLevel] = useState('Micro-foam');
  const [difficulty, setDifficulty] = useState('Easy');
  const [equipment, setEquipment] = useState('Espresso Machine');
  const [cupType, setCupType] = useState('Plastic');
  const [sizeOption, setSizeOption] = useState('S');
  const [colorStyle, setColorStyle] = useState('Black');
  const [category, setCategory] = useState('Seasonal');
  const [costPerCup, setCostPerCup] = useState('');
  const [margin, setMargin] = useState(35);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (isLoading) return;
    setIsLoading(true);
    router.push('/ai-loading');
    const payload = {
      flavorProfile: {
        bitterness: profileValues.Bitterness,
        sweetness: profileValues.Sweetness,
        body: profileValues.Body,
        acidity: profileValues.Acidity,
      },
      basicInfo: {
        beverageName,
        selectedFlavorStyleId: selectedStyle,
      },
      coffeeConfig: {
        selectedCoffeeTypeId: coffeeType,
        selectedRoastLevelId: roastLevel,
        selectedGrindSizeId: grindLevel,
        selectedHeatLevelId: roastLevel,
      },
      ingredients: {
        selectedLiquidId: liquidType,
        selectedMilkId: milkType,
        selectedSweetenerId: sweetener,
        selectedToppingId: topping,
      },
      brewing: {
        selectedMethodId: brewMethod,
        brewingTimeMinutes: brewTime,
        selectedIceRatio: Number.parseInt(iceRatio.replace('%', ''), 10) || 0,
        selectedFrothingId: frothingLevel,
        selectedDifficultyId: difficulty,
        selectedEquipmentId: equipment,
      },
      presentation: {
        selectedCupTypeId: cupType,
        selectedSizeIds: [sizeOption],
        selectedColorStyleId: colorStyle,
        selectedCategoryId: category,
      },
      pricing: {
        costPerCup: Number.parseInt(costPerCup || '0', 10),
        marginPercent: margin,
      },
    };

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/AI/create-ai-recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const data = await response.json();
      router.replace({
        pathname: '/ai-result',
        params: { data: JSON.stringify(data) },
      });
    } catch (error) {
      // TODO: handle error UI
      console.error(error);
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
              source={{
                uri: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=1200&auto=format&fit=crop',
              }}
              style={styles.heroImage}
            />
            <View style={styles.heroOverlay} />
            <View style={styles.heroContent}>
              <ThemedText style={styles.backArrow}>←</ThemedText>
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
          <TextInput
            placeholder="Please specify your beverage\ne.g Cold Brew,..."
            placeholderTextColor="#B8B8B8"
            value={beverageName}
            onChangeText={setBeverageName}
            style={styles.input}
          />

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

          <ThemedText style={styles.subSectionTitle}>Liquid</ThemedText>
          <ThemedText style={styles.helperText}>Decide what liquid to add to your coffee</ThemedText>

          <View style={styles.groupHeader}>
            <ThemedText style={styles.groupTitle}>Type</ThemedText>
            <ThemedText style={styles.groupValue}>{liquidType}</ThemedText>
          </View>
          <View style={styles.tags}>
            {LIQUID_TYPES.map((item) => {
              const isSelected = item === liquidType;
              return (
                <Pressable
                  key={item}
                  onPress={() => setLiquidType(item)}
                  style={[styles.tag, isSelected && styles.tagSelected]}>
                  <ThemedText style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                    {item}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.groupHeader}>
            <ThemedText style={styles.groupTitle}>Milk</ThemedText>
            <ThemedText style={styles.groupValue}>{milkType}</ThemedText>
          </View>
          <View style={styles.tags}>
            {['None', ...MILK_TYPES].map((item) => {
              const isSelected = item === milkType;
              return (
                <Pressable
                  key={item}
                  onPress={() => setMilkType(item)}
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

          <ThemedText style={styles.subSectionTitle}>Brewing Method</ThemedText>
          <ThemedText style={styles.helperText}>Choose method to make coffee</ThemedText>
          <View style={styles.groupHeader}>
            <ThemedText style={styles.groupTitle}></ThemedText>
            <ThemedText style={styles.groupValue}>{brewMethod}</ThemedText>
          </View>
          <View style={styles.tags}>
            {BREW_METHODS.map((item) => {
              const isSelected = item === brewMethod;
              return (
                <Pressable
                  key={item}
                  onPress={() => setBrewMethod(item)}
                  style={[styles.tag, isSelected && styles.tagSelected]}>
                  <ThemedText style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                    {item}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

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
                  <MaterialIcons name={item.icon} size={26} color={isSelected ? '#6B3E1F' : '#B69A86'} />
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
            <ThemedText style={styles.groupValue}>{equipment}</ThemedText>
          </View>
          <View style={styles.cardsRow}>
            {EQUIPMENTS.map((item) => {
              const isSelected = item.label === equipment;
              return (
                <Pressable
                  key={item.label}
                  onPress={() => setEquipment(item.label)}
                  style={[styles.iconCard, isSelected && styles.iconCardSelected]}>
                  <MaterialIcons name={item.icon} size={26} color={isSelected ? '#6B3E1F' : '#B69A86'} />
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
                  <MaterialIcons name={item.icon} size={26} color={isSelected ? '#6B3E1F' : '#B69A86'} />
                  <ThemedText style={[styles.iconCardText, isSelected && styles.iconCardTextSelected]}>
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sectionSpacing} />

          <View style={styles.groupHeader}>
            <ThemedText style={styles.subSectionTitle}>Size</ThemedText>
            <ThemedText style={styles.groupValue}>{sizeOption}</ThemedText>
          </View>
          <View style={styles.tags}>
            {SIZE_OPTIONS.map((item) => {
              const isSelected = item === sizeOption;
              return (
                <Pressable
                  key={item}
                  onPress={() => setSizeOption(item)}
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

          <ThemedText style={styles.subSectionTitle}>Cost per Cup</ThemedText>
          <TextInput
            placeholder="e.g 15000, 20000 VND..."
            placeholderTextColor="#B8B8B8"
            keyboardType="numeric"
            value={costPerCup}
            onChangeText={setCostPerCup}
            style={styles.input}
          />

          <View style={styles.sectionSpacing} />

          <ThemedText style={styles.subSectionTitle}>Proposed Selling Price</ThemedText>
          <View style={styles.groupHeader}>
            <ThemedText style={styles.groupTitle}>Margin</ThemedText>
            <ThemedText style={styles.groupValue}>{margin}%</ThemedText>
          </View>
          <Slider
            value={margin}
            minimumValue={0}
            maximumValue={70}
            step={1}
            minimumTrackTintColor="#B4632D"
            maximumTrackTintColor="#E5E5E5"
            thumbTintColor="#B4632D"
            onValueChange={(next) => setMargin(next)}
          />
          <View style={styles.sliderScale}>
            <ThemedText style={styles.scaleText}>0%</ThemedText>
            <ThemedText style={styles.scaleText}>70%</ThemedText>
          </View>
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
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  groupTitle: {
    fontSize: 12,
    color: '#2D2D2D',
  },
  groupValue: {
    fontSize: 12,
    color: '#B4632D',
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
