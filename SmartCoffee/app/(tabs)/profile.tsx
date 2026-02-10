import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import beverageSizeService, { BeverageSize } from '@/services/beverageSizeService';

const purchaseStatuses = [
  { label: 'Pending confirmation', icon: 'wallet-outline' },
  { label: 'Awaiting pickup', icon: 'cube-outline' },
  { label: 'Awaiting delivery', icon: 'car-outline' },
  { label: 'Delivered', icon: 'checkmark-done-outline' },
];

export default function ProfileScreen() {
  const [beverageSizes, setBeverageSizes] = useState<BeverageSize[]>([]);
  const [beverageSizesLoading, setBeverageSizesLoading] = useState(true);
  const [beverageSizesError, setBeverageSizesError] = useState<string | null>(null);
  const [showAddSizeModal, setShowAddSizeModal] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeVolume, setNewSizeVolume] = useState('');
  const [addSizeError, setAddSizeError] = useState<string | null>(null);
  const [addSizeSubmitting, setAddSizeSubmitting] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadBeverageSizes = async () => {
      try {
        const data = await beverageSizeService.getAll();
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
  }, []);

  const getSizeName = (size: BeverageSize, index: number) =>
    String(size.name ?? size.sizeName ?? size.title ?? `Size ${index + 1}`);

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

    try {
      setAddSizeSubmitting(true);
      const created = await beverageSizeService.create({
        beverageSizeId: 0,
        coffeeShopId: 1,
        sizeName: trimmedName,
        volume: parsedVolume,
        isActive: true,
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Ionicons name="person-outline" size={36} color="#5C4634" />
            </View>
            <View style={styles.avatarBadge}>
              <Ionicons name="pencil" size={12} color="#5C4634" />
            </View>
          </View>
          <Text style={styles.name}>John Doe</Text>
          <Text style={styles.role}>Coffee Shop Owner</Text>
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
            <Ionicons name="person" size={16} color="#8B5E3C" />
            <Text style={styles.infoLabel}>Full name:</Text>
            <Text style={styles.infoValue}>John Doe</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call" size={16} color="#8B5E3C" />
            <Text style={styles.infoLabel}>Phone number:</Text>
            <Text style={styles.infoValue}>0123456789</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail" size={16} color="#8B5E3C" />
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>JohnDoe@exaple.com</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="storefront" size={16} color="#8B5E3C" />
            <Text style={styles.infoLabel}>Shop name:</Text>
            <Text style={styles.infoValue}>CoffeeShop</Text>
          </View>
        </View>

        <View style={styles.beverageCard}>
          <View style={styles.beverageHeader}>
            <Text style={styles.beverageTitle}>Beverage Size Setup</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.manageText}>Manage</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.beverageList}>
            {beverageSizesLoading ? (
              <Text style={styles.beverageFeedback}>Loading beverage sizes...</Text>
            ) : beverageSizesError ? (
              <Text style={styles.beverageFeedback}>{beverageSizesError}</Text>
            ) : beverageSizes.length === 0 ? (
              <Text style={styles.beverageFeedback}>No beverage sizes found.</Text>
            ) : (
              beverageSizes.map((size, index) => {
                const active = isSizeActive(size);

                return (
                  <View key={`${getSizeName(size, index)}-${index}`} style={styles.sizeItem}>
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
                      style={[styles.sizeStatus, active ? styles.sizeStatusActive : styles.sizeStatusInactive]}>
                      <Text
                        style={active ? styles.sizeStatusTextActive : styles.sizeStatusTextInactive}>
                        {getSizeStatus(size)}
                      </Text>
                    </View>
                  </View>
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
                <Ionicons name={status.icon} size={22} color="#8B5E3C" />
              </View>
              <Text style={styles.statusLabel}>{status.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeading}>Settings</Text>
        </View>

        <View style={styles.listCard}>
          <TouchableOpacity style={styles.listRow} activeOpacity={0.7}>
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
        </View>

        <TouchableOpacity style={styles.logoutButton} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
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
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B4D35',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    color: '#3C2B20',
    fontWeight: '600',
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
  manageText: {
    fontSize: 12,
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
});
