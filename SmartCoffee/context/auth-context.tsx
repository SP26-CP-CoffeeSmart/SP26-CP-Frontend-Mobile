import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfile, ProfileResponse } from '@/services/authService';

type AuthContextValue = {
  profile: ProfileResponse | null;
  coffeeShopId: number | null;
  role: string | null;
  loading: boolean;
  error: string | null;
  hasToken: boolean;
  checkingToken: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const COFFEE_SHOP_ID_KEY = 'coffeeShopId';

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getCoffeeShopId = (profile: ProfileResponse | null) => {
  if (!profile) return null;
  return (
    toNumber((profile as any).coffeeShopId) ??
    toNumber((profile as any).shopId) ??
    toNumber((profile as any).coffeeShopID) ??
    toNumber((profile as any).coffeeShop?.coffeeShopId) ??
    toNumber((profile as any).coffeeShop?.id)
  );
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [coffeeShopId, setCoffeeShopId] = useState<number | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  const checkToken = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const isPresent = Boolean(token && token.trim());
      setHasToken(isPresent);
      return isPresent;
    } catch {
      setHasToken(false);
      return false;
    } finally {
      setCheckingToken(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const tokenExists = await checkToken();
    if (!tokenExists) {
      setProfile(null);
      setRole(null);
      setCoffeeShopId(null);
      await AsyncStorage.removeItem(COFFEE_SHOP_ID_KEY);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setProfile(null);
    setRole(null);
    setCoffeeShopId(null);
    try {
      const data = await getProfile();
      setProfile(data);
      setRole(data.role ?? null);
      const shopId = getCoffeeShopId(data);
      setCoffeeShopId(shopId ?? null);
      if (shopId) {
        await AsyncStorage.setItem(COFFEE_SHOP_ID_KEY, String(shopId));
      }
    } catch (err) {
      setError('Unable to load profile.');
      await AsyncStorage.removeItem(COFFEE_SHOP_ID_KEY);
    } finally {
      setLoading(false);
    }
  }, [checkToken]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const value = useMemo(
    () => ({ profile, coffeeShopId, role, loading, error, hasToken, checkingToken, refreshProfile }),
    [profile, coffeeShopId, role, loading, error, hasToken, checkingToken, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
