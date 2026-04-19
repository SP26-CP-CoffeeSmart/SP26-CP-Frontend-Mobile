import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
  BackHandler,
  Dimensions,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigationState } from '@react-navigation/native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import menuPerformanceService, {
  MenuPerformanceSummary,
  ChartDataItem,
} from '../../services/menuPerformanceService';
import { API_ENDPOINTS, AUTH_BASE_URL } from '../../services/api';
import { authorizedFetch } from '../../services/authService';
import { useBeverageCategories } from '../../context/beverage-category-context';
import { useAuth } from '../../context/auth-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define MenuItem interface similar to daily-sales.tsx for proper data mapping
interface MenuItem {
  menuItemId: number;
  menuId?: number;
  description: string | null;
  sellingPrice: number;
  addedDate: string;
  itemSizeViewModels?: Array<{
    itemSizeId: number;
    beverageSizeId?: number;
    menuItemId?: number;
    sellingPrice?: number;
    scaledTotalCost?: number;
    scaledIngredients?: Array<{
      id?: number;
      quantity?: number;
      cost?: number;
      measurement?: string | null;
      meassurement?: string | null;
      ingredient_id?: number;
      ingredient?: {
        ingredientId?: number;
        name?: string;
        image?: string | null;
        category?: string;
      } | null;
    }>;
    beverageSize?: {
      beverageSizeId: number;
      sizeName?: string;
      volume?: number;
      isActive?: boolean;
    };
  }>;
  shopBeverage: {
    beverageId: number;
    name: string;
    status?: string;
    beverageCategoryId?: number;
    beverageCategoryName?: string;
    imageUrl?: string | null;
    image?: string | null;
    beverageCategory?: {
      beverageCategoryId: number;
      name?: string;
    };
  };
  shopRecipe: {
    recipeId: number;
    recipeName: string;
    image: string | null;
    totalCost?: number | null;
  };
  isExisting?: boolean;
}

interface SizePriceDraft {
  itemSizeId: number;
  beverageSizeId?: number;
  sizeName?: string;
  volume?: number;
  sellingPrice: string;
}

interface MenuItemSnapshot {
  description: string;
  sellingPrice: number;
  sizePrices: Array<{ key: string; price: number }>;
}

interface GenerateRecipeImageRequest {
  recipeId: number;
  recipeName: string;
  imagePrompt: string;
}

interface EditErrors {
  description?: string;
  sellingPrice?: string;
  sizePrices?: Record<number, string>;
}

interface DailySaleRecord {
  salesId: number;
  menuItemId: number;
  menuId: number;
  saleDate: string;
  totalCups: number;
  totalRevenue: number;
  cupSize?: string | null;
  createdAt?: string | null;
}

interface MenuItemCostPayload {
  menuItemId: number;
  totalCost?: number | null;
  shopRecipe?: {
    totalCost?: number | null;
    ingredients?: Array<{
      cost?: number | null;
    }> | null;
  } | null;
}

interface RecipeOption {
  recipeId: number;
  recipeName: string;
  image?: string | null;
  proposedSellingPrice?: number | null;
  totalCost?: number | null;
  beverageId?: number | null;
  beverageName?: string | null;
  beverageCategoryId?: number | null;
  beverageCategoryName?: string | null;
}

interface ShopSizeOption {
  beverageSizeId: number;
  sizeName: string;
  volume?: number;
  isActive: boolean;
}

interface MenuGroup {
  menuGroupId: number;
  name: string;
  orderIndex: number;
  menuItems: MenuItem[];
}

interface MenuData {
  menuId: number;
  menuHeaderId: number;
  versionNumber: string;
  status: string;
  created?: string | null;
  isActive: boolean;
  image?: string | null;
  images?: string[];
  menuGroups: MenuGroup[];
}

const fallbackMenuImage =
  Image.resolveAssetSource(require('../../assets/AI_RecommendationBackground.jpg')).uri;

const MAX_ZOOM_SCALE = 3;
const MENU_PAGE_SIZE = 10;
const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_S_SIZE_PRICE = 120000;
const STRICT_PRICE_PATTERN = /^\d+(\.\d+)?$/;

const getAnchorSizeDraftId = (drafts: SizePriceDraft[]) => {
  if (!Array.isArray(drafts) || drafts.length === 0) return null;

  const byVolume = drafts
    .filter((draft) => Number.isFinite(Number(draft.volume)))
    .sort((left, right) => Number(left.volume) - Number(right.volume));

  if (byVolume.length > 0) {
    return byVolume[0].itemSizeId;
  }

  return drafts[0].itemSizeId;
};

const getSizeDraftLabel = (size: SizePriceDraft, index: number) =>
  size.sizeName || (size.volume ? `${size.volume}ml` : `Size ${index + 1}`);

const getMenuItemSizeLabel = (
  size: { beverageSize?: { sizeName?: string; volume?: number } },
  index: number
) => {
  const sizeName = String(size?.beverageSize?.sizeName ?? '').trim();
  const volume = Number(size?.beverageSize?.volume ?? 0);
  if (sizeName && Number.isFinite(volume) && volume > 0) {
    return `${sizeName} (${volume}ml)`;
  }
  if (sizeName) return sizeName;
  if (Number.isFinite(volume) && volume > 0) return `${volume}ml`;
  return `Size ${index + 1}`;
};

const normalizeSizeToken = (value: string) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()]/g, '');

const getSizeVariantAliases = (
  size: { beverageSize?: { sizeName?: string; volume?: number } } | null,
  index: number
) => {
  if (!size) return [] as string[];

  const sizeName = String(size?.beverageSize?.sizeName ?? '').trim();
  const volume = Number(size?.beverageSize?.volume ?? 0);
  const label = getMenuItemSizeLabel(size, index);

  const aliases = new Set<string>();
  if (sizeName) aliases.add(sizeName);
  if (Number.isFinite(volume) && volume > 0) {
    aliases.add(`${volume}ml`);
    if (sizeName) aliases.add(`${sizeName}${volume}ml`);
  }
  if (label) aliases.add(label);

  return Array.from(aliases);
};

const resolveImageUrl = (raw?: string | null) => {
  if (!raw || raw === 'null' || raw === 'undefined') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return `${AUTH_BASE_URL}${raw}`;
  return `${AUTH_BASE_URL}/images/${raw}`;
};

const resolveGeneratedImageUrl = (payload: any): string | null => {
  if (!payload) return null;
  if (typeof payload === 'string') return payload;
  return (
    payload.imageUrl ||
    payload.firebaseUrl ||
    payload.image ||
    payload.menu?.imageUrl ||
    payload.menu?.ImageUrl ||
    (Array.isArray(payload.results) && payload.results[0]?.imageUrl) ||
    payload.data?.imageUrl ||
    payload.data?.firebaseUrl ||
    payload.data?.image ||
    payload.data?.menu?.imageUrl ||
    payload.data?.menu?.ImageUrl ||
    payload.result?.imageUrl ||
    payload.result?.firebaseUrl ||
    payload.result?.image ||
    payload.result?.menu?.imageUrl ||
    payload.result?.menu?.ImageUrl ||
    (Array.isArray(payload.images) && payload.images[0]?.url) ||
    null
  );
};

const encodeFirebaseImageUrl = (url: unknown): string | undefined => {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return undefined;

  // Keep Firebase query params intact and only normalize the object path after '/o/'.
  if (trimmed.includes('firebasestorage.googleapis.com')) {
    try {
      const parsed = new URL(trimmed);
      const marker = '/o/';
      const markerIndex = parsed.pathname.indexOf(marker);
      if (markerIndex !== -1) {
        const objectPath = parsed.pathname.slice(markerIndex + marker.length);
        const decodedObjectPath = decodeURIComponent(objectPath);
        const normalizedObjectPath = decodedObjectPath
          .split('/')
          .filter(Boolean)
          .map((segment) => encodeURIComponent(segment))
          .join('%2F');

        parsed.pathname = `${parsed.pathname.slice(0, markerIndex + marker.length)}${normalizedObjectPath}`;
        return parsed.toString();
      }
    } catch {
      return trimmed;
    }
  }

  return trimmed;
};

