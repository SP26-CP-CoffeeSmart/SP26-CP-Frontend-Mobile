import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

const COLORS = {
  background: '#F7F2EE',
  card: '#FFFFFF',
  ink: '#1E1B16',
  muted: '#7A6F67',
  accent: '#2B1C15',
  accentSoft: '#E6D7C9',
  border: '#EFE4D8',
  surface: '#FBF7F2',
  success: '#15803D',
};

const toUtcPlus7LocalDateTimeString = (value: Date = new Date()) => {
  const utcMs = value.getTime() + value.getTimezoneOffset() * 60 * 1000;
  // Backend normalizes incoming timestamps to UTC before storing timestamp without timezone.
  // Shift forward by 14 hours from UTC so persisted value matches UTC+7 clock time.
  const utcPlus14 = new Date(utcMs + 14 * 60 * 60 * 1000);

  const year = utcPlus14.getUTCFullYear();
  const month = String(utcPlus14.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utcPlus14.getUTCDate()).padStart(2, '0');
  const hours = String(utcPlus14.getUTCHours()).padStart(2, '0');
  const minutes = String(utcPlus14.getUTCMinutes()).padStart(2, '0');
  const seconds = String(utcPlus14.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(utcPlus14.getUTCMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
};

type Ingredient = {
  ingredientId: number;
  name: string;
  image?: string | null;
  category: string;
  measurement: string;
  currentQuantity: number;
};

type IngredientApiItem = {
  ingredientId?: number;
  IngredientId?: number;
  name?: string;
  Name?: string;
  category?: string;
  Category?: string;
  image?: string | null;
  Image?: string | null;
  measurement?: string;
  Measurement?: string;
  quantity?: number;
  Quantity?: number;
  currentQuantity?: number;
  CurrentQuantity?: number;
};

type PagedIngredientResponse = {
  items?: IngredientApiItem[];
  totalPages?: number;
};

type ImportDetail = {
  ingredientId: number;
  ingredient: Ingredient;
  importQuantity: number;
};

type ImportNoteResponse = {
  importNoteId?: number;
};

type OrderItem = {
  id: number;
  ingredientId: number;
  name: string;
  category: string;
  orderedQty: number;
  receivedQty: number;
  unitLabel: string;
  price: number;
  shortage?: number;
};

type OrderSummary = {
  orderId: number;
  orderCode: string;
  supplierId?: number;
  supplier: string;
  status: string;
  orderDate: string;
  expectedDate: string;
  items: OrderItem[];
};

type OrderDetailResponse = {
  orderDetailId?: number;
  orderDetail_id?: number;
  ingredientId?: number;
  ingredient_id?: number;
  ingredientName?: string;
  ingredient_name?: string;
  quantity?: number;
  Quantity?: number;
  price?: number;
  Price?: number;
};

type OrderResponse = {
  orderId?: number;
  OrderId?: number;
  status?: string;
  createAt?: string;
  expectedDeliveryTime?: string;
  supplierId?: number;
  supplier_id?: number;
  supplierName?: string;
  SupplierName?: string;
  ghnOrderCode?: string;
  notes?: string;
  orderDetails?: OrderDetailResponse[];
};

type PagedOrderResponse = {
  items?: OrderResponse[];
};

type SupplierProductIngredient = {
  ingredientId?: number;
  category?: string;
};

type SupplierProductItem = {
  ingredientId?: number;
  measurement?: string;
  packageSize?: number;
  price?: number;
  ingredient?: SupplierProductIngredient;
};

type PagedSupplierProductResponse = {
  items?: SupplierProductItem[];
  totalPages?: number;
};

type SubmitDraft = {
  tab: 'order' | 'manual';
  noteTitle: string;
  details: ImportDetail[];
  selectedOrder: OrderSummary | null;
};

type AlertModalState = {
  visible: boolean;
  title: string;
  message: string;
  tone: 'warning' | 'error';
};

const MOCK_INGREDIENTS: Ingredient[] = [
  {
    ingredientId: 1,
    name: 'Arabica Coffee Beans',
    image: 'https://images.unsplash.com/photo-1459755486867-b55449bb39ff?auto=format&fit=crop&w=200&q=60',
    category: 'Coffee Beans',
    measurement: 'kg',
    currentQuantity: 45,
  },
  {
    ingredientId: 2,
    name: 'Full Cream Milk',
    image: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac54?auto=format&fit=crop&w=200&q=60',
    category: 'Milk',
    measurement: 'liters',
    currentQuantity: 32,
  },
  {
    ingredientId: 3,
    name: 'Vanilla Syrup',
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=200&q=60',
    category: 'Syrup',
    measurement: 'bottles',
    currentQuantity: 18,
  },
  {
    ingredientId: 4,
    name: 'Paper Cups 12oz',
    image: 'https://images.unsplash.com/photo-1520315342629-6ea920342047?auto=format&fit=crop&w=200&q=60',
    category: 'Supplies',
    measurement: 'packs',
    currentQuantity: 22,
  },
];

const CATEGORY_OPTIONS = ['All', 'Coffee Beans', 'Milk', 'Syrup', 'Supplies'];
const QUANTITY_INPUT_REGEX = /^\d*(\.\d*)?$/;

const formatOrderDate = (value?: string) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatVnd = (value?: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

const normalizeMeasureToken = (value?: string | null) => (value ?? '').trim().toLowerCase();

const isLiquidLikeCategory = (category?: string | null) =>
  normalizeMeasureToken(category).includes('liquid');

const isDryLikeCategory = (category?: string | null) => normalizeMeasureToken(category).includes('dry');

const resolveBaseMeasurement = (category?: string | null, measurement?: string | null) => {
  const normalizedMeasurement = normalizeMeasureToken(measurement);
  if (['kg', 'kilogram', 'g', 'gram', 'grams'].includes(normalizedMeasurement)) {
    return 'g';
  }
  if (['l', 'liter', 'litre', 'ml', 'milliliter', 'millilitre'].includes(normalizedMeasurement)) {
    return 'ml';
  }
  if (isDryLikeCategory(category)) {
    return 'g';
  }
  if (isLiquidLikeCategory(category)) {
    return 'ml';
  }
  return measurement?.trim() || 'unit';
};

const resolveMeasurementMultiplier = (measurement?: string | null) => {
  const normalized = normalizeMeasureToken(measurement);
  if (['kg', 'kilogram'].includes(normalized)) {
    return 1000;
  }
  if (['l', 'liter', 'litre'].includes(normalized)) {
    return 1000;
  }
  return 1;
};

const normalizeQuantityBySupplierMeasurement = (params: {
  orderedQuantity: number;
  packageSize?: number | null;
  category?: string | null;
  measurement?: string | null;
}) => {
  const orderedQuantity = Number.isFinite(params.orderedQuantity) ? params.orderedQuantity : 0;
  const packageSize =
    typeof params.packageSize === 'number' && Number.isFinite(params.packageSize) && params.packageSize > 0
      ? params.packageSize
      : 1;
  const multiplier = resolveMeasurementMultiplier(params.measurement);
  const normalizedQuantity = orderedQuantity * packageSize * multiplier;
  const unitLabel = resolveBaseMeasurement(params.category, params.measurement);

  return {
    quantity: Number(normalizedQuantity.toFixed(3)),
    unitLabel,
  };
};

const normalizeDisplayPriceBySupplierMeasurement = (params: {
  rawPrice: number;
  packageSize?: number | null;
  category?: string | null;
  measurement?: string | null;
}) => {
  const unitLabel = resolveBaseMeasurement(params.category, params.measurement);
  const rawPrice = Number.isFinite(params.rawPrice) ? params.rawPrice : 0;
  const packageSize =
    typeof params.packageSize === 'number' && Number.isFinite(params.packageSize) && params.packageSize > 0
      ? params.packageSize
      : 1;
  const multiplier = resolveMeasurementMultiplier(params.measurement);
  const divisor = packageSize * multiplier;

  if ((unitLabel === 'g' || unitLabel === 'ml') && divisor > 0) {
    return Number((rawPrice / divisor).toFixed(3));
  }

  return Number(rawPrice.toFixed(3));
};

const resolveOrderSupplierId = (order: OrderResponse) =>
  Number(order.supplierId ?? order.supplier_id ?? 0);

const getSupplierNameFromPayload = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, unknown>;
  const candidates = [
    data.supplierName,
    data.SupplierName,
    data.name,
    data.Name,
    (data.supplier as Record<string, unknown> | undefined)?.supplierName,
    (data.supplier as Record<string, unknown> | undefined)?.SupplierName,
    (data.supplier as Record<string, unknown> | undefined)?.name,
    (data.supplier as Record<string, unknown> | undefined)?.Name,
  ];

  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) {
      return item.trim();
    }
  }
  return null;
};

