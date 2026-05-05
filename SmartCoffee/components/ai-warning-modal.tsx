import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AiWarningModalProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export default function AiWarningModal({
  visible,
  title,
  message,
  onClose,
}: AiWarningModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, styles.warningIconWrap]}>
            <Ionicons name="warning-outline" size={22} color="#d17a22" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={[styles.actions, styles.singleAction]}>
            <TouchableOpacity style={styles.primaryButton} onPress={onClose}>
              <Text style={styles.primaryText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 20, 17, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8dfd6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5eee7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  warningIconWrap: {
    backgroundColor: '#fff2e6',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4a3621',
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    fontSize: 13,
    color: '#7b6a5a',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 12,
  },
  singleAction: {
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#4a3621',
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
