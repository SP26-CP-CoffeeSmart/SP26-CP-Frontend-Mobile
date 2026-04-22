import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    BackHandler,
    StyleSheet,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    Dimensions,
    FlatList,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { API_ENDPOINTS, AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSuggestions } from '@/context/suggestion-context';
import type { SuggestionItem } from '@/context/suggestion-context';

const MENU_REFRESH_FLAG_KEY = 'menu:list:refresh:needed';

interface MenuVersion {
    id: string;
    name: string;
    image: any;
    imageUri?: string;
    avgDailyRevenue: string;
    profitMargin: number;
    topSeller: string;
    isApplied: boolean;
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
    isActive?: boolean;
    isApplied?: boolean;
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

interface MenuSupplierRecommendation {
    ingredientId: number;
    ingredientName: string;
    currentStock: number;
    minStock: number;
    recommendedProductId: number;
    productId: number;
    productDescription?: string | null;
    supplierId: number;
    supplierName?: string | null;
    supplierRating?: number | null;
    productRating?: number | null;
    price: number;
    packageSize?: number | null;
    measurement?: string | null;
    image?: string | null;
    suggestedQuantity?: number | null;
    stock?: number | null;
    holdStock?: number | null;
}

const fallbackMenuImage =
    Image.resolveAssetSource(require('../../assets/AI_RecommendationBackground.jpg')).uri;

const resolveImageUrl = (baseUrl: string, image?: string | null) => {
    if (!image || image === 'null' || image === 'undefined') return null;
    if (image.startsWith('http://') || image.startsWith('https://')) return image;
    if (image.startsWith('/')) return `${baseUrl}${image}`;
    return `${baseUrl}/images/${image}`;
};

const MenuVersionPage = () => {
    const router = useRouter();
    const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
    const { setItems, clear } = useSuggestions();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [versions, setVersions] = useState<MenuVersion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [activatingId, setActivatingId] = useState<string | null>(null);
    const [missingIngredients, setMissingIngredients] = useState<Array<{ ingredientId: number; ingredientName: string; image: string | null }>>([]);
    const [showMissingModal, setShowMissingModal] = useState(false);
    const [pendingMenuId, setPendingMenuId] = useState<string | null>(null);
    // Unified modal: 'missing' shows the ingredients list, 'ai-input' shows the forecast form
    const [modalView, setModalView] = useState<'missing' | 'ai-input'>('missing');
    const [aiInputMode, setAiInputMode] = useState<'cups' | 'forecast'>('cups');
    const [aiCupsInput, setAiCupsInput] = useState('');
    const [aiRangeDays, setAiRangeDays] = useState(7);
    const [aiSubmitting, setAiSubmitting] = useState(false);
    const [missingModalHeight, setMissingModalHeight] = useState<number | null>(null);
    const pulse = useRef(new Animated.Value(0.25)).current;

    const todayStr = new Date().toISOString().split('T')[0];
    const toDateStr = (() => {
        const d = new Date();
        d.setDate(d.getDate() + aiRangeDays);
        return d.toISOString().split('T')[0];
    })();

    const mapApiToMenuVersion = useCallback((item: MenuVersionApi): MenuVersion => {
        const groups = item.menuGroups ?? [];
        const firstItem = groups.flatMap((g) => g.menuItems ?? [])[0];

        const rawImage =
            item.image ??
            firstItem?.shopRecipe?.image ??
            firstItem?.shopBeverage?.imageUrl ??
            null;
        const imageUrl = resolveImageUrl(AUTH_BASE_URL, rawImage) ?? fallbackMenuImage;

        const topSellerName = firstItem?.shopBeverage?.name ?? 'Top seller';
        const appliedByStatus = String(item.status ?? '').toLowerCase() === 'active';
        const isApplied = Boolean(item.isApplied ?? item.isActive ?? appliedByStatus);

        return {
            id: String(item.menuId),
            name: `${name || 'Menu'} ver ${item.versionNumber}`,
            image: { uri: imageUrl },
            imageUri: imageUrl,
            avgDailyRevenue: '—',
            profitMargin: 0,
            topSeller: topSellerName,
            isApplied,
        };
    }, [name]);

    const fetchMenuVersions = useCallback(async () => {
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
            setVersions(mapped);
        } catch (err) {
            setError('Failed to load menu versions');
        } finally {
            setLoading(false);
        }
    }, [id, mapApiToMenuVersion]);

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
        fetchMenuVersions();
    }, [fetchMenuVersions]);

    const handleScroll = (event: any) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const currentIndexValue = Math.round(contentOffsetX / width);
        setCurrentIndex(currentIndexValue);
    };

    const handleActivate = async (menuId: string) => {
        try {
            setActivatingId(menuId);
            setError(null);
            const endpoint = API_ENDPOINTS.menu.activate(menuId);
            let response = await authorizedFetch(endpoint, {
                method: 'PATCH',
                headers: { Accept: '*/*' },
            });

            // Some backends expose this action endpoint as POST instead of PATCH.
            if (response.status === 405 || response.status === 404) {
                response = await authorizedFetch(endpoint, {
                    method: 'POST',
                    headers: { Accept: '*/*' },
                });
            }

            if (response.status === 400) {
                // Missing ingredients case
                const body = await response.json().catch(() => []);
                const list = Array.isArray(body) ? body : [];
                if (list.length > 0) {
                    setMissingIngredients(list);
                    setPendingMenuId(menuId);
                    setShowMissingModal(true);
                } else {
                    setError('Cannot activate: missing required ingredients.');
                }
                return;
            }

            if (!response.ok) {
                const errorBody = await response.text();
                console.log('[Menu Activate] status:', response.status);
                console.log('[Menu Activate] body:', errorBody);
                throw new Error(`Request failed: ${response.status}`);
            }

            await AsyncStorage.setItem(MENU_REFRESH_FLAG_KEY, '1');
            await fetchMenuVersions();
        } catch (err) {
            setError('Failed to activate menu');
        } finally {
            setActivatingId(null);
        }
    };

    const handleAiSuggestOrder = async () => {
        if (!pendingMenuId) return;

        const cups = parseInt(aiCupsInput, 10);
        if (aiInputMode === 'cups' && (!Number.isFinite(cups) || cups < 1)) return;

        setAiSubmitting(true);
        try {
            const params: { threshold: number; numberCupWanted?: number; from?: string; to?: string } = {
                threshold: 10,
            };
            if (aiInputMode === 'cups') {
                params.numberCupWanted = cups;
            } else {
                params.from = todayStr;
                params.to = toDateStr;
            }

            const url = API_ENDPOINTS.menu.supplierRecommendations(pendingMenuId, params);
            const response = await authorizedFetch(url, { headers: { Accept: '*/*' } });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data: MenuSupplierRecommendation[] = await response.json();
            const list = Array.isArray(data) ? data : [];

            const mapped: SuggestionItem[] = list.map((item, index) => {
                const qtyNeeded = Math.max((item.minStock ?? 0) - (item.currentStock ?? 0), 0);
                const shortDesc = (item.productDescription || '').split('\n')[0];
                const imgUri = String(item.image || '').trim();
                const availStock = typeof item.stock === 'number'
                    ? Math.max(0, (item.stock ?? 0) - (item.holdStock ?? 0))
                    : null;
                return {
                    id: String(item.recommendedProductId || item.ingredientId || index),
                    productId: item.productId,
                    supplierId: item.supplierId,
                    supplierName: item.supplierName ?? null,
                    name: item.ingredientName || 'Unknown',
                    image: imgUri,
                    subtitle: shortDesc || 'Recommended by menu AI.',
                    qtyNeeded,
                    productRating: typeof item.productRating === 'number' ? item.productRating : undefined,
                    timeRange: qtyNeeded > 0 ? 'Need restock' : 'OK',
                    rating: Number(item.supplierRating || 0),
                    measurement: item.measurement ?? null,
                    packageSize: item.packageSize ?? null,
                    availableStock: availStock,
                    suggestedQuantity: item.suggestedQuantity ?? null,
                    priceVnd: item.price,
                };
            });

            clear();
            setItems(mapped);
            setModalView('missing');
            setShowMissingModal(false);
            router.push('/ai-order-suggestions');
        } catch (err) {
            console.error('[AI Suggest Order]', err);
        } finally {
            setAiSubmitting(false);
        }
    };

    const navigateToInsights = (item: MenuVersion) => {
        router.push({
            pathname: '/(tabs)/menu-insights',
            params: {
                menuId: item.id,
                menuName: item.name,
                menuImage: item.imageUri ?? '',
            },
        });
    };

    const handleBackToMenuTab = useCallback(() => {
        const routerWithDismiss = router as typeof router & {
            dismissTo?: (href: string) => void;
        };

        if (typeof routerWithDismiss.dismissTo === 'function') {
            routerWithDismiss.dismissTo('/(tabs)/menu');
            return;
        }

        router.replace('/(tabs)/menu');
    }, [router]);

    useFocusEffect(
        useCallback(() => {
            const onHardwareBackPress = () => {
                handleBackToMenuTab();
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
            return () => subscription.remove();
        }, [handleBackToMenuTab])
    );

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
                        <TouchableOpacity onPress={handleBackToMenuTab}>
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
                                        <TouchableOpacity
                                            style={styles.versionCard}
                                            activeOpacity={0.96}
                                            onPress={() => navigateToInsights(item)}
                                        >
                                            {/* Image Section */}
                                            <View style={styles.imageWrapper}>
                                                <Image source={item.image} style={styles.image} />

                                                <TouchableOpacity
                                                    style={[
                                                        styles.statusBadge,
                                                        (item.isApplied || activatingId === item.id) && styles.statusBadgeDisabled,
                                                    ]}
                                                    onPress={(event) => {
                                                        event.stopPropagation();
                                                        if (item.isApplied || activatingId === item.id) return;
                                                        handleActivate(item.id);
                                                    }}
                                                    disabled={item.isApplied || activatingId === item.id}
                                                >
                                                    {activatingId === item.id ? (
                                                        <ActivityIndicator size="small" color={stylesVars.cardBg} />
                                                    ) : item.isApplied ? (
                                                        <Text style={styles.activeBadgeText}>Actived</Text>
                                                    ) : (
                                                        <Text style={styles.activateButtonText}>Activate</Text>
                                                    )}
                                                </TouchableOpacity>
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
                                                    onPress={() => navigateToInsights(item)}
                                                >
                                                    <View style={styles.insightsButtonContent}>
                                                        <Ionicons name="analytics" size={16} color={stylesVars.primary} />
                                                        <Text style={styles.insightsButtonText}>View Insights</Text>
                                                    </View>
                                                    <Ionicons name="chevron-forward" size={16} color={stylesVars.primary} />
                                                </TouchableOpacity>
                                            </View>


                                        </TouchableOpacity>
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

            {/* Unified Modal: Missing Ingredients → AI Suggest Order */}
            <Modal
                visible={showMissingModal}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => {
                    if (modalView === 'ai-input') {
                        setModalView('missing');
                    } else {
                        setShowMissingModal(false);
                    }
                }}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalBackdrop}
                >
                    <View
                        style={[
                            modalView === 'ai-input' ? styles.aiModalCard : styles.modalCard,
                            modalView === 'ai-input' && missingModalHeight
                                ? { height: missingModalHeight }
                                : null,
                        ]}
                        onLayout={(event) => {
                            if (modalView !== 'missing') return;
                            const measuredHeight = Math.round(event.nativeEvent.layout.height);
                            if (measuredHeight <= 0) return;
                            if (missingModalHeight && Math.abs(missingModalHeight - measuredHeight) <= 1) return;
                            setMissingModalHeight(measuredHeight);
                        }}
                    >

                        {modalView === 'missing' ? (
                            /* ── VIEW 1: Missing ingredients list ── */
                            <>
                                <View style={styles.modalHeader}>
                                    <View style={styles.modalIconWrap}>
                                        <Ionicons name="alert-circle" size={28} color="#B45309" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.modalTitle}>Cannot Activate Menu</Text>
                                        <Text style={styles.modalSubtitle}>
                                            The following ingredients are missing from your inventory.
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.modalCloseBtn}
                                        onPress={() => setShowMissingModal(false)}
                                    >
                                        <Ionicons name="close" size={18} color="#8B7A6A" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView
                                    style={styles.modalList}
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={{ gap: 10 }}
                                >
                                    {missingIngredients.map((ing) => (
                                        <View key={ing.ingredientId} style={styles.ingredientRow}>
                                            <View style={styles.ingredientImageWrap}>
                                                {ing.image ? (
                                                    <Image source={{ uri: ing.image }} style={styles.ingredientImage} />
                                                ) : (
                                                    <View style={styles.ingredientImagePlaceholder}>
                                                        <Ionicons name="leaf-outline" size={20} color="#C4A882" />
                                                    </View>
                                                )}
                                            </View>
                                            <View style={styles.ingredientInfo}>
                                                <Text style={styles.ingredientName}>{ing.ingredientName}</Text>
                                                <Text style={styles.ingredientHint}>Not available in inventory</Text>
                                            </View>
                                            <View style={styles.ingredientBadge}>
                                                <Ionicons name="close-circle" size={14} color="#B45309" />
                                                <Text style={styles.ingredientBadgeText}>Missing</Text>
                                            </View>
                                        </View>
                                    ))}
                                </ScrollView>

                                <View style={styles.modalActions}>
                                    <TouchableOpacity
                                        style={styles.modalDismissBtn}
                                        onPress={() => setShowMissingModal(false)}
                                    >
                                        <Text style={styles.modalDismissBtnText}>Close</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.modalGoInventoryBtn}
                                        onPress={() => setModalView('ai-input')}
                                    >
                                        <Ionicons name="sparkles-outline" size={14} color="#FFF" />
                                        <Text style={styles.modalGoInventoryBtnText}>AI Suggest Order</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            /* ── VIEW 2: AI input form ── */
                            <>
                                <View style={styles.aiModalHeader}>
                                    <TouchableOpacity
                                        style={styles.modalCloseBtn}
                                        onPress={() => setModalView('missing')}
                                    >
                                        <Ionicons name="chevron-back" size={18} color="#8B7A6A" />
                                    </TouchableOpacity>
                                    <View style={styles.aiModalIconWrap}>
                                        <Ionicons name="sparkles" size={22} color="#8B6F4E" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.aiModalTitle}>AI Suggest Order</Text>
                                        <Text style={styles.aiModalSubtitle}>
                                            Enter your forecast to get supplier recommendations.
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.modalCloseBtn}
                                        onPress={() => setShowMissingModal(false)}
                                    >
                                        <Ionicons name="close" size={18} color="#8B7A6A" />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.aiModeRow}>
                                    <TouchableOpacity
                                        style={[styles.aiModeTab, aiInputMode === 'cups' && styles.aiModeTabActive]}
                                        onPress={() => setAiInputMode('cups')}
                                    >
                                        <Ionicons name="cafe-outline" size={13} color={aiInputMode === 'cups' ? '#FFF' : '#8B6F4E'} />
                                        <Text style={[styles.aiModeTabText, aiInputMode === 'cups' && styles.aiModeTabTextActive]}>
                                            Cups to Sell
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.aiModeTab, aiInputMode === 'forecast' && styles.aiModeTabActive]}
                                        onPress={() => setAiInputMode('forecast')}
                                    >
                                        <Ionicons name="calendar-outline" size={13} color={aiInputMode === 'forecast' ? '#FFF' : '#8B6F4E'} />
                                        <Text style={[styles.aiModeTabText, aiInputMode === 'forecast' && styles.aiModeTabTextActive]}>
                                            Forecast Duration
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {aiInputMode === 'cups' ? (
                                    <View style={styles.aiInputSection}>
                                        <Text style={styles.aiInputLabel}>Estimated Cups to Sell</Text>
                                        <TextInput
                                            style={styles.aiTextInput}
                                            placeholder="Example: 200"
                                            placeholderTextColor="#C4A882"
                                            keyboardType="numeric"
                                            value={aiCupsInput}
                                            onChangeText={setAiCupsInput}
                                        />
                                        <Text style={styles.aiInputHint}>Minimum: 1 cup.</Text>
                                    </View>
                                ) : (
                                    <View style={styles.aiInputSection}>
                                        <Text style={styles.aiInputLabel}>Forecast Duration: {aiRangeDays} days</Text>
                                        <Slider
                                            style={{ width: '100%', height: 40 }}
                                            minimumValue={1}
                                            maximumValue={60}
                                            step={1}
                                            value={aiRangeDays}
                                            onValueChange={(v) => setAiRangeDays(Math.round(v))}
                                            minimumTrackTintColor="#8B6F4E"
                                            maximumTrackTintColor="#E2D5C8"
                                            thumbTintColor="#8B6F4E"
                                        />
                                        <View style={styles.aiDateRow}>
                                            <View style={styles.aiDateBox}>
                                                <Text style={styles.aiDateLabel}>From</Text>
                                                <Text style={styles.aiDateValue}>{todayStr}</Text>
                                            </View>
                                            <View style={styles.aiDateBox}>
                                                <Text style={styles.aiDateLabel}>To</Text>
                                                <Text style={styles.aiDateValue}>{toDateStr}</Text>
                                            </View>
                                        </View>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={[styles.aiStartBtn, aiSubmitting && { opacity: 0.6 }]}
                                    onPress={handleAiSuggestOrder}
                                    disabled={aiSubmitting}
                                >
                                    {aiSubmitting ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <>
                                            <Ionicons name="sparkles" size={16} color="#FFF" />
                                            <Text style={styles.aiStartBtnText}>Start</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>
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
    statusBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        minWidth: 98,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: 'rgba(45, 106, 79, 0.95)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.7)',
    },
    statusBadgeDisabled: {
        opacity: 0.85,
    },
    activeBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
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
    // ─── Missing Ingredients Modal ───────────────────────────────────
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(20, 14, 10, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#FFFBF7',
        borderRadius: 24,
        padding: 20,
        maxHeight: '80%',
        shadowColor: '#2D1708',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 20,
        elevation: 10,
        borderWidth: 1,
        borderColor: '#F0DEC8',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 16,
    },
    modalIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1F1F1F',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#8B7A6A',
        lineHeight: 17,
    },
    modalCloseBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#F5EDE3',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalList: {
        maxHeight: 300,
        marginBottom: 16,
    },
    ingredientRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#EDE3D9',
        gap: 12,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 1,
    },
    ingredientImageWrap: {
        width: 48,
        height: 48,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#F5EDE3',
    },
    ingredientImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    ingredientImagePlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F0E4D4',
    },
    ingredientInfo: {
        flex: 1,
    },
    ingredientName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1F1F1F',
        marginBottom: 3,
    },
    ingredientHint: {
        fontSize: 11,
        color: '#B45309',
    },
    ingredientBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    ingredientBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#B45309',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
    },
    modalDismissBtn: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E2D5C8',
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF',
    },
    modalDismissBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#8B7A6A',
    },
    modalGoInventoryBtn: {
        flex: 1.4,
        borderRadius: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#8B6F4E',
    },
    modalGoInventoryBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFF',
    },
    // ─── AI Suggest Order Modal ────────────────────────────────────────
    aiModalCard: {
        width: '100%',
        backgroundColor: '#FFFBF7',
        borderRadius: 24,
        padding: 20,
        maxHeight: '80%',
        shadowColor: '#2D1708',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 20,
        elevation: 10,
        borderWidth: 1,
        borderColor: '#F0DEC8',
        gap: 16,
    },
    aiModalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    aiModalIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F0DEC8',
    },
    aiModalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1F1F1F',
        marginBottom: 3,
    },
    aiModalSubtitle: {
        fontSize: 12,
        color: '#8B7A6A',
        lineHeight: 17,
    },
    aiModeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    aiModeTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2D5C8',
        backgroundColor: '#FFF',
    },
    aiModeTabActive: {
        backgroundColor: '#8B6F4E',
        borderColor: '#8B6F4E',
    },
    aiModeTabText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#8B6F4E',
    },
    aiModeTabTextActive: {
        color: '#FFF',
    },
    aiInputSection: {
        gap: 8,
    },
    aiInputLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#2C1B13',
    },
    aiTextInput: {
        borderWidth: 1,
        borderColor: '#E2D5C8',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        fontSize: 15,
        color: '#1F1F1F',
        backgroundColor: '#FFF',
    },
    aiInputHint: {
        fontSize: 11,
        color: '#B0956A',
    },
    aiDateRow: {
        flexDirection: 'row',
        gap: 10,
    },
    aiDateBox: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E2D5C8',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: '#FFF',
    },
    aiDateLabel: {
        fontSize: 11,
        color: '#9B8B7B',
        marginBottom: 2,
    },
    aiDateValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#2C1B13',
    },
    aiStartBtn: {
        marginTop: 'auto',
        marginBottom: 14,
        width: 94,
        height: 94,
        alignSelf: 'center',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#8B6F4E',
        borderRadius: 47,
    },
    aiStartBtnText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFF',
    },
});

export default MenuVersionPage;

