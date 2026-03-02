import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    StyleSheet,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    Dimensions,
    FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

interface MenuVersion {
    id: string;
    name: string;
    image: any;
    avgDailyRevenue: string;
    profitMargin: number;
    topSeller: string;
    isActive: boolean;
    vsVersion?: {
        comparedVersion: string;
        revenueChange: number;
        profitChange: number;
    };
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 48;

interface MenuVersionApi {
    menuId: number;
    menuHeaderId: number;
    versionNumber: string;
    status: string;
    created: string;
    isActive: boolean;
    image?: string | null;
    menuGroups?: Array<{
        menuGroupId: number;
        name: string;
        orderIndex: number;
        menuItems?: Array<{
            menuItemId: number;
            menuId: number;
            description?: string | null;
            sellingPrice: number;
            addedDate: string;
            shopBeverage?: {
                beverageId: number;
                name: string;
                status: string;
                beverageCategoryId: number;
                beverageCategoryName: string;
                imageUrl?: string | null;
            };
            shopRecipe?: {
                recipeId: number;
                recipeName: string;
                image?: string | null;
            };
        }>;
    }>;
}

const fallbackMenuImage =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAFdyVWmZyLBb3sGqVwjvNvxlcOXbB0Jw3NruLr76o5AWV5DnSRs2lZk-_efuzou3kn_LrScey1Wvc8PZzMxgj5gd91FXT-OMRu-KDU7M2mvsL21c9xdgBEpTOcel8JY5_xr42Trfr5CVVXx2G4ecoWnPsSNhqwo_JLo4tvueDeNm_BkMBYA8IXw4hDhwHePqDa5WtgASS4Sl2zzdVGmfZ5g4yNA_l60wPl8CirNcN-4mo_uanAPD1ZScVsTTbrc2V3_Jm5twRLvfU';

const resolveImageUrl = (baseUrl: string, image?: string | null) => {
    if (!image || image === 'null' || image === 'undefined') return null;
    if (image.startsWith('http://') || image.startsWith('https://')) return image;
    if (image.startsWith('/')) return `${baseUrl}${image}`;
    return `${baseUrl}/images/${image}`;
};

const MenuVersionPage = () => {
    const router = useRouter();
    const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [versions, setVersions] = useState<MenuVersion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [activatingId, setActivatingId] = useState<string | null>(null);
    const pulse = useRef(new Animated.Value(0.25)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 700,
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0.25,
                    duration: 700,
                    useNativeDriver: true,
                }),
            ])
        );

        loop.start();
        return () => loop.stop();
    }, [pulse]);

    useEffect(() => {
        let isMounted = true;

        const mapApiToMenuVersion = (item: MenuVersionApi): MenuVersion => {
            const groups = item.menuGroups ?? [];
            const firstItem = groups.flatMap((g) => g.menuItems ?? [])[0];

            const rawImage =
                item.image ??
                firstItem?.shopRecipe?.image ??
                firstItem?.shopBeverage?.imageUrl ??
                null;
            const imageUrl = resolveImageUrl(AUTH_BASE_URL, rawImage) ?? fallbackMenuImage;

            const topSellerName = firstItem?.shopBeverage?.name ?? 'Top seller';

            return {
                id: String(item.menuId),
                name: `${name || 'Menu'} ver ${item.versionNumber}`,
                image: { uri: imageUrl },
                avgDailyRevenue: '—',
                profitMargin: 0,
                topSeller: topSellerName,
                isActive: item.isActive,
            };
        };

        const fetchMenuVersions = async () => {
            if (!id) {
                setError('Menu ID is missing');
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const response = await authorizedFetch(
                    `${AUTH_BASE_URL}/Menu/by-header/${id}`
                );
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }

                const result = await response.json();
                const rawList: MenuVersionApi[] = Array.isArray(result) ? result : [];
                const mapped = rawList.map(mapApiToMenuVersion);

                if (isMounted) {
                    setVersions(mapped);
                }
            } catch (err) {
                if (isMounted) {
                    setError('Failed to load menu versions');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchMenuVersions();

        return () => {
            isMounted = false;
        };
    }, [id, name]);

    const handleScroll = (event: any) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const currentIndexValue = Math.round(contentOffsetX / width);
        setCurrentIndex(currentIndexValue);
    };

    const handleActivate = async (menuId: string) => {
        try {
            setActivatingId(menuId);
            console.log(`Activating menu ${menuId}`);
            setError(null);
            const response = await authorizedFetch(
                `${AUTH_BASE_URL}/Menu/${menuId}/activate`,
                {
                    method: 'PATCH',
                }
            );

            if (!response.ok) {
                throw new Error(`Request failed: ${response.status}`);
            }

            // Optimistically update local state: mark this version active, others inactive
            setVersions((prev) =>
                prev.map((v) => ({
                    ...v,
                    isActive: v.id === menuId,
                }))
            );
        } catch (err) {
            setError('Failed to activate menu');
        } finally {
            setActivatingId(null);
        }
    };

    const renderSkeleton = () => (
        <View style={styles.cardContainer}>
            <Animated.View
                style={[
                    styles.skeletonCard,
                    {
                        transform: [
                            {
                                scale: pulse.interpolate({
                                    inputRange: [0.25, 1],
                                    outputRange: [0.98, 1.02],
                                }),
                            },
                        ],
                    },
                ]}
            >
                <Animated.View style={[styles.skeletonImage, { opacity: pulse }]} />
                <View style={styles.skeletonBody}>
                    <Animated.View style={[styles.skeletonLine, styles.skeletonTitle, { opacity: pulse }]} />
                    <Animated.View style={[styles.skeletonLine, styles.skeletonLineWide, { opacity: pulse }]} />
                    <View style={styles.skeletonRow}>
                        <Animated.View style={[styles.skeletonLine, styles.skeletonLineShort, { opacity: pulse }]} />
                        <Animated.View style={[styles.skeletonLine, styles.skeletonLineShort, { opacity: pulse }]} />
                    </View>
                </View>
            </Animated.View>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.headerWrapper}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()}>
                            <Ionicons name="chevron-back" size={40} color={stylesVars.espresso} />
                        </TouchableOpacity>
                        <View style={{ width: 24 }} />
                    </View>
                </View>

                {/* Content */}
                {error ? (
                    <View style={styles.centerContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : loading ? (
                    <View style={styles.centerContainer}>
                        {renderSkeleton()}
                    </View>
                ) : versions.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <Text style={styles.errorText}>No menu versions.</Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.carouselWrapper}>
                            {/* Versions Carousel */}
                            <FlatList
                                horizontal
                                pagingEnabled
                                scrollEventThrottle={16}
                                onScroll={handleScroll}
                                data={versions}
                                keyExtractor={(item) => item.id}
                                showsHorizontalScrollIndicator={false}
                                decelerationRate="fast"
                                snapToAlignment="center"
                                contentContainerStyle={styles.carouselContent}
                                renderItem={({ item }) => (
                                    <View style={styles.cardContainer}>
                                        <View style={styles.versionCard}>
                                            {/* Image Section */}
                                            <View style={styles.imageWrapper}>
                                                <Image source={item.image} style={styles.image} />
                                                <TouchableOpacity
                                                    style={styles.editButton}
                                                    onPress={() =>
                                                        router.push({
                                                            pathname: '/menu-version-detail/[id]' as any,
                                                            params: {
                                                                id: item.id,
                                                                title: item.name,
                                                            },
                                                        })
                                                    }
                                                >
                                                    <Text style={styles.editButtonText}>Detail</Text>
                                                </TouchableOpacity>

                                                {item.isActive ? (
                                                    <View style={styles.activeBadge}>
                                                        <Text style={styles.activeBadgeText}>Active</Text>
                                                    </View>
                                                ) : (
                                                    <TouchableOpacity
                                                        style={styles.activateButton}
                                                        onPress={() => handleActivate(item.id)}
                                                        disabled={activatingId === item.id}
                                                    >
                                                        {activatingId === item.id ? (
                                                            <ActivityIndicator size="small" color={stylesVars.cardBg} />
                                                        ) : (
                                                            <Text style={styles.activateButtonText}>Activate</Text>
                                                        )}
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            {/* Info Section */}
                                            <View style={styles.infoSection}>
                                                <View style={styles.titleRow}>
                                                    <Text style={styles.cardTitle}>
                                                        {item.name.split(' ver ')[0]}
                                                        <Text style={styles.versionNumber}> ver {item.name.split(' ver ')[1]}</Text>
                                                    </Text>
                                                </View>

                                                <View style={styles.revenueSection}>
                                                    <Text style={styles.sectionLabel}>Avg. Daily Revenue</Text>
                                                    <Text style={styles.revenueValue}>{item.avgDailyRevenue}</Text>
                                                </View>

                                                <View style={styles.bottomRow}>
                                                    <View style={styles.profitSection}>
                                                        <Text style={styles.sectionLabel}>Profit Margin</Text>
                                                        <Text style={styles.profitValue}>{item.profitMargin}%</Text>
                                                    </View>
                                                    <View style={styles.sellerSection}>
                                                        <Text style={styles.sectionLabel}>Top Seller</Text>
                                                        <Text style={styles.sellerValue}>{item.topSeller}</Text>
                                                    </View>
                                                </View>

                                                {item.vsVersion && (
                                                    <View style={styles.comparisonBox}>
                                                        <Text style={styles.comparisonLabel}>Vs {item.vsVersion.comparedVersion}:</Text>
                                                        <View style={styles.comparisonRow}>
                                                            <Ionicons name="trending-up" size={14} color={stylesVars.secondary} />
                                                            <Text style={styles.changeText}>
                                                                + {item.vsVersion.revenueChange}% Revenue
                                                            </Text>
                                                        </View>
                                                        <View style={styles.comparisonRow}>
                                                            <Ionicons name="trending-up" size={14} color={stylesVars.secondary} />
                                                            <Text style={styles.changeText}>
                                                                🔺 + {item.vsVersion.profitChange}% Profit
                                                            </Text>
                                                        </View>
                                                    </View>
                                                )}

                                                {/* Insights Button */}
                                                <TouchableOpacity
                                                    style={styles.insightsButton}
                                                    onPress={() => router.push({
                                                        pathname: '/menu-insights',
                                                        params: { menuId: item.id }
                                                    })}
                                                >
                                                    <View style={styles.insightsButtonContent}>
                                                        <Ionicons name="analytics" size={16} color={stylesVars.primary} />
                                                        <Text style={styles.insightsButtonText}>View Insights</Text>
                                                    </View>
                                                    <Ionicons name="chevron-forward" size={16} color={stylesVars.primary} />
                                                </TouchableOpacity>
                                            </View>


                                        </View>
                                    </View>
                                )}
                            />

                            {/* Pagination Dots */}
                            <View style={styles.paginationContainer}>
                                {versions.map((_, index) => (
                                    <View
                                        key={index}
                                        style={[
                                            styles.dot,
                                            {
                                                backgroundColor:
                                                    index === currentIndex ? stylesVars.espresso : stylesVars.muted,
                                                width: index === currentIndex ? 28 : 8,
                                            },
                                        ]}
                                    />
                                ))}
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const stylesVars = {
    primary: '#8B6F4E',
    secondary: '#2D6A4F',
    espresso: '#1F1F1F',
    background: '#F9F8F6',
    muted: '#94928F',
    cardBg: '#FFFFFF',
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: stylesVars.background,
    },
    container: {
        paddingHorizontal: 0,
        paddingBottom: 80,
        backgroundColor: stylesVars.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        marginTop: 30,
    },
    headerWrapper: {
        paddingHorizontal: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: stylesVars.espresso,
        flex: 1,
        textAlign: 'center',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 300,
        paddingHorizontal: 24,
        gap: 16,
    },
    errorText: {
        fontSize: 14,
        color: '#B45309',
        textAlign: 'center',
    },
    carouselWrapper: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    carouselContent: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 32,
    },
    cardContainer: {
        width,
        justifyContent: 'center',
        alignItems: 'center',
    },
    skeletonCard: {
        width: CARD_WIDTH,
        borderRadius: 28,
        backgroundColor: '#EFEAE4',
        overflow: 'hidden',
        marginBottom: 8,
    },
    skeletonImage: {
        width: '100%',
        height: 220,
        backgroundColor: '#E3DCD4',
    },
    skeletonBody: {
        padding: 16,
        gap: 12,
    },
    skeletonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    skeletonLine: {
        height: 12,
        borderRadius: 8,
        backgroundColor: '#E3DCD4',
    },
    skeletonTitle: {
        height: 18,
        width: '70%',
    },
    skeletonLineWide: {
        width: '85%',
    },
    skeletonLineShort: {
        width: '40%',
    },
    cardWrapper: {
        width: CARD_WIDTH + 24,
        paddingHorizontal: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    versionCard: {
        width: CARD_WIDTH,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(31, 31, 31, 0.08)',
        backgroundColor: stylesVars.cardBg,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
    },
    imageWrapper: {
        position: 'relative',
        width: '100%',
        height: 280,
        backgroundColor: '#DDD',
        marginBottom: 16,
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    editButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderWidth: 1,
        borderColor: 'rgba(139, 111, 78, 0.2)',
    },
    editButtonText: {
        fontSize: 11,
        fontWeight: '700',
        color: stylesVars.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    activeBadge: {
        position: 'absolute',
        top: 48,
        right: 12,
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: 'rgba(45, 106, 79, 0.95)',
    },
    activeBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    activateButton: {
        position: 'absolute',
        top: 48,
        right: 12,
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: stylesVars.primary,
        borderWidth: 1,
        borderColor: 'rgba(139, 111, 78, 0.2)',
    },
    activateButtonText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoSection: {
        padding: 16,
        gap: 0,
        paddingBottom: 60,
    },
    cardTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: stylesVars.espresso,
        letterSpacing: -0.5,
    },
    versionNumber: {
        color: 'rgba(139, 111, 78, 0.7)',
        fontSize: 24,
    },
    titleRow: {
        marginBottom: 12,
    },

    revenueSection: {
        marginBottom: 12,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#9CA3AF',
        marginBottom: 6,
    },
    revenueValue: {
        fontSize: 18,
        fontWeight: '700',
        color: stylesVars.secondary,
        letterSpacing: -0.3,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    profitSection: {
        flex: 1,
    },
    sellerSection: {
        flex: 1,
        alignItems: 'flex-end',
    },
    profitValue: {
        fontSize: 18,
        fontWeight: '700',
        color: stylesVars.secondary,
        letterSpacing: -0.3,
    },
    sellerValue: {
        fontSize: 14,
        fontWeight: '700',
        color: stylesVars.secondary,
    },
    comparisonBox: {
        marginTop: 16,
        paddingTop: 14,
        paddingBottom: 12,
        paddingHorizontal: 14,
        borderRadius: 18,
        backgroundColor: 'rgba(139, 111, 78, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(139, 111, 78, 0.1)',
    },
    comparisonLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(139, 111, 78, 0.6)',
        marginBottom: 8,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    comparisonRow: {
        marginVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
    },
    changeText: {
        fontSize: 12,
        fontWeight: '700',
        color: stylesVars.secondary,
        marginLeft: 6,
    },
    insightsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(139, 111, 78, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(139, 111, 78, 0.15)',
    },
    insightsButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    insightsButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: stylesVars.primary,
    },
    swipeIndicator: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(31, 31, 31, 0.85)',
    },
    swipeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFF',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    paginationContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        marginTop: 20,
        paddingHorizontal: 24,
    },
    dot: {
        height: 7,
        borderRadius: 3.5,
    },
});

export default MenuVersionPage;

