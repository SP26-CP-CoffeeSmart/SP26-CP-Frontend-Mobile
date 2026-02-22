import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Base API configuration
const normalizeApiBaseUrl = (baseUrl: string) =>
  baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;

const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    return normalizeApiBaseUrl(`http://${host}:5037`);
  }

  return Platform.select({
    android: normalizeApiBaseUrl('http://10.0.2.2:5037'),
    ios: normalizeApiBaseUrl('http://localhost:5037'),
    default: normalizeApiBaseUrl('http://localhost:5037'),
  });
};

export const API_BASE_URL = getApiBaseUrl();

const getAuthBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_AUTH_BASE_URL) {
    return normalizeApiBaseUrl(process.env.EXPO_PUBLIC_AUTH_BASE_URL);
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    return normalizeApiBaseUrl(`http://${host}:5080`);
  }

  return Platform.select({
    android: normalizeApiBaseUrl('http://10.0.2.2:5080'),
    ios: normalizeApiBaseUrl('http://localhost:5080'),
    default: normalizeApiBaseUrl('http://localhost:5080'),
  });
};

export const AUTH_BASE_URL = getAuthBaseUrl();
console.log('[API] AUTH_BASE_URL:', AUTH_BASE_URL);

export const API_ENDPOINTS = {
  auth: {
    register: () => `${AUTH_BASE_URL}/Auth/register`,
    login: () => `${AUTH_BASE_URL}/Auth/login`,
    verifyOtp: () => `${AUTH_BASE_URL}/Auth/verify-otp`,
    me: () => `${AUTH_BASE_URL}/Auth/me`,
    logout: () => `${AUTH_BASE_URL}/Auth/logout`,
    refreshToken: () => `${AUTH_BASE_URL}/Auth/refresh-token`,
    changePassword: () => `${AUTH_BASE_URL}/Auth/change-password`,
  },
  shopRecipeIngredients: {
    getAll: () => `${API_BASE_URL}/ShopRecipeIngredients`,
    getById: (id: number) => `${API_BASE_URL}/ShopRecipeIngredients/${id}`,
    getByRecipeId: (recipeId: number) => `${API_BASE_URL}/ShopRecipeIngredients/by-recipe/${recipeId}`,
  },
  beverageSize: {
    getAll: () => `${API_BASE_URL}/BeverageSize`,
    getByShop: (shopId: number) => `${API_BASE_URL}/BeverageSize/by-shop/${shopId}`,
    create: () => `${API_BASE_URL}/BeverageSize`,
    update: (id: number) => `${API_BASE_URL}/BeverageSize/${id}`,
  },
  beverageCategory: {
    getAll: () => `${API_BASE_URL}/BeverageCategory`,
  },
  ai: {
    createMenuSkeleton: () => `${API_BASE_URL}/AI/create-menu-p1-skeleton`,
  },
};
