import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    RefreshControl,
    ScrollView,
    SectionList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

type HistoryType = 'import' | 'export' | 'adjust';

interface HistoryItem {
    id: string;
    title: string;
    type: HistoryType;
    createdAt: string | null;
    createdAtMs: number;
    noteId?: string | number | null;
}

type ImportDetailResponse = {
    importDetailId?: number;
    importNoteId?: number;
    ingredientId?: number;
    currentQuantity?: number;
    importQuantity?: number;
    updatedQuantity?: number;
    measurement?: string | null;
};

type ExportDetailResponse = {
    exportDetailId?: number;
    exportNoteId?: number;
    ingredientId?: number;
    currentQuantity?: number;
    exportQuantity?: number;
    remainQuantity?: number;
    measurement?: string | null;
};

type HistoryDetail =
    | ({ kind: 'import' } & ImportDetailResponse)
    | ({ kind: 'export' } & ExportDetailResponse);

type InventoryLookup = {
    name: string;
    measurement?: string | null;
};

const COLORS = {
    background: '#F7F2EE',
    card: '#FFFFFF',
    ink: '#1E1B16',
    muted: '#7A6F67',
    accent: '#2B1C15',
    border: '#EFE4D8',
    surface: '#FBF7F2',
    success: '#15803D',
    danger: '#B91C1C',
    warning: '#B45309',
};

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'import', label: 'Import' },
    { key: 'export', label: 'Export' },
];

LocaleConfig.locales.en = {
    monthNames: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ],
    monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    today: 'Today',
};
LocaleConfig.defaultLocale = 'en';

const INVENTORY_HISTORY_TIME_ZONE = 'Asia/Bangkok';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const HAS_TIMEZONE_SUFFIX_REGEX = /(Z|[+-]\d{2}:\d{2})$/i;

const getDateKeyInTimeZone = (value: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: INVENTORY_HISTORY_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(value);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return `${year}-${month}-${day}`;
};

const getTypeConfig = (type: HistoryType) => {
    if (type === 'import') {
        return {
            label: 'Import',
            icon: 'arrow-down-circle' as const,
            color: COLORS.success,
            bgColor: '#E7F6ED',
        };
    }

    if (type === 'export') {
        return {
            label: 'Export',
            icon: 'arrow-up-circle' as const,
            color: COLORS.danger,
            bgColor: '#FBE9E9',
        };
    }

    return {
        label: 'Adjust',
        icon: 'repeat' as const,
        color: COLORS.warning,
        bgColor: '#FEF3C7',
    };
};

