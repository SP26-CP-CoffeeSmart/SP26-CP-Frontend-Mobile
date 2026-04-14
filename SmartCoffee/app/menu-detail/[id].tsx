import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  ImageBackground,
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
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  Swipeable,
} from 'react-native-gesture-handler';
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

const normalizeModifiedMenuItemIds = (menu: any): number[] => {
  const raw =
    menu?.modifiedMenuItemIds ??
    menu?.ModifiedMenuItemIds ??
    menu?.modifiedMenuItemIDs ??
    null;

  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? [raw] : [];
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0);
      }
    } catch {
      // Ignore JSON parse errors and fallback to comma split.
    }
    return trimmed
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);
  }
  return [];
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

const normalizeFirebaseImageUrl = (url: string): string => {
  if (!url.includes('firebasestorage.googleapis.com')) return url;
  try {
    const parsed = new URL(url);
    const marker = '/o/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return url;

    const objectPath = parsed.pathname.slice(markerIndex + marker.length);
    const decodedObjectPath = decodeURIComponent(objectPath);
    const normalizedObjectPath = decodedObjectPath
      .split('/').filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('%2F');

    parsed.pathname = `${parsed.pathname.slice(0, markerIndex + marker.length)}${normalizedObjectPath}`;
    return parsed.toString();
  } catch {
    return url;
  }
};

const getMenuImageForSave = (menu: any, renderedUrls?: string[]): string | null => {
  const firstRenderedUrl = Array.isArray(renderedUrls) && renderedUrls.length > 0
    ? renderedUrls[0]
    : null;
  const candidates = [
    menu?.imageUrl,
    menu?.image,
    menu?.thumbnail,
    menu?.ImageUrl,
    menu?.menu?.imageUrl,
    menu?.menu?.ImageUrl,
    firstRenderedUrl,
  ];

  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') continue;
    return normalizeFirebaseImageUrl(trimmed);
  }

  return null;
};

