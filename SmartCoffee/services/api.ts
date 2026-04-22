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
    forgotPassword: () => `${AUTH_BASE_URL}/Auth/forgot-password`,
    verifyForgotPasswordOtp: () => `${AUTH_BASE_URL}/Auth/verify-forgot-password-otp`,
    resetPassword: () => `${AUTH_BASE_URL}/Auth/reset-password`,
    me: () => `${AUTH_BASE_URL}/Auth/me`,
    logout: () => `${AUTH_BASE_URL}/Auth/logout`,
    refreshToken: () => `${AUTH_BASE_URL}/Auth/refresh-token`,
    changePassword: () => `${AUTH_BASE_URL}/Auth/change-password`,
    updateStaff: () => `${AUTH_BASE_URL}/Auth/update-staff`,
    updateCoffeeShop: () => `${AUTH_BASE_URL}/Auth/update-coffeeshop`,
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
  shopRecipe: {
    create: () => `${AUTH_BASE_URL}/ShopRecipe`,
    getById: (id: number) => `${AUTH_BASE_URL}/ShopRecipe/${id}`,
    getByShop: (shopId: number) => `${AUTH_BASE_URL}/ShopRecipe/by-shop/${shopId}`,
    enablePublic: (shopRecipeId: number) => `${AUTH_BASE_URL}/ShopRecipe/${shopRecipeId}/enable-public`,
    uploadImage: () => `${AUTH_BASE_URL}/ShopRecipe/upload-image`,
  },
  postCategory: {
    list: () => `${AUTH_BASE_URL}/post-categories`,
  },
  post: {
    list: () => `${AUTH_BASE_URL}/post`,
    getById: (id: number) => `${AUTH_BASE_URL}/post/${id}`,
    update: (id: number) => `${AUTH_BASE_URL}/post/${id}`,
    disable: (id: number) => `${AUTH_BASE_URL}/post/${id}/toggle-visibility`,
    toggleVisibility: (id: number) => `${AUTH_BASE_URL}/post/${id}/toggle-visibility`,
  },
  postComment: {
    getById: (commentId: number) => `${AUTH_BASE_URL}/Post/comments/${commentId}`,
    create: (postId: number) => `${AUTH_BASE_URL}/Post/${postId}/comments`,
  },
  coffeeShop: {
    list: () => `${AUTH_BASE_URL}/CoffeeShop`,
    getById: (id: number) => `${AUTH_BASE_URL}/CoffeeShop/${id}`,
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
    generateRecipeImages: () => `${AUTH_BASE_URL}/AI/generate-recipe-images-and-save`,
    analyzeMenuFeedback: (menuId: number) => `${AUTH_BASE_URL}/AI/analyze-menu-feedback/${menuId}`,
    analyzeMenuFeedbackRenderImage: () => `${AUTH_BASE_URL}/AI/analyze-menu-feedback/render-image`,
    updateAi: (menuId: number | string) => `${AUTH_BASE_URL}/AI/update-ai/${menuId}`,
    predictInventory: () => `${AUTH_BASE_URL}/AI/predict-inventory`,
  },
  menu: {
    getByShop: (shopId: number) => `${AUTH_BASE_URL}/Menu/by-shop/${shopId}`,
    getActiveByShop: (shopId: number) => `${AUTH_BASE_URL}/Menu/active-by-shop/${shopId}`,
    getById: (id: number) => `${AUTH_BASE_URL}/Menu/${id}`,
    byHeader: (menuHeaderId: number) => `${AUTH_BASE_URL}/Menu/by-header/${menuHeaderId}`,
    activate: (menuId: number | string) => `${AUTH_BASE_URL}/Menu/${menuId}/activate`,
    saveAi: () => `${AUTH_BASE_URL}/Menu/save-ai`,
    updateAi: (menuId: number | string) => `${AUTH_BASE_URL}/Menu/update-ai/${menuId}`,
    supplierRecommendations: (
      menuId: number | string,
      params: { threshold?: number; numberCupWanted?: number; from?: string; to?: string }
    ) => {
      const query = new URLSearchParams();
      query.set('threshold', String(params.threshold ?? 10));
      if (params.numberCupWanted != null) query.set('numberCupWanted', String(params.numberCupWanted));
      if (params.from) query.set('from', params.from);
      if (params.to) query.set('to', params.to);
      return `${AUTH_BASE_URL}/Menu/${menuId}/supplier-recommendations?${query.toString()}`;
    },
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
    getByMenu: (menuId: number) => `${AUTH_BASE_URL}/MenuItem/by-menu/${menuId}`,
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
    byId: (orderId: number | string) => `${AUTH_BASE_URL}/Order/${orderId}`,
    byOwner: (
      ownerId: number,
      params?: { page?: number; pageSize?: number; orderStatus?: string }
    ) => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.pageSize) query.set('pageSize', String(params.pageSize));
      if (params?.orderStatus) query.set('orderStatus', params.orderStatus);

      const qs = query.toString();
      return `${AUTH_BASE_URL}/Order/by-owner/${ownerId}${qs ? `?${qs}` : ''}`;
    },
    ghnFee: () => `${AUTH_BASE_URL}/Order/ghn-fee`,
    feedback: (orderId: number | string) => `${AUTH_BASE_URL}/Order/${orderId}/feedback`,
    updateStatus: (orderId: number, status: string) => `${AUTH_BASE_URL}/Order/${orderId}/status?status=${status}`,
    updateStatusBody: (orderId: number) => `${AUTH_BASE_URL}/Order/${orderId}/status`,
  },
  orderDetailFeedback: {
    create: () => `${AUTH_BASE_URL}/OrderDetailFeedback`,
  },
  supplier: {
    list: () => `${AUTH_BASE_URL}/Supplier`,
  },
  supplierProduct: {
    list: (page = 1, pageSize = 500) => `${AUTH_BASE_URL}/SupplierProduct?page=${page}&pageSize=${pageSize}`,
    recommendationsByShop: (
      coffeeShopId: number,
      params: { threshold: number; from?: string; to?: string; numberCupWanted?: number }
    ) => {
      const query = new URLSearchParams();
      query.set('threshold', String(params.threshold));
      if (typeof params.numberCupWanted === 'number' && Number.isFinite(params.numberCupWanted)) {
        query.set('numberCupWanted', String(params.numberCupWanted));
      }
      if (typeof params.from === 'string' && params.from.trim()) {
        query.set('from', params.from.trim());
      }
      if (typeof params.to === 'string' && params.to.trim()) {
        query.set('to', params.to.trim());
      }
      return `${AUTH_BASE_URL}/SupplierProduct/recommendations/shop/${coffeeShopId}?${query.toString()}`;
    },
    checkAvailableStock: () => `${AUTH_BASE_URL}/SupplierProduct/check-available-stock`,
    averagePriceByIngredients: () => `${AUTH_BASE_URL}/SupplierProduct/average-price/ingredients`,
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
    zaloPayTopUp: () => `${AUTH_BASE_URL}/ZaloPay/top-up`,
    topUpOrders: () => `${AUTH_BASE_URL}/Wallet/top-up-orders`,
    withdraw: () => `${AUTH_BASE_URL}/Wallet/withdraw`,
    verifyWithdraw: () => `${AUTH_BASE_URL}/Wallet/verify-withdraw`,
    cancelOrderPayment: (orderCode: number | string) => `${AUTH_BASE_URL}/Wallet/cancel-order-payment?orderCode=${orderCode}`,
  },
  subscription: {
    byShop: (shopId: number) => `${AUTH_BASE_URL}/Subscription/by-shop/${shopId}`,
    subscribe: (packageId: number, isMobile = true) =>
      `${AUTH_BASE_URL}/Subscription/subscribe?packageId=${packageId}&isMobile=${isMobile}`,
    trial: () => `${AUTH_BASE_URL}/Subscription/Trials`,
  },
  subscriptionPackage: {
    list: () => `${AUTH_BASE_URL}/SubscriptionPackage`,
  },
  feedback: {
    byMenuItem: (menuId: number, menuItemId: number) =>
      `${AUTH_BASE_URL}/Feedback/MenuItem/${menuId}/${menuItemId}`,
    listByMenu: (menuId: number, page = 1, pageSize = 100) =>
      `${AUTH_BASE_URL}/Feedback/MenuItem?menuId=${menuId}&page=${page}&pageSize=${pageSize}`,
    list: (page = 1, pageSize = 100) =>
      `${AUTH_BASE_URL}/Feedback/MenuItem?page=${page}&pageSize=${pageSize}`,
  },
  transaction: {
    listByUser: (
      userId: number,
      params?: { page?: number; pageSize?: number; paymentMethod?: string }
    ) => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.pageSize) query.set('pageSize', String(params.pageSize));
      if (params?.paymentMethod) query.set('paymentMethod', params.paymentMethod);
      const qs = query.toString();
      return `${AUTH_BASE_URL}/Transaction/list/${userId}${qs ? `?${qs}` : ''}`;
    },
  },
  notification: {
    listByAccount: (
      accountId: number,
      params?: { page?: number; pageSize?: number }
    ) => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.pageSize) query.set('pageSize', String(params.pageSize));
      const qs = query.toString();
      return `${AUTH_BASE_URL}/Notification/account/${accountId}${qs ? `?${qs}` : ''}`;
    },
    unreadCount: () => `${AUTH_BASE_URL}/Notification/unread/count`,
    markRead: (notificationId: string | number) =>
      `${AUTH_BASE_URL}/Notification/${encodeURIComponent(String(notificationId))}/read`,
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