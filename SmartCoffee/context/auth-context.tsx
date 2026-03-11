import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfile, ProfileResponse, authorizedFetch } from '@/services/authService';
import { API_ENDPOINTS } from '@/services/api';

type AuthContextValue = {
  profile: ProfileResponse | null;
  coffeeShopId: number | null;
  role: string | null;
  walletBalance: number;
  walletId: number | null;
  accountId: number | null;
  ownerId: number | null;
  shopName: string | null;

  // Location/Address properties
  address: string | null;
  provinceName: string | null;
  districtName: string | null;
  wardName: string | null;
  fullAddress: string | null;

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
  const [shopName, setShopName] = useState<string | null>(null);

  // Address
  const [address, setAddress] = useState<string | null>(null);
  const [provinceName, setProvinceName] = useState<string | null>(null);
  const [districtName, setDistrictName] = useState<string | null>(null);
  const [wardName, setWardName] = useState<string | null>(null);

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
      setShopName(null);

      setAddress(null);
      setProvinceName(null);
      setDistrictName(null);
      setWardName(null);

      await setOwnerId(null);
      await AsyncStorage.removeItem(COFFEE_SHOP_ID_KEY);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getProfile();
      setProfile(data);
      setRole(data.role ?? null);

      const shopId = getCoffeeShopId(data);
      setCoffeeShopId(shopId ?? null);

      const balanceValue = toNumber((data as any)?.wallet?.availableBalance) ??
        toNumber((data as any)?.wallet?.balance) ??
        toNumber((data as any)?.walletBalance) ?? 0;
      setWalletBalance(balanceValue);

      const walletIdValue = toNumber((data as any)?.wallet?.walletId);
      setWalletId(walletIdValue ?? null);

      const accountIdValue =
        toNumber((data as any)?.accountId) ??
        toNumber((data as any)?.userId) ??
        toNumber((data as any)?.id) ??
        toNumber((data as any)?.ownerId) ?? null;
      setAccountId(accountIdValue);

      // Extract shopName
      const shopNameValue =
        (data as any)?.shopName ??
        (data as any)?.coffeeShopName ??
        (data as any)?.storeName ??
        null;
      setShopName(shopNameValue ? String(shopNameValue) : null);

      if (shopId) {
        await AsyncStorage.setItem(COFFEE_SHOP_ID_KEY, String(shopId));
      }

      // Handle GHN address mapping
      const pAddress = (data as any)?.address || null;
      const pProv = toNumber((data as any)?.provinceId);
      const pDist = toNumber((data as any)?.districtId);
      const pWard = (data as any)?.wardCode ? String((data as any)?.wardCode) : null;

      setAddress(pAddress);

      if (pProv || pDist || pWard) {
        let finalProv = '', finalDist = '', finalWard = '';

        const provincePromise = pProv
          ? authorizedFetch(API_ENDPOINTS.ghn.provinces()).then(r => r.json()).catch(() => null)
          : Promise.resolve(null);

        const districtPromise = pDist && pProv
          ? authorizedFetch(API_ENDPOINTS.ghn.districts(pProv)).then(r => r.json()).catch(() => null)
          : Promise.resolve(null);

        const wardPromise = pWard && pDist
          ? authorizedFetch(API_ENDPOINTS.ghn.wards(pDist)).then(r => r.json()).catch(() => null)
          : Promise.resolve(null);

        const [provRes, distRes, wardRes] = await Promise.all([provincePromise, districtPromise, wardPromise]);

        if (provRes?.data && Array.isArray(provRes.data)) {
          const matched = provRes.data.find((p: any) => p.ProvinceID === pProv);
          if (matched) finalProv = matched.ProvinceName;
        }

        if (distRes?.data && Array.isArray(distRes.data)) {
          const matched = distRes.data.find((d: any) => d.DistrictID === pDist);
          if (matched) finalDist = matched.DistrictName;
        }

        if (wardRes?.data && Array.isArray(wardRes.data)) {
          const matched = wardRes.data.find((w: any) => String(w.WardCode) === pWard);
          if (matched) finalWard = matched.WardName;
        }

        setProvinceName(finalProv || null);
        setDistrictName(finalDist || null);
        setWardName(finalWard || null);
      } else {
        setProvinceName(null);
        setDistrictName(null);
        setWardName(null);
      }

    } catch (err) {
      setError('Unable to load profile.');
      // Cleanup on fail
      setProfile(null);
      setRole(null);
      setCoffeeShopId(null);
      setWalletBalance(0);
      setWalletId(null);
      setAccountId(null);
      setShopName(null);
      setAddress(null);
      setProvinceName(null);
      setDistrictName(null);
      setWardName(null);
      await AsyncStorage.removeItem(COFFEE_SHOP_ID_KEY);
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

  const fullAddress = useMemo(() => {
    let parts = [];
    if (address) parts.push(address);
    if (wardName) parts.push(wardName);
    if (districtName) parts.push(districtName);
    if (provinceName) parts.push(provinceName);
    return parts.length > 0 ? parts.join(', ') : null;
  }, [address, wardName, districtName, provinceName]);

  const value = useMemo(
    () => ({
      profile,
      coffeeShopId,
      role,
      walletBalance,
      walletId,
      accountId,
      ownerId,
      shopName,
      address,
      provinceName,
      districtName,
      wardName,
      fullAddress,
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
      shopName,
      address,
      provinceName,
      districtName,
      wardName,
      fullAddress,
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
