import { API_ENDPOINTS } from './api';

export interface Ingredient {
  ingredientId: number;
  name: string;
  image: string;
  category: string;
  createDate: string;
  endDate: string;
}

export interface ShopRecipeIngredient {
  id: number;
  quantity: number;
  cost: number;
  ingredient: Ingredient;
}

class ShopRecipeIngredientsService {
  /**
   * Lấy tất cả ShopRecipeIngredients
   */
  async getAll(): Promise<ShopRecipeIngredient[]> {
    try {
      const response = await fetch(API_ENDPOINTS.shopRecipeIngredients.getAll());
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching shop recipe ingredients:', error);
      throw error;
    }
  }

  /**
   * Lấy ShopRecipeIngredient theo ID
   */
  async getById(id: number): Promise<ShopRecipeIngredient> {
    try {
      const response = await fetch(API_ENDPOINTS.shopRecipeIngredients.getById(id));
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching shop recipe ingredient ${id}:`, error);
      throw error;
    }
  }

  /**
   * Lấy ShopRecipeIngredients theo Recipe ID
   */
  async getByRecipeId(recipeId: number): Promise<ShopRecipeIngredient[]> {
    try {
      const response = await fetch(API_ENDPOINTS.shopRecipeIngredients.getByRecipeId(recipeId));
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching shop recipe ingredients for recipe ${recipeId}:`, error);
      throw error;
    }
  }
}

export default new ShopRecipeIngredientsService();
