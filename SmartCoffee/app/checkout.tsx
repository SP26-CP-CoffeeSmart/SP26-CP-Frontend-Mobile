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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Toast from 'react-native-toast-message';
import { WebView } from 'react-native-webview';

import { useCart, CartItem } from '@/context/cart-context';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useSuggestions } from '@/context/suggestion-context';

type StockCheckResponseItem = {
    productId: number;
    stock?: number | null;
    holdStock?: number | null;
    availableStock?: number | null;
};

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

const FALLBACK_PRODUCT_IMAGE =
    Image.resolveAssetSource(require('../assets/AI_RecommendationBackground.jpg')).uri;
type ShippingOption = {
    id: string;
    label: string;
    price: number;
    desc: string;
};

interface SupplierGroup {
    supplierId: number;
    supplierName: string;
    items: CartItem[];
}

type SupplierInfo = {
    supplierId: number;
    supplierName: string;
    address?: string | null;
    provinceId?: number | null;
    districtId?: number | null;
    wardCode?: string | null;
};

const toArrayPayload = <T,>(payload: any): T[] => {
    if (Array.isArray(payload)) return payload as T[];
    if (payload && typeof payload === 'object') {
        if (Array.isArray(payload.data)) return payload.data as T[];
        if (Array.isArray(payload.items)) return payload.items as T[];
        if (Array.isArray(payload.result)) return payload.result as T[];
    }
    return [];
};

const normalizeSupplierInfo = (raw: any): SupplierInfo => ({
    supplierId: Number(raw?.supplierId ?? raw?.SupplierId ?? raw?.id ?? 0),
    supplierName: String(raw?.supplierName ?? raw?.name ?? raw?.supplier?.name ?? 'Unknown Supplier').trim(),
    address: raw?.address ?? raw?.Address ?? null,
    provinceId: Number(raw?.provinceId ?? raw?.ProvinceId ?? 0) || null,
    districtId: Number(raw?.districtId ?? raw?.DistrictId ?? 0) || null,
    wardCode: String(raw?.wardCode ?? raw?.WardCode ?? '').trim() || null,
});

type GhnService = {
    service_id: number;
    short_name: string;
    service_type_id: number;
};

type GhnFeeResponse = {
    total: number;
    service_fee: number;
};

const convertPackageSize = (size: number | null | undefined, measurement: string | null | undefined) => {
    if (size == null || !Number.isFinite(size)) return null;
    const m = (measurement ?? '').trim().toLowerCase();
    if (m === 'l' || m === 'liter' || m === 'litre') {
        return { value: Math.round(size * 1000), unit: 'ml' };
    }
    if (m === 'kg' || m === 'kilogram' || m === 'kilograms') {
        return { value: Math.round(size * 1000), unit: 'g' };
    }
    if (m === 'ml' || m === 'milliliter') {
        return { value: Math.round(size), unit: 'ml' };
    }
    return { value: Math.round(size), unit: 'g' };
};

