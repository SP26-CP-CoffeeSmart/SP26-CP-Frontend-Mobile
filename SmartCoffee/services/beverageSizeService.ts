import { API_ENDPOINTS } from './api';

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
  async getAll(): Promise<BeverageSize[]> {
    try {
      const response = await fetch(API_ENDPOINTS.beverageSize.getAll());
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
      const response = await fetch(API_ENDPOINTS.beverageSize.create(), {
        method: 'POST',
        headers: {
          Accept: 'text/plain',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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
      const response = await fetch(API_ENDPOINTS.beverageSize.update(id), {
        method: 'PUT',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      if (!text) {
        return {
          beverageSizeId: payload.beverageSizeId,
          sizeName: payload.sizeName,
          volume: payload.volume,
          isActive: payload.isActive,
          coffeeShop: payload.coffeeShop,
        } as BeverageSize;
      }

      try {
        return JSON.parse(text);
      } catch {
        return {
          beverageSizeId: payload.beverageSizeId,
          sizeName: payload.sizeName,
          volume: payload.volume,
          isActive: payload.isActive,
          coffeeShop: payload.coffeeShop,
        } as BeverageSize;
      }
    } catch (error) {
      console.error('Error updating beverage size:', error);
      throw error;
    }
  }
}

export default new BeverageSizeService();
