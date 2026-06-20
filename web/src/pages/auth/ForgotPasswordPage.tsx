import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  TextField,
  Button,
  Typography,
  InputAdornment,
  Alert,
  IconButton,
} from '@mui/material';
import { Email, Lock, Visibility, VisibilityOff, ArrowBack } from '@mui/icons-material';
import { useToast } from '../../hooks/useToast';
import { ROUTE_PATHS } from '../../utils/constants';
import { ApiError } from '../../api/client';
import * as authApi from '../../api/auth.api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { success: showSuccess, error: showError } = useToast();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSendCode = useCallback(async () => {
    if (!email) {
      setErrorMsg('请先输入邮箱');
      return;
    }
    setErrorMsg('');
    setSendingCode(true);
    try {
      await authApi.forgotPassword(email);
      showSuccess('验证码已发送到邮箱');
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('验证码发送失败');
      }
    } finally {
      setSendingCode(false);
    }
  }, [email, showSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      await authApi.resetPassword(email, code, newPassword);
      showSuccess('密码重置成功，请重新登录');
      navigate(ROUTE_PATHS.LOGIN);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('重置失败，请稍后重试');
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
            重置密码
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            输入邮箱验证码重置密码
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
              inputProps={{ maxLength: 6 }}
            />
            <Button
              variant="outlined"
              onClick={handleSendCode}
              disabled={sendingCode || countdown > 0}
              sx={{ minWidth: 120, borderRadius: '8px', whiteSpace: 'nowrap' }}
            >
              {countdown > 0 ? `${countdown}s` : '发送验证码'}
            </Button>
          </Box>

          <TextField
            fullWidth
            label="新密码（至少8位，含字母和数字）"
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock fontSize="small" color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ borderRadius: '8px', py: 1.2, textTransform: 'none' }}
          >
            {loading ? '重置中...' : '重置密码'}
          </Button>
        </form>

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Link to={ROUTE_PATHS.LOGIN}>
            <Typography variant="body2" color="primary.main" sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
              <ArrowBack fontSize="small" /> 返回登录
            </Typography>
          </Link>
        </Box>
      </Card>
    </Box>
  );
}
