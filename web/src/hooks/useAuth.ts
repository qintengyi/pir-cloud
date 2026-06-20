import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useUiStore } from '../store/ui.store';
import { ROUTE_PATHS } from '../utils/constants';
import * as authApi from '../api/auth.api';
import type { UserPublicInfo } from '../types';

/**
 * 认证状态 Hook
 * 封装登录/注册/退出等认证操作
 */
export function useAuth() {
  const navigate = useNavigate();
  const { user, isAuthenticated, setAuth, clearAuth, updateUser, restoreFromStorage } = useAuthStore();
  const { showSnackbar } = useUiStore();

  /** 登录 */
  const login = useCallback(
    async (email: string, password: string, turnstileToken?: string) => {
      const result = await authApi.login(email, password, turnstileToken);
      setAuth(result.accessToken, result.refreshToken, result.user);
      showSnackbar('登录成功', 'success');

      navigate(result.user.role === 'admin' ? ROUTE_PATHS.ADMIN_DASHBOARD : ROUTE_PATHS.DASHBOARD);
      return result;
    },
    [setAuth, showSnackbar, navigate],
  );

  /** 注册 */
  const register = useCallback(
    async (email: string, code: string, password: string, nickname?: string) => {
      const result = await authApi.register(email, code, password, nickname);
      setAuth(result.accessToken, result.refreshToken, result.user);
      showSnackbar('注册成功', 'success');
      navigate(ROUTE_PATHS.DASHBOARD);
      return result;
    },
    [setAuth, showSnackbar, navigate],
  );

  /** 退出登录 */
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {

    }
    clearAuth();
    showSnackbar('已退出登录', 'info');
    navigate(ROUTE_PATHS.LOGIN);
  }, [clearAuth, showSnackbar, navigate]);

  /** 更新用户信息 */
  const updateCurrentUser = useCallback(
    (user: UserPublicInfo) => {
      updateUser(user);
    },
    [updateUser],
  );

  return {
    user,
    isAuthenticated,
    login,
    register,
    logout,
    updateCurrentUser,
    restoreFromStorage,
  };
}
