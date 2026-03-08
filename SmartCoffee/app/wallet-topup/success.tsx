import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function WalletTopupSuccess() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(tabs)/profile');
    }, 300);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Top-up successful</Text>
      <Text style={styles.subtitle}>Returning to profile...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F4EF',
    padding: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3C2B20',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: '#6B4D35',
  },
});
