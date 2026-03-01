import { API_ENDPOINTS } from './api';
import { authorizedFetch } from './authService';

export interface BeverageCategory {
  beverageCategoryId: number;
  name?: string;
  image?: string;
  coffeeShopId?: number;
  menuGroupId?: number;
  createDate?: string;
}

export interface ItemSize {
  itemSizeId: number;
  beverageSizeId?: number;
  menuItemId?: number;
  sellingPrice?: number;
  beverageSize?: {
    beverageSizeId: number;
    sizeName?: string;
    volume?: number;
  };
}

export interface ShopBeverage {
  beverageId: number;
  name?: string;
  status?: string;
  createDate?: string;
  beverageCategoryId?: number;
  coffeeShopId?: number;
  image?: string;
  imageUrl?: string;
  beverageCategory?: BeverageCategory;
}

export interface ShopRecipe {
  recipeId: number;
  recipeName?: string;
  image?: string;
  category?: string;
  createdSource?: string;
  status?: string;
}

export interface MenuItem {
  menuItemId: number;
  menuId: number;
  beverageId: number;
  recipeId: number;
  description?: string;
  sellingPrice: number;
  addedDate: string;
  itemSizeViewModels?: ItemSize[];
  shopBeverage?: ShopBeverage;
  shopRecipe?: ShopRecipe;
}

class MenuItemService {
  async getAll(): Promise<MenuItem[]> {
    try {
      const response = await authorizedFetch(API_ENDPOINTS.menuItem.getAll(), {
        headers: {
          Accept: '*/*',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching menu items:', error);
      throw error;
    }
  }

  async getById(id: number): Promise<MenuItem> {
    try {
      const response = await authorizedFetch(API_ENDPOINTS.menuItem.getById(id), {
        headers: {
          Accept: '*/*',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching menu item:', error);
      throw error;
    }
  }

  async getByMenuId(menuId: number): Promise<MenuItem[]> {
    try {
      const allItems = await this.getAll();
      return allItems.filter(item => item.menuId === menuId);
    } catch (error) {
      console.error('Error fetching menu items by menuId:', error);
      throw error;
    }
  }
}

export default new MenuItemService();
