import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';

export default function AiLoadingScreen() {
  const [messageIndex, setMessageIndex] = useState(0);
  const textOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const messages = [
    'AI is creating your results.',
    'Please be patient while we finish the menu.',
  ];

  useEffect(() => {
    let isMounted = true;

    const runTextCycle = () => {
      textOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.delay(1800),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.delay(200),
      ]).start(({ finished }) => {
        if (!finished || !isMounted) return;
        setMessageIndex((prev) => (prev + 1) % messages.length);
        runTextCycle();
      });
    };

    runTextCycle();

    const pulseAnimation = Animated.loop(
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

    pulseAnimation.start();

    return () => {
      isMounted = false;
      pulseAnimation.stop();
    };
  }, [messages.length, pulse, textOpacity]);

  return (
    <View style={styles.root}>
      <View style={styles.centerWrap}>
        <View style={styles.card}>
          <Animated.View
            style={[
              styles.heroImageWrap,
              {
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1.03],
                    }),
                  },
                ],
              },
            ]}>
            <Image
              source={require('../assets/loadingscreenai.png')}
              resizeMode="contain"
              style={styles.heroImage}
            />
          </Animated.View>

          <View style={styles.messageWrap}>
            <Animated.View style={[styles.messageBlock, { opacity: textOpacity }]}>
              <ThemedText
                style={styles.title}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}>
                {messages[messageIndex]}
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
    backgroundColor: '#F2E6DA',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#F2E2D3',
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
    borderColor: '#E1CDBB',
  },
  heroImageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
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
