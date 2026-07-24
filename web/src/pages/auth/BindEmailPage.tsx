import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
} from '@mui/material';
import { Email, Lock } from '@mui/icons-material';
import { useAuthStore } from '../../store/auth.store';
import { useToast } from '../../hooks/useToast';
import { bindEmail, sendBindEmailCode } from '../../api/auth.api';
import { ROUTE_PATHS } from '../../utils/constants';
import { ApiError } from '../../api/client';

/**
 * 绑定邮箱页面
 * OIDC 新用户登录后需绑定邮箱，输入邮箱 + 验证码完成绑定
 */
export default function BindEmailPage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const { success: showSuccess, error: showError } = useToast();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 倒计时逻辑
  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [countdown]);

  // 如果用户已绑定邮箱，跳转首页
  useEffect(() => {
    if (user?.emailVerified) {
      navigate(ROUTE_PATHS.DASHBOARD, { replace: true });
    }
  }, [user, navigate]);

  const handleSendCode = useCallback(async () => {
    if (!email) {
      setErrorMsg('请输入邮箱地址');
      return;
    }

    setSendingCode(true);
    setErrorMsg('');
    try {
      await sendBindEmailCode(email);
      showSuccess('验证码已发送');
      setCountdown(60);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('验证码发送失败，请稍后重试');
      }
    } finally {
      setSendingCode(false);
    }
  }, [email, showSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !code) {
      setErrorMsg('请填写邮箱和验证码');
      return;
    }

    setLoading(true);
    try {
      const { user: updatedUser } = await bindEmail(email, code);
      updateUser(updatedUser);
      showSuccess('邮箱绑定成功');
      navigate(updatedUser.role === 'admin' ? ROUTE_PATHS.ADMIN_DASHBOARD : ROUTE_PATHS.DASHBOARD, {
        replace: true,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('绑定失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0f4f8 0%, #e0f2fe 100%)',
        py: 4,
      }}
    >
      <Card sx={{ width: 400, maxWidth: '90vw', p: 4, borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
            绑定邮箱
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            请绑定您的邮箱以完成账号设置
          </Typography>
        </Box>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
            {errorMsg}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="邮箱"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Email fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              label="验证码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="outlined"
              disabled={countdown > 0 || sendingCode || !email}
              onClick={handleSendCode}
              sx={{ borderRadius: '8px', minWidth: 120, textTransform: 'none', whiteSpace: 'nowrap' }}
            >
              {countdown > 0 ? `${countdown}s` : sendingCode ? '发送中...' : '发送验证码'}
            </Button>
          </Box>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ borderRadius: '8px', py: 1.2, textTransform: 'none' }}
          >
            {loading ? '绑定中...' : '绑定邮箱'}
          </Button>
        </form>
      </Card>
    </Box>
  );
}
