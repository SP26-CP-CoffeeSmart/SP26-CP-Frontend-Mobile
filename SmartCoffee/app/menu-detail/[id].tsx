import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

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
    sourceMenuItem: any;
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

  console.log('=== DEBUG groupMenuItemsByCategory ===');
  console.log('Total menuGroups:', menuGroups.length);
  console.log('Total menuItems:', menuItems.length);
  console.log('menuGroups:', JSON.stringify(menuGroups, null, 2));

  const result: MenuItemGrouped[] = [];
  const matchedItemIds = new Set<number>();

  const getItemCategoryId = (menuItem: any) => {
    const shopBeverage = menuItem?.shopBeverage || {};
    const rawId =
      shopBeverage?.beverageCategoryId ??
      shopBeverage?.beverageCategory?.beverageCategoryId ??
      shopBeverage?.beverageCategory?.id ??
      menuItem?.beverageCategoryId ??
      menuItem?.beverageCategory?.beverageCategoryId ??
      menuItem?.beverageCategory?.id ??
      0;

    if (typeof rawId === 'number') return rawId;
    if (typeof rawId === 'string' && rawId.trim()) {
      const parsed = Number(rawId);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const buildGroupedItem = (menuItem: any) => {
    const shopBeverage = menuItem?.shopBeverage || {};
    const shopRecipe = menuItem?.shopRecipe || {};
    const recipeName =
      shopRecipe?.recipeName ||
      shopBeverage?.name ||
      menuItem?.name ||
      'Unknown Item';
    const { text, prices } = splitDescription(menuItem?.description || '');

    return {
      menuItemId: menuItem?.menuItemId || 0,
      recipeName,
      description: text,
      priceInfo: prices,
      image: shopRecipe?.image,
      shopBeverage,
      shopRecipe,
      sourceMenuItem: menuItem,
    };
  };

  // Duyet qua menuGroups
  menuGroups.forEach((group, groupIdx) => {
    const groupName = group?.name ?? 'Unknown Group';
    const menuGroupId = group?.menuGroupId ?? 0;
    const menuGroupCategory = toArray(group?.menuGroupCategory ?? []);

    console.log(`\n[Group ${groupIdx}] ${groupName}:`);

    // Lay danh sach beverageCategoryIds cua group nay
    const categoryIds = new Set<number>();
    menuGroupCategory.forEach((categoryMap) => {
      const beverageCategoryId = categoryMap?.beverageCategroupId || categoryMap?.beverageCategoryId;
      if (beverageCategoryId) {
        categoryIds.add(Number(beverageCategoryId));
      }
    });
    console.log(`  Mapped categoryIds:`, Array.from(categoryIds));

    // Loc menuItems thuoc group nay (co beverageCategoryId nam trong categoryIds)
    const groupItems: MenuItemGrouped['items'] = [];
    menuItems.forEach((menuItem) => {
      const beverageCategoryId = getItemCategoryId(menuItem);
      const menuItemId = menuItem?.menuItemId || 0;

      if (categoryIds.has(Number(beverageCategoryId))) {
        if (menuItemId && matchedItemIds.has(menuItemId)) {
          return;
        }
        groupItems.push(buildGroupedItem(menuItem));
        if (menuItemId) {
          matchedItemIds.add(menuItemId);
        }
      }
    });
    console.log(`  Matched items:`, groupItems.length);

    // Chi them group neu co items
    if (groupItems.length > 0) {
      result.push({
        groupName,
        beverageCategoryId: menuGroupId,
        items: groupItems,
      });
    }
  });


  console.log('Final result groups:', result.length);
  console.log('=====================================\n');

  return result;
};

export default function MenuDetailScreen() {
  const router = useRouter();
  const { item, title, payload, menuIndex } = useLocalSearchParams<{
    item?: string;
    title?: string;
    payload?: string;
    menuIndex?: string;
  }>();
  const parsedItem = useMemo(() => safeParseJson(item), [item]);
  const parsedPayload = useMemo(() => safeParseJson(payload), [payload]);
  const resolvedMenuIndex = useMemo(() => {
    if (typeof menuIndex === 'string' && menuIndex.trim()) {
      const parsed = Number(menuIndex);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }, [menuIndex]);
  const [currentMenu, setCurrentMenu] = useState<any>(null);
  const [menuDraft, setMenuDraft] = useState<any>(null);
  const [menuPayload, setMenuPayload] = useState<any>(null);
  const [menuConfig, setMenuConfig] = useState<any>(null);
  const [storedMenuItems, setStoredMenuItems] = useState<any[]>([]);
  const [newItemCount, setNewItemCount] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [renderingMenu, setRenderingMenu] = useState(false);
  const [renderedMenuUrl, setRenderedMenuUrl] = useState<string | null>(null);
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const trimmedItemCount = newItemCount.trim();
  const parsedItemCount = Number.parseInt(trimmedItemCount || '0', 10);
  const canRegenerate = Number.isFinite(parsedItemCount) && parsedItemCount > 0;

  useEffect(() => {
    if (!parsedItem && !parsedPayload) {
      setCurrentMenu(null);
      setMenuDraft(null);
      setMenuPayload(null);
      setMenuConfig(null);
      setStoredMenuItems([]);
      return;
    }

    const payloadMenus = toArray(
      parsedPayload?.menus ??
        parsedPayload?.data ??
        parsedPayload?.items ??
        []
    );
    const payloadConfig =
      parsedPayload?.config ??
      parsedPayload?.request?.config ??
      parsedPayload?.requestConfig ??
      parsedPayload?.menuConfig ??
      null;

    if (payloadMenus.length > 0 || payloadConfig) {
      setMenuPayload({
        ...(parsedPayload ?? {}),
        menus: payloadMenus,
        config: payloadConfig,
      });
      setMenuConfig(payloadConfig);
    }

    const selectedFromPayload = payloadMenus[resolvedMenuIndex];
    const baseMenu = selectedFromPayload ?? parsedItem;
    setCurrentMenu(baseMenu);
    setMenuDraft(baseMenu);

    const initialItems = toArray(
      baseMenu?.menuItems ??
        baseMenu?.menu?.menuItems ??
        baseMenu?.items ??
        []
    );
    setStoredMenuItems(initialItems);
  }, [parsedItem, parsedPayload, resolvedMenuIndex]);

  const menuForDisplay = useMemo(() => {
    const baseMenu = currentMenu ?? parsedItem;
    if (!baseMenu) return baseMenu;
    return {
      ...baseMenu,
      menuItems: storedMenuItems,
    };
  }, [currentMenu, parsedItem, storedMenuItems]);

  const groupedItems = useMemo(
    () => groupMenuItemsByCategory(menuForDisplay),
    [menuForDisplay]
  );

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

  const handleRemoveItem = (menuItem: any) => {
    if (!menuItem) return;
    const menuItemId = menuItem?.menuItemId || menuItem?.id;
    if (menuItemId) {
      setStoredMenuItems((prev) => {
        const next = prev.filter((item) => item?.menuItemId !== menuItemId);
        const nextSize = next.length;
        setMenuPayload((current) => {
          if (!current) return current;
          const menus = toArray(current?.menus ?? []);
          if (menus.length > 0) {
            const menuAtIndex = menus[resolvedMenuIndex] ?? {};
            menus[resolvedMenuIndex] = {
              ...menuAtIndex,
              menuItems: next,
              menuSizeValue: nextSize,
              config: {
                ...(menuAtIndex?.config ?? {}),
                menuSizeValue: nextSize,
              },
            };
          }
          return {
            ...current,
            menus,
            config: {
              ...(current?.config ?? {}),
              menuSizeValue: nextSize,
            },
          };
        });
        setMenuConfig((current) => ({
          ...(current ?? {}),
          menuSizeValue: nextSize,
        }));
        setMenuDraft((current) => ({
          ...(current ?? {}),
          menuSizeValue: nextSize,
        }));
        setCurrentMenu((current) => ({
          ...(current ?? {}),
          menuSizeValue: nextSize,
        }));
        return next;
      });
      return;
    }
    setStoredMenuItems((prev) => {
      const next = prev.filter((item) => item !== menuItem);
      const nextSize = next.length;
      setMenuPayload((current) => {
        if (!current) return current;
        const menus = toArray(current?.menus ?? []);
        if (menus.length > 0) {
          const menuAtIndex = menus[resolvedMenuIndex] ?? {};
          menus[resolvedMenuIndex] = {
            ...menuAtIndex,
            menuItems: next,
            menuSizeValue: nextSize,
            config: {
              ...(menuAtIndex?.config ?? {}),
              menuSizeValue: nextSize,
            },
          };
        }
        return {
          ...current,
          menus,
          config: {
            ...(current?.config ?? {}),
            menuSizeValue: nextSize,
          },
        };
      });
      setMenuConfig((current) => ({
        ...(current ?? {}),
        menuSizeValue: nextSize,
      }));
      setMenuDraft((current) => ({
        ...(current ?? {}),
        menuSizeValue: nextSize,
      }));
      setCurrentMenu((current) => ({
        ...(current ?? {}),
        menuSizeValue: nextSize,
      }));
      return next;
    });
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    if (!canRegenerate) {
      Alert.alert('Missing quantity', 'Please enter a quantity to regenerate.');
      return;
    }
    if (!parsedItem && !parsedPayload) {
      Alert.alert('Missing data', 'No menu data available to regenerate.');
      return;
    }

    const parsedCount = Number.parseInt(newItemCount.trim() || '0', 10);
    const safeCount = Number.isFinite(parsedCount) ? Math.max(0, parsedCount) : 0;

    const configFromItem = menuConfig ?? {};
    const baseMenu = menuDraft ?? currentMenu ?? parsedItem;

    const resolvedTitle =
      configFromItem?.title ??
      baseMenu?.title ??
      baseMenu?.menuName ??
      baseMenu?.name ??
      (title ? String(title) : '') ??
      '';

    const baseCount = storedMenuItems.length;
    const targetMenuSize = Math.max(0, baseCount + safeCount);

    const resolvedConfig = {
      ...(menuPayload?.config ?? {}),
      ...(baseMenu?.config ?? {}),
      ...configFromItem,
      title: resolvedTitle || 'Menu Regenerate',
      menuSizeValue: targetMenuSize,
      layout: configFromItem?.layout ?? baseMenu?.layout ?? 0,
      topic: configFromItem?.topic ?? baseMenu?.topic ?? 0,
      shopStyle: configFromItem?.shopStyle ?? baseMenu?.shopStyle ?? '',
      pricing: configFromItem?.pricing ?? baseMenu?.pricing ?? 0,
      groups:
        configFromItem?.groups ??
        baseMenu?.groups ??
        baseMenu?.menuGroups ??
        [],
    };

    const currentMenuPayload = {
      ...(baseMenu ?? {}),
      menuItems: storedMenuItems,
      menuSizeValue: targetMenuSize,
      config: resolvedConfig,
    };

    const payload = {
      config: resolvedConfig,
      menus: currentMenuPayload,
      newItemCount: safeCount,
    };

    console.log('[Menu Regenerate] Stored menuItems:', JSON.stringify(storedMenuItems, null, 2));
    console.log('[Menu Regenerate] Request payload:', payload);

    try {
      setRegenerating(true);
      const response = await authorizedFetch(API_ENDPOINTS.ai.createMenuRegenerate(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }

      const responseText = await response.text();
      let responsePayload: unknown = null;
      if (responseText) {
        try {
          responsePayload = JSON.parse(responseText);
        } catch {
          responsePayload = responseText;
        }
      }

      const responseMenus = (() => {
        if (!responsePayload) return [];
        if (Array.isArray(responsePayload)) return responsePayload;
        if ((responsePayload as any)?.menus) return toArray((responsePayload as any).menus);
        if ((responsePayload as any)?.data) return toArray((responsePayload as any).data);
        if ((responsePayload as any)?.items) return toArray((responsePayload as any).items);
        if ((responsePayload as any)?.menu) return toArray((responsePayload as any).menu);
        if ((responsePayload as any)?.result) return toArray((responsePayload as any).result);
        return [responsePayload];
      })();

      const responseMenu = responseMenus[resolvedMenuIndex] ?? responseMenus[0] ?? null;
      const responseMenuItems = toArray(responseMenu?.menuItems ?? responseMenu?.menu?.menuItems ?? []);

      if (responseMenu) {
        setCurrentMenu((prev) => ({
          ...(prev ?? {}),
          ...responseMenu,
        }));
        setMenuDraft((prev) => ({
          ...(prev ?? {}),
          ...responseMenu,
        }));
      }

      if (responsePayload && (responsePayload as any)?.menus) {
        const updatedMenus = toArray((responsePayload as any).menus);
        setMenuPayload((current) => ({
          ...(current ?? {}),
          ...(responsePayload as any),
          menus: updatedMenus,
        }));
      }

      if (responseMenuItems.length > 0) {
        const previousCount = storedMenuItems.length;
        setStoredMenuItems(responseMenuItems);

        if (safeCount > 0) {
          const addedCount = responseMenuItems.length - previousCount;
          if (addedCount < safeCount) {
            Alert.alert(
              'Generate Again',
              `Expected ${safeCount} new items, but received ${Math.max(addedCount, 0)}.`
            );
          }
        }
      }

      setNewItemCount('');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to regenerate menu items.';
      Alert.alert('Regenerate failed', message);
    } finally {
      setRegenerating(false);
    }
  };

  const buildMenuRenderPayload = () => {
    const menuFromState =
      menuDraft ??
      currentMenu ??
      menuPayload?.menus?.[resolvedMenuIndex] ??
      parsedItem ??
      {};

    const resolvedConfig = {
      ...(menuConfig ?? menuPayload?.config ?? menuFromState?.config ?? {}),
      menuSizeValue: storedMenuItems.length,
    };

    return {
      menus: {
        ...(menuPayload?.menus?.[resolvedMenuIndex] ?? {}),
        ...(menuFromState ?? {}),
        menuItems: storedMenuItems,
        menuSizeValue: storedMenuItems.length,
        config: resolvedConfig,
      },
      config: resolvedConfig,
    };
  };

  const handleRenderMenu = async () => {
    if (renderingMenu) return;
    if (!parsedItem && !parsedPayload) {
      Alert.alert('Missing data', 'No menu data available to render.');
      return;
    }

    const payload = buildMenuRenderPayload();
    console.log('[Menu Render] Request payload:', payload);

    try {
      setRenderingMenu(true);
      const response = await authorizedFetch(API_ENDPOINTS.ai.createMenuRender(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }

      const responseText = await response.text();
      let responsePayload: any = null;
      if (responseText) {
        try {
          responsePayload = JSON.parse(responseText);
        } catch {
          responsePayload = responseText;
        }
      }

      const finalUrl = responsePayload?.ImageUrl ?? responsePayload?.imageUrl ?? null;
      if (finalUrl) {
        setRenderedMenuUrl(finalUrl);
      }

      Alert.alert('Render success', finalUrl ? 'Menu image is ready.' : 'Menu render completed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to render menu.';
      Alert.alert('Render failed', message);
    } finally {
      setRenderingMenu(false);
    }
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
        {renderedMenuUrl ? (
          <View style={styles.renderedSection}>
            <Text style={styles.renderedTitle}>Rendered Menu</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setIsImageZoomOpen(true)}>
              <Image source={{ uri: renderedMenuUrl }} style={styles.renderedImage} />
            </TouchableOpacity>
          </View>
        ) : null}
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
                      <View style={styles.itemHeaderRow}>
                        <Text style={styles.itemName}>{item.recipeName}</Text>
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => handleRemoveItem(item.sourceMenuItem)}
                        >
                          <Text style={styles.removeButtonText}>Remove</Text>
                        </TouchableOpacity>
                      </View>

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

      <View style={styles.regenerateBar}>
        <View style={styles.regenerateRow}>
          <Text style={styles.regenerateLabel}>Quantity</Text>
          <TextInput
            style={styles.quantityInput}
            placeholder="Enter number"
            placeholderTextColor="#8E7B6F"
            keyboardType="number-pad"
            value={newItemCount}
            onChangeText={setNewItemCount}
          />
        </View>
        <Text style={styles.regenerateHint}>
          Keep the selected items, recreate other items to meet the menu requirements.
        </Text>
        <TouchableOpacity
          style={[
            styles.regenerateButton,
            (regenerating || !canRegenerate) && styles.regenerateButtonDisabled,
          ]}
          onPress={handleRegenerate}
          disabled={regenerating || !canRegenerate}
        >
          <Text style={styles.regenerateButtonText}>
            {regenerating ? 'Generating...' : 'Generate Again'}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.renderButton,
            (renderingMenu || !storedMenuItems.length) && styles.regenerateButtonDisabled,
          ]}
          onPress={handleRenderMenu}
          disabled={renderingMenu || !storedMenuItems.length}
        >
          <Text style={styles.renderButtonText}>
            {renderingMenu ? 'Rendering...' : 'Render Menu'}
          </Text>
          <Ionicons name="image" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={isImageZoomOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsImageZoomOpen(false)}
      >
        <View style={styles.zoomOverlay}>
          <TouchableOpacity
            style={styles.zoomBackdrop}
            activeOpacity={1}
            onPress={() => setIsImageZoomOpen(false)}
          />
          <View style={styles.zoomContent}>
            <TouchableOpacity
              style={styles.zoomCloseButton}
              onPress={() => setIsImageZoomOpen(false)}
            >
              <Text style={styles.zoomCloseText}>Close</Text>
            </TouchableOpacity>
            {renderedMenuUrl ? (
              <Image source={{ uri: renderedMenuUrl }} style={styles.zoomImage} />
            ) : null}
          </View>
        </View>
      </Modal>
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
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
    flex: 1,
    marginRight: 8,
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
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F1E7DC',
  },
  removeButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3C2A21',
    textTransform: 'uppercase',
  },
  regenerateBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E6D9CC',
    gap: 10,
  },
  regenerateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  regenerateLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3C2A21',
  },
  quantityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D7C7B8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#3C2A21',
    backgroundColor: '#FDFBFA',
  },
  regenerateHint: {
    fontSize: 12,
    color: '#A57C52',
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#6B3F1D',
  },
  regenerateButtonDisabled: {
    opacity: 0.6,
  },
  regenerateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  renderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2F5D50',
  },
  renderButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  renderedSection: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8DED3',
  },
  renderedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3C2A21',
    marginBottom: 10,
  },
  renderedImage: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    backgroundColor: '#E8DED3',
  },
  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  zoomContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
  },
  zoomImage: {
    width: '100%',
    height: 420,
    borderRadius: 12,
    backgroundColor: '#E8DED3',
  },
  zoomCloseButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F1E7DC',
    marginBottom: 8,
  },
  zoomCloseText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3C2A21',
  },
});
