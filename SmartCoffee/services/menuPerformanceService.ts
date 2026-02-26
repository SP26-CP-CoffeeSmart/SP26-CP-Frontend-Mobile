import { API_ENDPOINTS } from './api';
import { authorizedFetch } from './authService';

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

class MenuPerformanceService {
  async getSummary(menuId: number): Promise<MenuPerformanceSummary> {
    try {
      const response = await authorizedFetch(API_ENDPOINTS.menuPerformance.getSummary(menuId), {
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
