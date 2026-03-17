import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CartItem = {
  productId: number;
  supplierId: number;
  supplierName?: string | null;
  name: string;
  category: string;
  image: string | null;
  measurement: string;
  // packageSize: khối lượng 1 túi (theo measurement), ví dụ 100 (g), 1 (kg)
  packageSize?: number | null;
  // Maximum quantity user can buy for this product (stock - holdStock)
  availableStock?: number | null;
  unitPrice: number;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

const CART_STORAGE_KEY = 'cartItems';

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const loadCart = async () => {
      try {
        const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (!raw) {
          setItems([]);
          return;
        }
        const parsed = JSON.parse(raw) as CartItem[];
        setItems(Array.isArray(parsed) ? parsed : []);
      } catch {
        setItems([]);
      }
    };

    loadCart();
  }, []);

  useEffect(() => {
    const persistCart = async () => {
      try {
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch {
        // Ignore persistence errors for now.
      }
    };

    persistCart();
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const limit =
        typeof item.availableStock === 'number' && Number.isFinite(item.availableStock)
          ? Math.max(0, Math.floor(item.availableStock))
          : null;

      if (limit === 0) {
        return prev;
      }

      const existing = prev.find((entry) => entry.productId === item.productId);
      if (!existing) {
        const safeQuantity =
          limit === null ? Math.max(1, item.quantity) : Math.max(1, Math.min(item.quantity, limit));
        return [...prev, { ...item, quantity: safeQuantity }];
      }

      const existingLimit =
        typeof existing.availableStock === 'number' && Number.isFinite(existing.availableStock)
          ? Math.max(0, Math.floor(existing.availableStock))
          : null;

      const effectiveLimit =
        limit === null
          ? existingLimit
          : existingLimit === null
            ? limit
            : Math.min(existingLimit, limit);

      return prev.map((entry) =>
        entry.productId === item.productId
          ? {
              ...entry,
              availableStock: effectiveLimit ?? entry.availableStock ?? item.availableStock ?? null,
              quantity:
                effectiveLimit === null
                  ? entry.quantity + item.quantity
                  : Math.min(entry.quantity + item.quantity, effectiveLimit),
            }
          : entry
      );
    });
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    setItems((prev) =>
      prev
        .map((entry) => {
          if (entry.productId !== productId) {
            return entry;
          }

          const limit =
            typeof entry.availableStock === 'number' && Number.isFinite(entry.availableStock)
              ? Math.max(0, Math.floor(entry.availableStock))
              : null;

          const clampedQuantity =
            limit === null
              ? Math.max(1, quantity)
              : Math.max(1, Math.min(quantity, limit));

          return { ...entry, quantity: clampedQuantity };
        })
        .filter((entry) => entry.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((productId: number) => {
    setItems((prev) => prev.filter((entry) => entry.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo(
    () => ({ items, addItem, updateQuantity, removeItem, clearCart }),
    [items, addItem, updateQuantity, removeItem, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};
