import { API_ENDPOINTS } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BeverageSize {
  id?: number;
  beverageSizeId?: number;
  name?: string;
  sizeName?: string;
  volume?: number | string;
  capacity?: number | string;
  status?: string;
  isActive?: boolean;
  active?: boolean;
  [key: string]: unknown;
}

export interface CreateBeverageSizePayload {
  beverageSizeId?: number;
  coffeeShopId: number;
  sizeName: string;
  volume: number;
  isActive: boolean;
}

export interface UpdateBeverageSizePayload {
  beverageSizeId: number;
  sizeName: string;
  volume: number;
  isActive: boolean;
  coffeeShop: {
    coffeeShopId: number;
  };
}

class BeverageSizeService {
  private async getAuthHeaders() {
    const token = await AsyncStorage.getItem('accessToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getAll(): Promise<BeverageSize[]> {
    try {
      const response = await fetch(API_ENDPOINTS.beverageSize.getAll(), {
        headers: {
          Accept: '*/*',
          ...(await this.getAuthHeaders()),
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching beverage sizes:', error);
      throw error;
    }
  }

  async create(payload: CreateBeverageSizePayload): Promise<BeverageSize> {
    try {
      const resolvedPayload = {
        ...payload,
        coffeeShopId: payload.coffeeShopId ?? 1,
      };
      const response = await fetch(API_ENDPOINTS.beverageSize.create(), {
        method: 'POST',
        headers: {
          Accept: 'text/plain',
          'Content-Type': 'application/json',
          ...(await this.getAuthHeaders()),
        },
        body: JSON.stringify(resolvedPayload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating beverage size:', error);
      throw error;
    }
  }

  async update(id: number, payload: UpdateBeverageSizePayload): Promise<BeverageSize> {
    try {
      const resolvedPayload = {
        ...payload,
        coffeeShop: {
          coffeeShopId: payload.coffeeShop?.coffeeShopId ?? 1,
        },
      };
      const response = await fetch(API_ENDPOINTS.beverageSize.update(id), {
        method: 'PUT',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
          ...(await this.getAuthHeaders()),
        },
        body: JSON.stringify(resolvedPayload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      if (!text) {
        return {
          beverageSizeId: resolvedPayload.beverageSizeId,
          sizeName: resolvedPayload.sizeName,
          volume: resolvedPayload.volume,
          isActive: resolvedPayload.isActive,
          coffeeShop: resolvedPayload.coffeeShop,
        } as BeverageSize;
      }

      try {
        return JSON.parse(text);
      } catch {
        return {
          beverageSizeId: resolvedPayload.beverageSizeId,
          sizeName: resolvedPayload.sizeName,
          volume: resolvedPayload.volume,
          isActive: resolvedPayload.isActive,
          coffeeShop: resolvedPayload.coffeeShop,
        } as BeverageSize;
      }
    } catch (error) {
      console.error('Error updating beverage size:', error);
      throw error;
    }
  }
}

export default new BeverageSizeService();