export default function MenuInsightsScreen() {
  const router = useRouter();
  const { menuId, menuImage, menuName } = useLocalSearchParams<{
    menuId?: string;
    menuImage?: string;
    menuName?: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<MenuPerformanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemSalesMap, setItemSalesMap] = useState<Map<number, number>>(new Map());
  const [itemSalesBySizeMap, setItemSalesBySizeMap] = useState<Map<string, number>>(new Map());
  const [itemUnitCostMap, setItemUnitCostMap] = useState<Map<number, number>>(new Map());
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [menuImageUris, setMenuImageUris] = useState<string[]>(
    () => (menuImage ? [menuImage] : [])
  );
  const [currentMenuRaw, setCurrentMenuRaw] = useState<any>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [generatingMenu, setGeneratingMenu] = useState(false);
  const [visibleCount, setVisibleCount] = useState(MENU_PAGE_SIZE);
  const [currentViewerImageIndex, setCurrentViewerImageIndex] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [pendingNewItem, setPendingNewItem] = useState<MenuItem | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editSizePrices, setEditSizePrices] = useState<SizePriceDraft[]>([]);
  const [savingManualEdits, setSavingManualEdits] = useState(false);
  const [saveProgressText, setSaveProgressText] = useState('');
  const [creatingMenuVersion, setCreatingMenuVersion] = useState(false);
  const [createVersionProgressText, setCreateVersionProgressText] = useState('');
  const [lastSavedEditedMenuItemIds, setLastSavedEditedMenuItemIds] = useState<number[]>([]);
  const [hasManualChanges, setHasManualChanges] = useState(false);
  const [editedMenuItemIds, setEditedMenuItemIds] = useState<number[]>([]);
  const [addedMenuItemIds, setAddedMenuItemIds] = useState<number[]>([]);
  const [deletedMenuItemIds, setDeletedMenuItemIds] = useState<number[]>([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [availableRecipes, setAvailableRecipes] = useState<RecipeOption[]>([]);
  const [shopSizes, setShopSizes] = useState<ShopSizeOption[]>([]);
  const [loadingAvailableRecipes, setLoadingAvailableRecipes] = useState(false);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');
  const [editErrors, setEditErrors] = useState<EditErrors>({});
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [isEditModalReadOnly, setIsEditModalReadOnly] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateItemModal, setShowDuplicateItemModal] = useState(false);
  const [duplicateItemMessage, setDuplicateItemMessage] = useState('');
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [generatingImageItemIds, setGeneratingImageItemIds] = useState<number[]>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningModalTitle, setWarningModalTitle] = useState('Warning');
  const [warningModalMessage, setWarningModalMessage] = useState('');
  const [downloadingViewerImage, setDownloadingViewerImage] = useState(false);

  const originalMenuItemsRef = useRef<Map<number, MenuItemSnapshot>>(new Map());

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  
  const { categories } = useBeverageCategories();
  const { coffeeShopId } = useAuth();
  const menuImageUri = menuImageUris[0] ?? null;
  const selectedViewerImageUri =
    menuImageUris[currentViewerImageIndex] ?? menuImageUri ?? fallbackMenuImage;
  const hasEditedMenuItemsForVersion =
    editedMenuItemIds.length > 0 ||
    lastSavedEditedMenuItemIds.length > 0 ||
    addedMenuItemIds.length > 0 ||
    deletedMenuItemIds.length > 0;
  const anchorSizeDraftId = getAnchorSizeDraftId(editSizePrices);
  const anchorSizeDraft =
    anchorSizeDraftId == null
      ? null
      : editSizePrices.find((draft) => draft.itemSizeId === anchorSizeDraftId) ?? null;
  const isMultiSizeEditing = editSizePrices.length > 0;
  const normalizedMenuName = useMemo(() => {
    const raw = String(menuName ?? '').trim();
    if (!raw) return '';
    return raw.replace(/\s+ver\s+.+$/i, '').trim();
  }, [menuName]);
  const previousRouteName = useNavigationState((state) => {
    if (!state || state.index <= 0) return '';
    return String(state.routes[state.index - 1]?.name ?? '');
  });

  const normalizeWarningMessage = useCallback((raw: string) => {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return 'An unexpected error occurred.';
    if (!(trimmed.startsWith('{') && trimmed.endsWith('}'))) return trimmed;

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed?.error === 'string' && parsed.error.trim().length > 0) {
        return parsed.error.trim();
      }
      if (typeof parsed?.message === 'string' && parsed.message.trim().length > 0) {
        return parsed.message.trim();
      }
      return trimmed;
    } catch {
      return trimmed;
    }
  }, []);

  const openWarningModal = useCallback(
    (title: string, message: string) => {
      setWarningModalTitle(title || 'Warning');
      setWarningModalMessage(normalizeWarningMessage(message));
      setShowWarningModal(true);
    },
    [normalizeWarningMessage]
  );

  const resetZoom = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const handleDownloadViewerImage = useCallback(async () => {
    const targetUrl = selectedViewerImageUri;
    if (!targetUrl) {
      openWarningModal('Download unavailable', 'No menu image available to download.');
      return;
    }

    if (Platform.OS === 'web') {
      Linking.openURL(targetUrl);
      return;
    }

    if (typeof MediaLibrary.requestPermissionsAsync !== 'function') {
      openWarningModal(
        'Download unavailable',
        'Please rebuild the app to enable photo saving.'
      );
      return;
    }

    try {
      setDownloadingViewerImage(true);

      const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
      if (!permission.granted) {
        openWarningModal('Permission denied', 'Allow photo access to save this image.');
        return;
      }

      const safeExtension = (() => {
        const cleanUrl = targetUrl.split('?')[0];
        const parts = cleanUrl.split('.');
        const last = parts[parts.length - 1];
        return last && last.length <= 4 ? last : 'jpg';
      })();

      const targetUri = `${FileSystem.cacheDirectory}menu-insights-${Date.now()}.${safeExtension}`;
      const downloadResult = await FileSystem.downloadAsync(targetUrl, targetUri);
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      await MediaLibrary.createAlbumAsync('SmartCoffee', asset, false);

      Toast.show({
        type: 'success',
        text1: 'Saved to Photos',
        text2: 'Menu image downloaded successfully.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to download image.';
      openWarningModal('Download failed', message);
    } finally {
      setDownloadingViewerImage(false);
    }
  }, [selectedViewerImageUri, openWarningModal]);

  const parseNumberInput = (value: string, fallback: number) => {
    const normalized = value.trim();
    if (!normalized || !STRICT_PRICE_PATTERN.test(normalized)) return fallback;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const parsePriceInputValue = (value: string): number | null => {
    const normalized = value.trim();
    if (!normalized || !STRICT_PRICE_PATTERN.test(normalized)) return null;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  };

  const normalizeDescriptionInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return trimmed.replace(/\[PRICES\][\s\S]*$/i, '').trim();
  };

  const buildRecipeImagePrompt = (recipeName: string) => `tạo ảnh cho ${recipeName}`;

  const resolveRecipeImageUrlFromPayload = (payload: any, recipeId: number): string | null => {
    if (!payload) return null;

    const fromArray = (arr: any[]) => {
      const matched = arr.find((entry) => Number(entry?.recipeId ?? entry?.RecipeId) === recipeId);
      if (matched) {
        const matchedUrl = resolveGeneratedImageUrl(matched);
        if (matchedUrl) return matchedUrl;
      }

      for (const entry of arr) {
        const url = resolveGeneratedImageUrl(entry);
        if (url) return url;
      }

      return null;
    };

    if (Array.isArray(payload)) {
      return fromArray(payload);
    }

    if (Array.isArray(payload?.data)) {
      const fromData = fromArray(payload.data);
      if (fromData) return fromData;
    }

    return resolveGeneratedImageUrl(payload);
  };

  const resolveRecipeImageErrorFromPayload = (payload: any, recipeId: number): string | null => {
    if (!payload) return null;

    const getErrorFromResult = (entry: any): string | null => {
      const isFailed = entry?.success === false || entry?.Success === false;
      if (!isFailed) return null;
      return String(entry?.error ?? entry?.Error ?? entry?.message ?? entry?.Message ?? '').trim() ||
        'AI image generation failed.';
    };

    const fromArray = (arr: any[]): string | null => {
      const matched = arr.find((entry) => Number(entry?.recipeId ?? entry?.RecipeId) === recipeId);
      if (matched) {
        return getErrorFromResult(matched);
      }

      for (const entry of arr) {
        const error = getErrorFromResult(entry);
        if (error) return error;
      }

      return null;
    };

    if (Array.isArray(payload)) {
      return fromArray(payload);
    }

    if (Array.isArray(payload?.results)) {
      const fromResults = fromArray(payload.results);
      if (fromResults) return fromResults;
    }

    if (Array.isArray(payload?.data)) {
      const fromData = fromArray(payload.data);
      if (fromData) return fromData;
    }

    const rootFailed = payload?.success === false || payload?.Success === false;
    if (rootFailed) {
      return String(payload?.error ?? payload?.Error ?? payload?.message ?? payload?.Message ?? '').trim() ||
        'AI image generation failed.';
    }

    return null;
  };

  const buildMenuItemSnapshot = (item: MenuItem): MenuItemSnapshot => {
    const sizePrices = (item.itemSizeViewModels ?? []).map((size, index) => {
      const key = String(size.beverageSizeId ?? size.itemSizeId ?? index);
      const price = Number(size.sellingPrice ?? 0);
      return { key, price };
    });

    sizePrices.sort((a, b) => a.key.localeCompare(b.key));

    return {
      description: (item.description ?? '').trim(),
      sellingPrice: Number(item.sellingPrice ?? 0),
      sizePrices,
    };
  };

  const isSnapshotEqual = (left: MenuItemSnapshot, right: MenuItemSnapshot) => {
    if (left.description !== right.description) return false;
    if (left.sellingPrice !== right.sellingPrice) return false;
    if (left.sizePrices.length !== right.sizePrices.length) return false;

    for (let i = 0; i < left.sizePrices.length; i += 1) {
      const leftSize = left.sizePrices[i];
      const rightSize = right.sizePrices[i];
      if (leftSize.key !== rightSize.key) return false;
      if (leftSize.price !== rightSize.price) return false;
    }

    return true;
  };

  const isMenuItemEdited = (item: MenuItem) => {
    const original = originalMenuItemsRef.current.get(item.menuItemId);
    if (!original) return false;
    return !isSnapshotEqual(original, buildMenuItemSnapshot(item));
  };

  const hasActualUnsavedChanges = useMemo(
    () =>
      menuItems.some((item) => isMenuItemEdited(item)) ||
      addedMenuItemIds.length > 0 ||
      deletedMenuItemIds.length > 0,
    [addedMenuItemIds.length, deletedMenuItemIds.length, menuItems]
  );
  const shouldShowManualEditCard =
    hasEditedMenuItemsForVersion ||
    hasActualUnsavedChanges ||
    savingManualEdits ||
    creatingMenuVersion;

  const navigateToMenuVersion = useCallback(() => {
    if (previousRouteName.toLowerCase().includes('menu-version') && router.canGoBack()) {
      router.back();
      return;
    }

    const menuHeaderId = Number(currentMenuRaw?.menuHeaderId ?? currentMenuRaw?.MenuHeaderId ?? 0);
    if (Number.isFinite(menuHeaderId) && menuHeaderId > 0) {
      router.replace({
        pathname: '/menu-version/[id]',
        params: {
          id: String(menuHeaderId),
          ...(normalizedMenuName ? { name: normalizedMenuName } : {}),
        },
      });
      return;
    }
    router.replace('/(tabs)/menu');
  }, [currentMenuRaw, normalizedMenuName, previousRouteName, router]);

  const handleBackPress = useCallback(() => {
    if (hasActualUnsavedChanges) {
      setShowBackConfirm(true);
      return;
    }

    if (
      hasManualChanges ||
      editedMenuItemIds.length > 0 ||
      addedMenuItemIds.length > 0 ||
      deletedMenuItemIds.length > 0
    ) {
      setHasManualChanges(false);
      setEditedMenuItemIds([]);
      setAddedMenuItemIds([]);
      setDeletedMenuItemIds([]);
    }

    navigateToMenuVersion();
  }, [
    editedMenuItemIds.length,
    addedMenuItemIds.length,
    deletedMenuItemIds.length,
    hasActualUnsavedChanges,
    hasManualChanges,
    navigateToMenuVersion,
  ]);

  const openFeedbackInsights = useCallback(() => {
    router.push({
      pathname: '/feedback-insights',
      params: {
        menuId: String(menuId ?? ''),
      },
    });
  }, [menuId, router]);

  const closeEditModal = useCallback(() => {
    setShowEditModal(false);
    setIsEditModalReadOnly(false);
    setEditingItem(null);
    setPendingNewItem(null);
  }, []);

  useEffect(() => {
    const onHardwareBackPress = () => {
      if (showEditModal) {
        closeEditModal();
        return true;
      }

      if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
        setDeletingItem(null);
        return true;
      }

      if (showDuplicateItemModal) {
        setShowDuplicateItemModal(false);
        setDuplicateItemMessage('');
        return true;
      }

      if (showWarningModal) {
        setShowWarningModal(false);
        return true;
      }

      if (showBackConfirm) {
        setShowBackConfirm(false);
        return true;
      }

      handleBackPress();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
    return () => subscription.remove();
  }, [
    closeEditModal,
    handleBackPress,
    showBackConfirm,
    showDeleteConfirm,
    showDuplicateItemModal,
    showEditModal,
    showWarningModal,
  ]);

  const openEditModalForItem = (item: MenuItem, options?: { readOnly?: boolean }) => {
    setEditingItem(item);
    const sizeDrafts = (item.itemSizeViewModels ?? []).map((size, index) => ({
      itemSizeId: size.itemSizeId > 0 ? size.itemSizeId : index,
      beverageSizeId: size.beverageSizeId ?? size.beverageSize?.beverageSizeId,
      sizeName: size.beverageSize?.sizeName,
      volume: size.beverageSize?.volume,
      sellingPrice: String(size.sellingPrice ?? 0),
    }));

    const anchorSizeId = getAnchorSizeDraftId(sizeDrafts);
    const anchorSizePrice =
      anchorSizeId == null
        ? null
        : sizeDrafts.find((draft) => draft.itemSizeId === anchorSizeId)?.sellingPrice ?? null;

    setEditDescription(item.description ?? '');
    setEditSellingPrice(anchorSizePrice ?? String(item.sellingPrice ?? 0));
    setEditErrors({});
    setEditSizePrices(sizeDrafts);
    setIsEditModalReadOnly(Boolean(options?.readOnly));
    setShowEditModal(true);
  };

  const updateSizePriceDraft = (itemSizeId: number, value: string) => {
    setEditSizePrices((prev) => {
      let nextDrafts = prev.map((draft) =>
        draft.itemSizeId === itemSizeId ? { ...draft, sellingPrice: value } : draft
      );
      const anchorSizeId = getAnchorSizeDraftId(nextDrafts);
      if (anchorSizeId != null && anchorSizeId === itemSizeId) {
        setEditSellingPrice(value);

        const anchorDraft = nextDrafts.find((draft) => draft.itemSizeId === anchorSizeId);
        const anchorPrice = parsePriceInputValue(value);
        const anchorVolume = Number(anchorDraft?.volume ?? 0);
        const hasAnchorVolume = Number.isFinite(anchorVolume) && anchorVolume > 0;

        if (anchorPrice != null) {
          nextDrafts = nextDrafts.map((draft) => {
            if (draft.itemSizeId === anchorSizeId) {
              return { ...draft, sellingPrice: value };
            }

            const draftVolume = Number(draft.volume ?? 0);
            const hasDraftVolume = Number.isFinite(draftVolume) && draftVolume > 0;
            const ratio = hasAnchorVolume && hasDraftVolume ? draftVolume / anchorVolume : 1;
            const autoPrice = Math.max(anchorPrice, Math.round(anchorPrice * ratio));

            return {
              ...draft,
              sellingPrice: String(autoPrice),
            };
          });
        }
      }
      return nextDrafts;
    });
  };

  const getMenuItemCostFloor = (item?: MenuItem | null) => {
    if (!item) return 0;

    const itemLevelCost = Number((item as any)?.totalCost ?? 0);
    const recipeLevelCost = Number(item?.shopRecipe?.totalCost ?? 0);
    const mappedUnitCost = Number(itemUnitCostMap.get(item.menuItemId) ?? 0);

    const sizeSorted = [...(item.itemSizeViewModels ?? [])].sort(
      (left, right) => Number(left?.beverageSize?.volume ?? Number.MAX_SAFE_INTEGER) - Number(right?.beverageSize?.volume ?? Number.MAX_SAFE_INTEGER)
    );
    const sSizeCost = Number(sizeSorted[0]?.scaledTotalCost ?? 0);

    const resolvedCost =
      [sSizeCost, recipeLevelCost, mappedUnitCost, itemLevelCost].find(
        (value) => Number.isFinite(value) && value > 0
      ) ?? 0;

    return Math.ceil(resolvedCost);
  };

  const getMenuItemSizeCostFloors = (item?: MenuItem | null) => {
    const perSize = new Map<number, number>();
    if (!item) {
      return {
        perSize,
        fallback: 0,
      };
    }

    (item.itemSizeViewModels ?? []).forEach((size, index) => {
      const sizeId = size.itemSizeId > 0 ? size.itemSizeId : index;
      const scaledCost = Number(size.scaledTotalCost ?? 0);
      if (Number.isFinite(scaledCost) && scaledCost > 0) {
        perSize.set(sizeId, Math.ceil(scaledCost));
      }
    });

    return {
      perSize,
      fallback: getMenuItemCostFloor(item),
    };
  };

  const validateEditForm = () => {
    const errors: EditErrors = {};
    const costFloor = getMenuItemCostFloor(editingItem);
    const { perSize: sizeCostFloorMap, fallback: fallbackCostFloor } = getMenuItemSizeCostFloors(editingItem);
    const trimmedDescription = normalizeDescriptionInput(editDescription);
    if (!trimmedDescription) {
      errors.description = 'Description is required.';
    } else if (trimmedDescription.length > 240) {
      errors.description = 'Description must be 240 characters or less.';
    }

    if (!isMultiSizeEditing) {
      const priceValue = editSellingPrice.trim();
      const parsedPrice = Number(priceValue);
      if (!priceValue || !STRICT_PRICE_PATTERN.test(priceValue) || !Number.isFinite(parsedPrice)) {
        errors.sellingPrice = 'Price must be numeric.';
      } else if (parsedPrice <= 0) {
        errors.sellingPrice = 'Price must be greater than 0.';
      } else if (Number.isFinite(costFloor) && costFloor > 0 && parsedPrice < costFloor) {
        errors.sellingPrice = `Price must be at least cost (${formatAmountNoUnit(costFloor)} VND).`;
      }
    }

    if (editSizePrices.length > 0) {
      const sizeErrors: Record<number, string> = {};
      editSizePrices.forEach((size, index) => {
        const sizeValue = size.sellingPrice.trim();
        const parsedSize = Number(sizeValue);
        if (!sizeValue || !STRICT_PRICE_PATTERN.test(sizeValue) || !Number.isFinite(parsedSize)) {
          sizeErrors[size.itemSizeId] = 'Price must be numeric.';
        } else if (parsedSize <= 0) {
          sizeErrors[size.itemSizeId] = 'Price must be greater than 0.';
        } else {
          const sizeCostFloor = sizeCostFloorMap.get(size.itemSizeId) ?? fallbackCostFloor;
          if (Number.isFinite(sizeCostFloor) && sizeCostFloor > 0 && parsedSize < sizeCostFloor) {
            sizeErrors[size.itemSizeId] = `${getSizeDraftLabel(size, index)} price must be at least cost (${formatAmountNoUnit(sizeCostFloor)} VND).`;
          }
        }
      });

      const anchorSizeId = getAnchorSizeDraftId(editSizePrices);
      if (anchorSizeId != null) {
        const anchorDraft = editSizePrices.find((size) => size.itemSizeId === anchorSizeId);
        const anchorPriceRaw = String(anchorDraft?.sellingPrice ?? '').trim();
        const anchorPrice = STRICT_PRICE_PATTERN.test(anchorPriceRaw) ? Number(anchorPriceRaw) : 0;
        if (Number.isFinite(anchorPrice) && anchorPrice > MAX_S_SIZE_PRICE) {
          sizeErrors[anchorSizeId] = `Size S price must not exceed ${formatAmountNoUnit(MAX_S_SIZE_PRICE)} VND.`;
        }
      }

      const sizesSortedByVolume = [...editSizePrices].sort((left, right) => {
        const leftVolume = Number(left.volume ?? Number.MAX_SAFE_INTEGER);
        const rightVolume = Number(right.volume ?? Number.MAX_SAFE_INTEGER);
        return leftVolume - rightVolume;
      });

      for (let i = 1; i < sizesSortedByVolume.length; i += 1) {
        const prev = sizesSortedByVolume[i - 1];
        const curr = sizesSortedByVolume[i];
        const prevPriceRaw = prev.sellingPrice.trim();
        const currPriceRaw = curr.sellingPrice.trim();
        const prevPrice = STRICT_PRICE_PATTERN.test(prevPriceRaw) ? Number(prevPriceRaw) : NaN;
        const currPrice = STRICT_PRICE_PATTERN.test(currPriceRaw) ? Number(currPriceRaw) : NaN;

        if (
          Number.isFinite(prevPrice) &&
          Number.isFinite(currPrice) &&
          prevPrice > 0 &&
          currPrice > 0 &&
          currPrice < prevPrice
        ) {
          sizeErrors[curr.itemSizeId] = 'Larger size cannot be cheaper than smaller size.';
        }
      }

      if (Object.keys(sizeErrors).length > 0) {
        errors.sizePrices = sizeErrors;
      }
    }

    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const applyEditChanges = () => {
    if (!editingItem) return;
    if (!validateEditForm()) return;

    const nextDescription = normalizeDescriptionInput(editDescription);

    const updatedSizes = (editingItem.itemSizeViewModels ?? []).map((size, index) => {
      const sizeId = size.itemSizeId > 0 ? size.itemSizeId : index;
      const draft = editSizePrices.find((item) => item.itemSizeId === sizeId);
      const nextSizePrice = draft
        ? parseNumberInput(draft.sellingPrice, size.sellingPrice ?? 0)
        : size.sellingPrice ?? 0;

      return {
        ...size,
        itemSizeId: sizeId,
        beverageSizeId: size.beverageSizeId ?? size.beverageSize?.beverageSizeId,
        sellingPrice: nextSizePrice,
      };
    });

    const nextSellingPrice = (() => {
      if (updatedSizes.length === 0) {
        return parseNumberInput(editSellingPrice, editingItem.sellingPrice ?? 0);
      }
      const smallestSize = [...updatedSizes].sort((left, right) => {
        const leftVolume = Number(left.beverageSize?.volume ?? Number.MAX_SAFE_INTEGER);
        const rightVolume = Number(right.beverageSize?.volume ?? Number.MAX_SAFE_INTEGER);
        return leftVolume - rightVolume;
      })[0];

      return Number(smallestSize?.sellingPrice ?? editingItem.sellingPrice ?? 0);
    })();

    const updatedItem: MenuItem = {
      ...editingItem,
      description: nextDescription,
      sellingPrice: nextSellingPrice,
      itemSizeViewModels: updatedSizes.length > 0 ? updatedSizes : editingItem.itemSizeViewModels,
    };
    const isAddingNewItem = pendingNewItem?.menuItemId === editingItem.menuItemId;

    if (isAddingNewItem) {
      setMenuItems((prev) => [updatedItem, ...prev]);
      setEditedMenuItemIds((prev) => Array.from(new Set([...prev, updatedItem.menuItemId])));
      setAddedMenuItemIds((prev) => Array.from(new Set([...prev, updatedItem.menuItemId])));
      setHasManualChanges(true);
      Toast.show({
        type: 'success',
        text1: 'Item added',
        text2:
          updatedSizes.length > 0
            ? `${updatedItem.shopRecipe.recipeName} was added after completing required fields.`
            : `${updatedItem.shopRecipe.recipeName} was added. No active beverage sizes found for this shop.`,
      });
    } else {
      setMenuItems((prev) =>
        prev.map((item) => (item.menuItemId === editingItem.menuItemId ? updatedItem : item))
      );

      const edited = isMenuItemEdited(updatedItem);
      setEditedMenuItemIds((prev) => {
        const next = new Set(prev);
        if (edited) {
          next.add(updatedItem.menuItemId);
        } else {
          next.delete(updatedItem.menuItemId);
        }
        const nextArray = Array.from(next);
        setHasManualChanges(
          nextArray.length > 0 || addedMenuItemIds.length > 0 || deletedMenuItemIds.length > 0
        );
        return nextArray;
      });
    }

    closeEditModal();
  };

  const buildUpdatePayload = (menuIdValue: number, menuRaw: any, items: MenuItem[], images: string[]) => {
    const configSource =
      menuRaw?.config ??
      menuRaw?.request?.config ??
      menuRaw?.requestConfig ??
      menuRaw?.menuConfig ??
      {};
    const menuGroupsSource = Array.isArray(menuRaw?.menuGroups) ? menuRaw.menuGroups : [];

    const normalizedImageUrls = (Array.isArray(images) ? images : [])
      .map((raw) => resolveImageUrl(raw))
      .filter((value): value is string => Boolean(value && value.trim().length > 0));
    const fallbackImage = resolveImageUrl(
      menuRaw?.imageUrl ?? menuRaw?.ImageUrl ?? menuRaw?.image ?? menuRaw?.Image ?? null
    );
    const imageUrl = normalizedImageUrls[0] ?? fallbackImage ?? '';
    const normalizeEnumToken = (value: unknown) =>
      String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]/g, '');
    const parseEnumIndex = (
      value: unknown,
      dictionary: Record<string, number>,
      fallbackValue: number
    ) => {
      const asNumber = Number(value);
      if (Number.isFinite(asNumber)) return asNumber;
      const token = normalizeEnumToken(value);
      return dictionary[token] ?? fallbackValue;
    };
    const extractGroupCategoryIds = (group: any): number[] => {
      if (!Array.isArray(group?.menuGroupCategory)) return [];
      return group.menuGroupCategory
        .map((entry: any) =>
          Number(
            entry?.beverageCategoryId ??
              entry?.BeverageCategoryId ??
              entry?.categoryId ??
              entry?.CategoryId ??
              entry
          )
        )
        .filter((categoryId: number) => Number.isFinite(categoryId) && categoryId > 0);
    };

    const topicValue = parseEnumIndex(
      configSource?.topic ?? configSource?.theme,
      {
        summerrefresh: 0,
        summer: 0,
        winterwarmers: 1,
        winter: 1,
        rainydaycomfort: 2,
        rainy: 2,
      },
      0
    );
    const layoutValue = parseEnumIndex(
      configSource?.layout,
      {
        vertical: 0,
        horizontal: 1,
        descriptive: 2,
      },
      0
    );
    const pricingValue = parseEnumIndex(
      configSource?.pricing,
      {
        budget: 0,
        moderate: 1,
        premium: 2,
        luxury: 3,
      },
      0
    );

    return {
      menu: {
        menuId: menuIdValue,
        menuHeaderId: Number(menuRaw?.menuHeaderId ?? menuRaw?.MenuHeaderId ?? 0),
        versionNumber: String(menuRaw?.versionNumber ?? menuRaw?.VersionNumber ?? '1.0'),
        status: String(menuRaw?.status ?? menuRaw?.Status ?? 'InActive'),
        isActive: Boolean(menuRaw?.isActive ?? menuRaw?.IsActive ?? false),
        imageUrl,
        imageUrls: normalizedImageUrls.length > 0 ? normalizedImageUrls : imageUrl ? [imageUrl] : [],
        menuItems: items.map((item) => ({
          menuItemId: Number(item.menuItemId ?? 0) > 0 ? Number(item.menuItemId) : 0,
          beverageId: Number(item.shopBeverage?.beverageId ?? 0),
          recipeId: Number(item.shopRecipe?.recipeId ?? 0),
          description: item.description ?? '',
          sellingPrice: Number(item.sellingPrice ?? 0),
          shopBeverage: {
            beverageId: Number(item.shopBeverage?.beverageId ?? 0),
            name: String(item.shopBeverage?.name ?? ''),
            beverageCategoryId: Number(
              item.shopBeverage?.beverageCategoryId ??
                item.shopBeverage?.beverageCategory?.beverageCategoryId ??
                0
            ),
            beverageCategory: {
              beverageCategoryId: Number(
                item.shopBeverage?.beverageCategoryId ??
                  item.shopBeverage?.beverageCategory?.beverageCategoryId ??
                  0
              ),
              name: String(
                item.shopBeverage?.beverageCategory?.name ??
                  item.shopBeverage?.beverageCategoryName ??
                  ''
              ),
            },
          },
          shopRecipe: {
            recipeId: Number(item.shopRecipe?.recipeId ?? 0),
          },
          itemSizeViewModels: (item.itemSizeViewModels ?? []).map((size) => ({
            itemSizeId: Number(size.itemSizeId ?? 0),
            beverageSizeId: Number(size.beverageSizeId ?? size.beverageSize?.beverageSizeId ?? 0),
            sellingPrice: Number(size.sellingPrice ?? 0),
            scaledTotalCost: Number(size.scaledTotalCost ?? 0),
            scaledIngredients: Array.isArray(size.scaledIngredients)
              ? size.scaledIngredients.map((ingredient) => ({
                  ...ingredient,
                  quantity: Number(ingredient?.quantity ?? 0),
                  cost: Number(ingredient?.cost ?? 0),
                }))
              : [],
            beverageSize: size.beverageSize
              ? {
                  beverageSizeId: Number(size.beverageSize.beverageSizeId ?? size.beverageSizeId ?? 0),
                  sizeName: String(size.beverageSize.sizeName ?? ''),
                  volume: Number(size.beverageSize.volume ?? 0),
                  isActive: Boolean(size.beverageSize.isActive ?? true),
                }
              : undefined,
          })),
        })),
        menuGroups: menuGroupsSource.map((group: any, index: number) => ({
          menuGroupId: Number(group?.menuGroupId ?? group?.id ?? 0),
          name: String(group?.name ?? group?.groupName ?? `Group ${index + 1}`),
          orderIndex: Number(group?.orderIndex ?? index + 1),
          menuGroupCategory: Array.isArray(group?.menuGroupCategory) ? group.menuGroupCategory : [],
        })),
      },
      config: {
        title: String(configSource?.title ?? configSource?.menuTitle ?? 'MENU'),
        menuSizeValue: Number(configSource?.menuSizeValue ?? configSource?.menuSize ?? 12),
        numberOfOptions: Number(configSource?.numberOfOptions ?? 1),
        topic: topicValue,
        layout: layoutValue,
        shopStyle: String(configSource?.shopStyle ?? configSource?.style ?? ''),
        pricing: pricingValue,
        useExistingShopItems: Boolean(configSource?.useExistingShopItems ?? true),
        groups: Array.isArray(configSource?.groups)
          ? configSource.groups.map((group: any) => ({
              name: String(group?.name ?? group?.groupName ?? ''),
              selectedBeverageCategories: Array.isArray(group?.selectedBeverageCategories)
                ? group.selectedBeverageCategories
                    .map((categoryId: any) => Number(categoryId))
                    .filter((categoryId: number) => Number.isFinite(categoryId))
                : [],
            }))
          : menuGroupsSource.map((group: any) => ({
              name: String(group?.name ?? group?.groupName ?? ''),
              selectedBeverageCategories: extractGroupCategoryIds(group),
            })),
      },
    };
  };

  const handleSaveManualEdits = async () => {
    if (!hasActualUnsavedChanges) {
      openWarningModal('No changes', 'There are no pending menu item changes to save.');
      return;
    }

    if (!menuId) {
      openWarningModal('Missing menu', 'Menu ID is missing.');
      return;
    }

    const id = Number(menuId);
    if (!Number.isFinite(id)) {
      openWarningModal('Invalid menu', 'Menu ID is invalid.');
      return;
    }

    if (!currentMenuRaw) {
      openWarningModal('Missing menu', 'Menu data is not loaded yet.');
      return;
    }

    try {
      setSavingManualEdits(true);
      setSaveProgressText('Preparing payload...');
      const payload = buildUpdatePayload(id, currentMenuRaw, menuItems, menuImageUris);
      setSaveProgressText('Saving menu updates...');
      const response = await authorizedFetch(API_ENDPOINTS.ai.updateAi(id), {
        method: 'PUT',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        console.log('[Save manual edits] error response:', { status: response.status, text });
        throw new Error(text || `Request failed (${response.status})`);
      }

      setSaveProgressText('Updating generated images...');
      const responsePayload = await response.json();
      const responseImages = Array.isArray(responsePayload?.ImageUrls)
        ? responsePayload.ImageUrls
        : Array.isArray(responsePayload?.imageUrls)
          ? responsePayload.imageUrls
          : [];
      const responsePrimary = responsePayload?.ImageUrl ?? responsePayload?.imageUrl ?? null;
      const normalizedImages = [responsePrimary, ...responseImages]
        .map((raw: string | null) => resolveImageUrl(raw))
        .filter((value): value is string => Boolean(value));

      if (normalizedImages.length > 0) {
        setMenuImageUris(Array.from(new Set(normalizedImages)));
      }

      const savedEditedIds = [
        ...new Set(
          [...editedMenuItemIds, ...addedMenuItemIds, ...deletedMenuItemIds].filter((id) => id > 0)
        ),
      ];
      setHasManualChanges(false);
      setEditedMenuItemIds([]);
      setAddedMenuItemIds([]);
      setDeletedMenuItemIds([]);
      setLastSavedEditedMenuItemIds(savedEditedIds);
      originalMenuItemsRef.current = new Map(
        menuItems.map((item) => [item.menuItemId, buildMenuItemSnapshot(item)])
      );
      setSaveProgressText('Refreshing latest menu...');
      Toast.show({
        type: 'success',
        text1: 'Saved successfully',
        text2: 'Manual edits were saved.',
      });
      await fetchMenuItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save menu updates.';
      openWarningModal('Save failed', message);
      console.log('[Save manual edits] error:', error);
    } finally {
      setSavingManualEdits(false);
      setSaveProgressText('');
    }
  };

  const fetchShopRecipes = useCallback(async () => {
    if (!coffeeShopId) {
      openWarningModal('Missing coffee shop', 'Could not determine coffee shop for this account.');
      return;
    }

    try {
      setLoadingAvailableRecipes(true);
      const response = await authorizedFetch(API_ENDPOINTS.shopRecipe.getByShop(coffeeShopId), {
        headers: {
          Accept: '*/*',
        },
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const payload = await response.json();
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : [];
      const mapped: RecipeOption[] = list.map((item: any) => ({
        recipeId: Number(item?.recipeId ?? item?.RecipeId ?? 0),
        recipeName: String(item?.recipeName ?? item?.RecipeName ?? 'Unnamed recipe'),
        image: item?.image ?? item?.Image ?? null,
        proposedSellingPrice: Number(item?.proposedSellingPrice ?? item?.ProposedSellingPrice ?? 0),
        totalCost: Number(item?.totalCost ?? item?.TotalCost ?? 0),
        beverageId: Number(item?.beverage?.beverageId ?? item?.beverageId ?? 0),
        beverageName: String(item?.beverage?.name ?? item?.beverageName ?? item?.recipeName ?? 'Unknown'),
        beverageCategoryId: Number(
          item?.beverage?.beverageCategory?.beverageCategoryId ??
            item?.beverage?.beverageCategoryId ??
            item?.beverageCategoryId ??
            0
        ),
        beverageCategoryName: String(
          item?.beverage?.beverageCategory?.name ??
            item?.beverage?.beverageCategoryName ??
            item?.beverageCategoryName ??
            ''
        ),
      }));
      setAvailableRecipes(mapped.filter((item) => Number.isFinite(item.recipeId) && item.recipeId > 0));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load recipes.';
      openWarningModal('Load recipes failed', message);
    } finally {
      setLoadingAvailableRecipes(false);
    }
  }, [coffeeShopId, openWarningModal]);

  const fetchShopSizes = useCallback(async () => {
    if (!coffeeShopId) return;

    try {
      const response = await authorizedFetch(API_ENDPOINTS.beverageSize.getByShop(coffeeShopId), {
        headers: {
          Accept: '*/*',
        },
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const payload = await response.json();
      const list = Array.isArray(payload) ? payload : [];
      const mapped: ShopSizeOption[] = list
        .map((item: any) => ({
          beverageSizeId: Number(item?.beverageSizeId ?? item?.id ?? 0),
          sizeName: String(item?.sizeName ?? item?.name ?? `Size ${item?.beverageSizeId ?? ''}`),
          volume: Number(item?.volume ?? item?.capacity ?? 0),
          isActive:
            typeof item?.isActive === 'boolean'
              ? item.isActive
              : String(item?.status ?? '').toLowerCase() !== 'inactive',
        }))
        .filter((item) => Number.isFinite(item.beverageSizeId) && item.beverageSizeId > 0);

      mapped.sort((left, right) => {
        const leftVolume = Number.isFinite(Number(left.volume)) ? Number(left.volume) : Number.MAX_SAFE_INTEGER;
        const rightVolume = Number.isFinite(Number(right.volume))
          ? Number(right.volume)
          : Number.MAX_SAFE_INTEGER;
        if (leftVolume !== rightVolume) return leftVolume - rightVolume;
        return left.sizeName.localeCompare(right.sizeName);
      });

      setShopSizes(mapped);
    } catch (error) {
      console.log('[Menu Insights] Failed to fetch shop sizes', error);
    }
  }, [coffeeShopId]);

  const openAddItemModal = useCallback(async () => {
    setRecipeSearchQuery('');
    setShowAddItemModal(true);
    if (availableRecipes.length === 0) {
      await fetchShopRecipes();
    }
    if (shopSizes.length === 0) {
      await fetchShopSizes();
    }
  }, [availableRecipes.length, fetchShopRecipes, fetchShopSizes, shopSizes.length]);

  const normalizeMenuItemName = (value: unknown) =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const existingMenuItemNameSet = useMemo(() => {
    const names = new Set<string>();

    menuItems.forEach((item) => {
      const recipeName = normalizeMenuItemName(item.shopRecipe?.recipeName);
      const beverageName = normalizeMenuItemName(item.shopBeverage?.name);
      if (recipeName) names.add(recipeName);
      if (beverageName) names.add(beverageName);
    });

    return names;
  }, [menuItems]);

  const availableRecipesForAdd = useMemo(() => {
    const existingRecipeIds = new Set(
      menuItems.map((item) => Number(item.shopRecipe?.recipeId ?? 0)).filter((value) => value > 0)
    );
    const filtered = availableRecipes.filter(
      (recipe) => !existingRecipeIds.has(Number(recipe.recipeId ?? 0))
    );
    const query = recipeSearchQuery.trim().toLowerCase();
    if (!query) return filtered;
    return filtered.filter((recipe) => {
      const recipeName = String(recipe.recipeName ?? '').toLowerCase();
      const beverageName = String(recipe.beverageName ?? '').toLowerCase();
      const categoryName = String(recipe.beverageCategoryName ?? '').toLowerCase();
      return (
        recipeName.includes(query) || beverageName.includes(query) || categoryName.includes(query)
      );
    });
  }, [availableRecipes, menuItems, recipeSearchQuery]);

  const handleAddMenuItem = useCallback(
    (recipe: RecipeOption) => {
      const candidateRecipeName = normalizeMenuItemName(recipe.recipeName);
      const candidateBeverageName = normalizeMenuItemName(recipe.beverageName);
      const isDuplicateByName =
        (candidateRecipeName && existingMenuItemNameSet.has(candidateRecipeName)) ||
        (candidateBeverageName && existingMenuItemNameSet.has(candidateBeverageName));

      if (isDuplicateByName) {
        setDuplicateItemMessage(`"${recipe.recipeName}" already exists in the menu item list.`);
        setShowDuplicateItemModal(true);
        return;
      }

      const nextTempId = -(Date.now() + Math.floor(Math.random() * 1000));
      const defaultPrice = Number(recipe.proposedSellingPrice ?? 0);
      const recipeCost = Number(recipe.totalCost ?? 0);
      const nowIso = new Date().toISOString();
      const costFloorPrice = Number.isFinite(recipeCost) && recipeCost > 0 ? Math.ceil(recipeCost) : 0;

      if (costFloorPrice > MAX_S_SIZE_PRICE) {
        openWarningModal(
          'Cannot add item',
          `Recipe cost is ${formatAmountNoUnit(costFloorPrice)} VND, which exceeds the max Size S price (${formatAmountNoUnit(
            MAX_S_SIZE_PRICE
          )} VND).`
        );
        return;
      }

      const candidateSPrice =
        Number.isFinite(defaultPrice) && defaultPrice > 0
          ? defaultPrice
          : costFloorPrice > 0
            ? costFloorPrice
            : 10000;

      const sizeOptions = [...shopSizes]
        .filter((size) => size.isActive)
        .sort((left, right) => Number(left.volume ?? 0) - Number(right.volume ?? 0));

      const explicitSSize = sizeOptions.find((size) => {
        const normalized = String(size.sizeName ?? '').trim().toLowerCase();
        return normalized === 's' || normalized === 'size s' || normalized === 'small';
      });
      const fallbackSSize = sizeOptions[0];
      const sSizeOption = explicitSSize ?? fallbackSSize;
      const sSizeId = Number(sSizeOption?.beverageSizeId ?? 0);
      const sVolume = Number(sSizeOption?.volume ?? 0);
      const hasValidSVolume = Number.isFinite(sVolume) && sVolume > 0;

      const basePrice =
        costFloorPrice > MAX_S_SIZE_PRICE
          ? MAX_S_SIZE_PRICE
          : Math.min(MAX_S_SIZE_PRICE, Math.max(costFloorPrice, candidateSPrice));

      const generatedSizeViewModels =
        sizeOptions.length > 0
          ? sizeOptions.map((size, index) => {
              const sizeVolume = Number(size.volume ?? 0);
              const hasValidSizeVolume = Number.isFinite(sizeVolume) && sizeVolume > 0;
              const isSSize = Number(size.beverageSizeId) === sSizeId;
              const ratio =
                hasValidSVolume && hasValidSizeVolume ? sizeVolume / sVolume : isSSize ? 1 : 1;
              const scaledCost =
                Number.isFinite(recipeCost) && recipeCost > 0
                  ? Math.ceil(recipeCost * ratio)
                  : costFloorPrice;

              return {
                itemSizeId: -(Math.abs(nextTempId) + index + 1),
                beverageSizeId: size.beverageSizeId,
                menuItemId: nextTempId,
                sellingPrice: isSSize ? basePrice : Math.max(basePrice, Math.round(basePrice * ratio)),
                scaledTotalCost: scaledCost,
                beverageSize: {
                  beverageSizeId: size.beverageSizeId,
                  sizeName: size.sizeName,
                  volume: Number(size.volume ?? 0),
                  isActive: size.isActive,
                },
              };
            })
          : [];

      const sSizePriceForCreate =
        generatedSizeViewModels.length > 0
          ? Number(
              generatedSizeViewModels.find((size) => Number(size.beverageSizeId) === sSizeId)?.sellingPrice ??
                generatedSizeViewModels[0]?.sellingPrice ??
                basePrice
            )
          : basePrice;

      if (costFloorPrice > 0 && sSizePriceForCreate < costFloorPrice) {
        openWarningModal(
          'Cannot add item',
          `Size S price must be at least recipe cost (${formatAmountNoUnit(costFloorPrice)} VND).`
        );
        return;
      }

      const invalidSizeCost = generatedSizeViewModels.find((size) => {
        const sizePrice = Number(size.sellingPrice ?? 0);
        const sizeCostFloor = Number(size.scaledTotalCost ?? 0);
        return Number.isFinite(sizeCostFloor) && sizeCostFloor > 0 && sizePrice < sizeCostFloor;
      });
      if (invalidSizeCost) {
        const violatedSizeName =
          String(invalidSizeCost.beverageSize?.sizeName ?? '').trim() || 'Selected size';
        const violatedFloor = Math.ceil(Number(invalidSizeCost.scaledTotalCost ?? 0));
        openWarningModal(
          'Cannot add item',
          `${violatedSizeName} price must be at least cost (${formatAmountNoUnit(violatedFloor)} VND).`
        );
        return;
      }

      const nextItem: MenuItem = {
        menuItemId: nextTempId,
        menuId: Number(menuId ?? 0) || undefined,
        description: '',
        sellingPrice: basePrice,
        addedDate: nowIso,
        itemSizeViewModels: generatedSizeViewModels,
        shopBeverage: {
          beverageId: Number(recipe.beverageId ?? 0),
          name: String(recipe.beverageName ?? recipe.recipeName ?? 'New beverage'),
          beverageCategoryId: Number(recipe.beverageCategoryId ?? 0),
          beverageCategoryName: String(recipe.beverageCategoryName ?? ''),
          beverageCategory: {
            beverageCategoryId: Number(recipe.beverageCategoryId ?? 0),
            name: String(recipe.beverageCategoryName ?? ''),
          },
        },
        shopRecipe: {
          recipeId: Number(recipe.recipeId ?? 0),
          recipeName: String(recipe.recipeName ?? 'New recipe'),
          image: recipe.image ? String(recipe.image) : null,
          totalCost: Number.isFinite(recipeCost) ? recipeCost : null,
        },
        isExisting: true,
      };

      setPendingNewItem(nextItem);
      setShowAddItemModal(false);
      openEditModalForItem(nextItem, { readOnly: false });
    },
    [existingMenuItemNameSet, menuId, openEditModalForItem, openWarningModal, shopSizes]
  );

  const handleDeleteMenuItem = useCallback((item: MenuItem) => {
    setDeletingItem(item);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDeleteMenuItem = useCallback(() => {
    if (!deletingItem) return;

    const targetItem = deletingItem;
    setShowDeleteConfirm(false);
    setDeletingItem(null);

    try {
      const existed = menuItems.some((item) => item.menuItemId === targetItem.menuItemId);
      if (!existed) {
        Toast.show({
          type: 'error',
          text1: 'Delete failed',
          text2: 'Menu item was not found in the current list.',
        });
        return;
      }

      setMenuItems((prev) => prev.filter((menuItem) => menuItem.menuItemId !== targetItem.menuItemId));
      setItemSalesMap((prev) => {
        const next = new Map(prev);
        next.delete(targetItem.menuItemId);
        return next;
      });
      setItemUnitCostMap((prev) => {
        const next = new Map(prev);
        next.delete(targetItem.menuItemId);
        return next;
      });
      setEditedMenuItemIds((prev) =>
        targetItem.menuItemId > 0
          ? Array.from(new Set([...prev, targetItem.menuItemId]))
          : prev.filter((id) => id !== targetItem.menuItemId)
      );
      setAddedMenuItemIds((prev) => prev.filter((id) => id !== targetItem.menuItemId));
      if (targetItem.menuItemId > 0) {
        setDeletedMenuItemIds((prev) => Array.from(new Set([...prev, targetItem.menuItemId])));
      }
      setHasManualChanges(true);

      Toast.show({
        type: 'success',
        text1: 'Deleted menu item',
        text2: `${targetItem.shopRecipe?.recipeName ?? 'Menu item'} was removed.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete menu item.';
      Toast.show({
        type: 'error',
        text1: 'Delete failed',
        text2: message,
      });
    }
  }, [deletingItem, menuItems]);

  const handleGenerateMenuItemImage = useCallback(
    async (item: MenuItem) => {
      const recipeId = Number(item?.shopRecipe?.recipeId ?? 0);
      const recipeName = String(item?.shopRecipe?.recipeName ?? '').trim();
      const imagePrompt = buildRecipeImagePrompt(recipeName);

      if (!Number.isFinite(recipeId) || recipeId <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Missing recipe ID',
          text2: 'Cannot generate image for this menu item.',
        });
        return;
      }

      if (!recipeName) {
        Toast.show({
          type: 'error',
          text1: 'Missing recipe name',
          text2: 'Cannot generate image for this menu item.',
        });
        return;
      }

      setGeneratingImageItemIds((prev) => (prev.includes(item.menuItemId) ? prev : [...prev, item.menuItemId]));

      try {
        const requestBody: GenerateRecipeImageRequest[] = [
          {
            recipeId,
            recipeName,
            imagePrompt,
          },
        ];

        const callGenerate = async (body: GenerateRecipeImageRequest[], reason: 'primary' | 'fallback') => {
          console.log('[AI generate-recipe-images] REQUEST', {
            reason,
            url: API_ENDPOINTS.ai.generateRecipeImages(),
            method: 'POST',
            body,
          });

          const response = await authorizedFetch(API_ENDPOINTS.ai.generateRecipeImages(), {
            method: 'POST',
            headers: {
              Accept: '*/*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });

          const responseText = await response.text();
          console.log('[AI generate-recipe-images] RESPONSE', {
            reason,
            status: response.status,
            ok: response.ok,
            raw: responseText,
          });

          if (!response.ok) {
            throw new Error(responseText || `Request failed (${response.status})`);
          }

          let payload: any = null;
          if (responseText) {
            try {
              payload = JSON.parse(responseText);
            } catch {
              payload = responseText;
            }
          }

          console.log('[AI generate-recipe-images] PARSED PAYLOAD', { reason, payload });
          return payload;
        };

        let payload = await callGenerate(requestBody, 'primary');
        let resolvedRawImageUrl = resolveRecipeImageUrlFromPayload(payload, recipeId);

        if (!resolvedRawImageUrl) {
          const backendError = resolveRecipeImageErrorFromPayload(payload, recipeId);

          // Retry once with a shorter, safer prompt if the model rejected the first prompt.
          if (backendError) {
            const fallbackPrompt = buildRecipeImagePrompt(recipeName);
            const fallbackBody: GenerateRecipeImageRequest[] = [
              {
                recipeId,
                recipeName,
                imagePrompt: fallbackPrompt,
              },
            ];

            payload = await callGenerate(fallbackBody, 'fallback');
            resolvedRawImageUrl = resolveRecipeImageUrlFromPayload(payload, recipeId);

            if (!resolvedRawImageUrl) {
              const fallbackError = resolveRecipeImageErrorFromPayload(payload, recipeId);
              throw new Error(fallbackError || backendError);
            }
          }
        }

        const resolvedImageUrl = encodeFirebaseImageUrl(resolvedRawImageUrl ?? undefined) ?? resolvedRawImageUrl;

        if (!resolvedImageUrl) {
          throw new Error('No image URL returned by AI service.');
        }

        setMenuItems((prev) =>
          prev.map((menuItem) =>
            menuItem.menuItemId === item.menuItemId
              ? {
                  ...menuItem,
                  shopRecipe: {
                    ...menuItem.shopRecipe,
                    image: resolvedImageUrl,
                  },
                }
              : menuItem
          )
        );

        Toast.show({
          type: 'success',
          text1: 'Image generated',
          text2: `${recipeName} image has been updated.`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to generate image.';
        Toast.show({
          type: 'error',
          text1: 'Generate image failed',
          text2: message,
        });
      } finally {
        setGeneratingImageItemIds((prev) => prev.filter((id) => id !== item.menuItemId));
      }
    },
    []
  );

  const buildCreateMenuVersionPayload = (menuIdValue: number, menuRaw: any, items: MenuItem[]) => {
    const basePayload = buildUpdatePayload(menuIdValue, menuRaw, items, menuImageUris);
    const sourceMenuId = menuIdValue;
    const createdValue =
      menuRaw?.created ??
      menuRaw?.Created ??
      menuRaw?.createdAt ??
      menuRaw?.createDate ??
      menuRaw?.CreateDate ??
      new Date().toISOString();

    const menuItemsForRender = items.map((item) => ({
      menuItemId: Number(item.menuItemId ?? 0) > 0 ? Number(item.menuItemId) : 0,
      menuId: sourceMenuId,
      description: item.description ?? '',
      sellingPrice: Number(item.sellingPrice ?? 0),
      addedDate: item.addedDate ?? new Date().toISOString(),
      itemSizeViewModels: (item.itemSizeViewModels ?? []).map((size, index) => ({
        itemSizeId: Number(size.itemSizeId > 0 ? size.itemSizeId : index),
        beverageSizeId: Number(size.beverageSizeId ?? size.beverageSize?.beverageSizeId ?? 0),
        menuItemId: Number(item.menuItemId ?? 0) > 0 ? Number(item.menuItemId) : 0,
        sellingPrice: Number(size.sellingPrice ?? 0),
        scaledTotalCost: Number(size.scaledTotalCost ?? 0),
        scaledIngredients: Array.isArray(size.scaledIngredients)
          ? size.scaledIngredients.map((ingredient) => ({
              ...ingredient,
              quantity: Number(ingredient?.quantity ?? 0),
              cost: Number(ingredient?.cost ?? 0),
            }))
          : [],
        beverageSize: size.beverageSize
          ? {
              beverageSizeId: Number(size.beverageSize.beverageSizeId ?? size.beverageSizeId ?? 0),
              coffeeShopId: Number((size.beverageSize as any)?.coffeeShopId ?? 0),
              sizeName: size.beverageSize.sizeName ?? '',
              volume: Number(size.beverageSize.volume ?? 0),
              isActive: Boolean(size.beverageSize.isActive ?? true),
            }
          : undefined,
      })),
      shopBeverage: {
        beverageId: Number(item.shopBeverage?.beverageId ?? 0),
        name: item.shopBeverage?.name ?? '',
        status: item.shopBeverage?.status ?? '',
        createDate: new Date().toISOString(),
        beverageCategoryId: Number(
          item.shopBeverage?.beverageCategoryId ??
            item.shopBeverage?.beverageCategory?.beverageCategoryId ??
            0
        ),
        coffeeShopId: Number((item.shopBeverage as any)?.coffeeShopId ?? 0),
        imageUrl: item.shopBeverage?.imageUrl ?? null,
        image: item.shopBeverage?.image ?? null,
        beverageCategory: {
          beverageCategoryId: Number(
            item.shopBeverage?.beverageCategory?.beverageCategoryId ??
              item.shopBeverage?.beverageCategoryId ??
              0
          ),
          coffeeShopId: Number(
            (item.shopBeverage?.beverageCategory as any)?.coffeeShopId ??
              (item.shopBeverage as any)?.coffeeShopId ??
              0
          ),
          name:
            item.shopBeverage?.beverageCategory?.name ??
            item.shopBeverage?.beverageCategoryName ??
            'Unknown',
          image: (item.shopBeverage?.beverageCategory as any)?.image ?? null,
          menuGroupId: Number((item.shopBeverage?.beverageCategory as any)?.menuGroupId ?? 0),
          createDate:
            (item.shopBeverage?.beverageCategory as any)?.createDate ?? new Date().toISOString(),
        },
      },
      isExisting: item.isExisting ?? true,
      shopRecipe: item.shopRecipe
        ? {
            recipeId: Number(item.shopRecipe.recipeId ?? 0),
            recipeName: item.shopRecipe.recipeName ?? '',
            image: item.shopRecipe.image ?? null,
          }
        : undefined,
    }));

    const averagePrice =
      menuItemsForRender.length > 0
        ? menuItemsForRender.reduce((sum, item) => sum + Number(item.sellingPrice ?? 0), 0) /
          menuItemsForRender.length
        : Number(menuRaw?.averagePrice ?? 0);
    const modifiedMenuItemIds = Array.from(
      new Set([...lastSavedEditedMenuItemIds, ...editedMenuItemIds, ...deletedMenuItemIds])
    ).filter((id) => id > 0);

    return {
      menu: {
        ...basePayload.menu,
        menuId: sourceMenuId,
        created: createdValue,
        menuItems: menuItemsForRender,
        visualTheme: menuRaw?.visualTheme ?? menuRaw?.VisualTheme ?? undefined,
        menuGroups: Array.isArray(menuRaw?.menuGroups) ? menuRaw.menuGroups : basePayload.menu.menuGroups,
        averagePrice,
        note: String(menuRaw?.note ?? ''),
        modifiedMenuItemIds,
      },
      config: basePayload.config,
    };
  };

  const handleCreateNewMenuVersion = async () => {
    if (!hasEditedMenuItemsForVersion) {
      openWarningModal(
        'No menu changes',
        'Please add, delete, or edit at least one menu item before creating a new version.'
      );
      return;
    }

    if (!menuId) {
      openWarningModal('Missing menu', 'Menu ID is missing.');
      return;
    }

    const id = Number(menuId);
    if (!Number.isFinite(id)) {
      openWarningModal('Invalid menu', 'Menu ID is invalid.');
      return;
    }

    if (!currentMenuRaw) {
      openWarningModal('Missing menu', 'Menu data is not loaded yet.');
      return;
    }

    try {
      setCreatingMenuVersion(true);
      setCreateVersionProgressText('Preparing version payload...');
      const payload = buildCreateMenuVersionPayload(id, currentMenuRaw, menuItems);
      setCreateVersionProgressText('Step 1/2: Creating new menu version...');
      const createVersionResponse = await authorizedFetch(API_ENDPOINTS.menu.saveAi(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload.menu),
      });

      const createVersionResponseText = await createVersionResponse.text();
      let createVersionPayload: any = null;
      if (createVersionResponseText) {
        try {
          createVersionPayload = JSON.parse(createVersionResponseText);
        } catch {
          createVersionPayload = createVersionResponseText;
        }
      }

      if (!createVersionResponse.ok) {
        const backendError =
          createVersionPayload?.error ?? createVersionPayload?.message ?? createVersionResponseText;
        console.log('[Create menu version] save-ai error response:', {
          status: createVersionResponse.status,
          text: createVersionResponseText,
        });
        throw new Error(backendError || `Request failed (${createVersionResponse.status})`);
      }

      const newMenuId = Number(createVersionPayload?.MenuId ?? createVersionPayload?.menuId ?? 0);
      if (!Number.isFinite(newMenuId) || newMenuId <= 0) {
        throw new Error('New menu version was created but no MenuId was returned.');
      }

      // Fetch the newly-created menu to preserve server-assigned VersionNumber (e.g. 2.0, 3.0).
      let resolvedNewVersionNumber = '';
      try {
        const newMenuResponse = await authorizedFetch(API_ENDPOINTS.menu.getById(newMenuId), {
          headers: { Accept: '*/*' },
        });
        if (newMenuResponse.ok) {
          const newMenuPayload = await newMenuResponse.json();
          resolvedNewVersionNumber = String(
            newMenuPayload?.versionNumber ?? newMenuPayload?.VersionNumber ?? ''
          );
        }
      } catch {
        resolvedNewVersionNumber = '';
      }

      setCreateVersionProgressText('Step 2/2: Rendering image for new version...');
      const renderPayload = {
        ...payload,
        menu: {
          ...payload.menu,
          menuId: newMenuId,
          versionNumber:
            resolvedNewVersionNumber.trim().length > 0
              ? resolvedNewVersionNumber
              : payload.menu?.versionNumber,
          menuItems: Array.isArray(payload.menu?.menuItems)
            ? payload.menu.menuItems.map((item: any) => ({
                ...item,
                menuId: newMenuId,
                itemSizeViewModels: Array.isArray(item?.itemSizeViewModels)
                  ? item.itemSizeViewModels.map((size: any) => ({
                      ...size,
                      menuItemId: Number(item?.menuItemId ?? 0),
                    }))
                  : [],
              }))
            : [],
        },
      };

      const renderResponse = await authorizedFetch(API_ENDPOINTS.ai.createMenuRender(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(renderPayload),
      });

      const renderResponseText = await renderResponse.text();
      let renderResponsePayload: any = null;
      if (renderResponseText) {
        try {
          renderResponsePayload = JSON.parse(renderResponseText);
        } catch {
          renderResponsePayload = renderResponseText;
        }
      }

      if (!renderResponse.ok) {
        const backendError =
          renderResponsePayload?.error ?? renderResponsePayload?.message ?? renderResponseText;
        console.log('[Create menu version] create-menu-p3-render error response:', {
          status: renderResponse.status,
          text: renderResponseText,
        });
        throw new Error(
          backendError ||
            `Version ${newMenuId} was created but rendering failed (${renderResponse.status}).`
        );
      }

      const responseImages = Array.isArray(renderResponsePayload?.ImageUrls)
        ? renderResponsePayload.ImageUrls
        : Array.isArray(renderResponsePayload?.imageUrls)
          ? renderResponsePayload.imageUrls
          : [];
      const responsePrimary =
        renderResponsePayload?.ImageUrl ?? renderResponsePayload?.imageUrl ?? null;
      const normalizedImages = [responsePrimary, ...responseImages]
        .map((raw: string | null) => resolveImageUrl(raw))
        .filter((value): value is string => Boolean(value));
      if (normalizedImages.length > 0) {
        setMenuImageUris(Array.from(new Set(normalizedImages)));
      }

      setCreateVersionProgressText('Done. Redirecting to menu versions...');
      Toast.show({
        type: 'success',
        text1: 'Created new menu version',
        text2: `Version created (ID: ${newMenuId}).`,
      });

      const menuHeaderId = Number(currentMenuRaw?.menuHeaderId ?? currentMenuRaw?.MenuHeaderId ?? 0);
      if (Number.isFinite(menuHeaderId) && menuHeaderId > 0) {
        router.replace({
          pathname: '/menu-version/[id]',
          params: {
            id: String(menuHeaderId),
            ...(normalizedMenuName ? { name: normalizedMenuName } : {}),
          },
        });
        return;
      }
      router.replace('/(tabs)/menu');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create menu version.';
      openWarningModal('Create failed', message);
    } finally {
      setCreatingMenuVersion(false);
      setCreateVersionProgressText('');
    }
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const next = savedScale.value * event.scale;
      scale.value = Math.max(1, Math.min(MAX_ZOOM_SCALE, next));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value <= 1) {
        translateX.value = 0;
        translateY.value = 0;
        return;
      }
      const limit = (scale.value - 1) * 260;
      const nextX = savedTranslateX.value + event.translationX;
      const nextY = savedTranslateY.value + event.translationY;
      translateX.value = Math.max(-limit, Math.min(limit, nextX));
      translateY.value = Math.max(-limit, Math.min(limit, nextY));
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = 1;
        savedScale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = 2;
        savedScale.value = 2;
      }
    });

  const pinchPanGesture = Gesture.Simultaneous(pinchGesture, panGesture);
  const imageGesture = Gesture.Exclusive(doubleTapGesture, pinchPanGesture);

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  useEffect(() => {
    fetchMenuPerformance();
    fetchMenuItems();
  }, [menuId]);

  useEffect(() => {
    // Fetch sales data when selected date changes
    if (menuItems.length > 0) {
      fetchItemsSalesData();
    }
  }, [selectedDateIndex, menuItems.length]);

  useEffect(() => {
    if (menuItems.length > 0) {
      console.log('[Menu Insights] menuItems:', menuItems);
    }
  }, [menuItems]);

  useEffect(() => {
    setVisibleCount(MENU_PAGE_SIZE);
  }, [searchQuery, selectedCategoryIds, menuItems.length]);

  const fetchMenuPerformance = async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const id = menuId ? Number(menuId) : 1;
      const result = await menuPerformanceService.getSummary(id);
      setData(result);
      // Set to latest date by default
      if (result.chartData && result.chartData.length > 0) {
        setSelectedDateIndex(result.chartData.length - 1);
      }
    } catch (err) {
      console.error('Error fetching menu performance:', err);
      setError('Failed to load menu performance data');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchMenuItems = async (): Promise<MenuItem[]> => {
    try {
      setLoadingItems(true);
      const id = menuId ? Number(menuId) : 1;
      
      // Fetch full menu data with populated nested objects (like daily-sales.tsx)
      const menuResponse = await authorizedFetch(
        API_ENDPOINTS.menu.getById(id),
        {
          headers: {
            Accept: '*/*',
          },
        }
      );

      if (!menuResponse.ok) {
        throw new Error(`HTTP error! status: ${menuResponse.status}`);
      }

      const menuData: MenuData = await menuResponse.json();
      console.log('[Menu Insights] Full menu data:', menuData);
      setCurrentMenuRaw(menuData);

      const normalizedImagesFromArray = (Array.isArray(menuData.images) ? menuData.images : [])
        .map((raw) => resolveImageUrl(raw))
        .filter((url): url is string => Boolean(url && url.trim().length > 0));

      const normalizedMenuImages =
        normalizedImagesFromArray.length > 0
          ? normalizedImagesFromArray
          : [menuData.image, menuImage && menuImage.length > 0 ? menuImage : null]
              .map((raw) => resolveImageUrl(raw))
              .filter((url): url is string => Boolean(url && url.trim().length > 0));

      if (normalizedMenuImages.length > 0) {
        setMenuImageUris(Array.from(new Set(normalizedMenuImages)));
      } else {
        setMenuImageUris([]);
      }

      // Flatten all menu items from all groups (like daily-sales.tsx)
      const items: MenuItem[] = [];
      if (menuData.menuGroups && Array.isArray(menuData.menuGroups)) {
        menuData.menuGroups.forEach((group: MenuGroup) => {
          if (group.menuItems && Array.isArray(group.menuItems)) {
            items.push(...group.menuItems);
          }
        });
      }
      
      console.log('[Menu Insights] Flattened menu items:', items);
      console.log('beverageCategory:', items.map(item => item.shopBeverage.beverageCategoryName));
      setMenuItems(items);
      originalMenuItemsRef.current = new Map(
        items.map((item) => [item.menuItemId, buildMenuItemSnapshot(item)])
      );
      setEditedMenuItemIds([]);
      setAddedMenuItemIds([]);
      setDeletedMenuItemIds([]);
      setHasManualChanges(false);

      // Fetch detailed menu items for unit cost calculation.
      const byMenuResponse = await authorizedFetch(API_ENDPOINTS.menuItem.getByMenu(id), {
        headers: {
          Accept: '*/*',
        },
      });

      if (!byMenuResponse.ok) {
        throw new Error(`HTTP error! status: ${byMenuResponse.status}`);
      }

      const byMenuPayload = await byMenuResponse.json();
      const byMenuItems: MenuItemCostPayload[] = Array.isArray(byMenuPayload)
        ? byMenuPayload
        : Array.isArray(byMenuPayload?.items)
          ? byMenuPayload.items
          : Array.isArray(byMenuPayload?.data)
            ? byMenuPayload.data
            : [];

      const totalCostByMenuItemId = new Map<number, number>();
      const unitCostMap = new Map<number, number>();
      byMenuItems.forEach((menuItem) => {
        const recipeCost = Number(
          (menuItem as any)?.shopRecipe?.totalCost ?? (menuItem as any)?.shopRecipe?.TotalCost ?? 0
        );
        const itemTotalCost = Number((menuItem as any)?.totalCost ?? (menuItem as any)?.TotalCost ?? 0);
        const mappedTotalCost = recipeCost > 0 ? recipeCost : itemTotalCost;
        if (mappedTotalCost > 0) {
          totalCostByMenuItemId.set(menuItem.menuItemId, mappedTotalCost);
        }

        const ingredientCost = Array.isArray(menuItem?.shopRecipe?.ingredients)
          ? menuItem.shopRecipe!.ingredients!.reduce((sum, ingredient) => {
              const value = Number(ingredient?.cost ?? 0);
              return Number.isFinite(value) ? sum + value : sum;
            }, 0)
          : 0;

        const unitCost = mappedTotalCost > 0 ? mappedTotalCost : ingredientCost;
        unitCostMap.set(menuItem.menuItemId, unitCost > 0 ? unitCost : 0);
      });

      if (totalCostByMenuItemId.size > 0) {
        setMenuItems((prev) =>
          prev.map((item) => {
            const totalCost = totalCostByMenuItemId.get(item.menuItemId);
            if (totalCost == null) return item;

            return {
              ...item,
              shopRecipe: {
                ...item.shopRecipe,
                totalCost,
              },
            };
          })
        );
      }

      setItemUnitCostMap(unitCostMap);
      return items;
    } catch (err) {
      console.error('Error fetching menu items:', err);
      return [];
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchItemsSalesData = async (itemsOverride?: MenuItem[]) => {
    try {
      const itemsToFetch = itemsOverride ?? menuItems;
      if (itemsToFetch.length === 0) {
        setItemSalesMap(new Map());
        setItemSalesBySizeMap(new Map());
        return;
      }

      const selectedData = getSelectedDateData();
      if (!selectedData) return;

      const salesMap = new Map<number, number>();
      const salesBySize = new Map<string, number>();
      
      // Fetch sales data for each menu item for the selected date
      const salesPromises = itemsToFetch.map(async (item) => {
        try {
          const response = await authorizedFetch(
            API_ENDPOINTS.dailySale.getByMenuItem(item.menuItemId),
            {
              headers: {
                Accept: '*/*',
              },
            }
          );

          if (response.ok) {
            const salesRecords: DailySaleRecord[] = await response.json();

            // Filter records for the selected date and sum totalCups
            const selectedDateStr = selectedData.date.split('T')[0];
            const sameDateRecords = salesRecords.filter((record) =>
              record.saleDate.startsWith(selectedDateStr)
            );

            const totalCups = sameDateRecords.reduce((sum, record) => sum + record.totalCups, 0);

            sameDateRecords.forEach((record) => {
              const sizeToken = normalizeSizeToken(String(record.cupSize ?? ''));
              if (!sizeToken) return;

              const key = `${item.menuItemId}:${sizeToken}`;
              const current = salesBySize.get(key) ?? 0;
              salesBySize.set(key, current + Number(record.totalCups ?? 0));
            });

            if (totalCups > 0) {
              salesMap.set(item.menuItemId, totalCups);
            }
          }
        } catch (err) {
          console.error(`Error fetching sales for item ${item.menuItemId}:`, err);
        }
      });

      await Promise.all(salesPromises);
      setItemSalesMap(salesMap);
      setItemSalesBySizeMap(salesBySize);
    } catch (err) {
      console.error('Error fetching items sales data:', err);
    }
  };

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const [, refreshedItems] = await Promise.all([
        fetchMenuPerformance({ showLoading: false }),
        fetchMenuItems(),
      ]);
      await fetchItemsSalesData(refreshedItems);
    } catch (err) {
      console.error('Error refreshing menu insights:', err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchItemsSalesData, fetchMenuItems, fetchMenuPerformance]);

  const handleGenerateMenuVersion = async () => {
    if (!menuId) {
      openWarningModal('Missing menu', 'Menu ID is missing.');
      return;
    }

    const id = Number(menuId);
    if (!Number.isFinite(id)) {
      openWarningModal('Invalid menu', 'Menu ID is invalid.');
      return;
    }

    try {
      setGeneratingMenu(true);

      let unappliedFeedbackItems: any[] = [];
      try {
        const feedbackResponse = await authorizedFetch(API_ENDPOINTS.feedback.listByMenu(id, 1, 300), {
          headers: {
            Accept: '*/*',
          },
        });
        if (feedbackResponse.ok) {
          const feedbackPayload = await feedbackResponse.json();
          const feedbackItems = Array.isArray(feedbackPayload?.items)
            ? feedbackPayload.items
            : Array.isArray(feedbackPayload)
              ? feedbackPayload
              : [];
          unappliedFeedbackItems = feedbackItems.filter((item: any) => item?.isApplied !== true);
        }
      } catch {
        unappliedFeedbackItems = [];
      }

      const getModifiedCount = (payload: any): number => {
        if (!payload || typeof payload !== 'object') return 0;
        const toModified = (menuLike: any): number => {
          if (!menuLike) return 0;
          const raw =
            menuLike?.modifiedMenuItemIds ??
            menuLike?.ModifiedMenuItemIds ??
            menuLike?.modifiedMenuItemIDs ??
            [];
          if (Array.isArray(raw)) return raw.length;
          if (typeof raw === 'string') {
            const trimmed = raw.trim();
            if (!trimmed) return 0;
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) return parsed.length;
            } catch {
              return trimmed.split(',').map((x) => x.trim()).filter(Boolean).length;
            }
          }
          return 0;
        };

        const objectPayload = payload as any;
        if (Array.isArray(objectPayload?.menus) && objectPayload.menus.length > 0) {
          return objectPayload.menus.reduce((sum: number, menu: any) => sum + toModified(menu), 0);
        }
        if (objectPayload?.menu) return toModified(objectPayload.menu);
        return toModified(objectPayload);
      };

      const inferCurrentLayout = (): number | null => {
        const rawLayout =
          currentMenuRaw?.layout ??
          currentMenuRaw?.config?.layout ??
          currentMenuRaw?.menuConfig?.layout ??
          currentMenuRaw?.requestConfig?.layout ??
          currentMenuRaw?.request?.config?.layout ??
          null;
        if (typeof rawLayout === 'number' && Number.isFinite(rawLayout)) return rawLayout;
        if (typeof rawLayout === 'string' && rawLayout.trim() !== '') {
          const parsed = Number(rawLayout);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      };

      const applyLayoutToPayload = (payload: any, layoutValue: number | null) => {
        if (!payload || typeof payload !== 'object' || layoutValue == null) return payload;
        const payloadObject = payload as any;

        if (payloadObject.config && typeof payloadObject.config === 'object') {
          payloadObject.config.layout = layoutValue;
        }
        if (Array.isArray(payloadObject.menus)) {
          payloadObject.menus = payloadObject.menus.map((menu: any) => ({
            ...menu,
            layout: layoutValue,
            config: {
              ...(menu?.config ?? payloadObject?.config ?? {}),
              layout: layoutValue,
            },
          }));
        }
        if (payloadObject.menu && typeof payloadObject.menu === 'object') {
          payloadObject.menu = {
            ...payloadObject.menu,
            layout: layoutValue,
            config: {
              ...(payloadObject.menu?.config ?? payloadObject?.config ?? {}),
              layout: layoutValue,
            },
          };
        }

        return payloadObject;
      };

      const callAnalyze = async () => {
        const response = await authorizedFetch(API_ENDPOINTS.ai.analyzeMenuFeedback(id), {
          method: 'GET',
          headers: {
            Accept: '*/*',
          },
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Request failed (${response.status})`);
        }

        const responseText = await response.text();
        if (!responseText) return null;
        try {
          return JSON.parse(responseText);
        } catch {
          return responseText;
        }
      };

      const responsePayload = await callAnalyze();

      console.log('[AI analyze-menu-feedback] raw payload:', responsePayload);
      if (responsePayload && typeof responsePayload === 'object') {
        const payloadObj = responsePayload as Record<string, any>;
        console.log('[AI analyze-menu-feedback] imageUrl candidates:', {
          imageUrl: payloadObj?.imageUrl,
          ImageUrl: payloadObj?.ImageUrl,
          menuImageUrl: payloadObj?.menu?.imageUrl,
          menuImageUrlUpper: payloadObj?.menu?.ImageUrl,
        });
      }

      const normalizedPayload = (() => {
        if (!responsePayload || typeof responsePayload !== 'object') return responsePayload;
        const resolvedUrl = encodeFirebaseImageUrl(resolveGeneratedImageUrl(responsePayload));
        if (!resolvedUrl) return responsePayload;

        const payloadObject = responsePayload as any;
        const menus = Array.isArray(payloadObject.menus)
          ? payloadObject.menus
          : Array.isArray(payloadObject.data)
            ? payloadObject.data
            : Array.isArray(payloadObject.items)
              ? payloadObject.items
              : null;

        if (menus) {
          menus.forEach((menu: any) => {
            if (menu && !menu.imageUrl && !menu.ImageUrl) {
              menu.imageUrl = resolvedUrl;
            }
          });
        }

        if (!payloadObject.imageUrl && !payloadObject.ImageUrl) {
          payloadObject.imageUrl = resolvedUrl;
        }

        // Preserve the current menu layout for new version generation.
        const currentLayout = inferCurrentLayout();
        applyLayoutToPayload(payloadObject, currentLayout);

        return payloadObject;
      })();

      const modifiedCount = getModifiedCount(normalizedPayload);
      if (unappliedFeedbackItems.length > 0 && modifiedCount === 0) {
        openWarningModal(
          'No menu items updated',
          `Detected ${unappliedFeedbackItems.length} unapplied feedback item(s), but AI returned no modified items. Please review feedback mapping for this menu version.`
        );
      }

      let cacheKey = '';
      if (normalizedPayload) {
        cacheKey = `menuFeedback:${Date.now()}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(normalizedPayload));
      }

      router.push({
        pathname: '/menu-results',
        params: {
          data: normalizedPayload ? JSON.stringify(normalizedPayload) : '',
          cacheKey,
          flow: 'menu-version-feedback',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate menu.';
      openWarningModal('Generate failed', message);
    } finally {
      setGeneratingMenu(false);
    }
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const formatAmountNoUnit = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getSelectedDateData = (): ChartDataItem | null => {
    if (!data || !data.chartData || data.chartData.length === 0) return null;
    return data.chartData[selectedDateIndex] || null;
  };

  const computedCostFromSales = useMemo(() => {
    if (itemSalesMap.size === 0 || itemUnitCostMap.size === 0) return 0;
    return Array.from(itemSalesMap.entries()).reduce((sum, [menuItemId, cupsSold]) => {
      const unitCost = itemUnitCostMap.get(menuItemId) ?? 0;
      return sum + unitCost * cupsSold;
    }, 0);
  }, [itemSalesMap, itemUnitCostMap]);

  const getSelectedCost = () => {
    const summaryCost = getSelectedDateData()?.cost || 0;
    return computedCostFromSales > 0 ? computedCostFromSales : summaryCost;
  };

  const getItemTotalCost = (menuItemId: number) => {
    const soldCups = itemSalesMap.get(menuItemId) ?? 0;
    const unitCost = itemUnitCostMap.get(menuItemId) ?? 0;
    return soldCups * unitCost;
  };

  const getMenuScore = () => {
    const selectedData = getSelectedDateData();
    if (!selectedData) return 'N/A';
    
    const profit = selectedData.totalRevenue - getSelectedCost();
    const profitMargin = selectedData.totalRevenue > 0 
      ? (profit / selectedData.totalRevenue) * 100 
      : 0;
    
    if (profitMargin >= 70) return 'Excellent';
    if (profitMargin >= 50) return 'Good';
    if (profitMargin >= 30) return 'Fair';
    return 'Poor';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const getFilteredMenuItems = () => {
    let filtered = menuItems;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.shopRecipe?.recipeName?.toLowerCase().includes(query) ||
        item.shopBeverage?.name?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.shopBeverage?.beverageCategory?.name?.toLowerCase().includes(query)
      );
    }

    // Filter by selected categories
    if (selectedCategoryIds.length > 0) {
      filtered = filtered.filter(item => 
        selectedCategoryIds.includes(item.shopBeverage?.beverageCategoryId ?? -1)
      );
    }

    return filtered;
  };

  const toggleCategory = (categoryId: number) => {
    setSelectedCategoryIds(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const clearFilters = () => {
    setSelectedCategoryIds([]);
  };

  const getCategoryName = (cat: any) => {
    return cat.name || cat.categoryName || 'Unnamed';
  };

  const getCategoryId = (cat: any) => {
    return cat.beverageCategoryId ?? cat.id ?? -1;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#4a3621" />
          <Text style={{ marginTop: 12, color: '#847362' }}>Loading menu insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <Ionicons name="alert-circle-outline" size={48} color="#e71008" />
          <Text style={{ marginTop: 12, color: '#4a3621', fontSize: 16, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity
            onPress={() => fetchMenuPerformance()}
            style={[styles.aiButton, { marginTop: 16, paddingHorizontal: 24 }]}
          >
            <Text style={styles.aiButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#4a3621"
            colors={['#4a3621']}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="chevron-back" size={26} color="#4a3621" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Menu Insights</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerIconButton, styles.headerIconButtonAccent]}
              activeOpacity={0.85}
              onPress={openFeedbackInsights}
            >
              <Ionicons name="bar-chart-outline" size={18} color="#2D6A4F" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconButton}
              activeOpacity={0.85}
              onPress={() => setShowFilterModal(true)}
            >
              <Ionicons name="options-outline" size={18} color="#4a3621" />
              {selectedCategoryIds.length > 0 && (
                <View style={styles.headerActionBadge}>
                  <Text style={styles.headerActionBadgeText}>{selectedCategoryIds.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.menuImageSection}>
          <TouchableOpacity
            activeOpacity={0.92}
            style={styles.menuImageCard}
            onPress={() => {
              resetZoom();
              setCurrentViewerImageIndex(0);
              setShowImageViewer(true);
            }}
          >
            <Image
              source={{ uri: menuImageUri || fallbackMenuImage }}
              style={styles.menuImagePreview}
              resizeMode="cover"
            />
            <View style={styles.menuImageHintChip}>
              <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
              <Text style={styles.menuImageHintText}>
                {menuImageUris.length > 1 ? `Swipe ${menuImageUris.length} images` : 'Zoom menu image'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Menu Score Banner */}
        <View style={styles.bannerContainer}>
          <View style={styles.banner}>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerSubtitle}>Daily Performance</Text>
              <Text style={styles.bannerTitle}>
                Menu Score: {getMenuScore()}
              </Text>
            </View>
            <View style={styles.bannerIcon}>
              <Ionicons name="trending-up" size={32} color="#FFF" />
            </View>
          </View>
        </View>

        {/* Date Picker */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.datePicker}
            onPress={() => setShowDatePicker(true)}
          >
            <View style={styles.datePickerContent}>
              <Ionicons name="calendar-outline" size={20} color="#847362" />
              <Text style={styles.datePickerText}>
                {getSelectedDateData() 
                  ? formatDate(getSelectedDateData()!.date)
                  : 'Select date'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#847362" />
          </TouchableOpacity>

          {/* KPI Row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.kpiScrollView}
            contentContainerStyle={styles.kpiContainer}
          >
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>REVENUE</Text>
              <Text style={styles.kpiValue}>
                {formatCurrency(getSelectedDateData()?.totalRevenue || 0)}
              </Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>PROFIT</Text>
              <Text style={styles.kpiValue}>
                {formatCurrency((getSelectedDateData()?.totalRevenue || 0) - getSelectedCost())}
              </Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>COST</Text>
              <Text style={styles.kpiValue}>
                {formatCurrency(getSelectedCost())}
              </Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>CUPS SOLD</Text>
              <Text style={styles.kpiValue}>
                {getSelectedDateData()?.totalCups || 0}
              </Text>
            </View>
          </ScrollView>
        </View>

        {/* AI Suggestions */}
        <View style={styles.itemsList}>
          <View style={styles.aiSection}>
            <View style={styles.aiHeader}>
              <View style={styles.aiIconContainer}>
                <Ionicons name="bulb" size={24} color="#FFF" />
              </View>
              <View style={styles.aiTextContainer}>
                <Text style={styles.aiTitle}>AI Suggestions</Text>
                <Text style={styles.aiDescription}>
                  Analyze your menu performance and get AI-powered recommendations to improve profit.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.aiButton, generatingMenu && styles.aiButtonDisabled]}
              onPress={handleGenerateMenuVersion}
              disabled={generatingMenu}
            >
              {generatingMenu ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Text style={styles.aiButtonText}>Generate New Menu Version</Text>
                  <Ionicons name="rocket" size={16} color="#FFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#847362" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search menu items..."
              placeholderTextColor="#847362"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#847362" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {shouldShowManualEditCard && (
          <View style={styles.manualEditCard}>
            <View style={styles.manualEditText}>
              <Text style={styles.manualEditTitle}>Manual edit</Text>
              <Text style={styles.manualEditSubtitle}>
                Keep current menu updated, or save as a new version.
              </Text>
              {hasActualUnsavedChanges && (
                <Text style={styles.manualEditHint}>Unsaved changes</Text>
              )}
              {savingManualEdits && saveProgressText.length > 0 && (
                <Text style={styles.manualEditProgress}>{saveProgressText}</Text>
              )}
              {creatingMenuVersion && createVersionProgressText.length > 0 && (
                <Text style={styles.manualEditProgress}>{createVersionProgressText}</Text>
              )}
            </View>
            <View style={styles.manualActionColumn}>
              <TouchableOpacity
                style={[
                  styles.manualSaveButton,
                  (!hasActualUnsavedChanges || savingManualEdits || creatingMenuVersion) &&
                    styles.manualSaveButtonDisabled,
                ]}
                onPress={handleSaveManualEdits}
                disabled={!hasActualUnsavedChanges || savingManualEdits || creatingMenuVersion}
              >
                {savingManualEdits ? (
                  <View style={styles.manualSaveLoading}>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.manualSaveButtonText}>Saving...</Text>
                  </View>
                ) : (
                  <>
                    <Ionicons name="save-outline" size={14} color="#FFF" />
                    <Text style={styles.manualSaveButtonText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.manualCreateVersionButton,
                  (!hasEditedMenuItemsForVersion || creatingMenuVersion || savingManualEdits) &&
                    styles.manualSaveButtonDisabled,
                ]}
                onPress={handleCreateNewMenuVersion}
                disabled={!hasEditedMenuItemsForVersion || creatingMenuVersion || savingManualEdits}
              >
                {creatingMenuVersion ? (
                  <View style={styles.manualSaveLoading}>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.manualSaveButtonText}>Creating...</Text>
                  </View>
                ) : (
                  <>
                    <Ionicons name="git-branch-outline" size={14} color="#FFF" />
                    <Text style={styles.manualSaveButtonText}>Version</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Menu Items Section */}
        <View style={styles.section}>
          <View style={styles.menuItemsSectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Menu Items ({getFilteredMenuItems().length})</Text>
              <Text style={styles.sectionSubtitle}>Quick view of item performance and sales.</Text>
            </View>
            <TouchableOpacity
              style={styles.addMenuItemButton}
              onPress={openAddItemModal}
              disabled={loadingItems}
            >
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={styles.addMenuItemButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Items List */}
        <View style={styles.itemsList}>
          {loadingItems ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#4a3621" />
              <Text style={{ marginTop: 8, color: '#847362' }}>Loading menu items...</Text>
            </View>
          ) : getFilteredMenuItems().length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={48} color="#847362" />
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'No menu items found' : 'No menu items available'}
              </Text>
            </View>
          ) : (
            getFilteredMenuItems().slice(0, visibleCount).map((item) => {
              const cupsSold = itemSalesMap.get(item.menuItemId) ?? 0;
              const costPerCup = Number(
                item.shopRecipe?.totalCost ?? itemUnitCostMap.get(item.menuItemId) ?? 0
              );
              const hasRecipeImage = Boolean(String(item.shopRecipe?.image ?? '').trim());
              const sizeVariants = [...(item.itemSizeViewModels ?? [])].sort((left, right) => {
                const leftVolume = Number(left?.beverageSize?.volume ?? Number.MAX_SAFE_INTEGER);
                const rightVolume = Number(right?.beverageSize?.volume ?? Number.MAX_SAFE_INTEGER);
                return leftVolume - rightVolume;
              });
              const menuItemVariants = sizeVariants.length > 0 ? sizeVariants : [null];

              return (
                <ScrollView
                  key={item.menuItemId}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.menuItemCarousel}
                  contentContainerStyle={styles.menuItemCarouselContent}
                >
                  {menuItemVariants.map((sizeVariant, variantIndex) => {
                    const variantPrice = Number(sizeVariant?.sellingPrice ?? item.sellingPrice ?? 0);
                    const variantLabel = getMenuItemSizeLabel(sizeVariant ?? {}, variantIndex);
                    const variantAliases = getSizeVariantAliases(sizeVariant, variantIndex);
                    const variantCupsSold = sizeVariant
                      ? variantAliases.reduce((maxCups, alias) => {
                          const key = `${item.menuItemId}:${normalizeSizeToken(alias)}`;
                          const cups = itemSalesBySizeMap.get(key) ?? 0;
                          return cups > maxCups ? cups : maxCups;
                        }, 0)
                      : cupsSold;
                    const variantCostPerCup = sizeVariant
                      ? Number((sizeVariant as any)?.scaledTotalCost ?? (sizeVariant as any)?.ScaledTotalCost ?? 0)
                      : Number(item.shopRecipe?.totalCost ?? itemUnitCostMap.get(item.menuItemId) ?? 0);
                    const variantRevenue = variantCupsSold > 0 ? variantPrice * variantCupsSold : 0;
                    const variantTotalCost =
                      variantCupsSold > 0 ? variantCostPerCup * variantCupsSold : 0;
                    const isLastVariant = variantIndex === menuItemVariants.length - 1;

                    return (
                      <TouchableOpacity
                        key={`${item.menuItemId}-${sizeVariant?.itemSizeId ?? 'base'}-${variantIndex}`}
                        style={[
                          styles.menuItem,
                          styles.menuItemVariantCard,
                          !isLastVariant && styles.menuItemVariantSpacing,
                          isMenuItemEdited(item) && styles.menuItemEdited,
                        ]}
                        activeOpacity={0.9}
                        onPress={() => {
                          let shopRecipe: any = item?.shopRecipe || null;
                          const shopRecipes =
                            item?.shopBeverage && Array.isArray((item.shopBeverage as any).shopRecipes)
                              ? (item.shopBeverage as any).shopRecipes
                              : [];

                          if (!shopRecipe && shopRecipes.length > 0) {
                            shopRecipe = shopRecipes[0];
                          }

                          const shopRecipeIngredients = Array.isArray(
                            shopRecipe?.ingredients ?? shopRecipe?.shopRecipeIngredients
                          )
                            ? shopRecipe.ingredients ?? shopRecipe.shopRecipeIngredients
                            : [];

                          router.push({
                            pathname: '/recipe-detail/[id]',
                            params: {
                              id: String(item.menuItemId || 0),
                              menuItemId: String(item.menuItemId || 0),
                              recipeId: String(item.shopRecipe?.recipeId || 0),
                              beverageName: item.shopBeverage?.name ?? '',
                              recipe: shopRecipe ? JSON.stringify(shopRecipe) : '',
                              recipes: shopRecipes.length > 0 ? JSON.stringify(shopRecipes) : '',
                              ingredients: JSON.stringify(shopRecipeIngredients),
                              itemSizes:
                                Array.isArray(item.itemSizeViewModels) &&
                                item.itemSizeViewModels.length > 0
                                  ? JSON.stringify(item.itemSizeViewModels)
                                  : '',
                              selectedItemSizeId: String(sizeVariant?.itemSizeId ?? ''),
                            },
                          });
                        }}
                      >
                        <View style={styles.menuItemMediaColumn}>
                          <View style={styles.menuItemImage}>
                            {item.shopRecipe?.image ? (
                              <Image
                                source={{ uri: item.shopRecipe.image }}
                                style={styles.menuItemImageAsset}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={styles.menuItemImageFallback}>
                                <Ionicons name="cafe" size={32} color="#847362" />
                              </View>
                            )}
                          </View>
                          <View style={styles.menuItemLeftMeta}>
                            <View style={styles.cupsBadge}>
                              <Ionicons name="cafe" size={12} color="#4a3621" />
                              <Text style={styles.cupsBadgeText}>{variantCupsSold} cups sold</Text>
                            </View>
                            <View style={styles.menuItemMetricBadgeWrap}>
                              <View style={[styles.menuItemMetricBadge, styles.menuItemCostBadge]}>
                                <Text style={[styles.menuItemMetricBadgeText, styles.menuItemCostBadgeText]}>
                                  Cost/cup: {formatCurrency(variantCostPerCup)}
                                </Text>
                              </View>
                              <View style={[styles.menuItemMetricBadge, styles.menuItemSizeBadge]}>
                                <Text style={[styles.menuItemMetricBadgeText, styles.menuItemSizeBadgeText]}>
                                  Size: {variantLabel}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                        <View style={styles.menuItemContent}>
                          <View style={styles.menuItemHeader}>
                            <View style={styles.menuItemHeaderSpacer} />
                            <View style={styles.menuItemActionGroup}>
                              {!hasRecipeImage && (
                                <TouchableOpacity
                                  style={styles.menuItemGenerateImageButton}
                                  onPress={(event) => {
                                    event.stopPropagation();
                                    handleGenerateMenuItemImage(item);
                                  }}
                                  disabled={generatingImageItemIds.includes(item.menuItemId)}
                                >
                                  {generatingImageItemIds.includes(item.menuItemId) ? (
                                    <ActivityIndicator size="small" color="#2D6A4F" />
                                  ) : (
                                    <Ionicons name="image-outline" size={18} color="#2D6A4F" />
                                  )}
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                style={styles.menuItemEditButton}
                                onPress={(event) => {
                                  event.stopPropagation();
                                  openEditModalForItem(item, { readOnly: false });
                                }}
                              >
                                <Ionicons name="create-outline" size={18} color="#4a3621" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.menuItemDeleteButton}
                                onPress={(event) => {
                                  event.stopPropagation();
                                  handleDeleteMenuItem(item);
                                }}
                              >
                                <Ionicons name="trash-outline" size={18} color="#a13e2a" />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <Text style={styles.menuItemTitle} numberOfLines={2}>
                            {item.shopRecipe?.recipeName || 'Unnamed Item'}
                          </Text>
                          {item.description && (
                            <Text style={styles.menuItemDescription} numberOfLines={2}>
                              {item.description}
                            </Text>
                          )}
                          <View style={styles.menuItemPriceRow}>
                            <Text style={styles.menuItemPrice}>{formatCurrency(variantPrice)}</Text>
                          </View>
                          <View style={styles.menuItemFinanceRow}>
                            <View style={styles.menuItemFinanceCell}>
                              <Text style={styles.menuItemFinanceLabel}>Revenue</Text>
                              <Text style={styles.menuItemFinanceValue}>
                                {formatAmountNoUnit(variantRevenue)}
                              </Text>
                            </View>
                            <View style={styles.menuItemFinanceCell}>
                              <Text style={styles.menuItemFinanceLabel}>Total cost</Text>
                              <Text style={styles.menuItemFinanceValue}>
                                {formatAmountNoUnit(variantTotalCost)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              );
            })
          )}
        </View>

        {!loadingItems && getFilteredMenuItems().length > visibleCount && (
          <View style={styles.loadMoreWrap}>
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={() => setVisibleCount((prev) => prev + MENU_PAGE_SIZE)}
            >
              <Text style={styles.loadMoreText}>Load more items</Text>
              <Ionicons name="chevron-down" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>

        <Modal
          visible={showAddItemModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAddItemModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.addItemModalContent]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add menu item</Text>
                <TouchableOpacity onPress={() => setShowAddItemModal(false)}>
                  <Ionicons name="close" size={24} color="#4a3621" />
                </TouchableOpacity>
              </View>

              <View style={styles.addItemSearchWrap}>
                <Ionicons name="search" size={18} color="#847362" />
                <TextInput
                  style={styles.addItemSearchInput}
                  placeholder="Search recipe or beverage..."
                  placeholderTextColor="#847362"
                  value={recipeSearchQuery}
                  onChangeText={setRecipeSearchQuery}
                />
              </View>

              {loadingAvailableRecipes ? (
                <View style={styles.addItemLoadingWrap}>
                  <ActivityIndicator size="small" color="#4a3621" />
                  <Text style={styles.addItemLoadingText}>Loading recipes...</Text>
                </View>
              ) : availableRecipesForAdd.length === 0 ? (
                <View style={styles.addItemEmptyWrap}>
                  <Ionicons name="albums-outline" size={28} color="#847362" />
                  <Text style={styles.addItemEmptyText}>No available recipe to add.</Text>
                </View>
              ) : (
                <FlatList
                  data={availableRecipesForAdd}
                  keyExtractor={(item) => String(item.recipeId)}
                  contentContainerStyle={styles.addItemList}
                  renderItem={({ item }) => (
                    <View style={styles.addItemRow}>
                      <View style={styles.addItemRowInfo}>
                        <Text style={styles.addItemRowTitle} numberOfLines={1}>
                          {item.recipeName}
                        </Text>
                        <Text style={styles.addItemRowSubtitle} numberOfLines={1}>
                          {item.beverageName || 'Unknown beverage'}
                          {item.beverageCategoryName ? ` • ${item.beverageCategoryName}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.addItemRowButton}
                        onPress={() => handleAddMenuItem(item)}
                      >
                        <Ionicons name="add" size={18} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>

        <Modal
          visible={showDuplicateItemModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowDuplicateItemModal(false);
            setDuplicateItemMessage('');
          }}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <View style={[styles.confirmIconWrap, styles.duplicateConfirmIconWrap]}>
                <Ionicons name="alert-circle-outline" size={22} color="#d17a22" />
              </View>
              <Text style={styles.confirmTitle}>Duplicate menu item</Text>
              <Text style={styles.confirmMessage}>
                {duplicateItemMessage || 'This item already exists in the menu item list.'}
              </Text>
              <View style={[styles.confirmActions, styles.confirmSingleAction]}>
                <TouchableOpacity
                  style={styles.confirmLeaveButton}
                  onPress={() => {
                    setShowDuplicateItemModal(false);
                    setDuplicateItemMessage('');
                  }}
                >
                  <Text style={styles.confirmLeaveText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showWarningModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowWarningModal(false)}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <View style={[styles.confirmIconWrap, styles.warningConfirmIconWrap]}>
                <Ionicons name="warning-outline" size={22} color="#d17a22" />
              </View>
              <Text style={styles.confirmTitle}>{warningModalTitle}</Text>
              <Text style={styles.confirmMessage}>{warningModalMessage}</Text>
              <View style={[styles.confirmActions, styles.confirmSingleAction]}>
                <TouchableOpacity
                  style={styles.confirmLeaveButton}
                  onPress={() => setShowWarningModal(false)}
                >
                  <Text style={styles.confirmLeaveText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showDeleteConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowDeleteConfirm(false);
            setDeletingItem(null);
          }}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <View style={[styles.confirmIconWrap, styles.deleteConfirmIconWrap]}>
                <Ionicons name="trash-outline" size={22} color="#d63a2f" />
              </View>
              <Text style={styles.confirmTitle}>Delete menu item?</Text>
              <Text style={styles.confirmMessage}>
                Remove "{deletingItem?.shopRecipe?.recipeName ?? 'this item'}" from this menu version.
              </Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={styles.confirmCancelButton}
                  onPress={() => {
                    setShowDeleteConfirm(false);
                    setDeletingItem(null);
                  }}
                >
                  <Text style={styles.confirmCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteConfirmButton} onPress={confirmDeleteMenuItem}>
                  <Text style={styles.deleteConfirmText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showBackConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBackConfirm(false)}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <View style={styles.confirmIconWrap}>
                <Ionicons name="alert" size={22} color="#4a3621" />
              </View>
              <Text style={styles.confirmTitle}>Discard changes?</Text>
              <Text style={styles.confirmMessage}>
                You have unsaved edits. Leave without saving?
              </Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={styles.confirmCancelButton}
                  onPress={() => setShowBackConfirm(false)}
                >
                  <Text style={styles.confirmCancelText}>Stay</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmLeaveButton}
                  onPress={() => {
                    setShowBackConfirm(false);
                    navigateToMenuVersion();
                  }}
                >
                  <Text style={styles.confirmLeaveText}>Discard</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showEditModal}
          transparent={true}
          animationType="slide"
          onRequestClose={closeEditModal}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.editModalContent]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditModalReadOnly ? 'Menu item detail' : 'Edit menu item'}
                </Text>
                <TouchableOpacity
                  onPress={closeEditModal}
                >
                  <Ionicons name="close" size={24} color="#4a3621" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.editModalBody} contentContainerStyle={styles.editModalBodyContent}>
                <Text style={styles.editItemName}>
                  {editingItem?.shopRecipe?.recipeName || 'Menu item'}
                </Text>
                <View style={styles.editMetaCard}>
                  <View style={styles.editMetaRow}>
                    <Text style={styles.editMetaLabel}>Beverage</Text>
                    <Text style={styles.editMetaValue}>{editingItem?.shopBeverage?.name || 'Unknown'}</Text>
                  </View>
                  <View style={styles.editMetaRow}>
                    <Text style={styles.editMetaLabel}>Category</Text>
                    <Text style={styles.editMetaValue}>
                      {editingItem?.shopBeverage?.beverageCategory?.name ||
                        editingItem?.shopBeverage?.beverageCategoryName ||
                        'Unknown'}
                    </Text>
                  </View>
                  <View style={styles.editMetaRow}>
                    <Text style={styles.editMetaLabel}>Recipe</Text>
                    <Text style={styles.editMetaValue}>#{editingItem?.shopRecipe?.recipeId ?? 'N/A'}</Text>
                  </View>
                </View>

                <Text style={styles.editLabel}>
                  {isEditModalReadOnly ? 'Description' : 'Description (Editable)'}
                </Text>
                <TextInput
                  style={[styles.editInput, styles.editTextArea]}
                  placeholder="Add a short description"
                  placeholderTextColor="#b3a79b"
                  multiline
                  value={editDescription}
                  onChangeText={setEditDescription}
                  editable={!isEditModalReadOnly}
                />
                {!isEditModalReadOnly && editErrors.description && (
                  <Text style={styles.editErrorText}>{editErrors.description}</Text>
                )}

                {!isMultiSizeEditing ? (
                  <>
                    <Text style={styles.editLabel}>
                      {isEditModalReadOnly ? 'Selling price' : 'Selling price (Editable)'}
                    </Text>
                    <TextInput
                      style={styles.editInput}
                      placeholder="0"
                      placeholderTextColor="#b3a79b"
                      keyboardType="numeric"
                      value={editSellingPrice}
                      onChangeText={setEditSellingPrice}
                      editable={!isEditModalReadOnly}
                    />
                    {!isEditModalReadOnly && editErrors.sellingPrice && (
                      <Text style={styles.editErrorText}>{editErrors.sellingPrice}</Text>
                    )}
                  </>
                ) : (
                  <View style={styles.basePriceInfoCard}>
                    <Text style={styles.basePriceInfoTitle}>Base price (read-only)</Text>
                    <Text style={styles.basePriceInfoValue}>{formatCurrency(Number(editSellingPrice || 0))}</Text>
                    <Text style={styles.basePriceInfoHint}>
                      Synced from smallest size: {anchorSizeDraft ? getSizeDraftLabel(anchorSizeDraft, 0) : 'N/A'}
                    </Text>
                  </View>
                )}

                {editSizePrices.length > 0 && (
                  <View style={styles.editSizesSection}>
                    <Text style={styles.editLabel}>
                      {isEditModalReadOnly ? 'Size prices' : 'Size prices (Editable)'}
                    </Text>
                    {editSizePrices.map((size, index) => (
                      <View key={size.itemSizeId}>
                        <View style={styles.sizePriceRow}>
                          <View style={styles.sizePriceLabelWrap}>
                            <Text style={styles.sizePriceLabel}>{getSizeDraftLabel(size, index)}</Text>
                            {anchorSizeDraftId === size.itemSizeId ? (
                              <View style={styles.baseSizeBadge}>
                                <Text style={styles.baseSizeBadgeText}>Base size</Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={styles.sizePriceInputWrap}>
                            <TextInput
                              style={styles.sizePriceInput}
                              placeholder="0"
                              placeholderTextColor="#b3a79b"
                              keyboardType="numeric"
                              value={size.sellingPrice}
                              onChangeText={(value) => updateSizePriceDraft(size.itemSizeId, value)}
                              editable={!isEditModalReadOnly}
                            />
                          </View>
                        </View>
                        {!isEditModalReadOnly && editErrors.sizePrices?.[size.itemSizeId] && (
                          <Text style={styles.editErrorText}>
                            {editErrors.sizePrices?.[size.itemSizeId]}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
              <View style={styles.editModalFooter}>
                <TouchableOpacity
                  style={styles.editCancelButton}
                  onPress={closeEditModal}
                >
                  <Text style={styles.editCancelText}>{isEditModalReadOnly ? 'Close' : 'Cancel'}</Text>
                </TouchableOpacity>
                {!isEditModalReadOnly && (
                  <TouchableOpacity style={styles.editApplyButton} onPress={applyEditChanges}>
                    <Text style={styles.editApplyText}>Apply changes</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>

      {/* Date Picker Modal */}
      <Modal
        visible={showImageViewer}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowImageViewer(false);
          resetZoom();
        }}
      >
        <GestureHandlerRootView style={styles.imageViewerRoot}>
          <View style={styles.imageViewerOverlay}>
            <TouchableOpacity
              style={styles.imageViewerCloseButton}
              onPress={() => {
                setShowImageViewer(false);
                resetZoom();
              }}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.imageViewerDownloadButton,
                downloadingViewerImage && styles.imageViewerDownloadButtonDisabled,
              ]}
              onPress={handleDownloadViewerImage}
              disabled={downloadingViewerImage}
            >
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.imageViewerGestureArea}>
              {menuImageUris.length > 1 ? (
                <>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(event) => {
                      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                      setCurrentViewerImageIndex(nextIndex);
                      resetZoom();
                    }}
                  >
                    {menuImageUris.map((uri) => (
                      <View key={uri} style={styles.imageViewerSlide}>
                        <Image source={{ uri }} resizeMode="contain" style={styles.imageViewerImage} />
                      </View>
                    ))}
                  </ScrollView>
                  <View style={styles.imageViewerPager}>
                    <Text style={styles.imageViewerPagerText}>
                      {currentViewerImageIndex + 1}/{menuImageUris.length}
                    </Text>
                  </View>
                </>
              ) : (
                <GestureDetector gesture={imageGesture}>
                  <Animated.Image
                    source={{ uri: menuImageUri || fallbackMenuImage }}
                    resizeMode="contain"
                    style={[styles.imageViewerImage, animatedImageStyle]}
                  />
                </GestureDetector>
              )}
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>

      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color="#4a3621" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={data?.chartData || []}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.dateItem,
                    selectedDateIndex === index && styles.dateItemSelected
                  ]}
                  onPress={() => {
                    setSelectedDateIndex(index);
                    setShowDatePicker(false);
                  }}
                >
                  <View style={styles.dateItemContent}>
                    <Ionicons 
                      name="calendar" 
                      size={20} 
                      color={selectedDateIndex === index ? '#FFF' : '#4a3621'} 
                    />
                    <Text style={[
                      styles.dateItemText,
                      selectedDateIndex === index && styles.dateItemTextSelected
                    ]}>
                      {formatDate(item.date)}
                    </Text>
                  </View>
                  <View style={styles.dateItemStats}>
                    <Text style={[
                      styles.dateItemRevenue,
                      selectedDateIndex === index && styles.dateItemTextSelected
                    ]}>
                      {formatCurrency(item.totalRevenue)}
                    </Text>
                    <Text style={[
                      styles.dateItemCups,
                      selectedDateIndex === index && styles.dateItemTextSelected
                    ]}>
                      {item.totalCups} cups
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Category</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color="#4a3621" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.filterModalScroll}>
              <View style={styles.filterTagsContainer}>
                {categories.map((category) => {
                  const catId = getCategoryId(category);
                  const catName = getCategoryName(category);
                  const isSelected = selectedCategoryIds.includes(catId);
                  
                  return (
                    <TouchableOpacity
                      key={catId}
                      style={[
                        styles.filterTag,
                        isSelected && styles.filterTagSelected
                      ]}
                      onPress={() => toggleCategory(catId)}
                    >
                      <Text style={[
                        styles.filterTagText,
                        isSelected && styles.filterTagTextSelected
                      ]}>
                        {catName}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.filterModalFooter}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  clearFilters();
                  setShowFilterModal(false);
                }}
              >
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.applyButtonText}>
                  Apply {selectedCategoryIds.length > 0 ? `(${selectedCategoryIds.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f6',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#e1dbd6',
    shadowColor: '#3b2a1a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4a3621',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#e1dbd6',
    position: 'relative',
    shadowColor: '#3b2a1a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  headerIconButtonAccent: {
    backgroundColor: '#eef8f1',
    borderColor: '#cde8d8',
  },
  headerActionBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#e74c3c',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  headerActionBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  bannerContainer: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  feedbackInsightsButtonWrap: {
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  feedbackInsightsButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  feedbackInsightsButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedbackInsightsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4a3621',
  },
  menuItemsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionSubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: '#847362',
  },
  addMenuItemButton: {
    backgroundColor: '#4a3621',
    borderRadius: 18,
    paddingHorizontal: 12,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    shadowColor: '#3b2a1a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  addMenuItemButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  menuImageSection: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  menuImageCard: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e1dbd6',
    backgroundColor: '#FFF',
  },
  menuImagePreview: {
    width: '100%',
    height: '100%',
  },
  menuImageHintChip: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(31, 31, 31, 0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuImageHintText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerRoot: {
    flex: 1,
  },
  imageViewerGestureArea: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerSlide: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 52,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  imageViewerDownloadButton: {
    position: 'absolute',
    top: 52,
    right: 70,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  imageViewerDownloadButtonDisabled: {
    opacity: 0.6,
  },
  imageViewerImage: {
    width: '95%',
    height: '75%',
  },
  imageViewerPager: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  imageViewerPagerText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  banner: {
    backgroundColor: '#4a3621',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  bannerContent: {
    flex: 1,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: '#FFF',
    opacity: 0.8,
    fontWeight: '500',
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  bannerIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 12,
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1dbd6',
    marginBottom: 16,
  },
  datePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  datePickerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a3621',
  },
  kpiScrollView: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  kpiContainer: {
    gap: 16,
    paddingRight: 24,
  },
  kpiCard: {
    minWidth: 160,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e1dbd6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  kpiLabel: {
    fontSize: 10,
    color: '#847362',
    fontWeight: '600',
    letterSpacing: 1,
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 8,
    gap: 12,
    alignItems: 'center',
  },
  manualEditCard: {
    marginHorizontal: 24,
    marginTop: 4,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eadfd3',
    backgroundColor: '#fff7ef',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  manualEditText: {
    flex: 1,
  },
  manualEditTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4a3621',
  },
  manualEditSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#847362',
  },
  manualEditHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#d17a22',
  },
  manualSaveButton: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#4a3621',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 88,
    shadowColor: '#3b2a1a',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 9,
    elevation: 3,
  },
  manualSaveButtonDisabled: {
    opacity: 0.6,
  },
  manualSaveButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  manualEditProgress: {
    marginTop: 6,
    fontSize: 12,
    color: '#2d6a4f',
    fontWeight: '700',
  },
  manualSaveLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manualActionColumn: {
    gap: 8,
    alignItems: 'stretch',
  },
  manualCreateVersionButton: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#2D6A4F',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 88,
    shadowColor: '#214d3a',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 9,
    elevation: 3,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1dbd6',
    gap: 8,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4a3621',
    marginTop: 4,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1dbd6',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 2,
    fontSize: 14,
    color: '#4a3621',
  },
  filterButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#e1dbd6',
    padding: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: '#4a3621',
    borderColor: '#4a3621',
  },
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  filterModalScroll: {
    maxHeight: '60%',
  },
  filterTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 12,
  },
  filterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#e1dbd6',
  },
  filterTagSelected: {
    backgroundColor: '#4a3621',
    borderColor: '#4a3621',
  },
  filterTagText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a3621',
  },
  filterTagTextSelected: {
    color: '#FFF',
  },
  filterModalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e1dbd6',
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#e1dbd6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4a3621',
  },
  applyButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#4a3621',
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  itemsList: {
    paddingHorizontal: 24,
    gap: 16,
    paddingBottom: 16,
  },
  menuItem: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eadfd3',
    flexDirection: 'row',
    gap: 16,
    shadowColor: '#3b2a1a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    alignItems: 'flex-start',
  },
  menuItemCarousel: {
    overflow: 'visible',
  },
  menuItemCarouselContent: {
    paddingRight: 4,
    paddingTop: 2,
    paddingBottom: 10,
  },
  menuItemVariantCard: {
    width: SCREEN_WIDTH - 64,
  },
  menuItemVariantSpacing: {
    marginRight: 10,
  },
  menuItemEdited: {
    borderColor: '#d17a22',
    backgroundColor: '#fff2e6',
  },
  menuItemWarning: {
    borderLeftWidth: 4,
    borderLeftColor: '#e71008',
  },
  menuItemMediaColumn: {
    width: 128,
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
    marginTop: 0,
    gap: 8,
  },
  menuItemImage: {
    width: '100%',
    height: 96,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#f1ebe5',
  },
  menuItemImageAsset: {
    width: '100%',
    height: '100%',
  },
  menuItemImageFallback: {
    backgroundColor: '#efe8e0',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemContent: {
    flex: 1,
    minHeight: 96,
  },
  menuItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  menuItemHeaderSpacer: {
    flex: 1,
  },
  menuItemActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemGenerateImageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#cfe7da',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3faf6',
  },
  menuItemEditButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e1dbd6',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemDeleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0d6cf',
    backgroundColor: '#fff5f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4a3621',
    lineHeight: 22,
    marginBottom: 6,
  },
  menuItemLeftMeta: {
    gap: 6,
    alignItems: 'stretch',
  },
  menuItemMetricBadgeWrap: {
    gap: 6,
  },
  menuItemMetricBadge: {
    backgroundColor: 'rgba(74, 54, 33, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  menuItemMetricBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4a3621',
  },
  menuItemCostBadge: {
    backgroundColor: 'rgba(45, 106, 79, 0.14)',
  },
  menuItemCostBadgeText: {
    color: '#275743',
  },
  menuItemSizeBadge: {
    backgroundColor: 'rgba(56, 96, 160, 0.12)',
  },
  menuItemSizeBadgeText: {
    color: '#2f4e7a',
  },
  loadMoreWrap: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  loadMoreButton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#4a3621',
    borderWidth: 1,
    borderColor: '#3c2c1b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#3b2a1a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  loadMoreText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  badgeGreen: {
    backgroundColor: 'rgba(7, 136, 14, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(7, 136, 14, 0.2)',
  },
  badgeTextGreen: {
    fontSize: 9,
    fontWeight: '700',
    color: '#07880e',
  },
  badgeRed: {
    backgroundColor: 'rgba(231, 16, 8, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(231, 16, 8, 0.2)',
  },
  badgeTextRed: {
    fontSize: 9,
    fontWeight: '700',
    color: '#e71008',
  },
  menuItemStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4a3621',
  },
  soldText: {
    fontSize: 12,
    color: '#847362',
  },
  profitBarContainer: {
    marginTop: 4,
  },
  profitBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  profitLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4a3621',
    letterSpacing: 0.5,
  },
  costLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#847362',
    letterSpacing: 0.5,
  },
  profitBar: {
    height: 8,
    width: '100%',
    backgroundColor: '#e5e5e5',
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  profitFill: {
    height: '100%',
    backgroundColor: '#4a3621',
  },
  costFill: {
    height: '100%',
    backgroundColor: 'rgba(74, 54, 33, 0.3)',
  },
  aiSection: {
    backgroundColor: 'rgba(74, 54, 33, 0.05)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(74, 54, 33, 0.2)',
    gap: 16,
  },
  aiHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  aiIconContainer: {
    backgroundColor: '#4a3621',
    padding: 8,
    borderRadius: 12,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiTextContainer: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4a3621',
    marginBottom: 4,
  },
  aiDescription: {
    fontSize: 14,
    color: '#847362',
  },
  aiButton: {
    backgroundColor: '#4a3621',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3c2c1b',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#3b2a1a',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.17,
    shadowRadius: 12,
    elevation: 4,
  },
  aiButtonDisabled: {
    opacity: 0.7,
  },
  aiButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSpacing: {
    height: 100,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#847362',
    textAlign: 'center',
  },
  menuItemDescription: {
    fontSize: 13,
    color: '#847362',
    marginBottom: 8,
    lineHeight: 18,
  },
  menuItemPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 'auto',
    gap: 8,
  },
  menuItemPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4a3621',
  },
  menuItemFinanceRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  menuItemFinanceCell: {
    flex: 1,
  },
  menuItemFinanceLabel: {
    fontSize: 12,
    color: '#847362',
    fontWeight: '600',
    marginBottom: 2,
  },
  menuItemFinanceValue: {
    fontSize: 15,
    color: '#4a3621',
    fontWeight: '700',
  },
  menuItemCostText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b5a47',
    flexShrink: 1,
  },
  categoryBadge: {
    backgroundColor: 'rgba(74, 54, 33, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeLeft: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4a3621',
  },
  cupsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(211, 139, 42, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  cupsBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4a3621',
  },
  sizesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  sizesLabel: {
    fontSize: 11,
    color: '#847362',
    fontWeight: '600',
  },
  sizeText: {
    fontSize: 11,
    color: '#847362',
  },
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e1dbd6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1dbd6',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4a3621',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#847362',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4a3621',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 40,
  },
  editModalContent: {
    maxHeight: '80%',
  },
  addItemModalContent: {
    maxHeight: '75%',
  },
  addItemSearchWrap: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e1dbd6',
    borderRadius: 10,
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addItemSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#4a3621',
  },
  addItemLoadingWrap: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addItemLoadingText: {
    fontSize: 13,
    color: '#847362',
    fontWeight: '600',
  },
  addItemEmptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addItemEmptyText: {
    fontSize: 13,
    color: '#847362',
    fontWeight: '600',
  },
  addItemList: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
  },
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: '#eadfd3',
    borderRadius: 12,
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addItemRowInfo: {
    flex: 1,
  },
  addItemRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4a3621',
  },
  addItemRowSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#847362',
  },
  addItemRowButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4a3621',
  },
  editModalBody: {
    paddingHorizontal: 20,
  },
  editModalBodyContent: {
    paddingBottom: 28,
  },
  editItemName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4a3621',
    marginBottom: 12,
  },
  editMetaCard: {
    borderWidth: 1,
    borderColor: '#e6dbcf',
    borderRadius: 12,
    backgroundColor: '#faf7f3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
  },
  editMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  editMetaLabel: {
    fontSize: 12,
    color: '#847362',
    fontWeight: '700',
  },
  editMetaValue: {
    flex: 1,
    fontSize: 12,
    color: '#4a3621',
    fontWeight: '600',
    textAlign: 'right',
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#847362',
    marginTop: 12,
    marginBottom: 6,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#e1dbd6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#4a3621',
    backgroundColor: '#FFF',
  },
  editTextArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  editSizesSection: {
    marginTop: 4,
  },
  basePriceInfoCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7dccf',
    backgroundColor: '#f8f2ea',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  basePriceInfoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#847362',
  },
  basePriceInfoValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
    color: '#4a3621',
  },
  basePriceInfoHint: {
    marginTop: 5,
    fontSize: 11,
    color: '#8b7865',
    fontWeight: '600',
  },
  sizePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  sizePriceLabelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sizePriceLabel: {
    fontSize: 13,
    color: '#4a3621',
    fontWeight: '600',
  },
  baseSizeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#d17a22',
  },
  baseSizeBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  sizePriceInputWrap: {
    width: 118,
  },
  sizePriceInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e1dbd6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#4a3621',
    textAlign: 'right',
    backgroundColor: '#FFF',
  },
  editModalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e1dbd6',
  },
  editCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e1dbd6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4a3621',
  },
  editApplyButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4a3621',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editApplyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  editErrorText: {
    marginTop: 6,
    color: '#d32f2f',
    fontSize: 12,
    fontWeight: '600',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 20, 17, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8dfd6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    alignItems: 'center',
  },
  confirmIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5eee7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  deleteConfirmIconWrap: {
    backgroundColor: '#fdebea',
  },
  duplicateConfirmIconWrap: {
    backgroundColor: '#fff2e6',
  },
  warningConfirmIconWrap: {
    backgroundColor: '#fff2e6',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4a3621',
    textAlign: 'center',
  },
  confirmMessage: {
    marginTop: 8,
    fontSize: 13,
    color: '#7b6a5a',
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 12,
  },
  confirmSingleAction: {
    width: '100%',
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1dbd6',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  confirmCancelText: {
    color: '#4a3621',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmLeaveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#4a3621',
    alignItems: 'center',
  },
  confirmLeaveText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#d63a2f',
    alignItems: 'center',
  },
  deleteConfirmText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1dbd6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4a3621',
  },
  dateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dateItemSelected: {
    backgroundColor: '#4a3621',
  },
  dateItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a3621',
  },
  dateItemTextSelected: {
    color: '#FFF',
  },
  dateItemStats: {
    alignItems: 'flex-end',
  },
  dateItemRevenue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4a3621',
  },
  dateItemCups: {
    fontSize: 12,
    color: '#847362',
    marginTop: 2,
  },
});