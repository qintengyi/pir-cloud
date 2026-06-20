import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { ROUTE_PATHS } from './utils/constants';
import AuthGuard from './components/Layout/AuthGuard';
import MainLayout from './components/Layout/MainLayout';
import AdminLayout from './components/Layout/AdminLayout';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

import DashboardPage from './pages/dashboard/DashboardPage';
import DevicesPage from './pages/devices/DevicesPage';
import DeviceDetailPage from './pages/devices/DeviceDetailPage';
import AlarmsPage from './pages/alarms/AlarmsPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import ProfilePage from './pages/profile/ProfilePage';

import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import ActivationCodesPage from './pages/admin/ActivationCodesPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import OrdersPage from './pages/admin/OrdersPage';
import SettingsPage from './pages/admin/SettingsPage';

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <Routes>

      <Route path={ROUTE_PATHS.LOGIN} element={isAuthenticated ? <Navigate to={ROUTE_PATHS.DASHBOARD} /> : <LoginPage />} />
      <Route path={ROUTE_PATHS.REGISTER} element={isAuthenticated ? <Navigate to={ROUTE_PATHS.DASHBOARD} /> : <RegisterPage />} />
      <Route path={ROUTE_PATHS.FORGOT_PASSWORD} element={isAuthenticated ? <Navigate to={ROUTE_PATHS.DASHBOARD} /> : <ForgotPasswordPage />} />

      <Route
        path={ROUTE_PATHS.DASHBOARD}
        element={
          <AuthGuard>
            <MainLayout>
              <DashboardPage />
            </MainLayout>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTE_PATHS.DEVICES}
        element={
          <AuthGuard>
            <MainLayout>
              <DevicesPage />
            </MainLayout>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTE_PATHS.DEVICE_DETAIL}
        element={
          <AuthGuard>
            <MainLayout>
              <DeviceDetailPage />
            </MainLayout>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTE_PATHS.ALARMS}
        element={
          <AuthGuard>
            <MainLayout>
              <AlarmsPage />
            </MainLayout>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTE_PATHS.NOTIFICATIONS}
        element={
          <AuthGuard>
            <MainLayout>
              <NotificationsPage />
            </MainLayout>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTE_PATHS.PROFILE}
        element={
          <AuthGuard>
            <MainLayout>
              <ProfilePage />
            </MainLayout>
          </AuthGuard>
        }
      />

      <Route
        path={ROUTE_PATHS.ADMIN_DASHBOARD}
        element={
          <AuthGuard requireAdmin>
            <AdminLayout>
              <AdminDashboardPage />
            </AdminLayout>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTE_PATHS.ADMIN_ACTIVATION}
        element={
          <AuthGuard requireAdmin>
            <AdminLayout>
              <ActivationCodesPage />
            </AdminLayout>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTE_PATHS.ADMIN_USERS}
        element={
          <AuthGuard requireAdmin>
            <AdminLayout>
              <AdminUsersPage />
            </AdminLayout>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTE_PATHS.ADMIN_ORDERS}
        element={
          <AuthGuard requireAdmin>
            <AdminLayout>
              <OrdersPage />
            </AdminLayout>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTE_PATHS.ADMIN_SETTINGS}
        element={
          <AuthGuard requireAdmin>
            <AdminLayout>
              <SettingsPage />
            </AdminLayout>
          </AuthGuard>
        }
      />

      <Route path="*" element={<Navigate to={ROUTE_PATHS.DASHBOARD} replace />} />
    </Routes>
  );
}