const mapOrderToSummary = (
  order: OrderResponse,
  supplierProductsByIngredient: Map<number, SupplierProductItem> = new Map(),
  supplierName?: string
): OrderSummary => {
  const items = (order.orderDetails ?? []).map((detail, index) => {
    const ingredientId = Number(detail.ingredientId ?? detail.ingredient_id ?? 0);
    const supplierProduct = supplierProductsByIngredient.get(ingredientId);
    const category = supplierProduct?.ingredient?.category ?? 'Ingredient';
    const normalized = normalizeQuantityBySupplierMeasurement({
      orderedQuantity: Number(detail.quantity ?? detail.Quantity ?? 0),
      packageSize: supplierProduct?.packageSize,
      category,
      measurement: supplierProduct?.measurement,
    });

    return {
      id: detail.orderDetailId ?? detail.orderDetail_id ?? index,
      ingredientId,
      name: detail.ingredientName ?? detail.ingredient_name ?? 'Unknown item',
      category,
      orderedQty: normalized.quantity,
      receivedQty: normalized.quantity,
      unitLabel: normalized.unitLabel,
      price: normalizeDisplayPriceBySupplierMeasurement({
        rawPrice: Number(detail.price ?? detail.Price ?? 0),
        packageSize: supplierProduct?.packageSize,
        category,
        measurement: supplierProduct?.measurement,
      }),
    };
  });

  const orderId = Number(order.orderId ?? order.OrderId ?? 0);
  const supplierId = resolveOrderSupplierId(order);
  const resolvedSupplierName =
    supplierName ??
    getSupplierNameFromPayload(order) ??
    (supplierId > 0 ? `Supplier #${supplierId}` : 'Supplier');
  return {
    orderId,
    orderCode: order.ghnOrderCode ?? `ORD-${orderId || 'N/A'}`,
    supplierId: supplierId > 0 ? supplierId : undefined,
    supplier: resolvedSupplierName,
    status: order.status ?? 'Pending',
    orderDate: formatOrderDate(order.createAt),
    expectedDate: formatOrderDate(order.expectedDeliveryTime),
    items,
  };
};

const getStatusStyle = (status?: string) => {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized.includes('await') || normalized.includes('pending')) {
    return styles.statusAwaiting;
  }
  return styles.statusTransit;
};

const isImportedOrder = (order: OrderResponse) =>
  (order.notes ?? '').toLowerCase().includes('[imported]');

const isCompletedOrDelivered = (status?: string) => {
  const normalized = (status ?? '').trim().toLowerCase();
  return normalized === 'completed' || normalized === 'delivered';
};

