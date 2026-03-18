import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Base API configuration
const normalizeApiBaseUrl = (baseUrl: string) =>
  baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;

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
    android: normalizeApiBaseUrl('http://10.0.2.2:sp26-cp-backend-production.up.railway.app'),
    ios: normalizeApiBaseUrl('http://192.168.2.2:5080'),
    default: normalizeApiBaseUrl('https://sp26-cp-backend-production.up.railway.app'),
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
  ghn: {
    provinces: () => `${AUTH_BASE_URL}/GHN/provinces`,
    districts: (provinceId: number) => `${AUTH_BASE_URL}/GHN/districts/${provinceId}`,
    wards: (districtId: number) => `${AUTH_BASE_URL}/GHN/wards/${districtId}`,
    availableServices: (fromDistrictId: number, toDistrictId: number) =>
      `${AUTH_BASE_URL}/GHN/available-services?fromDistrictId=${fromDistrictId}&toDistrictId=${toDistrictId}`,
  },
  shopRecipeIngredients: {
    getAll: () => `${AUTH_BASE_URL}/ShopRecipeIngredients`,
    getById: (id: number) => `${AUTH_BASE_URL}/ShopRecipeIngredients/${id}`,
    getByRecipeId: (recipeId: number) => `${AUTH_BASE_URL}/ShopRecipeIngredients/by-recipe/${recipeId}`,
  },
  beverageSize: {
    getAll: () => `${AUTH_BASE_URL}/BeverageSize`,
    getByShop: (shopId: number) => `${AUTH_BASE_URL}/BeverageSize/by-shop/${shopId}`,
    create: () => `${AUTH_BASE_URL}/BeverageSize`,
    update: (id: number) => `${AUTH_BASE_URL}/BeverageSize/${id}`,
  },
  beverageCategory: {
    getAll: () => `${AUTH_BASE_URL}/BeverageCategory`,
    getByShop: (shopId: number) => `${AUTH_BASE_URL}/BeverageCategory/shop/${shopId}`,
  },
  shopBeverage: {
    count: () => `${AUTH_BASE_URL}/ShopBeverage/count`,
    getByShop: (shopId: number) => `${AUTH_BASE_URL}/ShopBeverage/shop/${shopId}`,
    create: () => `${AUTH_BASE_URL}/ShopBeverage`,
    uploadImage: () => `${AUTH_BASE_URL}/ShopBeverage/upload-image`,
  },
  itemSize: {
    getByMenu: (menuId: number) => `${AUTH_BASE_URL}/ItemSize/by-menu/${menuId}`,
  },
  ai: {
    createMenuSkeleton: () => `${AUTH_BASE_URL}/AI/create-menu-p1-skeleton`,
    createMenuRegenerate: () => `${AUTH_BASE_URL}/AI/create-menu-p1-5-regenerate`,
    createMenuDetails: () => `${AUTH_BASE_URL}/AI/create-menu-p2-details`,
    createMenuRender: () => `${AUTH_BASE_URL}/AI/create-menu-p3-render`,
    predictInventory: () => `${AUTH_BASE_URL}/AI/predict-inventory`,
  },
  menu: {
    getByShop: (shopId: number) => `${AUTH_BASE_URL}/Menu/by-shop/${shopId}`,
    getActiveByShop: (shopId: number) => `${AUTH_BASE_URL}/Menu/active-by-shop/${shopId}`,
    getById: (id: number) => `${AUTH_BASE_URL}/Menu/${id}`,
  },
  menuHeader: {
    getById: (id: number) => `${AUTH_BASE_URL}/MenuHeader/${id}`,
  },
  menuPerformance: {
    getSummary: (menuId: number) => `${AUTH_BASE_URL}/MenuPerformance/${menuId}/summary`,
  },
  menuItem: {
    getAll: () => `${AUTH_BASE_URL}/MenuItem`,
    getById: (id: number) => `${AUTH_BASE_URL}/MenuItem/${id}`,
  },
  ingredient: {
    getAll: () => `${AUTH_BASE_URL}/Ingredient`,
    getById: (id: number) => `${AUTH_BASE_URL}/Ingredient/${id}`,
  },
  shopStaff: {
    getByShop: (shopId: number) => `${AUTH_BASE_URL}/ShopStaff/by-shop/${shopId}`,
    create: () => `${AUTH_BASE_URL}/Auth/register-staff`,
  },
  dailySale: {
    batch: () => `${AUTH_BASE_URL}/DailySale/batch`,
    getByMenuItem: (menuItemId: number) => `${AUTH_BASE_URL}/DailySale/by-menu-item/${menuItemId}`,
  },
  order: {
    fromSupplierProducts: () => `${AUTH_BASE_URL}/Order/from-supplier-products`,
    byOwner: (ownerId: number) => `${AUTH_BASE_URL}/Order/by-owner/${ownerId}`,
    ghnFee: () => `${AUTH_BASE_URL}/Order/ghn-fee`,
  },
  supplier: {
    list: () => `${AUTH_BASE_URL}/Supplier`,
  },
  supplierProduct: {
    list: () => `${AUTH_BASE_URL}/SupplierProduct`,
  },
  importNote: {
    create: () => `${AUTH_BASE_URL}/ImportNote`,
    getByShop: (shopId: number) => `${AUTH_BASE_URL}/ImportNote/by-shop/${shopId}`,
  },
  importDetail: {
    create: () => `${AUTH_BASE_URL}/ImportDetail`,
    getByNote: (importNoteId: number | string) => `${AUTH_BASE_URL}/ImportDetail/by-note/${importNoteId}`,
  },
  exportNote: {
    create: () => `${AUTH_BASE_URL}/ExportNote`,
    getByShop: (shopId: number) => `${AUTH_BASE_URL}/ExportNote/by-shop/${shopId}`,
  },
  exportDetail: {
    create: () => `${AUTH_BASE_URL}/ExportDetail`,
    getByNote: (exportNoteId: number | string) => `${AUTH_BASE_URL}/ExportDetail/by-note/${exportNoteId}`,
  },
  wallet: {
    topUp: () => `${AUTH_BASE_URL}/Wallet/top-up`,
  },
  shopInventory: {
    getById: (id: number) => `${AUTH_BASE_URL}/ShopInventory/${id}`,
    getByShop: (shopId: number) => `${AUTH_BASE_URL}/ShopInventory/by-shop/${shopId}`,
    update: (id: number) => `${AUTH_BASE_URL}/ShopInventory/${id}`,
    export: () => `${AUTH_BASE_URL}/ShopInventory/export`,
    importFromOrder: (orderId: number) => `${AUTH_BASE_URL}/ShopInventory/import-from-order/${orderId}`,
    manualImport: () => `${AUTH_BASE_URL}/ShopInventory/manual-import`,
  },
};