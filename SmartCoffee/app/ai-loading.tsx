import React, { useEffect, useRef } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AiLoadingScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.centerWrap}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.iconBadge}>
              <MaterialIcons name="coffee" size={20} color="#6B3B1E" />
            </View>
            <ThemedText style={styles.brandText}>SmartCoffee AI</ThemedText>
          </View>

          <View style={styles.spinnerWrap}>
            <View style={styles.ringOuter} />
            <View style={styles.ringInner}>
              <ActivityIndicator size="large" color="#A35A2A" />
            </View>
          </View>

          <Animated.View
            style={{
              opacity: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 1],
              }),
              transform: [
                {
                  translateY: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [2, -2],
                  }),
                },
              ],
            }}>
            <ThemedText style={styles.title}>Brewing your AI coffee idea</ThemedText>
            <ThemedText style={styles.subtitle}>
              We’re blending flavors and steps for a perfect cup.
            </ThemedText>
          </Animated.View>

          <View style={styles.footerRow}>
            <View style={styles.chip}>
              <MaterialIcons name="auto-awesome" size={14} color="#A35A2A" />
              <ThemedText style={styles.chipText}>AI Crafting</ThemedText>
            </View>
            <View style={styles.chip}>
              <MaterialIcons name="schedule" size={14} color="#A35A2A" />
              <ThemedText style={styles.chipText}>~10s</ThemedText>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#F7EFE8',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
    shadowColor: '#3D2918',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    maxWidth: 360,
    width: '100%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#E9D7C7',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1DCC8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 13,
    fontFamily: Fonts.rounded,
    color: '#6B3B1E',
    letterSpacing: 0.3,
  },
  spinnerWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  ringOuter: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#F1E1D4',
    borderWidth: 1,
    borderColor: '#E2CDBB',
  },
  ringInner: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#F6E8DC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6D3C4',
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.rounded,
    color: '#4B2E1E',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 12,
    color: '#7A5234',
    textAlign: 'center',
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1DCC8',
  },
  chipText: {
    fontSize: 11,
    color: '#6B3B1E',
  },
});
