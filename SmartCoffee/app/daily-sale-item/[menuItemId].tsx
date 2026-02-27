import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS } from '@/services/api';
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

export default function DailySaleItemScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const menuItemIdParam = params.menuItemId as string | undefined;
    const recipeName = params.recipeName as string | undefined;
    const beverageName = params.beverageName as string | undefined;

    const [records, setRecords] = useState<DailySaleRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const formatPrice = (value?: number) => {
        if (value == null) return '-';
        try {
            return `${value.toLocaleString('vi-VN')} đ`;
        } catch {
            return `${value} đ`;
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

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableBack routerBack={router.back} />
                    <Text style={styles.headerTitle}>Daily Sales</Text>
                    <View style={{ width: 28 }} />
                </View>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                    <Text style={styles.loadingText}>Loading sales...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableBack routerBack={router.back} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {title}
                    </Text>
                    <Text style={styles.headerSubtitle}>Sales history by size</Text>
                </View>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView
                style={styles.scrollContent}
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

                {records.length === 0 ? (
                    <View style={styles.emptyContent}>
                        <Ionicons name="document-text" size={40} color={COLORS.textSecondary} />
                        <Text style={styles.emptyTitle}>No sales found</Text>
                        <Text style={styles.emptyText}>This item has no recorded daily sales yet.</Text>
                    </View>
                ) : (
                    <View style={styles.listContent}>
                        {records.map((record) => (
                            <View key={record.salesId} style={styles.card}>
                                <View style={styles.cardRow}>
                                    <Text style={styles.cardLabel}>Date</Text>
                                    <Text style={styles.cardValue}>{formatDateTime(record.saleDate)}</Text>
                                </View>
                                <View style={styles.cardRow}>
                                    <Text style={styles.cardLabel}>Cup size</Text>
                                    <Text style={styles.cardValue}>{record.cupSize || '-'}</Text>
                                </View>
                                <View style={styles.cardRow}>
                                    <Text style={styles.cardLabel}>Total cups</Text>
                                    <Text style={styles.cardValue}>{record.totalCups}</Text>
                                </View>
                                <View style={styles.cardRow}>
                                    <Text style={styles.cardLabel}>Total revenue</Text>
                                    <Text style={styles.cardValue}>{formatPrice(record.totalRevenue)}</Text>
                                </View>
                                {record.createdAt && (
                                    <Text style={styles.cardMeta}>Created at: {formatDateTime(record.createdAt)}</Text>
                                )}
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
        <Ionicons
            name="chevron-back"
            size={28}
            color={COLORS.text}
            onPress={routerBack}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
    },
    headerSubtitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
        fontWeight: '500',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    scrollContent: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    listContent: {
        paddingBottom: 20,
    },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    cardLabel: {
        fontSize: 13,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    cardValue: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
    },
    cardMeta: {
        marginTop: 6,
        fontSize: 11,
        color: COLORS.textSecondary,
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
        color: COLORS.text,
        marginTop: 12,
    },
});
