import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
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

type Ingredient = {
  ingredientId: number;
  name: string;
  image?: string | null;
  category: string;
  measurement: string;
  currentQuantity: number;
};

type ImportDetail = {
  ingredientId: number;
  ingredient: Ingredient;
  importQuantity: number;
  expirationDate: string;
  supplier: string;
};

type OrderItem = {
  id: number;
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
  supplier: string;
  status: string;
  orderDate: string;
  expectedDate: string;
  items: OrderItem[];
};

type OrderDetailResponse = {
  orderDetailId?: number;
  ingredientId?: number;
  ingredientName?: string;
  quantity?: number;
  price?: number;
};

type OrderResponse = {
  orderId?: number;
  status?: string;
  createAt?: string;
  expectedDeliveryTime?: string;
  supplierId?: number;
  ghnOrderCode?: string;
  orderDetails?: OrderDetailResponse[];
};

type PagedOrderResponse = {
  items?: OrderResponse[];
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

const mapOrderToSummary = (order: OrderResponse): OrderSummary => {
  const items = (order.orderDetails ?? []).map((detail, index) => {
    const orderedQty = Number(detail.quantity ?? 0);
    return {
      id: detail.orderDetailId ?? index,
      name: detail.ingredientName ?? 'Unknown item',
      category: 'Ingredient',
      orderedQty,
      receivedQty: orderedQty,
      unitLabel: 'units',
      price: Number(detail.price ?? 0),
    };
  });

  const orderId = order.orderId ?? 0;
  return {
    orderId,
    orderCode: order.ghnOrderCode ?? `ORD-${orderId || 'N/A'}`,
    supplier: order.supplierId ? `Supplier #${order.supplierId}` : 'Supplier',
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

export default function ImportRequestScreen() {
  const router = useRouter();
  const { coffeeShopId } = useAuth();
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

  const selectedItemCount = selectedOrder?.items.length ?? 0;

  const details = activeTab === 'manual' ? manualDetails : orderDetails;

  const filteredIngredients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return MOCK_INGREDIENTS.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesQuery = !query || item.name.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, selectedCategory]);

  const handleAddIngredient = (ingredient: Ingredient) => {
    setManualDetails((prev) => {
      const existing = prev.find((detail) => detail.ingredientId === ingredient.ingredientId);
      if (existing) {
        return prev.map((detail) =>
          detail.ingredientId === ingredient.ingredientId
            ? { ...detail, importQuantity: detail.importQuantity + 1 }
            : detail
        );
      }

      return [
        ...prev,
        {
          ingredientId: ingredient.ingredientId,
          ingredient,
          importQuantity: 1,
          expirationDate: '',
          supplier: '',
        },
      ];
    });
  };

  const handleUpdateQuantity = (ingredientId: number, delta: number) => {
    setManualDetails((prev) =>
      prev.map((detail) => {
        if (detail.ingredientId !== ingredientId) {
          return detail;
        }
        const nextQuantity = Math.max(detail.importQuantity + delta, 0);
        return { ...detail, importQuantity: nextQuantity };
      })
    );
  };

  const handleRemoveDetail = (ingredientId: number) => {
    setManualDetails((prev) => prev.filter((detail) => detail.ingredientId !== ingredientId));
  };

  const handleUpdateDetailField = (
    ingredientId: number,
    field: 'expirationDate' | 'supplier',
    value: string
  ) => {
    setManualDetails((prev) =>
      prev.map((detail) =>
        detail.ingredientId === ingredientId ? { ...detail, [field]: value } : detail
      )
    );
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
        expirationDate: '',
        supplier: 'Auto from order',
      },
      {
        ingredientId: MOCK_INGREDIENTS[1].ingredientId,
        ingredient: MOCK_INGREDIENTS[1],
        importQuantity: 6,
        expirationDate: '',
        supplier: 'Auto from order',
      },
    ];

    setOrderDetails(mockDetails);
    setOrderLoaded(true);
    if (!noteTitle.trim()) {
      setNoteTitle(`Import from order #${orderId.trim()}`);
    }
    Alert.alert('Order loaded', 'Mock import details were generated from the order.');
  };

  const handleSelectOrder = (order: OrderSummary) => {
    setSelectedOrder(order);
    setOrderId(String(order.orderId));
    const mappedDetails: ImportDetail[] = order.items.map((item) => {
      const ingredient = MOCK_INGREDIENTS.find((mock) => mock.name === item.name) ?? {
        ingredientId: item.id,
        name: item.name,
        image: null,
        category: item.category,
        measurement: item.unitLabel,
        currentQuantity: 0,
      };

      return {
        ingredientId: ingredient.ingredientId,
        ingredient,
        importQuantity: item.receivedQty,
        expirationDate: '',
        supplier: order.supplier,
      };
    });

    setOrderDetails(mappedDetails);
    setOrderLoaded(true);
    if (!noteTitle.trim()) {
      setNoteTitle(`Import from order #${order.orderCode}`);
    }
  };

  const loadOrders = useCallback(async () => {
    if (!coffeeShopId) {
      setOrders([]);
      return;
    }

    try {
      setOrderLoading(true);
      setOrderError(null);
      const url = `${API_ENDPOINTS.order.byOwner(coffeeShopId)}?page=1&pageSize=20&orderStatus=Delivered`;
      const response = await authorizedFetch(url, {
        headers: {
          Accept: '*/*',
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = (await response.json()) as OrderResponse[] | PagedOrderResponse;
      const list = Array.isArray(data) ? data : data.items ?? [];
      const mapped = list.map(mapOrderToSummary);
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
  }, [coffeeShopId, selectedOrder]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'order') {
        loadOrders();
      }
    }, [activeTab, loadOrders])
  );

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

  const handleSubmit = () => {
    if (activeTab === 'order' && !orderLoaded) {
      Alert.alert('Load order first', 'Please load an order before submitting.');
      return;
    }
    if (!details.length) {
      Alert.alert('Missing items', 'Please add at least one ingredient.');
      return;
    }

    const modeLabel = activeTab === 'order' ? 'from order' : 'manual';
    Alert.alert('Import request submitted', `This is a mock ${modeLabel} request for now.`);
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
            <Text style={styles.sectionLabel}>Delivered orders</Text>
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
              {CATEGORY_OPTIONS.map((category) => {
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
                    <Text style={styles.ingredientMeta}>
                      {ingredient.category} - {ingredient.currentQuantity} {ingredient.measurement}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={22} color={COLORS.accent} />
                </TouchableOpacity>
              ))}
              {!filteredIngredients.length ? (
                <Text style={styles.emptyText}>No ingredients found for this filter.</Text>
              ) : null}
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
                        ${item.price.toFixed(2)}/unit
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
              return (
                <View key={detail.ingredientId} style={styles.detailCard}>
                  <View style={styles.detailHeader}>
                    <Text style={styles.detailTitle}>{detail.ingredient.name}</Text>
                    <TouchableOpacity onPress={() => handleRemoveDetail(detail.ingredientId)}>
                      <Ionicons name="close" size={18} color={COLORS.muted} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.detailMeta}>
                    Current: {detail.ingredient.currentQuantity} {detail.ingredient.measurement}
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
                      <Text style={styles.stepperValue}>{detail.importQuantity}</Text>
                      <TouchableOpacity
                        style={styles.stepperButton}
                        onPress={() => handleUpdateQuantity(detail.ingredientId, 1)}
                      >
                        <Ionicons name="add" size={16} color={COLORS.ink} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.detailMeta}>New total: {newTotal} {detail.ingredient.measurement}</Text>

                  <Text style={styles.fieldLabel}>Expiry date</Text>
                  <TextInput
                    value={detail.expirationDate}
                    onChangeText={(value) =>
                      handleUpdateDetailField(detail.ingredientId, 'expirationDate', value)
                    }
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor={COLORS.muted}
                    style={styles.input}
                  />

                  <Text style={styles.fieldLabel}>Supplier</Text>
                  <TextInput
                    value={detail.supplier}
                    onChangeText={(value) =>
                      handleUpdateDetailField(detail.ingredientId, 'supplier', value)
                    }
                    placeholder="Highland Roasters Co."
                    placeholderTextColor={COLORS.muted}
                    style={styles.input}
                  />
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Ionicons name="document-text" size={18} color="#FFFFFF" />
          <Text style={styles.submitText}>Submit Import Request</Text>
        </TouchableOpacity>
      </View>
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
    gap: 12,
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
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
