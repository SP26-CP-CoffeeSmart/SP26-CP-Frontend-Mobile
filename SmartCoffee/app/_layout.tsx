import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import "../global.css";
import { useColorScheme } from '@/hooks/use-color-scheme';
import Toast from 'react-native-toast-message';
import { AuthProvider } from '@/context/auth-context';
import { BeverageCategoryProvider } from '@/context/beverage-category-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <BeverageCategoryProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack initialRouteName="index">
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen name="sign-up" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="otp" options={{ headerShown: false }} />
            <Stack.Screen name="reset-password" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="recipe-detail" options={{ headerShown: false }} />
            <Stack.Screen name="coffee-detail" options={{ headerShown: false }} />
            <Stack.Screen name="inventory" options={{ headerShown: false }} />
            <Stack.Screen name="ai-loading" options={{ headerShown: false }} />
            <Stack.Screen name="ai-recommendations" options={{ headerShown: false }} />
            <Stack.Screen name="ai-result" options={{ headerShown: false }} />
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
      </BeverageCategoryProvider>
    </AuthProvider>
  );
}