export default function CheckoutPage() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { items, removeItem } = useCart();
    const { walletBalance, refreshProfile, fullAddress, profile, shopName, accountId } = useAuth();

    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const { items: suggestionItems } = useSuggestions();

    // State for each supplier group
    const [shippingOptions, setShippingOptions] = useState<Record<number, ShippingOption>>({});
    const [notes, setNotes] = useState<Record<number, string>>({});

    // GHN shipping integration state
    const [suppliers, setSuppliers] = useState<SupplierInfo[]>([]);
    const [ghnServicesBySupplier, setGhnServicesBySupplier] = useState<Record<number, GhnService[]>>({});
    const [shippingFeeBySupplierService, setShippingFeeBySupplierService] = useState<Record<number, Record<number, number>>>({});
    const [shippingErrorBySupplierService, setShippingErrorBySupplierService] = useState<Record<number, Record<number, string | null>>>({});
    const [shippingLoadingBySupplier, setShippingLoadingBySupplier] = useState<Record<number, boolean>>({});
    const [shippingErrorBySupplier, setShippingErrorBySupplier] = useState<Record<number, string | null>>({});

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [stockIssues, setStockIssues] = useState<Record<number, { available: number, requested: number }>>({});

    // --- Payment Method Selection ---
    const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
    const [bankTransferSubmitting, setBankTransferSubmitting] = useState(false);

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
    const [payosPurpose, setPayosPurpose] = useState<'wallet' | 'bankTransfer' | null>(null);
    const [payosOrderCode, setPayosOrderCode] = useState<number | string | null>(null);

    const successTriggeredRef = useRef(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const topupPresets = [100000, 500000, 1000000, 5000000];

    const shippingToDistrictId = Number(
        (profile as any)?.districtId ?? (profile as any)?.DistrictId ?? 0
    );
    const shippingToWardCode = String(
        (profile as any)?.wardCode ?? (profile as any)?.WardCode ?? ''
    ).trim();
    const hasShippingAddress = Number.isFinite(shippingToDistrictId) && shippingToDistrictId > 0 && !!shippingToWardCode;

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

    const isFromAi = params.source === 'ai';
    const isFromReorder = params.source === 'reorder';

    const [reorderItems, setReorderItems] = useState<CartItem[]>([]);

    useEffect(() => {
        if (!isFromReorder) return;
        const fetchReorderData = async () => {
            try {
                const stored = await AsyncStorage.getItem('checkout_reorder_data');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setReorderItems(parsed);
                    setSelectedIds(parsed.map((item: any) => item.productId));
                }
            } catch (e) {
                console.error('Failed to parse reorderData from storage');
            }
        };
        fetchReorderData();
    }, [isFromReorder]);

    useEffect(() => {
        if (!isFromAi) return;
        if (!suggestionItems.length) return;
        setSelectedIds(suggestionItems.map((item) => item.productId));
    }, [isFromAi, suggestionItems]);

    // Load suppliers to map supplierId -> GHN address info
    useEffect(() => {
        const loadSuppliers = async () => {
            try {
                const response = await authorizedFetch(API_ENDPOINTS.supplier.list(), {
                    method: 'GET',
                    headers: {
                        Accept: '*/*',
                    },
                });

                if (!response.ok) {
                    return;
                }

                const data = await response.json();
                const parsedSuppliers = toArrayPayload<any>(data)
                    .map(normalizeSupplierInfo)
                    .filter((s) => Number.isFinite(s.supplierId) && s.supplierId > 0);

                console.log('[Checkout] Suppliers loaded:', parsedSuppliers.length);
                setSuppliers(parsedSuppliers);
            } catch (error) {
                console.error('Failed to load suppliers', error);
            }
        };

        loadSuppliers();
    }, []);

    const sourceItems: CartItem[] = useMemo(() => {
        if (isFromReorder) {
            return reorderItems;
        }
        if (!isFromAi) {
            return items;
        }
        const mapped: CartItem[] = suggestionItems.map((s) => ({
            productId: s.productId,
            supplierId: s.supplierId,
            supplierName: s.supplierName ?? undefined,
            name: s.name,
            category: '',
            image: s.image || FALLBACK_PRODUCT_IMAGE,
            measurement: s.measurement || 'unit',
            packageSize: s.packageSize ?? null,
            unitPrice: s.priceVnd,
            quantity: s.qtyNeeded > 0 ? s.qtyNeeded : 1,
        }));
        return mapped;
    }, [isFromAi, isFromReorder, items, suggestionItems, reorderItems]);

    const selectedItems = sourceItems.filter((item) => selectedIds.includes(item.productId));

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

    const setGroupShipping = (supplierId: number, option: ShippingOption) => {
        setShippingOptions((prev) => ({ ...prev, [supplierId]: option }));
    };

    const setGroupNote = (supplierId: number, note: string) => {
        setNotes((prev) => ({ ...prev, [supplierId]: note }));
    };

    const computeGroupWeight = (group: SupplierGroup) => {
        const DEFAULT_ITEM_WEIGHT_GRAM = 100;
        let totalWeight = 0;

        group.items.forEach((item) => {
            const rawMeasurement = (item.measurement || '').trim().toLowerCase();
            const packageSize =
                typeof item.packageSize === 'number' && item.packageSize > 0
                    ? item.packageSize
                    : null;

            let unitMultiplier = 1;
            if (rawMeasurement === 'kg' || rawMeasurement === 'kilogram' || rawMeasurement === 'kilograms') {
                unitMultiplier = 1000;
            } else if (rawMeasurement === 'l' || rawMeasurement === 'liter' || rawMeasurement === 'litre') {
                unitMultiplier = 1000;
            } else if (rawMeasurement === 'ml') {
                unitMultiplier = 1;
            } else if (rawMeasurement === 'g' || rawMeasurement === 'gram' || rawMeasurement === 'grams') {
                unitMultiplier = 1;
            }

            const perItemWeight = packageSize ?? 1;
            const itemWeight = perItemWeight * unitMultiplier * item.quantity;

            console.log('[GHN Item Weight]', {
                supplierId: group.supplierId,
                productId: item.productId,
                name: item.name,
                measurement: rawMeasurement,
                packageSize,
                quantity: item.quantity,
                unitMultiplier,
                itemWeight,
            });

            if (Number.isFinite(itemWeight) && itemWeight > 0) {
                totalWeight += itemWeight;
            }
        });

        const safeTotal = Number.isFinite(totalWeight) && totalWeight > 0
            ? Math.round(totalWeight)
            : DEFAULT_ITEM_WEIGHT_GRAM;

        console.log('[GHN Group Weight]', {
            supplierId: group.supplierId,
            totalWeight: safeTotal,
        });

        return safeTotal;
    };

    const loadShippingForGroup = async (group: SupplierGroup, overwriteServiceId?: number) => {
        if (!profile) return;

        const toDistrictId = shippingToDistrictId;
        const toWardCode = shippingToWardCode;

        console.log('[GHN] Begin load shipping', {
            supplierId: group.supplierId,
            toDistrictId,
            toWardCode,
            suppliersLoaded: suppliers.length,
        });

        if (!toDistrictId || !toWardCode) {
            console.log('[GHN] Skip: missing destination address', {
                toDistrictId,
                toWardCode,
            });
            return;
        }

        const supplierInfo = suppliers.find((s) => s.supplierId === group.supplierId);
        if (!supplierInfo || !supplierInfo.districtId || !supplierInfo.wardCode) {
            console.log('[GHN] Skip: missing supplier address info', {
                supplierId: group.supplierId,
                foundSupplier: !!supplierInfo,
                districtId: supplierInfo?.districtId,
                wardCode: supplierInfo?.wardCode,
            });
            return;
        }

        const supplierId = group.supplierId;
        const fromDistrictId = supplierInfo.districtId;
        const fromWardCode = supplierInfo.wardCode;

        setShippingLoadingBySupplier((prev) => ({ ...prev, [supplierId]: true }));
        setShippingErrorBySupplier((prev) => ({ ...prev, [supplierId]: null }));
        setShippingErrorBySupplierService((prev) => ({
            ...prev,
            [supplierId]: {},
        }));

        let services = ghnServicesBySupplier[supplierId];

        try {
            if (!services || services.length === 0) {
                const svcRes = await authorizedFetch(
                    API_ENDPOINTS.ghn.availableServices(fromDistrictId, toDistrictId),
                    {
                        method: 'GET',
                        headers: {
                            Accept: '*/*',
                        },
                    }
                );

                if (!svcRes.ok) {
                    throw new Error(`Failed to load services: ${svcRes.status}`);
                }

                const svcData = await svcRes.json();
                const rawServices = toArrayPayload<any>(svcData).map((service: any) => ({
                    service_id: Number(service?.service_id ?? service?.serviceId ?? 0),
                    short_name: String(service?.short_name ?? service?.shortName ?? 'GHN Service'),
                    service_type_id: Number(service?.service_type_id ?? service?.serviceTypeId ?? 0),
                })) as GhnService[];

                // Filter out unsupported heavy service 100039
                services = rawServices.filter((s) => s.service_id !== 100039);

                console.log('[GHN] Services loaded', {
                    supplierId,
                    count: services.length,
                    serviceIds: services.map((s) => s.service_id),
                });

                setGhnServicesBySupplier((prev) => ({ ...prev, [supplierId]: services }));
            }

            if (!services || services.length === 0) {
                throw new Error('No GHN services available');
            }
        } catch (error) {
            console.log('Failed to load GHN services for supplier', supplierId, error);
            setShippingErrorBySupplier((prev) => ({
                ...prev,
                [supplierId]:
                    error instanceof Error ? error.message : 'Unable to load GHN services',
            }));
            setShippingLoadingBySupplier((prev) => ({ ...prev, [supplierId]: false }));
            return;
        }

        const feesByService: Record<number, number> = {};
        const errorsByService: Record<number, string | null> = {};

        const weight = computeGroupWeight(group);

        await Promise.all(
            services.map(async (svc) => {
                const feePayload = {
                    service_id: svc.service_id,
                    insurance_value: 0,
                    from_district_id: fromDistrictId,
                    from_ward_code: fromWardCode,
                    to_district_id: toDistrictId,
                    to_ward_code: toWardCode,
                    weight,
                    length: 0,
                    width: 0,
                    height: 0,
                };
                console.log('[GHN Fee Payload]', feePayload)
                try {
                    const feeRes = await authorizedFetch(API_ENDPOINTS.order.ghnFee(), {
                        method: 'POST',
                        headers: {
                            Accept: '*/*',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(feePayload),
                    });

                    if (!feeRes.ok) {
                        let feeText = '';
                        try {
                            feeText = await feeRes.text();
                        } catch {
                            // ignore
                        }
                        throw new Error(`Failed to calculate fee: ${feeRes.status} ${feeText}`);
                    }

                    const feeData: GhnFeeResponse = await feeRes.json();
                    const totalFee = Number(feeData?.total) || 0;
                    feesByService[svc.service_id] = totalFee;
                } catch (error) {
                    console.log(
                        'Failed to calculate GHN fee for supplier',
                        supplierId,
                        'service',
                        svc.service_id,
                        error
                    );
                    errorsByService[svc.service_id] =
                        error instanceof Error ? error.message : 'Unable to calculate shipping';
                }
            })
        );

        setShippingFeeBySupplierService((prev) => ({
            ...prev,
            [supplierId]: {
                ...(prev[supplierId] || {}),
                ...feesByService,
            },
        }));

        setShippingErrorBySupplierService((prev) => ({
            ...prev,
            [supplierId]: {
                ...(prev[supplierId] || {}),
                ...errorsByService,
            },
        }));

        const existingSelectedId =
            (overwriteServiceId ?? Number(shippingOptions[supplierId]?.id)) || undefined;

        let selectedService: GhnService | undefined;
        if (existingSelectedId && services.some((s) => s.service_id === existingSelectedId)) {
            selectedService = services.find((s) => s.service_id === existingSelectedId);
        } else {
            selectedService =
                services.find((s) => typeof feesByService[s.service_id] === 'number') ||
                services[0];
        }

        if (selectedService) {
            const selectedFee = feesByService[selectedService.service_id];
            setGroupShipping(supplierId, {
                id: String(selectedService.service_id),
                label: selectedService.short_name || 'GHN Service',
                price: typeof selectedFee === 'number' ? selectedFee : 0,
                desc: 'GHN shipping service',
            });
        }

        setShippingLoadingBySupplier((prev) => ({ ...prev, [supplierId]: false }));
    };

    const totals = useMemo(() => {
        let itemTotal = 0;
        let shippingTotal = 0;

        groupedItems.forEach((group) => {
            group.items.forEach((item) => {
                itemTotal += item.unitPrice * item.quantity;
            });

            const selectedOption = shippingOptions[group.supplierId];
            if (selectedOption) {
                const serviceId = Number(selectedOption.id);
                const feeMap = shippingFeeBySupplierService[group.supplierId];
                const explicitFee =
                    feeMap && typeof feeMap[serviceId] === 'number'
                        ? feeMap[serviceId]
                        : undefined;

                if (typeof explicitFee === 'number') {
                    shippingTotal += explicitFee;
                }
            }
        });

        const totalAmount = itemTotal + shippingTotal;

        return {
            itemTotal,
            shippingTotal,
            totalAmount,
        };
    }, [groupedItems, shippingOptions, shippingFeeBySupplierService]);

    // Auto-load GHN shipping fee for each supplier group when data is ready
    useEffect(() => {
        if (!profile || suppliers.length === 0 || groupedItems.length === 0) return;

        groupedItems.forEach((group) => {
            const supplierId = group.supplierId;
            const feeMap = shippingFeeBySupplierService[supplierId];
            const hasFee =
                feeMap && Object.values(feeMap).some((value) => typeof value === 'number');
            const hasError = shippingErrorBySupplier[supplierId];
            const isLoading = shippingLoadingBySupplier[supplierId];

            if (!hasFee && !hasError && !isLoading) {
                loadShippingForGroup(group);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupedItems, profile, suppliers, shippingToDistrictId, shippingToWardCode]);

    const canAfford = totals.totalAmount <= walletBalance;
    const missingAmount = Math.max(0, totals.totalAmount - walletBalance);

    const formatVnd = (value: number) =>
        value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

    const handlePlaceOrder = async () => {
        if (selectedItems.length === 0) {
            Alert.alert('Checkout', 'No items selected for checkout.');
            return;
        }

        setIsSubmitting(true);
        setStockIssues({});

        try {
            const productIds = selectedItems.map((item) => item.productId);

            const response = await authorizedFetch(API_ENDPOINTS.supplierProduct.checkAvailableStock(), {
                method: 'POST',
                headers: {
                    Accept: '*/*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(productIds),
            });

            if (!response.ok) {
                throw new Error(`Unable to verify stock: ${response.status}`);
            }

            const stockItems = await response.json() as StockCheckResponseItem[];
            const byProductId = new Map<number, StockCheckResponseItem>();

            stockItems.forEach((stockItem) => {
                if (typeof stockItem.productId === 'number') {
                    byProductId.set(stockItem.productId, stockItem);
                }
            });

            const newStockIssues: Record<number, { available: number, requested: number }> = {};
            let hasIssue = false;

            selectedItems.forEach((selected) => {
                const latest = byProductId.get(selected.productId);
                const availableRaw =
                    latest?.availableStock ??
                    (Number(latest?.stock ?? 0) - Number(latest?.holdStock ?? 0));
                const available = Math.max(0, Math.floor(Number(availableRaw) || 0));

                if (!latest || selected.quantity > available) {
                    newStockIssues[selected.productId] = { available, requested: selected.quantity };
                    hasIssue = true;
                }
            });

            if (hasIssue) {
                setStockIssues(newStockIssues);
                Toast.show({
                    type: 'error',
                    text1: 'Stock Issue',
                    text2: 'Some items do not have enough stock. Please reduce their quantities.',
                });
                return;
            }

            try {
                await refreshProfile();
            } catch (refreshError) {
                console.log('[Checkout] Failed to refresh wallet balance before payment modal:', refreshError);
            }

            // Show payment method selection
            setShowPaymentMethodModal(true);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to verify stock.';
            Alert.alert('Checkout', message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitWalletOrder = async () => {
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const orders = groupedItems.map((group) => {
                const selectedOption = shippingOptions[group.supplierId];
                const serviceId = selectedOption ? Number(selectedOption.id) : undefined;
                const feeMap = shippingFeeBySupplierService[group.supplierId];
                const explicitFee =
                    serviceId && feeMap && typeof feeMap[serviceId] === 'number'
                        ? feeMap[serviceId]
                        : 0;

                return {
                    supplierId: group.supplierId,
                    notes: (notes[group.supplierId] || '').trim() || 'None',
                    shippingFee: explicitFee,
                    items: group.items.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                    })),
                };
            });

            const payload = { orders };

            const response = await authorizedFetch(API_ENDPOINTS.order.fromSupplierProducts(), {
                method: 'POST',
                headers: {
                    Accept: '*/*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Order failed: ${text || response.status}`);
            }

            if (!isFromAi) {
                selectedItems.forEach((item) => removeItem(item.productId));
            }

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

    const handleWalletPayment = () => {
        setShowPaymentMethodModal(false);
        if (!canAfford) {
            setShowInsufficientModal(true);
            return;
        }
        submitWalletOrder();
    };

    const handleBankTransfer = async () => {
        if (bankTransferSubmitting) return;
        setShowPaymentMethodModal(false);

        try {
            setBankTransferSubmitting(true);

            const orders = groupedItems.map((group) => {
                const selectedOption = shippingOptions[group.supplierId];
                const serviceId = selectedOption ? Number(selectedOption.id) : undefined;
                const feeMap = shippingFeeBySupplierService[group.supplierId];
                const explicitFee =
                    serviceId && feeMap && typeof feeMap[serviceId] === 'number'
                        ? feeMap[serviceId]
                        : 0;

                return {
                    supplierId: group.supplierId,
                    notes: (notes[group.supplierId] || '').trim() || 'None',
                    shippingFee: explicitFee,
                    items: group.items.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                    })),
                };
            });

            const payload = { orders };

            console.log('[BankTransfer] Payload:', JSON.stringify(payload, null, 2));

            const response = await authorizedFetch(API_ENDPOINTS.wallet.topUpOrders(), {
                method: 'POST',
                headers: {
                    Accept: '*/*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                let errorText = '';
                try { errorText = await response.text(); } catch { }
                throw new Error(`Request failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('[BankTransfer] Response:', JSON.stringify(data, null, 2));

            const checkoutUrl = String(
                data?.checkoutUrl ??
                data?.url ??
                data?.paymentUrl ??
                data?.payment_url ??
                data?.checkout_url ??
                data?.link ??
                data?.data?.checkoutUrl ??
                data?.data?.url ??
                data?.data?.paymentUrl ??
                ''
            ).trim();
            const payloadOrderCode = data?.orderCode ?? data?.data?.orderCode ?? null;
            if (!checkoutUrl) throw new Error('Missing checkout url. Response: ' + JSON.stringify(data));

            successTriggeredRef.current = false;
            setPayosPurpose('bankTransfer');
            setPayosOrderCode(payloadOrderCode);
            setPayosUrl(checkoutUrl);
            setShowPayosModal(true);
        } catch (error: any) {
            console.error('[BankTransfer Error]', error);
            Alert.alert('Bank Transfer', `Unable to create payment: ${error?.message || error}`);
        } finally {
            setBankTransferSubmitting(false);
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
            const response = await authorizedFetch(API_ENDPOINTS.wallet.topUp(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    isMobile: true,
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
            setPayosPurpose('wallet');
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
        if (!lastTopupAmount) {
            Alert.alert('Top up', 'Missing top-up data. Please try again.');
            return;
        }

        try {
            setSuccessSubmitting(true);
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
            Alert.alert('Top up', 'Payment appears successful, but failed to refresh wallet data. Please pull to refresh.');
        } finally {
            setSuccessSubmitting(false);
        }
    };

    const handleBankTransferSuccess = async () => {
        try {
            // Remove items from cart
            if (!isFromAi) {
                selectedItems.forEach((item) => removeItem(item.productId));
            }
            await refreshProfile();

            Toast.show({
                type: 'success',
                text1: 'Payment successful!',
                text2: 'Your orders have been placed via bank transfer.',
            });

            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
            closeTimerRef.current = setTimeout(() => {
                setShowPayosModal(false);
                setPayosUrl(null);
                setPayosPurpose(null);
                closeTimerRef.current = null;
                router.replace('/(tabs)/order');
            }, 1500);
        } catch (_error) {
            Toast.show({
                type: 'info',
                text1: 'Payment appears successful.',
                text2: 'Please check your orders.',
            });
        }
    };

    const handleCancelPayos = () => {
        setShowPayosModal(false);
        setPayosUrl(null);
        setLastTopupAmount(null);

        if (payosPurpose === 'bankTransfer' && payosOrderCode != null) {
            const url = API_ENDPOINTS.wallet.cancelOrderPayment(payosOrderCode);
            console.log(`[PayOS Cancel] Calling endpoint: ${url} with orderCode: ${payosOrderCode}`);

            authorizedFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
                .then(res => console.log(`[PayOS Cancel] API Response status: ${res.status}`))
                .catch(err => console.error('[PayOS Cancel Error]', err));
        }

        setPayosPurpose(null);
        setPayosOrderCode(null);
        successTriggeredRef.current = false;

        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }

        Toast.show({ type: 'info', text1: 'Payment cancelled.' });
    };

    const handlePayosShouldStart = (event: { url?: string }) => {
        const url = String(event?.url ?? '').toLowerCase();
        if (!url) return true;

        const isCancelRoute = url.includes('cancel=true') || url.includes('status=cancelled');
        const isPaidStatus = url.includes('status=paid');

        if (isCancelRoute) {
            handleCancelPayos();
            return false;
        }

        if (isPaidStatus && !successTriggeredRef.current) {
            successTriggeredRef.current = true;
            if (payosPurpose === 'bankTransfer') {
                handleBankTransferSuccess();
            } else {
                handleTopupSuccess();
            }
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
                    const groupIsLoading = shippingLoadingBySupplier[group.supplierId];
                    const groupError = shippingErrorBySupplier[group.supplierId];
                    const ghnServices = ghnServicesBySupplier[group.supplierId];
                    const hasAnyGhnService = !!(ghnServices && ghnServices.length > 0);
                    const feeMapForGroup = shippingFeeBySupplierService[group.supplierId] || {};
                    const errorMapForGroup =
                        shippingErrorBySupplierService[group.supplierId] || {};

                    const currentShippingId =
                        (shippingOptions[group.supplierId]?.id as string | undefined) ??
                        (hasAnyGhnService ? String(ghnServices![0].service_id) : '');

                    return (
                        <View key={`supplier-${group.supplierId}`} style={styles.supplierGroupSection}>
                            <View style={styles.supplierHeader}>
                                <Ionicons name="storefront-outline" size={16} color={COLORS.textSecondary} />
                                <Text style={styles.supplierName}>{group.supplierName}</Text>
                            </View>

                            {group.items.map((item, index) => {
                                const issue = stockIssues[item.productId];
                                const isOutOfStock = issue && issue.available === 0;
                                const isNotEnough = issue && issue.available > 0;
                                const measurementLabel = String(item.measurement || '').trim();
                                const hasPackageSize =
                                    typeof item.packageSize === 'number' && item.packageSize > 0;
                                const baseSize = hasPackageSize ? item.packageSize : 1;
                                const converted = measurementLabel
                                    ? convertPackageSize(baseSize, measurementLabel)
                                    : null;
                                const packageSizeText = converted
                                    ? `${converted.value} ${converted.unit}`
                                    : measurementLabel
                                        ? `${baseSize} ${measurementLabel}`
                                        : '';

                                const productSubText = [item.category, packageSizeText]
                                    .map((value) => String(value || '').trim())
                                    .filter(Boolean)
                                    .join(' • ');

                                return (
                                    <View key={item.productId} style={[styles.itemCardContainer, index > 0 && styles.itemBorderTop]}>
                                        <View style={[styles.itemCardContent, issue && { opacity: 0.4 }]}>
                                            <Image
                                                source={{ uri: (item.image && item.image !== 'null') ? item.image : FALLBACK_PRODUCT_IMAGE }}
                                                style={styles.itemImage}
                                            />
                                            <View style={styles.itemDetails}>
                                                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                                                <Text style={styles.itemCategory}>{productSubText || 'No details'}</Text>
                                                <View style={styles.itemPriceRow}>
                                                    <Text style={styles.itemPrice}>{formatVnd(item.unitPrice)} VND</Text>
                                                    <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                                                </View>
                                            </View>
                                        </View>
                                        {isOutOfStock && (
                                            <View style={styles.issueOverlayContainer}>
                                                <Text style={styles.outOfStockBadge}>Out of Stock</Text>
                                            </View>
                                        )}
                                        {isNotEnough && (
                                            <View style={styles.issueOverlayContainer}>
                                                <Text style={styles.notEnoughBadge}>Reduce quantity to ≤ {issue.available}</Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}

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
                                {!hasShippingAddress && (
                                    <Text style={styles.shippingDesc}>
                                        Shipping address is missing. Please update your address before placing an order.
                                    </Text>
                                )}
                                {hasShippingAddress && !hasAnyGhnService && groupError && (
                                    <Text style={styles.shippingDesc}>
                                        No services for this supplier&apos;s address.
                                    </Text>
                                )}
                                {hasShippingAddress && hasAnyGhnService &&
                                    ghnServices!.map((svc) => {
                                        const option: ShippingOption = {
                                            id: String(svc.service_id),
                                            label: svc.short_name || 'GHN Service',
                                            price:
                                                typeof feeMapForGroup[svc.service_id] === 'number'
                                                    ? feeMapForGroup[svc.service_id]
                                                    : 0,
                                            desc: 'GHN shipping service',
                                        };

                                        const isSelected = currentShippingId === option.id;
                                        const serviceFee = feeMapForGroup[svc.service_id];
                                        const serviceError = errorMapForGroup[svc.service_id];

                                        let priceLabel = '';
                                        if (typeof serviceFee === 'number' && serviceFee > 0) {
                                            priceLabel = `${formatVnd(serviceFee)} VND`;
                                        } else if (serviceError) {
                                            priceLabel = "Not avalable";
                                        } else if (groupIsLoading) {
                                            priceLabel = 'Calculating...';
                                        } else {
                                            priceLabel = '--';
                                        }

                                        const isDisabled = !!serviceError;

                                        return (
                                            <TouchableOpacity
                                                key={option.id}
                                                style={[
                                                    styles.shippingCard,
                                                    isSelected && styles.shippingCardSelected,
                                                    (isDisabled || groupIsLoading) &&
                                                    styles.shippingCardDisabled,
                                                ]}
                                                onPress={() => {
                                                    if (isDisabled || groupIsLoading) return;
                                                    setGroupShipping(group.supplierId, option);
                                                }}
                                                activeOpacity={0.7}
                                                disabled={isDisabled || groupIsLoading}
                                            >
                                                <View style={styles.shippingHeader}>
                                                    <View style={styles.shippingTitleRow}>
                                                        <Text style={[
                                                            styles.shippingTitle,
                                                            isSelected && styles.shippingTitleSelected,
                                                        ]}>
                                                            {option.label}
                                                        </Text>
                                                        {isSelected && (
                                                            <Ionicons
                                                                name="checkmark-circle"
                                                                size={16}
                                                                color={COLORS.green}
                                                                style={{ marginLeft: 6 }}
                                                            />
                                                        )}
                                                    </View>
                                                    <View style={styles.shippingPriceRow}>
                                                        <Text
                                                            style={[
                                                                styles.shippingPrice,
                                                                !ghnServices && option.price === 0 && styles.freeShippingText,
                                                            ]}
                                                        >
                                                            {priceLabel}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.shippingDesc}>{option.desc}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
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

                <TouchableOpacity
                    style={[styles.placeOrderBtn, (isSubmitting || bankTransferSubmitting) && styles.placeOrderBtnDisabled]}
                    onPress={handlePlaceOrder}
                    disabled={isSubmitting || bankTransferSubmitting}
                >
                    {(isSubmitting || bankTransferSubmitting) ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                        <Text style={styles.placeOrderText}>Place Order</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* PAYMENT METHOD SELECTION MODAL */}
            <Modal
                visible={showPaymentMethodModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPaymentMethodModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.payMethodCard}>
                        <View style={styles.payMethodIconWrap}>
                            <Ionicons name="card-outline" size={32} color={COLORS.accent} />
                        </View>
                        <Text style={styles.payMethodTitle}>Choose Payment Method</Text>
                        <Text style={styles.payMethodSubtitle}>
                            Total: <Text style={{ fontWeight: '700', color: COLORS.accent }}>{formatVnd(totals.totalAmount)} VND</Text>
                        </Text>

                        <TouchableOpacity
                            style={styles.payMethodOption}
                            activeOpacity={0.7}
                            onPress={handleWalletPayment}
                        >
                            <View style={styles.payMethodOptionLeft}>
                                <View style={[styles.payMethodOptionIcon, { backgroundColor: '#FFF6ED' }]}>
                                    <Ionicons name="wallet-outline" size={22} color={COLORS.accent} />
                                </View>
                                <View>
                                    <Text style={styles.payMethodOptionTitle}>Pay with Wallet</Text>
                                    <Text style={styles.payMethodOptionDesc}>Balance: {formatVnd(walletBalance)} VND</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.payMethodOption}
                            activeOpacity={0.7}
                            onPress={handleBankTransfer}
                        >
                            <View style={styles.payMethodOptionLeft}>
                                <View style={[styles.payMethodOptionIcon, { backgroundColor: '#EDF7FF' }]}>
                                    <Ionicons name="business-outline" size={22} color="#2D7DD2" />
                                </View>
                                <View>
                                    <Text style={styles.payMethodOptionTitle}>Bank Transfer</Text>
                                    <Text style={styles.payMethodOptionDesc}>Pay via PayOS gateway</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.payMethodCancelBtn}
                            onPress={() => setShowPaymentMethodModal(false)}
                        >
                            <Text style={styles.payMethodCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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
                onRequestClose={handleCancelPayos}
            >
                <SafeAreaView style={styles.payosContainer} edges={['top']}>
                    <View style={styles.payosHeader}>
                        <Text style={styles.payosTitle}>Complete Payment</Text>
                        <TouchableOpacity
                            style={styles.payosCloseButton}
                            onPress={handleCancelPayos}
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
    itemCardContainer: {
        paddingVertical: 12,
        marginBottom: 8,
        backgroundColor: 'transparent',
    },
    itemCardContent: {
        flexDirection: 'row',
    },
    issueOverlayContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    outOfStockBadge: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: COLORS.white,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        fontFamily: 'Outfit-Bold',
        fontWeight: 'bold',
        fontSize: 14,
    },
    notEnoughBadge: {
        backgroundColor: 'rgba(178, 59, 59, 0.95)',
        color: COLORS.white,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        fontFamily: 'Outfit-Bold',
        fontWeight: 'bold',
        fontSize: 12,
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
    shippingCardDisabled: {
        opacity: 0.6,
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

    // Payment Method Modal
    payMethodCard: {
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
    payMethodIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFF6ED',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    payMethodTitle: {
        fontSize: 20,
        fontFamily: 'Outfit-SemiBold',
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 6,
    },
    payMethodSubtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: 20,
    },
    payMethodOption: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.bg,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    payMethodOptionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    payMethodOptionIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    payMethodOptionTitle: {
        fontSize: 15,
        fontFamily: 'Outfit-Medium',
        fontWeight: '600',
        color: COLORS.text,
    },
    payMethodOptionDesc: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    payMethodCancelBtn: {
        marginTop: 6,
        paddingVertical: 12,
        width: '100%',
        alignItems: 'center',
    },
    payMethodCancelText: {
        fontSize: 15,
        fontFamily: 'Outfit-Medium',
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
});
