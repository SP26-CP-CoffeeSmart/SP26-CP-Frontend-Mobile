import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { authorizedFetch } from './authService';

export interface MenuPerformanceSummary {
  menuId: number;
  menuScore?: string; // e.g., "Good", "Excellent", "Poor"
  startDate?: string;
  endDate?: string;
  revenue?: number;
  revenueChange?: number; // percentage change
  profit?: number;
  profitChange?: number; // percentage change
  cost?: number;
  costChange?: number; // percentage change
  menuItems?: MenuItemPerformance[];
  aiSuggestions?: {
    count?: number;
    description?: string;
  };
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
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
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

class MenuPerformanceService {
  async getSummary(menuId: number): Promise<MenuPerformanceSummary> {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await authorizedFetch(`${baseUrl}/api/MenuPerformance/${menuId}/summary`, {
        headers: {
          Accept: '*/*',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Menu Performance API Response:', data);
      return data;
    } catch (error) {
      console.error('Error fetching menu performance summary:', error);
      throw error;
    }
  }
}

export default new MenuPerformanceService();
