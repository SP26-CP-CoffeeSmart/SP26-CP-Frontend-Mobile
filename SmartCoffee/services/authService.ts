import { API_ENDPOINTS } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ProfileResponse {
  role?: string;
  [key: string]: unknown;
}

interface ApiErrorPayload {
  message?: string;
  error?: string;
  errors?: string[];
}

const parseErrorMessage = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return `Request failed (${response.status})`;
  }

  try {
    const data = JSON.parse(text) as ApiErrorPayload;
    return data.message || data.error || data.errors?.join(', ') || text;
  } catch {
    return text;
  }
};

const storeTokens = async (tokens: AuthTokens) => {
  await AsyncStorage.multiSet([
    ['accessToken', tokens.accessToken],
    ['refreshToken', tokens.refreshToken],
  ]);
};

const mergeHeaders = (headers?: HeadersInit) => {
  if (!headers) {
    return {} as Record<string, string>;
  }

  if (headers instanceof Headers) {
    const merged: Record<string, string> = {};
    headers.forEach((value, key) => {
      merged[key] = value;
    });
    return merged;
  }

  if (Array.isArray(headers)) {
    return headers.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }

  return { ...headers } as Record<string, string>;
};

const withAuthHeader = async (options: RequestInit, token?: string) => {
  const existingHeaders = mergeHeaders(options.headers);
  const accessToken = token ?? (await AsyncStorage.getItem('accessToken'));

  return {
    ...options,
    headers: {
      ...existingHeaders,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  } as RequestInit;
};

const postJson = async <T>(url: string, payload: Record<string, string | undefined>) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
};

export const registerAccount = async (
  email: string,
  password: string,
  phone?: string
): Promise<string> => {
  return postJson<string>(API_ENDPOINTS.auth.register(), {
    email,
    password,
    ...(phone ? { phone } : {}),
  });
};

export const loginAccount = async (email: string, password: string): Promise<AuthTokens> => {
  return postJson<AuthTokens>(API_ENDPOINTS.auth.login(), { email, password });
};

export const verifyOtp = async (email: string, otp: string, role: string): Promise<AuthTokens> => {
  return postJson<AuthTokens>(API_ENDPOINTS.auth.verifyOtp(), { email, otp, role });
};

export const requestForgotPasswordOtp = async (email: string): Promise<string> => {
  return postJson<string>(API_ENDPOINTS.auth.forgotPassword(), { email });
};

export const verifyForgotPasswordOtp = async (email: string, otp: string): Promise<string> => {
  return postJson<string>(API_ENDPOINTS.auth.verifyForgotPasswordOtp(), { email, otp });
};

export const resetForgotPassword = async (
  email: string,
  otp: string,
  newPassword: string
): Promise<string> => {
  return postJson<string>(API_ENDPOINTS.auth.resetPassword(), {
    email,
    otp,
    newPassword,
  });
};

export const refreshTokens = async (): Promise<AuthTokens> => {
  const accessToken = await AsyncStorage.getItem('accessToken');
  const refreshToken = await AsyncStorage.getItem('refreshToken');

  if (!accessToken || !refreshToken) {
    throw new Error('Missing access token or refresh token.');
  }

  const tokens = await postJson<AuthTokens>(API_ENDPOINTS.auth.refreshToken(), {
    accessToken,
    refreshToken,
  });

  await storeTokens(tokens);
  return tokens;
};

export const authorizedFetch = async (url: string, options: RequestInit = {}) => {
  const initialOptions = await withAuthHeader(options);
  let response = await fetch(url, initialOptions);

  if (response.status !== 401) {
    return response;
  }

  try {
    const [accessToken, refreshToken] = await AsyncStorage.multiGet([
      'accessToken',
      'refreshToken',
    ]);
    const hasAccessToken = Boolean(accessToken?.[1]);
    const hasRefreshToken = Boolean(refreshToken?.[1]);
    if (!hasAccessToken || !hasRefreshToken) {
      return response;
    }
    const tokens = await refreshTokens();
    const retryOptions = await withAuthHeader(options, tokens.accessToken);
    response = await fetch(url, retryOptions);
  } catch (error) {
    // Refresh failed - clear tokens and return 401
    console.error('Token refresh failed:', error);
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
    return response;
  }

  return response;
};

export const getProfile = async (): Promise<ProfileResponse> => {
  const response = await authorizedFetch(API_ENDPOINTS.auth.me(), {
    headers: {
      Accept: '*/*',
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as ProfileResponse;
  } catch {
    return { value: text } as ProfileResponse;
  }
};

export const logoutAccount = async (): Promise<void> => {
  try {
    const accessToken = await AsyncStorage.getItem('accessToken');

    // Send logout request with current token, no retry on failure
    const response = await fetch(API_ENDPOINTS.auth.logout(), {
      method: 'POST',
      headers: {
        Accept: '*/*',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

    // Log the response but don't fail on error since user is logging out anyway
    if (!response.ok) {
      console.warn('Logout API returned:', response.status);
    }
  } catch (error) {
    // Log error but continue with local logout
    console.warn('Logout API call failed:', error);
  }

  // Always clear tokens from storage regardless of API response
  await AsyncStorage.multiRemove([
    'accessToken',
    'refreshToken',
    'coffeeShopId',
    'onboarding:complete',
  ]);
};

export const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
  const response = await authorizedFetch(API_ENDPOINTS.auth.changePassword(), {
    method: 'POST',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ oldPassword, newPassword }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
};

export const updateStaffProfile = async (
  email: string,
  fullName: string,
  phone: string
): Promise<void> => {
  const response = await authorizedFetch(API_ENDPOINTS.auth.updateStaff(), {
    method: 'PUT',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      fullName,
      phone,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
};

export const updateCoffeeShop = async (
  coffeeShopId: number,
  shopName: string,
  details?: {
    address?: string | null;
    provinceId?: number | null;
    districtId?: number | null;
    wardCode?: string | null;
  }
): Promise<void> => {
  const response = await authorizedFetch(API_ENDPOINTS.auth.updateCoffeeShop(), {
    method: 'PUT',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      coffeeShopId,
      shopName,
      address: details?.address ?? null,
      provinceId: details?.provinceId ?? null,
      districtId: details?.districtId ?? null,
      wardCode: details?.wardCode ?? null,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
};
