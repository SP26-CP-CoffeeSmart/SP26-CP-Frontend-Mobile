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
  walletBalance: number;
  walletId: number | null;
  accountId: number | null;
  ownerId: number | null;
  setOwnerId: (ownerId: number | null) => Promise<void>;
  loading: boolean;
  error: string | null;
  hasToken: boolean;
  checkingToken: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const COFFEE_SHOP_ID_KEY = 'coffeeShopId';
const OWNER_ID_KEY = 'ownerId';

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
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletId, setWalletId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [ownerId, setOwnerIdState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  const setOwnerId = useCallback(async (nextOwnerId: number | null) => {
    setOwnerIdState(nextOwnerId);
    try {
      if (nextOwnerId === null) {
        await AsyncStorage.removeItem(OWNER_ID_KEY);
      } else {
        await AsyncStorage.setItem(OWNER_ID_KEY, String(nextOwnerId));
      }
    } catch {
      // Ignore persistence errors.
    }
  }, []);

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
      setWalletBalance(0);
      setWalletId(null);
      setAccountId(null);
      await setOwnerId(null);
      await AsyncStorage.removeItem(COFFEE_SHOP_ID_KEY);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setProfile(null);
    setRole(null);
    setCoffeeShopId(null);
    setWalletBalance(0);
    setWalletId(null);
    setAccountId(null);
    try {
      const data = await getProfile();
      setProfile(data);
      setRole(data.role ?? null);
      const shopId = getCoffeeShopId(data);
      setCoffeeShopId(shopId ?? null);
      const balanceValue = toNumber((data as any)?.wallet?.availableBalance) ??
        toNumber((data as any)?.wallet?.balance) ??
        toNumber((data as any)?.walletBalance) ??
        0;
      setWalletBalance(balanceValue ?? 0);
      const walletIdValue = toNumber((data as any)?.wallet?.walletId);
      setWalletId(walletIdValue ?? null);
      const accountIdValue =
        toNumber((data as any)?.accountId) ??
        toNumber((data as any)?.userId) ??
        toNumber((data as any)?.id) ??
        toNumber((data as any)?.ownerId) ??
        null;
      setAccountId(accountIdValue);
      if (shopId) {
        await AsyncStorage.setItem(COFFEE_SHOP_ID_KEY, String(shopId));
      }
    } catch (err) {
      setError('Unable to load profile.');
      await AsyncStorage.removeItem(COFFEE_SHOP_ID_KEY);
      setWalletBalance(0);
      setWalletId(null);
      setAccountId(null);
      await setOwnerId(null);
    } finally {
      setLoading(false);
    }
  }, [checkToken]);

  useEffect(() => {
    const loadOwnerId = async () => {
      try {
        const stored = await AsyncStorage.getItem(OWNER_ID_KEY);
        const parsed = toNumber(stored);
        if (parsed !== null) {
          setOwnerIdState(parsed);
        }
      } catch {
        // Ignore load errors.
      }
    };

    loadOwnerId();
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const value = useMemo(
    () => ({
      profile,
      coffeeShopId,
      role,
      walletBalance,
      walletId,
      accountId,
      ownerId,
      setOwnerId,
      loading,
      error,
      hasToken,
      checkingToken,
      refreshProfile,
    }),
    [
      profile,
      coffeeShopId,
      role,
      walletBalance,
      walletId,
      accountId,
      ownerId,
      setOwnerId,
      loading,
      error,
      hasToken,
      checkingToken,
      refreshProfile,
    ]
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
