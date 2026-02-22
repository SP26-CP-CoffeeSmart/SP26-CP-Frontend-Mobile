import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

interface MenuItemGrouped {
  groupName: string;
  beverageCategoryId: number;
  items: Array<{
    menuItemId: number;
    recipeName: string;
    description: string;
    priceInfo: string;
    image: string | null;
    shopBeverage: any;
    shopRecipe: any;
  }>;
}

const getFallbackImage = () => require('../../assets/1.jpg');

const getRecipeImage = (shopRecipe: any) => {
  if (!shopRecipe) return getFallbackImage();
  const imageUrl = shopRecipe?.image;
  if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined') {
    return getFallbackImage();
  }
  if (typeof imageUrl === 'string' && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
    return { uri: imageUrl };
  }
  return getFallbackImage();
};

const splitDescription = (description: string): { text: string; prices: string } => {
  if (!description) return { text: '', prices: '' };
  const parts = description.split('[PRICES]');
  if (parts.length === 2) {
    return {
      text: parts[0].trim(),
      prices: '[PRICES]' + parts[1].trim(),
    };
  }
  return { text: description, prices: '' };
};

const groupMenuItemsByCategory = (menu: any): MenuItemGrouped[] => {
  if (!menu) return [];

  const menuItems = toArray(menu?.menuItems ?? []);
  const menuGroups = toArray(menu?.menuGroups ?? []);

  const result: MenuItemGrouped[] = [];

  // Duyệt qua menuGroups
  menuGroups.forEach((group) => {
    const groupName = group?.name ?? 'Unknown Group';
    const menuGroupId = group?.menuGroupId ?? 0;
    const menuGroupCategory = toArray(group?.menuGroupCategory ?? []);

    // Lấy danh sách beverageCategoryIds của group này
    const categoryIds = new Set<number>();
    menuGroupCategory.forEach((categoryMap) => {
      const beverageCategoryId = categoryMap?.beverageCategroupId || categoryMap?.beverageCategoryId;
      if (beverageCategoryId) {
        categoryIds.add(Number(beverageCategoryId));
      }
    });

    // Lọc menuItems thuộc group này (có beverageCategoryId nằm trong categoryIds)
    const groupItems: MenuItemGrouped['items'] = [];
    menuItems.forEach((menuItem) => {
      const shopBeverage = menuItem?.shopBeverage || {};
      const beverageCategoryId = shopBeverage?.beverageCategoryId || 0;

      if (categoryIds.has(Number(beverageCategoryId))) {
        const shopRecipe = menuItem?.shopRecipe || {};
        const recipeName = shopRecipe?.recipeName || menuItem?.name || 'Unknown Item';
        const { text, prices } = splitDescription(menuItem?.description || '');

        groupItems.push({
          menuItemId: menuItem?.menuItemId || 0,
          recipeName,
          description: text,
          priceInfo: prices,
          image: shopRecipe?.image,
          shopBeverage,
          shopRecipe,
        });
      }
    });

    // Chỉ thêm group nếu có items
    if (groupItems.length > 0) {
      result.push({
        groupName,
        beverageCategoryId: menuGroupId,
        items: groupItems,
      });
    }
  });

  return result;
};

export default function MenuDetailScreen() {
  const router = useRouter();
  const { item, title } = useLocalSearchParams<{ item?: string; title?: string }>();
  const parsedItem = useMemo(() => safeParseJson(item), [item]);
  const groupedItems = useMemo(() => groupMenuItemsByCategory(parsedItem), [parsedItem]);

  const handleItemPress = (menuItem: any) => {
    const shopRecipe = menuItem.shopRecipe || {};
    const shopRecipeIngredients = toArray(shopRecipe?.shopRecipeIngredients ?? []);

    router.push({
      pathname: '/recipe-detail/[id]',
      params: {
        id: menuItem.menuItemId?.toString() || '0',
        recipe: JSON.stringify(shopRecipe),
        ingredients: JSON.stringify(shopRecipeIngredients),
      },
    });
  };

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
        {groupedItems.length === 0 ? (
          <Text style={styles.emptyText}>No menu items found in this menu.</Text>
        ) : (
          groupedItems.map((group, groupIndex) => (
            <View key={`group-${group.beverageCategoryId}-${groupIndex}`} style={styles.groupSection}>
              <Text style={styles.groupTitle}>{group.groupName}</Text>
              <View style={styles.itemList}>
                {group.items.map((item, itemIndex) => (
                  <TouchableOpacity
                    key={`${group.beverageCategoryId}-item-${itemIndex}`}
                    style={styles.itemCard}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.7}
                  >
                    <Image source={getRecipeImage(item.shopRecipe)} style={styles.itemImage} />

                    <View style={styles.itemContent}>
                      <Text style={styles.itemName}>{item.recipeName}</Text>

                      {item.description && (
                        <Text style={styles.itemDescription} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}

                      {item.priceInfo && (
                        <Text style={styles.itemPrice}>{item.priceInfo}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
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
  emptyText: {
    fontSize: 12,
    color: '#8E7B6F',
    textAlign: 'center',
    marginTop: 20,
  },
  groupSection: {
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3C2A21',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemList: {
    gap: 12,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8DED3',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  itemImage: {
    width: 100,
    height: 100,
    backgroundColor: '#E8DED3',
  },
  itemContent: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3C2A21',
    marginBottom: 6,
  },
  itemDescription: {
    fontSize: 11,
    color: '#5E4A3A',
    lineHeight: 16,
    marginBottom: 6,
  },
  itemPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B5E3C',
  },
});
