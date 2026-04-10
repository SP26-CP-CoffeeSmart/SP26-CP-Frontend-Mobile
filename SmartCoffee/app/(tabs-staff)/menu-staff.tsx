import React, { useEffect, useRef, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    ActivityIndicator,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Image,
    Modal,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { API_ENDPOINTS, AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';
import QRCode from 'react-native-qrcode-svg';

const COLORS = {
    bg: '#F7F3EF',
    text: '#3C2A21',
    textSecondary: '#8E7B6F',
    border: '#E8E1D9',
    accent: '#D38B2A',
    accentDark: '#A36D2D',
    white: '#FFFFFF',
    status: '#E3F7E6',
    outOfStock: '#FFE6E6',
};

const DOMAIN_WEB = 'https://smart-coffee-six.vercel.app/feedback';

interface MenuItem {
    menuItemId: number;
    description: string | null;
    sellingPrice: number;
    addedDate: string;
    itemSizeViewModels?: Array<{
        itemSizeId: number;
        beverageSizeId: number;
        menuItemId: number;
        sellingPrice: number;
        beverageSize?: {
            beverageSizeId: number;
            sizeName?: string;
            volume?: number;
        };
    }>;
    shopBeverage: {
        beverageId: number;
        name: string;
        status: string;
        beverageCategoryId: number;
        beverageCategoryName: string;
        imageUrl: string | null;
    };
    shopRecipe: {
        recipeId: number;
        recipeName: string;
        image: string | null;
    } | null;
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
    isActive: boolean;
    image?: string | null;
    images?: string[];
    menuGroups: MenuGroup[];
}

const fallbackMenuImage =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAFdyVWmZyLBb3sGqVwjvNvxlcOXbB0Jw3NruLr76o5AWV5DnSRs2lZk-_efuzou3kn_LrScey1Wvc8PZzMxgj5gd91FXT-OMRu-KDU7M2mvsL21c9xdgBEpTOcel8JY5_xr42Trfr5CVVXx2G4ecoWnPsSNhqwo_JLo4tvueDeNm_BkMBYA8IXw4hDhwHePqDa5WtgASS4Sl2zzdVGmfZ5g4yNA_l60wPl8CirNcN-4mo_uanAPD1ZScVsTTbrc2V3_Jm5twRLvfU';
const { width } = Dimensions.get('window');
const MENU_IMAGE_WIDTH = width - 32;
const ZOOM_IMAGE_WIDTH = width;

const resolveImageUrl = (baseUrl: string, image?: string | null) => {
    if (!image || image === 'null' || image === 'undefined') return null;
    if (image.startsWith('http://') || image.startsWith('https://')) return image;
    if (image.startsWith('/')) return `${baseUrl}${image}`;
    return `${baseUrl}/images/${image}`;
};

export default function MenuStaffScreen() {
    const router = useRouter();
    const { coffeeShopId } = useAuth();
    const [menuData, setMenuData] = useState<MenuData | null>(null);
    const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [menuHeaderName, setMenuHeaderName] = useState<string | null>(null);
    const [qrItem, setQrItem] = useState<MenuItem | null>(null);
    const [menuImageIndex, setMenuImageIndex] = useState(0);
    const [zoomImageIndex, setZoomImageIndex] = useState(0);
    const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
    const zoomListRef = useRef<FlatList<string>>(null);

    const fetchMenu = async () => {
        if (!coffeeShopId) {
            setError('Coffee shop ID not found');
            setLoading(false);
            return;
        }

        try {
            setError(null);
            const response = await authorizedFetch(
                API_ENDPOINTS.menu.getActiveByShop(coffeeShopId),
                {
                    headers: {
                        Accept: '*/*',
                    },
                }
            );

            if (!response.ok) {
                if (response.status === 404) {
                    setError('No active menu found for this shop');
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return;
            }

            const data = await response.json();
            setMenuData(data);
            setAllMenuItems([]);

            // Fetch menu header to get menu name
            if (data?.menuHeaderId) {
                try {
                    const headerResponse = await authorizedFetch(
                        API_ENDPOINTS.menuHeader.getById(data.menuHeaderId),
                        {
                            headers: {
                                Accept: '*/*',
                            },
                        }
                    );

                    if (headerResponse.ok) {
                        const headerData = await headerResponse.json();
                        setMenuHeaderName(headerData?.name ?? null);
                    } else {
                        console.error('[Menu Staff] Failed to fetch MenuHeader:', headerResponse.status);
                    }
                } catch (headerError) {
                    console.error('[Menu Staff] Error fetching MenuHeader:', headerError);
                }
            } else {
                setMenuHeaderName(null);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load menu';
            setError(errorMessage);
            console.error('[Menu Staff] Error:', errorMessage);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchMenu();
    }, [coffeeShopId]);

    const onRefresh = () => {
        setRefreshing(true);
        setLoading(true);
        fetchMenu();
    };

    const getMenuImages = (): string[] => {
        if (!menuData) return [];

        const merged = [...(menuData.images ?? []), menuData.image ?? '']
            .map((url) => (url || '').trim())
            .filter((url) => !!url);

        return Array.from(new Set(merged));
    };

    const handleMenuImageScrollEnd = (event: any) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x || 0;
        const nextIndex = Math.round(contentOffsetX / MENU_IMAGE_WIDTH);
        setMenuImageIndex(nextIndex);
    };

    const handleOpenImageZoom = (index: number) => {
        setZoomImageIndex(index);
        setIsImageZoomOpen(true);
    };

    const handleZoomImageScrollEnd = (event: any) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x || 0;
        const nextIndex = Math.round(contentOffsetX / ZOOM_IMAGE_WIDTH);
        setZoomImageIndex(nextIndex);
    };

    const formatPrice = (value?: number) => {
        if (value == null) return '';
        return `${value.toLocaleString('vi-VN')} VND`;
    };

    const menuImages = getMenuImages();

    useEffect(() => {
        if (menuImageIndex >= menuImages.length) {
            setMenuImageIndex(0);
        }
    }, [menuImages.length, menuImageIndex]);

    useEffect(() => {
        if (zoomImageIndex >= menuImages.length) {
            setZoomImageIndex(0);
        }
    }, [menuImages.length, zoomImageIndex]);

    useEffect(() => {
        // Warm network/cache for zoom modal to reduce first-open delay.
        menuImages.forEach((uri) => {
            Image.prefetch(uri);
        });
    }, [menuImages]);

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'active':
                return '#27AE60';
            case 'out of stock':
            case 'outofstock':
                return '#E74C3C';
            default:
                return COLORS.textSecondary;
        }
    };

    const handleViewRecipe = (item: MenuItem) => {
        Toast.show({
            type: 'info',
            text1: 'Recipe: ' + (item.shopRecipe?.recipeName ?? 'Chưa có tên'),
            text2: item.shopBeverage.name,
        });
    };

    const handleDailySales = (item: MenuItem) => {
        const sizeData = (item.itemSizeViewModels || []).map((sizeItem) => ({
            sizeName: (sizeItem.beverageSize?.sizeName || '').trim(),
            sellingPrice: sizeItem.sellingPrice,
            volume: sizeItem.beverageSize?.volume || 0,
        }));

        const itemImageUrl =
            resolveImageUrl(
                AUTH_BASE_URL,
                item.shopRecipe?.image ?? item.shopBeverage.imageUrl
            ) || fallbackMenuImage;

        router.push({
            pathname: '/daily-sale-item/[menuItemId]',
            params: {
                menuItemId: item.menuItemId.toString(),
                recipeName: item.shopRecipe?.recipeName ?? 'Chưa có tên',
                beverageName: item.shopBeverage.name,
                itemImage: itemImageUrl,
                sizeData: JSON.stringify(sizeData),
            },
        });
    };

    const handleGenerateQr = (item: MenuItem) => {
        setQrItem(item);
    };

    const renderMenuGroupHeader = (groupName: string) => {
        return (
            <View key={`group-header-${groupName}`} style={styles.menuGroupHeader}>
                <Text style={styles.menuGroupHeaderText}>{groupName}</Text>
            </View>
        );
    };

    const renderMenuItem = ({ item }: { item: MenuItem }) => {
        const imageUrl = resolveImageUrl(
            AUTH_BASE_URL,
            item.shopRecipe?.image ?? item.shopBeverage.imageUrl
        );
        const hasImage = !!imageUrl;
        const statusColor = getStatusColor(item.shopBeverage.status);
        const itemSizes = [...(item.itemSizeViewModels || [])].sort((a, b) => {
            const volumeA = a.beverageSize?.volume ?? 0;
            const volumeB = b.beverageSize?.volume ?? 0;
            return volumeA - volumeB;
        });

        return (
            <View style={styles.menuItemCard}>
                <View style={styles.menuItemContent}>
                    {/* Left: Image */}
                    {hasImage ? (
                        <Image
                            source={{ uri: imageUrl }}
                            style={styles.menuItemImage}
                        />
                    ) : (
                        <View style={styles.menuItemImageFallback}>
                            <Ionicons name="cafe" size={32} color="#847362" />
                        </View>
                    )}

                    {/* Center: Details */}
                    <View style={styles.menuItemDetails}>
                        <Text style={styles.beverageName}>{item.shopRecipe?.recipeName ?? 'Chưa có tên'}</Text>

                        <View style={styles.priceRow}>
                            {/* <Text style={styles.price}>
                                {(item.sellingPrice / 1000).toFixed(0)}K VND
                            </Text> */}
                        </View>

                        {itemSizes.length > 0 && (
                            <View style={styles.sizePriceList}>
                                {itemSizes.map((sizeItem) => (
                                    <View key={sizeItem.itemSizeId} style={styles.sizePriceChip}>
                                        <Text style={styles.sizePriceText}>
                                            {(sizeItem.beverageSize?.sizeName || 'Size').trim()} • {formatPrice(sizeItem.sellingPrice)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Right: Status Badge */}
                    {/* <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                        <Text style={styles.statusText}>{item.shopBeverage.status}</Text>
                    </View> */}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleViewRecipe(item)}
                    >
                        <Ionicons name="document-text" size={16} color={COLORS.text} />
                        <Text style={styles.actionButtonText}>View Recipe</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleGenerateQr(item)}
                    >
                        <Ionicons name="qr-code" size={16} color={COLORS.text} />
                        <Text style={styles.actionButtonText}>QR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonDark]}
                        onPress={() => handleDailySales(item)}
                    >
                        <Ionicons name="bar-chart" size={16} color={COLORS.white} />
                        <Text style={[styles.actionButtonText, styles.actionButtonTextDark]}>
                            Daily Sales
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                    <Text style={styles.loadingText}>Loading menu...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContent}>
                    <Ionicons name="alert-circle" size={48} color={COLORS.accent} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={onRefresh}
                    >
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                {menuHeaderName && (<Text style={styles.headerTitle}>{menuHeaderName}</Text>)}
                <Text style={styles.headerManagement}>Menu List</Text>

            </View>

            <ScrollView
                style={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.accent]}
                        tintColor={COLORS.accent}
                    />
                }
            >
                {menuImages.length > 0 && (
                    <View style={styles.menuImageSection}>
                        <FlatList
                            data={menuImages}
                            horizontal
                            pagingEnabled
                            keyExtractor={(item, index) => `${item}-${index}`}
                            showsHorizontalScrollIndicator={false}
                            decelerationRate="fast"
                            snapToAlignment="center"
                            initialScrollIndex={0}
                            onMomentumScrollEnd={handleMenuImageScrollEnd}
                            renderItem={({ item, index }) => (
                                <View style={styles.menuImageWrapper}>
                                    <TouchableOpacity
                                        activeOpacity={0.95}
                                        onPress={() => handleOpenImageZoom(index)}
                                        style={styles.menuImageTapArea}
                                    >
                                        <Image source={{ uri: item }} style={styles.menuBannerImage} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        />

                        {menuImages.length > 1 && (
                            <View style={styles.menuImagePagination}>
                                {menuImages.map((_, index) => (
                                    <View
                                        key={`menu-image-dot-${index}`}
                                        style={[
                                            styles.menuImageDot,
                                            index === menuImageIndex && styles.menuImageDotActive,
                                        ]}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* Enter Daily Sales Card */}
                <TouchableOpacity
                    style={styles.dailySalesCard}
                    onPress={() => router.push('/daily-sales')}
                >
                    <View style={styles.dailySalesContent}>
                        <Ionicons name="receipt" size={32} color={COLORS.white} />
                        <View style={styles.dailySalesText}>
                            <Text style={styles.dailySalesTitle}>Enter Daily Sales</Text>
                            <Text style={styles.dailySalesSubtitle}>BULK ENTRY FOR ALL ITEMS</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color={COLORS.white} />
                </TouchableOpacity>

                {/* Menu Items */}
                {!menuData || menuData.menuGroups.length === 0 ? (
                    <View style={styles.emptyContent}>
                        <Ionicons name="list" size={48} color={COLORS.textSecondary} />
                        <Text style={styles.emptyTitle}>No menu items</Text>
                        <Text style={styles.emptyText}>
                            No items found in the active menu
                        </Text>
                    </View>
                ) : (
                    <View style={styles.listContent}>
                        {menuData.menuGroups.map((group) => {
                            const groupItems = group.menuItems || [];
                            return (
                                <View key={group.menuGroupId}>
                                    {renderMenuGroupHeader(group.name)}
                                    {groupItems.map((item) =>
                                        React.cloneElement(renderMenuItem({ item }), {
                                            key: item.menuItemId.toString()
                                        })
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* QR Modal for customer scanning */}
            <Modal
                visible={!!qrItem}
                transparent
                animationType="fade"
                onRequestClose={() => setQrItem(null)}
            >
                <View style={styles.qrModalBackdrop}>
                    <View style={styles.qrModalContent}>
                        <Text style={styles.qrTitle}>Scan to give feedback</Text>
                        {qrItem && (
                            <View style={styles.qrWrapper}>
                                <QRCode
                                    value={`${DOMAIN_WEB}/${qrItem.menuItemId}`}
                                    size={220}
                                    backgroundColor={COLORS.white}
                                    color={COLORS.text}
                                />
                            </View>
                        )}
                        <TouchableOpacity
                            style={styles.qrCloseButton}
                            onPress={() => setQrItem(null)}
                        >
                            <Text style={styles.qrCloseButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={isImageZoomOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsImageZoomOpen(false)}
                onShow={() => {
                    requestAnimationFrame(() => {
                        zoomListRef.current?.scrollToIndex({
                            index: zoomImageIndex,
                            animated: false,
                        });
                    });
                }}
            >
                <View style={styles.zoomModalBackdrop}>
                    <TouchableOpacity
                        style={styles.zoomCloseButton}
                        onPress={() => setIsImageZoomOpen(false)}
                    >
                        <Ionicons name="close" size={24} color={COLORS.white} />
                    </TouchableOpacity>

                    <FlatList
                        ref={zoomListRef}
                        data={menuImages}
                        horizontal
                        pagingEnabled
                        keyExtractor={(item, index) => `${item}-zoom-${index}`}
                        getItemLayout={(_, index) => ({
                            length: ZOOM_IMAGE_WIDTH,
                            offset: ZOOM_IMAGE_WIDTH * index,
                            index,
                        })}
                        onMomentumScrollEnd={handleZoomImageScrollEnd}
                        showsHorizontalScrollIndicator={false}
                        style={styles.zoomList}
                        initialNumToRender={1}
                        maxToRenderPerBatch={1}
                        windowSize={2}
                        renderItem={({ item }) => (
                            <View style={styles.zoomImageSlide}>
                                <Image
                                    source={{ uri: item }}
                                    style={styles.zoomImage}
                                    resizeMode="contain"
                                />
                            </View>
                        )}
                    />

                    {menuImages.length > 1 && (
                        <View style={styles.zoomPagination}>
                            {menuImages.map((_, index) => (
                                <View
                                    key={`zoom-dot-${index}`}
                                    style={[
                                        styles.zoomDot,
                                        index === zoomImageIndex && styles.zoomDotActive,
                                    ]}
                                />
                            ))}
                        </View>
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.text,
    },
    headerManagement: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 4,
        fontWeight: '600',
        letterSpacing: 1,
    },
    headerSubtitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    scrollContent: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    menuImageSection: {
        marginBottom: 20,
    },
    menuImageWrapper: {
        width: MENU_IMAGE_WIDTH,
        height: 280,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#DDD',
        borderWidth: 1,
        borderColor: 'rgba(31, 31, 31, 0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
        elevation: 4,
    },
    menuImageTapArea: {
        width: '100%',
        height: '100%',
    },
    menuBannerImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    menuImagePagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
    },
    menuImageDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#CFC7BE',
    },
    menuImageDotActive: {
        width: 24,
        borderRadius: 4,
        backgroundColor: '#1F1F1F',
    },
    dailySalesCard: {
        backgroundColor: '#6B4423',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 20,
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
    },
    dailySalesContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    dailySalesText: {
        marginLeft: 16,
    },
    dailySalesTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.white,
    },
    dailySalesSubtitle: {
        fontSize: 11,
        color: COLORS.white,
        marginTop: 4,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    listContent: {
        paddingBottom: 20,
    },
    menuGroupHeader: {
        paddingHorizontal: 4,
        paddingVertical: 12,
        marginTop: 16,
        marginBottom: 8,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.accent,
        backgroundColor: 'rgba(211, 139, 42, 0.05)',
        borderRadius: 4,
    },
    menuGroupHeaderText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.accentDark,
        paddingHorizontal: 12,
    },
    emptyContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    menuItemCard: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    menuItemContent: {
        flexDirection: 'row',
        padding: 12,
        alignItems: 'flex-start',
    },
    menuItemImage: {
        width: 80,
        height: 80,
        borderRadius: 10,
        backgroundColor: '#E8CCBE',
    },
    menuItemImageFallback: {
        width: 80,
        height: 80,
        borderRadius: 10,
        backgroundColor: '#EFE7DE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuItemDetails: {
        flex: 1,
        marginHorizontal: 12,
    },
    beverageName: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 4,
    },
    category: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    priceRow: {
        marginBottom: 8,
    },
    price: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.accent,
        marginBottom: 4,
    },
    sizePriceList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    sizePriceChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(211, 139, 42, 0.12)',
    },
    sizePriceText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.accentDark,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF4E6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    rating: {
        fontSize: 11,
        color: COLORS.text,
        marginLeft: 4,
        fontWeight: '600',
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        marginTop: 6,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.white,
    },
    statusIndicator: {
        marginLeft: 8,
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 12,
        paddingBottom: 12,
        gap: 8,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.white,
    },
    actionButtonDark: {
        backgroundColor: COLORS.accentDark,
        borderColor: COLORS.accentDark,
    },
    actionButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.text,
        marginLeft: 6,
    },
    actionButtonTextDark: {
        color: COLORS.white,
    },
    loadingText: {
        fontSize: 16,
        color: COLORS.text,
        marginTop: 12,
    },
    errorText: {
        fontSize: 16,
        color: COLORS.text,
        textAlign: 'center',
        marginTop: 12,
        marginBottom: 20,
    },
    retryButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: COLORS.accent,
        borderRadius: 8,
    },
    retryButtonText: {
        color: COLORS.white,
        fontWeight: '600',
        fontSize: 14,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
        marginTop: 12,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 8,
    },
    qrModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    qrModalContent: {
        width: '80%',
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
    },
    qrTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    qrWrapper: {
        padding: 16,
        borderRadius: 16,
        backgroundColor: COLORS.bg,
        marginBottom: 20,
    },
    qrCloseButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: COLORS.accent,
    },
    qrCloseButtonText: {
        color: COLORS.white,
        fontWeight: '600',
        fontSize: 14,
    },
    zoomModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.92)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomCloseButton: {
        position: 'absolute',
        top: 56,
        right: 18,
        zIndex: 3,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    zoomImageSlide: {
        width: ZOOM_IMAGE_WIDTH,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomList: {
        width: ZOOM_IMAGE_WIDTH,
    },
    zoomImage: {
        width: '100%',
        height: '80%',
    },
    zoomPagination: {
        position: 'absolute',
        bottom: 46,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    zoomDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.35)',
    },
    zoomDotActive: {
        width: 24,
        borderRadius: 4,
        backgroundColor: '#FFFFFF',
    },
});
