import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { ROUTE_PATHS } from '../../utils/constants';

interface AuthGuardProps {
  children: ReactNode;
  /** 是否需要管理员权限 */
  requireAdmin?: boolean;
}

/**
 * 路由守卫组件
 * - 未登录访问受保护页面 → 重定向 /login
 * - 普通用户访问 /admin
 */
export default function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to={ROUTE_PATHS.LOGIN} state={{ from: location }} replace />;
  }

  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to={ROUTE_PATHS.DASHBOARD} replace />;
  }

  return <>{children}</>;
}
