import { API_ENDPOINTS } from './api';
import { authorizedFetch } from './authService';

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
  async getByShop(shopId: number): Promise<BeverageSize[]> {
    const url = API_ENDPOINTS.beverageSize.getByShop(shopId);
    try {
      console.log('[BeverageSize][GET by shop] request', {
        url,
        method: 'GET',
        shopId,
      });

      const response = await authorizedFetch(url, {
        headers: {
          Accept: '*/*',
        },
      });

      const responseText = await response.text();
      console.log('[BeverageSize][GET by shop] response', {
        url,
        status: response.status,
        ok: response.ok,
        body: responseText,
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}; body: ${responseText || '<empty>'}`
        );
      }

      const data = responseText ? JSON.parse(responseText) : [];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching beverage sizes:', error);
      throw error;
    }
  }

  async create(payload: CreateBeverageSizePayload): Promise<BeverageSize> {
    const url = API_ENDPOINTS.beverageSize.create();
    try {
      console.log('[BeverageSize][CREATE] request', {
        url,
        method: 'POST',
        payload,
      });

      const response = await authorizedFetch(url, {
        method: 'POST',
        headers: {
          Accept: 'text/plain',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log('[BeverageSize][CREATE] response', {
        url,
        status: response.status,
        ok: response.ok,
        body: responseText,
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}; body: ${responseText || '<empty>'}`
        );
      }

      if (!responseText) {
        return payload as BeverageSize;
      }

      try {
        return JSON.parse(responseText);
      } catch {
        return {
          ...payload,
          raw: responseText,
        } as BeverageSize;
      }
    } catch (error) {
      console.error('Error creating beverage size:', error);
      throw error;
    }
  }

  async update(id: number, payload: UpdateBeverageSizePayload): Promise<BeverageSize> {
    const url = API_ENDPOINTS.beverageSize.update(id);
    try {
      console.log('[BeverageSize][UPDATE] request', {
        url,
        method: 'PUT',
        id,
        payload,
      });

      const response = await authorizedFetch(url, {
        method: 'PUT',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      console.log('[BeverageSize][UPDATE] response', {
        url,
        status: response.status,
        ok: response.ok,
        body: text,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}; body: ${text || '<empty>'}`);
      }

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
