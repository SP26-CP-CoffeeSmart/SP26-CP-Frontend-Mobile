import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const heroImage = require('../assets/startedscreen.jpg');

export default function StartScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ImageBackground
        source={heroImage}
        style={styles.image}
        imageStyle={styles.imageAsset}
      >
        <View style={styles.imageOverlay} />

        <View style={styles.headerBlock}>
          <View style={styles.titleRow}>
            <View style={styles.titlePill}>
              <Text style={styles.titlePillText}>Smart</Text>
            </View>
            <Text style={styles.titleText}>Coffee</Text>
          </View>
          <Text style={styles.subtitleText}>Capuchino</Text>
        </View>

        <View style={[styles.tag, styles.tagLeft]}>
          <Text style={styles.tagText}>Perfect</Text>
        </View>
        <View style={[styles.tag, styles.tagRight]}>
          <Text style={styles.tagText}>Fantastic</Text>
        </View>
        <View style={[styles.tag, styles.tagTop]}>
          <Text style={styles.tagText}>Amazing</Text>
        </View>

        <Pressable style={styles.ctaButton} onPress={() => router.replace('/sign-in')}>
          <Text style={styles.ctaText}>Get Started</Text>
          <View style={styles.ctaIconWrap}>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </View>
        </Pressable>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#120A06',
  },
  image: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 56,
    justifyContent: 'space-between',
  },
  imageAsset: {
    transform: [{ scale: 1.08 }],
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 14, 8, 0.45)',
  },
  headerBlock: {
    alignItems: 'center',
    gap: 12,
    transform: [{ translateX: -12 }],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  titlePill: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 26,
  },
  titlePillText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2B170E',
  },
  titleText: {
    fontSize: 34,
    fontWeight: '700',
    color: '#F6EEE8',
  },
  subtitleText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#F6EEE8',
    alignSelf: 'flex-end',
    marginRight: -10,
  },
  tag: {
    position: 'absolute',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(33, 21, 15, 0.7)',
  },
  tagText: {
    fontSize: 14,
    color: '#F6EEE8',
    fontWeight: '600',
  },
  tagLeft: {
    left: 22,
    top: '90%',
  },
  tagRight: {
    right: 22,
    top: '58%',
  },
  tagTop: {
    left: 32,
    top: 400,
    transform: [{ rotate: '-55deg' }],
  },
  ctaButton: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2B170E',
  },
  ctaIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2B170E',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
