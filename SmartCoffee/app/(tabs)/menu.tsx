import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';
import { BeverageCategory, useBeverageCategories } from '@/context/beverage-category-context';

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
  name: string;
  flavor: string;
  time: string;
  image: any;
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

const { width, height: windowHeight } = Dimensions.get('window');
const MENU_CARD_WIDTH = width - 48;
const BEVERAGE_PAGE_SIZE = 4;
const BEVERAGE_PAGE_WIDTH = width - 48;
const BEVERAGE_PAGE_GUTTER = 16;
const BEVERAGE_PAGE_ITEM_WIDTH = BEVERAGE_PAGE_WIDTH + BEVERAGE_PAGE_GUTTER;

const fallbackMenuImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAFdyVWmZyLBb3sGqVwjvNvxlcOXbB0Jw3NruLr76o5AWV5DnSRs2lZk-_efuzou3kn_LrScey1Wvc8PZzMxgj5gd91FXT-OMRu-KDU7M2mvsL21c9xdgBEpTOcel8JY5_xr42Trfr5CVVXx2G4ecoWnPsSNhqwo_JLo4tvueDeNm_BkMBYA8IXw4hDhwHePqDa5WtgASS4Sl2zzdVGmfZ5g4yNA_l60wPl8CirNcN-4mo_uanAPD1ZScVsTTbrc2V3_Jm5twRLvfU';
const fallbackBeverageImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDi2pH2xhE5BLMCq_TuPpKBFANKhFyh48O4wiW8NGw1EuuneDDEeHWIY3vvcrA6MGIgTFsYioOnnwHafNX4-r8GvHt6HJnyhYFp6JK3ZQoKyrQyjkP7_jdqFpJcC9Xrq4qdYM-rxaNDRb1jdHLLmiP4uFrM2ULZDI5Ovf5ErxjaVQhQmi855Kzd1Tg1tjFgEd8hBPCPlLx2baLBWS9fNM-1TRGGLrsyD9duBhOqgR_KvuwjIdAQ-3RwRPXqm-8v-rl8_ivNkEzIp5s';

const resolveImageUrl = (baseUrl: string, image?: string) => {
  if (!image) return null;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('/')) return `${baseUrl}${image}`;
  return `${baseUrl}/images/${image}`;
};

