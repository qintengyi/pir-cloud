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

// 初始化时立即从 localStorage 恢复状态
const getInitialState = () => {
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  const userJson = localStorage.getItem(STORAGE_KEYS.USER_INFO);
  let user: UserPublicInfo | null = null;
  if (userJson) {
    try {
      user = JSON.parse(userJson);
    } catch {
      // ignore parse error
    }
  }
  const isAuthenticated = !!(accessToken && refreshToken);
  return { accessToken, refreshToken, user, isAuthenticated };
};

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialState(),

  setAuth: (accessToken, refreshToken, user) => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(user));
    set({ accessToken, refreshToken, user, isAuthenticated: true });
  },

  updateUser: (user) => {
    localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(user));
    set({ user });
  },

  clearAuth: () => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_INFO);
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
  },

  restoreFromStorage: () => {
    const state = getInitialState();
    set(state);
  },
}));
