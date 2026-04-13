import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch, updateCoffeeShop } from '@/services/authService';
import { useAuth } from '@/context/auth-context';

const COLORS = {
  bg: '#F7F3EF',
  text: '#3C2A21',
  muted: '#8E7B6F',
  border: '#B08B61',
  accent: '#5B3216',
  accentSoft: '#EFE6DE',
  white: '#FFFFFF',
  shadow: 'rgba(0,0,0,0.08)',
};

const BACKGROUND_IMAGE = require('../assets/background.png');
const ONBOARDING_COMPLETE_KEY = 'onboarding:complete';
const SUBSCRIPTION_SKIP_ONCE_KEY = 'subscription:skip-once';
const EDGE_NAV_WIDTH = 44;
const ONBOARDING_CARD_HEIGHT = 700;

type SubscriptionPackage = {
  subscriptionPackageId?: number;
  packageId?: number;
  id?: number;
  name?: string;
  tier?: string;
  price?: number | string;
  amount?: number | string;
  cost?: number | string;
  monthlyPrice?: number | string;
  annualPrice?: number | string;
  pricePerMonth?: number | string;
  duration?: number | string;
  durationMonths?: number | string;
  durationDays?: number | string;
  billingCycle?: string;
  cycle?: string;
  description?: string;
  summary?: string;
  subtitle?: string;
  detail?: string;
  features?: string[] | string;
  featureList?: string[] | string;
  benefits?: string[] | string;
  details?: string[] | string;
  staffQuantity?: number;
  menuSuggestLimit?: number;
  recipeRecommendLimit?: number;
  productRecommendLimit?: number;
  menuAnalyzeFeedbackLimit?: number;
  inventoryForecastLimit?: number;
};

type ProvinceItem = {
  ProvinceID: number;
  ProvinceName: string;
};

type DistrictItem = {
  DistrictID: number;
  DistrictName: string;
};

type WardItem = {
  WardCode: string;
  WardName: string;
};

const getPackageId = (item: SubscriptionPackage) =>
  item.subscriptionPackageId ?? item.packageId ?? item.id ?? null;

const getPackagePrice = (value: SubscriptionPackage) => {
  const raw =
    value?.price ??
    value?.amount ??
    value?.cost ??
    value?.monthlyPrice ??
    value?.annualPrice ??
    value?.pricePerMonth;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatPrice = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numeric)) {
    return `${numeric.toLocaleString()} VND`;
  }
  return String(value);
};

const getPackageDuration = (value: SubscriptionPackage) => {
  const duration =
    value?.duration ??
    value?.durationMonths ??
    value?.durationDays ??
    value?.billingCycle ??
    value?.cycle;
  if (!duration) return '';
  if (typeof duration === 'number') {
    return duration > 1 ? `${duration} months` : `${duration} month`;
  }
  return String(duration);
};

const getPackageDescription = (value: SubscriptionPackage) => {
  const description = value?.description ?? value?.summary ?? value?.subtitle ?? value?.detail;
  return description ? String(description) : '';
};

