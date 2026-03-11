import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    TextInput,
    Image,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Toast from 'react-native-toast-message';
import { WebView } from 'react-native-webview';

import { useCart, CartItem } from '@/context/cart-context';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS, AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

const COLORS = {
    bg: '#F7F3EF',
    text: '#3C2A21',
    textSecondary: '#8E7B6F',
    border: '#E8E1D9',
    accent: '#D38B2A',
    white: '#FFFFFF',
    danger: '#B23B3B',
    orange: '#F05D23',
    green: '#2E7D32',
};

const SHIPPING_OPTIONS = [
    { id: 'nhanh', label: 'Fast', price: 0, desc: 'Receive in 1-2 days' },
    { id: 'hoatoc', label: 'Express', price: 10000, desc: 'Receive in 4 hours' },
];

interface SupplierGroup {
    supplierId: number;
    supplierName: string;
    items: CartItem[];
}

export default function CheckoutPage() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { items, removeItem } = useCart();
    const { walletBalance, walletId, refreshProfile, fullAddress, profile, shopName } = useAuth();

    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // State for each supplier group
    const [shippingOptions, setShippingOptions] = useState<Record<number, typeof SHIPPING_OPTIONS[0]>>({});
    const [notes, setNotes] = useState<Record<number, string>>({});

    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Top-Up Flow States ---
    const [showInsufficientModal, setShowInsufficientModal] = useState(false);
    const [showTopupModal, setShowTopupModal] = useState(false);
    const [selectedTopup, setSelectedTopup] = useState<number | null>(null);
    const [customTopup, setCustomTopup] = useState('');
    const [topupSubmitting, setTopupSubmitting] = useState(false);
    const [payosUrl, setPayosUrl] = useState<string | null>(null);
    const [showPayosModal, setShowPayosModal] = useState(false);
    const [lastTopupAmount, setLastTopupAmount] = useState<number | null>(null);
    const [successSubmitting, setSuccessSubmitting] = useState(false);

    const successTriggeredRef = useRef(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const topupPresets = [100000, 500000, 1000000, 5000000];

    useEffect(() => {
        if (params.selectedIds) {
            try {
                const parsed = JSON.parse(params.selectedIds as string);
                setSelectedIds(parsed);
            } catch (e) {
                console.error('Failed to parse selectedIds', e);
            }
        }
    }, [params.selectedIds]);

    const selectedItems = items.filter((item) => selectedIds.includes(item.productId));

    // Group items by supplier
    const groupedItems = useMemo(() => {
        const groups: Record<number, SupplierGroup> = {};
        selectedItems.forEach((item) => {
            const supplierId = item.supplierId || 0;
            const supplierName = item.supplierName || 'Unknown Supplier';
            if (!groups[supplierId]) {
                groups[supplierId] = { supplierId, supplierName, items: [] };
            }
            groups[supplierId].items.push(item);
        });
        return Object.values(groups);
    }, [selectedItems]);

    // Make sure every group has a default shipping option
    useEffect(() => {
        const defaultShipping: Record<number, typeof SHIPPING_OPTIONS[0]> = {};
        groupedItems.forEach((group) => {
            if (!shippingOptions[group.supplierId]) {
                defaultShipping[group.supplierId] = SHIPPING_OPTIONS[0];
            }
        });

        if (Object.keys(defaultShipping).length > 0) {
            setShippingOptions((prev) => ({ ...prev, ...defaultShipping }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupedItems]);

    const setGroupShipping = (supplierId: number, option: typeof SHIPPING_OPTIONS[0]) => {
        setShippingOptions((prev) => ({ ...prev, [supplierId]: option }));
    };

    const setGroupNote = (supplierId: number, note: string) => {
        setNotes((prev) => ({ ...prev, [supplierId]: note }));
    };

    const totals = useMemo(() => {
        let itemTotal = 0;
        let shippingTotal = 0;

        groupedItems.forEach((group) => {
            group.items.forEach((item) => {
                itemTotal += item.unitPrice * item.quantity;
            });
            const groupShipping = shippingOptions[group.supplierId] || SHIPPING_OPTIONS[0];
            shippingTotal += groupShipping.price;
        });

        const totalAmount = itemTotal + shippingTotal;

        return {
            itemTotal,
            shippingTotal,
            totalAmount,
        };
    }, [groupedItems, shippingOptions]);

    const canAfford = totals.totalAmount <= walletBalance;
    const missingAmount = Math.max(0, totals.totalAmount - walletBalance);

    const formatVnd = (value: number) =>
        value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

    const handlePlaceOrder = async () => {
        if (selectedItems.length === 0) {
            Alert.alert('Checkout', 'No items selected for checkout.');
            return;
        }

        if (!canAfford) {
            setShowInsufficientModal(true);
            return;
        }

        if (isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        try {
            const nowIso = new Date().toISOString();

            // Submit one order per supplier group
            const promises = groupedItems.map((group) => {
                const payload = {
                    notes: (notes[group.supplierId] || '').trim() || 'None',
                    shipperName: shippingOptions[group.supplierId]?.label || 'Fast',
                    shipDate: nowIso,
                    receiDate: nowIso,
                    shipAddress: 'HCM',
                    receiveAddress: 'HCM',
                    items: group.items.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                    })),
                };

                return authorizedFetch(API_ENDPOINTS.order.fromSupplierProducts(), {
                    method: 'POST',
                    headers: {
                        Accept: '*/*',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                }).then(async (response) => {
                    if (!response.ok) {
                        const text = await response.text();
                        throw new Error(`Order for ${group.supplierName} failed: ${text || response.status}`);
                    }
                    return response;
                });
            });

            await Promise.all(promises);

            // Remove purchased items from cart
            selectedItems.forEach((item) => removeItem(item.productId));

            Toast.show({
                type: 'success',
                text1: 'Orders placed successfully!',
                text2: 'Your orders have been submitted.',
            });

            setTimeout(() => router.replace('/(tabs)/order'), 300);

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Purchase failed.';
            Alert.alert('Checkout Error', message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Top-Up Flow Logic ---
    const handleSelectTopup = (amount: number) => {
        if (selectedTopup === amount) {
            setSelectedTopup(null);
            return;
        }
        setSelectedTopup(amount);
        setCustomTopup('');
    };

    const handleTopup = async () => {
        if (topupSubmitting) return;

        const customValue = Number(customTopup.replace(/[^0-9]/g, ''));
        const amount = selectedTopup ?? (Number.isFinite(customValue) ? customValue : 0);
        if (!amount || amount <= 0) {
            Alert.alert('Top up', 'Please select or enter a top-up amount.');
            return;
        }

        try {
            setTopupSubmitting(true);
            if (!walletId) {
                Alert.alert('Top up', 'Wallet not found. Please refresh and try again.');
                return;
            }

            const returnUrl = 'http://localhost:8081/wallet-topup/success';
            const cancelUrl = 'http://localhost:8081/wallet-topup/cancel';

            const response = await authorizedFetch(`${AUTH_BASE_URL}/Wallet/${walletId}/top-up`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletId,
                    amount,
                    returnUrl,
                    cancelUrl,
                }),
            });

            if (!response.ok) {
                let errorText = '';
                try {
                    errorText = await response.text();
                } catch (e) { }

                throw new Error(`Request failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const checkoutUrl = String(data?.checkoutUrl ?? '').trim();
            if (!checkoutUrl) throw new Error('Missing checkout url');

            setLastTopupAmount(amount);
            successTriggeredRef.current = false;
            setPayosUrl(checkoutUrl);
            setShowTopupModal(false);
            setShowPayosModal(true);
        } catch (_error: any) {
            console.error('[Top-up Error in Checkout API]', _error);
            Alert.alert('Top up', `Unable to create top-up checkout: ${_error?.message || _error}`);
        } finally {
            setTopupSubmitting(false);
        }
    };

    const handleTopupSuccess = async () => {
        if (successSubmitting) return;
        if (!walletId || !lastTopupAmount) {
            Alert.alert('Top up', 'Missing top-up data. Please try again.');
            return;
        }

        try {
            setSuccessSubmitting(true);
            const response = await authorizedFetch(
                `${AUTH_BASE_URL}/Wallet/${walletId}/top-up/success?amount=${lastTopupAmount}`,
                { method: 'POST', headers: { Accept: '*/*' } }
            );

            if (!response.ok) throw new Error(`Request failed: ${response.status}`);

            await refreshProfile();
            Toast.show({
                type: 'success',
                text1: 'Top up successful!',
                text2: `Added ${formatVnd(lastTopupAmount)} VND to your wallet.`,
            });

            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
            closeTimerRef.current = setTimeout(() => {
                setShowPayosModal(false);
                setPayosUrl(null);
                setLastTopupAmount(null);
                closeTimerRef.current = null;
            }, 1000);
        } catch (_error) {
            Alert.alert('Top up', 'Unable to confirm top-up.');
        } finally {
            setSuccessSubmitting(false);
        }
    };

    const handlePayosShouldStart = (event: { url?: string }) => {
        const url = String(event?.url ?? '').toLowerCase();
        if (!url) return true;

        const isSuccessRoute = url.includes('wallet-topup/success');
        const isCancelRoute = url.includes('wallet-topup/cancel') || url.includes('cancel=true') || url.includes('status=cancelled');
        const isPaidStatus = url.includes('status=paid');

        if (isCancelRoute) {
            setShowPayosModal(false);
            setPayosUrl(null);
            setLastTopupAmount(null);
            successTriggeredRef.current = false;
            Toast.show({ type: 'info', text1: 'Top up cancelled.' });
            return false;
        }

        if ((isSuccessRoute || isPaidStatus) && !successTriggeredRef.current) {
            successTriggeredRef.current = true;
            handleTopupSuccess();
            return false;
        }
        return true;
    };


    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Checkout</Text>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Address */}
                <View style={styles.section}>
                    <View style={styles.addressRow}>
                        <Ionicons name="location" size={20} color={COLORS.text} />
                        <View style={styles.addressInfo}>
                            <Text style={styles.addressName}>
                                {String(shopName || profile?.fullName || profile?.userName || 'Customer')}
                            </Text>
                            <Text style={styles.addressText} numberOfLines={2}>
                                {String(fullAddress || 'No address provided')}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                    </View>
                </View>

                {/* Grouped Products by Supplier */}
                {groupedItems.map((group) => {
                    const currentShippingId = shippingOptions[group.supplierId]?.id || SHIPPING_OPTIONS[0].id;

                    return (
                        <View key={`supplier-${group.supplierId}`} style={styles.supplierGroupSection}>
                            <View style={styles.supplierHeader}>
                                <Ionicons name="storefront-outline" size={16} color={COLORS.textSecondary} />
                                <Text style={styles.supplierName}>{group.supplierName}</Text>
                            </View>

                            {group.items.map((item, index) => (
                                <View key={item.productId} style={[styles.itemCard, index > 0 && styles.itemBorderTop]}>
                                    <Image source={{ uri: item.image || 'https://via.placeholder.com/60' }} style={styles.itemImage} />
                                    <View style={styles.itemDetails}>
                                        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                                        <Text style={styles.itemCategory}>{item.category}</Text>
                                        <View style={styles.itemPriceRow}>
                                            <Text style={styles.itemPrice}>{formatVnd(item.unitPrice)} VND</Text>
                                            <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}

                            <View style={styles.noteContainer}>
                                <Text style={styles.noteLabel}>Message for Shop</Text>
                                <TextInput
                                    style={styles.noteInput}
                                    placeholder="Leave a message..."
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={notes[group.supplierId] || ''}
                                    onChangeText={(text) => setGroupNote(group.supplierId, text)}
                                />
                            </View>

                            <View style={styles.shippingSection}>
                                <Text style={styles.shippingSectionTitle}>Shipping Method</Text>
                                {SHIPPING_OPTIONS.map((option) => (
                                    <TouchableOpacity
                                        key={option.id}
                                        style={[
                                            styles.shippingCard,
                                            currentShippingId === option.id && styles.shippingCardSelected
                                        ]}
                                        onPress={() => setGroupShipping(group.supplierId, option)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.shippingHeader}>
                                            <View style={styles.shippingTitleRow}>
                                                <Text style={[
                                                    styles.shippingTitle,
                                                    currentShippingId === option.id && styles.shippingTitleSelected
                                                ]}>
                                                    {option.label}
                                                </Text>
                                                {currentShippingId === option.id && (
                                                    <Ionicons name="checkmark-circle" size={16} color={COLORS.green} style={{ marginLeft: 6 }} />
                                                )}
                                            </View>
                                            <View style={styles.shippingPriceRow}>
                                                <Text style={[
                                                    styles.shippingPrice,
                                                    option.price === 0 && styles.freeShippingText
                                                ]}>
                                                    {option.price === 0 ? 'Free' : `${formatVnd(option.price)} VND`}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={styles.shippingDesc}>{option.desc}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    );
                })}

                {/* Order Details Summary */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Details</Text>

                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Merchandise Subtotal</Text>
                        <Text style={styles.summaryValue}>{formatVnd(totals.itemTotal)} VND</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Shipping Total</Text>
                        <Text style={styles.summaryValue}>{formatVnd(totals.shippingTotal)} VND</Text>
                    </View>

                    <View style={styles.summaryDivider} />

                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryTotalLabel}>Total Payment</Text>
                        <Text style={styles.summaryTotalValue}>{formatVnd(totals.totalAmount)} VND</Text>
                    </View>

                    <View style={[styles.summaryRow, { marginTop: 12 }]}>
                        <Text style={styles.summaryLabel}>Current Wallet Balance</Text>
                        <Text style={styles.summaryValue}>{formatVnd(walletBalance)} VND</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Balance After Payment</Text>
                        <Text style={[styles.summaryValue, { color: canAfford ? COLORS.green : COLORS.danger }]}>
                            {canAfford ? '' : '-'}{formatVnd(Math.abs(walletBalance - totals.totalAmount))} VND
                        </Text>
                    </View>
                </View>

                <Text style={styles.disclaimerText}>
                    Tapping &quot;Place Order&quot; means you agree to SmartCoffee&apos;s Terms and Conditions.
                </Text>
            </ScrollView>

            {/* Bottom Bar */}
            <View style={styles.bottomBar}>
                <View style={styles.bottomTotalInfo}>
                    <Text style={styles.bottomTotalLabel}>Total</Text>
                    <Text style={styles.bottomTotalPrice}>{formatVnd(totals.totalAmount)} VND</Text>
                </View>

                {/* Allow tapping the button regardless of canAfford so it handles the modal */}
                <TouchableOpacity
                    style={[styles.placeOrderBtn, isSubmitting && styles.placeOrderBtnDisabled]}
                    onPress={handlePlaceOrder}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                        <Text style={styles.placeOrderText}>Place Order</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* INSUFFICIENT BALANCE WARNING MODAL */}
            <Modal
                visible={showInsufficientModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowInsufficientModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.warningCard}>
                        <View style={styles.warningIconContainer}>
                            <Ionicons name="wallet-outline" size={32} color={COLORS.orange} />
                        </View>
                        <Text style={styles.warningTitle}>Insufficient Balance</Text>
                        <Text style={styles.warningText}>
                            Your wallet balance is insufficient. You need an additional <Text style={{ fontWeight: '700', color: COLORS.text }}>{formatVnd(missingAmount)} VND</Text> to place this order. Please top up your wallet.
                        </Text>

                        <View style={styles.warningActions}>
                            <TouchableOpacity
                                style={styles.warningBtnOutline}
                                onPress={() => setShowInsufficientModal(false)}
                            >
                                <Text style={styles.warningBtnOutlineText}>Close</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.warningBtnPrimary}
                                onPress={() => {
                                    setShowInsufficientModal(false);
                                    setTimeout(() => setShowTopupModal(true), 300); // Wait for modal disappear
                                }}
                            >
                                <Text style={styles.warningBtnPrimaryText}>Top Up</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* TOP UP SELECTION MODAL */}
            <Modal
                visible={showTopupModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowTopupModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.topupCard}>
                        <View style={styles.topupHeader}>
                            <Text style={styles.topupTitle}>Top up wallet</Text>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setShowTopupModal(false)}
                            >
                                <Ionicons name="close" size={20} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.topupHint}>Choose an amount</Text>
                        <View style={styles.topupOptions}>
                            {topupPresets.map((amount) => {
                                const isActive = amount === selectedTopup;
                                return (
                                    <TouchableOpacity
                                        key={amount}
                                        style={[styles.topupChip, isActive && styles.topupChipActive]}
                                        activeOpacity={0.8}
                                        onPress={() => handleSelectTopup(amount)}
                                    >
                                        <Text style={[styles.topupChipText, isActive && styles.topupChipTextActive]}>
                                            {formatVnd(amount)} VND
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text style={styles.topupHint}>Or enter a custom amount (VND)</Text>
                        <TextInput
                            value={customTopup}
                            onChangeText={(value) => {
                                setCustomTopup(value);
                                if (selectedTopup) {
                                    setSelectedTopup(null);
                                }
                            }}
                            placeholder="e.g. 50000"
                            placeholderTextColor={COLORS.textSecondary}
                            keyboardType="numeric"
                            style={styles.topupInput}
                        />

                        <TouchableOpacity
                            style={[
                                styles.topupSubmit,
                                topupSubmitting && styles.topupSubmitDisabled
                            ]}
                            onPress={handleTopup}
                            disabled={topupSubmitting}
                        >
                            <Text style={styles.topupSubmitText}>
                                {topupSubmitting ? 'Processing...' : 'Confirm'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* PAYOS WEBVIEW MODAL */}
            <Modal
                visible={showPayosModal}
                animationType="slide"
                onRequestClose={() => setShowPayosModal(false)}
            >
                <SafeAreaView style={styles.payosContainer} edges={['top']}>
                    <View style={styles.payosHeader}>
                        <Text style={styles.payosTitle}>Complete Payment</Text>
                        <TouchableOpacity
                            style={styles.payosCloseButton}
                            onPress={() => {
                                setShowPayosModal(false);
                                if (closeTimerRef.current) {
                                    clearTimeout(closeTimerRef.current);
                                    closeTimerRef.current = null;
                                }
                            }}
                        >
                            <Ionicons name="close" size={24} color={COLORS.text} />
                        </TouchableOpacity>
                    </View>

                    {payosUrl ? (
                        <WebView
                            source={{ uri: payosUrl }}
                            style={styles.payosWebview}
                            onShouldStartLoadWithRequest={handlePayosShouldStart}
                        />
                    ) : (
                        <View style={styles.payosFallback}>
                            <Text style={styles.payosFallbackText}>Connecting to payment gateway...</Text>
                        </View>
                    )}
                </SafeAreaView>
            </Modal>

        </SafeAreaView>
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
        backgroundColor: COLORS.white,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 3,
    },
    backButton: {
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Outfit-Medium',
        fontWeight: '600',
        color: COLORS.text,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 24,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    section: {
        backgroundColor: COLORS.white,
        marginBottom: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 2,
    },
    supplierGroupSection: {
        backgroundColor: COLORS.white,
        marginBottom: 16,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 2,
    },
    supplierHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    supplierName: {
        fontSize: 16,
        fontFamily: 'Outfit-Medium',
        fontWeight: '700',
        color: COLORS.text,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: 'Outfit-SemiBold',
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 12,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    addressInfo: {
        flex: 1,
        marginLeft: 12,
        marginRight: 12,
    },
    addressName: {
        fontSize: 15,
        fontFamily: 'Outfit-Medium',
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 4,
    },
    addressText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
    itemCard: {
        flexDirection: 'row',
        paddingVertical: 12,
        marginBottom: 8,
        backgroundColor: 'transparent',
    },
    itemBorderTop: {
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    itemImage: {
        width: 64,
        height: 64,
        borderRadius: 12,
        backgroundColor: COLORS.border,
    },
    itemDetails: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'space-between',
    },
    itemName: {
        fontSize: 14,
        fontFamily: 'Outfit-Medium',
        fontWeight: '600',
        color: COLORS.text,
    },
    itemCategory: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    itemPriceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemPrice: {
        fontSize: 15,
        fontFamily: 'Outfit-SemiBold',
        fontWeight: '700',
        color: COLORS.accent,
    },
    itemQuantity: {
        fontSize: 13,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    noteContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 12,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    noteLabel: {
        fontSize: 13,
        color: COLORS.text,
        marginRight: 12,
        fontFamily: 'Outfit-Medium',
        fontWeight: '500',
    },
    noteInput: {
        flex: 1,
        textAlign: 'right',
        fontSize: 13,
        color: COLORS.textSecondary,
        padding: 0,
    },
    shippingSection: {
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    shippingSectionTitle: {
        fontSize: 14,
        fontFamily: 'Outfit-Medium',
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 10,
    },
    shippingCard: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        backgroundColor: COLORS.bg,
    },
    shippingCardSelected: {
        borderColor: COLORS.accent,
        backgroundColor: '#FAF5EF',
    },
    shippingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    shippingTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    shippingTitle: {
        fontSize: 14,
        fontFamily: 'Outfit-Medium',
        fontWeight: '500',
        color: COLORS.text,
    },
    shippingTitleSelected: {
        color: COLORS.accent,
        fontWeight: '700',
    },
    shippingPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    shippingPrice: {
        fontSize: 14,
        fontFamily: 'Outfit-SemiBold',
        fontWeight: '600',
        color: COLORS.text,
    },
    freeShippingText: {
        color: COLORS.accent,
    },
    shippingDesc: {
        fontSize: 12,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    summaryLabel: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.text,
    },
    summaryDivider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 12,
    },
    summaryTotalLabel: {
        fontSize: 16,
        fontFamily: 'Outfit-SemiBold',
        fontWeight: '700',
        color: COLORS.text,
    },
    summaryTotalValue: {
        fontSize: 18,
        fontFamily: 'Outfit-Bold',
        fontWeight: '700',
        color: COLORS.accent,
    },
    disclaimerText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 16,
        lineHeight: 18,
        paddingHorizontal: 16,
    },
    bottomBar: {
        flexDirection: 'row',
        backgroundColor: COLORS.white,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        paddingBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 8,
    },
    bottomTotalInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    bottomTotalLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    bottomTotalPrice: {
        fontSize: 20,
        fontFamily: 'Outfit-Bold',
        fontWeight: '700',
        color: COLORS.accent,
    },
    placeOrderBtn: {
        backgroundColor: COLORS.text,
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.text,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
    },
    placeOrderBtnDisabled: {
        backgroundColor: COLORS.border,
        shadowOpacity: 0,
        elevation: 0,
    },
    placeOrderText: {
        fontSize: 15,
        fontFamily: 'Outfit-Medium',
        fontWeight: '600',
        color: COLORS.white,
    },
    // --- Custom Modal Styles ---
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },

    // Insufficient Funds Card
    warningCard: {
        width: '100%',
        backgroundColor: COLORS.white,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 6,
    },
    warningIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFF0ED', // light orange tint
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    warningTitle: {
        fontSize: 20,
        fontFamily: 'Outfit-SemiBold',
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 12,
    },
    warningText: {
        fontSize: 14,
        fontFamily: 'Outfit-Regular',
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    warningActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        gap: 12,
    },
    warningBtnOutline: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.text,
        alignItems: 'center',
    },
    warningBtnOutlineText: {
        fontSize: 15,
        fontFamily: 'Outfit-Medium',
        fontWeight: '600',
        color: COLORS.text,
    },
    warningBtnPrimary: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: COLORS.text, // primary brown
        alignItems: 'center',
    },
    warningBtnPrimaryText: {
        fontSize: 15,
        fontFamily: 'Outfit-Medium',
        fontWeight: '600',
        color: COLORS.white,
    },

    // Top-up Card
    topupCard: {
        width: '100%',
        backgroundColor: COLORS.white,
        borderRadius: 20,
        padding: 24,
    },
    topupHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    topupTitle: {
        fontSize: 18,
        fontFamily: 'Outfit-SemiBold',
        fontWeight: '700',
        color: COLORS.text,
    },
    modalCloseButton: {
        padding: 4,
    },
    topupHint: {
        fontSize: 14,
        fontFamily: 'Outfit-Medium',
        color: COLORS.textSecondary,
        marginBottom: 12,
    },
    topupOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 20,
    },
    topupChip: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.bg,
    },
    topupChipActive: {
        borderColor: COLORS.accent,
        backgroundColor: '#FAF5EF',
    },
    topupChipText: {
        fontSize: 13,
        fontFamily: 'Outfit-Medium',
        color: COLORS.textSecondary,
    },
    topupChipTextActive: {
        color: COLORS.accent,
        fontWeight: '600',
    },
    topupInput: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        fontFamily: 'Outfit-Medium',
        color: COLORS.text,
        marginBottom: 24,
    },
    topupSubmit: {
        backgroundColor: COLORS.text,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    topupSubmitDisabled: {
        opacity: 0.6,
    },
    topupSubmitText: {
        fontSize: 15,
        fontFamily: 'Outfit-Medium',
        fontWeight: '600',
        color: COLORS.white,
    },

    // PayOS Modal
    payosContainer: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    payosHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    payosTitle: {
        flex: 1,
        fontSize: 18,
        fontFamily: 'Outfit-SemiBold',
        fontWeight: '600',
        color: COLORS.text,
        textAlign: 'center',
    },
    payosCloseButton: {
        position: 'absolute',
        right: 16,
        padding: 4,
        zIndex: 1,
    },
    payosWebview: {
        flex: 1,
    },
    payosFallback: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    payosFallbackText: {
        color: COLORS.textSecondary,
        fontSize: 14,
    },
});