export default function InventoryHistoryScreen() {
    const router = useRouter();
    const { coffeeShopId } = useAuth();
    const [activeFilter, setActiveFilter] = useState<'all' | 'import' | 'export'>('all');
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
    const [dateFilterVisible, setDateFilterVisible] = useState(false);
    const [draftFromDate, setDraftFromDate] = useState('');
    const [draftToDate, setDraftToDate] = useState('');
    const [appliedFromDate, setAppliedFromDate] = useState('');
    const [appliedToDate, setAppliedToDate] = useState('');
    const [inventoryMap, setInventoryMap] = useState<Record<string, InventoryLookup>>({});
    const [detailItems, setDetailItems] = useState<HistoryDetail[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);

    const parseDate = (value?: string | null) => {
        if (!value) return null;
        const raw = String(value).trim();
        if (!raw) return null;

        // Backend stores timestamps without timezone, so treat them as UTC+7 local clock time.
        const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
        const normalizedWithZone = HAS_TIMEZONE_SUFFIX_REGEX.test(normalized)
            ? normalized
            : `${normalized}+07:00`;
        const parsed = new Date(normalizedWithZone);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const formatTime = (value?: string | null) => {
        const parsed = parseDate(value);
        if (!parsed) return '--:--';
        return parsed.toLocaleTimeString('en-US', {
            timeZone: INVENTORY_HISTORY_TIME_ZONE,
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDateLabel = (value?: string | null) => {
        const parsed = parseDate(value);
        if (!parsed) return 'Unknown date';
        const todayKey = getDateKeyInTimeZone(new Date());
        const yesterdayKey = getDateKeyInTimeZone(new Date(Date.now() - ONE_DAY_MS));
        const parsedKey = getDateKeyInTimeZone(parsed);
        if (parsedKey === todayKey) return 'Today';
        if (parsedKey === yesterdayKey) return 'Yesterday';
        return parsed.toLocaleDateString('en-US', {
            timeZone: INVENTORY_HISTORY_TIME_ZONE,
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        });
    };

    const formatDateTime = (value?: string | null) => {
        const parsed = parseDate(value);
        if (!parsed) return 'Unknown time';
        return parsed.toLocaleString('en-US', {
            timeZone: INVENTORY_HISTORY_TIME_ZONE,
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDateInputValue = (value?: Date | null) => {
        if (!value) return '';
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatQuantity = (quantity?: number | null, measurement?: string | null) => {
        if (quantity === null || quantity === undefined) return '--';
        return measurement ? `${quantity} ${measurement}` : `${quantity}`;
    };

    const parseDateInput = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parts = trimmed.split('-').map((part) => Number(part));
        if (parts.length !== 3) return null;
        const [year, month, day] = parts;
        if (!year || !month || !day) return null;
        const parsed = new Date(year, month - 1, day);
        if (
            parsed.getFullYear() !== year ||
            parsed.getMonth() !== month - 1 ||
            parsed.getDate() !== day
        ) {
            return null;
        }
        return parsed;
    };

    const applyDateFilter = () => {
        setAppliedFromDate(draftFromDate.trim());
        setAppliedToDate(draftToDate.trim());
        setDateFilterVisible(false);
    };

    const clearDateFilter = () => {
        setDraftFromDate('');
        setDraftToDate('');
        setAppliedFromDate('');
        setAppliedToDate('');
    };

    const calendarTheme = useMemo(
        () => ({
            calendarBackground: COLORS.card,
            textSectionTitleColor: COLORS.muted,
            dayTextColor: COLORS.ink,
            monthTextColor: COLORS.ink,
            arrowColor: COLORS.accent,
            todayTextColor: COLORS.accent,
            textDisabledColor: '#CBBEB3',
            selectedDayBackgroundColor: COLORS.accent,
            selectedDayTextColor: '#FFFFFF',
            textDayFontWeight: '600',
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
        }),
        []
    );

    const buildMarkedDates = (startDate?: string, endDate?: string) => {
        if (!startDate) return {} as Record<string, any>;
        if (!endDate) {
            return {
                [startDate]: {
                    customStyles: {
                        container: styles.calendarMarkedCircle,
                        text: styles.calendarMarkedText,
                    },
                },
            };
        }

        const marks: Record<string, any> = {};
        const start = parseDateInput(startDate);
        const end = parseDateInput(endDate);
        if (!start || !end) return marks;

        const current = new Date(start.getTime());
        while (current <= end) {
            const dateString = formatDateInputValue(current);
            marks[dateString] = {
                customStyles: {
                    container: styles.calendarMarkedCircle,
                    text: styles.calendarMarkedText,
                },
            };
            current.setDate(current.getDate() + 1);
        }

        return marks;
    };

    const handleCalendarPress = (dateString: string) => {
        if (!draftFromDate || (draftFromDate && draftToDate)) {
            setDraftFromDate(dateString);
            setDraftToDate('');
            return;
        }

        if (dateString < draftFromDate) {
            setDraftFromDate(dateString);
            setDraftToDate('');
            return;
        }

        setDraftToDate(dateString);
    };

    const isToday = (value?: string | null) => {
        const parsed = parseDate(value);
        if (!parsed) return false;
        return getDateKeyInTimeZone(parsed) === getDateKeyInTimeZone(new Date());
    };

    const loadInventoryLookup = async () => {
        if (!coffeeShopId) {
            setInventoryMap({});
            return;
        }

        try {
            const response = await authorizedFetch(API_ENDPOINTS.shopInventory.getByShop(coffeeShopId));
            if (!response.ok) {
                throw new Error('Inventory request failed');
            }

            const data = await response.json();
            const list = Array.isArray(data) ? data : [];
            const nextMap: Record<string, InventoryLookup> = {};
            list.forEach((item: any) => {
                const ingredientId = item.ingredientId ?? item.IngredientId;
                if (!ingredientId) return;
                const name =
                    item.ingredient?.name ??
                    item.ingredient?.Name ??
                    item.Ingredient?.Name ??
                    `Ingredient #${ingredientId}`;
                const measurement = item.measurement ?? item.Measurement ?? item.ingredient?.measurement ?? null;
                nextMap[String(ingredientId)] = {
                    name: String(name),
                    measurement: measurement ? String(measurement) : null,
                };
            });
            setInventoryMap(nextMap);
        } catch (fetchError) {
            setInventoryMap({});
        }
    };

    const loadHistory = async (isRefresh = false) => {
        if (!coffeeShopId) {
            setItems([]);
            setLoading(false);
            setRefreshing(false);
            setError('Shop not found.');
            return;
        }

        try {
            setError(null);
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const [importResponse, exportResponse] = await Promise.all([
                authorizedFetch(API_ENDPOINTS.importNote.getByShop(coffeeShopId)),
                authorizedFetch(API_ENDPOINTS.exportNote.getByShop(coffeeShopId)),
            ]);

            if (!importResponse.ok || !exportResponse.ok) {
                throw new Error('Request failed');
            }

            const importData = await importResponse.json();
            const exportData = await exportResponse.json();

            const importItems = Array.isArray(importData) ? importData : [];
            const exportItems = Array.isArray(exportData) ? exportData : [];

            const mappedImport: HistoryItem[] = importItems.map((item: any) => {
                const createdAt = item.createdAt ?? item.createdDate ?? null;
                const parsed = parseDate(createdAt);
                const noteId = item.importNoteId ?? item.id ?? null;
                return {
                    id: `import-${noteId ?? Math.random()}`,
                    title: item.title ? String(item.title) : 'Import Note',
                    type: 'import',
                    createdAt: createdAt ? String(createdAt) : null,
                    createdAtMs: parsed ? parsed.getTime() : 0,
                    noteId,
                };
            });

            const mappedExport: HistoryItem[] = exportItems.map((item: any) => {
                const createdAt = item.createdAt ?? item.createdDate ?? null;
                const parsed = parseDate(createdAt);
                const noteId = item.exportNoteId ?? item.id ?? null;
                return {
                    id: `export-${noteId ?? Math.random()}`,
                    title: item.title ? String(item.title) : 'Export Note',
                    type: 'export',
                    createdAt: createdAt ? String(createdAt) : null,
                    createdAtMs: parsed ? parsed.getTime() : 0,
                    noteId,
                };
            });

            const merged = [...mappedImport, ...mappedExport].sort(
                (a, b) => b.createdAtMs - a.createdAtMs
            );
            setItems(merged);
        } catch (fetchError) {
            setError('Unable to load inventory history.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadHistory(false);
    }, [coffeeShopId]);

    useEffect(() => {
        loadInventoryLookup();
    }, [coffeeShopId]);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!selectedItem?.noteId) {
                setDetailItems([]);
                setDetailError(null);
                return;
            }

            try {
                setDetailLoading(true);
                setDetailError(null);

                const endpoint =
                    selectedItem.type === 'import'
                        ? API_ENDPOINTS.importDetail.getByNote(selectedItem.noteId)
                        : API_ENDPOINTS.exportDetail.getByNote(selectedItem.noteId);

                const response = await authorizedFetch(endpoint);
                if (!response.ok) {
                    throw new Error('Detail request failed');
                }

                const data = await response.json();
                const list = Array.isArray(data) ? data : [];
                if (selectedItem.type === 'import') {
                    const mapped: HistoryDetail[] = list.map((detail: ImportDetailResponse, index: number) => ({
                        kind: 'import',
                        ...detail,
                        importDetailId: detail.importDetailId ?? index,
                    }));
                    setDetailItems(mapped);
                } else {
                    const mapped: HistoryDetail[] = list.map((detail: ExportDetailResponse, index: number) => ({
                        kind: 'export',
                        ...detail,
                        exportDetailId: detail.exportDetailId ?? index,
                    }));
                    setDetailItems(mapped);
                }
            } catch (fetchError) {
                setDetailItems([]);
                setDetailError('Unable to load note items.');
            } finally {
                setDetailLoading(false);
            }
        };

        fetchDetails();
    }, [selectedItem]);

    const filteredSections = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        const fromDate = parseDateInput(appliedFromDate);
        const toDate = parseDateInput(appliedToDate);
        const fromMs = fromDate ? new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime() : null;
        const toMs = toDate
            ? new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999).getTime()
            : null;
        const filteredItems = (activeFilter === 'all'
            ? items
            : items.filter((item) => item.type === activeFilter))
            .filter((item) => {
                if (!normalizedQuery) return true;
                const title = item.title.toLowerCase();
                const noteId = item.noteId ? String(item.noteId).toLowerCase() : '';
                return title.includes(normalizedQuery) || noteId.includes(normalizedQuery);
            })
            .filter((item) => {
                if (!fromMs && !toMs) return true;
                const itemTime = item.createdAtMs || parseDate(item.createdAt)?.getTime() || 0;
                if (!itemTime) return false;
                if (fromMs && itemTime < fromMs) return false;
                if (toMs && itemTime > toMs) return false;
                return true;
            });

        const groups = filteredItems.reduce<Record<string, HistoryItem[]>>((acc, item) => {
            const label = formatDateLabel(item.createdAt);
            if (!acc[label]) {
                acc[label] = [];
            }
            acc[label].push(item);
            return acc;
        }, {});

        return Object.entries(groups).map(([title, data]) => ({ title, data }));
    }, [activeFilter, items, searchQuery, appliedFromDate, appliedToDate]);

    const summary = useMemo(() => {
        const total = items.length;
        const totalImport = items.filter((item) => item.type === 'import').length;
        const totalExport = items.filter((item) => item.type === 'export').length;
        const todayCount = items.filter((item) => isToday(item.createdAt)).length;
        return { total, totalImport, totalExport, todayCount };
    }, [items]);

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.loaderContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => loadHistory(false)}>
                    <Text style={styles.retryText}>Thử lại</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.headerRow}>
                <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={20} color={COLORS.ink} />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                    <Text style={styles.headerTitle}>Inventory History</Text>
                    <Text style={styles.headerSubtitle}>Track import and export activity</Text>
                </View>
                <View style={styles.headerIconPlaceholder} />
            </View>

            <SectionList
                sections={filteredSections}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <View style={styles.listHeaderWrap}>
                        <View style={styles.searchRow}>
                            <Ionicons name="search" size={16} color={COLORS.muted} />
                            <TextInput
                                placeholder="Search by title or ID"
                                placeholderTextColor={COLORS.muted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                style={styles.searchInput}
                            />
                            {searchQuery.length > 0 ? (
                                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearButton}>
                                    <Ionicons name="close" size={14} color={COLORS.muted} />
                                </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                                style={styles.searchFilterButton}
                                onPress={() => {
                                    setDraftFromDate(appliedFromDate);
                                    setDraftToDate(appliedToDate);
                                    setDateFilterVisible(true);
                                }}
                            >
                                <Ionicons name="options" size={16} color={COLORS.ink} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.summaryCard}>
                            <View>
                                <Text style={styles.summaryLabel}>Total transactions</Text>
                                <Text style={styles.summaryValue}>{summary.total}</Text>
                                <Text style={styles.summaryHint}>Today: {summary.todayCount}</Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryPills}>
                                <View style={[styles.summaryPill, styles.summaryPillSuccess]}>
                                    <Ionicons name="arrow-down-circle" size={14} color={COLORS.success} />
                                    <Text style={styles.summaryPillText}>Import {summary.totalImport}</Text>
                                </View>
                                <View style={[styles.summaryPill, styles.summaryPillDanger]}>
                                    <Ionicons name="arrow-up-circle" size={14} color={COLORS.danger} />
                                    <Text style={styles.summaryPillText}>Export {summary.totalExport}</Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.filterRow}>
                            {FILTERS.map((filter) => {
                                const isActive = activeFilter === filter.key;
                                return (
                                    <TouchableOpacity
                                        key={filter.key}
                                        style={[styles.filterChip, isActive && styles.filterChipActive]}
                                        onPress={() => setActiveFilter(filter.key as typeof activeFilter)}
                                    >
                                        <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                                            {filter.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                }
                renderSectionHeader={({ section }) => (
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.sectionLine} />
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <View style={styles.sectionLine} />
                    </View>
                )}
                renderItem={({ item }) => {
                    const typeConfig = getTypeConfig(item.type);
                    return (
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => setSelectedItem(item)}
                            style={styles.card}
                        >
                            <View style={[styles.iconWrap, { backgroundColor: typeConfig.bgColor }]}> 
                                <Ionicons name={typeConfig.icon} size={18} color={typeConfig.color} />
                            </View>
                            <View style={styles.cardContent}>
                                <View style={styles.cardHeaderRow}>
                                    <Text style={styles.cardTitle} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                    <View style={[styles.typeChip, { backgroundColor: typeConfig.bgColor }]}>
                                        <Text style={[styles.typeChipText, { color: typeConfig.color }]}>
                                            {typeConfig.label}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.cardMeta}>
                                    {formatTime(item.createdAt)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="cube-outline" size={28} color={COLORS.muted} />
                        <Text style={styles.emptyTitle}>No transactions</Text>
                        <Text style={styles.emptySubtitle}>Try a different filter.</Text>
                    </View>
                }
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadHistory(true)}
                        colors={[COLORS.accent]}
                        tintColor={COLORS.accent}
                    />
                }
                stickySectionHeadersEnabled={false}
                showsVerticalScrollIndicator={false}
            />

            <Modal
                transparent
                animationType="fade"
                visible={Boolean(selectedItem)}
                onRequestClose={() => setSelectedItem(null)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={styles.modalBackdrop}
                    onPress={() => setSelectedItem(null)}
                >
                    <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
                        {selectedItem ? (
                            <>
                                <View style={styles.modalHeader}>
                                    <View style={[styles.modalIcon, { backgroundColor: getTypeConfig(selectedItem.type).bgColor }]}>
                                        <Ionicons
                                            name={getTypeConfig(selectedItem.type).icon}
                                            size={18}
                                            color={getTypeConfig(selectedItem.type).color}
                                        />
                                    </View>
                                    <View style={styles.modalHeaderText}>
                                        <Text style={styles.modalTitle} numberOfLines={2}>
                                            {selectedItem.title}
                                        </Text>
                                        <Text style={styles.modalSubtitle}>
                                            {getTypeConfig(selectedItem.type).label}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.modalCloseIcon}
                                        onPress={() => setSelectedItem(null)}
                                    >
                                        <Ionicons name="close" size={16} color={COLORS.muted} />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.modalBody}>
                                    <View style={styles.modalRow}>
                                        <Text style={styles.modalLabel}>Transaction ID</Text>
                                        <Text style={styles.modalValue}>{selectedItem.noteId ?? '--'}</Text>
                                    </View>
                                    <View style={styles.modalRow}>
                                        <Text style={styles.modalLabel}>Time</Text>
                                        <Text style={styles.modalValue}>{formatDateTime(selectedItem.createdAt)}</Text>
                                    </View>
                                    <View style={styles.modalSection}>
                                        <View style={styles.modalSectionHeader}>
                                            <Text style={styles.modalSectionTitle}>Items</Text>
                                            <Text style={styles.modalSectionCount}>{detailItems.length}</Text>
                                        </View>
                                        {detailLoading ? (
                                            <View style={styles.modalInlineState}>
                                                <ActivityIndicator size="small" color={COLORS.accent} />
                                                <Text style={styles.modalInlineText}>Loading items...</Text>
                                            </View>
                                        ) : detailError ? (
                                            <Text style={styles.modalInlineText}>{detailError}</Text>
                                        ) : detailItems.length ? (
                                            <ScrollView
                                                style={styles.modalItemsScroll}
                                                contentContainerStyle={styles.modalItemsContent}
                                                showsVerticalScrollIndicator={false}
                                            >
                                                {detailItems.map((detail, index) => {
                                                    const ingredientId = detail.ingredientId ?? null;
                                                    const lookup = ingredientId ? inventoryMap[String(ingredientId)] : null;
                                                    const displayName =
                                                        lookup?.name || (ingredientId ? `Ingredient #${ingredientId}` : 'Unknown item');
                                                    const measurement = detail.measurement ?? lookup?.measurement ?? null;
                                                    const quantityValue =
                                                        detail.kind === 'import'
                                                            ? formatQuantity(detail.importQuantity, measurement)
                                                            : formatQuantity(detail.exportQuantity, measurement);
                                                    const secondValue =
                                                        detail.kind === 'import'
                                                            ? formatQuantity(detail.updatedQuantity, measurement)
                                                            : formatQuantity(detail.remainQuantity, measurement);
                                                    return (
                                                        <View key={`${detail.kind}-${ingredientId ?? 'item'}-${index}`} style={styles.modalItemCard}>
                                                            <Text style={styles.modalItemTitle}>{displayName}</Text>
                                                            <View style={styles.modalItemRow}>
                                                                <Text style={styles.modalItemLabel}>
                                                                    {detail.kind === 'import' ? 'Import qty' : 'Export qty'}
                                                                </Text>
                                                                <Text style={styles.modalItemValue}>{quantityValue}</Text>
                                                            </View>
                                                            <View style={styles.modalItemRow}>
                                                                <Text style={styles.modalItemLabel}>
                                                                    {detail.kind === 'import' ? 'Updated qty' : 'Remain qty'}
                                                                </Text>
                                                                <Text style={styles.modalItemValue}>{secondValue}</Text>
                                                            </View>
                                                        </View>
                                                    );
                                                })}
                                            </ScrollView>
                                        ) : (
                                            <Text style={styles.modalInlineText}>No items found for this note.</Text>
                                        )}
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectedItem(null)}>
                                    <Text style={styles.modalCloseButtonText}>Close</Text>
                                </TouchableOpacity>
                            </>
                        ) : null}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            <Modal
                transparent
                animationType="fade"
                visible={dateFilterVisible}
                onRequestClose={() => setDateFilterVisible(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={styles.modalBackdrop}
                    onPress={() => setDateFilterVisible(false)}
                >
                    <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={[styles.modalIcon, { backgroundColor: COLORS.surface }]}>
                                <Ionicons name="calendar" size={18} color={COLORS.ink} />
                            </View>
                            <View style={styles.modalHeaderText}>
                                <Text style={styles.modalTitle}>Select date range</Text>
                                <Text style={styles.modalSubtitle}>Format: YYYY-MM-DD</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.modalCloseIcon}
                                onPress={() => setDateFilterVisible(false)}
                            >
                                <Ionicons name="close" size={16} color={COLORS.muted} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.dateInputGroup}>
                            <View style={styles.rangeRow}>
                                <View style={styles.rangeChip}>
                                    <Text style={styles.rangeLabel}>From</Text>
                                    <Text style={styles.rangeValue}>{draftFromDate || 'Any'}</Text>
                                </View>
                                <View style={styles.rangeChip}>
                                    <Text style={styles.rangeLabel}>To</Text>
                                    <Text style={styles.rangeValue}>{draftToDate || 'Any'}</Text>
                                </View>
                            </View>
                            <View style={styles.calendarContainer}>
                                <Calendar
                                    markingType="custom"
                                    markedDates={buildMarkedDates(draftFromDate, draftToDate)}
                                    onDayPress={(day) => handleCalendarPress(day.dateString)}
                                    theme={calendarTheme}
                                />
                            </View>
                        </View>
                        <View style={styles.filterActions}>
                            <TouchableOpacity style={styles.filterClearButton} onPress={clearDateFilter}>
                                <Text style={styles.filterClearText}>Clear</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.filterApplyButton} onPress={applyDateFilter}>
                                <Text style={styles.filterApplyText}>Apply</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loaderContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        backgroundColor: COLORS.background,
    },
    errorText: {
        color: COLORS.ink,
        textAlign: 'center',
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: 22,
        paddingVertical: 10,
        borderRadius: 999,
    },
    retryText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 10,
    },
    headerTitleWrap: {
        flex: 1,
        alignItems: 'center',
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: COLORS.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    headerIconPlaceholder: {
        width: 40,
        height: 40,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.ink,
    },
    headerSubtitle: {
        marginTop: 2,
        fontSize: 12,
        color: COLORS.muted,
    },
    listHeaderWrap: {
        gap: 12,
        paddingBottom: 8,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: COLORS.ink,
    },
    searchClearButton: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
    },
    searchFilterButton: {
        width: 34,
        height: 34,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    summaryCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    summaryLabel: {
        fontSize: 12,
        color: COLORS.muted,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    summaryValue: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.ink,
        marginTop: 6,
    },
    summaryHint: {
        marginTop: 4,
        fontSize: 12,
        color: COLORS.muted,
    },
    summaryDivider: {
        width: 1,
        height: '100%',
        backgroundColor: COLORS.border,
        marginHorizontal: 14,
    },
    summaryPills: {
        gap: 10,
        alignItems: 'flex-end',
    },
    summaryPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
    },
    summaryPillSuccess: {
        backgroundColor: '#E7F6ED',
    },
    summaryPillDanger: {
        backgroundColor: '#FBE9E9',
    },
    summaryPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.ink,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 10,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    filterChipActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.ink,
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 28,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 14,
        marginBottom: 8,
    },
    sectionLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.border,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1.4,
        color: COLORS.muted,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardContent: {
        flex: 1,
        marginLeft: 12,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.ink,
        flex: 1,
        marginRight: 10,
    },
    typeChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    typeChipText: {
        fontSize: 11,
        fontWeight: '700',
    },
    cardMeta: {
        fontSize: 12,
        color: COLORS.muted,
        marginTop: 6,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.ink,
        marginTop: 8,
    },
    emptySubtitle: {
        fontSize: 12,
        color: COLORS.muted,
        marginTop: 6,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 12, 10, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        width: '100%',
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modalIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalHeaderText: {
        flex: 1,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.ink,
    },
    modalSubtitle: {
        fontSize: 12,
        color: COLORS.muted,
        marginTop: 2,
    },
    modalCloseIcon: {
        width: 32,
        height: 32,
        borderRadius: 12,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBody: {
        marginTop: 16,
        gap: 10,
    },
    modalSection: {
        marginTop: 6,
        gap: 10,
    },
    modalSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modalSectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    modalSectionCount: {
        fontSize: 12,
        color: COLORS.muted,
        fontWeight: '600',
    },
    modalInlineState: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 6,
    },
    modalInlineText: {
        fontSize: 12,
        color: COLORS.muted,
    },
    modalItemsScroll: {
        maxHeight: 280,
    },
    modalItemsContent: {
        gap: 10,
        paddingBottom: 4,
    },
    modalItemCard: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        padding: 12,
        gap: 8,
    },
    modalItemTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.ink,
    },
    modalItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modalItemLabel: {
        fontSize: 12,
        color: COLORS.muted,
        fontWeight: '600',
    },
    modalItemValue: {
        fontSize: 12,
        color: COLORS.ink,
        fontWeight: '700',
    },
    modalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    modalLabel: {
        fontSize: 12,
        color: COLORS.muted,
        fontWeight: '700',
    },
    modalValue: {
        fontSize: 13,
        color: COLORS.ink,
        fontWeight: '600',
    },
    modalCloseButton: {
        marginTop: 18,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
    },
    modalCloseButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    dateInputGroup: {
        marginTop: 16,
        gap: 12,
    },
    rangeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    rangeChip: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    rangeLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.muted,
    },
    rangeValue: {
        marginTop: 4,
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.ink,
    },
    calendarContainer: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
    },
    calendarMarkedCircle: {
        backgroundColor: COLORS.accent,
        borderRadius: 999,
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
    },
    calendarMarkedText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    filterActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        marginTop: 18,
    },
    filterClearButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        backgroundColor: COLORS.surface,
    },
    filterClearText: {
        fontWeight: '700',
        color: COLORS.muted,
    },
    filterApplyButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
    },
    filterApplyText: {
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
