import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import beverageSizeService, { BeverageSize } from '@/services/beverageSizeService';
import { authorizedFetch, logoutAccount } from '@/services/authService';
import { API_ENDPOINTS } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { WebView } from 'react-native-webview';

const purchaseStatuses = [
  { label: 'Pending confirmation', icon: 'wallet-outline' },
  { label: 'Awaiting pickup', icon: 'cube-outline' },
  { label: 'Awaiting delivery', icon: 'car-outline' },
  { label: 'Delivered', icon: 'checkmark-done-outline' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const {
    profile,
    coffeeShopId: profileCoffeeShopId,
    walletBalance,
    loading: profileLoading,
    error: profileError,
    refreshProfile,
    fullAddress,
  } = useAuth();
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);
  const [beverageSizes, setBeverageSizes] = useState<BeverageSize[]>([]);
  const [beverageSizesLoading, setBeverageSizesLoading] = useState(true);
  const [beverageSizesError, setBeverageSizesError] = useState<string | null>(null);
  const [showAddSizeModal, setShowAddSizeModal] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeVolume, setNewSizeVolume] = useState('');
  const [addSizeError, setAddSizeError] = useState<string | null>(null);
  const [addSizeSubmitting, setAddSizeSubmitting] = useState(false);
  const [editingSizeId, setEditingSizeId] = useState<number | null>(null);
  const [editingSize, setEditingSize] = useState<BeverageSize | null>(null);
  const [editSizeName, setEditSizeName] = useState('');
  const [editSizeVolume, setEditSizeVolume] = useState('');
  const [editSizeActive, setEditSizeActive] = useState(true);
  const [editSizeError, setEditSizeError] = useState<string | null>(null);
  const [editSizeSubmitting, setEditSizeSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTopup, setSelectedTopup] = useState<number | null>(null);
  const [customTopup, setCustomTopup] = useState('');
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [payosUrl, setPayosUrl] = useState<string | null>(null);
  const [showPayosModal, setShowPayosModal] = useState(false);
  const [lastTopupAmount, setLastTopupAmount] = useState<number | null>(null);
  const [successSubmitting, setSuccessSubmitting] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTriggeredRef = useRef(false);

  const getSizeName = (size: BeverageSize, index: number) =>
    String(size.name ?? size.sizeName ?? size.title ?? `Size ${index + 1}`);

  const getProfileField = (value: unknown, fallback: string) => {
    if (value === null || value === undefined) {
      return fallback;
    }

    if (typeof value === 'string') {
      return value.trim() || fallback;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return fallback;
  };

  const getNumericId = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  };

  const profileName = getProfileField(
    profile?.fullName ?? profile?.name ?? profile?.userName ?? profile?.username,
    'Unknown user'
  );
  const profileRole = getProfileField(profile?.role ?? profile?.position ?? profile?.title, '');
  const profileEmail = getProfileField(profile?.email ?? profile?.mail, '-');
  const profilePhone = getProfileField(
    profile?.phoneNumber ?? profile?.phone ?? profile?.mobile,
    '-'
  );
  const profileShop = getProfileField(
    profile?.shopName ?? profile?.coffeeShopName ?? profile?.storeName,
    '-'
  );
  const getProfileImageUrl = (value: unknown) => {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    return trimmed;
  };
  const profileImageUrl = getProfileImageUrl(
    profile?.imageUrl ??
    (profile as any)?.avatarUrl ??
    (profile as any)?.avatar ??
    (profile as any)?.photoUrl ??
    (profile as any)?.profileImage ??
    (profile as any)?.image
  );
  const profileShopDisplay = profileLoading ? 'Loading...' : profileShop;
  const profileNameDisplay = profileLoading ? 'Loading...' : profileName;
  const profileRoleDisplay = profileLoading
    ? 'Loading profile...'
    : profileError
      ? profileError
      : profileRole;
  const profileEmailDisplay = profileLoading ? 'Loading...' : profileEmail;
  const profilePhoneDisplay = profileLoading ? 'Loading...' : profilePhone;
  const profileHeaderName = profileShopDisplay;
  const formattedBalance = walletBalance.toLocaleString('vi-VN');

  useEffect(() => {
    let isActive = true;

    const loadBeverageSizes = async () => {
      if (profileLoading) {
        return;
      }

      if (!profileCoffeeShopId) {
        if (isActive) {
          setBeverageSizes([]);
          setBeverageSizesError('You have not added any sizes for your shop yet.');
          setBeverageSizesLoading(false);
        }
        return;
      }

      try {
        if (isActive) {
          setBeverageSizesLoading(true);
        }
        const data = await beverageSizeService.getByShop(profileCoffeeShopId);
        if (isActive) {
          setBeverageSizes(data);
          setBeverageSizesError(null);
        }
      } catch (error) {
        if (isActive) {
          setBeverageSizesError('Unable to load beverage sizes.');
        }
      } finally {
        if (isActive) {
          setBeverageSizesLoading(false);
        }
      }
    };

    loadBeverageSizes();

    return () => {
      isActive = false;
    };
  }, [profileCoffeeShopId, profileLoading]);

  const getSizeId = (size: BeverageSize) =>
    typeof size.id === 'number'
      ? size.id
      : typeof size.beverageSizeId === 'number'
        ? size.beverageSizeId
        : null;

  const getSizeVolume = (size: BeverageSize) => {
    const raw = size.volume ?? size.capacity ?? size.size ?? size.ml;
    if (raw === null || raw === undefined) {
      return 'Volume: N/A';
    }

    if (typeof raw === 'number') {
      return `Volume: ${raw}ml`;
    }

    const text = String(raw).trim();
    if (text.toLowerCase().startsWith('volume')) {
      return text;
    }

    if (/\d/.test(text) && !/ml/i.test(text)) {
      return `Volume: ${text}ml`;
    }

    return `Volume: ${text}`;
  };

  const getSizeVolumeValue = (size: BeverageSize) => {
    const raw = size.volume ?? size.capacity ?? size.size ?? size.ml;
    if (raw === null || raw === undefined) {
      return '';
    }

    if (typeof raw === 'number') {
      return String(raw);
    }

    const match = String(raw).match(/\d+(?:\.\d+)?/);
    return match ? match[0] : String(raw);
  };

  const getCoffeeShopId = (size: BeverageSize) => {
    const direct = size.coffeeShopId ?? (size as any).shopId ?? (size as any).coffeeShopID;
    const nested = (size as any).coffeeShop?.coffeeShopId;
    return getNumericId(direct ?? nested);
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };

  const getSizeStatus = (size: BeverageSize) => {
    const statusText = size.status ?? (size.isActive ?? size.active);
    if (typeof statusText === 'boolean') {
      return statusText ? 'Active' : 'Inactive';
    }

    return statusText ? String(statusText) : 'Unknown';
  };

  const isSizeActive = (size: BeverageSize) => {
    const statusBool = size.isActive ?? size.active;
    if (typeof statusBool === 'boolean') {
      return statusBool;
    }

    return String(size.status ?? '').toLowerCase() === 'active';
  };

  const openAddSizeModal = () => {
    setNewSizeName('');
    setNewSizeVolume('');
    setAddSizeError(null);
    setShowAddSizeModal(true);
  };

  const handleLogout = async () => {
    if (logoutSubmitting) {
      return;
    }

    try {
      setLogoutSubmitting(true);
      await logoutAccount();
      // Refresh profile to clear auth state and trigger navigation to login
      await refreshProfile();
      router.replace('/sign-in');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed.';
      showToast(message);
    } finally {
      setLogoutSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) {
      return;
    }

    try {
      setRefreshing(true);
      await refreshProfile();
    } finally {
      setRefreshing(false);
    }
  };

  const topupPresets = [100000, 500000, 1000000, 5000000];

  const handleSelectTopup = (amount: number) => {
    if (selectedTopup === amount) {
      setSelectedTopup(null);
      return;
    }
    setSelectedTopup(amount);
    setCustomTopup('');
  };

  const handleTopup = () => {
    const runTopup = async () => {
      if (topupSubmitting) {
        return;
      }

      const customValue = Number(customTopup.replace(/[^0-9]/g, ''));
      const amount = selectedTopup ?? (Number.isFinite(customValue) ? customValue : 0);
      if (!amount || amount <= 0) {
        showToast('Please select or enter a top-up amount.');
        return;
      }

      try {
        setTopupSubmitting(true);
        const response = await authorizedFetch(API_ENDPOINTS.wallet.topUp(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount,
            isMobile: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = await response.json();
        const checkoutUrl = String(data?.checkoutUrl ?? '').trim();
        if (!checkoutUrl) {
          throw new Error('Missing checkout url');
        }

        setLastTopupAmount(amount);
        successTriggeredRef.current = false;
        setPayosUrl(checkoutUrl);
        setShowPayosModal(true);
      } catch (error) {
        showToast('Unable to create top-up checkout.');
      } finally {
        setTopupSubmitting(false);
      }
    };

    runTopup();
  };

  const handleTopupSuccess = async () => {
    if (successSubmitting) {
      return;
    }

    if (!lastTopupAmount) {
      showToast('Missing top-up data. Please try again.');
      return;
    }

    try {
      setSuccessSubmitting(true);
      await refreshProfile();
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      closeTimerRef.current = setTimeout(() => {
        setShowPayosModal(false);
        setPayosUrl(null);
        setLastTopupAmount(null);
        closeTimerRef.current = null;
      }, 3000);
    } catch (error) {
      showToast('Payment appears successful, but failed to refresh wallet data. Please pull to refresh.');
    } finally {
      setSuccessSubmitting(false);
    }
  };

  const handlePayosShouldStart = (event: { url?: string }) => {
    const rawUrl = String(event?.url ?? '');
    const url = rawUrl.toLowerCase();
    console.log('[PayOS] Navigated to URL:', rawUrl);

    if (!url) {
      return true;
    }

    const isCancelRoute =
      url.includes('cancel=true') || url.includes('status=cancelled');
    const isPaidStatus = url.includes('status=paid');

    // Ưu tiên xử lý cancel, tránh gọi success nhầm
    if (isCancelRoute) {
      console.log('[PayOS] Cancel detected, closing modal.');
      setShowPayosModal(false);
      setPayosUrl(null);
      setLastTopupAmount(null);
      successTriggeredRef.current = false;
      return false;
    }

    if (isPaidStatus) {
      if (!successTriggeredRef.current) {
        successTriggeredRef.current = true;
        handleTopupSuccess();
      }
      return false;
    }

    return true;
  };

  const handleCreateSize = async () => {
    if (addSizeSubmitting) {
      return;
    }

    const trimmedName = newSizeName.trim();
    const parsedVolume = Number(newSizeVolume);

    if (!trimmedName) {
      setAddSizeError('Please enter a size name.');
      return;
    }

    if (!Number.isFinite(parsedVolume) || parsedVolume <= 0) {
      setAddSizeError('Please enter a valid volume.');
      return;
    }

    if (!profileCoffeeShopId) {
      setAddSizeError('Missing coffee shop id.');
      return;
    }

    try {
      setAddSizeSubmitting(true);
      const created = await beverageSizeService.create({
        beverageSizeId: 0,
        coffeeShopId: profileCoffeeShopId,
        sizeName: trimmedName,
        volume: parsedVolume,
        isActive: false,
      });
      setBeverageSizes((prev) => [created, ...prev]);
      setShowAddSizeModal(false);
      setNewSizeName('');
      setNewSizeVolume('');
      setAddSizeError(null);
    } catch (error) {
      setAddSizeError('Unable to add beverage size.');
    } finally {
      setAddSizeSubmitting(false);
    }
  };

  const startEditSize = (size: BeverageSize, index: number) => {
    const sizeId = getSizeId(size);
    if (sizeId === null) {
      setEditSizeError('Missing size id.');
      return;
    }

    setEditingSizeId(sizeId);
    setEditingSize(size);
    setEditSizeName(getSizeName(size, index));
    setEditSizeVolume(getSizeVolumeValue(size));
    setEditSizeActive(isSizeActive(size));
    setEditSizeError(null);
  };

  const cancelEditSize = () => {
    setEditingSizeId(null);
    setEditingSize(null);
    setEditSizeError(null);
    setEditSizeSubmitting(false);
  };

  const handleUpdateSize = async () => {
    if (editingSizeId === null || editSizeSubmitting) {
      return;
    }

    if (!editingSize) {
      setEditSizeError('Missing size data.');
      return;
    }

    const trimmedName = editSizeName.trim();
    const parsedVolume = Number(editSizeVolume);
    const coffeeShopId = getCoffeeShopId(editingSize) ?? profileCoffeeShopId;

    if (!trimmedName) {
      setEditSizeError('Please enter a size name.');
      return;
    }

    if (!Number.isFinite(parsedVolume) || parsedVolume <= 0) {
      setEditSizeError('Please enter a valid volume.');
      return;
    }

    if (!coffeeShopId) {
      setEditSizeError('Missing coffee shop id.');
      return;
    }

    try {
      setEditSizeSubmitting(true);
      const updated = await beverageSizeService.update(editingSizeId, {
        beverageSizeId: editingSizeId,
        sizeName: trimmedName,
        volume: parsedVolume,
        isActive: editSizeActive,
        coffeeShop: {
          coffeeShopId,
        },
      });

      setBeverageSizes((prev) =>
        prev.map((size) => {
          const sizeId = getSizeId(size);
          if (sizeId !== editingSizeId) {
            return size;
          }
          return {
            ...size,
            ...updated,
            sizeName: updated.sizeName ?? trimmedName,
            volume: updated.volume ?? parsedVolume,
            isActive: updated.isActive ?? editSizeActive,
          };
        })
      );
      setEditingSizeId(null);
      setEditingSize(null);
      setEditSizeError(null);
      showToast('Updated beverage size successfully.');
    } catch (error) {
      setEditSizeError('Unable to update beverage size.');
    } finally {
      setEditSizeSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              {profileImageUrl ? (
                <Image source={{ uri: profileImageUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person-outline" size={36} color="#5C4634" />
              )}
            </View>
            <View style={styles.avatarBadge}>
              <Ionicons name="pencil" size={12} color="#5C4634" />
            </View>
          </View>
          <Text style={styles.name}>{profileHeaderName}</Text>
          {profileRoleDisplay ? <Text style={styles.role}>{profileRoleDisplay}</Text> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardRowBetween}>
            <View style={styles.cardRow}>
              <Ionicons name="briefcase" size={16} color="#8B5E3C" />
              <Text style={styles.cardTitle}>Current Subscription: Premium Plan</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusChip}>
              <Ionicons name="checkmark-circle" size={14} color="#1F7A1F" />
              <Text style={styles.statusText}>Active</Text>
            </View>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.outlineButton} activeOpacity={0.8}>
              <Text style={styles.outlineButtonText}>Renew</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fillButton} activeOpacity={0.8}>
              <Text style={styles.fillButtonText}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account information</Text>
          <View style={styles.infoRow}>
            <Ionicons name="call" size={16} color="#8B5E3C" />
            <Text style={styles.infoLabel}>Phone number:</Text>
            <Text style={styles.infoValue}>{profilePhoneDisplay}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail" size={16} color="#8B5E3C" />
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{profileEmailDisplay}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="storefront" size={16} color="#8B5E3C" />
            <Text style={styles.infoLabel}>Shop name:</Text>
            <Text style={styles.infoValue}>{profileShopDisplay}</Text>
          </View>
          <View style={styles.infoRowAddress}>
            <View style={styles.infoRowAddressTop}>
              <Ionicons name="location" size={16} color="#8B5E3C" />
              <Text style={styles.infoLabel}>Address:</Text>
            </View>
            <Text style={styles.infoAddressValue}>{fullAddress || '-'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardRowBetween}>
            <View style={styles.cardRow}>
              <Ionicons name="wallet" size={16} color="#8B5E3C" />
              <Text style={styles.cardTitle}>Wallet balance</Text>
            </View>
            <Text style={styles.walletBalance}>{formattedBalance} vnd</Text>
          </View>

          <Text style={styles.walletHint}>Choose an amount to top up</Text>
          <View style={styles.walletOptions}>
            {topupPresets.map((amount) => {
              const isActive = amount === selectedTopup;
              return (
                <TouchableOpacity
                  key={amount}
                  style={[styles.walletChip, isActive && styles.walletChipActive]}
                  activeOpacity={0.8}
                  onPress={() => handleSelectTopup(amount)}
                >
                  <Text style={[styles.walletChipText, isActive && styles.walletChipTextActive]}>
                    {amount.toLocaleString('vi-VN')} vnd
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.walletHint}>Or enter a custom amount</Text>
          <TextInput
            value={customTopup}
            onChangeText={(value) => {
              setCustomTopup(value);
              if (selectedTopup) {
                setSelectedTopup(null);
              }
            }}
            placeholder="e.g. 250000"
            keyboardType="numeric"
            style={styles.walletInput}
          />
          <TouchableOpacity
            style={[styles.walletButton, topupSubmitting && styles.walletButtonDisabled]}
            onPress={handleTopup}
            disabled={topupSubmitting}
          >
            <Text style={styles.walletButtonText}>
              {topupSubmitting ? 'Processing...' : 'Top up wallet'}
            </Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={showPayosModal}
          animationType="slide"
          onRequestClose={() => setShowPayosModal(false)}
        >
          <SafeAreaView style={styles.payosContainer} edges={['top']}>
            <View style={styles.payosHeader}>
              <Text style={styles.payosTitle}>PayOS Checkout</Text>
              <TouchableOpacity
                style={styles.payosCloseButton}
                onPress={() => {
                  setShowPayosModal(false);
                  if (closeTimerRef.current) {
                    clearTimeout(closeTimerRef.current);
                    closeTimerRef.current = null;
                  }
                }}
              >
                <Ionicons name="close" size={18} color="#5C4634" />
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
                <Text style={styles.payosFallbackText}>Missing checkout url.</Text>
              </View>
            )}
          </SafeAreaView>
        </Modal>

        <View style={styles.beverageCard}>
          <View style={styles.beverageHeader}>
            <Text style={styles.beverageTitle}>Beverage Size Setup</Text>
            <Text style={styles.manageHint}>Hold 1s to edit</Text>
          </View>
          <View style={styles.beverageList}>
            {beverageSizesLoading ? (
              <Text style={styles.beverageFeedback}>Loading beverage sizes...</Text>
            ) : beverageSizesError ? (
              <Text style={styles.beverageFeedback}>{beverageSizesError}</Text>
            ) : beverageSizes.length === 0 ? (
              <Text style={styles.beverageFeedback}>
                You have not added any sizes for your shop yet.
              </Text>
            ) : (
              beverageSizes.map((size, index) => {
                const active = isSizeActive(size);
                const sizeId = getSizeId(size);
                const isEditing = sizeId !== null && sizeId === editingSizeId;

                return (
                  <TouchableOpacity
                    key={`${getSizeName(size, index)}-${index}`}
                    style={[styles.sizeItem, isEditing && styles.sizeItemEditing]}
                    activeOpacity={0.9}
                    onLongPress={() => startEditSize(size, index)}
                    delayLongPress={1000}
                  >
                    {isEditing ? (
                      <View style={styles.sizeEditContent}>
                        <View style={styles.sizeEditHeader}>
                          <Text style={styles.sizeEditTitle}>Edit size</Text>
                        </View>
                        <TextInput
                          style={styles.sizeEditInput}
                          value={editSizeName}
                          onChangeText={setEditSizeName}
                          placeholder="Size name"
                        />
                        <View style={styles.sizeEditVolumeRow}>
                          <TextInput
                            style={[styles.sizeEditInput, styles.sizeEditVolumeInput]}
                            value={editSizeVolume}
                            onChangeText={setEditSizeVolume}
                            placeholder="Volume"
                            keyboardType="numeric"
                          />
                          <Text style={styles.sizeEditVolumeSuffix}>ml</Text>
                        </View>
                        <View style={styles.sizeEditToggleRow}>
                          <Text style={styles.sizeEditToggleLabel}>Active</Text>
                          <Switch
                            value={editSizeActive}
                            onValueChange={setEditSizeActive}
                            trackColor={{ false: '#E1D6CB', true: '#7CBF8A' }}
                            thumbColor="#FFFFFF"
                          />
                        </View>
                        {editSizeError ? (
                          <Text style={styles.sizeEditError}>{editSizeError}</Text>
                        ) : null}
                        <View style={styles.sizeEditActions}>
                          <TouchableOpacity
                            style={styles.sizeEditCancel}
                            onPress={cancelEditSize}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.sizeEditCancelText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.sizeEditSave,
                              editSizeSubmitting && styles.sizeEditSaveDisabled,
                            ]}
                            onPress={handleUpdateSize}
                            activeOpacity={0.85}
                            disabled={editSizeSubmitting}
                          >
                            <Text style={styles.sizeEditSaveText}>
                              {editSizeSubmitting ? 'Saving...' : 'Save'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <>
                        <View style={styles.sizeLeft}>
                          <View style={styles.sizeIconWrap}>
                            <Ionicons name="cafe-outline" size={18} color="#8B5E3C" />
                          </View>
                          <View>
                            <Text style={styles.sizeName}>{getSizeName(size, index)}</Text>
                            <Text style={styles.sizeVolume}>{getSizeVolume(size)}</Text>
                          </View>
                        </View>
                        <View
                          style={[
                            styles.sizeStatus,
                            active ? styles.sizeStatusActive : styles.sizeStatusInactive,
                          ]}
                        >
                          <Text
                            style={
                              active ? styles.sizeStatusTextActive : styles.sizeStatusTextInactive
                            }
                          >
                            {getSizeStatus(size)}
                          </Text>
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
          <TouchableOpacity
            style={styles.addSizeButton}
            activeOpacity={0.8}
            onPress={openAddSizeModal}>
            <Ionicons name="add" size={16} color="#D38B2A" />
            <Text style={styles.addSizeText}>Add New Size</Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={showAddSizeModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddSizeModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Beverage Size</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowAddSizeModal(false)}>
                  <Ionicons name="close" size={18} color="#8B5E3C" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Size name</Text>
                <TextInput
                  value={newSizeName}
                  onChangeText={setNewSizeName}
                  placeholder="e.g. VeryLarge"
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Volume (ml)</Text>
                <TextInput
                  value={newSizeVolume}
                  onChangeText={setNewSizeVolume}
                  placeholder="e.g. 1000"
                  keyboardType="numeric"
                  style={styles.modalInput}
                />
              </View>

              {addSizeError ? <Text style={styles.modalErrorText}>{addSizeError}</Text> : null}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowAddSizeModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitButton, addSizeSubmitting && styles.modalSubmitButtonDisabled]}
                  activeOpacity={0.85}
                  onPress={handleCreateSize}
                  disabled={addSizeSubmitting}>
                  <Text style={styles.modalSubmitText}>
                    {addSizeSubmitting ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeading}>Purchase Order</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.sectionAction}>View purchase history</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusGrid}>
          {purchaseStatuses.map((status) => (
            <View key={status.label} style={styles.statusItem}>
              <View style={styles.statusIconWrap}>
                <Ionicons name={status.icon as any} size={22} color="#8B5E3C" />
              </View>
              <Text style={styles.statusLabel}>{status.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeading}>Settings</Text>
        </View>

        <View style={styles.listCard}>
          <TouchableOpacity
            style={styles.listRow}
            activeOpacity={0.7}
            onPress={() => router.push('/notifications')}
          >
            <View style={styles.listLeft}>
              <Ionicons name="notifications" size={18} color="#8B5E3C" />
              <Text style={styles.listText}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C2B6A8" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.listRow} activeOpacity={0.7}>
            <View style={styles.listLeft}>
              <Ionicons name="globe-outline" size={18} color="#8B5E3C" />
              <Text style={styles.listText}>Languages</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C2B6A8" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.listRow}
            activeOpacity={0.7}
            onPress={() => router.push('/staff-management' as any)}
          >
            <View style={styles.listLeft}>
              <Ionicons name="people-outline" size={18} color="#8B5E3C" />
              <Text style={styles.listText}>Staff Management</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C2B6A8" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.listRow}
            activeOpacity={0.7}
            onPress={() => router.push('/change-password')}
          >
            <View style={styles.listLeft}>
              <Ionicons name="lock-closed-outline" size={18} color="#8B5E3C" />
              <Text style={styles.listText}>Change password</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C2B6A8" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.85}
          onPress={handleLogout}
          disabled={logoutSubmitting}
        >
          <Text style={styles.logoutText}>
            {logoutSubmitting ? 'Logging out...' : 'Log out'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      {toastMessage ? (
        <View style={styles.toastContainer}>
          <View style={styles.toastCard}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F4EF',
  },
  container: {
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 18,
  },
  avatarWrap: {
    marginBottom: 8,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#D6C7B8',
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  avatarBadge: {
    position: 'absolute',
    right: -4,
    top: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F2D36B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7C85F',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3C2B20',
  },
  role: {
    fontSize: 14,
    color: '#C48C2D',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E1D9',
    shadowColor: '#3C2B20',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 14,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 13,
    color: '#6B4D35',
    fontWeight: '600',
  },
  walletBalance: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3C2B20',
  },
  walletHint: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 12,
    color: '#8B6B4D',
    fontWeight: '600',
  },
  walletOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  walletChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E1D9',
    backgroundColor: '#FFF8F0',
  },
  walletChipActive: {
    backgroundColor: '#F2D08C',
    borderColor: '#E5B768',
  },
  walletChipText: {
    fontSize: 12,
    color: '#6B4D35',
    fontWeight: '600',
  },
  walletChipTextActive: {
    color: '#7A4A1B',
  },
  walletInput: {
    borderWidth: 1,
    borderColor: '#E7D6C3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#4A331F',
    backgroundColor: '#FFF9F2',
  },
  walletButton: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: '#D38B2A',
    paddingVertical: 10,
    alignItems: 'center',
  },
  walletButtonDisabled: {
    opacity: 0.7,
  },
  walletButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  payosContainer: {
    flex: 1,
    backgroundColor: '#F7F4EF',
  },
  payosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E1D9',
    backgroundColor: '#FFF',
  },
  payosTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3C2B20',
  },
  payosCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2E6D7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payosWebview: {
    flex: 1,
  },
  payosFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payosFallbackText: {
    fontSize: 13,
    color: '#6B4D35',
  },
  statusRow: {
    marginTop: 8,
    marginBottom: 12,
  },
  statusChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E7F5E7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  statusText: {
    fontSize: 12,
    color: '#1F7A1F',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  outlineButton: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#C89A5B',
    paddingVertical: 8,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: '#A36D2D',
    fontWeight: '600',
    fontSize: 13,
  },
  fillButton: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#F2D08C',
    paddingVertical: 8,
    alignItems: 'center',
  },
  fillButtonText: {
    color: '#7A4A1B',
    fontWeight: '600',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B4D35',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B4D35',
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    flexWrap: 'wrap',
    fontSize: 13,
    color: '#3C2B20',
    fontWeight: '600',
    paddingRight: 10,
  },
  infoRowAddress: {
    marginBottom: 8,
  },
  infoRowAddressTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  infoAddressValue: {
    fontSize: 13,
    color: '#3C2B20',
    fontWeight: '600',
    paddingLeft: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3C2B20',
  },
  sectionAction: {
    fontSize: 12,
    color: '#6B4D35',
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E8E1D9',
    marginBottom: 16,
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8EFE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: {
    fontSize: 10,
    color: '#6B4D35',
    textAlign: 'center',
  },
  listCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E1D9',
    marginBottom: 20,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  listLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listText: {
    fontSize: 14,
    color: '#6B4D35',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#EFE7DD',
  },
  logoutButton: {
    backgroundColor: '#C51B1B',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  beverageCard: {
    backgroundColor: '#FFF3E4',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F5DCC5',
    marginBottom: 14,
  },
  beverageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  beverageTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A331F',
  },
  manageHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#C0832C',
  },
  beverageList: {
    gap: 10,
    marginBottom: 12,
  },
  beverageFeedback: {
    fontSize: 12,
    color: '#8B6B4D',
  },
  sizeItem: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1E2D3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sizeItemEditing: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },
  sizeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sizeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF3E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A331F',
  },
  sizeVolume: {
    fontSize: 11,
    color: '#8B6B4D',
    marginTop: 2,
  },
  sizeStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sizeStatusActive: {
    backgroundColor: '#E3F7E6',
  },
  sizeStatusInactive: {
    backgroundColor: '#F2F2F2',
  },
  sizeStatusTextActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2B8A3E',
  },
  sizeStatusTextInactive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9A9A9A',
  },
  sizeEditContent: {
    gap: 8,
  },
  sizeEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sizeEditTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A331F',
  },
  sizeEditInput: {
    borderWidth: 1,
    borderColor: '#E7D6C3',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#4A331F',
    backgroundColor: '#FFF9F2',
  },
  sizeEditVolumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sizeEditVolumeInput: {
    flex: 1,
  },
  sizeEditVolumeSuffix: {
    fontSize: 12,
    color: '#8B6B4D',
  },
  sizeEditToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sizeEditToggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A331F',
  },
  sizeEditError: {
    fontSize: 11,
    color: '#B0412C',
  },
  sizeEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  sizeEditCancel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F2E6D7',
  },
  sizeEditCancelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7B5B3C',
  },
  sizeEditSave: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#D38B2A',
  },
  sizeEditSaveDisabled: {
    opacity: 0.7,
  },
  sizeEditSaveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  addSizeButton: {
    borderWidth: 1,
    borderColor: '#F1C28B',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#FFF8F1',
  },
  addSizeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D38B2A',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 18, 8, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A331F',
  },
  modalCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F7EDE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalField: {
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B4D35',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E7D6C3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#4A331F',
    backgroundColor: '#FFF9F2',
  },
  modalErrorText: {
    fontSize: 12,
    color: '#B0412C',
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F2E6D7',
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7B5B3C',
  },
  modalSubmitButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#D38B2A',
  },
  modalSubmitButtonDisabled: {
    opacity: 0.7,
  },
  modalSubmitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  toastContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
  },
  toastCard: {
    backgroundColor: '#2C2017',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  toastText: {
    color: '#FFF8F1',
    fontSize: 12,
    fontWeight: '600',
  },
});
