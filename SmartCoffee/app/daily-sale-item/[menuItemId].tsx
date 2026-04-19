import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS, AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

const COLORS = {
    bg: '#F7F3EF',
    text: '#3C2A21',
    textSecondary: '#8E7B6F',
    border: '#E8E1D9',
    accent: '#D38B2A',
    accentDark: '#A36D2D',
    white: '#FFFFFF',
};

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

interface MenuItemSizeParam {
    sizeName: string;
    sellingPrice: number;
    volume?: number;
}

interface SizePerformance {
    sizeName: string;
    cups: number;
    revenue: number;
    share: number;
    sellingPrice?: number;
    volume?: number;
}

const FALLBACK_IMAGE =
    Image.resolveAssetSource(require('../../assets/AI_RecommendationBackground.jpg')).uri;
const { height: WINDOW_HEIGHT } = Dimensions.get('window');

const encodeFirebaseObjectPath = (path: string) => {
    try {
        return encodeURIComponent(decodeURIComponent(path));
    } catch {
        return encodeURIComponent(path);
    }
};

const normalizeImageUrl = (url: unknown): string => {
    if (!url || typeof url !== 'string') return FALLBACK_IMAGE;
    const trimmed = url.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return FALLBACK_IMAGE;
    const resolved =
        trimmed.startsWith('http://') || trimmed.startsWith('https://')
            ? trimmed
            : `${AUTH_BASE_URL}${trimmed.startsWith('/') ? trimmed : `/images/${trimmed}`}`;

    if (resolved.includes('firebasestorage.googleapis.com')) {
        const oIndex = resolved.indexOf('/o/');
        if (oIndex !== -1) {
            const baseUrl = resolved.substring(0, oIndex + 3);
            const pathWithQuery = resolved.substring(oIndex + 3);
            const [pathOnly, query = ''] = pathWithQuery.split('?');
            const encodedPath = encodeFirebaseObjectPath(pathOnly);
            return query ? `${baseUrl}${encodedPath}?${query}` : `${baseUrl}${encodedPath}`;
        }
    }

    return resolved;
};

const normalizeSizeName = (value?: string | null) => (value || '').trim().toUpperCase();

const getDateKey = (value?: string | null) => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getMonthKey = (value?: string | null) => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

const formatDateKeyLabel = (dateKey: string) => {
    if (!dateKey) return '-';
    const [year, month, day] = dateKey.split('-');
    if (!year || !month || !day) return dateKey;
    return `${day}/${month}/${year}`;
};

const formatMonthKeyLabel = (monthKey: string) => {
    if (!monthKey) return '-';
    const [year, month] = monthKey.split('-');
    if (!year || !month) return monthKey;
    return `${month}/${year}`;
};

const toSizeDisplayName = (sizeName: string) => {
    const normalized = normalizeSizeName(sizeName);
    if (normalized === 'S') return 'Small Size';
    if (normalized === 'M') return 'Medium Size';
    if (normalized === 'L') return 'Large Size';
    return `${normalized} Size`;
};

const formatShortDateChip = (dateKey: string) => {
    const todayKey = getDateKey(new Date().toISOString());
    if (dateKey === todayKey) return 'Today';
    const [_, month, day] = dateKey.split('-');
    if (!month || !day) return dateKey;
    return `${day}/${month}`;
};

const formatShortMonthChip = (monthKey: string) => {
    const currentMonthKey = getMonthKey(new Date().toISOString());
    if (monthKey === currentMonthKey) return 'This month';
    return formatMonthKeyLabel(monthKey);
};

const parseSizeData = (raw?: string | string[]): MenuItemSizeParam[] => {
    const source = Array.isArray(raw) ? raw[0] : raw;
    if (!source) return [];
    try {
        const parsed = JSON.parse(source);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item) => typeof item?.sizeName === 'string')
            .map((item) => ({
                sizeName: String(item.sizeName).trim(),
                sellingPrice: Number(item.sellingPrice) || 0,
                volume: Number(item.volume) || 0,
            }));
    } catch {
        return [];
    }
};

