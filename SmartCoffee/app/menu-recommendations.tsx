import React, { useMemo, useState } from 'react';
import {
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
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';

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
  { key: 'budget', label: 'Budget', range: '2 - 4 $' },
  { key: 'moderate', label: 'Moderate', range: '3 - 6 $' },
  { key: 'premium', label: 'Premium', range: '5 - 8 $' },
  { key: 'luxury', label: 'Luxury', range: '7 - 12 $' },
];

export default function MenuRecommendationsScreen() {
  const router = useRouter();
  const [menuTitle, setMenuTitle] = useState('');
  const [menuSize, setMenuSize] = useState(17);
  const [menuSizeText, setMenuSizeText] = useState('');
  const [selectedLayout, setSelectedLayout] = useState('vertical');
  const [selectedTopic, setSelectedTopic] = useState('Summer Refresh');
  const [selectedShopStyle, setSelectedShopStyle] = useState('Modern Minimalist');
  const [shopStyleText, setShopStyleText] = useState('');
  const [selectedPricing, setSelectedPricing] = useState('budget');
  const [menuGroups, setMenuGroups] = useState(['Menu Group 1', 'Menu Group 2']);
  const [menuGroupInput, setMenuGroupInput] = useState('');

  const numericMenuSize = useMemo(() => {
    const parsed = Number(menuSizeText);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : menuSize;
  }, [menuSize, menuSizeText]);

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
              <Text style={styles.valueText}>{numericMenuSize}</Text>
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
            <TextInput
              style={styles.input}
              placeholder="Please specify the number for your menu size"
              placeholderTextColor={COLORS.muted}
              keyboardType="number-pad"
              value={menuSizeText}
              onChangeText={setMenuSizeText}
            />
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Menu Drinks' Size</Text>
              <Text style={styles.valueText}>Vertical</Text>
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
            <View style={styles.pricingRow}>
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
            </View>
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
                <View key={`${group}-${index}`} style={styles.groupRow}>
                  <Ionicons name="reorder-three" size={18} color={COLORS.muted} />
                  <Text style={styles.groupText}>{group}</Text>
                  <TouchableOpacity style={styles.groupAddButton}>
                    <Ionicons name="add" size={16} color={COLORS.accent} />
                    <Text style={styles.groupAddText}>Add beverage</Text>
                  </TouchableOpacity>
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
                <TouchableOpacity
                  style={styles.groupInputAction}
                  onPress={() => {
                    const next = menuGroupInput.trim();
                    if (!next) return;
                    setMenuGroups((prev) => [...prev, next]);
                    setMenuGroupInput('');
                  }}
                >
                  <Ionicons name="add" size={18} color={COLORS.accentDark} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
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
    marginBottom: 12,
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
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
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
  },
  pricingRange: {
    fontSize: 10,
    color: COLORS.muted,
  },
  pricingLabelActive: {
    color: '#FFF',
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
});
