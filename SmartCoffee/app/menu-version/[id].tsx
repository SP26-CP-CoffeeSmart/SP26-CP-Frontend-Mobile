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
    vsVersion?: {
        comparedVersion: string;
        revenueChange: number;
        profitChange: number;
    };
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 48;

const MenuVersionPage = () => {
    const router = useRouter();
    const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [versions, setVersions] = useState<MenuVersion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (!id) {
            setError('Menu ID is missing');
            return;
        }
        // TODO: Fetch menu versions when API is ready
        // Mock data for now
        const mockVersions: MenuVersion[] = [
            {
                id: '1',
                name: 'Summer Vacation ver 3',
                image: { uri: 'https://images.unsplash.com/photo-1554866585-c4db4dc59b0f?w=400' },
                avgDailyRevenue: '15,000,000 vnd',
                profitMargin: 32,
                topSeller: 'Caramel Espresso',
                vsVersion: {
                    comparedVersion: 'Ver 2',
                    revenueChange: 9,
                    profitChange: 2,
                },
            },
            {
                id: '2',
                name: 'Summer Vacation ver 2',
                image: { uri: 'https://images.unsplash.com/photo-1559056199-641a0ac8b3f7?w=400' },
                avgDailyRevenue: '13,800,000 vnd',
                profitMargin: 30,
                topSeller: 'Iced Latte',
                vsVersion: {
                    comparedVersion: 'Ver 1',
                    revenueChange: 5,
                    profitChange: 3,
                },
            },
            {
                id: '3',
                name: 'Summer Vacation ver 1',
                image: { uri: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400' },
                avgDailyRevenue: '13,100,000 vnd',
                profitMargin: 27,
                topSeller: 'Vanilla Cappuccino',
            },
        ];
        setVersions(mockVersions);
    }, [id]);

    const handleScroll = (event: any) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const currentIndexValue = Math.round(contentOffsetX / (CARD_WIDTH + 48));
        setCurrentIndex(currentIndexValue);
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.headerWrapper}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()}>
                            <Ionicons name="chevron-back" size={24} color={stylesVars.espresso} />
                        </TouchableOpacity>
                        <Text style={styles.title}>{name || 'Menu Versions'}</Text>
                        <View style={{ width: 24 }} />
                    </View>
                </View>

                {/* Content */}
                {error ? (
                    <View style={styles.centerContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : versions.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={stylesVars.primary} />
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
                                                <TouchableOpacity style={styles.editButton}>
                                                    <Text style={styles.editButtonText}>Edit</Text>
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
        marginTop: 12,
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

