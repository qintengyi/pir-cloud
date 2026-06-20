import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse, RefreshResult } from '../types';
import { STORAGE_KEYS } from '../utils/constants';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

/** axios 实例 */
const apiClient = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** 是否正在刷新 token */
let isRefreshing = false;
/** 等待 token 刷新的请求队列 */
let refreshQueue: Array<(token: string) => void> = [];

/**
 * 请求拦截器：自动携带 access_token
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * 响应拦截器：处理统一响应格式 + 401 自动刷新
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const data = response.data;

    if (data.code !== 0) {
      return Promise.reject(new ApiError(data.code, data.message, response.status));
    }
    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/register')
    ) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((token: string) => {
            if (token) {
              originalRequest.headers!.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      isRefreshing = true;
      try {
        const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const refreshResponse = await axios.post<ApiResponse<RefreshResult>>(
          `${baseURL}/auth/refresh`,
          { refreshToken },
        );

        if (refreshResponse.data.code !== 0) {
          throw new Error('Refresh failed');
        }

        const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data.data;
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);

        refreshQueue.forEach((cb) => cb(accessToken));
        refreshQueue = [];

        originalRequest.headers!.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {

        refreshQueue = [];
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    const apiError = error.response?.data;
    if (apiError) {
      return Promise.reject(new ApiError(apiError.code, apiError.message, error.response!.status));
    }
    return Promise.reject(new ApiError(5001, error.message || '网络错误', 500));
  },
);

/** 自定义 API 错误类 */
export class ApiError extends Error {
  code: number;
  statusCode: number;

  constructor(code: number, message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export default apiClient;