export default function DailySaleItemScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const menuItemIdParam = params.menuItemId as string | undefined;
    const recipeName = params.recipeName as string | undefined;
    const beverageName = params.beverageName as string | undefined;
    console.log('Received params:', params.itemImage);
    const itemImageRaw = (params.itemImage as string | undefined) || FALLBACK_IMAGE;
    const itemImage = normalizeImageUrl(itemImageRaw);
    const hasHeroImage = itemImage !== FALLBACK_IMAGE;
    const sizeDataParam = params.sizeData as string | string[] | undefined;
    const menuSizes = parseSizeData(sizeDataParam);

    const [records, setRecords] = useState<DailySaleRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFilterMode, setSelectedFilterMode] = useState<'day' | 'month'>('day');
    const [selectedDateKey, setSelectedDateKey] = useState('');
    const [selectedMonthKey, setSelectedMonthKey] = useState('');

    const formatPrice = (value?: number) => {
        if (value == null) return '-';
        try {
            return `${value.toLocaleString('vi-VN')} VND`;
        } catch {
            return `${value} VND`;
        }
    };

    const formatDateTime = (value?: string | null) => {
        if (!value) return '-';
        const d = new Date(value);
        if (isNaN(d.getTime())) return value;
        return d.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const loadData = async () => {
        if (!menuItemIdParam) {
            setError('Missing menu item id');
            setLoading(false);
            return;
        }

        const menuItemId = Number(menuItemIdParam);
        if (!Number.isFinite(menuItemId)) {
            setError('Invalid menu item id');
            setLoading(false);
            return;
        }

        try {
            setError(null);
            const response = await authorizedFetch(
                API_ENDPOINTS.dailySale.getByMenuItem(menuItemId),
                {
                    headers: {
                        Accept: '*/*',
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const list: DailySaleRecord[] = Array.isArray(data) ? data : [];
            setRecords(list);

            const dates = Array.from(
                new Set(list.map((record) => getDateKey(record.saleDate)).filter((key) => !!key))
            ).sort((a, b) => b.localeCompare(a));

            setSelectedDateKey((prev) => {
                if (prev && dates.includes(prev)) return prev;
                return dates[0] || '';
            });

            const months = Array.from(
                new Set(list.map((record) => getMonthKey(record.saleDate)).filter((key) => !!key))
            ).sort((a, b) => b.localeCompare(a));

            setSelectedMonthKey((prev) => {
                if (prev && months.includes(prev)) return prev;
                return months[0] || '';
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load sales';
            setError(message);
            Toast.show({ type: 'error', text1: 'Error', text2: message });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [menuItemIdParam]);

    const onRefresh = () => {
        setRefreshing(true);
        setLoading(true);
        loadData();
    };

    const title = recipeName || beverageName || `Menu Item #${menuItemIdParam ?? ''}`;

    const availableDateKeys = Array.from(
        new Set(records.map((record) => getDateKey(record.saleDate)).filter((key) => !!key))
    ).sort((a, b) => b.localeCompare(a));

    const availableMonthKeys = Array.from(
        new Set(records.map((record) => getMonthKey(record.saleDate)).filter((key) => !!key))
    ).sort((a, b) => b.localeCompare(a));

    const filteredRecords = selectedFilterMode === 'month'
        ? (selectedMonthKey
            ? records.filter((record) => getMonthKey(record.saleDate) === selectedMonthKey)
            : [])
        : (selectedDateKey
            ? records.filter((record) => getDateKey(record.saleDate) === selectedDateKey)
            : []);

    const totalRevenue = filteredRecords.reduce(
        (sum, item) => sum + (Number(item.totalRevenue) || 0),
        0
    );
    const totalCups = filteredRecords.reduce(
        (sum, item) => sum + (Number(item.totalCups) || 0),
        0
    );

    const menuSizesSorted = [...menuSizes].sort((a, b) => (a.volume || 0) - (b.volume || 0));

    const performanceMap = new Map<string, { cups: number; revenue: number }>();
    filteredRecords.forEach((record) => {
        const key = normalizeSizeName(record.cupSize || '');
        if (!key) return;

        const current = performanceMap.get(key) || { cups: 0, revenue: 0 };
        current.cups += Number(record.totalCups) || 0;
        current.revenue += Number(record.totalRevenue) || 0;
        performanceMap.set(key, current);
    });

    const orderedSizeKeys = [
        ...menuSizesSorted.map((size) => normalizeSizeName(size.sizeName)).filter((name) => !!name),
        ...Array.from(performanceMap.keys()).filter((name) => !!name),
    ].filter((value, index, arr) => arr.indexOf(value) === index);

    const sizePerformance: SizePerformance[] = orderedSizeKeys
        .map((sizeKey) => {
            const aggregate = performanceMap.get(sizeKey) || { cups: 0, revenue: 0 };
            const sizeDef = menuSizesSorted.find(
                (size) => normalizeSizeName(size.sizeName) === sizeKey
            );
            const share = totalRevenue > 0 ? (aggregate.revenue / totalRevenue) * 100 : 0;

            return {
                sizeName: sizeKey,
                cups: aggregate.cups,
                revenue: aggregate.revenue,
                share,
                sellingPrice: sizeDef?.sellingPrice,
                volume: sizeDef?.volume,
            };
        })
        .sort((a, b) => b.revenue - a.revenue);

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableBack routerBack={router.back} />
                    <Text style={styles.headerTitle}>Menu Item Stats</Text>
                    <View style={{ width: 28 }} />
                </View>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                    <Text style={styles.loadingText}>Loading stats...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>

            <View style={styles.header}>
                <TouchableBack routerBack={router.back} />
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView
                style={styles.scrollContent}
                contentContainerStyle={styles.scrollInner}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.accent]}
                        tintColor={COLORS.accent}
                    />
                }
            >
                {error && (
                    <View style={styles.errorBox}>
                        <Ionicons name="alert-circle" size={20} color={COLORS.accent} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                <View style={styles.heroCard}>
                    {hasHeroImage ? (
                        <Image source={{ uri: itemImage }} style={styles.heroImage} />
                    ) : (
                        <View style={styles.heroImageFallback}>
                            <Ionicons name="cafe" size={48} color="#847362" />
                        </View>
                    )}
                    <View style={[styles.heroOverlay, !hasHeroImage && styles.heroOverlayFallback]}>
                        {/* <Text style={styles.heroTitle} numberOfLines={2}>{title}</Text> */}
                        <View style={styles.heroSizeRow}>
                            {menuSizesSorted.map((size) => (
                                <View key={`${size.sizeName}-${size.sellingPrice}`} style={styles.heroSizeChip}>
                                    <Text style={styles.heroSizeName}>{size.sizeName || '-'}</Text>
                                    <Text style={styles.heroSizePrice}>
                                        {(size.sellingPrice / 1000).toFixed(0)}k
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                {records.length === 0 ? (
                    <View style={styles.emptyContent}>
                        <Ionicons name="document-text" size={40} color={COLORS.textSecondary} />
                        <Text style={styles.emptyTitle}>No sales found</Text>
                        <Text style={styles.emptyText}>This item has no recorded daily sales yet.</Text>
                    </View>
                ) : (
                    <View style={styles.listContent}>
                        <View style={styles.statsRow}>
                            <View style={styles.statCard}>
                                <View style={styles.statIconWrap}>
                                    <Ionicons name="wallet-outline" size={16} color={COLORS.accentDark} />
                                </View>
                                <Text style={styles.statLabel}>TOTAL REVENUE</Text>
                                <Text style={styles.statValue}>{formatPrice(totalRevenue)}</Text>
                            </View>
                            <View style={styles.statCard}>
                                <View style={styles.statIconWrap}>
                                    <Ionicons name="cafe-outline" size={16} color={COLORS.accentDark} />
                                </View>
                                <Text style={styles.statLabel}>TOTAL SALES</Text>
                                <View style={styles.salesValueRow}>
                                    <Text style={styles.statValue}>{totalCups}</Text>
                                    <Text style={styles.salesUnit}>cups</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Performance by Size</Text>
                            <View style={styles.modeFilterRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.modeFilterChip,
                                        selectedFilterMode === 'day' && styles.modeFilterChipActive,
                                    ]}
                                    onPress={() => setSelectedFilterMode('day')}
                                >
                                    <Text
                                        style={[
                                            styles.modeFilterText,
                                            selectedFilterMode === 'day' && styles.modeFilterTextActive,
                                        ]}
                                    >
                                        Day
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.modeFilterChip,
                                        selectedFilterMode === 'month' && styles.modeFilterChipActive,
                                    ]}
                                    onPress={() => setSelectedFilterMode('month')}
                                >
                                    <Text
                                        style={[
                                            styles.modeFilterText,
                                            selectedFilterMode === 'month' && styles.modeFilterTextActive,
                                        ]}
                                    >
                                        Month
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filterRow}
                        >
                            {selectedFilterMode === 'month'
                                ? availableMonthKeys.map((monthKey) => (
                                    <TouchableOpacity
                                        key={monthKey}
                                        style={[
                                            styles.filterChip,
                                            selectedMonthKey === monthKey && styles.filterChipActive,
                                        ]}
                                        onPress={() => setSelectedMonthKey(monthKey)}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipText,
                                                selectedMonthKey === monthKey && styles.filterChipTextActive,
                                            ]}
                                        >
                                            {formatShortMonthChip(monthKey)}
                                        </Text>
                                    </TouchableOpacity>
                                ))
                                : availableDateKeys.map((dateKey) => (
                                    <TouchableOpacity
                                        key={dateKey}
                                        style={[
                                            styles.filterChip,
                                            selectedDateKey === dateKey && styles.filterChipActive,
                                        ]}
                                        onPress={() => setSelectedDateKey(dateKey)}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipText,
                                                selectedDateKey === dateKey && styles.filterChipTextActive,
                                            ]}
                                        >
                                            {formatShortDateChip(dateKey)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                        </ScrollView>

                        {sizePerformance.map((item) => (
                            <View key={item.sizeName} style={styles.performanceCard}>
                                <View style={styles.performanceTopRow}>
                                    <View style={styles.sizeBadge}>
                                        <Text style={styles.sizeBadgeText}>{item.sizeName}</Text>
                                    </View>

                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.performanceTitle}>{toSizeDisplayName(item.sizeName)}</Text>
                                        <Text style={styles.performanceSub}>{item.cups} cups sold</Text>
                                    </View>

                                    <View style={styles.performanceRight}>
                                        <Text style={styles.performanceRevenue}>{formatPrice(item.revenue)}</Text>
                                        <Text style={styles.performanceRevenueLabel}>REVENUE</Text>
                                    </View>
                                </View>

                                <View style={styles.marketHeaderRow}>
                                    <Text style={styles.marketLabel}>MARKET SHARE</Text>
                                    <Text style={styles.marketPercent}>{item.share.toFixed(1)}%</Text>
                                </View>
                                <View style={styles.progressTrack}>
                                    <View
                                        style={[
                                            styles.progressFill,
                                            { width: `${Math.max(0, Math.min(100, item.share))}%` },
                                        ]}
                                    />
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function TouchableBack({ routerBack }: { routerBack: () => void }) {
    return (
        <TouchableOpacity onPress={routerBack} style={styles.backButton}>
            <Ionicons
                name="chevron-back"
                size={24}
                color={COLORS.text}
            />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0ECE6',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: '#F0ECE6',
    },
    backButton: {
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#3A2F23',
    },
    headerDate: {
        fontSize: 10,
        color: '#7E756D',
        fontWeight: '600',
        minWidth: 74,
        textAlign: 'right',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    scrollContent: {
        flex: 1,
        paddingHorizontal: 14,
    },
    scrollInner: {
        paddingBottom: 12,
        minHeight: WINDOW_HEIGHT - 120,
    },
    listContent: {
        paddingBottom: 8,
    },
    heroCard: {
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#222',
        marginTop: 4,
    },
    heroImage: {
        width: '100%',
        height: 230,
    },
    heroImageFallback: {
        width: '100%',
        height: 230,
        backgroundColor: '#EFE7DE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 24,
    },
    heroOverlayFallback: {
        backgroundColor: 'rgba(58, 47, 35, 0.18)',
    },
    heroTitle: {
        color: '#FFFFFF',
        fontSize: 30,
        fontWeight: '800',
    },
    heroSizeRow: {
        flexDirection: 'row',
        marginTop: 10,
        gap: 8,
    },
    heroSizeChip: {
        backgroundColor: 'rgba(245, 240, 232, 0.92)',
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 6,
        alignItems: 'center',
        minWidth: 52,
    },
    heroSizeName: {
        color: '#6E5A46',
        fontSize: 9,
        fontWeight: '700',
    },
    heroSizePrice: {
        color: '#3C2A21',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    statCard: {
        flex: 1,
        borderRadius: 20,
        backgroundColor: '#F8F6F2',
        paddingHorizontal: 12,
        paddingVertical: 16,
        minHeight: 132,
    },
    statIconWrap: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#EDE6DC',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#8F857B',
        letterSpacing: 0.4,
    },
    statValue: {
        marginTop: 6,
        fontSize: 22,
        fontWeight: '800',
        color: '#33271D',
        lineHeight: 26,
    },
    salesValueRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 6,
    },
    salesUnit: {
        fontSize: 12,
        fontWeight: '600',
        color: '#5B5148',
        marginBottom: 3,
    },
    sectionHeaderRow: {
        marginTop: 18,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#3A2F23',
        flexShrink: 1,
    },
    filterRow: {
        paddingBottom: 10,
        gap: 8,
    },
    modeFilterRow: {
        flexDirection: 'row',
        gap: 8,
    },
    modeFilterChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        backgroundColor: '#E5DDD2',
    },
    modeFilterChipActive: {
        backgroundColor: '#3D2E21',
    },
    modeFilterText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6B5B4B',
    },
    modeFilterTextActive: {
        color: '#FFFFFF',
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        backgroundColor: '#EEE8DE',
    },
    filterChipActive: {
        backgroundColor: '#4C3624',
    },
    filterChipText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#786D5F',
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    performanceCard: {
        borderRadius: 18,
        backgroundColor: '#F8F6F2',
        paddingHorizontal: 12,
        paddingVertical: 14,
        marginBottom: 12,
        minHeight: 122,
    },
    performanceTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    sizeBadge: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#7A5C3C',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sizeBadgeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    performanceTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#3A2F23',
    },
    performanceSub: {
        marginTop: 1,
        fontSize: 11,
        color: '#786D62',
        fontWeight: '500',
    },
    performanceRight: {
        alignItems: 'flex-end',
        marginLeft: 10,
    },
    performanceRevenue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#3A2F23',
        lineHeight: 24,
    },
    performanceRevenueLabel: {
        fontSize: 8,
        letterSpacing: 0.4,
        fontWeight: '700',
        color: '#958B80',
    },
    marketHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    marketLabel: {
        fontSize: 10,
        color: '#7C736A',
        fontWeight: '700',
    },
    marketPercent: {
        fontSize: 10,
        color: '#6B5B4B',
        fontWeight: '700',
    },
    progressTrack: {
        marginTop: 8,
        height: 7,
        borderRadius: 999,
        backgroundColor: '#E8E2D9',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 999,
        backgroundColor: '#5C432E',
    },
    emptyContent: {
        alignItems: 'center',
        marginTop: 40,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginTop: 12,
    },
    emptyText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 4,
        textAlign: 'center',
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#FDECEA',
        marginBottom: 12,
    },
    errorText: {
        marginLeft: 8,
        fontSize: 13,
        color: COLORS.text,
        flex: 1,
    },
    loadingText: {
        fontSize: 16,
        color: '#3A2F23',
        marginTop: 12,
    },
});
