import { create } from 'zustand';
import type { UserPublicInfo } from '../types';
import { STORAGE_KEYS } from '../utils/constants';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserPublicInfo | null;
  isAuthenticated: boolean;

  /** 设置认证信息（登录/注册后调用） */
  setAuth: (accessToken: string, refreshToken: string, user: UserPublicInfo) => void;
  /** 更新用户信息 */
  updateUser: (user: UserPublicInfo) => void;
  /** 清除认证信息（退出登录） */
  clearAuth: () => void;
  /** 从 localStorage 恢复 token */
  restoreFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,

  setAuth: (accessToken, refreshToken, user) => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    set({ accessToken, refreshToken, user, isAuthenticated: true });
  },

  updateUser: (user) => {
    set({ user });
  },

  clearAuth: () => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
  },

  restoreFromStorage: () => {
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (accessToken && refreshToken) {
      set({ accessToken, refreshToken, isAuthenticated: true });
    }
  },
}));