export default function MenuScreen() {
  const router = useRouter();
  const { coffeeShopId, loading: authLoading, profile } = useAuth();
  const {
    categories: beverageCategories,
    loading: categoriesLoading,
    error: categoriesError,
    refresh: refreshCategories,
    getCategoryId,
    getCategoryName,
  } = useBeverageCategories();
  const [selectedCategory, setSelectedCategory] = useState('Summer Refresh');
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
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [suggestionLayoutY, setSuggestionLayoutY] = useState<number | null>(null);
  const beveragePagerRef = useRef<FlatList<BeverageItem[]> | null>(null);
  const [beverageLooping, setBeverageLooping] = useState(false);

  const categories = ['Summer Refresh', 'Winter Warmers', 'New Menu'];

  const fetchMenus = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!coffeeShopId) {
      setMenuItems([]);
      setMenuError("Your shop doesn't have any menus yet.");
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

      const parseCreateDate = (value?: string) => {
        if (!value) return 0;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
      };

      const sortedList = [...rawList].sort(
        (a, b) => parseCreateDate(b.createDate) - parseCreateDate(a.createDate)
      );

      if (sortedList.length === 0) {
        setMenuItems([]);
        setMenuError("Your shop doesn't have any menus yet.");
        return;
      }

      const mapped = sortedList.map((item, index) => {
        const imageUrl = resolveImageUrl(
          AUTH_BASE_URL,
          String(item?.image ?? item?.imageUrl ?? '')
        );
        return {
          id: String(item?.menuHeaderId ?? index),
          name: String(item?.name ?? 'Unknown'),
          versions: Number(0),
          image: imageUrl ? { uri: imageUrl } : { uri: fallbackMenuImage },
          isApplied: Boolean(item?.isApplied ?? false),
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
      setBeveragesError("Your shop doesn't have any beverages yet.");
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
        setBeveragesError("Your shop doesn't have any beverages yet.");
        setBeveragesLoading(false);
        return;
      }

      const mapped = sortedList.map((item, index) => {
        const imageUrl = resolveImageUrl(AUTH_BASE_URL, String(item?.image ?? item?.imageUrl ?? ''));
        return {
          id: String(item?.beverageId ?? item?.id ?? index),
          name: String(item?.name ?? item?.beverageName ?? 'Unknown'),
          flavor: String(item?.beverageCategory?.name ?? item?.flavor ?? item?.taste ?? 'Unknown'),
          time: String(item?.brewingTimeMinutes ?? item?.time ?? item?.prepTime ?? ''),
          image: imageUrl ? { uri: imageUrl } : { uri: fallbackBeverageImage },
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

  const effectiveViewportHeight = viewportHeight || windowHeight;
  const shouldShowSuggestionFab = suggestionLayoutY !== null;

  const handleScrollToSuggestion = () => {
    if (!scrollViewRef.current || suggestionLayoutY === null) {
      return;
    }

    const targetY = Math.max(suggestionLayoutY - 16, 0);
    scrollViewRef.current.scrollTo({ y: targetY, animated: true });
  };

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

  const handleNewMenuPress = () => {
    if (totalBeverages >= 5) {
      router.push('/menu-recommendations');
      return;
    }

    setShowMenuGuardModal(true);
  };

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
      const { fileName, mimeType } = getUploadFileInfo(asset.uri);
      const formData = new FormData();
      formData.append('image', {
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      } as any);

      const response = await authorizedFetch(`${AUTH_BASE_URL}/ShopBeverage/upload-image`, {
        method: 'POST',
        headers: {
          Accept: '*/*',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.log('[Upload Image] status:', response.status);
        console.log('[Upload Image] body:', errorBody);
        throw new Error(`Request failed: ${response.status}`);
      }

      const uploaded = await response.json();
      console.log('[Upload Image] response:', uploaded);
      const uploadedUrl = String(
        uploaded?.url ??
        uploaded?.imageUrl ??
        uploaded?.data?.url ??
        uploaded?.data?.imageUrl ??
        ''
      ).trim();
      if (!uploadedUrl) {
        throw new Error('Missing upload url');
      }

      setCreateImageUrl(uploadedUrl);
    } catch (error) {
      setCreateError('Failed to upload image.');
    } finally {
      setCreateImageUploading(false);
    }
  };

  const handleCreateBeverage = async () => {
    if (createSubmitting) {
      return;
    }

    const trimmedName = createName.trim();
    const trimmedCategory = createCategoryName.trim();
    const trimmedImage = createImageUrl.trim();

    if (!trimmedName) {
      setCreateError('Please enter a beverage name.');
      return;
    }

    if (!createCategoryId && !trimmedCategory) {
      setCreateError('Please select or enter a beverage category.');
      return;
    }

    if (!trimmedImage) {
      setCreateError('Please upload an image before creating.');
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
          image: trimmedImage,
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
      const imageUrl = resolveImageUrl(
        AUTH_BASE_URL,
        String(created?.imageUrl ?? created?.image ?? '')
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

      setBeverages((prev) => [mapped, ...prev]);
      await fetchBeverageCount();
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
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        onScroll={(event) => setScrollY(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
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
            <TouchableOpacity onPress={handleNewMenuPress}>
              <Text style={styles.sectionActionPrimary}>New Menu</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.menuTabs}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.menuChip,
                  selectedCategory === category && styles.menuChipActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.menuChipText,
                    selectedCategory === category && styles.menuChipActiveText,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.menuList}>
            {menuLoading ? (
              <Text style={styles.menuStateText}>Loading...</Text>
            ) : menuError ? (
              <Text style={styles.menuStateText}>{menuError}</Text>
            ) : menuItems.length === 0 ? (
              <Text style={styles.menuStateText}>No menu found</Text>
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
                    <View style={styles.featureCard}>
                      <View style={styles.featureHeader}>
                        <View style={styles.featureHeaderLeft}>
                          <Text style={styles.featureTitle}>{item.name}</Text>
                          {!!item.createDate && (
                            <Text style={styles.featureSubtitle}>
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
                      <View style={styles.featureImageWrapper}>
                        <Image source={item.image} style={styles.featureImage} />
                      </View>
                      <View style={styles.featureActions}>
                        {item.isApplied && (
                          <View style={styles.appliedBadge}>
                            <Ionicons
                              name="checkmark-circle"
                              size={14}
                              color={stylesVars.primary}
                            />
                            <Text style={styles.appliedText}>Applied</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.featureActionButton}
                          onPress={() =>
                            router.push({
                              pathname: '/menu-version/[id]',
                              params: { id: item.id, name: item.name },
                            })
                          }
                        >
                          <Ionicons name="create-outline" size={16} color={stylesVars.espresso} />
                          <Text style={styles.featureActionText}>Detail</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.featureActionButton}>
                          <Ionicons
                            name="bookmark-outline"
                            size={16}
                            color={stylesVars.espresso}
                          />
                          <Text style={styles.featureActionText}>Rating</Text>
                        </TouchableOpacity>
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
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Your Beverages</Text>
              <Text style={styles.sectionActionMuted}>Swipe to see more</Text>
            </View>
          </View>

          <View style={styles.sectionHeaderActionRow}>
            <TouchableOpacity
              style={styles.addBeverageButton}
              onPress={() => {
                resetCreateForm();
                refreshCategories();
                setShowCreateModal(true);
              }}
            >
              <Ionicons name="add" size={16} color={stylesVars.espresso} />
              <Text style={styles.addBeverageText}>Add</Text>
            </TouchableOpacity>
          </View>

          {beveragesLoading && beverages.length === 0 ? (
            <View style={styles.beverageLoadingWrap}>
              <ActivityIndicator size="small" color={stylesVars.primary} />
              <Text style={styles.beverageLoadingText}>Loading...</Text>
            </View>
          ) : beveragesError ? (
            <Text style={styles.beverageStateText}>{beveragesError}</Text>
          ) : beverages.length === 0 ? (
            <Text style={styles.beverageStateText}>No beverages found</Text>
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
                          onPress={() => router.push(`/recipe-detail/${item.id}`)}
                        >
                          <View style={styles.beverageImageWrap}>
                            <Image source={item.image} style={styles.beverageImage} />
                            <TouchableOpacity
                              style={styles.beverageEditButton}
                              onPress={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <Ionicons name="create-outline" size={18} color={stylesVars.espresso} />
                            </TouchableOpacity>
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

        <View
          style={styles.suggestionCard}
          onLayout={(event) => setSuggestionLayoutY(event.nativeEvent.layout.y)}
        >
          <View style={styles.suggestionGlow} />
          <View style={styles.suggestionContent}>
            <View style={styles.suggestionHeader}>
              <View style={styles.suggestionIconWrap}>
                <MaterialIcons name="auto-awesome" size={18} color={stylesVars.primary} />
              </View>
              <Text style={styles.suggestionTitle}>Suggestion:</Text>
            </View>
            <Text style={styles.suggestionText}>
              Create a recipe based on flavor, style, and cost preferences.
            </Text>
            <View style={styles.suggestionButtons}>
              <TouchableOpacity style={styles.aiButton} onPress={() => router.push('/ai-create')}>
                <Text style={styles.aiButtonText}>Create By AI</Text>
                <Ionicons name="chevron-forward" size={16} color={stylesVars.espresso} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.manualButton}
                onPress={() => router.push('/create-recipe')}
              >
                <Text style={styles.manualButtonText}>Create Manually</Text>
                <Ionicons name="chevron-forward" size={16} color={stylesVars.espresso} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {shouldShowSuggestionFab ? (
        <TouchableOpacity
          style={styles.suggestionFab}
          onPress={handleScrollToSuggestion}
          activeOpacity={0.9}
        >
          <MaterialIcons name="auto-awesome" size={20} color={stylesVars.espresso} />
        </TouchableOpacity>
      ) : null}

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
                      {createImageUrl ? 'Change image' : 'Upload image'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {createImageUrl ? (
                <>
                  <Text style={styles.uploadHint}>Image uploaded</Text>
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
    paddingBottom: 120,
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
  sectionHeaderActionRow: {
    alignItems: 'flex-end',
    marginTop: -8,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flex: 1,
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
  sectionActionMuted: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A8A29E',
  },
  addBeverageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F1E7D8',
  },
  addBeverageText: {
    fontSize: 12,
    fontWeight: '700',
    color: stylesVars.espresso,
  },
  menuTabs: {
    gap: 12,
    paddingRight: 12,
  },
  menuChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: '#ECECEC',
  },
  menuChipActive: {
    backgroundColor: stylesVars.espresso,
  },
  menuChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A8A8A',
  },
  menuChipActiveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FDFBF7',
  },
  menuList: {
    marginTop: 20,
    gap: 16,
  },
  menuStateText: {
    fontSize: 13,
    color: '#8B7355',
    paddingHorizontal: 4,
  },
  featureCard: {
    width: MENU_CARD_WIDTH,
    padding: 20,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(217, 160, 91, 0.25)',
    backgroundColor: '#FFF9F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 3,
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
    backgroundColor: 'rgba(217,160,91,0.15)',
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
    height: width * 0.45,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(62,39,35,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(62,39,35,0.06)',
    marginBottom: 16,
  },
  featureImage: {
    width: '100%',
    height: '100%',
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
  beverageLoadingText: {
    fontSize: 12,
    color: '#8B7355',
    fontWeight: '600',
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
    marginBottom: 20,
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
  suggestionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
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
  suggestionFab: {
    position: 'absolute',
    right: 18,
    bottom: 50,
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: stylesVars.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
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
});