const resolveManualImportMeasurement = (ingredient: Ingredient) => {
  const normalizedCategory = (ingredient.category ?? '').trim().toLowerCase();

  if (normalizedCategory.includes('liquid')) {
    return 'ml';
  }

  if (normalizedCategory.includes('dry')) {
    return 'g';
  }

  return ingredient.measurement?.trim() || 'unit';
};

export default function ImportRequestScreen() {
  const router = useRouter();
  const { coffeeShopId, ownerId } = useAuth();
  const resolvedOwnerId = useMemo(() => ownerId ?? null, [ownerId]);
  const [activeTab, setActiveTab] = useState<'order' | 'manual'>('order');
  const [noteTitle, setNoteTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [manualDetails, setManualDetails] = useState<ImportDetail[]>([]);
  const [orderDetails, setOrderDetails] = useState<ImportDetail[]>([]);
  const [orderId, setOrderId] = useState('');
  const [orderLoaded, setOrderLoaded] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientLoading, setIngredientLoading] = useState(false);
  const [ingredientError, setIngredientError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertModal, setAlertModal] = useState<AlertModalState>({
    visible: false,
    title: '',
    message: '',
    tone: 'warning',
  });
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [submitDraft, setSubmitDraft] = useState<SubmitDraft | null>(null);
  const [manualQuantityInputs, setManualQuantityInputs] = useState<Record<number, string>>({});
  const [manualQuantityErrors, setManualQuantityErrors] = useState<Record<number, string>>({});

  const selectedItemCount = selectedOrder?.items.length ?? 0;

  const details = activeTab === 'manual' ? manualDetails : orderDetails;

  const categoryOptions = useMemo(() => {
    if (!ingredients.length) {
      return CATEGORY_OPTIONS;
    }
    const dynamicCategories = Array.from(
      new Set(ingredients.map((item) => item.category).filter((category) => category))
    );
    return ['All', ...dynamicCategories];
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ingredients.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesQuery = !query || item.name.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, selectedCategory, ingredients]);

  const loadIngredients = useCallback(async () => {
    try {
      setIngredientLoading(true);
      setIngredientError(null);
      const pageSize = 100;
      let page = 1;
      let totalPages = 1;
      const rows: IngredientApiItem[] = [];

      while (page <= totalPages) {
        const response = await authorizedFetch(
          `${API_ENDPOINTS.ingredient.getAll()}?page=${page}&pageSize=${pageSize}`,
          {
            headers: {
              Accept: '*/*',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = (await response.json()) as IngredientApiItem[] | PagedIngredientResponse;
        const pageRows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        rows.push(...pageRows);

        const nextTotalPages = Number(Array.isArray(data) ? 1 : data?.totalPages ?? 1);
        totalPages = Number.isFinite(nextTotalPages) && nextTotalPages > 0 ? nextTotalPages : 1;
        page += 1;
      }

      const mapped: Ingredient[] = rows
      .map((item) => {
        const ingredientId = Number(item.ingredientId ?? item.IngredientId ?? 0);
        return {
          ingredientId,
          name: (item.name ?? item.Name)?.trim() || `Ingredient #${ingredientId || 'N/A'}`,
          category: (item.category ?? item.Category)?.trim() || 'Uncategorized',
          image: item.image ?? item.Image ?? null,
          measurement: item.measurement ?? item.Measurement ?? 'unit',
          currentQuantity: Number(
            item.currentQuantity ?? item.CurrentQuantity ?? item.quantity ?? item.Quantity ?? 0
          ),
        };
      })
      .filter((item) => item.ingredientId > 0);

      setIngredients(mapped);
      if (selectedCategory !== 'All' && !mapped.some((item) => item.category === selectedCategory)) {
        setSelectedCategory('All');
      }
    } catch (error) {
      setIngredients([]);
      setIngredientError('Unable to load ingredients.');
    } finally {
      setIngredientLoading(false);
    }
  }, [selectedCategory]);

  const handleAddIngredient = (ingredient: Ingredient) => {
    setManualDetails((prev) => {
      const existing = prev.find((detail) => detail.ingredientId === ingredient.ingredientId);
      if (existing) {
        const nextDetails = prev.map((detail) =>
          detail.ingredientId === ingredient.ingredientId
            ? { ...detail, importQuantity: detail.importQuantity + 1 }
            : detail
        );
        const updated = nextDetails.find((detail) => detail.ingredientId === ingredient.ingredientId);
        if (updated) {
          setManualQuantityInputs((current) => ({
            ...current,
            [ingredient.ingredientId]: String(updated.importQuantity),
          }));
          setManualQuantityErrors((current) => {
            if (!current[ingredient.ingredientId]) {
              return current;
            }
            const next = { ...current };
            delete next[ingredient.ingredientId];
            return next;
          });
        }
        return nextDetails;
      }

      setManualQuantityInputs((current) => ({
        ...current,
        [ingredient.ingredientId]: '1',
      }));
      return [
        ...prev,
        {
          ingredientId: ingredient.ingredientId,
          ingredient,
          importQuantity: 1,
        },
      ];
    });
  };

  const updateManualQuantity = (ingredientId: number, quantity: number) => {
    setManualDetails((prev) =>
      prev.map((detail) => {
        if (detail.ingredientId !== ingredientId) {
          return detail;
        }
        return { ...detail, importQuantity: quantity };
      })
    );
  };

  const handleUpdateQuantity = (ingredientId: number, delta: number) => {
    let nextQuantity = 0;
    setManualDetails((prev) =>
      prev.map((detail) => {
        if (detail.ingredientId !== ingredientId) {
          return detail;
        }
        nextQuantity = Math.max(detail.importQuantity + delta, 0);
        return { ...detail, importQuantity: nextQuantity };
      })
    );
    setManualQuantityInputs((current) => ({
      ...current,
      [ingredientId]: String(nextQuantity),
    }));
    setManualQuantityErrors((current) => {
      if (!current[ingredientId]) {
        return current;
      }
      const next = { ...current };
      delete next[ingredientId];
      return next;
    });
  };

  const handleManualQuantityInput = (ingredientId: number, rawValue: string) => {
    const normalizedValue = rawValue.replace(',', '.').trim();

    if (normalizedValue.includes('-')) {
      setManualQuantityErrors((current) => ({
        ...current,
        [ingredientId]: 'Quantity cannot be negative.',
      }));
      return;
    }

    if (!QUANTITY_INPUT_REGEX.test(normalizedValue)) {
      setManualQuantityErrors((current) => ({
        ...current,
        [ingredientId]: 'Quantity must be numeric.',
      }));
      return;
    }

    setManualQuantityInputs((current) => ({
      ...current,
      [ingredientId]: normalizedValue,
    }));
    setManualQuantityErrors((current) => {
      if (!current[ingredientId]) {
        return current;
      }
      const next = { ...current };
      delete next[ingredientId];
      return next;
    });

    if (normalizedValue === '' || normalizedValue === '.') {
      updateManualQuantity(ingredientId, 0);
      return;
    }

    const parsed = Number(normalizedValue);
    updateManualQuantity(ingredientId, Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
  };

  const handleManualQuantityBlur = (ingredientId: number) => {
    const inputValue = manualQuantityInputs[ingredientId];
    if (inputValue === undefined) {
      return;
    }

    if (inputValue === '' || inputValue === '.') {
      setManualQuantityInputs((current) => ({
        ...current,
        [ingredientId]: '0',
      }));
      updateManualQuantity(ingredientId, 0);
      return;
    }

    const parsed = Number(inputValue);
    const normalized = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setManualQuantityInputs((current) => ({
      ...current,
      [ingredientId]: String(normalized),
    }));
    updateManualQuantity(ingredientId, normalized);
  };

  const handleRemoveDetail = (ingredientId: number) => {
    setManualDetails((prev) => prev.filter((detail) => detail.ingredientId !== ingredientId));
    setManualQuantityInputs((prev) => {
      if (prev[ingredientId] === undefined) {
        return prev;
      }
      const next = { ...prev };
      delete next[ingredientId];
      return next;
    });
    setManualQuantityErrors((prev) => {
      if (!prev[ingredientId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[ingredientId];
      return next;
    });
  };

  const handleLoadOrder = () => {
    if (!orderId.trim()) {
      Alert.alert('Missing order ID', 'Please enter an order ID to continue.');
      return;
    }

    const mockDetails: ImportDetail[] = [
      {
        ingredientId: MOCK_INGREDIENTS[0].ingredientId,
        ingredient: MOCK_INGREDIENTS[0],
        importQuantity: 12,
      },
      {
        ingredientId: MOCK_INGREDIENTS[1].ingredientId,
        ingredient: MOCK_INGREDIENTS[1],
        importQuantity: 6,
      },
    ];

    setOrderDetails(mockDetails);
    setOrderLoaded(true);
    if (!noteTitle.trim()) {
      setNoteTitle(`Import materials from order #${orderId.trim()}`);
    }
    Alert.alert('Order loaded', 'Mock import details were generated from the order.');
  };

  const handleSelectOrder = (order: OrderSummary) => {
    console.log('[ImportRequest] Selected order details:', {
      orderId: order.orderId,
      orderCode: order.orderCode,
      supplierId: order.supplierId,
      items: order.items,
    });

    setSelectedOrder(order);
    setOrderId(String(order.orderId));
    const mappedDetails: ImportDetail[] = order.items.map((item) => ({
      ingredientId: item.ingredientId,
      ingredient: {
        ingredientId: item.ingredientId,
        name: item.name,
        image: null,
        category: item.category,
        measurement: item.unitLabel,
        currentQuantity: 0,
      },
      importQuantity: item.receivedQty,
    }));

    setOrderDetails(mappedDetails);
    setOrderLoaded(true);
    if (!noteTitle.trim()) {
      setNoteTitle(`Import materials from order #${order.orderCode}`);
    }
  };

  const loadOrders = useCallback(async () => {
    if (!resolvedOwnerId) {
      setOrders([]);
      setOrderError('Unable to load orders.');
      return;
    }

    try {
      setOrderLoading(true);
      setOrderError(null);

      const fetchSupplierProductsBySupplier = async (supplierId: number) => {
        let page = 1;
        let totalPages = 1;
        const rows: SupplierProductItem[] = [];

        while (page <= totalPages) {
          const response = await authorizedFetch(
            API_ENDPOINTS.supplierProduct.bySupplier(supplierId, page, 100),
            {
              headers: {
                Accept: '*/*',
              },
            }
          );

          if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
          }

          const data = (await response.json()) as SupplierProductItem[] | PagedSupplierProductResponse;
          const pageRows = Array.isArray(data) ? data : data.items ?? [];
          rows.push(...pageRows);

          const nextTotalPages = Number(Array.isArray(data) ? 1 : data.totalPages ?? 1);
          totalPages = Number.isFinite(nextTotalPages) && nextTotalPages > 0 ? nextTotalPages : 1;
          page += 1;
        }

        return rows;
      };

      const fetchSupplierNameById = async (supplierId: number) => {
        const response = await authorizedFetch(`${API_ENDPOINTS.supplier.list()}/${supplierId}`, {
          headers: {
            Accept: '*/*',
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = (await response.json()) as unknown;
        return getSupplierNameFromPayload(data);
      };

      const fetchOrdersByStatus = async (status: 'Completed' | 'Delivered') => {
        const url = API_ENDPOINTS.order.byOwner(resolvedOwnerId, {
          page: 1,
          pageSize: 20,
          orderStatus: status,
        });

        const response = await authorizedFetch(url, {
          headers: {
            Accept: '*/*',
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = (await response.json()) as OrderResponse[] | PagedOrderResponse;
        return Array.isArray(data) ? data : data.items ?? [];
      };

      const [completedResult, deliveredResult] = await Promise.allSettled([
        fetchOrdersByStatus('Completed'),
        fetchOrdersByStatus('Delivered'),
      ]);

      const completedOrders = completedResult.status === 'fulfilled' ? completedResult.value : [];
      const deliveredOrders = deliveredResult.status === 'fulfilled' ? deliveredResult.value : [];

      if (!completedOrders.length && !deliveredOrders.length) {
        throw new Error('No Orders Found.');
      }

      const mergedOrders = [...completedOrders, ...deliveredOrders];
      const uniqueOrders = Array.from(
        new Map(mergedOrders.map((order) => [order.orderId ?? 0, order])).values()
      );

      const filtered = uniqueOrders.filter(
        (order) => !isImportedOrder(order) && isCompletedOrDelivered(order.status)
      );
      const uniqueSupplierIds = Array.from(
        new Set(
          filtered
            .map((order) => resolveOrderSupplierId(order))
            .filter((supplierId) => Number.isFinite(supplierId) && supplierId > 0)
        )
      );

      const supplierProductsResult = await Promise.allSettled(
        uniqueSupplierIds.map(async (supplierId) => ({
          supplierId,
          items: await fetchSupplierProductsBySupplier(supplierId),
        }))
      );

      const supplierProductMapBySupplierId = new Map<number, Map<number, SupplierProductItem>>();
      supplierProductsResult.forEach((result) => {
        if (result.status !== 'fulfilled') {
          return;
        }
        const byIngredientId = new Map<number, SupplierProductItem>();
        result.value.items.forEach((item) => {
          const ingredientId = Number(item.ingredientId ?? item.ingredient?.ingredientId ?? 0);
          if (Number.isFinite(ingredientId) && ingredientId > 0) {
            byIngredientId.set(ingredientId, item);
          }
        });
        supplierProductMapBySupplierId.set(result.value.supplierId, byIngredientId);
      });

      const supplierNameResult = await Promise.allSettled(
        uniqueSupplierIds.map(async (supplierId) => ({
          supplierId,
          name: await fetchSupplierNameById(supplierId),
        }))
      );
      const supplierNameById = new Map<number, string>();
      supplierNameResult.forEach((result) => {
        if (result.status !== 'fulfilled') {
          return;
        }
        if (result.value.name) {
          supplierNameById.set(result.value.supplierId, result.value.name);
        }
      });

      const mapped = filtered.map((order) => {
        const supplierId = resolveOrderSupplierId(order);
        const supplierProductsByIngredient =
          supplierProductMapBySupplierId.get(supplierId) ?? new Map<number, SupplierProductItem>();
        return mapOrderToSummary(order, supplierProductsByIngredient, supplierNameById.get(supplierId));
      });
      console.log('Fetched orders:', mapped);
      setOrders(mapped);

      if (selectedOrder && !mapped.some((order) => order.orderId === selectedOrder.orderId)) {
        setSelectedOrder(null);
        setOrderLoaded(false);
      }
    } catch (error) {
      setOrderError('Unable to load orders from the server.');
    } finally {
      setOrderLoading(false);
    }
  }, [resolvedOwnerId, selectedOrder]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'order') {
        loadOrders();
      }
    }, [activeTab, loadOrders])
  );

  useEffect(() => {
    if (activeTab === 'manual') {
      loadIngredients();
    }
  }, [activeTab, loadIngredients]);

  const filteredOrders = orders.filter((order) => {
    const query = orderSearchQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return (
      order.orderCode.toLowerCase().includes(query) ||
      order.supplier.toLowerCase().includes(query)
    );
  });

  const showAlertModal = (title: string, message: string, tone: AlertModalState['tone'] = 'warning') => {
    setAlertModal({
      visible: true,
      title,
      message,
      tone,
    });
  };

  const closeAlertModal = () => {
    setAlertModal((prev) => ({ ...prev, visible: false }));
  };

  const closeConfirmModal = () => {
    setConfirmVisible(false);
    setSubmitDraft(null);
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }
    if (!coffeeShopId) {
      showAlertModal('Missing shop', 'Please sign in again to continue.', 'error');
      return;
    }
    if (activeTab === 'order' && (!orderLoaded || !selectedOrder)) {
      showAlertModal('Load order first', 'Please select and load an order before submitting.');
      return;
    }
    if (!details.length) {
      showAlertModal('Missing items', 'Please add at least one ingredient.');
      return;
    }

    if (activeTab === 'manual' && details.some((detail) => detail.importQuantity <= 0)) {
      showAlertModal(
        'Invalid quantity',
        'All selected ingredients must have import quantity greater than 0.'
      );
      return;
    }

    setSubmitDraft({
      tab: activeTab,
      noteTitle: noteTitle.trim(),
      details: details.map((detail) => ({
        ...detail,
        ingredient: { ...detail.ingredient },
      })),
      selectedOrder: selectedOrder ? { ...selectedOrder } : null,
    });
    setConfirmVisible(true);
  };

  const confirmSubmit = async () => {
    if (isSubmitting) {
      return;
    }
    if (!submitDraft) {
      return;
    }

    const titleToUse = submitDraft.noteTitle || 'Import Note';

    const createImportNote = async () => {
      const response = await authorizedFetch(API_ENDPOINTS.importNote.create(), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coffeeShopId,
          title: titleToUse,
          createdAt: toUtcPlus7LocalDateTimeString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = (await response.json()) as ImportNoteResponse;
      if (!data.importNoteId) {
        throw new Error('Import note id is missing in response.');
      }
      return data.importNoteId;
    };

    const createImportDetails = async (importNoteId: number, items: ImportDetail[]) => {
      const payloads = items
        .filter((detail) => detail.importQuantity > 0)
        .map((detail) => ({
          importNoteId,
          ingredientId: detail.ingredientId,
          currentQuantity: detail.ingredient.currentQuantity ?? 0,
          importQuantity: detail.importQuantity,
          updatedQuantity: (detail.ingredient.currentQuantity ?? 0) + detail.importQuantity,
          measurement: detail.ingredient.measurement ?? null,
        }));

      await Promise.all(
        payloads.map(async (payload) => {
          const response = await authorizedFetch(API_ENDPOINTS.importDetail.create(), {
            method: 'POST',
            headers: {
              Accept: '*/*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
          }
        })
      );
    };

    if (submitDraft.tab === 'order' && submitDraft.selectedOrder) {
      try {
        setIsSubmitting(true);
        setConfirmVisible(false);
        const response = await authorizedFetch(
          API_ENDPOINTS.shopInventory.importFromOrder(submitDraft.selectedOrder.orderId),
          {
            method: 'POST',
            headers: {
              Accept: '*/*',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        await loadOrders();

        Toast.show({
          type: 'success',
          text1: 'Import successful',
          text2: 'Inventory was imported from the selected order.',
        });
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Import failed',
          text2: 'Unable to import inventory from this order.',
        });
      } finally {
        setIsSubmitting(false);
        setSubmitDraft(null);
      }
      return;
    }

    if (submitDraft.tab === 'manual') {
      try {
        if (submitDraft.details.some((detail) => detail.importQuantity <= 0)) {
          setConfirmVisible(false);
          showAlertModal(
            'Invalid quantity',
            'All selected ingredients must have import quantity greater than 0.'
          );
          return;
        }

        const items = submitDraft.details
          .filter((detail) => detail.importQuantity > 0)
          .map((detail) => ({
            ingredientId: detail.ingredientId,
            quantity: detail.importQuantity,
            measurement: resolveManualImportMeasurement(detail.ingredient),
            note: null,
          }));

        if (!items.length) {
          setConfirmVisible(false);
          showAlertModal('Invalid quantity', 'Please set at least one import quantity greater than 0.');
          return;
        }

        setIsSubmitting(true);
        setConfirmVisible(false);

        const response = await authorizedFetch(API_ENDPOINTS.shopInventory.manualImport(), {
          method: 'POST',
          headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: submitDraft.noteTitle || 'Manual import',
            items,
          }),
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        Toast.show({
          type: 'success',
          text1: 'Manual import successful',
          text2: 'Inventory was updated from manual entries.',
        });
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Manual import failed',
          text2: 'Unable to import inventory manually.',
        });
      } finally {
        setIsSubmitting(false);
        setSubmitDraft(null);
      }
      return;
    }

    try {
      setIsSubmitting(true);
      setConfirmVisible(false);
      const importNoteId = await createImportNote();
      await createImportDetails(importNoteId, submitDraft.details);
      Toast.show({
        type: 'success',
        text1: 'Import request submitted',
        text2: 'Import note created successfully.',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Import failed',
        text2: 'Unable to create import note.',
      });
    } finally {
      setIsSubmitting(false);
      setSubmitDraft(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={COLORS.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Import Request</Text>
          <View style={styles.headerIconSpacer} />
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'order' && styles.tabButtonActive]}
            onPress={() => setActiveTab('order')}
          >
            <Ionicons name="receipt-outline" size={16} color={activeTab === 'order' ? '#FFFFFF' : COLORS.muted} />
            <Text style={[styles.tabText, activeTab === 'order' && styles.tabTextActive]}>From Order</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'manual' && styles.tabButtonActive]}
            onPress={() => setActiveTab('manual')}
          >
            <Ionicons name="create-outline" size={16} color={activeTab === 'manual' ? '#FFFFFF' : COLORS.muted} />
            <Text style={[styles.tabText, activeTab === 'manual' && styles.tabTextActive]}>Manual</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Import note title</Text>
          <TextInput
            value={noteTitle}
            onChangeText={setNoteTitle}
            placeholder="Morning beans restock"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
          />
          <Text style={styles.helperText}>Created today - staff can update later.</Text>
        </View>

        {activeTab === 'order' ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Completed or delivered orders</Text>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color={COLORS.muted} />
              <TextInput
                value={orderSearchQuery}
                onChangeText={setOrderSearchQuery}
                placeholder="Search supplier or order ID"
                placeholderTextColor={COLORS.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.orderList}>
              {orderLoading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                  <Text style={styles.emptyText}>Loading orders...</Text>
                </View>
              ) : orderError ? (
                <Text style={styles.emptyText}>{orderError}</Text>
              ) : filteredOrders.length ? (
                filteredOrders.map((order) => {
                  const isActive = selectedOrder?.orderId === order.orderId;
                  const statusStyle = getStatusStyle(order.status);
                  return (
                    <TouchableOpacity
                      key={order.orderId}
                      style={[styles.orderCard, isActive && styles.orderCardActive]}
                      onPress={() => handleSelectOrder(order)}
                    >
                      <View style={styles.orderHeader}>
                        <Text style={styles.orderCode}>{order.orderCode}</Text>
                        <View style={[styles.statusPill, statusStyle]}>
                          <Text style={styles.statusText}>{order.status}</Text>
                        </View>
                      </View>
                      <Text style={styles.orderSupplier}>{order.supplier}</Text>
                      <View style={styles.orderMetaRow}>
                        <View style={styles.orderMetaItem}>
                          <Ionicons name="time-outline" size={14} color={COLORS.muted} />
                          <Text style={styles.orderMetaText}>{order.orderDate}</Text>
                        </View>
                        <View style={styles.orderMetaItem}>
                          <Ionicons name="cube-outline" size={14} color={COLORS.muted} />
                          <Text style={styles.orderMetaText}>{order.items.length} items</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No orders found for this search.</Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Search ingredients</Text>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color={COLORS.muted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search inventory items"
                placeholderTextColor={COLORS.muted}
                style={styles.searchInput}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {categoryOptions.map((category) => {
                const isActive = selectedCategory === category;
                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{category}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.ingredientList}>
              {ingredientLoading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                  <Text style={styles.emptyText}>Loading ingredients...</Text>
                </View>
              ) : ingredientError ? (
                <Text style={styles.emptyText}>{ingredientError}</Text>
              ) : (
                <ScrollView
                  style={styles.ingredientListScroll}
                  contentContainerStyle={styles.ingredientListContent}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                >
                  {filteredIngredients.map((ingredient) => (
                    <TouchableOpacity
                      key={ingredient.ingredientId}
                      style={styles.ingredientRow}
                      onPress={() => handleAddIngredient(ingredient)}
                    >
                      <View style={styles.ingredientImageWrap}>
                        {ingredient.image ? (
                          <Image source={{ uri: ingredient.image }} style={styles.ingredientImage} />
                        ) : (
                          <Ionicons name="cafe" size={22} color={COLORS.muted} />
                        )}
                      </View>
                      <View style={styles.ingredientInfo}>
                        <Text style={styles.ingredientName}>{ingredient.name}</Text>
                        <Text style={styles.ingredientMeta}>{ingredient.category}</Text>
                      </View>
                      <Ionicons name="add-circle" size={22} color={COLORS.accent} />
                    </TouchableOpacity>
                  ))}
                  {!filteredIngredients.length ? (
                    <Text style={styles.emptyText}>No ingredients found for this filter.</Text>
                  ) : null}
                </ScrollView>
              )}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Import details</Text>
          {activeTab === 'order' ? (
            selectedOrder ? (
              <>
                <View style={styles.orderSummaryCard}>
                  <View style={styles.orderSummaryHeader}>
                    <Text style={styles.orderSummaryCode}>{selectedOrder.orderCode}</Text>
                    <View style={[styles.statusPill, getStatusStyle(selectedOrder.status)]}>
                      <Text style={styles.statusText}>{selectedOrder.status}</Text>
                    </View>
                  </View>
                  <View style={styles.orderSummaryRow}>
                    <Text style={styles.orderSummaryLabel}>Supplier</Text>
                    <Text style={styles.orderSummaryValue}>{selectedOrder.supplier}</Text>
                  </View>
                  <View style={styles.orderSummaryRow}>
                    <Text style={styles.orderSummaryLabel}>Order date</Text>
                    <Text style={styles.orderSummaryValue}>{selectedOrder.orderDate}</Text>
                  </View>
                  <View style={styles.orderSummaryRow}>
                    <Text style={styles.orderSummaryLabel}>Expected</Text>
                    <Text style={styles.orderSummaryValue}>{selectedOrder.expectedDate}</Text>
                  </View>
                </View>

                <View style={styles.orderItemsHeader}>
                  <Text style={styles.orderItemsTitle}>Items to receive</Text>
                  <Text style={styles.orderItemsCount}>{selectedItemCount} items</Text>
                </View>

                <View style={styles.orderItemsList}>
                  {selectedOrder.items.map((item) => (
                    <View key={item.id} style={styles.orderItemCard}>
                      <View style={styles.orderItemHeader}>
                        <Text style={styles.orderItemTitle}>{item.name}</Text>
                        <View style={styles.orderQtyPill}>
                          <Text style={styles.orderQtyText}>
                            Receive {item.receivedQty} {item.unitLabel}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.orderItemMeta}>
                        Category: {item.category} • Ordered: {item.orderedQty} {item.unitLabel}
                      </Text>
                      <Text style={styles.orderItemMeta}>
                        To receive: {item.receivedQty} {item.unitLabel}
                      </Text>
                      <Text style={styles.orderItemMeta}>
                        Price: {formatVnd(item.price)}/{item.unitLabel}
                      </Text>
                      {item.shortage ? (
                        <View style={styles.orderShortage}>
                          <Ionicons name="alert-circle" size={14} color="#B91C1C" />
                          <Text style={styles.orderShortageText}>
                            Shortage: {item.shortage} {item.unitLabel} missing
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.emptyText}>Select an order to view details.</Text>
            )
          ) : details.length === 0 ? (
            <Text style={styles.emptyText}>
              Select ingredients above to build the import note.
            </Text>
          ) : (
            details.map((detail) => {
              const newTotal = detail.ingredient.currentQuantity + detail.importQuantity;
              const measurementLabel = resolveManualImportMeasurement(detail.ingredient);
              return (
                <View key={detail.ingredientId} style={styles.detailCard}>
                  <View style={styles.detailHeader}>
                    <Text style={styles.detailTitle}>{detail.ingredient.name}</Text>
                    <TouchableOpacity onPress={() => handleRemoveDetail(detail.ingredientId)}>
                      <Ionicons name="close" size={18} color={COLORS.muted} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.detailMeta}>
                    Current: {detail.ingredient.currentQuantity} {measurementLabel}
                  </Text>

                  <View style={styles.quantityRow}>
                    <Text style={styles.quantityLabel}>Import quantity</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        style={styles.stepperButton}
                        onPress={() => handleUpdateQuantity(detail.ingredientId, -1)}
                      >
                        <Ionicons name="remove" size={16} color={COLORS.ink} />
                      </TouchableOpacity>
                      <TextInput
                        value={
                          manualQuantityInputs[detail.ingredientId] ??
                          String(detail.importQuantity)
                        }
                        onChangeText={(value) => handleManualQuantityInput(detail.ingredientId, value)}
                        onBlur={() => handleManualQuantityBlur(detail.ingredientId)}
                        keyboardType="decimal-pad"
                        style={styles.stepperInput}
                        placeholder="0"
                        placeholderTextColor={COLORS.muted}
                      />
                      <TouchableOpacity
                        style={styles.stepperButton}
                        onPress={() => handleUpdateQuantity(detail.ingredientId, 1)}
                      >
                        <Ionicons name="add" size={16} color={COLORS.ink} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {manualQuantityErrors[detail.ingredientId] ? (
                    <Text style={styles.quantityError}>{manualQuantityErrors[detail.ingredientId]}</Text>
                  ) : null}

                  <Text style={styles.detailMeta}>New total: {newTotal} {measurementLabel}</Text>

                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Ionicons name="document-text" size={18} color="#FFFFFF" />
          <Text style={styles.submitText}>Submit Import Request</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={alertModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeAlertModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModalCard}>
            <View
              style={[
                styles.modalIconWrap,
                alertModal.tone === 'error' ? styles.modalIconError : styles.modalIconWarning,
              ]}
            >
              <Ionicons
                name={alertModal.tone === 'error' ? 'close-circle' : 'alert-circle'}
                size={24}
                color={alertModal.tone === 'error' ? '#B91C1C' : '#A16207'}
              />
            </View>
            <Text style={styles.modalTitle}>{alertModal.title}</Text>
            <Text style={styles.modalMessage}>{alertModal.message}</Text>
            <TouchableOpacity style={styles.modalSingleButton} onPress={closeAlertModal}>
              <Text style={styles.modalPrimaryText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={closeConfirmModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="document-text-outline" size={24} color={COLORS.accent} />
            </View>
            <Text style={styles.modalTitle}>Confirm import request</Text>
            <Text style={styles.modalMessage}>
              {submitDraft?.tab === 'order'
                ? `Submit import from order ${submitDraft.selectedOrder?.orderCode ?? ''} with ${
                    submitDraft.details.filter((detail) => detail.importQuantity > 0).length
                  } items?`
                : `Submit manual import with ${
                    submitDraft?.details.filter((detail) => detail.importQuantity > 0).length ?? 0
                  } items?`}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={closeConfirmModal}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={confirmSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.modalPrimaryText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
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
  headerIconSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 999,
  },
  tabButtonActive: {
    backgroundColor: COLORS.accent,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.ink,
    backgroundColor: COLORS.surface,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.muted,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orderInput: {
    flex: 1,
  },
  orderButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
  },
  orderButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  orderList: {
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  orderCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderCardActive: {
    borderColor: COLORS.accent,
    backgroundColor: '#FFF6EC',
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  orderCode: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 0.6,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusAwaiting: {
    backgroundColor: '#FFE9CC',
  },
  statusTransit: {
    backgroundColor: '#E3ECFF',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.ink,
  },
  orderSupplier: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 8,
  },
  orderMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderMetaText: {
    fontSize: 12,
    color: COLORS.muted,
  },
  orderSummaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFF6EC',
    padding: 14,
    marginBottom: 16,
  },
  orderSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  orderSummaryCode: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.ink,
  },
  orderSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#F0DED0',
  },
  orderSummaryLabel: {
    fontSize: 12,
    color: COLORS.muted,
  },
  orderSummaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  orderItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  orderItemsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
  },
  orderItemsCount: {
    fontSize: 12,
    color: COLORS.muted,
  },
  orderItemsList: {
    gap: 12,
  },
  orderItemCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 12,
  },
  orderItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  orderItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
    flex: 1,
    marginRight: 8,
  },
  orderQtyPill: {
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFE9CC',
    alignItems: 'center',
  },
  orderQtyText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.ink,
  },
  orderItemMeta: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 4,
  },
  orderShortage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#FFE4E4',
    marginTop: 6,
  },
  orderShortageText: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    marginBottom: 12,
  },
  searchInput: {
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
    color: COLORS.ink,
  },
  chipRow: {
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 10,
    backgroundColor: COLORS.surface,
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  ingredientList: {
    maxHeight: 360,
  },
  ingredientListScroll: {
    maxHeight: 360,
  },
  ingredientListContent: {
    gap: 12,
    paddingRight: 4,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  ingredientImageWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ingredientImage: {
    width: '100%',
    height: '100%',
  },
  ingredientInfo: {
    flex: 1,
    marginLeft: 12,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
  },
  ingredientMeta: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.muted,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  detailCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
  },
  detailMeta: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 10,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quantityLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ink,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: COLORS.card,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
  },
  stepperValue: {
    minWidth: 32,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
    marginHorizontal: 6,
  },
  stepperInput: {
    minWidth: 48,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
    marginHorizontal: 6,
    paddingVertical: 0,
  },
  quantityError: {
    fontSize: 12,
    color: '#B91C1C',
    marginBottom: 8,
  },
  readonlyValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
  },
  fieldLabel: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    paddingVertical: 14,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 22, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  alertModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    gap: 10,
  },
  modalIconWrap: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
  },
  modalIconWarning: {
    backgroundColor: '#FEF3C7',
  },
  modalIconError: {
    backgroundColor: '#FEE2E2',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalPrimaryButton: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  modalSingleButton: {
    marginTop: 4,
    width: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  modalPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modalSecondaryButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  modalSecondaryText: {
    color: COLORS.ink,
    fontSize: 13,
    fontWeight: '700',
  },
});
