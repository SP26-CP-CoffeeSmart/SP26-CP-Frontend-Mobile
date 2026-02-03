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

export const API_ENDPOINTS = {
  shopRecipeIngredients: {
    getAll: () => `${API_BASE_URL}/ShopRecipeIngredients`,
    getById: (id: number) => `${API_BASE_URL}/ShopRecipeIngredients/${id}`,
    getByRecipeId: (recipeId: number) => `${API_BASE_URL}/ShopRecipeIngredients/by-recipe/${recipeId}`,
  },
};
