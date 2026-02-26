import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { API_ENDPOINTS, AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

interface ShopBeverage {
    beverageId: number;
    name: string;
    status: string;
    beverageCategoryId: number;
    beverageCategoryName: string;
    imageUrl?: string | null;
}

interface ShopRecipe {
    recipeId: number;
    recipeName: string;
    image?: string | null;
}

interface MenuItemApi {
    menuItemId: number;
    menuId: number;
    description?: string | null;
    sellingPrice: number;
    addedDate: string;
    shopBeverage?: ShopBeverage;
    shopRecipe?: ShopRecipe;
}

interface MenuGroupApi {
    menuGroupId: number;
    name: string;
    orderIndex: number;
    menuItems?: MenuItemApi[];
}

interface MenuDetailApi {
    menuId: number;
    menuHeaderId: number;
    versionNumber: string;
    status: string;
    created: string;
    isActive: boolean;
    image?: string | null;
    menuGroups?: MenuGroupApi[];
}

const fallbackImage = require('../../assets/1.jpg');

const resolveMenuHeaderImage = (image?: string | null): any => {
    if (!image || image === 'null' || image === 'undefined') return fallbackImage;
    if (image.startsWith('http://') || image.startsWith('https://')) {
        return { uri: image };
    }
    if (image.startsWith('/')) {
        return { uri: `${AUTH_BASE_URL}${image}` };
    }
    return { uri: `${AUTH_BASE_URL}/images/${image}` };
};

const resolveImage = (item: MenuItemApi): any => {
    const recipeImage = item.shopRecipe?.image;
    const beverageImage = item.shopBeverage?.imageUrl;
    const raw = recipeImage ?? beverageImage ?? null;
    if (!raw || raw === 'null' || raw === 'undefined') return fallbackImage;
    if (typeof raw === 'string' && (raw.startsWith('http://') || raw.startsWith('https://'))) {
        return { uri: raw };
    }
    return fallbackImage;
};

const formatPrice = (value: number) => {
    if (!Number.isFinite(value)) return '-';
    try {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `${value} đ`;
    }
};

export default function MenuVersionDetailScreen() {
    const router = useRouter();
    const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [menu, setMenu] = useState<MenuDetailApi | null>(null);

    useEffect(() => {
        const fetchDetail = async () => {
            if (!id) {
                setError('Menu version id is missing.');
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const numericId = Number(id);
                const url = Number.isFinite(numericId)
                    ? API_ENDPOINTS.menu.getById(numericId)
                    : `${API_ENDPOINTS.menu.getById(0)}`.replace('/0', `/${id}`);

                const response = await authorizedFetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to load menu version (${response.status}).`);
                }

                const json: MenuDetailApi = await response.json();
                setMenu(json);
            } catch (err) {
                setError('Unable to load menu version details.');
            } finally {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [id]);

    const headerTitle = (() => {
        if (title) return String(title);
        if (!menu) return 'Menu Version Detail';
        return `Menu ver ${menu.versionNumber}`;
    })();

    const renderMenuItem = ({ item }: { item: MenuItemApi }) => {
        const name =
            item.shopRecipe?.recipeName ||
            item.shopBeverage?.name ||
            'Unnamed Item';
        const category = item.shopBeverage?.beverageCategoryName;

        return (
            <View style={styles.itemCard}>
                <Image source={resolveImage(item)} style={styles.itemImage} />
                <View style={styles.itemContent}>
                    <Text style={styles.itemName}>{name}</Text>
                    {category ? <Text style={styles.itemCategory}>{category}</Text> : null}
                    {item.description ? (
                        <Text numberOfLines={2} style={styles.itemDescription}>
                            {item.description}
                        </Text>
                    ) : null}
                    <Text style={styles.itemPrice}>{formatPrice(item.sellingPrice)}</Text>
                </View>
            </View>
        );
    };

    const renderGroup = ({ item }: { item: MenuGroupApi }) => {
        const data = item.menuItems ?? [];

        return (
            <View style={styles.groupSection}>
                <Text style={styles.groupTitle}>{item.name}</Text>
                {data.length === 0 ? (
                    <Text style={styles.groupEmpty}>No items in this group.</Text>
                ) : (
                    <FlatList
                        data={data}
                        keyExtractor={(m) => String(m.menuItemId)}
                        renderItem={renderMenuItem}
                        scrollEnabled={false}
                        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
                    />
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={22} color="#3C2A21" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {headerTitle}
                </Text>
                <View style={styles.headerSpacer} />
            </View> */}

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#8B6F4E" />
                </View>
            ) : error ? (
                <View style={styles.center}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : !menu ? (
                <View style={styles.center}>
                    <Text style={styles.errorText}>No data.</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.heroCard}>
                        <Image
                            source={resolveMenuHeaderImage(menu.image)}
                            style={styles.heroImage}
                        />
                        <View style={styles.heroOverlay} />

                        <View style={styles.heroTopRow}>
                            <TouchableOpacity
                                style={styles.heroIconButton}
                                onPress={() => router.back()}
                            >
                                <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.heroIconButton}>
                                <Ionicons name="pencil" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.heroBottomArea}>
                            <View style={styles.heroBadgesRow}>
                                <View style={styles.versionBadge}>
                                    <Text style={styles.versionBadgeText}>
                                        PHIÊN BẢN {menu.versionNumber}
                                    </Text>
                                </View>
                                <View style={styles.dateBadge}>
                                    <Text style={styles.dateBadgeText}>
                                        {new Date(menu.created).toLocaleDateString('vi-VN')}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.heroTitle} numberOfLines={2}>
                                {headerTitle}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.metaCard}>
                        <Text style={styles.metaTitle}>Version Info</Text>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Version</Text>
                            <Text style={styles.metaValue}>{menu.versionNumber}</Text>
                        </View>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Status</Text>
                            <Text style={styles.metaValue}>{menu.status}</Text>
                        </View>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Created</Text>
                            <Text style={styles.metaValue}>{new Date(menu.created).toLocaleString()}</Text>
                        </View>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Active</Text>
                            <Text style={styles.metaValue}>{menu.isActive ? 'Yes' : 'No'}</Text>
                        </View>
                    </View>

                    {(menu.menuGroups ?? []).map((group) => (
                        <View key={group.menuGroupId}>
                            {renderGroup({ item: group })}
                        </View>
                    ))}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F6F1EB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: '#F6F1EB',
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F1E7DC',
    },
    headerTitle: {
        flex: 1,
        marginHorizontal: 8,
        fontSize: 18,
        fontWeight: '700',
        color: '#3C2A21',
    },
    headerSpacer: {
        width: 36,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorText: {
        fontSize: 14,
        color: '#B45309',
        textAlign: 'center',
        paddingHorizontal: 24,
    },
    scroll: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    heroCard: {
        marginBottom: 16,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    heroImage: {
        width: '100%',
        height: 260,
    },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    heroTopRow: {
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    heroIconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    heroBottomArea: {
        position: 'absolute',
        left: 20,
        right: 20,
        bottom: 22,
    },
    heroBadgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    versionBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#CF8250',
    },
    versionBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
        textTransform: 'uppercase',
    },
    dateBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.85)',
    },
    dateBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#3C2A21',
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FDF7F2',
        letterSpacing: -0.3,
    },
    metaCard: {
        marginBottom: 16,
        padding: 14,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8DED3',
    },
    metaTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#3C2A21',
        marginBottom: 8,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    metaLabel: {
        fontSize: 12,
        color: '#8E7B6F',
    },
    metaValue: {
        fontSize: 12,
        fontWeight: '600',
        color: '#3C2A21',
    },
    groupSection: {
        marginBottom: 20,
    },
    groupTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#3C2A21',
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    groupEmpty: {
        fontSize: 12,
        color: '#8E7B6F',
    },
    itemSeparator: {
        height: 10,
    },
    itemCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E8DED3',
        overflow: 'hidden',
    },
    itemImage: {
        width: 96,
        height: 96,
        backgroundColor: '#E8DED3',
    },
    itemContent: {
        flex: 1,
        padding: 10,
        justifyContent: 'space-between',
    },
    itemName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#3C2A21',
    },
    itemCategory: {
        fontSize: 11,
        color: '#8E7B6F',
        marginTop: 2,
    },
    itemDescription: {
        fontSize: 11,
        color: '#5E4A3A',
        marginTop: 4,
    },
    itemPrice: {
        marginTop: 6,
        fontSize: 12,
        fontWeight: '700',
        color: '#8B5E3C',
    },
});
