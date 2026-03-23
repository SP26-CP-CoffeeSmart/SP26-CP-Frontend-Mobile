import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
import { useRouter } from 'expo-router';
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

type SubscriptionPackage = {
  subscriptionPackageId?: number;
  id?: number;
  name?: string;
  tier?: string;
  price?: number | string;
  duration?: number | string;
  description?: string;
};

const getPackageId = (item: SubscriptionPackage) =>
  item.subscriptionPackageId ?? item.id ?? null;

const formatPrice = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numeric)) {
    return `${numeric.toLocaleString()} VND`;
  }
  return String(value);
};

const isTrialPackage = (item: SubscriptionPackage) => {
  const name = String(item.name ?? item.tier ?? '').toLowerCase();
  if (name.includes('trial')) return true;
  const numeric = typeof item.price === 'number' ? item.price : Number(item.price);
  return Number.isFinite(numeric) && numeric <= 0;
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { coffeeShopId, shopName, refreshProfile, accountId } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [shopNameInput, setShopNameInput] = useState(shopName ?? '');
  const [savingShopName, setSavingShopName] = useState(false);
  const [shopNameError, setShopNameError] = useState<string | null>(null);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [subscribeSubmitting, setSubscribeSubmitting] = useState(false);
  const [payosUrl, setPayosUrl] = useState<string | null>(null);
  const [showPayosModal, setShowPayosModal] = useState(false);
  const [subscriptionActivated, setSubscriptionActivated] = useState(false);
  const successTriggeredRef = useRef(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const stored = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        if (stored === 'true') {
          router.replace('/(tabs)/menu');
        }
      } catch {
        // Ignore storage errors.
      }
    };

    checkOnboarding();
  }, [router]);

  const loadPackages = useCallback(async () => {
    try {
      setPackagesLoading(true);
      setPackagesError(null);
      const response = await authorizedFetch(API_ENDPOINTS.subscriptionPackage.list(), {
        headers: { Accept: '*/*' },
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const payload = await response.json();
      const items: SubscriptionPackage[] = Array.isArray(payload)
        ? payload
        : payload?.items ?? payload?.data ?? [];
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

  const goNext = useCallback(() => {
    setActiveTab((prev) => Math.min(prev + 1, 2));
  }, []);

  const goPrev = useCallback(() => {
    setActiveTab((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSaveShopName = useCallback(async () => {
    const trimmedName = shopNameInput.trim();
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

    try {
      setSavingShopName(true);
      await updateCoffeeShop(coffeeShopId, trimmedName);
      Toast.show({ type: 'success', text1: 'Shop name updated' });
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
  }, [coffeeShopId, goNext, refreshProfile, shopNameInput]);

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

  const screenWidth = Dimensions.get('window').width;

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
                  <Pressable style={styles.nextBar} onPress={goNext}>
                    <Text style={styles.nextBarText}>Next</Text>
                  </Pressable>
                </View>
              ) : null}

              {activeTab === 1 ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>Name your coffee shop</Text>
                  <Text style={styles.sectionText}>
                    This name will appear on your menu and profile.
                  </Text>
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
                  <View style={styles.buttonRow}>
                    <Pressable style={styles.secondaryButton} onPress={goPrev}>
                      <Text style={styles.secondaryButtonText}>Back</Text>
                    </Pressable>
                    <Pressable
                      style={styles.primaryButton}
                      onPress={handleSaveShopName}
                      disabled={savingShopName || Boolean(shopNameError)}
                    >
                      {savingShopName ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <Text style={styles.primaryButtonText}>Save & Next</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {activeTab === 2 ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>Choose your subscription</Text>
                  <Text style={styles.sectionText}>
                    Pick a plan that fits your shop size and features.
                  </Text>
                  {packagesLoading ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                  ) : packagesError ? (
                    <Text style={styles.errorText}>{packagesError}</Text>
                  ) : (
                    <ScrollView
                      style={styles.packageList}
                      contentContainerStyle={styles.packageListContent}
                      showsVerticalScrollIndicator={false}
                    >
                      {sortedPackages.map((item) => {
                        const price = formatPrice(item.price);
                        const isTrial = isTrialPackage(item);
                        return (
                          <View key={String(getPackageId(item) ?? item.name)} style={styles.packageCard}>
                            <Text style={styles.packageName}>{item.name ?? 'Subscription'}</Text>
                            {item.tier ? (
                              <Text style={styles.packageTier}>{item.tier}</Text>
                            ) : null}
                            {price ? (
                              <Text style={styles.packagePrice}>{price}</Text>
                            ) : null}
                            {item.description ? (
                              <Text style={styles.packageDesc}>{item.description}</Text>
                            ) : null}
                            {item.duration ? (
                              <Text style={styles.packageMeta}>Duration: {item.duration}</Text>
                            ) : null}
                            <Pressable
                              style={styles.packageAction}
                              onPress={() => handleSubscribePackage(item)}
                              disabled={subscribeSubmitting}
                            >
                              <Text style={styles.packageActionText}>
                                {subscribeSubmitting
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

                  <View style={styles.buttonRow}>
                    <Pressable style={styles.secondaryButton} onPress={goPrev}>
                      <Text style={styles.secondaryButtonText}>Back</Text>
                    </Pressable>
                    <Pressable
                      style={styles.primaryButton}
                      onPress={handleFinish}
                      disabled={!subscriptionActivated}
                    >
                      <Text style={styles.primaryButtonText}>Continue</Text>
                    </Pressable>
                  </View>
                  {!subscriptionActivated ? (
                    <Text style={styles.subscriptionHint}>
                      Please subscribe or start a trial to continue.
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

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
    minHeight: 560,
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
    height: 320,
  },
  sectionBlock: {
    flex: 1,
    gap: 14,
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  nextBar: {
    width: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  nextBarText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
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
  },
  packageListContent: {
    gap: 12,
    paddingBottom: 8,
  },
  packageCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(91,50,22,0.15)',
    backgroundColor: COLORS.white,
  },
  packageName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  packageTier: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 4,
  },
  packagePrice: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
    marginTop: 6,
  },
  packageDesc: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 6,
  },
  packageMeta: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 6,
  },
  packageAction: {
    marginTop: 10,
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    paddingVertical: 10,
    alignItems: 'center',
  },
  packageActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
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