const getPackageFeatures = (value: SubscriptionPackage) => {
  const defaultFeatures: string[] = [];

  if (value.staffQuantity !== undefined) {
    defaultFeatures.push(`Staff Accounts: ${value.staffQuantity}`);
  }
  if (value.menuSuggestLimit !== undefined) {
    defaultFeatures.push(`Menu Suggestions Limit: ${value.menuSuggestLimit}`);
  }
  if (value.recipeRecommendLimit !== undefined) {
    defaultFeatures.push(`Recipe Recommendations Limit: ${value.recipeRecommendLimit}`);
  }
  if (value.productRecommendLimit !== undefined) {
    defaultFeatures.push(`Product Recommendations Limit: ${value.productRecommendLimit}`);
  }
  if (value.menuAnalyzeFeedbackLimit !== undefined) {
    defaultFeatures.push(`Menu Feedback Analysis Limit: ${value.menuAnalyzeFeedbackLimit}`);
  }
  if (value.inventoryForecastLimit !== undefined) {
    defaultFeatures.push(`Inventory Forecasts Limit: ${value.inventoryForecastLimit}`);
  }

  const raw = value?.features ?? value?.featureList ?? value?.benefits ?? value?.details;
  if (Array.isArray(raw)) {
    return [...defaultFeatures, ...raw.map((item) => String(item)).filter(Boolean)];
  }
  if (typeof raw === 'string') {
    const parsed = raw
      .split(/\n|;|\r|\r\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    return [...defaultFeatures, ...parsed];
  }
  return defaultFeatures;
};

const isTrialPackage = (item: SubscriptionPackage) => {
  const name = String(item.name ?? item.tier ?? '').toLowerCase();
  if (name.includes('trial')) return true;
  const numeric = typeof item.price === 'number' ? item.price : Number(item.price);
  return Number.isFinite(numeric) && numeric <= 0;
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const { coffeeShopId, shopName, refreshProfile, accountId } = useAuth();
  const isLoginPromoEntry = source === 'login';
  const [activeTab, setActiveTab] = useState(0);
  const [shopNameInput, setShopNameInput] = useState(shopName ?? '');
  const [savingShopName, setSavingShopName] = useState(false);
  const [shopNameError, setShopNameError] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState('');
  const [provinceSearch, setProvinceSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [wardSearch, setWardSearch] = useState('');
  const [provinces, setProvinces] = useState<ProvinceItem[]>([]);
  const [districts, setDistricts] = useState<DistrictItem[]>([]);
  const [wards, setWards] = useState<WardItem[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<ProvinceItem | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictItem | null>(null);
  const [selectedWard, setSelectedWard] = useState<WardItem | null>(null);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [subscribeSubmitting, setSubscribeSubmitting] = useState(false);
  const [payosUrl, setPayosUrl] = useState<string | null>(null);
  const [showPayosModal, setShowPayosModal] = useState(false);
  const [subscriptionActivated, setSubscriptionActivated] = useState(false);
  const [provinceFocused, setProvinceFocused] = useState(false);
  const [districtFocused, setDistrictFocused] = useState(false);
  const [wardFocused, setWardFocused] = useState(false);
  const successTriggeredRef = useRef(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (isLoginPromoEntry) {
        setActiveTab(2);
        // Promo screen after login should not block user from continuing to menu.
        setSubscriptionActivated(true);
        return;
      }

      try {
        const stored = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        if (stored === 'true') {
          if (!coffeeShopId) {
            return;
          }
          try {
            const response = await authorizedFetch(API_ENDPOINTS.subscription.byShop(coffeeShopId), {
              headers: { Accept: '*/*' },
            });
            if (!response.ok) {
              throw new Error(`Request failed (${response.status})`);
            }
            const payload = await response.json();
            const active = Array.isArray(payload)
              ? payload.length > 0
              : Boolean(payload?.data ?? payload?.items ?? payload?.result);
            if (active) {
              router.replace('/(tabs)/menu');
            } else {
              await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
              setActiveTab(2);
            }
          } catch {
            await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
            setActiveTab(2);
          }
        }
      } catch {
        // Ignore storage errors.
      }
    };

    checkOnboarding();
  }, [coffeeShopId, isLoginPromoEntry, router]);

  const loadPackages = useCallback(async () => {
    try {
      setPackagesLoading(true);
      setPackagesError(null);
      const listUrl = API_ENDPOINTS.subscriptionPackage.list();
      console.log('[SubscriptionPackage] GET', listUrl);
      const response = await authorizedFetch(listUrl, {
        headers: { Accept: '*/*' },
      });
      console.log('[SubscriptionPackage] status', response.status);
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const payload = await response.json();
      console.log('[SubscriptionPackage] payload', payload);
      const items: SubscriptionPackage[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.data?.items)
              ? payload.data.items
              : Array.isArray(payload?.result)
                ? payload.result
                : [];
      const sorted = [...items].sort(
        (a, b) => Number(isTrialPackage(b)) - Number(isTrialPackage(a))
      );
      setPackages(sorted);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load packages.';
      setPackagesError(message);
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 2 && packages.length === 0 && !packagesLoading) {
      loadPackages();
    }
  }, [activeTab, loadPackages, packages.length, packagesLoading]);

  const loadProvinces = useCallback(async () => {
    try {
      setLoadingProvinces(true);
      const response = await authorizedFetch(API_ENDPOINTS.ghn.provinces(), {
        headers: { Accept: '*/*' },
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const payload = await response.json();
      const list: ProvinceItem[] = Array.isArray(payload)
        ? payload
        : payload?.data ?? [];
      setProvinces(list);
    } catch {
      Toast.show({ type: 'error', text1: 'Unable to load provinces' });
    } finally {
      setLoadingProvinces(false);
    }
  }, []);

  const loadDistricts = useCallback(async (provinceId: number) => {
    try {
      setLoadingDistricts(true);
      const response = await authorizedFetch(API_ENDPOINTS.ghn.districts(provinceId), {
        headers: { Accept: '*/*' },
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const payload = await response.json();
      const list: DistrictItem[] = Array.isArray(payload)
        ? payload
        : payload?.data ?? [];
      setDistricts(list);
    } catch {
      Toast.show({ type: 'error', text1: 'Unable to load districts' });
    } finally {
      setLoadingDistricts(false);
    }
  }, []);

  const loadWards = useCallback(async (districtId: number) => {
    try {
      setLoadingWards(true);
      const response = await authorizedFetch(API_ENDPOINTS.ghn.wards(districtId), {
        headers: { Accept: '*/*' },
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const payload = await response.json();
      const list: WardItem[] = Array.isArray(payload)
        ? payload
        : payload?.data ?? [];
      setWards(list);
    } catch {
      Toast.show({ type: 'error', text1: 'Unable to load wards' });
    } finally {
      setLoadingWards(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 1 && provinces.length === 0 && !loadingProvinces) {
      loadProvinces();
    }
  }, [activeTab, loadProvinces, loadingProvinces, provinces.length]);

  const goNext = useCallback(() => {
    setActiveTab((prev) => Math.min(prev + 1, 2));
  }, []);

  const goPrev = useCallback(() => {
    setActiveTab((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSaveShopName = useCallback(async () => {
    const trimmedName = shopNameInput.trim();
    const trimmedAddress = addressInput.trim();
    if (!trimmedName) {
      Toast.show({ type: 'error', text1: 'Missing shop name', text2: 'Please enter your shop name.' });
      return;
    }

    if (trimmedName.length > 15) {
      Toast.show({ type: 'error', text1: 'Name too long', text2: 'Maximum 15 characters.' });
      return;
    }

    if (!coffeeShopId) {
      Toast.show({ type: 'error', text1: 'Missing shop', text2: 'Coffee shop ID not found.' });
      return;
    }

    if (!trimmedAddress) {
      Toast.show({ type: 'error', text1: 'Missing address', text2: 'Please enter shop address.' });
      return;
    }

    if (!selectedProvince || !selectedDistrict || !selectedWard) {
      Toast.show({ type: 'error', text1: 'Missing location', text2: 'Please select province, district, and ward.' });
      return;
    }

    try {
      setSavingShopName(true);
      await updateCoffeeShop(coffeeShopId, trimmedName, {
        address: trimmedAddress,
        provinceId: selectedProvince.ProvinceID,
        districtId: selectedDistrict.DistrictID,
        wardCode: selectedWard.WardCode,
      });
      Toast.show({ type: 'success', text1: 'Information updated successfully' });
      try {
        await refreshProfile();
      } catch {
        // Ignore refresh failures; keep success feedback.
      }
      goNext();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed.';
      Toast.show({ type: 'error', text1: 'Update failed', text2: message });
    } finally {
      setSavingShopName(false);
    }
  }, [addressInput, coffeeShopId, goNext, refreshProfile, selectedDistrict, selectedProvince, selectedWard, shopNameInput]);

  const handleFinish = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      await AsyncStorage.setItem(SUBSCRIPTION_SKIP_ONCE_KEY, 'true');
    } catch {
      // Ignore storage errors.
    }
    router.replace('/(tabs)/menu');
  }, [router]);

  const handleSubscribePackage = useCallback(
    async (item: SubscriptionPackage) => {
      if (subscribeSubmitting) return;

      const isTrial = isTrialPackage(item);
      const packageId = getPackageId(item);

      try {
        setSubscribeSubmitting(true);

        if (isTrial) {
          if (!accountId) {
            throw new Error('Missing account id.');
          }
          const trialUrl = `${API_ENDPOINTS.subscription.trial()}?ownerId=${accountId}`;
          console.log('[Trial] POST', trialUrl);
          const response = await authorizedFetch(trialUrl, {
            method: 'POST',
            headers: {
              Accept: '*/*',
            },
          });

          if (!response.ok) {
            const errorBody = await response.text();
            console.log('[Trial] response status:', response.status);
            console.log('[Trial] response body:', errorBody);
            throw new Error(`Request failed: ${response.status}`);
          }

          Toast.show({ type: 'success', text1: 'Trial activated' });
          setSubscriptionActivated(true);
          return;
        }

        if (!packageId) {
          throw new Error('Missing package id.');
        }

        const response = await authorizedFetch(API_ENDPOINTS.subscription.subscribe(packageId, true), {
          method: 'POST',
          headers: {
            Accept: '*/*',
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = await response.json();
        const checkoutUrl = String(data?.checkoutUrl ?? data?.url ?? '').trim();
        if (!checkoutUrl) {
          throw new Error('Missing checkout url');
        }

        successTriggeredRef.current = false;
        setPayosUrl(checkoutUrl);
        setShowPayosModal(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to subscribe.';
        Toast.show({ type: 'error', text1: 'Subscription failed', text2: message });
      } finally {
        setSubscribeSubmitting(false);
      }
    },
    [accountId, subscribeSubmitting]
  );

  const handlePayosShouldStart = useCallback((event: { url?: string }) => {
    const rawUrl = String(event?.url ?? '');
    const url = rawUrl.toLowerCase();

    if (!url) {
      return true;
    }

    const isCancelRoute = url.includes('cancel=true') || url.includes('status=cancelled');
    const isPaidStatus = url.includes('status=paid');

    if (isCancelRoute) {
      setShowPayosModal(false);
      setPayosUrl(null);
      successTriggeredRef.current = false;
      return false;
    }

    if (isPaidStatus) {
      if (!successTriggeredRef.current) {
        successTriggeredRef.current = true;
        Toast.show({ type: 'success', text1: 'Subscription activated' });
            setSubscriptionActivated(true);
        setShowPayosModal(false);
        setPayosUrl(null);
      }
      return false;
    }

    return true;
  }, []);

  const tabTitle = useMemo(() => {
    if (activeTab === 0) return 'Welcome';
    if (activeTab === 1) return 'Your Shop';
    return 'Subscription';
  }, [activeTab]);

  const sortedPackages = useMemo(() => {
    return [...packages].sort(
      (a, b) => Number(isTrialPackage(b)) - Number(isTrialPackage(a))
    );
  }, [packages]);

  const showProvinceList = activeTab === 1 && provinceFocused;
  const showDistrictList = activeTab === 1 && Boolean(selectedProvince) && districtFocused;
  const showWardList = activeTab === 1 && Boolean(selectedDistrict) && wardFocused;

  const filteredProvinces = useMemo(() => {
    const query = provinceSearch.trim().toLowerCase();
    if (!query) return provinces;
    return provinces.filter((item) =>
      item.ProvinceName.toLowerCase().includes(query)
    );
  }, [provinceSearch, provinces]);

  const filteredDistricts = useMemo(() => {
    const query = districtSearch.trim().toLowerCase();
    if (!query) return districts;
    return districts.filter((item) =>
      item.DistrictName.toLowerCase().includes(query)
    );
  }, [districtSearch, districts]);

  const filteredWards = useMemo(() => {
    const query = wardSearch.trim().toLowerCase();
    if (!query) return wards;
    return wards.filter((item) =>
      item.WardName.toLowerCase().includes(query)
    );
  }, [wardSearch, wards]);

  const handleSelectProvince = useCallback(
    (item: ProvinceItem) => {
      setSelectedProvince(item);
      setProvinceSearch(item.ProvinceName);
      setSelectedDistrict(null);
      setSelectedWard(null);
      setDistrictSearch('');
      setWardSearch('');
      setDistricts([]);
      setWards([]);
      setProvinceFocused(false);
      loadDistricts(item.ProvinceID);
    },
    [loadDistricts]
  );

  const handleSelectDistrict = useCallback(
    (item: DistrictItem) => {
      setSelectedDistrict(item);
      setDistrictSearch(item.DistrictName);
      setSelectedWard(null);
      setWardSearch('');
      setWards([]);
      setDistrictFocused(false);
      loadWards(item.DistrictID);
    },
    [loadWards]
  );

  const handleSelectWard = useCallback((item: WardItem) => {
    setSelectedWard(item);
    setWardSearch(item.WardName);
    setWardFocused(false);
  }, []);

  const primaryButtonLabel =
    activeTab === 0 ? 'Next' : activeTab === 1 ? 'Save & Next' : 'Continue';

  const primaryButtonDisabled =
    activeTab === 1
      ? savingShopName || Boolean(shopNameError)
      : activeTab === 2
        ? !subscriptionActivated && !isLoginPromoEntry
        : false;

  const handlePrimaryAction = () => {
    if (activeTab === 0) {
      goNext();
      return;
    }
    if (activeTab === 1) {
      handleSaveShopName();
      return;
    }
    handleFinish();
  };

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} imageStyle={styles.backgroundImage}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.heroBlock}>
              <Image source={BACKGROUND_IMAGE} style={styles.heroImage} resizeMode="contain" />
              <Text style={styles.title}>SmartCoffee</Text>
              <Text style={styles.subtitle}>{tabTitle}</Text>
            </View>

            <View style={styles.tabHeader}>
              {[0, 1, 2].map((index) => (
                <Pressable
                  key={`tab-${index}`}
                  style={[styles.tabChip, activeTab === index && styles.tabChipActive]}
                  onPress={() => setActiveTab(index)}
                >
                  <Text style={[styles.tabChipText, activeTab === index && styles.tabChipTextActive]}>
                    {index + 1}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.contentArea}>
              {activeTab === 0 ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>Explore the new SmartCoffee</Text>
                  <Text style={styles.sectionText}>
                    Build your menu, track inventory, and accept orders faster with SmartCoffee.
                  </Text>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>What you can do</Text>
                    <Text style={styles.infoText}>- Create menu versions in minutes</Text>
                    <Text style={styles.infoText}>- Manage beverages and recipes</Text>
                    <Text style={styles.infoText}>- Monitor sales and stock</Text>
                  </View>
                </View>
              ) : null}

              {activeTab === 1 ? (
                <View style={styles.sectionShell}>
                  <ScrollView
                    style={styles.sectionScroll}
                    contentContainerStyle={styles.sectionScrollContent}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    <Text style={styles.sectionTitle}>Name your coffee shop</Text>
                    <Text style={styles.sectionText}>
                      This name will appear on your menu and profile.
                    </Text>
                    <Text style={styles.label}>Shop name</Text>
                    <TextInput
                      value={shopNameInput}
                      onChangeText={(value) => {
                        if (value.length > 15) {
                          setShopNameError('Maximum 15 characters.');
                          return;
                        }
                        setShopNameError(null);
                        setShopNameInput(value);
                      }}
                      placeholder="Enter your shop name"
                      placeholderTextColor={COLORS.muted}
                      style={styles.input}
                      autoCapitalize="words"
                    />
                    {shopNameError ? (
                      <Text style={styles.errorText}>{shopNameError}</Text>
                    ) : null}

                    <Text style={styles.label}>Province</Text>
                    <TextInput
                      value={provinceSearch}
                      onChangeText={(value) => {
                        setProvinceSearch(value);
                        setSelectedProvince(null);
                        setSelectedDistrict(null);
                        setSelectedWard(null);
                        setDistrictSearch('');
                        setWardSearch('');
                        setDistricts([]);
                        setWards([]);
                      }}
                      onFocus={() => setProvinceFocused(true)}
                      onBlur={() => setProvinceFocused(false)}
                      placeholder="Search province"
                      placeholderTextColor={COLORS.muted}
                      style={styles.input}
                    />
                    {loadingProvinces ? (
                      <ActivityIndicator size="small" color={COLORS.accent} />
                    ) : showProvinceList ? (
                      <View style={styles.dropdownList}>
                        {filteredProvinces.length === 0 ? (
                          <Text style={styles.dropdownEmpty}>No provinces found.</Text>
                        ) : (
                          <ScrollView nestedScrollEnabled>
                            {filteredProvinces.map((item) => (
                              <Pressable
                                key={String(item.ProvinceID)}
                                style={styles.dropdownItem}
                                onPress={() => handleSelectProvince(item)}
                              >
                                <Text style={styles.dropdownItemText}>{item.ProvinceName}</Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    ) : null}

                    {selectedProvince ? (
                      <>
                        <Text style={styles.label}>District</Text>
                        <TextInput
                          value={districtSearch}
                          onChangeText={(value) => {
                            setDistrictSearch(value);
                            setSelectedDistrict(null);
                            setSelectedWard(null);
                            setWardSearch('');
                            setWards([]);
                          }}
                          onFocus={() => setDistrictFocused(true)}
                          onBlur={() => setDistrictFocused(false)}
                          placeholder="Search district"
                          placeholderTextColor={COLORS.muted}
                          style={styles.input}
                        />
                        {loadingDistricts ? (
                          <ActivityIndicator size="small" color={COLORS.accent} />
                        ) : showDistrictList ? (
                          <View style={styles.dropdownList}>
                            {filteredDistricts.length === 0 ? (
                              <Text style={styles.dropdownEmpty}>No districts found.</Text>
                            ) : (
                              <ScrollView nestedScrollEnabled>
                                {filteredDistricts.map((item) => (
                                  <Pressable
                                    key={String(item.DistrictID)}
                                    style={styles.dropdownItem}
                                    onPress={() => handleSelectDistrict(item)}
                                  >
                                    <Text style={styles.dropdownItemText}>{item.DistrictName}</Text>
                                  </Pressable>
                                ))}
                              </ScrollView>
                            )}
                          </View>
                        ) : null}
                      </>
                    ) : null}

                    {selectedDistrict ? (
                      <>
                        <Text style={styles.label}>Ward</Text>
                        <TextInput
                          value={wardSearch}
                          onChangeText={(value) => {
                            setWardSearch(value);
                            setSelectedWard(null);
                          }}
                          onFocus={() => setWardFocused(true)}
                          onBlur={() => setWardFocused(false)}
                          placeholder="Search ward"
                          placeholderTextColor={COLORS.muted}
                          style={styles.input}
                        />
                        {loadingWards ? (
                          <ActivityIndicator size="small" color={COLORS.accent} />
                        ) : showWardList ? (
                          <View style={styles.dropdownList}>
                            {filteredWards.length === 0 ? (
                              <Text style={styles.dropdownEmpty}>No wards found.</Text>
                            ) : (
                              <ScrollView nestedScrollEnabled>
                                {filteredWards.map((item) => (
                                  <Pressable
                                    key={String(item.WardCode)}
                                    style={styles.dropdownItem}
                                    onPress={() => handleSelectWard(item)}
                                  >
                                    <Text style={styles.dropdownItemText}>{item.WardName}</Text>
                                  </Pressable>
                                ))}
                              </ScrollView>
                            )}
                          </View>
                        ) : null}
                      </>
                    ) : null}

                    {selectedWard ? (
                      <>
                        <Text style={styles.label}>Address</Text>
                        <TextInput
                          value={addressInput}
                          onChangeText={setAddressInput}
                          placeholder="House number, street name"
                          placeholderTextColor={COLORS.muted}
                          style={styles.input}
                        />
                      </>
                    ) : null}
                    <View style={styles.sectionSpacer} />
                  </ScrollView>
                </View>
              ) : null}

              {activeTab === 2 ? (
                <View style={styles.sectionBlockFill}>
                  <Text style={styles.sectionTitle}>Choose your subscription</Text>
                  <Text style={styles.sectionText}>
                    Pick a plan that fits your shop size and features.
                  </Text>
                  {packagesLoading ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                  ) : packagesError ? (
                    <Text style={styles.errorText}>{packagesError}</Text>
                  ) : sortedPackages.length === 0 ? (
                    <Text style={styles.emptyText}>No subscription packages available.</Text>
                  ) : (
                    <ScrollView
                      style={styles.packageList}
                      contentContainerStyle={styles.packageListContent}
                      showsVerticalScrollIndicator={false}
                    >
                      {sortedPackages.map((item) => {
                        const price = formatPrice(getPackagePrice(item) ?? item.price);
                        const isTrial = isTrialPackage(item);
                        const isTrialActivated = isTrial && subscriptionActivated;
                        const description = getPackageDescription(item);
                        const descriptionLines = description
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean);
                        const features = getPackageFeatures(item);
                        const durationText = getPackageDuration(item);
                        return (
                          <View key={String(getPackageId(item) ?? item.name)} style={styles.packageCard}>
                            <View style={styles.packageHeaderRow}>
                              <View>
                                <Text style={styles.packageName}>{item.name ?? 'Subscription'}</Text>
                                {item.tier ? (
                                  <Text style={styles.packageTier}>{item.tier}</Text>
                                ) : null}
                              </View>
                              <View style={[styles.packageBadge, isTrial ? styles.packageBadgeTrial : null]}>
                                <Text style={[styles.packageBadgeText, isTrial ? styles.packageBadgeTextTrial : null]}>
                                  {isTrial ? 'Trial' : 'Plan'}
                                </Text>
                              </View>
                            </View>

                            {price ? (
                              <Text style={styles.packagePrice}>{price}</Text>
                            ) : null}
                            {descriptionLines.length > 0 ? (
                              <View style={styles.packageDescList}>
                                {descriptionLines.map((line, index) => (
                                  <Text key={`${getPackageId(item) ?? item.name}-line-${index}`} style={styles.packageDesc}>
                                    - {line}
                                  </Text>
                                ))}
                              </View>
                            ) : null}
                            {features.length > 0 ? (
                              <View style={styles.packageFeatureList}>
                                {features.map((feature, index) => (
                                  <Text key={`${getPackageId(item) ?? item.name}-feature-${index}`} style={styles.packageFeatureText}>
                                    • {feature}
                                  </Text>
                                ))}
                              </View>
                            ) : null}
                            {durationText ? (
                              <View style={styles.packageMetaBadge}>
                                <Text style={styles.packageMeta}>Duration: {durationText}</Text>
                              </View>
                            ) : null}
                            <Pressable
                              style={[
                                styles.packageAction,
                                isTrialActivated && styles.packageActionDisabled,
                              ]}
                              onPress={() => handleSubscribePackage(item)}
                              disabled={subscribeSubmitting || isTrialActivated}
                            >
                              <Text
                                style={[
                                  styles.packageActionText,
                                  isTrialActivated && styles.packageActionTextDisabled,
                                ]}
                              >
                                {isTrialActivated
                                  ? 'Activated'
                                  : subscribeSubmitting
                                  ? 'Processing...'
                                  : isTrial
                                    ? 'Start Trial'
                                    : 'Subscribe'}
                              </Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}

                </View>
              ) : null}
            </View>

            {activeTab === 0 ? (
              <View style={styles.singleFooter}>
                <Pressable style={styles.primaryButtonSingle} onPress={goNext}>
                  <Text style={styles.primaryButtonText}>Next</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.commonFooter}>
                <Pressable style={styles.secondaryButton} onPress={goPrev}>
                  <Text style={styles.secondaryButtonText}>Back</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, primaryButtonDisabled && styles.primaryButtonDisabled]}
                  onPress={handlePrimaryAction}
                  disabled={primaryButtonDisabled}
                >
                  {activeTab === 1 && savingShopName ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>{primaryButtonLabel}</Text>
                  )}
                </Pressable>
              </View>
            )}

          </View>

          <View style={styles.subscriptionHintSlot}>
            {activeTab === 2 && !subscriptionActivated ? (
              <Text style={styles.subscriptionHintOutside}>
                Please subscribe or start a trial to continue.
              </Text>
            ) : null}
          </View>
        </View>

        <Modal
          visible={showPayosModal}
          animationType="slide"
          onRequestClose={() => {
            setShowPayosModal(false);
            setPayosUrl(null);
          }}
        >
          <SafeAreaView style={styles.payosContainer}>
            <View style={styles.payosHeader}>
              <Text style={styles.payosTitle}>PayOS Checkout</Text>
              <Pressable
                style={styles.payosClose}
                onPress={() => {
                  setShowPayosModal(false);
                  setPayosUrl(null);
                }}
              >
                <Text style={styles.payosTitle}>X</Text>
              </Pressable>
            </View>
            {payosUrl ? (
              <WebView
                source={{ uri: payosUrl }}
                style={styles.payosWebview}
                onShouldStartLoadWithRequest={handlePayosShouldStart}
              />
            ) : null}
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  backgroundImage: {
    opacity: 0.18,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    position: 'relative',
    height: ONBOARDING_CARD_HEIGHT,
    minHeight: ONBOARDING_CARD_HEIGHT,
    maxHeight: ONBOARDING_CARD_HEIGHT,
  },
  heroBlock: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  heroImage: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 18,
  },
  tabChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  tabChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
  },
  tabChipText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  tabChipTextActive: {
    color: COLORS.white,
  },
  contentArea: {
    flex: 1,
    minHeight: 0,
  },
  sectionBlock: {
    flex: 1,
    gap: 14,
  },
  sectionBlockFill: {
    flex: 1,
    gap: 14,
  },
  sectionScroll: {
    flex: 1,
  },
  sectionScrollContent: {
    gap: 14,
    paddingBottom: 12,
  },
  sectionShell: {
    flex: 1,
    minHeight: 0,
  },
  commonFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  singleFooter: {
    paddingTop: 8,
    alignItems: 'center',
  },
  sectionSpacer: {
    height: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  sectionText: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
  },
  infoCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.accentSoft,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.text,
    marginBottom: 4,
  },
  input: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    backgroundColor: COLORS.white,
    color: COLORS.text,
  },
  dropdownList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingVertical: 4,
    maxHeight: 140,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dropdownItemText: {
    fontSize: 12,
    color: COLORS.text,
  },
  dropdownEmpty: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    paddingVertical: 8,
  },
  primaryButton: {
    width: '48.5%',
    height: 52,
    backgroundColor: COLORS.accent,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonSingle: {
    width: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '48.5%',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  packageList: {
    flex: 1,
    minHeight: 160,
  },
  packageListContent: {
    gap: 12,
    paddingBottom: 8,
  },
  packageCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(91,50,22,0.3)',
    backgroundColor: '#FFFCF8',
    shadowColor: 'rgba(91,50,22,0.2)',
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  packageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  packageTier: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 4,
  },
  packageBadge: {
    borderRadius: 12,
    backgroundColor: '#EFE6DE',
    borderWidth: 1,
    borderColor: '#E2D4C5',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  packageBadgeTrial: {
    backgroundColor: '#E8F6EC',
    borderColor: '#B9E5C5',
  },
  packageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6F4A32',
  },
  packageBadgeTextTrial: {
    color: '#2F7D4A',
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.accent,
    marginTop: 10,
  },
  packageDescList: {
    marginTop: 10,
    gap: 4,
  },
  packageDesc: {
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 18,
  },
  packageFeatureList: {
    marginTop: 8,
    gap: 4,
    maxHeight: 150,
  },
  packageFeatureText: {
    fontSize: 11,
    color: '#6A4A31',
    lineHeight: 17,
  },
  packageMetaBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#F6F1EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  packageMeta: {
    fontSize: 11,
    color: COLORS.muted,
  },
  packageAction: {
    marginTop: 12,
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: 'center',
  },
  packageActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
  packageActionDisabled: {
    backgroundColor: '#C6C6C6',
  },
  packageActionTextDisabled: {
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 12,
    color: '#B22222',
    textAlign: 'center',
  },
  subscriptionHint: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  subscriptionHintOutside: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
  },
  subscriptionHintSlot: {
    minHeight: 26,
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  edgeNav: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  edgeLeft: {
    width: '50%',
  },
  edgeRight: {
    width: '50%',
  },
  payosContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  payosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E0DA',
  },
  payosTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  payosClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payosWebview: {
    flex: 1,
  },
});
