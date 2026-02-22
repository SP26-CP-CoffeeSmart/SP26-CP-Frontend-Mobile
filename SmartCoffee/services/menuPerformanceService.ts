import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChartDataItem {
  date: string;
  totalRevenue: number;
  totalCups: number;
  cost: number;
  menuItemId: number | null;
  menuItemName: string | null;
}

export interface MenuPerformanceSummary {
  menuId: number;
  versionNumber: string;
  status: string;
  isActive: boolean;
  totalRevenue: number;
  totalSales: number;
  avgRating: number | null;
  calculatedAt: string;
  revenueCurrentPeriod: number;
  revenuePreviousPeriod: number;
  revenueChangePercent: number;
  chartData: ChartDataItem[];
}

export interface MenuItemPerformance {
  id: number;
  name: string;
  rating?: number;
  totalSold?: number;
  profit?: number;
  cost?: number;
  profitMargin?: number; // percentage
  status?: 'HIGH_MARGIN' | 'HIGH_COST' | 'LOW_SALES' | 'NORMAL';
  imageUrl?: string;
}

const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_AUTH_BASE_URL) {
    return process.env.EXPO_PUBLIC_AUTH_BASE_URL;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:5080`;
  }

  return Platform.select({
    android: 'http://10.0.2.2:5080',
    ios: 'http://localhost:5080',
    default: 'http://localhost:5080',
  });
};

// Create axios instance
const apiClient = axios.create({
  baseURL: `${getApiBaseUrl()}/api`,
  headers: {
    'Content-Type': 'application/json',
    Accept: '*/*',
  },
  timeout: 10000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error:', error.message);
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

class MenuPerformanceService {
  async getSummary(menuId: number): Promise<MenuPerformanceSummary> {
    try {
      const response = await apiClient.get<MenuPerformanceSummary>(
        `/MenuPerformance/${menuId}/summary`
      );
      
      console.log('Menu Performance API Response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching menu performance summary:', error);
      throw error;
    }
  }
}

export default new MenuPerformanceService();
