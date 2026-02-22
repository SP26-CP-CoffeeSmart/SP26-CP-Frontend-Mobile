import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const fallbackMenuImage =
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=1200&auto=format&fit=crop';

const toArray = (value: unknown): any[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

const safeParseJson = (value?: string) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const pickMenus = (payload: any): any[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (payload.menus) return toArray(payload.menus);
  if (payload.data) return toArray(payload.data);
  if (payload.items) return toArray(payload.items);
  if (payload.menu) return toArray(payload.menu);
  if (payload.result) return toArray(payload.result);
  return [payload];
};

const getMenuTitle = (menu: any, index: number) =>
  String(
    menu?.versionNumber ??
    menu?.name ??
    menu?.menuName ??
    menu?.title ??
    menu?.topic ??
    menu?.layout ??
    `Menu ${index + 1}`
  );

const getMenuSubtitle = (menu: any) => {
  const candidates = [
    menu?.description,
    menu?.note,
    menu?.pricing,
    menu?.shopStyle,
    menu?.createdDate,
  ]
    .map((value) => (value ? String(value) : ''))
    .filter(Boolean);

  if (candidates.length === 0) return 'AI generated menu suggestion.';
  return candidates.slice(0, 2).join(' • ');
};

const getAveragePrice = (menu: any): string => {
  const price = menu?.averagePrice;
  if (!price) return '-';
  return Number(price).toLocaleString('vi-VN') + ' VNĐ';
};

const getVisualTheme = (menu: any) => {
  return menu?.visualTheme ?? null;
};

const getMenuImage = (menu: any) => {
  const url = String(menu?.image ?? menu?.thumbnail ?? menu?.imageUrl ?? '').trim();
  if (!url || url === 'null' || url === 'undefined') return fallbackMenuImage;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return fallbackMenuImage;
};

const getGroupNames = (menu: any): string[] => {
  const groups = menu?.groups ?? menu?.menuGroups ?? [];
  if (!Array.isArray(groups)) return [];
  return groups
    .map((group) => String(group?.name ?? group?.groupName ?? '').trim())
    .filter(Boolean);
};

export default function MenuResultsScreen() {
  const router = useRouter();
  const { data, cacheKey } = useLocalSearchParams<{ data?: string; cacheKey?: string }>();
  const [cachedPayload, setCachedPayload] = useState<string>('');

  useEffect(() => {
    let isActive = true;
    const loadCachedPayload = async () => {
      if (!cacheKey) {
        return;
      }
      try {
        const stored = await AsyncStorage.getItem(cacheKey);
        if (isActive && stored) {
          setCachedPayload(stored);
        }
      } catch {
        if (isActive) {
          setCachedPayload('');
        }
      }
    };

    loadCachedPayload();
    return () => {
      isActive = false;
    };
  }, [cacheKey]);

  const payloadSource = data || cachedPayload;
  const parsedPayload = useMemo(() => safeParseJson(payloadSource), [payloadSource]);
  const menus = useMemo(() => pickMenus(parsedPayload), [parsedPayload]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#3C2A21" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Menu Results</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.suggestionBox}>
          <View style={styles.suggestionRow}>
            <Ionicons name="sparkles-outline" size={18} color="#8B5E3C" />
            <Text style={styles.suggestionTitle}>AI suggestion:</Text>
          </View>
          <Text style={styles.suggestionText}>
            Choose a template based on season, trends, and customer preferences.
          </Text>
        </View>

        {menus.length === 0 ? (
          <Text style={styles.emptyText}>No menu data returned from the API.</Text>
        ) : (
          menus.map((menu, index) => {
            const title = getMenuTitle(menu, index);
            const subtitle = getMenuSubtitle(menu);
            const groups = getGroupNames(menu);
            const averagePrice = getAveragePrice(menu);
            const visualTheme = getVisualTheme(menu);
            const menuId = String(menu?.menuId ?? menu?.id ?? index);
            const menuKey = `${menuId}-${index}`;

            return (
              <View key={menuKey} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleSection}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardPrice}>Average: {averagePrice}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.cardAction}
                    onPress={() =>
                      router.push({
                        pathname: `/menu-detail/${menuId}`,
                        params: {
                          item: JSON.stringify(menu),
                          title,
                        },
                      })
                    }
                  >
                    <Ionicons name="pencil" size={16} color="#8B5E3C" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.cardSubtitle}>{subtitle}</Text>
                <View style={styles.cardBody}>
                  <Image source={{ uri: getMenuImage(menu) }} style={styles.cardImage} />
                  <View style={styles.groupRow}>
                    {groups.slice(0, 4).map((group, groupIndex) => (
                      <View key={`${menuKey}-${group}-${groupIndex}`} style={styles.groupChip}>
                        <Text style={styles.groupChipText}>{group}</Text>
                      </View>
                    ))}
                    {groups.length === 0 ? (
                      <Text style={styles.groupEmptyText}>No menu groups found.</Text>
                    ) : null}
                  </View>
                </View>

                {visualTheme && (
                  <View style={styles.themeSection}>
                    <Text style={styles.themeSectionTitle}>Visual Theme</Text>
                    <View style={styles.themeGrid}>
                      {visualTheme.baseTheme && (
                        <View style={styles.themeItem}>
                          <Text style={styles.themeLabel}>Theme:</Text>
                          <Text style={styles.themeValue}>{visualTheme.baseTheme}</Text>
                        </View>
                      )}
                      {visualTheme.primaryHex && (
                        <View style={styles.themeItem}>
                          <Text style={styles.themeLabel}>Primary:</Text>
                          <View style={[styles.colorSwatch, { backgroundColor: visualTheme.primaryHex }]} />
                          <Text style={styles.themeValue}>{visualTheme.primaryHex}</Text>
                        </View>
                      )}
                      {visualTheme.secondaryHex && (
                        <View style={styles.themeItem}>
                          <Text style={styles.themeLabel}>Secondary:</Text>
                          <View style={[styles.colorSwatch, { backgroundColor: visualTheme.secondaryHex }]} />
                          <Text style={styles.themeValue}>{visualTheme.secondaryHex}</Text>
                        </View>
                      )}
                      {visualTheme.fontPairing && (
                        <View style={styles.themeItem}>
                          <Text style={styles.themeLabel}>Font:</Text>
                          <Text style={styles.themeValue}>{visualTheme.fontPairing}</Text>
                        </View>
                      )}
                    </View>
                    {visualTheme.backgroundPrompt && (
                      <View style={styles.promptBox}>
                        <Text style={styles.promptLabel}>Background:</Text>
                        <Text style={styles.promptText}>{visualTheme.backgroundPrompt}</Text>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.detailsRow}
                  onPress={() =>
                    router.push({
                      pathname: `/menu-detail/${menuId}`,
                      params: {
                        item: JSON.stringify(menu),
                        title,
                      },
                    })
                  }
                >
                  <Text style={styles.detailsText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={16} color="#8B5E3C" />
                </TouchableOpacity>
              </View>
            );
          })
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F1EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: '#F6F1EB',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#3C2A21',
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  suggestionBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3C2A21',
  },
  suggestionText: {
    fontSize: 12,
    color: '#8E7B6F',
  },
  emptyText: {
    fontSize: 12,
    color: '#8E7B6F',
  },
  card: {
    backgroundColor: '#FFF8E7',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitleSection: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3C2A21',
  },
  cardPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B5E3C',
    marginTop: 4,
  },
  cardAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5E7D8',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#8E7B6F',
    marginBottom: 10,
  },
  cardBody: {
    gap: 10,
  },
  cardImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#E8DED3',
  },
  groupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  groupChip: {
    backgroundColor: '#F3E8DD',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  groupChipText: {
    fontSize: 10,
    color: '#8B5E3C',
    fontWeight: '600',
  },
  groupEmptyText: {
    fontSize: 10,
    color: '#8E7B6F',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  detailsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3C2A21',
  },
  themeSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8DED3',
  },
  themeSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3C2A21',
    marginBottom: 8,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  themeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9F4EF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  themeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8B5E3C',
  },
  themeValue: {
    fontSize: 10,
    color: '#5E4A3A',
  },
  colorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D4C4B0',
  },
  promptBox: {
    backgroundColor: '#F9F4EF',
    borderRadius: 8,
    padding: 8,
  },
  promptLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8B5E3C',
    marginBottom: 4,
  },
  promptText: {
    fontSize: 10,
    color: '#5E4A3A',
    lineHeight: 14,
  },
});
