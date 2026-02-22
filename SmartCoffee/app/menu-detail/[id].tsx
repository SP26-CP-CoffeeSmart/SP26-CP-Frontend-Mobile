import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

const safeParseJson = (value?: string) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const toArray = (value: unknown): any[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

const getItemName = (item: any, index: number) =>
  String(
    item?.name ??
      item?.beverageName ??
      item?.recipeName ??
      item?.title ??
      item?.menuItemName ??
      `Item ${index + 1}`
  );

const flattenMenuItems = (menu: any) => {
  const flat: Array<{ group?: string; item: any }> = [];

  const directItems =
    menu?.beverages ??
    menu?.menuItems ??
    menu?.items ??
    menu?.recipes ??
    menu?.drinks ??
    [];
  toArray(directItems).forEach((item) => flat.push({ item }));

  const groups = menu?.groups ?? menu?.menuGroups ?? [];
  toArray(groups).forEach((group) => {
    const groupName = String(group?.name ?? group?.groupName ?? '').trim();
    const groupedItems =
      group?.beverages ?? group?.menuItems ?? group?.items ?? group?.recipes ?? [];
    toArray(groupedItems).forEach((item) => flat.push({ group: groupName, item }));
  });

  return flat;
};

const extractPrimitiveEntries = (item: any) => {
  if (!item || typeof item !== 'object') return [] as Array<[string, string]>;
  return Object.entries(item)
    .filter(([, value]) =>
      value === null || ['string', 'number', 'boolean'].includes(typeof value)
    )
    .map(([key, value]) => [key, String(value)] as [string, string]);
};

export default function MenuDetailScreen() {
  const router = useRouter();
  const { item, title } = useLocalSearchParams<{ item?: string; title?: string }>();
  const parsedItem = useMemo(() => safeParseJson(item), [item]);
  const menuItems = useMemo(() => flattenMenuItems(parsedItem), [parsedItem]);
  const rawMenu = useMemo(() => {
    if (!parsedItem) return '';
    try {
      return JSON.stringify(parsedItem, null, 2);
    } catch {
      return String(parsedItem);
    }
  }, [parsedItem]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#3C2A21" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title || 'Menu Detail'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.filterRow}>
          <View style={styles.filterChipActive}>
            <Text style={styles.filterChipTextActive}>All</Text>
          </View>
          <View style={styles.filterChip}>
            <Text style={styles.filterChipText}>Hot</Text>
          </View>
          <View style={styles.filterChip}>
            <Text style={styles.filterChipText}>Cold</Text>
          </View>
          <View style={styles.filterChip}>
            <Text style={styles.filterChipText}>Filter</Text>
          </View>
        </View>

        {menuItems.length === 0 ? (
          <Text style={styles.emptyText}>No menu items found in the response.</Text>
        ) : (
          menuItems.map((entry, index) => {
            const itemName = getItemName(entry.item, index);
            const details = extractPrimitiveEntries(entry.item);
            return (
              <View key={`${itemName}-${index}`} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{itemName}</Text>
                {entry.group ? (
                  <Text style={styles.itemGroup}>Group: {entry.group}</Text>
                ) : null}
                <View style={styles.itemDetails}>
                  {details.map(([key, value]) => (
                    <Text key={`${itemName}-${key}`} style={styles.itemDetailText}>
                      {key}: {value}
                    </Text>
                  ))}
                </View>
                <View style={styles.rawItemCard}>
                  <Text style={styles.rawItemTitle}>Raw item data</Text>
                  <Text style={styles.rawItemText}>
                    {(() => {
                      try {
                        return JSON.stringify(entry.item, null, 2);
                      } catch {
                        return String(entry.item);
                      }
                    })()}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        {rawMenu ? (
          <View style={styles.rawMenuCard}>
            <Text style={styles.rawMenuTitle}>Raw menu data</Text>
            <Text style={styles.rawMenuText}>{rawMenu}</Text>
          </View>
        ) : null}
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
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    marginTop: 6,
  },
  filterChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2D6C9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8B5E3C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8E7D3',
  },
  filterChipText: {
    fontSize: 11,
    color: '#3C2A21',
    fontWeight: '600',
  },
  filterChipTextActive: {
    fontSize: 11,
    color: '#8B5E3C',
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 12,
    color: '#8E7B6F',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8DED3',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3C2A21',
  },
  itemGroup: {
    fontSize: 11,
    color: '#8B5E3C',
    marginTop: 4,
  },
  itemDetails: {
    marginTop: 8,
    gap: 4,
  },
  itemDetailText: {
    fontSize: 11,
    color: '#5E4A3A',
  },
  rawItemCard: {
    marginTop: 10,
    backgroundColor: '#F6F1EB',
    borderRadius: 12,
    padding: 10,
  },
  rawItemTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3C2A21',
    marginBottom: 4,
  },
  rawItemText: {
    fontSize: 10,
    color: '#6D5B4B',
  },
  rawMenuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2D6C9',
  },
  rawMenuTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3C2A21',
    marginBottom: 6,
  },
  rawMenuText: {
    fontSize: 10,
    color: '#6D5B4B',
  },
});
