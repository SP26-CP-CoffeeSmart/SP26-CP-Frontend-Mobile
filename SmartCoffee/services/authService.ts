import { API_ENDPOINTS } from './api';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
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

const postJson = async <T>(url: string, payload: Record<string, string>) => {
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

export const registerAccount = async (email: string, password: string): Promise<string> => {
  return postJson<string>(API_ENDPOINTS.auth.register(), { email, password });
};

export const loginAccount = async (email: string, password: string): Promise<AuthTokens> => {
  return postJson<AuthTokens>(API_ENDPOINTS.auth.login(), { email, password });
};

export const verifyOtp = async (email: string, otp: string): Promise<AuthTokens> => {
  return postJson<AuthTokens>(API_ENDPOINTS.auth.verifyOtp(), { email, otp });
};
