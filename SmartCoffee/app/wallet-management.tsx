import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Modal,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/auth-context';
import { API_ENDPOINTS } from '../services/api';
import WebView from 'react-native-webview';

import { authorizedFetch } from '../services/authService';

export default function WalletManagementScreen() {
  const router = useRouter();
  const { walletBalance, refreshProfile } = useAuth();
  

  
  const [tab, setTab] = useState<'topup' | 'withdraw'>('topup');
  
  // Amounts
  const [amountStr, setAmountStr] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  const amount = Number(amountStr.replace(/[^0-9]/g, ''));
  const isError = amount > 0 && amount < 10000;
  
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Top Up specific (PayOS)
  const [payosUrl, setPayosUrl] = useState<string | null>(null);
  const [showPayosModal, setShowPayosModal] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [topupMethod, setTopupMethod] = useState<'payos' | 'zalopay'>('payos');

  // Withdraw specific (OTP)
  const [withdrawId, setWithdrawId] = useState<number | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  
  const formattedBalance = walletBalance.toLocaleString('en-US');

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3000);
  };

  const handleFormatAmount = (value: string) => {
    const raw = value.replace(/[^0-9]/g, '');
    if (!raw) {
      setAmountStr('');
      return;
    }
    const num = parseInt(raw, 10);
    setAmountStr(num.toLocaleString('en-US'));
  };

  const clearInput = () => {
    setAmountStr('');
  };

  const handleSelectPreset = (val: number) => {
    setAmountStr(val.toLocaleString('en-US'));
  };

  const handleTopupSubmit = async () => {
    if (submitting) return;
    if (amount < 10000) {
      showToast('Minimum top-up amount is 10,000 VND.');
      return;
    }

    try {
      setSubmitting(true);
      const topupUrl =
        topupMethod === 'zalopay'
          ? API_ENDPOINTS.wallet.zaloPayTopUp()
          : API_ENDPOINTS.wallet.topUp();
      const response = await authorizedFetch(topupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, isMobile: true }),
      });
      if (!response.ok) throw new Error('Payment request failed.');
      
      const data = await response.json();
      const checkoutUrl = String(
        topupMethod === 'zalopay' ? data?.orderUrl : data?.checkoutUrl
      ).trim();
      if (!checkoutUrl) throw new Error('Checkout link not found.');
      
      setPayosUrl(checkoutUrl);
      setShowPayosModal(true);
    } catch (error) {
       const message = error instanceof Error ? error.message : 'Unable to create top up request.';
       showToast(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawSubmit = async () => {
    if (submitting) return;
    if (amount < 10000) {
      showToast('Minimum withdraw amount is 10,000 VND.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await authorizedFetch(API_ENDPOINTS.wallet.withdraw(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await response.json();
      if (!response.ok) {
         throw new Error(data?.message || 'Withdraw request failed.');
      }
      setWithdrawId(data?.withdrawId || null);
      showToast(data?.message || 'Please verify your OTP.');
      setShowOtpModal(true);
    } catch (error) {
       const message = error instanceof Error ? error.message : 'Unable to create withdraw request.';
       showToast(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrimaryAction = () => {
    Keyboard.dismiss();
    if (tab === 'topup') {
      handleTopupSubmit();
    } else {
      handleWithdrawSubmit();
    }
  };

  const handleOtpSubmit = async () => {
    if (otpSubmitting) return;
    if (!withdrawId) {
      showToast('Transaction data error.');
      return;
    }
    if (!otpCode || otpCode.trim().length !== 6) {
      showToast('Please enter a 6-digit OTP.');
      return;
    }

    try {
      setOtpSubmitting(true);
      const response = await authorizedFetch(API_ENDPOINTS.wallet.verifyWithdraw(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawId, otpCode: otpCode.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Verification failed.');
      }
      showToast(data?.message || 'Withdrawal successful.');
      setShowOtpModal(false);
      setAmountStr('');
      await refreshProfile();
    } catch (error) {
       const message = error instanceof Error ? error.message : 'Unable to verify OTP.';
       showToast(message);
    } finally {
      setOtpSubmitting(false);
    }
  };

  const handlePayosShouldStart = (event: { url?: string }) => {
    const rawUrl = String(event?.url ?? '');
    const url = rawUrl.toLowerCase();
    
    if (url.includes('cancel=true') || url.includes('status=cancelled')) {
      setShowPayosModal(false);
      setPayosUrl(null);
      showToast('Top up transaction cancelled.');
      return false;
    }
    
    if (url.includes('status=paid')) {
      showToast('Payment successful!');
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        setShowPayosModal(false);
        setPayosUrl(null);
        refreshProfile();
      }, 3000);
      return false;
    }

    return true;
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const presets = tab === 'topup' ? [50000, 100000, 200000] : [100000, 500000, 1000000];
  const isActionDisabled = amount < 10000 || submitting;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F6EFE6' }} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            
            <View style={styles.headerBackground} />
            <View style={styles.safeArea}>
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Main Card */}
              <View style={styles.mainCard}>
                {/* Tabs */}
                <View style={styles.tabsContainer}>
                  <TouchableOpacity 
                    style={[styles.tab, tab === 'topup' && styles.tabActive]}
                    onPress={() => { setTab('topup'); setAmountStr(''); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="arrow-down-circle-outline" size={18} color={tab === 'topup' ? '#A36D2D' : '#888'} />
                    <Text style={[styles.tabText, tab === 'topup' && styles.tabTextActive]}>Top Up</Text>
                    {tab === 'topup' && <View style={styles.tabIndicator} />}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.tab, tab === 'withdraw' && styles.tabActive]}
                    onPress={() => { setTab('withdraw'); setAmountStr(''); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="arrow-up-circle-outline" size={18} color={tab === 'withdraw' ? '#A36D2D' : '#888'} />
                    <Text style={[styles.tabText, tab === 'withdraw' && styles.tabTextActive]}>Withdraw</Text>
                    {tab === 'withdraw' && <View style={styles.tabIndicator} />}
                  </TouchableOpacity>
                </View>

                <View style={styles.formContainer}>
                  <Text style={styles.formLabel}>{tab === 'topup' ? 'Top up to' : 'Withdraw from'}</Text>
                  
                  <View style={styles.walletSourcesRow}>
                    <View style={styles.walletBoxActive}>
                      <View style={styles.walletBoxIcon}>
                        <Ionicons name="wallet" size={20} color="#A36D2D" />
                      </View>
                      <View>
                        <Text style={styles.walletBoxTitle}>SmartCoffee Wallet</Text>
                        <Text style={styles.walletBoxAmount}>{formattedBalance} VND</Text>
                      </View>
                    </View>
                  </View>

                  {/* Input block */}
                  <View style={[
                    styles.inputWrap, 
                    isFocused && styles.inputWrapFocused,
                    isError && styles.inputWrapError
                  ]}>
                    <View style={styles.inputFloatingLabel}>
                      <Text style={[styles.inputFloatingText, isError && styles.inputFloatingTextError]}>
                        {tab === 'topup' ? 'Amount to top up' : 'Amount to withdraw'}
                      </Text>
                    </View>
                    
                    <View style={styles.inputInner}>
                      <TextInput
                        style={[styles.inputField, amountStr ? styles.inputFieldHasValue : null]}
                        keyboardType="numeric"
                        value={amountStr}
                        onChangeText={handleFormatAmount}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="0 VND"
                        placeholderTextColor="#B0B0B0"
                      />
                      
                      {amountStr.length > 0 && (
                        <View style={styles.inputActions}>
                          {isError && <Ionicons name="warning-outline" size={20} color="#D32F2F" style={styles.inputActionIcon} />}
                          <TouchableOpacity onPress={clearInput}>
                            <Ionicons name="close-circle" size={20} color="#B0B0B0" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  {isError && (
                    <Text style={styles.errorHint}>Please enter a minimum of 10,000 VND.</Text>
                  )}

                  {tab === 'topup' ? (
                    <View style={styles.methodSection}>
                      <Text style={styles.methodLabel}>Payment method</Text>
                      <View style={styles.methodRow}>
                        <TouchableOpacity
                          style={[
                            styles.methodChip,
                            topupMethod === 'payos' && styles.methodChipActive,
                          ]}
                          onPress={() => setTopupMethod('payos')}
                        >
                          <Text
                            style={[
                              styles.methodChipText,
                              topupMethod === 'payos' && styles.methodChipTextActive,
                            ]}
                          >
                            PayOS
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.methodChip,
                            topupMethod === 'zalopay' && styles.methodChipActive,
                          ]}
                          onPress={() => setTopupMethod('zalopay')}
                        >
                          <Text
                            style={[
                              styles.methodChipText,
                              topupMethod === 'zalopay' && styles.methodChipTextActive,
                            ]}
                          >
                            ZaloPay (Sandbox)
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Info Section */}
              <View style={styles.infoCard}>
                <View style={styles.infoIconWrap}>
                  <MaterialCommunityIcons name="shield-check" size={32} color="#A36D2D" />
                </View>
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoText}>Your asset safety and information security are our top priorities.</Text>
                </View>
              </View>

            </View>
          </View>
        </TouchableWithoutFeedback>

        {/* Footer Fixed Action */}
        <View style={styles.footer}>
          <View style={styles.presetsRow}>
            {presets.map(val => (
              <TouchableOpacity 
                key={val} 
                style={styles.presetChip}
                onPress={() => handleSelectPreset(val)}
              >
                <Text style={styles.presetChipText}>{val.toLocaleString('en-US')}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity 
            style={[styles.actionButton, isActionDisabled && styles.actionButtonDisabled]}
            onPress={handlePrimaryAction}
            disabled={isActionDisabled}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.actionButtonText}>{tab === 'topup' ? 'Top Up' : 'Withdraw'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* PayOS Modal */}
        <Modal visible={showPayosModal} animationType="slide" onRequestClose={() => setShowPayosModal(false)}>
          <SafeAreaView style={styles.payosContainer}>
            <View style={styles.payosHeader}>
              <Text style={styles.payosTitle}>
                {topupMethod === 'zalopay' ? 'ZaloPay Checkout' : 'PayOS Checkout'}
              </Text>
              <TouchableOpacity onPress={() => setShowPayosModal(false)} style={styles.payosClose}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            {payosUrl ? (
              <WebView
                source={{ uri: payosUrl }}
                style={{ flex: 1 }}
                onShouldStartLoadWithRequest={
                  topupMethod === 'payos' ? handlePayosShouldStart : undefined
                }
              />
            ) : (
              <View style={styles.payosFallback}>
                <Text>Missing checkout URL.</Text>
              </View>
            )}
          </SafeAreaView>
        </Modal>

        {/* OTP Modal */}
        <Modal visible={showOtpModal} transparent animationType="fade" onRequestClose={() => setShowOtpModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.otpCard}>
              <View style={styles.otpHeader}>
                <Text style={styles.otpTitle}>OTP Verification</Text>
                <TouchableOpacity onPress={() => setShowOtpModal(false)}>
                  <Ionicons name="close" size={22} color="#333" />
                </TouchableOpacity>
              </View>
              <Text style={styles.otpDesc}>A 6-digit verification code has been sent to your email.</Text>
              <TextInput
                style={styles.otpInput}
                keyboardType="number-pad"
                maxLength={6}
                value={otpCode}
                onChangeText={setOtpCode}
                placeholder="Enter 6 digits"
              />
              <TouchableOpacity 
                style={[styles.actionButton, otpSubmitting && styles.actionButtonDisabled, {width: '100%', marginTop: 8}]}
                onPress={handleOtpSubmit}
                disabled={otpSubmitting}
              >
                <Text style={styles.actionButtonText}>{otpSubmitting ? 'Verifying...' : 'Confirm'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Toast Notification */}
        {toastMessage && (
          <View style={styles.toastContainer}>
            <View style={styles.toast}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F9', // Light gray background to match momo below header
  },
  content: {
    flex: 1,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 250,
    backgroundColor: '#F6EFE6', // Light brown/gold top (was pink #FDEEF1)
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  iconBtn: {
    padding: 2,
  },
  mainCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#FAFAFA',
    gap: 8,
    position: 'relative',
  },
  tabActive: {
    backgroundColor: '#FFF',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
  },
  tabTextActive: {
    color: '#A36D2D', // Primary brown
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: '#A36D2D',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  formContainer: {
    padding: 16,
  },
  formLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  walletSourcesRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  walletBoxActive: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#D4C4B5', // Primary brown light (was pink #E8B4C8)
    borderRadius: 8,
    backgroundColor: '#FCF9F5', // Soft brown background
    gap: 12,
  },
  walletBoxIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  walletBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  walletBoxAmount: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    position: 'relative',
    marginTop: 4,
  },
  inputWrapFocused: {
    borderColor: '#A36D2D', // Primary brown
  },
  inputWrapError: {
    borderColor: '#D32F2F', // Red
  },
  inputFloatingLabel: {
    position: 'absolute',
    top: -10,
    left: 12,
    backgroundColor: '#FFF',
    paddingHorizontal: 4,
  },
  inputFloatingText: {
    fontSize: 12,
    color: '#666',
  },
  inputFloatingTextError: {
    color: '#D32F2F',
  },
  inputInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputField: {
    flex: 1,
    fontSize: 24,
    fontWeight: '400',
    color: '#CCC', // when empty
    padding: 0,
    minHeight: 32,
  },
  inputFieldHasValue: {
    color: '#333',
    fontWeight: '600',
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodSection: {
    marginTop: 16,
  },
  methodLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E1D6C8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FAF6F1',
  },
  methodChipActive: {
    borderColor: '#A36D2D',
    backgroundColor: '#FFF1E1',
  },
  methodChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7A6A5E',
  },
  methodChipTextActive: {
    color: '#A36D2D',
  },
  inputActionIcon: {
    marginRight: 4,
  },
  errorHint: {
    fontSize: 12,
    color: '#D32F2F',
    marginTop: 8,
  },
  infoCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F9FAFC',
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  infoIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EBE1D5', // Secondary brown light
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextWrap: {
    flex: 1,
  },
  infoText: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
  },
  footer: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  presetChip: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  presetChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  actionButton: {
    backgroundColor: '#A36D2D', // Primary brown
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#EAEAEA',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  payosContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  payosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  payosTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  payosClose: {
    padding: 4,
  },
  payosFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  otpCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
  },
  otpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  otpTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  otpDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  otpInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 14,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 16,
  },
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    backgroundColor: 'rgba(50, 50, 50, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
