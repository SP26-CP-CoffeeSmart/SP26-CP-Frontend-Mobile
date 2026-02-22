import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';

interface MenuItem {
  id: string;
  name: string;
  author: string;
  versions: number;
  image: any;
  isApplied?: boolean;
}

interface BeverageItem {
  id: string;
  name: string;
  flavor: string;
  time: string;
  image: any;
}

type BeverageApiItem = Record<string, any>;

const { width } = Dimensions.get('window');
const BEVERAGE_PAGE_SIZE = 4;

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
  const [selectedCategory, setSelectedCategory] = useState('Summer Refresh');
  const [beverages, setBeverages] = useState<BeverageItem[]>([]);
  const [beveragesLoading, setBeveragesLoading] = useState(false);
  const [beveragesLoadingMore, setBeveragesLoadingMore] = useState(false);
  const [beveragesError, setBeveragesError] = useState<string | null>(null);
  const [beveragePage, setBeveragePage] = useState(1);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createImageUrl, setCreateImageUrl] = useState('');
  const [createCategoryName, setCreateCategoryName] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const categories = ['Summer Refresh', 'Winter Warmers', 'New Menu'];

  useEffect(() => {
    let isMounted = true;
    const fetchMenus = async () => {
      if (authLoading) {
        return;
      }

      if (!coffeeShopId) {
        if (isMounted) {
          setMenuItems([]);
          setMenuError('Missing coffee shop id.');
          setMenuLoading(false);
        }
        return;
      }

      setMenuLoading(true);
      setMenuError(null);
      try {
        const response = await authorizedFetch(
          `${AUTH_BASE_URL}/Menu/by-shop/${coffeeShopId}`
        );
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

        if (rawList.length === 0) {
          if (isMounted) {
            setMenuItems([]);
            setMenuError('No menu found for this shop.');
          }
          return;
        }

        const mapped = rawList.map((item, index) => {
          const imageUrl = resolveImageUrl(
            AUTH_BASE_URL,
            String(item?.image ?? item?.imageUrl ?? item?.thumbnail ?? '')
          );
          return {
            id: String(item?.menuId ?? item?.id ?? index),
            name: String(item?.name ?? item?.menuName ?? 'Unknown'),
            author: String(item?.author ?? item?.createdBy ?? item?.ownerName ?? 'Unknown'),
            versions: Number(item?.versions ?? item?.versionCount ?? item?.itemsCount ?? 0),
            image: imageUrl ? { uri: imageUrl } : { uri: fallbackMenuImage },
            isApplied: Boolean(item?.isApplied ?? item?.applied ?? false),
          } as MenuItem;
        });

        if (isMounted) {
          setMenuItems(mapped);
          console.log('[Menu List] menuItems (detailed):', JSON.stringify(mapped, null, 2));
        }
      } catch (error) {
        if (isMounted) {
          setMenuError('Failed to load menu list');
        }
      } finally {
        if (isMounted) {
          setMenuLoading(false);
        }
      }
    };

    fetchMenus();
    return () => {
      isMounted = false;
    };
  }, [authLoading, coffeeShopId]);

  useEffect(() => {
    let isMounted = true;
    const fetchBeverages = async () => {
      if (authLoading) {
        return;
      }

      if (!coffeeShopId) {
        if (isMounted) {
          setBeverages([]);
          setBeveragesError('Missing coffee shop id.');
          setBeveragesLoading(false);
        }
        return;
      }

      setBeveragesLoading(true);
      setBeveragesError(null);
      try {
        const response = await authorizedFetch(`${AUTH_BASE_URL}/ShopBeverage/shop/${coffeeShopId}`);
        console.log('Fetching beverages from:', `${AUTH_BASE_URL}/ShopBeverage/shop/${coffeeShopId}`);
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

        const mapped = rawList.map((item, index) => {
          const imageUrl = resolveImageUrl(AUTH_BASE_URL, String(item?.image ?? item?.imageUrl ?? ''));
          return {
            id: String(item?.beverageId ?? item?.id ?? index),
            name: String(item?.name ?? item?.beverageName ?? 'Unknown'),
            flavor: String(item?.beverageCategory?.name ?? item?.flavor ?? item?.taste ?? 'Unknown'),
            time: String(item?.brewingTimeMinutes ?? item?.time ?? item?.prepTime ?? ''),
            image: imageUrl ? { uri: imageUrl } : { uri: fallbackBeverageImage },
          };
        });

        if (isMounted) {
          setBeverages(mapped);
          setBeveragePage(1);
          setBeveragesLoadingMore(false);
          console.log('Fetched Beverages:', mapped);
        }
      } catch (error) {
        if (isMounted) {
          setBeveragesError('Failed to load beverages');
        }
      } finally {
        if (isMounted) {
          setBeveragesLoading(false);
        }
      }
    };

    fetchBeverages();
    return () => {
      isMounted = false;
    };
  }, [authLoading, coffeeShopId]);

  const totalBeveragePages = Math.ceil(beverages.length / BEVERAGE_PAGE_SIZE);
  const visibleBeveragePages = Math.min(beveragePage, totalBeveragePages);
  const beveragePages = Array.from({ length: visibleBeveragePages }, (_, index) =>
    beverages.slice(index * BEVERAGE_PAGE_SIZE, (index + 1) * BEVERAGE_PAGE_SIZE)
  );
  const beveragePagerData = beveragesLoadingMore
    ? [...beveragePages, null]
    : beveragePages;

  const handleLoadMoreBeverages = () => {
    if (beveragesLoading || beveragesLoadingMore) return;
    if (beveragePage >= totalBeveragePages) return;

    setBeveragesLoadingMore(true);
    setTimeout(() => {
      setBeveragePage((prev) => Math.min(prev + 1, totalBeveragePages));
      setBeveragesLoadingMore(false);
    }, 900);
  };

  const handleBeveragePagerScrollEnd = (event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const reachedEnd = contentOffset.x + layoutMeasurement.width >= contentSize.width - 40;
    if (reachedEnd) {
      handleLoadMoreBeverages();
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

  const resetCreateForm = () => {
    setCreateName('');
    setCreateImageUrl('');
    setCreateCategoryName('');
    setCreateError(null);
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

    if (!trimmedCategory) {
      setCreateError('Please enter a beverage category.');
      return;
    }

    if (!coffeeShopId) {
      setCreateError('Missing coffee shop id.');
      return;
    }

    try {
      setCreateSubmitting(true);
      setCreateError(null);

      const response = await authorizedFetch(`${AUTH_BASE_URL}/ShopBeverage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          status: 'ACTIVE',
          coffeeShopId,
          image: trimmedImage || null,
          beverageCategory: {
            beverageCategoryId: 0,
            name: trimmedCategory,
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
        flavor: String(created?.beverageCategory?.name ?? trimmedCategory),
        time: String(created?.brewingTimeMinutes ?? created?.time ?? created?.prepTime ?? ''),
        image: imageUrl ? { uri: imageUrl } : { uri: fallbackBeverageImage },
      };

      setBeverages((prev) => [mapped, ...prev]);
      setBeveragePage(1);
      setBeveragesLoadingMore(false);
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
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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
            <TouchableOpacity onPress={() => router.push('/menu-recommendations')}>
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
              menuItems.map((item) => (
                <View key={item.id} style={styles.featureCard}>
                  <View style={styles.featureHeader}>
                    <View>
                      <Text style={styles.featureTitle}>{item.name}</Text>
                      <View style={styles.featureMetaRow}>
                        <Ionicons name="person-circle-outline" size={16} color={stylesVars.muted} />
                        <Text style={styles.featureMetaText}>{item.author}</Text>
                      </View>
                    </View>
                    <View style={styles.versionBadge}>
                      <Text style={styles.versionBadgeText}>{item.versions} versions</Text>
                    </View>
                  </View>
                  <View style={styles.featureImageWrapper}>
                    <Image source={item.image} style={styles.featureImage} />
                  </View>
                  <View style={styles.featureActions}>
                    {item.isApplied && (
                      <View style={styles.appliedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={stylesVars.primary} />
                        <Text style={styles.appliedText}>Applied</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.featureActionButton}>
                      <Ionicons name="create-outline" size={16} color={stylesVars.espresso} />
                      <Text style={styles.featureActionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.featureActionButton}>
                      <Ionicons name="bookmark-outline" size={16} color={stylesVars.espresso} />
                      <Text style={styles.featureActionText}>Rating</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
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
                setShowCreateModal(true);
              }}
            >
              <Ionicons name="add" size={16} color={stylesVars.espresso} />
              <Text style={styles.addBeverageText}>Add</Text>
            </TouchableOpacity>
          </View>

          {beveragesLoading ? (
            <Text style={styles.beverageStateText}>Loading...</Text>
          ) : beveragesError ? (
            <Text style={styles.beverageStateText}>{beveragesError}</Text>
          ) : beverages.length === 0 ? (
            <Text style={styles.beverageStateText}>No beverages found</Text>
          ) : (
            <FlatList
              horizontal
              data={beveragePagerData}
              keyExtractor={(_, index) => `beverage-page-${index}`}
              showsHorizontalScrollIndicator={false}
              pagingEnabled
              onMomentumScrollEnd={handleBeveragePagerScrollEnd}
              contentContainerStyle={styles.beveragePager}
              renderItem={({ item: pageItems }) => (
                <View style={styles.beveragePage}>
                  {pageItems ? (
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
                  ) : (
                    <View style={styles.beverageLoadingMorePage}>
                      <ActivityIndicator size="small" color={stylesVars.primary} />
                      <Text style={styles.beverageLoadingText}>Loading...</Text>
                    </View>
                  )}
                </View>
              )}
            />
          )}
        </View>

        <View style={styles.suggestionCard}>
          <View style={styles.suggestionGlow} />
          <View style={styles.suggestionContent}>
            <View style={styles.suggestionHeader}>
              <View style={styles.suggestionIconWrap}>
                <Ionicons name="bulb-outline" size={18} color={stylesVars.primary} />
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

      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
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
            <TextInput
              value={createCategoryName}
              onChangeText={setCreateCategoryName}
              placeholder="Beverage category"
              style={styles.modalInput}
            />

            <Text style={styles.modalLabel}>Image URL (optional)</Text>
            <TextInput
              value={createImageUrl}
              onChangeText={setCreateImageUrl}
              placeholder="https://..."
              style={styles.modalInput}
              autoCapitalize="none"
            />

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
        </View>
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
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: stylesVars.espresso,
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
  beveragePager: {
    paddingRight: 12,
  },
  beveragePage: {
    width: width - 24 * 2,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
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
});