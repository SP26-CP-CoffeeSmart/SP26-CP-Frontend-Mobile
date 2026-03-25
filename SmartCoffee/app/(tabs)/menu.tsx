import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  Dimensions,
  FlatList,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { API_ENDPOINTS, AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import beverageSizeService, { BeverageSize } from '@/services/beverageSizeService';
import { useAuth } from '@/context/auth-context';
import { BeverageCategory, useBeverageCategories } from '@/context/beverage-category-context';
import Toast from 'react-native-toast-message';

interface MenuItem {
  id: string;
  name: string;
  versions: number;
  image: any;
  isApplied?: boolean;
  createDate?: string;
}

interface BeverageItem {
  id: string;
  beverageId?: number;
  name: string;
  flavor: string;
  time: string;
  image: any;
  imageUrl?: string | null;
  hasRealImage?: boolean;
  createDate?: string;
}

interface MenuHeaderApiItem {
  menuHeaderId?: number;
  name: string;
  shopId?: number;
  status?: string;
  isApplied?: boolean;
  image?: string;
  imageUrl?: string;
  createDate?: string;
  menuPreferenceJson?: any;
}

type BeverageApiItem = Record<string, any>;

const { width } = Dimensions.get('window');
const MENU_CARD_WIDTH = width - 48;
const BEVERAGE_PAGE_SIZE = 4;
const BEVERAGE_PAGE_WIDTH = width - 48;
const BEVERAGE_PAGE_GUTTER = 16;
const BEVERAGE_PAGE_ITEM_WIDTH = BEVERAGE_PAGE_WIDTH + BEVERAGE_PAGE_GUTTER;

const fallbackMenuImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAFdyVWmZyLBb3sGqVwjvNvxlcOXbB0Jw3NruLr76o5AWV5DnSRs2lZk-_efuzou3kn_LrScey1Wvc8PZzMxgj5gd91FXT-OMRu-KDU7M2mvsL21c9xdgBEpTOcel8JY5_xr42Trfr5CVVXx2G4ecoWnPsSNhqwo_JLo4tvueDeNm_BkMBYA8IXw4hDhwHePqDa5WtgASS4Sl2zzdVGmfZ5g4yNA_l60wPl8CirNcN-4mo_uanAPD1ZScVsTTbrc2V3_Jm5twRLvfU';
const fallbackBeverageImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDi2pH2xhE5BLMCq_TuPpKBFANKhFyh48O4wiW8NGw1EuuneDDEeHWIY3vvcrA6MGIgTFsYioOnnwHafNX4-r8GvHt6HJnyhYFp6JK3ZQoKyrQyjkP7_jdqFpJcC9Xrq4qdYM-rxaNDRb1jdHLLmiP4uFrM2ULZDI5Ovf5ErxjaVQhQmi855Kzd1Tg1tjFgEd8hBPCPlLx2baLBWS9fNM-1TRGGLrsyD9duBhOqgR_KvuwjIdAQ-3RwRPXqm-8v-rl8_ivNkEzIp5s';

const MENU_REFRESH_FLAG_KEY = 'menu:list:refresh:needed';
const BEVERAGE_REFRESH_FLAG_KEY = 'beverage:list:refresh:needed';
const ONBOARDING_COMPLETE_KEY = 'onboarding:complete';
const SUBSCRIPTION_SKIP_ONCE_KEY = 'subscription:skip-once';
const SUBSCRIPTION_BG_IMAGE = require('../../assets/background.png');

type SubscriptionPackage = {
  subscriptionPackageId?: number;
  id?: number;
  name?: string;
  tier?: string;
  price?: number | string;
  duration?: number | string;
  description?: string;
};

const getSubscriptionPackageId = (item: SubscriptionPackage) =>
  item.subscriptionPackageId ?? item.id ?? (item as any).packageId ?? null;

const formatSubscriptionPrice = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numeric)) {
    return `${numeric.toLocaleString()} VND`;
  }
  return String(value);
};

const getNumericPrice = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getSubscriptionPackageIdFromSubscription = (value: any) => {
  const raw =
    value?.packageId ??
    value?.subscriptionPackageId ??
    value?.package?.packageId ??
    value?.package?.subscriptionPackageId ??
    value?.package?.id ??
    value?.subscriptionPackage?.id ??
    value?.subscriptionPackageId;
  return typeof raw === 'number' ? raw : Number(raw) || null;
};

const isTrialSubscription = (item: SubscriptionPackage) => {
  const name = String(item.name ?? item.tier ?? '').toLowerCase();
  if (name.includes('trial')) return true;
  const numeric = typeof item.price === 'number' ? item.price : Number(item.price);
  return Number.isFinite(numeric) && numeric <= 0;
};

const resolveImageUrl = (baseUrl: string, image?: string) => {
  if (!image) return null;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('/')) return `${baseUrl}${image}`;
  return `${baseUrl}/images/${image}`;
};

const isRealMenuImage = (raw?: string | null) => {
  if (!raw || raw === 'null' || raw === 'undefined') return false;
  const normalized = raw.toLowerCase();
  return !normalized.includes('unsplash.com') && !normalized.includes('aida-public');
};

const hasRealBeverageImage = (raw?: string | null) => {
  if (!raw || raw === 'null' || raw === 'undefined') return false;
  const normalized = raw.toLowerCase();
  if (normalized.includes('unsplash.com') || normalized.includes('aida-public')) {
    return false;
  }
  return true;
};