const extractRenderedUrls = (payload: any): string[] => {
  if (!payload || typeof payload !== 'object') return [];

  const urls: string[] = [];
  const pushIfValid = (value: unknown) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return;
    urls.push(trimmed);
  };

  pushIfValid(payload?.ImageUrl);
  pushIfValid(payload?.imageUrl);

  if (Array.isArray(payload?.imageUrls)) {
    payload.imageUrls.forEach(pushIfValid);
  }
  if (Array.isArray(payload?.ImageUrls)) {
    payload.ImageUrls.forEach(pushIfValid);
  }
  if (Array.isArray(payload?.urls)) {
    payload.urls.forEach(pushIfValid);
  }
  if (Array.isArray(payload?.results)) {
    payload.results.forEach((item: any) => {
      pushIfValid(item?.imageUrl);
      pushIfValid(item?.ImageUrl);
      pushIfValid(item?.url);
    });
  }

  return Array.from(new Set(urls));
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
  const { item, title, payload, menuIndex, flow } = useLocalSearchParams<{
    item?: string;
    title?: string;
    payload?: string;
    menuIndex?: string;
    flow?: string;
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
  const [fullP15Response, setFullP15Response] = useState<any>(null);
  const [storedMenuItems, setStoredMenuItems] = useState<any[]>([]);
  const [menuDetailsPayload, setMenuDetailsPayload] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsReady, setDetailsReady] = useState(false);
  const [regenerateQuantity, setRegenerateQuantity] = useState('1');
  const [regeneratingMenu, setRegeneratingMenu] = useState(false);
  const [savingMenuVersion, setSavingMenuVersion] = useState(false);
  const [renderingMenu, setRenderingMenu] = useState(false);
  const [renderedMenuUrls, setRenderedMenuUrls] = useState<string[]>([]);
  const [selectedRenderPreviewUrl, setSelectedRenderPreviewUrl] = useState<string | null>(null);
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
  const isCreateMenuFlow = flow === 'create-menu';
  const hasRenderedResult = renderedMenuUrls.length > 0;

  useEffect(() => {
    if (!isImageZoomOpen) {
      zoomScale.value = 1;
      zoomTranslateX.value = 0;
      zoomTranslateY.value = 0;
    }
  }, [isImageZoomOpen, zoomScale, zoomTranslateX, zoomTranslateY]);
  useEffect(() => {
    if (!parsedItem && !parsedPayload) {
      setCurrentMenu(null);
      setMenuDraft(null);
      setMenuPayload(null);
      setMenuConfig(null);
      setFullP15Response(null);
      setStoredMenuItems([]);
      setMenuDetailsPayload(null);
      setDetailsReady(false);
      return;
    }

    const payloadMenus = toArray(
      parsedPayload?.menus ??
        parsedPayload?.menu ??
        parsedPayload?.data ??
        parsedPayload?.result ??
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
    setFullP15Response(null);

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

  const modifiedItemIdSet = useMemo(() => {
    const ids = normalizeModifiedMenuItemIds(menuForDisplay);
    return new Set(ids);
  }, [menuForDisplay]);

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
        menuItemId: String(menuItemId || 0),
        recipeId: String(shopRecipe?.recipeId || 0),
        recipe: shopRecipe ? JSON.stringify(shopRecipe) : '',
        recipes: shopRecipes.length > 0 ? JSON.stringify(shopRecipes) : '',
        ingredients: JSON.stringify(shopRecipeIngredients),
      },
    });
  };

  const applyMenuItemsToPayload = (source: any, nextItems: any[]) => {
    if (!source || typeof source !== 'object') return source;

    const next = { ...source };

    if (next.menu && typeof next.menu === 'object') {
      next.menu = { ...next.menu, menuItems: nextItems };
    }

    if (Array.isArray(next.menus)) {
      next.menus = next.menus.map((menu: any, index: number) =>
        index === resolvedMenuIndex ? { ...menu, menuItems: nextItems } : menu
      );
    }

    if (next.p3Input?.menu && typeof next.p3Input.menu === 'object') {
      next.p3Input = {
        ...next.p3Input,
        menu: {
          ...next.p3Input.menu,
          menuItems: nextItems,
        },
      };
    }

    return next;
  };

  const handleDeleteMenuItem = (targetItem: any) => {
    if (!targetItem) return;

    const targetMenuItemId = Number(
      targetItem?.menuItemId ?? targetItem?.sourceMenuItem?.menuItemId ?? targetItem?.id ?? 0
    );

    const nextItems = storedMenuItems.filter((item) => {
      const currentId = Number(item?.menuItemId ?? item?.id ?? 0);
      if (Number.isFinite(targetMenuItemId) && targetMenuItemId > 0) {
        return currentId !== targetMenuItemId;
      }

      // Fallback for newly generated items that do not have menuItemId yet.
      return item !== targetItem?.sourceMenuItem;
    });

    if (nextItems.length === storedMenuItems.length) return;

    setStoredMenuItems(nextItems);
    setCurrentMenu((prev) => (prev ? { ...prev, menuItems: nextItems } : prev));
    setMenuDraft((prev) => (prev ? { ...prev, menuItems: nextItems } : prev));
    setMenuPayload((prev) => applyMenuItemsToPayload(prev, nextItems));
    setFullP15Response((prev) => applyMenuItemsToPayload(prev, nextItems));
    setMenuDetailsPayload((prev) => applyMenuItemsToPayload(prev, nextItems));

    // Menu changed manually, so any previous render output becomes stale.
    setRenderedMenuUrls([]);
    setSelectedRenderPreviewUrl(null);
  };

  const handleRegenerateMenu = async () => {
    if (!isCreateMenuFlow || regeneratingMenu) return;

    const quantity = Number.parseInt(regenerateQuantity, 10);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert('Invalid quantity', 'Please enter a valid quantity greater than 0.');
      return;
    }

    const menuFromState =
      menuDraft ??
      currentMenu ??
      menuPayload?.menus?.[resolvedMenuIndex] ??
      parsedItem ??
      {};

    const resolvedConfig =
      menuConfig ??
      menuPayload?.config ??
      parsedPayload?.config ??
      parsedPayload?.request?.config ??
      parsedPayload?.requestConfig ??
      menuFromState?.config ??
      null;

    const menuForRegenerate = {
      ...(menuFromState ?? {}),
      menuItems: storedMenuItems,
    };

    const payload = {
      // P1.5 contract: keep exact shape and use newItemCount from user quantity.
      config: resolvedConfig,
      menu: menuForRegenerate,
      newItemCount: quantity,
    };

    try {
      setRegeneratingMenu(true);
      const response = await authorizedFetch(API_ENDPOINTS.ai.createMenuRegenerate(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(responseText || `Request failed (${response.status})`);
      }

      let responsePayload: unknown = null;
      if (responseText) {
        try {
          responsePayload = JSON.parse(responseText);
        } catch {
          responsePayload = responseText;
        }
      }

      const responseMenus = (() => {
        if (!responsePayload || typeof responsePayload !== 'object') return [] as any[];
        const payloadObject = responsePayload as any;
        if (Array.isArray(payloadObject)) return payloadObject;
        if (payloadObject?.menus) return toArray(payloadObject.menus);
        if (payloadObject?.data) return toArray(payloadObject.data);
        if (payloadObject?.items) return toArray(payloadObject.items);
        if (payloadObject?.menu) return toArray(payloadObject.menu);
        if (payloadObject?.result) return toArray(payloadObject.result);
        return [payloadObject];
      })();

      const responseConfig =
        (responsePayload as any)?.config ??
        (responsePayload as any)?.request?.config ??
        (responsePayload as any)?.requestConfig ??
        (responsePayload as any)?.menuConfig ??
        resolvedConfig ??
        null;

      const responseMenu = responseMenus[resolvedMenuIndex] ?? responseMenus[0] ?? null;
      let responseMenuItems = toArray(
        responseMenu?.menuItems ??
          responseMenu?.menu?.menuItems ??
          []
      );

      const getRecipeName = (mi: any) => {
        const sr = mi?.shopRecipe || mi?.shopBeverage?.shopRecipes?.[0];
        return sr?.recipeName || mi?.shopBeverage?.name || mi?.name || '';
      };

      const oldRecipeNames = new Set(storedMenuItems.map(getRecipeName));
      responseMenuItems = responseMenuItems.map((item: any) => {
        const rName = getRecipeName(item);
        if (rName && !oldRecipeNames.has(rName)) {
          return { ...item, isNewlyRegenerated: true };
        }
        return item;
      });

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

      if (responseMenus.length > 0 || responseConfig) {
        const fullResponseObject =
          typeof responsePayload === 'object' && responsePayload
            ? (responsePayload as any)
            : {
                menus: responseMenus,
                config: responseConfig,
              };

        setFullP15Response(fullResponseObject);
        setMenuPayload({
          ...fullResponseObject,
          menus: responseMenus.length > 0 ? responseMenus : toArray(fullResponseObject?.menus),
          config: responseConfig,
        });
        setMenuConfig(responseConfig);
      }

      if (responseMenuItems.length > 0) {
        setStoredMenuItems(responseMenuItems);
      }

      // Regeneration changes base menu items, so previous detail/render states are no longer valid.
      setMenuDetailsPayload(null);
      setDetailsReady(false);
      setRenderedMenuUrls([]);
      setSelectedRenderPreviewUrl(null);

      Toast.show({
        type: 'success',
        text1: 'Regenerated successfully',
        text2: 'New menu items have been updated on this page.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to regenerate menu options.';
      Alert.alert('Generate again failed', message);
    } finally {
      setRegeneratingMenu(false);
    }
  };

  const handleGenerateDetails = async () => {
    if (detailsLoading) return;
    if (!parsedItem && !parsedPayload) {
      Alert.alert('Missing data', 'No menu data available to generate details.');
      return;
    }

    const p15Source = fullP15Response ?? menuPayload ?? parsedPayload ?? null;

    const menuFromState =
      p15Source?.menu ??
      menuDraft ??
      currentMenu ??
      p15Source?.menus?.[resolvedMenuIndex] ??
      parsedItem ??
      {};

    const resolvedConfig = {
      ...(menuConfig ?? p15Source?.config ?? p15Source?.request?.config ?? menuFromState?.config ?? {}),
      menuSizeValue: storedMenuItems.length,
    };

    const menuForDetails = {
      ...(p15Source?.menu ?? p15Source?.menus?.[resolvedMenuIndex] ?? {}),
      ...(menuFromState ?? {}),
      menuItems: storedMenuItems,
      menuSizeValue: storedMenuItems.length,
      config: resolvedConfig,
    };

    const payload = {
      // P2 contract: body must contain only menu and config.
      menu: menuForDetails,
      config: resolvedConfig,
    };

    try {
      setDetailsLoading(true);
      setDetailsReady(false);
      console.log('[Menu Details] Request payload:', JSON.stringify(payload, null, 2));
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
      const resolvedModifiedMenuItemIds = normalizeModifiedMenuItemIds(
        responseMenu ?? responsePayload?.p3Input?.menu ?? responsePayload?.menu ?? responsePayload
      );

      if (responseMenu) {
        setCurrentMenu((prev) => ({
          ...(prev ?? {}),
          ...responseMenu,
          ...(resolvedModifiedMenuItemIds.length > 0
            ? { modifiedMenuItemIds: resolvedModifiedMenuItemIds }
            : {}),
        }));
        setMenuDraft((prev) => ({
          ...(prev ?? {}),
          ...responseMenu,
          ...(resolvedModifiedMenuItemIds.length > 0
            ? { modifiedMenuItemIds: resolvedModifiedMenuItemIds }
            : {}),
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
      setRenderedMenuUrls([]);
      setSelectedRenderPreviewUrl(null);
      setDetailsReady(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to generate menu details.';
      Alert.alert('Generate details failed', message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSaveMenuVersion = async () => {
    const menuForSave = menuForDisplay ?? {};
    const menuId = Number(menuForSave?.menuId ?? menuForSave?.id ?? 0);
    const modifiedMenuItemIds = normalizeModifiedMenuItemIds(menuForSave);
    const resolvedImageUrl = getMenuImageForSave(menuForSave, renderedMenuUrls);

    if (!Number.isFinite(menuId) || menuId <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Missing menu ID',
        text2: 'This menu does not have a valid ID to save.',
      });
      return;
    }

    if (modifiedMenuItemIds.length === 0) {
      Toast.show({
        type: 'info',
        text1: 'No changes',
        text2: 'There are no modified items to save.',
      });
      return;
    }

    const imageUrls = Array.isArray(renderedMenuUrls) && renderedMenuUrls.length > 0
      ? renderedMenuUrls
      : resolvedImageUrl
        ? [resolvedImageUrl]
        : [];

    const payload = {
      ...menuForSave,
      menuId,
      modifiedMenuItemIds,
      imageUrl: resolvedImageUrl,
      imageUrls,
    };

    console.log('[Menu Save AI] Request payload:', {
      menuId,
      modifiedMenuItemIds,
      imageUrl: resolvedImageUrl,
      imageUrls,
    });

    try {
      setSavingMenuVersion(true);
      const response = await authorizedFetch(API_ENDPOINTS.menu.saveAi(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let responsePayload: any = null;
      if (responseText) {
        try {
          responsePayload = JSON.parse(responseText);
        } catch {
          responsePayload = responseText;
        }
      }

      if (!response.ok) {
        const backendError = responsePayload?.error ?? responsePayload?.message ?? responseText;
        throw new Error(backendError || `Request failed (${response.status})`);
      }

      console.log('[Menu Save AI] Modified item IDs:', modifiedMenuItemIds);
      const newMenuId = responsePayload?.MenuId ?? responsePayload?.menuId ?? null;
      Toast.show({
        type: 'success',
        text1: 'Saved new version',
        text2: newMenuId ? `New menu ID: ${newMenuId}` : 'Menu version saved successfully.',
      });
      router.replace('/(tabs)/menu');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save menu version.';
      Toast.show({
        type: 'error',
        text1: 'Save failed',
        text2: message,
      });
    } finally {
      setSavingMenuVersion(false);
    }
  };

  const buildMenuRenderPayload = () => {
    const p2Source = menuDetailsPayload ?? fullP15Response ?? menuPayload ?? parsedPayload ?? null;
    const menuFromState =
      p2Source?.menu ??
      menuDraft ??
      currentMenu ??
      p2Source?.menus?.[resolvedMenuIndex] ??
      parsedItem ??
      {};

    const resolvedConfig = {
      ...(menuConfig ?? p2Source?.config ?? p2Source?.request?.config ?? menuFromState?.config ?? {}),
      menuSizeValue: storedMenuItems.length,
    };

    const menuForRender = {
      ...(p2Source?.menu ?? p2Source?.menus?.[resolvedMenuIndex] ?? {}),
      ...(menuFromState ?? {}),
      menuItems: storedMenuItems,
    };

    return {
      menu: menuForRender,
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

    const callRenderApi = async (requestPayload: any) => {
      console.log('[Menu Render] Request payload:', JSON.stringify(requestPayload, null, 2));

      const response = await authorizedFetch(API_ENDPOINTS.ai.createMenuRender(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      const responseText = await response.text();
      let responsePayload: any = null;
      if (responseText) {
        try {
          responsePayload = JSON.parse(responseText);
        } catch {
          responsePayload = responseText;
        }
      }

      if (!response.ok) {
        const backendError =
          responsePayload?.error ?? responsePayload?.message ?? responseText;
        throw new Error(backendError || `Request failed (${response.status})`);
      }

      if (responsePayload && typeof responsePayload === 'object' && responsePayload.success === false) {
        throw new Error(responsePayload?.error || 'Menu render failed.');
      }

      const urls = extractRenderedUrls(responsePayload);
      return { urls, responsePayload };
    };

    try {
      setRenderingMenu(true);
      const result = await callRenderApi(payload);
      setRenderedMenuUrls(result.urls);
      setSelectedRenderPreviewUrl(result.urls[0] ?? null);

      setRenderSuccessMessage(result.urls.length > 0 ? 'Menu image is ready.' : 'Menu render completed.');
      setIsRenderSuccessOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to render menu.';
      Alert.alert('Render failed', message);
    } finally {
      setRenderingMenu(false);
    }
  };

  const handleDownloadRenderedMenu = async () => {
    const targetUrl = selectedRenderPreviewUrl ?? renderedMenuUrls[0] ?? null;
    if (!targetUrl) {
      Toast.show({ type: 'info', text1: 'No render available yet' });
      return;
    }

    if (Platform.OS === 'web') {
      Linking.openURL(targetUrl);
      return;
    }

    if (typeof MediaLibrary.requestPermissionsAsync !== 'function') {
      Toast.show({
        type: 'error',
        text1: 'Download unavailable',
        text2: 'Please rebuild the app to enable photo saving.',
      });
      Linking.openURL(targetUrl);
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
        const cleanUrl = targetUrl.split('?')[0];
        const parts = cleanUrl.split('.');
        const last = parts[parts.length - 1];
        return last && last.length <= 4 ? last : 'jpg';
      })();

      const targetUri = `${FileSystem.cacheDirectory}menu-render-${Date.now()}.${safeExtension}`;
      const downloadResult = await FileSystem.downloadAsync(targetUrl, targetUri);
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
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200' }}
        style={styles.header}
        imageStyle={styles.headerImage}
        blurRadius={5}
      >
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (isCreateMenuFlow && hasRenderedResult) {
                router.replace('/(tabs)/menu');
                return;
              }
              router.back();
            }}
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={2} ellipsizeMode="tail">
            {title || 'Menu Detail'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </ImageBackground>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {renderedMenuUrls.length > 0 ? (
          <View style={styles.renderedSection}>
            <Text style={styles.renderedTitle}>Rendered Menu</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.renderedImageList}>
              {renderedMenuUrls.map((url, index) => (
                <TouchableOpacity
                  key={`${url}-${index}`}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedRenderPreviewUrl(url);
                    setIsImageZoomOpen(true);
                  }}
                >
                  <Image
                    source={{ uri: url }}
                    style={styles.renderedImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {groupedItems.length === 0 ? (
          <Text style={styles.emptyText}>No menu items found in this menu.</Text>
        ) : (
          groupedItems.map((group, groupIndex) => (
            <View key={`group-${group.beverageCategoryId}-${groupIndex}`} style={styles.groupSection}>
              <Text style={styles.groupTitle}>{group.groupName}</Text>
              <View style={styles.itemList}>
                {group.items.map((item, itemIndex) => {
                  const isModified = modifiedItemIdSet.has(Number(item.menuItemId)) || !!item.sourceMenuItem?.isNewlyRegenerated;
                  const card = (
                    <TouchableOpacity
                      key={`${group.beverageCategoryId}-item-${itemIndex}`}
                      style={[styles.itemCard, isModified && styles.itemCardModified]}
                      onPress={() => handleItemPress(item)}
                      activeOpacity={0.75}
                    >
                      {isModified ? (
                        <View style={styles.modifiedBadge}>
                          <Ionicons name="sparkles" size={12} color="#FFFFFF" />
                          <Text style={styles.modifiedBadgeText}>Updated</Text>
                        </View>
                      ) : null}
                      <Image source={getRecipeImage(item.shopRecipe)} style={styles.itemImage} />
                      <View style={styles.itemContent}>
                        <Text style={styles.itemName}>{item.recipeName}</Text>
                        {item.description ? (
                          <Text style={styles.itemDescription} numberOfLines={2}>
                            {item.description}
                          </Text>
                        ) : null}
                        {item.priceInfo ? (
                          <Text style={styles.itemPrice}>{item.priceInfo}</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );

                  if (!isCreateMenuFlow || hasRenderedResult) {
                    return card;
                  }

                  return (
                    <Swipeable
                      key={`${group.beverageCategoryId}-item-${itemIndex}`}
                      overshootRight={false}
                      renderRightActions={() => (
                        <TouchableOpacity
                          style={styles.deleteSwipeAction}
                          onPress={() => handleDeleteMenuItem(item)}
                        >
                          <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                          <Text style={styles.deleteSwipeText}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    >
                      {card}
                    </Swipeable>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {!hasRenderedResult ? (
      <View style={styles.bottomBar}>
        {isCreateMenuFlow ? (
          <>
            <View style={styles.regenerateRow}>
              <TextInput
                style={styles.quantityInput}
                value={regenerateQuantity}
                onChangeText={(text) => setRegenerateQuantity(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="Qty"
                placeholderTextColor="#9E8C7E"
                maxLength={2}
              />
              <TouchableOpacity
                style={[styles.generateAgainButton, regeneratingMenu && styles.buttonDisabled]}
                onPress={handleRegenerateMenu}
                disabled={regeneratingMenu}
              >
                <Text style={styles.generateAgainButtonText}>
                  {regeneratingMenu ? 'Generating...' : 'Generate again'}
                </Text>
              </TouchableOpacity>
            </View>

            {!detailsReady ? (
              <View style={styles.bottomActionsRow}>
                <TouchableOpacity
                  style={[styles.detailButton, detailsLoading && styles.buttonDisabled]}
                  onPress={handleGenerateDetails}
                  disabled={detailsLoading}
                >
                  <Text style={styles.detailButtonText}>
                    {detailsLoading ? 'Generating detail...' : 'Generate detail'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.goBackButton} onPress={() => router.back()}>
                  <Ionicons name="arrow-back" size={16} color="#3C2A21" />
                  <Text style={styles.goBackButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.bottomActionsRow}>
                <TouchableOpacity
                  style={[styles.detailButton, renderingMenu && styles.buttonDisabled]}
                  onPress={handleRenderMenu}
                  disabled={renderingMenu}
                >
                  <Text style={styles.detailButtonText}>
                    {renderingMenu ? 'Saving & rendering...' : 'Save & render'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.goBackButton} onPress={() => router.back()}>
                  <Ionicons name="arrow-back" size={16} color="#3C2A21" />
                  <Text style={styles.goBackButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={styles.bottomActionsRow}>
            <TouchableOpacity
              style={[styles.detailButton, savingMenuVersion && styles.buttonDisabled]}
              onPress={handleSaveMenuVersion}
              disabled={savingMenuVersion}
            >
              <Text style={styles.detailButtonText}>
                {savingMenuVersion ? 'Saving...' : 'Save new version'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.goBackButton, hasRenderedResult && styles.goBackButtonFull]}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={16} color="#3C2A21" />
              <Text style={styles.goBackButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      ) : (
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.goBackAfterRenderButton}
          onPress={() => router.replace('/(tabs)/menu')}
        >
          <Ionicons name="arrow-back" size={16} color="#3C2A21" />
          <Text style={styles.goBackButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
      )}

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
            {selectedRenderPreviewUrl ? (
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
                    source={{ uri: selectedRenderPreviewUrl }}
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
    backgroundColor: '#F6F2EE',
  },
  header: {
    height: 180,
    justifyContent: 'center',
    paddingBottom: 0,
    paddingHorizontal: 16,
  },
  headerImage: {
    resizeMode: 'cover',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
    lineHeight: 24,
  },
  headerSpacer: {
    width: 38,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 140,
    paddingTop: 14,
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
    fontSize: 30,
    fontWeight: '800',
    color: '#3C2A21',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  itemList: {
    gap: 12,
    overflow: 'visible',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1EAE2',
    shadowColor: '#3E2723',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    marginVertical: 6,
  },
  itemCardModified: {
    borderColor: '#D39C5E',
    backgroundColor: '#FFF6EA',
  },
  itemImage: {
    width: 96,
    height: 96,
    borderRadius: 18,
    backgroundColor: '#EEE5DB',
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
    gap: 6,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C1B13',
  },
  itemDescription: {
    fontSize: 12,
    color: '#8B7A6A',
    lineHeight: 16,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C1B13',
  },
  modifiedBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#B26A22',
  },
  modifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  detailButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#2C1B13',
  },
  detailButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  regenerateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  quantityInput: {
    width: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5D8CC',
    backgroundColor: '#F9F4EF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#3C2A21',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  generateAgainButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#6E4B33',
    paddingVertical: 11,
  },
  generateAgainButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  goBackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F1E7DC',
    borderWidth: 1,
    borderColor: '#E5D8CC',
  },
  goBackButtonFull: {
    flex: 1,
  },
  goBackButtonText: {
    fontSize: 14,
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
  renderedImageList: {
    gap: 10,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  renderedImage: {
    width: 260,
    height: 320,
    borderRadius: 12,
    backgroundColor: '#E8DED3',
    alignSelf: 'center',
  },
  goBackAfterRenderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F1E7DC',
    borderWidth: 1,
    borderColor: '#E5D8CC',
  },
  deleteSwipeAction: {
    height: '100%',
    minWidth: 88,
    borderRadius: 18,
    backgroundColor: '#B63A2A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginLeft: 10,
    paddingHorizontal: 12,
  },
  deleteSwipeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
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