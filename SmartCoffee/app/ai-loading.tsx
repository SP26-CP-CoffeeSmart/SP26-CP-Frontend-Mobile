import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AiLoadingScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(fade, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.delay(1600),
        Animated.timing(fade, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.delay(1600),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [fade]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.centerWrap}>
        <View style={styles.card}>
          <Image
            source={require('../assets/loadingscreenai.png')}
            resizeMode="contain"
            style={styles.heroImage}
          />

          <View style={styles.messageWrap}>
            <Animated.View
              style={[
                styles.messageBlock,
                {
                  opacity: fade.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0],
                  }),
                },
              ]}>
              <ThemedText
                style={styles.title}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}>
                AI is creating your results.
              </ThemedText>
            </Animated.View>
            <Animated.View
              style={[
                styles.messageBlock,
                {
                  opacity: fade.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                },
              ]}>
              <ThemedText
                style={styles.title}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}>
                Please be patient while we finish the menu.
              </ThemedText>
            </Animated.View>
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
    paddingVertical: 26,
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
  heroImage: {
    width: 220,
    height: 220,
    alignSelf: 'center',
  },
  messageWrap: {
    minHeight: 54,
    marginTop: 18,
    justifyContent: 'center',
  },
  messageBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  title: {
    fontSize: 15,
    fontFamily: Fonts.rounded,
    color: '#4B2E1E',
    textAlign: 'center',
  },
});
