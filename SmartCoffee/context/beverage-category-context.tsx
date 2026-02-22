import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { useAuth } from '@/context/auth-context';

export type BeverageCategory = {
  id?: number;
  beverageCategoryId?: number;
  name?: string;
  categoryName?: string;
};

type BeverageCategoryContextValue = {
  categories: BeverageCategory[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getCategoryId: (category: BeverageCategory) => number | null;
  getCategoryName: (category: BeverageCategory) => string;
};

const BeverageCategoryContext = createContext<BeverageCategoryContextValue | undefined>(undefined);

const getCategoryId = (category: BeverageCategory) =>
  typeof category.id === 'number'
    ? category.id
    : typeof category.beverageCategoryId === 'number'
      ? category.beverageCategoryId
      : null;

const getCategoryName = (category: BeverageCategory) =>
  String(category.name ?? category.categoryName ?? 'Unnamed category');

export const BeverageCategoryProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { coffeeShopId, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<BeverageCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!coffeeShopId) {
      setCategories([]);
      setError('Missing coffee shop id.');
      return;
    }

    try {
      setLoading(true);
      const response = await authorizedFetch(
        API_ENDPOINTS.beverageCategory.getByShop(coffeeShopId)
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Request failed (${response.status})${errorText ? `: ${errorText}` : ''}`
        );
      }

      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load beverage categories.';
      console.error('Error loading beverage categories:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authLoading, coffeeShopId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ categories, loading, error, refresh, getCategoryId, getCategoryName }),
    [categories, loading, error, refresh]
  );

  return (
    <BeverageCategoryContext.Provider value={value}>
      {children}
    </BeverageCategoryContext.Provider>
  );
};

export const useBeverageCategories = () => {
  const context = useContext(BeverageCategoryContext);
  if (!context) {
    throw new Error('useBeverageCategories must be used within BeverageCategoryProvider');
  }
  return context;
};
