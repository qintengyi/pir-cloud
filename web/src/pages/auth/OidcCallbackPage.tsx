import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Alert, Button, Typography } from '@mui/material';
import { useAuthStore } from '../../store/auth.store';
import { getMe } from '../../api/auth.api';
import { ROUTE_PATHS, STORAGE_KEYS } from '../../utils/constants';

/**
 * OIDC 回调页面
 * 解析 URL hash 中的 token，存储后拉取用户信息，跳转到对应页面
 */
export default function OidcCallbackPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    async function processCallback() {
      try {
        // 解析 hash 中的参数
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);

        // 检查错误参数
        const errorParam = params.get('error');
        if (errorParam) {
          setError(decodeURIComponent(errorParam));
          return;
        }

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const needBindEmail = params.get('need_bind_email') === 'true';

        if (!accessToken || !refreshToken) {
          setError('登录回调参数缺失，请重新登录');
          return;
        }

        // 先将 token 写入 localStorage，使后续 API 请求能携带
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);

        // 拉取用户信息
        const { user } = await getMe();

        // 存储完整的认证状态
        setAuth(accessToken, refreshToken, user);

        // 根据是否需要绑定邮箱进行跳转
        if (needBindEmail) {
          navigate(ROUTE_PATHS.BIND_EMAIL, { replace: true });
        } else {
          navigate(user.role === 'admin' ? ROUTE_PATHS.ADMIN_DASHBOARD : ROUTE_PATHS.DASHBOARD, {
            replace: true,
          });
        }
      } catch (err: any) {
        setError(err.message || '登录失败，请稍后重试');
      }
    }

    processCallback();
  }, [navigate, setAuth]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0f4f8 0%, #e0f2fe 100%)',
      }}
    >
      <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
        {error ? (
          <>
            <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
              {error}
            </Alert>
            <Button
              variant="contained"
              onClick={() => navigate(ROUTE_PATHS.LOGIN, { replace: true })}
              sx={{ borderRadius: '8px', textTransform: 'none' }}
            >
              返回登录
            </Button>
          </>
        ) : (
          <>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              正在登录...
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
}
