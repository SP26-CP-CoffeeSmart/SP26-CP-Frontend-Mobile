import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import "../global.css";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Toast from 'react-native-toast-message';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { BeverageCategoryProvider } from '@/context/beverage-category-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { hasToken, checkingToken, role } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (checkingToken) {
      return;
    }

    const firstSegment = segments[0];
    const authScreens = ['sign-in', 'sign-up', 'forgot-password', 'otp', 'reset-password', 'index', 'loading'];
    const nestedScreens = ['change-password', 'recipe-detail', 'menu-detail', 'ai-loading', 'ai-recommendations', 'ai-result', 'ai-order-suggestions', 'ai-order-review', 'staff-management', 'create-staff', 'create-recipe', 'menu-recommendations', 'menu-results', 'ingredient-detail', 'daily-sales', 'daily-sale-item'];
    const isOnAuthScreen = authScreens.includes(firstSegment);
    const isOnNestedScreen = nestedScreens.includes(firstSegment);

    // Not logged in → must be on auth screen
    if (!hasToken) {
      if (firstSegment && !isOnAuthScreen) {
        router.replace('/');
      }
    } else {
      // Logged in → route based on role
      if (role === 'Staff') {
        // Staff must use tabs-staff layout OR be on nested screens
        if (!firstSegment?.includes('tabs-staff') && !isOnNestedScreen) {
          router.replace('/(tabs-staff)/menu-staff');
        }
      } else {
        // ShopOwner/Admin must use tabs layout
        if (isOnAuthScreen) {
          router.replace('/(tabs)/menu');
        }
      }
    }
  }, [checkingToken, hasToken, role, segments, router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="index">
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="loading" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ headerShown: false }} />
        <Stack.Screen name="menu-version-detail/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="menu-version/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="daily-sales" options={{ headerShown: false }} />
        <Stack.Screen name="daily-sale-item/[menuItemId]" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="otp" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs-staff)" options={{ headerShown: false }} />
        <Stack.Screen name="change-password" options={{ headerShown: false }} />
        <Stack.Screen name="recipe-detail" options={{ headerShown: false }} />
        <Stack.Screen name="coffee-detail" options={{ headerShown: false }} />
        <Stack.Screen name="inventory" options={{ headerShown: false }} />
        <Stack.Screen name="ai-loading" options={{ headerShown: false }} />
        <Stack.Screen name="ai-recommendations" options={{ headerShown: false }} />
        <Stack.Screen name="ai-result" options={{ headerShown: false }} />
        <Stack.Screen name="ai-order-suggestions" options={{ headerShown: false }} />
        <Stack.Screen name="ai-order-review" options={{ headerShown: false }} />
        <Stack.Screen name="create-recipe" options={{ headerShown: false }} />
        <Stack.Screen name="menu-recommendations" options={{ headerShown: false }} />
        <Stack.Screen name="menu-results" options={{ headerShown: false }} />
        <Stack.Screen name="menu-detail/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="staff-management" options={{ headerShown: false }} />
        <Stack.Screen name="create-staff" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <Toast />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <BeverageCategoryProvider>
          <RootLayoutNav />
        </BeverageCategoryProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