export default function MenuScreen() {
  const router = useRouter();
  const { coffeeShopId, loading: authLoading, profile, accountId } = useAuth();
  const {
    categories: beverageCategories,
    loading: categoriesLoading,
    error: categoriesError,
    refresh: refreshCategories,
    getCategoryId,
    getCategoryName,
  } = useBeverageCategories();
  const [beverages, setBeverages] = useState<BeverageItem[]>([]);
  const [beveragesLoading, setBeveragesLoading] = useState(false);
  const [beveragesError, setBeveragesError] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [totalBeverages, setTotalBeverages] = useState(0);
  const [showMenuGuardModal, setShowMenuGuardModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createImageUrl, setCreateImageUrl] = useState('');
  const [createCategoryName, setCreateCategoryName] = useState('');
  const [createCategoryId, setCreateCategoryId] = useState<number | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createImageUploading, setCreateImageUploading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [uploadingBeverageId, setUploadingBeverageId] = useState<string | null>(null);
  const [subscriptionGateVisible, setSubscriptionGateVisible] = useState(false);
  const [subscriptionGateShown, setSubscriptionGateShown] = useState(false);
  const [subscriptionPackages, setSubscriptionPackages] = useState<SubscriptionPackage[]>([]);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<any | null>(null);
  const [currentPackageId, setCurrentPackageId] = useState<number | null>(null);
  const [subscriptionInfoLoading, setSubscriptionInfoLoading] = useState(false);
  const [subscribeSubmitting, setSubscribeSubmitting] = useState(false);
  const [payosUrl, setPayosUrl] = useState<string | null>(null);
  const [showPayosModal, setShowPayosModal] = useState(false);
  const [checkingRecipeGate, setCheckingRecipeGate] = useState(false);
  const [checkingMenuGate, setCheckingMenuGate] = useState(false);
  const [showBeverageSizeGuideModal, setShowBeverageSizeGuideModal] = useState(false);
  const subscriptionSuccessRef = useRef(false);
  const beveragePagerRef = useRef<FlatList<BeverageItem[]> | null>(null);
  const [beverageLooping, setBeverageLooping] = useState(false);

  const loadSubscriptionPackages = useCallback(async () => {
    try {
      setSubscriptionLoading(true);
      setSubscriptionError(null);
      const response = await authorizedFetch(API_ENDPOINTS.subscriptionPackage.list(), {
        headers: { Accept: '*/*' },
      });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const payload = await response.json();
      const items: SubscriptionPackage[] = Array.isArray(payload)
        ? payload
        : payload?.items ?? payload?.data ?? [];
      const sorted = [...items].sort(
        (a, b) => Number(isTrialSubscription(b)) - Number(isTrialSubscription(a))
      );
      setSubscriptionPackages(sorted);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load packages.';
      setSubscriptionError(message);
    } finally {
      setSubscriptionLoading(false);
    }
  }, []);

  const loadCurrentSubscription = useCallback(async () => {
    if (!coffeeShopId) {
      setCurrentSubscription(null);
      setCurrentPackageId(null);
      return;
    }

    try {
      setSubscriptionInfoLoading(true);
      const response = await authorizedFetch(API_ENDPOINTS.subscription.byShop(coffeeShopId), {
        headers: { Accept: '*/*' },
      });
      if (!response.ok) {
        setCurrentSubscription(null);
        setCurrentPackageId(null);
        return;
      }
      const payload = await response.json();
      const resolved = Array.isArray(payload)
        ? payload[0]
        : payload?.data ?? payload?.item ?? payload?.items?.[0] ?? payload ?? null;
      setCurrentSubscription(resolved);
      setCurrentPackageId(getSubscriptionPackageIdFromSubscription(resolved));
    } catch {
      setCurrentSubscription(null);
      setCurrentPackageId(null);
    } finally {
      setSubscriptionInfoLoading(false);
    }
  }, [coffeeShopId]);

  const handleSubscribePackage = useCallback(
    async (item: SubscriptionPackage) => {
      if (subscribeSubmitting) return;

      const isTrial = isTrialSubscription(item);
      const packageId = getSubscriptionPackageId(item);

      try {
        setSubscribeSubmitting(true);

        if (isTrial) {
          if (!accountId) {
            throw new Error('Missing account id.');
          }
          const trialUrl = `${API_ENDPOINTS.subscription.trial()}?ownerId=${accountId}`;
          const response = await authorizedFetch(trialUrl, {
            method: 'POST',
            headers: {
              Accept: '*/*',
            },
          });

          if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
          }

          Toast.show({ type: 'success', text1: 'Trial activated' });
          await loadCurrentSubscription();
          return;
        }

        if (!packageId) {
          throw new Error('Missing package id.');
        }

        const response = await authorizedFetch(API_ENDPOINTS.subscription.subscribe(packageId, true), {
          method: 'POST',
          headers: {
            Accept: '*/*',
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = await response.json();
        const checkoutUrl = String(data?.checkoutUrl ?? data?.url ?? '').trim();
        if (!checkoutUrl) {
          throw new Error('Missing checkout url');
        }

        subscriptionSuccessRef.current = false;
        setPayosUrl(checkoutUrl);
        setShowPayosModal(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to subscribe.';
        Toast.show({ type: 'error', text1: 'Subscription failed', text2: message });
      } finally {
        setSubscribeSubmitting(false);
      }
    },
      [accountId, loadCurrentSubscription, subscribeSubmitting]
  );

  const handlePayosShouldStart = useCallback((event: { url?: string }) => {
    const rawUrl = String(event?.url ?? '');
    const url = rawUrl.toLowerCase();

    if (!url) {
      return true;
    }

    const isCancelRoute = url.includes('cancel=true') || url.includes('status=cancelled');
    const isPaidStatus = url.includes('status=paid');

    if (isCancelRoute) {
      setShowPayosModal(false);
      setPayosUrl(null);
      subscriptionSuccessRef.current = false;
      return false;
    }

    if (isPaidStatus) {
      if (!subscriptionSuccessRef.current) {
        subscriptionSuccessRef.current = true;
        Toast.show({ type: 'success', text1: 'Subscription activated' });
        loadCurrentSubscription();
        setShowPayosModal(false);
        setPayosUrl(null);
      }
      return false;
    }

    return true;
  }, [loadCurrentSubscription]);

  useEffect(() => {
    if (authLoading || subscriptionGateShown) {
      return;
    }

    const checkGate = async () => {
      try {
        const onboardingDone = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        if (onboardingDone !== 'true') {
          return;
        }

        const skipOnce = await AsyncStorage.getItem(SUBSCRIPTION_SKIP_ONCE_KEY);
        if (skipOnce === 'true') {
          await AsyncStorage.removeItem(SUBSCRIPTION_SKIP_ONCE_KEY);
          return;
        }

        setSubscriptionGateVisible(true);
        setSubscriptionGateShown(true);
      } catch {
        // Ignore storage errors.
      }
    };

    checkGate();
  }, [authLoading, subscriptionGateShown]);

  useEffect(() => {
    if (subscriptionGateVisible && subscriptionPackages.length === 0 && !subscriptionLoading) {
      loadSubscriptionPackages();
    }
  }, [loadSubscriptionPackages, subscriptionGateVisible, subscriptionLoading, subscriptionPackages.length]);

  useEffect(() => {
    if (subscriptionGateVisible && !subscriptionInfoLoading) {
      loadCurrentSubscription();
    }
  }, [loadCurrentSubscription, subscriptionGateVisible, subscriptionInfoLoading]);

  const fetchMenus = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!coffeeShopId) {
      setMenuItems([]);
      setMenuError(null);
      setMenuLoading(false);
      return;
    }

    setMenuLoading(true);
    setMenuError(null);
    try {
      const response = await authorizedFetch(
        `${AUTH_BASE_URL}/MenuHeader/by-shop/${coffeeShopId}`
      );
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const result = await response.json();
      const rawList: MenuHeaderApiItem[] = Array.isArray(result) ? result : [];

      let activeHeaderIds = new Set<number>();
      try {
        const activeResponse = await authorizedFetch(
          `${AUTH_BASE_URL}/Menu/active-by-shop/${coffeeShopId}`,
          {
            headers: { Accept: '*/*' },
          }
        );

        if (activeResponse.ok) {
          const activePayload = await activeResponse.json();
          const activeMenus = Array.isArray(activePayload)
            ? activePayload
            : Array.isArray(activePayload?.items)
              ? activePayload.items
              : activePayload
                ? [activePayload]
                : [];

          activeHeaderIds = new Set(
            activeMenus
              .map((menu: any) => Number(menu?.menuHeaderId ?? 0))
              .filter((id: number) => Number.isFinite(id) && id > 0)
          );
        }
      } catch {
        // Keep fallback using isApplied from MenuHeader if active endpoint fails.
      }

      const parseCreateDate = (value?: string) => {
        if (!value) return 0;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
      };

      const sortedList = [...rawList].sort((a, b) => {
        const aHeaderId = Number(a?.menuHeaderId ?? 0);
        const bHeaderId = Number(b?.menuHeaderId ?? 0);
        const aApplied = activeHeaderIds.size
          ? activeHeaderIds.has(aHeaderId)
          : Boolean(a?.isApplied ?? false);
        const bApplied = activeHeaderIds.size
          ? activeHeaderIds.has(bHeaderId)
          : Boolean(b?.isApplied ?? false);
        if (aApplied !== bApplied) {
          return aApplied ? -1 : 1;
        }
        return parseCreateDate(b.createDate) - parseCreateDate(a.createDate);
      });

      if (sortedList.length === 0) {
        setMenuItems([]);
        setMenuError(null);
        return;
      }

      const fetchVersionMeta = async (menuHeaderId?: number) => {
        if (!menuHeaderId) {
          return { count: 0, imageFromVersion: null as string | null };
        }

        try {
          const response = await authorizedFetch(
            `${AUTH_BASE_URL}/Menu/by-header/${menuHeaderId}`,
            { headers: { Accept: '*/*' } }
          );
          if (!response.ok) {
            return { count: 0, imageFromVersion: null as string | null };
          }

          const data = await response.json();
          const versions = Array.isArray(data) ? data : [];

          const versionWithRealImage = versions.find((version: any) =>
            isRealMenuImage(String(version?.image ?? version?.imageUrl ?? ''))
          );

          return {
            count: versions.length,
            imageFromVersion: versionWithRealImage
              ? String(versionWithRealImage?.image ?? versionWithRealImage?.imageUrl ?? '')
              : null,
          };
        } catch {
          return { count: 0, imageFromVersion: null as string | null };
        }
      };

      const versionMetas = await Promise.all(
        sortedList.map((item) => fetchVersionMeta(item.menuHeaderId))
      );

      const mapped = sortedList.map((item, index) => {
        const rawHeaderImage = String(item?.image ?? item?.imageUrl ?? '');
        const rawVersionImage = String(versionMetas[index]?.imageFromVersion ?? '');
        const selectedImage = isRealMenuImage(rawHeaderImage)
          ? rawHeaderImage
          : isRealMenuImage(rawVersionImage)
            ? rawVersionImage
            : rawHeaderImage;

        const imageUrl = resolveImageUrl(
          AUTH_BASE_URL,
          selectedImage
        );

        return {
          id: String(item?.menuHeaderId ?? index),
          name: String(item?.name ?? 'Unknown'),
          versions: Number(versionMetas[index]?.count ?? 0),
          image: imageUrl ? { uri: imageUrl } : { uri: fallbackMenuImage },
          isApplied: activeHeaderIds.size
            ? activeHeaderIds.has(Number(item?.menuHeaderId ?? 0))
            : Boolean(item?.isApplied ?? false),
          createDate: item?.createDate,
        } as MenuItem;
      });

      setMenuItems(mapped);
      console.log('[Menu List] menuItems (detailed):', JSON.stringify(mapped, null, 2));
    } catch (error) {
      setMenuError('Failed to load menu list');
    } finally {
      setMenuLoading(false);
    }
  }, [authLoading, coffeeShopId]);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const refreshIfNeeded = async () => {
        try {
          const shouldRefresh = await AsyncStorage.getItem(MENU_REFRESH_FLAG_KEY);
          const shouldRefreshBeverages = await AsyncStorage.getItem(BEVERAGE_REFRESH_FLAG_KEY);

          if (!isActive) {
            return;
          }

          if (shouldRefresh === '1') {
            await AsyncStorage.removeItem(MENU_REFRESH_FLAG_KEY);
            fetchMenus();
          }

          if (shouldRefreshBeverages === '1') {
            await AsyncStorage.removeItem(BEVERAGE_REFRESH_FLAG_KEY);
            await Promise.all([fetchBeverages(), fetchBeverageCount(), refreshCategories()]);
          }
        } catch {
          // Ignore storage errors to avoid blocking UI flow.
        }
      };

      refreshIfNeeded();

      return () => {
        isActive = false;
      };
    }, [fetchMenus])
  );

  const fetchBeverageCount = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!coffeeShopId) {
      setTotalBeverages(0);
      return;
    }

    try {
      const response = await authorizedFetch(`${AUTH_BASE_URL}/ShopBeverage/count`, {
        headers: {
          Accept: '*/*',
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const result = await response.json();
      const countValue = Number(
        typeof result === 'number'
          ? result
          : result?.totalBeverages ?? result?.count ?? result?.total ?? result?.data ?? 0
      );

      setTotalBeverages(Number.isFinite(countValue) ? countValue : 0);
    } catch (error) {
      setTotalBeverages(0);
    }
  }, [authLoading, coffeeShopId]);

  const fetchBeverages = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!coffeeShopId) {
      setBeverages([]);
      setBeveragesError(null);
      setBeveragesLoading(false);
      return;
    }

    setBeveragesLoading(true);
    setBeveragesError(null);
    try {
      const response = await authorizedFetch(`${AUTH_BASE_URL}/ShopBeverage/shop/${coffeeShopId}`);

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const result = await response.json();
      const rawList: BeverageApiItem[] = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.items)
            ? result.items
            : [];

      const parseCreateDate = (value?: string) => {
        if (!value) return 0;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
      };

      const sortedList = [...rawList].sort((a, b) =>
        parseCreateDate(
          b?.createDate ?? b?.createdAt ?? b?.createdDate ?? b?.createdOn ?? ''
        ) -
        parseCreateDate(
          a?.createDate ?? a?.createdAt ?? a?.createdDate ?? a?.createdOn ?? ''
        )
      );

      if (sortedList.length === 0) {
        setBeverages([]);
        setBeveragesError(null);
        setBeveragesLoading(false);
        return;
      }

      const mapped = sortedList.map((item, index) => {
        const rawImage = String(item?.image ?? item?.imageUrl ?? '');
        const imageUrl = resolveImageUrl(AUTH_BASE_URL, rawImage);
        return {
          id: String(item?.beverageId ?? item?.id ?? index),
          beverageId: Number(item?.beverageId ?? item?.id ?? 0),
          name: String(item?.name ?? item?.beverageName ?? 'Unknown'),
          flavor: String(item?.beverageCategory?.name ?? item?.flavor ?? item?.taste ?? 'Unknown'),
          time: String(item?.brewingTimeMinutes ?? item?.time ?? item?.prepTime ?? ''),
          image: imageUrl ? { uri: imageUrl } : { uri: fallbackBeverageImage },
          imageUrl: imageUrl ?? null,
          hasRealImage: hasRealBeverageImage(rawImage),
          createDate: String(
            item?.createDate ?? item?.createdAt ?? item?.createdDate ?? item?.createdOn ?? ''
          ),
        };
      });

      setBeverages(mapped);
      // console.log('Fetched Beverages:', mapped);
    } catch (error) {
      setBeveragesError('Failed to load beverages');
    } finally {
      setBeveragesLoading(false);
    }
  }, [authLoading, coffeeShopId]);

  useEffect(() => {
    fetchBeverages();
  }, [fetchBeverages]);

  useEffect(() => {
    fetchBeverageCount();
  }, [fetchBeverageCount]);

  const beveragePages = useMemo(
    () =>
      Array.from(
        { length: Math.ceil(beverages.length / BEVERAGE_PAGE_SIZE) },
        (_, index) => beverages.slice(index * BEVERAGE_PAGE_SIZE, (index + 1) * BEVERAGE_PAGE_SIZE)
      ),
    [beverages]
  );

  const beveragePagerData = useMemo(() => {
    if (beveragePages.length <= 1) {
      return beveragePages;
    }
    const firstPage = beveragePages[0];
    const lastPage = beveragePages[beveragePages.length - 1];
    return [lastPage, ...beveragePages, firstPage];
  }, [beveragePages]);

  const handleBeveragePagerScrollEnd = (event: any) => {
    if (beveragePages.length <= 1) {
      return;
    }

    const { contentOffset } = event.nativeEvent;
    const rawIndex = Math.round(contentOffset.x / BEVERAGE_PAGE_ITEM_WIDTH);

    if (!beveragePagerRef.current) {
      return;
    }

    if (rawIndex === 0) {
      setBeverageLooping(true);
      beveragePagerRef.current.scrollToIndex({
        index: beveragePages.length,
        animated: false,
      });
      setTimeout(() => setBeverageLooping(false), 120);
    } else if (rawIndex === beveragePages.length + 1) {
      setBeverageLooping(true);
      beveragePagerRef.current.scrollToIndex({
        index: 1,
        animated: false,
      });
      setTimeout(() => setBeverageLooping(false), 120);
    }
  };

  const formatMenuCreateDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    try {
      return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return date.toISOString();
    }
  };

  const headerName =
    String(
      profile?.shopName ??
      (profile as any)?.coffeeShopName ??
      (profile as any)?.storeName ??
      profile?.fullName ??
      profile?.name ??
      profile?.userName ??
      profile?.username ??
      'User'
    ).trim() || 'User';

  const isMenuEmptyState =
    menuItems.length === 0 &&
    (!menuError || menuError.toLowerCase().includes("doesn't have any menus yet"));
  const isBeverageEmptyState =
    beverages.length === 0 &&
    (!beveragesError || beveragesError.toLowerCase().includes("doesn't have any beverages yet"));

  const resetCreateForm = () => {
    setCreateName('');
    setCreateImageUrl('');
    setCreateCategoryName('');
    setCreateCategoryId(null);
    setCreateError(null);
  };

  const handleCategoryInputChange = (value: string) => {
    setCreateCategoryName(value);
    if (value.trim()) {
      setCreateCategoryId(null);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) {
      return;
    }

    try {
      setRefreshing(true);
      await Promise.all([
        fetchMenus(),
        fetchBeverages(),
        fetchBeverageCount(),
        refreshCategories(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const isBeverageSizeActive = (size: BeverageSize) => {
    const rawActive = (size as any)?.isActive ?? (size as any)?.active;
    const status = String((size as any)?.status ?? '').trim().toLowerCase();

    if (typeof rawActive === 'boolean') {
      return rawActive;
    }

    if (typeof rawActive === 'number') {
      return rawActive === 1;
    }

    if (typeof rawActive === 'string') {
      const normalized = rawActive.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'active') {
        return true;
      }
    }

    return status === 'active' || status === 'enabled';
  };

  const handleNewMenuPress = useCallback(async () => {
    if (checkingMenuGate) {
      return;
    }

    // Use loaded beverage list as the source of truth for guard validation.
    if (beverages.length < 5) {
      setShowMenuGuardModal(true);
      return;
    }

    if (!coffeeShopId) {
      setShowBeverageSizeGuideModal(true);
      return;
    }

    try {
      setCheckingMenuGate(true);
      const sizes = await beverageSizeService.getByShop(coffeeShopId);
      const hasActiveSize = sizes.some(isBeverageSizeActive);

      if (!hasActiveSize) {
        setShowBeverageSizeGuideModal(true);
        return;
      }

      router.push('/menu-recommendations');
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Cannot verify beverage size',
        text2: 'Please try again in a moment.',
      });
    } finally {
      setCheckingMenuGate(false);
    }
  }, [checkingMenuGate, beverages.length, coffeeShopId, router]);

  const handleCreateRecipeEntry = useCallback(
    async (target: '/ai-create' | '/create-recipe') => {
      if (checkingRecipeGate) {
        return;
      }

      if (!coffeeShopId) {
        setShowBeverageSizeGuideModal(true);
        return;
      }

      try {
        setCheckingRecipeGate(true);
        const sizes = await beverageSizeService.getByShop(coffeeShopId);
        const hasActiveSize = sizes.some(isBeverageSizeActive);

        if (!hasActiveSize) {
          setShowBeverageSizeGuideModal(true);
          return;
        }

        router.push(target);
      } catch {
        Toast.show({
          type: 'error',
          text1: 'Cannot verify beverage size',
          text2: 'Please try again in a moment.',
        });
      } finally {
        setCheckingRecipeGate(false);
      }
    },
    [checkingRecipeGate, coffeeShopId, router]
  );

  const handleSelectCategory = (category: BeverageCategory) => {
    const id = getCategoryId(category);
    if (id === null) {
      return;
    }
    if (createCategoryId === id) {
      setCreateCategoryId(null);
      return;
    }
    setCreateCategoryId(id);
    setCreateCategoryName('');
  };

  const getUploadFileInfo = (uri: string) => {
    const cleanUri = uri.split('?')[0];
    const namePart = cleanUri.split('/').pop() || `beverage_${Date.now()}`;
    const ext = namePart.includes('.') ? namePart.split('.').pop() : '';
    const lowerExt = String(ext).toLowerCase();
    const mimeType =
      lowerExt === 'jpg' || lowerExt === 'jpeg'
        ? 'image/jpeg'
        : lowerExt === 'png'
          ? 'image/png'
          : lowerExt === 'webp'
            ? 'image/webp'
            : 'image/jpeg';
    const fileName = namePart.includes('.') ? namePart : `${namePart}.jpg`;
    return { fileName, mimeType };
  };

  const handlePickAndUploadImage = async () => {
    if (createImageUploading) {
      return;
    }

    try {
      setCreateImageUploading(true);
      setCreateError(null);

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setCreateError('Please allow photo access to upload an image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      // Keep local URI for preview; actual upload happens after beverage is created and returns id.
      setCreateImageUrl(asset.uri);
    } catch (error) {
      setCreateError('Failed to pick image.');
    } finally {
      setCreateImageUploading(false);
    }
  };

  const handleUploadBeverageImage = async (beverage: BeverageItem) => {
    if (uploadingBeverageId) {
      return;
    }

    const beverageId = Number(beverage?.beverageId ?? beverage?.id ?? 0);
    if (!Number.isFinite(beverageId) || beverageId <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid beverage',
        text2: 'Cannot determine beverage id for image upload.',
      });
      return;
    }

    try {
      setUploadingBeverageId(String(beverageId));
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Toast.show({
          type: 'info',
          text1: 'Permission required',
          text2: 'Please allow photo access to upload beverage image.',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const { fileName, mimeType } = getUploadFileInfo(asset.uri);
      const formData = new FormData();
      formData.append('image', {
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      } as any);

      const response = await authorizedFetch(
        `${AUTH_BASE_URL}/ShopBeverage/upload-image?id=${beverageId}`,
        {
          method: 'POST',
          headers: {
            Accept: '*/*',
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const body = await response.text();
        console.log('[Upload Beverage Image] status:', response.status);
        console.log('[Upload Beverage Image] body:', body);
        throw new Error(`Request failed: ${response.status}`);
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Beverage image uploaded successfully.',
      });
      await fetchBeverages();
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Upload failed',
        text2: 'Unable to upload beverage image. Please try again.',
      });
    } finally {
      setUploadingBeverageId(null);
    }
  };

  const handleCreateBeverage = async () => {
    if (createSubmitting) {
      return;
    }

    const trimmedName = createName.trim();
    const trimmedCategory = createCategoryName.trim();
    const selectedImageUri = createImageUrl.trim();

    if (!trimmedName) {
      setCreateError('Please enter a beverage name.');
      return;
    }

    if (!createCategoryId && !trimmedCategory) {
      setCreateError('Please select or enter a beverage category.');
      return;
    }

    if (!selectedImageUri) {
      setCreateError('Please select an image before creating.');
      return;
    }

    if (!coffeeShopId) {
      setCreateError('Missing coffee shop id.');
      return;
    }

    try {
      setCreateSubmitting(true);
      setCreateError(null);

      const selectedCategory = beverageCategories.find(
        (category) => getCategoryId(category) === createCategoryId
      );
      const selectedCategoryName = selectedCategory ? getCategoryName(selectedCategory) : '';

      const response = await authorizedFetch(`${AUTH_BASE_URL}/ShopBeverage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          status: 'ACTIVE',
          coffeeShopId,
          beverageCategory: {
            beverageCategoryId: createCategoryId ?? 0,
            name: createCategoryId ? selectedCategoryName : trimmedCategory,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const created = await response.json();
      const createdBeverageId = Number(
        created?.beverageId ??
        created?.id ??
        created?.data?.beverageId ??
        created?.data?.id ??
        0
      );

      if (!Number.isFinite(createdBeverageId) || createdBeverageId <= 0) {
        throw new Error('Create succeeded but response does not contain beverage id.');
      }

      const { fileName, mimeType } = getUploadFileInfo(selectedImageUri);
      const formData = new FormData();
      formData.append('image', {
        uri: selectedImageUri,
        name: fileName,
        type: mimeType,
      } as any);

      const uploadResponse = await authorizedFetch(
        `${AUTH_BASE_URL}/ShopBeverage/upload-image?id=${createdBeverageId}`,
        {
          method: 'POST',
          headers: {
            Accept: '*/*',
          },
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        const uploadErrorBody = await uploadResponse.text();
        console.log('[Upload Beverage Image] status:', uploadResponse.status);
        console.log('[Upload Beverage Image] body:', uploadErrorBody);
        throw new Error(`Image upload failed: ${uploadResponse.status}`);
      }

      const uploaded = await uploadResponse.json();
      console.log('[Upload Beverage Image] response:', uploaded);
      const imageUrl = resolveImageUrl(
        AUTH_BASE_URL,
        String(
          uploaded?.url ??
          uploaded?.imageUrl ??
          uploaded?.data?.url ??
          uploaded?.data?.imageUrl ??
          created?.imageUrl ??
          created?.image ??
          ''
        )
      );

      const mapped: BeverageItem = {
        id: String(created?.beverageId ?? created?.id ?? Date.now()),
        name: String(created?.name ?? trimmedName),
        flavor: String(
          created?.beverageCategory?.name ??
          (createCategoryId ? selectedCategoryName : trimmedCategory)
        ),
        time: String(created?.brewingTimeMinutes ?? created?.time ?? created?.prepTime ?? ''),
        image: imageUrl ? { uri: imageUrl } : { uri: fallbackBeverageImage },
        createDate: String(created?.createDate ?? created?.createdAt ?? new Date().toISOString()),
      };

      setBeveragesError(null);
      setBeverages((prev) => [mapped, ...prev]);
      await AsyncStorage.setItem(BEVERAGE_REFRESH_FLAG_KEY, '1');
      await Promise.all([fetchBeverages(), fetchBeverageCount(), refreshCategories()]);
      resetCreateForm();
      setShowCreateModal(false);
    } catch (error) {
      setCreateError('Failed to create beverage.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Modal
        visible={subscriptionGateVisible}
        animationType="fade"
        onRequestClose={() => setSubscriptionGateVisible(false)}
      >
        <SafeAreaView style={styles.subscriptionOverlay} edges={['top']}>
          <ImageBackground
            source={SUBSCRIPTION_BG_IMAGE}
            style={styles.subscriptionOverlayImageWrapper}
            imageStyle={styles.subscriptionOverlayImage}
          >
            <View style={styles.subscriptionCard}>
              <Image
                source={SUBSCRIPTION_BG_IMAGE}
                style={styles.subscriptionLogo}
                resizeMode="contain"
              />
            <View style={styles.subscriptionHeader}>
              <View style={styles.subscriptionHeaderText}>
                <Text style={styles.subscriptionTitle}>Choose your subscription</Text>
                <Text style={styles.subscriptionSubtitle}>Pick a plan to unlock features.</Text>
              </View>
              <TouchableOpacity
                style={styles.subscriptionClose}
                onPress={() => setSubscriptionGateVisible(false)}
              >
                <Ionicons name="close" size={18} color={stylesVars.espresso} />
              </TouchableOpacity>
            </View>

            {subscriptionLoading ? (
              <ActivityIndicator size="small" color={stylesVars.espresso} />
            ) : subscriptionError ? (
              <Text style={styles.subscriptionError}>{subscriptionError}</Text>
            ) : (
              <ScrollView
                style={styles.subscriptionList}
                contentContainerStyle={styles.subscriptionListContent}
                showsVerticalScrollIndicator={false}
              >
                {subscriptionPackages.map((item) => {
                  const price = formatSubscriptionPrice(item.price);
                  const isTrial = isTrialSubscription(item);
                  const targetPrice = getNumericPrice(item.price) ?? 0;
                  const resolvedCurrentPackageId =
                    currentPackageId ?? getSubscriptionPackageIdFromSubscription(currentSubscription);
                  const currentPrice = resolvedCurrentPackageId
                    ? getNumericPrice(
                        subscriptionPackages.find(
                          (pkg) => getSubscriptionPackageId(pkg) === resolvedCurrentPackageId
                        )?.price
                      )
                    : null;
                  const activeNameRaw =
                    currentSubscription?.package?.name ??
                    currentSubscription?.subscriptionPackage?.name ??
                    currentSubscription?.packageName ??
                    currentSubscription?.name ??
                    null;
                  const activeName = activeNameRaw
                    ? String(activeNameRaw).toLowerCase().trim()
                    : null;
                  const itemName = String(item.name ?? item.tier ?? '').toLowerCase().trim();
                  const isCurrentById =
                    resolvedCurrentPackageId !== null &&
                    resolvedCurrentPackageId === getSubscriptionPackageId(item);
                  const isCurrentByName =
                    Boolean(activeName && itemName) && activeName === itemName;
                  const isCurrent = isCurrentById || isCurrentByName;
                  const isLowerOrEqual =
                    currentPrice !== null && targetPrice <= currentPrice;
                  const disableSubscribe = isCurrent || isLowerOrEqual;
                  return (
                    <View
                      key={String(getSubscriptionPackageId(item) ?? item.name)}
                      style={styles.subscriptionPackageCard}
                    >
                      {isCurrent ? (
                        <View style={styles.subscriptionActiveBadge}>
                          <Text style={styles.subscriptionActiveText}>Active</Text>
                        </View>
                      ) : null}
                      <Text style={styles.subscriptionPackageName}>
                        {item.name ?? 'Subscription'}
                      </Text>
                      {item.tier ? (
                        <Text style={styles.subscriptionPackageTier}>{item.tier}</Text>
                      ) : null}
                      {price ? (
                        <Text style={styles.subscriptionPackagePrice}>{price}</Text>
                      ) : null}
                      {item.description ? (
                        <Text style={styles.subscriptionPackageDesc}>{item.description}</Text>
                      ) : null}
                      {item.duration ? (
                        <Text style={styles.subscriptionPackageMeta}>
                          Duration: {item.duration}
                        </Text>
                      ) : null}
                      <TouchableOpacity
                        style={styles.subscriptionPackageAction}
                        onPress={() => handleSubscribePackage(item)}
                        disabled={subscribeSubmitting || disableSubscribe}
                      >
                        <Text style={styles.subscriptionPackageActionText}>
                          {subscribeSubmitting
                            ? 'Processing...'
                            : isCurrent
                              ? 'Activated'
                              : disableSubscribe
                                ? 'Not available'
                            : isTrial
                              ? 'Start Trial'
                              : 'Subscribe'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
            </View>
          </ImageBackground>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={showPayosModal}
        animationType="slide"
        onRequestClose={() => {
          setShowPayosModal(false);
          setPayosUrl(null);
        }}
      >
        <SafeAreaView style={styles.payosContainer} edges={['top']}>
          <View style={styles.payosHeader}>
            <Text style={styles.payosTitle}>PayOS Checkout</Text>
            <TouchableOpacity
              style={styles.payosClose}
              onPress={() => {
                setShowPayosModal(false);
                setPayosUrl(null);
              }}
            >
              <Ionicons name="close" size={18} color={stylesVars.espresso} />
            </TouchableOpacity>
          </View>
          {payosUrl ? (
            <WebView
              source={{ uri: payosUrl }}
              style={styles.payosWebview}
              onShouldStartLoadWithRequest={handlePayosShouldStart}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.spacerTop} />
        <View style={styles.header}>
          <View>
            <View style={styles.greetingRow}>
              <Ionicons name="sunny-outline" size={18} color={stylesVars.primary} />
              <Text style={styles.greetingText}>Good Morning</Text>
            </View>
            <Text style={styles.userName}>{headerName}</Text>
          </View>
          <TouchableOpacity style={styles.cartButton}>
            <Ionicons name="cart-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Menu List</Text>
            <TouchableOpacity onPress={handleNewMenuPress} disabled={checkingMenuGate}>
              <Text
                style={[
                  styles.sectionActionPrimary,
                  checkingMenuGate && styles.sectionActionPrimaryDisabled,
                ]}>
                {checkingMenuGate ? 'Checking...' : 'New Menu'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.menuList}>
            {menuLoading ? (
              <Text style={styles.menuStateText}>Loading...</Text>
            ) : isMenuEmptyState ? (
              <View style={styles.emptyStateCard}>
                <View style={styles.emptyStateIconWrap}>
                  <Ionicons name="restaurant-outline" size={36} color={stylesVars.muted} />
                </View>
                <Text style={styles.emptyStateTitle}>No menus yet</Text>
                <Text style={styles.emptyStateText}>Your shop doesn't have any menus yet.</Text>
              </View>
            ) : menuError ? (
              <Text style={styles.menuStateText}>{menuError}</Text>
            ) : (
              <FlatList
                horizontal
                pagingEnabled
                data={menuItems}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToAlignment="center"
                contentContainerStyle={styles.menuCarouselContent}
                renderItem={({ item }) => (
                  <View style={styles.menuCardWrapper}>
                    <View style={[styles.featureCard, item.isApplied && styles.featureCardApplied]}>
                      <View style={styles.featureImageWrapper}>
                        <Image source={item.image} style={styles.featureImage} />
                        <View style={styles.featureImageOverlay} />

                        <View style={styles.featureHeaderOverlay}>
                          <View style={styles.featureHeaderLeft}>
                            <Text numberOfLines={1} style={styles.featureTitleOverlay}>{item.name}</Text>
                            {!!item.createDate && (
                              <Text style={styles.featureSubtitleOverlay}>
                                Created: {formatMenuCreateDate(item.createDate)}
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity
                            style={styles.versionBadge}
                            onPress={() =>
                              router.push({
                                pathname: '/menu-version/[id]',
                                params: { id: item.id, name: item.name },
                              })
                            }
                          >
                            <Text style={styles.versionBadgeText}>{item.versions} versions</Text>
                          </TouchableOpacity>
                        </View>

                        {item.isApplied && (
                          <View style={styles.appliedBadgeOverlay}>
                            <Ionicons
                              name="checkmark-circle"
                              size={14}
                              color="#FFFFFF"
                            />
                            <Text style={styles.appliedTextOverlay}>ACTIVED</Text>
                          </View>
                        )}

                        <View style={styles.featureActionsOverlay}>
                          <TouchableOpacity
                            style={styles.featureActionButtonOverlay}
                            onPress={() =>
                              router.push({
                                pathname: '/menu-version/[id]',
                                params: { id: item.id, name: item.name },
                              })
                            }
                          >
                            <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                            <Text style={styles.featureActionTextOverlay}>Detail</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.featureActionButtonOverlay}
                            onPress={() =>
                              router.push({
                                pathname: '/feedback',
                                params: { menuName: item.name, menuId: item.id },
                              })
                            }
                          >
                            <Ionicons
                              name="bookmark-outline"
                              size={16}
                              color="#FFFFFF"
                            />
                            <Text style={styles.featureActionTextOverlay}>Rating</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Beverages</Text>
            <TouchableOpacity
              onPress={() => {
                resetCreateForm();
                refreshCategories();
                setShowCreateModal(true);
              }}
            >
              <Text style={styles.sectionActionPrimary}>New Beverage</Text>
            </TouchableOpacity>
          </View>

          {beveragesLoading && beverages.length === 0 ? (
            <View style={styles.beverageLoadingWrap}>
              <ActivityIndicator size="small" color={stylesVars.primary} />
              <Text style={styles.beverageLoadingText}>Loading...</Text>
            </View>
          ) : isBeverageEmptyState ? (
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyStateIconWrap}>
                <Ionicons name="cafe-outline" size={36} color={stylesVars.muted} />
              </View>
              <Text style={styles.emptyStateTitle}>No beverages yet</Text>
              <Text style={styles.emptyStateText}>Your shop doesn't have any beverages yet.</Text>
            </View>
          ) : beveragesError ? (
            <Text style={styles.beverageStateText}>{beveragesError}</Text>
          ) : (
            <View style={styles.beveragePagerWrap}>
              <FlatList
                ref={(ref) => {
                  beveragePagerRef.current = ref;
                }}
                horizontal
                data={beveragePagerData}
                keyExtractor={(_, index) => `beverage-page-${index}`}
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                decelerationRate="fast"
                snapToInterval={BEVERAGE_PAGE_ITEM_WIDTH}
                snapToAlignment="start"
                disableIntervalMomentum
                initialScrollIndex={beveragePages.length > 1 ? 1 : 0}
                getItemLayout={(_, index) => ({
                  length: BEVERAGE_PAGE_ITEM_WIDTH,
                  offset: BEVERAGE_PAGE_ITEM_WIDTH * index,
                  index,
                })}
                windowSize={3}
                removeClippedSubviews={false}
                updateCellsBatchingPeriod={30}
                contentContainerStyle={styles.beveragePager}
                onMomentumScrollEnd={handleBeveragePagerScrollEnd}
                renderItem={({ item: pageItems }) => (
                  <View style={styles.beveragePage}>
                    <View style={styles.beverageGrid}>
                      {pageItems.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.beverageCard}
                          onPress={() =>
                            router.push({
                              pathname: '/recipe-detail/[id]',
                              params: { id: item.id },
                            })
                          }
                        >
                          <View style={styles.beverageImageWrap}>
                            <Image source={item.image} style={styles.beverageImage} />
                            {!item.hasRealImage ? (
                              <TouchableOpacity
                                style={styles.beverageEditButton}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleUploadBeverageImage(item);
                                }}
                                disabled={uploadingBeverageId === item.id}
                              >
                                {uploadingBeverageId === item.id ? (
                                  <ActivityIndicator size="small" color={stylesVars.espresso} />
                                ) : (
                                  <Ionicons name="camera-outline" size={18} color={stylesVars.espresso} />
                                )}
                              </TouchableOpacity>
                            ) : null}
                          </View>
                          <View style={styles.beverageContent}>
                            <Text style={styles.beverageTitle}>{item.name}</Text>
                            <View style={styles.beverageMetaRow}>
                              <Ionicons name="cafe-outline" size={12} color={stylesVars.primary} />
                              <Text style={styles.beverageMetaText}>{item.flavor}</Text>
                              {item.time ? (
                                <>
                                  <Ionicons
                                    name="time-outline"
                                    size={12}
                                    color={stylesVars.primary}
                                    style={{ marginLeft: 8 }}
                                  />
                                  <Text style={styles.beverageMetaText}>
                                    {item.time}{String(item.time).includes('min') ? '' : ' min'}
                                  </Text>
                                </>
                              ) : null}
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              />
              {beverageLooping ? (
                <View style={styles.beverageLoopOverlay}>
                  <ActivityIndicator size="small" color={stylesVars.primary} />
                </View>
              ) : null}
            </View>
          )}
        </View>

      </ScrollView>

      <View style={styles.suggestionDock} pointerEvents="box-none">
        <View style={styles.suggestionCard}>
          <View style={styles.suggestionGlow} />
          <View style={styles.suggestionContent}>
            <View style={styles.suggestionHeader}>
              <View style={styles.suggestionIconWrap}>
                <MaterialIcons name="auto-awesome" size={18} color={stylesVars.primary} />
              </View>
              <Text style={styles.suggestionTitle}>Create Recipe</Text>
            </View>
            <View style={styles.suggestionButtons}>
              <TouchableOpacity
                style={[styles.aiButton, checkingRecipeGate && styles.suggestionActionDisabled]}
                onPress={() => handleCreateRecipeEntry('/ai-create')}
                disabled={checkingRecipeGate}
              >
                <Text style={styles.aiButtonText}>Create By AI</Text>
                {checkingRecipeGate ? (
                  <ActivityIndicator size="small" color={stylesVars.espresso} />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={stylesVars.espresso} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.manualButton, checkingRecipeGate && styles.suggestionActionDisabled]}
                onPress={() => handleCreateRecipeEntry('/create-recipe')}
                disabled={checkingRecipeGate}
              >
                <Text style={styles.manualButtonText}>Create Manually</Text>
                {checkingRecipeGate ? (
                  <ActivityIndicator size="small" color={stylesVars.espresso} />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={stylesVars.espresso} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <Modal
        visible={showBeverageSizeGuideModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBeverageSizeGuideModal(false)}
      >
        <View style={styles.sizeGuideOverlay}>
          <View style={styles.sizeGuideCard}>
            <View style={styles.sizeGuideIconWrap}>
              <Ionicons name="resize-outline" size={28} color={stylesVars.primary} />
            </View>
            <Text style={styles.sizeGuideTitle}>Setup Beverage Size First</Text>
            <Text style={styles.sizeGuideText}>
              You need at least 1 active beverage size before creating recipes.
            </Text>
            <Text style={styles.sizeGuideText}>
              Go to Profile tab to add or activate a beverage size.
            </Text>

            <View style={styles.sizeGuideActions}>
              <TouchableOpacity
                style={styles.sizeGuideSecondaryButton}
                onPress={() => setShowBeverageSizeGuideModal(false)}
              >
                <Text style={styles.sizeGuideSecondaryText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sizeGuidePrimaryButton}
                onPress={() => {
                  setShowBeverageSizeGuideModal(false);
                  router.push('/(tabs)/profile');
                }}
              >
                <Text style={styles.sizeGuidePrimaryText}>Go to Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMenuGuardModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenuGuardModal(false)}
      >
        <View style={styles.guardOverlay}>
          <View style={styles.guardCard}>
            <View style={styles.guardHeaderRow}>
              <TouchableOpacity
                style={styles.guardCloseButton}
                onPress={() => setShowMenuGuardModal(false)}
              >
                <Ionicons name="close" size={18} color={stylesVars.espresso} />
              </TouchableOpacity>
            </View>

            <View style={styles.guardHeaderCenter}>
              <View style={styles.guardIconWrap}>
                <Ionicons name="alert-circle" size={36} color={stylesVars.primary} />
              </View>
              <Text style={styles.guardTitle}>Oops!</Text>
              <Text style={styles.guardSubtitle}>
                You need at least 5 beverages to start creating a menu.
              </Text>
            </View>

            <View style={styles.guardSteps}>
              <View style={styles.guardStepRow}>
                <View style={styles.guardStepBadge}>
                  <Text style={styles.guardStepBadgeText}>1</Text>
                </View>
                <View style={styles.guardStepTextWrap}>
                  <Text style={styles.guardStepTitle}>Add beverages</Text>
                  <Text style={styles.guardStepText}>
                    Tap "Add" and fill in the beverage details.
                  </Text>
                </View>
              </View>

              <View style={styles.guardStepRow}>
                <View style={styles.guardStepBadge}>
                  <Text style={styles.guardStepBadgeText}>2</Text>
                </View>
                <View style={styles.guardStepTextWrap}>
                  <Text style={styles.guardStepTitle}>Create recipes</Text>
                  <Text style={styles.guardStepText}>
                    Use AI or build your own recipes quickly.
                  </Text>
                </View>
              </View>

              <View style={styles.guardStepRow}>
                <View style={styles.guardStepBadge}>
                  <Text style={styles.guardStepBadgeText}>3</Text>
                </View>
                <View style={styles.guardStepTextWrap}>
                  <Text style={styles.guardStepTitle}>Unlock menu</Text>
                  <Text style={styles.guardStepText}>
                    Reach 5 beverages to unlock menu creation.
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.guardPrimaryButton}
              onPress={() => {
                setShowMenuGuardModal(false);
                resetCreateForm();
                refreshCategories();
                setShowCreateModal(true);
              }}
            >
              <Ionicons name="add" size={16} color={stylesVars.espresso} />
              <Text style={styles.guardPrimaryButtonText}>Add Beverage</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Create Beverage</Text>
              {createError ? <Text style={styles.modalError}>{createError}</Text> : null}

              <Text style={styles.modalLabel}>Name</Text>
              <TextInput
                value={createName}
                onChangeText={setCreateName}
                placeholder="Beverage name"
                style={styles.modalInput}
                autoCapitalize="words"
              />

              <Text style={styles.modalLabel}>Category</Text>
              <Text style={styles.modalHint}>Select existing or create a new one.</Text>
              <View style={styles.categoryListCard}>
                {categoriesLoading ? (
                  <ActivityIndicator size="small" color={stylesVars.espresso} />
                ) : categoriesError ? (
                  <Text style={styles.modalError}>{categoriesError}</Text>
                ) : beverageCategories.length === 0 ? (
                  <Text style={styles.modalMuted}>No categories yet.</Text>
                ) : (
                  <ScrollView
                    style={styles.categoryScroll}
                    contentContainerStyle={styles.categoryScrollContent}
                    nestedScrollEnabled
                  >
                    {beverageCategories.map((category) => {
                      const id = getCategoryId(category);
                      const name = getCategoryName(category);
                      if (id === null) {
                        return null;
                      }
                      const isSelected = id === createCategoryId;
                      return (
                        <TouchableOpacity
                          key={`${id}-${name}`}
                          style={[
                            styles.categoryItem,
                            isSelected && styles.categoryItemSelected,
                          ]}
                          onPress={() => handleSelectCategory(category)}
                        >
                          <Text
                            style={[
                              styles.categoryItemText,
                              isSelected && styles.categoryItemTextSelected,
                            ]}
                          >
                            {name}
                          </Text>
                          {isSelected ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={16}
                              color={stylesVars.primary}
                            />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              {createCategoryId ? (
                <TouchableOpacity
                  style={styles.clearSelectionButton}
                  onPress={() => {
                    setCreateCategoryId(null);
                    setCreateCategoryName('');
                  }}
                >
                  <Text style={styles.clearSelectionText}>Clear selection to type</Text>
                </TouchableOpacity>
              ) : null}

              <TextInput
                value={createCategoryName}
                onChangeText={handleCategoryInputChange}
                placeholder={createCategoryId ? 'Clear selection to type' : 'New category name'}
                style={[
                  styles.modalInput,
                  createCategoryId ? styles.modalInputDisabled : null,
                ]}
                editable={!createCategoryId}
              />

              <Text style={styles.modalLabel}>Image</Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={handlePickAndUploadImage}
              >
                {createImageUploading ? (
                  <ActivityIndicator size="small" color={stylesVars.espresso} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={16} color={stylesVars.espresso} />
                    <Text style={styles.uploadButtonText}>
                      {createImageUrl ? 'Change image' : 'Select image'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {createImageUrl ? (
                <>
                  <Text style={styles.uploadHint}>Image selected (will upload after create)</Text>
                  <Image source={{ uri: createImageUrl }} style={styles.uploadPreview} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setCreateImageUrl('')}
                  >
                    <Ionicons name="trash-outline" size={14} color={stylesVars.espresso} />
                    <Text style={styles.removeImageText}>Remove image</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.uploadHint}>Image required</Text>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={() => setShowCreateModal(false)}
                >
                  <Text style={styles.modalSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  onPress={handleCreateBeverage}
                >
                  {createSubmitting ? (
                    <ActivityIndicator size="small" color={stylesVars.espresso} />
                  ) : (
                    <Text style={styles.modalPrimaryText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const stylesVars = {
  primary: '#D9A05B',
  espresso: '#3E2723',
  background: '#FDFBF7',
  muted: '#9C9388',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: stylesVars.background,
  },
  container: {
    paddingHorizontal: 24,
    paddingBottom: 320,
    backgroundColor: stylesVars.background,
  },
  spacerTop: {
    height: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  greetingText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: stylesVars.primary,
  },
  userName: {
    fontSize: 30,
    fontWeight: '700',
    color: stylesVars.espresso,
  },
  cartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: stylesVars.espresso,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: stylesVars.espresso,
  },
  sectionActionPrimary: {
    fontSize: 13,
    fontWeight: '600',
    color: stylesVars.primary,
  },
  sectionActionPrimaryDisabled: {
    opacity: 0.5,
  },
  menuList: {
    marginTop: 6,
    gap: 16,
  },
  menuStateText: {
    fontSize: 13,
    color: '#8B7355',
    paddingHorizontal: 4,
  },
  featureCard: {
    width: MENU_CARD_WIDTH,
    height: width * 0.72,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(217, 160, 91, 0.25)',
    backgroundColor: '#FFF9F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 3,
    overflow: 'hidden',
  },
  featureCardApplied: {
    borderColor: 'rgba(217, 160, 91, 0.85)',
    borderWidth: 2,
    shadowOpacity: 0.15,
  },
  menuCarouselContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  menuCardWrapper: {
    width: width - 24 * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  featureHeaderLeft: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: stylesVars.espresso,
    flex: 1,
    flexShrink: 1,
    marginRight: 12,
  },
  featureSubtitle: {
    marginTop: 4,
    fontSize: 11,
    color: stylesVars.muted,
  },
  featureMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  featureMetaText: {
    fontSize: 12,
    color: stylesVars.muted,
  },
  versionBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  versionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: stylesVars.primary,
  },
  featureImageWrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(62,39,35,0.06)',
  },
  featureImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  featureImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(25,16,14,0.24)',
  },
  featureHeaderOverlay: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  featureTitleOverlay: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  featureSubtitleOverlay: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  appliedBadgeOverlay: {
    position: 'absolute',
    top: 64,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(62,39,35,0.72)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  appliedTextOverlay: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  featureActionsOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    gap: 10,
  },
  featureActionButtonOverlay: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(35,25,23,0.45)',
  },
  featureActionTextOverlay: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  featureActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureActionButton: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFF',
  },
  featureActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: stylesVars.espresso,
  },
  appliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: stylesVars.primary,
  },
  appliedText: {
    fontSize: 11,
    color: stylesVars.primary,
    fontWeight: '600',
  },
  beverageStateText: {
    fontSize: 13,
    color: '#8B7355',
    paddingHorizontal: 4,
  },
  beverageLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  beverageLoadingText: {
    fontSize: 13,
    color: '#8B7355',
    fontWeight: '600',
  },
  emptyStateCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E9E1D7',
    backgroundColor: '#FCFCFC',
    paddingHorizontal: 24,
    paddingVertical: 30,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyStateIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#F2F0EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  emptyStateText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    color: '#6F6A63',
    paddingHorizontal: 8,
  },
  beveragePager: {
    paddingRight: 12,
  },
  beveragePagerWrap: {
    position: 'relative',
  },
  beverageLoopOverlay: {
    position: 'absolute',
    right: 12,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  beveragePage: {
    width: BEVERAGE_PAGE_WIDTH,
    marginRight: 16,
  },
  beverageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  beverageLoadingMore: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  beverageLoadingMorePage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  beverageCard: {
    width: (width - 24 * 2 - 16) / 2,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1F1F1',
    backgroundColor: '#FFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  beverageImageWrap: {
    position: 'relative',
    width: '100%',
    height: width * 0.35,
  },
  beverageImage: {
    width: '100%',
    height: '100%',
  },
  beverageEditButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  beverageContent: {
    padding: 14,
    gap: 6,
  },
  beverageTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: stylesVars.espresso,
  },
  beverageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  beverageMetaText: {
    fontSize: 12,
    color: stylesVars.primary,
    fontWeight: '600',
  },
  suggestionCard: {
    position: 'relative',
    padding: 24,
    borderRadius: 32,
    backgroundColor: stylesVars.espresso,
    overflow: 'hidden',
  },
  suggestionDock: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    zIndex: 30,
  },
  suggestionGlow: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(217,160,91,0.2)',
  },
  suggestionContent: {
    position: 'relative',
    gap: 14,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  suggestionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(217,160,91,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  suggestionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  aiButton: {
    flex: 1,
    backgroundColor: stylesVars.primary,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  aiButtonText: {
    color: stylesVars.espresso,
    fontSize: 13,
    fontWeight: '700',
  },
  manualButton: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: stylesVars.primary,
  },
  manualButtonText: {
    color: stylesVars.espresso,
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionActionDisabled: {
    opacity: 0.75,
  },
  sizeGuideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sizeGuideCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF8EE',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(217,160,91,0.35)',
    padding: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  sizeGuideIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: 'rgba(217,160,91,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },
  sizeGuideTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: stylesVars.espresso,
    textAlign: 'center',
  },
  sizeGuideText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B5E52',
    textAlign: 'center',
  },
  sizeGuideActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  sizeGuideSecondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3D8CC',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
  },
  sizeGuideSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B5E52',
  },
  sizeGuidePrimaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: stylesVars.primary,
    paddingVertical: 12,
  },
  sizeGuidePrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: stylesVars.espresso,
  },
  guardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  guardCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF8EE',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(217,160,91,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  guardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 6,
  },
  guardHeaderCenter: {
    alignItems: 'center',
    marginBottom: 16,
  },
  guardIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: 'rgba(217,160,91,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  guardCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(62,39,35,0.08)',
  },
  guardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: stylesVars.espresso,
    marginBottom: 6,
    textAlign: 'center',
  },
  guardSubtitle: {
    fontSize: 14,
    color: '#6B5E52',
    marginBottom: 4,
    textAlign: 'center',
  },
  guardSteps: {
    gap: 12,
    marginBottom: 18,
  },
  guardStepRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  guardStepBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: stylesVars.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardStepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: stylesVars.espresso,
  },
  guardStepTextWrap: {
    flex: 1,
  },
  guardStepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: stylesVars.espresso,
    marginBottom: 2,
  },
  guardStepText: {
    fontSize: 12,
    color: '#6B5E52',
    lineHeight: 16,
  },
  guardPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: stylesVars.primary,
  },
  guardPrimaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: stylesVars.espresso,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalScroll: {
    width: '100%',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    backgroundColor: '#FFF',
    padding: 20,
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: stylesVars.espresso,
  },
  modalError: {
    fontSize: 12,
    color: '#B45309',
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B5E52',
  },
  modalHint: {
    fontSize: 12,
    color: '#8B7355',
  },
  modalMuted: {
    fontSize: 12,
    color: '#8B7355',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E7E2DC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: stylesVars.espresso,
    backgroundColor: '#FFFDF9',
  },
  modalInputDisabled: {
    backgroundColor: '#F4EEE7',
    color: '#A39A90',
  },
  categoryListCard: {
    borderWidth: 1,
    borderColor: '#E7E2DC',
    borderRadius: 12,
    padding: 8,
    backgroundColor: '#FFFDF9',
  },
  categoryScroll: {
    maxHeight: 140,
  },
  categoryScrollContent: {
    gap: 6,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EFE7DF',
  },
  categoryItemSelected: {
    borderColor: stylesVars.primary,
    backgroundColor: '#FFF4E6',
  },
  categoryItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: stylesVars.espresso,
  },
  categoryItemTextSelected: {
    color: stylesVars.espresso,
  },
  clearSelectionButton: {
    alignSelf: 'flex-start',
  },
  clearSelectionText: {
    fontSize: 12,
    fontWeight: '600',
    color: stylesVars.primary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  modalSecondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7E2DC',
  },
  modalSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: stylesVars.espresso,
  },
  modalPrimaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: stylesVars.primary,
    minWidth: 90,
    alignItems: 'center',
  },
  modalPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: stylesVars.espresso,
  },
  uploadButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7E2DC',
    backgroundColor: '#FFF',
  },
  uploadButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: stylesVars.espresso,
  },
  uploadHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B7355',
  },
  uploadPreview: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    marginTop: 6,
    backgroundColor: '#F4EEE7',
  },
  removeImageButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7E2DC',
    backgroundColor: '#FFF',
  },
  removeImageText: {
    fontSize: 12,
    fontWeight: '600',
    color: stylesVars.espresso,
  },
  subscriptionOverlay: {
    flex: 1,
    backgroundColor: stylesVars.background,
  },
  subscriptionOverlayImageWrapper: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  subscriptionOverlayImage: {
    opacity: 0.18,
  },
  subscriptionCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 26,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    minHeight: 520,
  },
  subscriptionLogo: {
    width: 90,
    height: 90,
    alignSelf: 'center',
    marginBottom: 12,
  },
  subscriptionHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  subscriptionHeaderText: {
    alignItems: 'center',
  },
  subscriptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: stylesVars.espresso,
    textAlign: 'center',
  },
  subscriptionSubtitle: {
    fontSize: 12,
    color: stylesVars.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  subscriptionClose: {
    position: 'absolute',
    top: -100,
    right: -6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1E7D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionList: {
    maxHeight: 260,
  },
  subscriptionListContent: {
    gap: 12,
    paddingBottom: 8,
  },
  subscriptionPackageCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(62,39,35,0.15)',
    backgroundColor: '#FFF',
  },
  subscriptionActiveBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(62,39,35,0.12)',
    marginBottom: 8,
  },
  subscriptionActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: stylesVars.espresso,
  },
  subscriptionPackageName: {
    fontSize: 14,
    fontWeight: '700',
    color: stylesVars.espresso,
  },
  subscriptionPackageTier: {
    fontSize: 12,
    color: stylesVars.muted,
    marginTop: 4,
  },
  subscriptionPackagePrice: {
    fontSize: 13,
    fontWeight: '600',
    color: stylesVars.primary,
    marginTop: 6,
  },
  subscriptionPackageDesc: {
    fontSize: 12,
    color: stylesVars.espresso,
    marginTop: 6,
  },
  subscriptionPackageMeta: {
    fontSize: 11,
    color: stylesVars.muted,
    marginTop: 6,
  },
  subscriptionPackageAction: {
    marginTop: 10,
    backgroundColor: stylesVars.espresso,
    borderRadius: 18,
    paddingVertical: 10,
    alignItems: 'center',
  },
  subscriptionPackageActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  subscriptionError: {
    fontSize: 12,
    color: '#B22222',
    textAlign: 'center',
  },
  payosContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  payosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E0DA',
  },
  payosTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: stylesVars.espresso,
  },
  payosClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1E7D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payosWebview: {
    flex: 1,
  },
});