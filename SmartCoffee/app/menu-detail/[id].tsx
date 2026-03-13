import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

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

const cleanDescription = (description: string): string => {
  if (!description) return '';
  // Strip [PRICES] suffix from description text
  const parts = description.split('[PRICES]');
  return parts[0].trim();
};

const formatPriceFromSizes = (itemSizeViewModels: any[]): string => {
  if (!itemSizeViewModels || !Array.isArray(itemSizeViewModels) || itemSizeViewModels.length === 0) {
    return '';
  }
  const priceParts = itemSizeViewModels
    .filter((size) => size?.beverageSize?.sizeName && size?.sellingPrice != null)
    .sort((a, b) => (a?.beverageSize?.volume ?? 0) - (b?.beverageSize?.volume ?? 0))
    .map((size) => {
      const sizeName = size.beverageSize.sizeName;
      const price = Math.round(size.sellingPrice / 1000);
      return `${sizeName}: ${price}k`;
    });
  if (priceParts.length === 0) return '';
  return priceParts.join(' | ');
};

const groupMenuItemsByCategory = (menu: any): MenuItemGrouped[] => {
  if (!menu) return [];

  const menuItems = toArray(menu?.menuItems ?? []);
  const menuGroups = toArray(menu?.menuGroups ?? []);
  const configGroups = toArray(
    menu?.config?.groups ??
      menu?.menuConfig?.groups ??
      menu?.requestConfig?.groups ??
      []
  );
  const resolvedGroups = menuGroups.length > 0 ? menuGroups : configGroups;

  console.log('=== DEBUG groupMenuItemsByCategory ===');
  console.log('Total menuGroups:', menuGroups.length);
  console.log('Total configGroups:', configGroups.length);
  console.log('Total menuItems:', menuItems.length);
  console.log('menuGroups:', JSON.stringify(menuGroups, null, 2));
  console.log('configGroups:', JSON.stringify(configGroups, null, 2));

  const result: MenuItemGrouped[] = [];
  const matchedItemIndexes = new Set<number>();

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
    let shopRecipe = menuItem?.shopRecipe || null;
    let shopRecipes: any[] = [];

    if (shopBeverage?.shopRecipes && Array.isArray(shopBeverage.shopRecipes)) {
      shopRecipes = shopBeverage.shopRecipes;
    }

    if (!shopRecipe && shopRecipes.length > 0) {
      shopRecipe = shopRecipes[0];
    }

    const recipeName =
      shopRecipe?.recipeName ||
      shopBeverage?.name ||
      menuItem?.name ||
      'Unknown Item';
    const description = cleanDescription(menuItem?.description || '');
    const priceInfo = formatPriceFromSizes(toArray(menuItem?.itemSizeViewModels ?? []));

    return {
      menuItemId: menuItem?.menuItemId || 0,
      recipeName,
      description,
      priceInfo,
      image: shopRecipe?.image || shopBeverage?.image || shopBeverage?.imageUrl,
      shopBeverage,
      shopRecipe: shopRecipe || {},
      sourceMenuItem: menuItem,
    };
  };

  // Duyet qua menuGroups (fallback to config groups)
  resolvedGroups.forEach((group, groupIdx) => {
    const groupName = group?.name ?? 'Unknown Group';
    const menuGroupId = group?.menuGroupId ?? 0;
    const menuGroupCategory = toArray(group?.menuGroupCategory ?? []);

    console.log(`\n[Group ${groupIdx}] ${groupName}:`);

    // Lay danh sach beverageCategoryIds cua group nay
    const categoryIds = new Set<number>();
    if (menuGroupCategory.length > 0) {
      menuGroupCategory.forEach((categoryMap) => {
        const beverageCategoryId =
          categoryMap?.beverageCategroupId || categoryMap?.beverageCategoryId;
        if (beverageCategoryId) {
          categoryIds.add(Number(beverageCategoryId));
        }
      });
    } else if (Array.isArray(group?.selectedBeverageCategories)) {
      group.selectedBeverageCategories.forEach((categoryId: number) => {
        if (categoryId) {
          categoryIds.add(Number(categoryId));
        }
      });
    }
    console.log(`  Mapped categoryIds:`, Array.from(categoryIds));

    // Loc menuItems thuoc group nay (co beverageCategoryId nam trong categoryIds)
    const groupItems: MenuItemGrouped['items'] = [];
    menuItems.forEach((menuItem, itemIndex) => {
      const beverageCategoryId = getItemCategoryId(menuItem);

      if (categoryIds.has(Number(beverageCategoryId))) {
        if (matchedItemIndexes.has(itemIndex)) {
          return;
        }
        groupItems.push(buildGroupedItem(menuItem));
        matchedItemIndexes.add(itemIndex);
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


  // Fallback: put any unmatched menuItems into an "Other" group
  const unmatchedItems: MenuItemGrouped['items'] = [];
  menuItems.forEach((menuItem, itemIndex) => {
    if (matchedItemIndexes.has(itemIndex)) return;
    unmatchedItems.push(buildGroupedItem(menuItem));
    matchedItemIndexes.add(itemIndex);
  });
  if (unmatchedItems.length > 0) {
    result.push({
      groupName: resolvedGroups.length > 0 ? 'Other' : 'Menu Items',
      beverageCategoryId: -1,
      items: unmatchedItems,
    });
  }

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
  const [menuDetailsPayload, setMenuDetailsPayload] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsReady, setDetailsReady] = useState(false);
  const [newItemCount, setNewItemCount] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [renderingMenu, setRenderingMenu] = useState(false);
  const [renderedMenuUrl, setRenderedMenuUrl] = useState<string | null>(null);
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [isRenderSuccessOpen, setIsRenderSuccessOpen] = useState(false);
  const [renderSuccessMessage, setRenderSuccessMessage] = useState('');
  const [downloadingRender, setDownloadingRender] = useState(false);
  const windowHeight = Dimensions.get('window').height;
  const zoomScale = useSharedValue(1);
  const zoomScaleStart = useSharedValue(1);
  const zoomTranslateX = useSharedValue(0);
  const zoomTranslateY = useSharedValue(0);
  const zoomTranslateXStart = useSharedValue(0);
  const zoomTranslateYStart = useSharedValue(0);
  const zoomStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: zoomTranslateX.value },
      { translateY: zoomTranslateY.value },
      { scale: zoomScale.value },
    ],
  }));

  useEffect(() => {
    if (!isImageZoomOpen) {
      zoomScale.value = 1;
      zoomTranslateX.value = 0;
      zoomTranslateY.value = 0;
    }
  }, [isImageZoomOpen, zoomScale, zoomTranslateX, zoomTranslateY]);
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
      setMenuDetailsPayload(null);
      setDetailsReady(false);
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
    setMenuDetailsPayload(null);
    setDetailsReady(false);

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
      config:
        baseMenu?.config ??
        menuConfig ??
        menuPayload?.config ??
        parsedPayload?.config ??
        parsedPayload?.request?.config ??
        null,
    };
  }, [currentMenu, parsedItem, storedMenuItems, menuConfig, menuPayload, parsedPayload]);

  const groupedItems = useMemo(
    () => groupMenuItemsByCategory(menuForDisplay),
    [menuForDisplay]
  );

  const handleItemPress = (menuItem: any) => {
    if (!menuItem) return;
    const menuItemId = Number(menuItem?.menuItemId ?? menuItem?.id ?? 0);
    let shopRecipe = menuItem?.shopRecipe || null;
    let shopRecipes: any[] = [];
    
    // Check if the beverage has multiple recipes attached
    if (menuItem?.shopBeverage?.shopRecipes && Array.isArray(menuItem.shopBeverage.shopRecipes)) {
      shopRecipes = menuItem.shopBeverage.shopRecipes;
    }

    // Default to the first shop recipe if the item's recipe doesn't exist but the beverage's does
    if (!shopRecipe && shopRecipes.length > 0) {
       shopRecipe = shopRecipes[0];
    }

    const shopRecipeIngredients = toArray(
      shopRecipe?.ingredients ?? shopRecipe?.shopRecipeIngredients ?? []
    );

    router.push({
      pathname: '/recipe-detail/[id]',
      params: {
        id: String(menuItemId || 0),
        recipe: shopRecipe ? JSON.stringify(shopRecipe) : '',
        recipes: shopRecipes.length > 0 ? JSON.stringify(shopRecipes) : '',
        ingredients: JSON.stringify(shopRecipeIngredients),
      },
    });
  };

  const handleGenerateDetails = async () => {
    if (detailsLoading) return;
    if (!parsedItem && !parsedPayload) {
      Alert.alert('Missing data', 'No menu data available to generate details.');
      return;
    }

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

    const payload = {
      menus: {
        ...(menuPayload?.menus?.[resolvedMenuIndex] ?? {}),
        ...(menuFromState ?? {}),
        menuItems: storedMenuItems,
        menuSizeValue: storedMenuItems.length,
        config: resolvedConfig,
      },
      config: resolvedConfig,
    };

    try {
      setDetailsLoading(true);
      setDetailsReady(false);
      const response = await authorizedFetch(API_ENDPOINTS.ai.createMenuDetails(), {
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

      console.log('[Menu Details] Response payload:', responsePayload ?? responseText);
      const detailMenuItems =
        responsePayload?.p3Input?.menu?.menuItems ??
        responsePayload?.menu?.menuItems ??
        responsePayload?.menus?.[resolvedMenuIndex]?.menuItems ??
        null;
      if (detailMenuItems) {
        console.log('[Menu Details] menuItems:', JSON.stringify(detailMenuItems, null, 2));
      }

      const responseMenus = (() => {
        if (!responsePayload) return [];
        if (Array.isArray(responsePayload)) return responsePayload;
        if (responsePayload?.p3Input?.menu) return [responsePayload.p3Input.menu];
        if (responsePayload?.menus) return toArray(responsePayload.menus);
        if (responsePayload?.data) return toArray(responsePayload.data);
        if (responsePayload?.items) return toArray(responsePayload.items);
        if (responsePayload?.menu) return toArray(responsePayload.menu);
        if (responsePayload?.result) return toArray(responsePayload.result);
        return [responsePayload];
      })();

      const responseMenu = responseMenus[resolvedMenuIndex] ?? responseMenus[0] ?? null;
      const responseMenuItems = toArray(
        responsePayload?.p3Input?.menu?.menuItems ??
          responseMenu?.menuItems ??
          responseMenu?.menu?.menuItems ??
          []
      );

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

      if (responsePayload?.p3Input?.menu) {
        setMenuPayload((current) => ({
          ...(current ?? {}),
          menus: [responsePayload.p3Input.menu],
          config: responsePayload.p3Input.config ?? current?.config ?? null,
        }));
      } else if (responsePayload && responsePayload?.menus) {
        const updatedMenus = toArray(responsePayload.menus);
        setMenuPayload((current) => ({
          ...(current ?? {}),
          ...responsePayload,
          menus: updatedMenus,
        }));
      }

      if (responseMenuItems.length > 0) {
        setStoredMenuItems(responseMenuItems);
      }

      if (responsePayload && typeof responsePayload === 'object') {
        setMenuDetailsPayload(responsePayload);
      } else {
        setMenuDetailsPayload(null);
      }

      Toast.show({
        type: 'success',
        text1: 'Recipe details generated',
        text2: 'You can now save and render the menu.',
      });
      setDetailsReady(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to generate menu details.';
      Alert.alert('Generate details failed', message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleRemoveItem = (menuItem: any) => {
    if (!menuItem) return;
    const menuItemId = menuItem?.menuItemId || menuItem?.id;
    if (menuItemId) {
      setStoredMenuItems((prev) => {
        const next = prev.filter((item) => item?.menuItemId !== menuItemId);
        const nextSize = next.length;
        setDetailsReady(false);
        setMenuDetailsPayload(null);
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
      setMenuDetailsPayload(null);
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
      setDetailsReady(false);
      setMenuDetailsPayload(null);
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
    if (menuDetailsPayload) {
      return menuDetailsPayload;
    }
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

      setRenderSuccessMessage(finalUrl ? 'Menu image is ready.' : 'Menu render completed.');
      setIsRenderSuccessOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to render menu.';
      Alert.alert('Render failed', message);
    } finally {
      setRenderingMenu(false);
    }
  };

  const handleDownloadRenderedMenu = async () => {
    if (!renderedMenuUrl) {
      Toast.show({ type: 'info', text1: 'No render available yet' });
      return;
    }

    if (Platform.OS === 'web') {
      Linking.openURL(renderedMenuUrl);
      return;
    }

    if (typeof MediaLibrary.requestPermissionsAsync !== 'function') {
      Toast.show({
        type: 'error',
        text1: 'Download unavailable',
        text2: 'Please rebuild the app to enable photo saving.',
      });
      Linking.openURL(renderedMenuUrl);
      return;
    }

    try {
      setDownloadingRender(true);
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Toast.show({ type: 'error', text1: 'Permission denied', text2: 'Allow access to save the image.' });
        return;
      }

      const safeExtension = (() => {
        const cleanUrl = renderedMenuUrl.split('?')[0];
        const parts = cleanUrl.split('.');
        const last = parts[parts.length - 1];
        return last && last.length <= 4 ? last : 'jpg';
      })();

      const targetUri = `${FileSystem.cacheDirectory}menu-render-${Date.now()}.${safeExtension}`;
      const downloadResult = await FileSystem.downloadAsync(renderedMenuUrl, targetUri);
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      await MediaLibrary.createAlbumAsync('SmartCoffee', asset, false);

      Toast.show({ type: 'success', text1: 'Saved to Photos', text2: 'Menu image downloaded successfully.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Download failed.';
      Toast.show({ type: 'error', text1: 'Download failed', text2: message });
    } finally {
      setDownloadingRender(false);
    }
  };

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      zoomScaleStart.value = zoomScale.value;
    })
    .onUpdate((event) => {
      const nextScale = zoomScaleStart.value * event.scale;
      zoomScale.value = Math.min(3, Math.max(1, nextScale));
    })
    .onEnd(() => {
      if (zoomScale.value <= 1) {
        zoomScale.value = 1;
        zoomTranslateX.value = 0;
        zoomTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      zoomTranslateXStart.value = zoomTranslateX.value;
      zoomTranslateYStart.value = zoomTranslateY.value;
    })
    .onUpdate((event) => {
      if (zoomScale.value <= 1) {
        zoomTranslateX.value = 0;
        zoomTranslateY.value = 0;
        return;
      }
      zoomTranslateX.value = zoomTranslateXStart.value + event.translationX;
      zoomTranslateY.value = zoomTranslateYStart.value + event.translationY;
    })
    .onEnd(() => {
      if (zoomScale.value <= 1) {
        zoomTranslateX.value = 0;
        zoomTranslateY.value = 0;
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      zoomScale.value = 1;
      zoomTranslateX.value = 0;
      zoomTranslateY.value = 0;
    });

  const zoomGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#3C2A21" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={2} ellipsizeMode="tail">
          {title || 'Menu Detail'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {renderedMenuUrl ? (
          <View style={styles.renderedSection}>
            <Text style={styles.renderedTitle}>Rendered Menu</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setIsImageZoomOpen(true)}>
              <Image
                source={{ uri: renderedMenuUrl }}
                style={styles.renderedImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        ) : null}

        {!detailsLoading && !detailsReady && !renderedMenuUrl ? (
          <View style={styles.actionCard}>
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

      <View style={styles.bottomBar}>
        {!renderedMenuUrl ? (
          <TouchableOpacity
            style={[styles.detailButton, detailsLoading && styles.regenerateButtonDisabled]}
            onPress={detailsReady ? handleRenderMenu : handleGenerateDetails}
            disabled={detailsLoading || (detailsReady && renderingMenu)}
          >
            <Text style={styles.detailButtonText}>
              {detailsReady
                ? renderingMenu
                  ? 'Rendering...'
                  : 'Save and Render Menu'
                : detailsLoading
                  ? 'Generating Details...'
                  : 'Generate Recipe Details'}
            </Text>
            <Ionicons
              name={detailsReady ? 'image' : 'sparkles'}
              size={16}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.goBackButton}
          onPress={() => router.replace('/(tabs)/menu')}
        >
          <Ionicons name="arrow-back" size={16} color="#3C2A21" />
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isImageZoomOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsImageZoomOpen(false)}
      >
        <GestureHandlerRootView style={styles.zoomOverlay}>
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
              <GestureDetector gesture={zoomGesture}>
                <Animated.View
                  collapsable={false}
                  style={[
                    styles.zoomImageContainer,
                    { height: Math.min(windowHeight * 0.7, 620) },
                    zoomStyle,
                  ]}
                >
                  <Image
                    source={{ uri: renderedMenuUrl }}
                    style={styles.zoomImage}
                    resizeMode="contain"
                  />
                </Animated.View>
              </GestureDetector>
            ) : null}
          </View>
        </GestureHandlerRootView>
      </Modal>

      <Modal
        visible={isRenderSuccessOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRenderSuccessOpen(false)}
      >
        <View style={styles.renderSuccessOverlay}>
          <TouchableOpacity
            style={styles.renderSuccessBackdrop}
            activeOpacity={1}
            onPress={() => setIsRenderSuccessOpen(false)}
          />
          <View style={styles.renderSuccessCard}>
            <View style={styles.renderSuccessIcon}>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.renderSuccessTitle}>Render success</Text>
            <Text style={styles.renderSuccessText}>{renderSuccessMessage}</Text>
            <View style={styles.renderSuccessActions}>
              <TouchableOpacity
                style={styles.renderSuccessButton}
                onPress={() => setIsRenderSuccessOpen(false)}
              >
                <Text style={styles.renderSuccessButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.renderSuccessButton,
                  styles.renderSuccessButtonPrimary,
                  downloadingRender && styles.renderSuccessButtonDisabled,
                ]}
                onPress={handleDownloadRenderedMenu}
                disabled={downloadingRender}
              >
                <Text style={styles.renderSuccessButtonPrimaryText}>
                  {downloadingRender ? 'Saving...' : 'Download'}
                </Text>
              </TouchableOpacity>
            </View>
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
    lineHeight: 22,
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
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4D7A6F',
  },
  removeButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3C2A21',
    textTransform: 'uppercase',
  },
  detailButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6D9CC',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    gap: 10,
    marginBottom: 18,
  },
  bottomBar: {
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
  goBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1E7DC',
  },
  goBackButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3C2A21',
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
    height: 320,
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
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
  },
  zoomImageContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomImage: {
    width: '100%',
    height: '100%',
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
  renderSuccessOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 24,
  },
  renderSuccessBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  renderSuccessCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 10,
  },
  renderSuccessIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3C7A57',
    alignItems: 'center',
    justifyContent: 'center',
  },
  renderSuccessTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3C2A21',
  },
  renderSuccessText: {
    fontSize: 13,
    color: '#6B5B4D',
    textAlign: 'center',
  },
  renderSuccessActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  renderSuccessButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(60, 42, 33, 0.2)',
    alignItems: 'center',
  },
  renderSuccessButtonPrimary: {
    backgroundColor: '#3C2A21',
    borderColor: '#3C2A21',
  },
  renderSuccessButtonDisabled: {
    opacity: 0.6,
  },
  renderSuccessButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3C2A21',
  },
  renderSuccessButtonPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
